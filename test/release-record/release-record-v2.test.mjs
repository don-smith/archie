import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { finalizeRelease, parseReleaseRecordV2, selectLocalRelease, npmProjection } from "../../dist/packages/archie-runtime/src/index.js";
import { bootstrapAndVerifyTarget, ReleaseInstallFailure, upgradeAndVerifyTarget } from "../../dist/packages/archie-runtime/src/release-install/verify.js";

const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";
const provenance = "packages/archie-runtime/vendor/html-design.provenance.json";
function makeBundle(base) {
  const bundle = join(base, "bundle"); cpSync("test/fixtures/private-bundles/valid", bundle, { recursive: true });
  const specs = [["archie-runtime", "@archie/runtime", { "architecture-docs": "dist/architecture-docs/bin/architecture-docs.mjs" }], ["conformance", "@archie/conformance", { "architecture-conformance": "dist/cli.js" }]];
  const artifacts = [], recordArtifacts = [];
  for (const [file, name, bin] of specs) {
    const packageRoot = join(base, file); mkdirSync(join(packageRoot, "package"), { recursive: true });
    const dependencies = file === "conformance" ? { "@archie/runtime": "0.1.0-private.0" } : {};
    const engines = { node: ">=24 <25" };
    const requiredPlatformPayload = file === "archie-runtime" ? "vendor/html-design/SKILL.md" : "dist/cli.js";
    writeFileSync(join(packageRoot, "package/package.json"), JSON.stringify({ name, version: "0.1.0-private.0", dependencies, engines, bin }));
    const payloadPath = join(packageRoot, "package", requiredPlatformPayload); mkdirSync(dirname(payloadPath), { recursive: true }); writeFileSync(payloadPath, "required payload\n");
    const packed = JSON.parse(execFileSync("npm", ["pack", "--json", join(packageRoot, "package"), "--pack-destination", join(bundle, "npm")], { cwd: base, encoding: "utf8" }));
    renameSync(join(bundle, "npm", packed[0].filename), join(bundle, `npm/${file}.tgz`));
    const bytes = readFileSync(join(bundle, `npm/${file}.tgz`));
    const locator = `file:npm/${file}.tgz`, lockIntegrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
    artifacts.push({ package: name, version: "0.1.0-private.0", locator, lockFile: `npm/${file}.lock.json`, tarball: `npm/${file}.tgz`, requiredPlatformPayload });
    recordArtifacts.push({ package: name, version: "0.1.0-private.0", locator, lockIntegrity, tarballSha256: createHash("sha256").update(bytes).digest("hex"), requiredPlatformPayload, dependencies, engines, binaries: bin });
  }
  const projection = npmProjection({ schemaVersion: 2, version: "0.1.0-private.0", artifacts: recordArtifacts });
  for (const [file] of specs) writeFileSync(join(bundle, `npm/${file}.lock.json`), projection.lock);
  const old = JSON.parse(readFileSync(join(bundle, "bundle.json"), "utf8"));
  writeFileSync(join(bundle, "bundle.json"), `${JSON.stringify({ format: "archie-private-bundle-input-v2", artifacts, apm: old.apm }, null, 2)}\n`);
  return bundle;
}

test("v2 finalization is deterministic and projects both ordered local artifacts", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-v2-record-"));
  try {
    const first = makeBundle(join(base, "one"));
    const one = finalizeRelease({ bundleDirectory: first, sourceCommit, htmlProvenancePath: provenance });
    const two = finalizeRelease({ bundleDirectory: first, sourceCommit, htmlProvenancePath: provenance });
    assert.equal(one.record.schemaVersion, 2); assert.equal(readFileSync(one.recordPath, "utf8"), readFileSync(two.recordPath, "utf8"));
    assert.deepEqual(one.record.artifacts.map((artifact) => artifact.package), ["@archie/runtime", "@archie/conformance"]);
    const projection = npmProjection(one.record); const lock = JSON.parse(projection.lock);
    assert.deepEqual(Object.keys(JSON.parse(projection.manifest).dependencies), ["@archie/runtime", "@archie/conformance"]);
    assert.ok(lock.packages["node_modules/@archie/runtime"]);
    assert.ok(lock.packages["node_modules/@archie/conformance"]);
    assert.ok(lock.packages["node_modules/likec4"], "v2 lock must retain the Runtime dependency closure");
    assert.equal(selectLocalRelease(first).record.schemaVersion, 2);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("v2 finalization rejects an incomplete install lock", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-v2-incomplete-lock-"));
  try {
    const bundle = makeBundle(base);
    const input = JSON.parse(readFileSync(join(bundle, "bundle.json"), "utf8"));
    const lockPath = join(bundle, input.artifacts[0].lockFile), lock = JSON.parse(readFileSync(lockPath, "utf8"));
    delete lock.packages[""];
    writeFileSync(lockPath, JSON.stringify(lock));
    assert.throws(() => finalizeRelease({ bundleDirectory: bundle, sourceCommit, htmlProvenancePath: provenance }), /exact generated v2 projection/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("v2 finalization rejects missing and unsafe required platform payloads", () => {
  for (const [payload, expected] of [
    ["dist/missing.js", /omits required platform payload/],
    ["../escape", /payload path is unsafe/],
    ["/absolute", /payload path is unsafe/],
    ["dist/../cli.js", /payload path is unsafe/]
  ]) {
    const base = mkdtempSync(join(tmpdir(), "archie-v2-required-payload-"));
    try {
      const bundle = makeBundle(base), inputPath = join(bundle, "bundle.json"), input = JSON.parse(readFileSync(inputPath, "utf8"));
      input.artifacts[1].requiredPlatformPayload = payload;
      writeFileSync(inputPath, JSON.stringify(input));
      assert.throws(() => finalizeRelease({ bundleDirectory: bundle, sourceCommit, htmlProvenancePath: provenance }), expected);
    } finally { rmSync(base, { recursive: true, force: true }); }
  }
});

test("v2 parser and selection reject network, reordered, and mutated artifact evidence", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-v2-mutation-"));
  try {
    const bundle = makeBundle(base); const result = finalizeRelease({ bundleDirectory: bundle, sourceCommit, htmlProvenancePath: provenance });
    const record = JSON.parse(readFileSync(result.recordPath, "utf8")); record.artifacts[0].locator = "https://registry.npmjs.org/archie-runtime.tgz";
    assert.throws(() => parseReleaseRecordV2(`${JSON.stringify(record)}\n`), /local tarballs|malformed/);
    const inputPath = join(bundle, "bundle.json"), input = JSON.parse(readFileSync(inputPath, "utf8"));
    [input.artifacts[0], input.artifacts[1]] = [input.artifacts[1], input.artifacts[0]]; writeFileSync(inputPath, JSON.stringify(input));
    assert.throws(() => selectLocalRelease(bundle), /ordered|identity|differs|package/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

function makeV1Bundle(base) {
  const bundle = join(base, "bundle-v1"); cpSync("test/fixtures/private-bundles/valid", bundle, { recursive: true });
  finalizeRelease({ bundleDirectory: bundle, sourceCommit, htmlProvenancePath: provenance });
  return bundle;
}
function installationRunner(failV2Npm = false) {
  return ({ command, args, cwd }) => {
    if (command === "npm") {
      const releaseRoot = join(cwd, "..", "release");
      const v2Path = join(releaseRoot, "release-record-v2.json");
      if (failV2Npm && existsSync(v2Path)) return { exitCode: 9, stdout: "", stderr: "injected v2 npm failure" };
      const record = JSON.parse(readFileSync(existsSync(v2Path) ? v2Path : join(releaseRoot, "release-record-v1.json"), "utf8"));
      const artifacts = record.schemaVersion === 2 ? record.artifacts : [{ package: record.npm.package, version: record.npm.version, dependencies: {}, engines: {}, binaries: {} }];
      rmSync(join(cwd, "node_modules"), { recursive: true, force: true });
      for (const artifact of artifacts) {
        const packageRoot = join(cwd, "node_modules", artifact.package); mkdirSync(packageRoot, { recursive: true });
        writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name: artifact.package, version: artifact.version, dependencies: artifact.dependencies, engines: artifact.engines, bin: artifact.binaries }));
        for (const [name, relativePath] of Object.entries(artifact.binaries)) {
          const file = join(packageRoot, relativePath); mkdirSync(join(file, ".."), { recursive: true }); writeFileSync(file, "#!/usr/bin/env node\\n");
          mkdirSync(join(cwd, "node_modules/.bin"), { recursive: true }); symlinkSync(join("..", artifact.package, relativePath), join(cwd, "node_modules/.bin", name));
        }
      }
    }
    if (command === "apm" && args[0] === "lock") writeFileSync(join(cwd, "apm.lock.yaml"), readFileSync("test/fixtures/private-bundles/valid/apm/apm.lock.yaml", "utf8"));
    return { exitCode: 0, stdout: "", stderr: "" };
  };
}

test("v2 bootstrap stages both tarballs and exposes both project-local binary links", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-v2-install-"));
  try {
    const bundle = makeBundle(base); finalizeRelease({ bundleDirectory: bundle, sourceCommit, htmlProvenancePath: provenance });
    const target = join(base, "target"); mkdirSync(target); const calls = [];
    const run = ({ command, args, cwd }) => {
      calls.push([command, ...args]);
      if (command === "npm") {
        const record = JSON.parse(readFileSync(join(cwd, "..", "release/release-record-v2.json"), "utf8"));
        for (const artifact of record.artifacts) {
          const packageRoot = join(cwd, "node_modules", artifact.package); mkdirSync(packageRoot, { recursive: true });
          writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name: artifact.package, version: artifact.version, dependencies: artifact.dependencies, engines: artifact.engines, bin: artifact.binaries }));
          for (const [name, relativePath] of Object.entries(artifact.binaries)) { const file = join(packageRoot, relativePath); mkdirSync(join(file, ".."), { recursive: true }); writeFileSync(file, "#!/usr/bin/env node\\n"); mkdirSync(join(cwd, "node_modules/.bin"), { recursive: true }); execFileSync("ln", ["-s", join("..", artifact.package, relativePath), join(cwd, "node_modules/.bin", name)]); }
        }
      }
      if (command === "apm" && args[0] === "lock") writeFileSync(join(cwd, "apm.lock.yaml"), readFileSync("test/fixtures/private-bundles/valid/apm/apm.lock.yaml", "utf8"));
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const result = bootstrapAndVerifyTarget(target, selectLocalRelease(bundle), { run, verifyHtml: () => undefined, verifyApmDeployment: () => undefined });
    assert.equal(result.record.schemaVersion, 2); assert.ok(calls.some((call) => call.join(" ") === "npm ci --ignore-scripts --offline"));
    assert.ok(readFileSync(join(target, ".archie/runtime/package.json"), "utf8").includes("@archie/conformance"));
    assert.equal(readFileSync(join(target, ".archie/release/release-record-v2.json"), "utf8").length > 0, true);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("a verified v1 target upgrades to v2 with both project-local binaries", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-v1-v2-upgrade-"));
  try {
    const v1 = selectLocalRelease(makeV1Bundle(base));
    const next = join(base, "next"); mkdirSync(next);
    const v2Bundle = makeBundle(next); finalizeRelease({ bundleDirectory: v2Bundle, sourceCommit, htmlProvenancePath: provenance });
    const v2 = selectLocalRelease(v2Bundle);
    const target = join(base, "target"); mkdirSync(target);
    const options = { run: installationRunner(), verifyHtml: () => undefined, verifyApmDeployment: () => undefined };
    bootstrapAndVerifyTarget(target, v1, options);
    const result = upgradeAndVerifyTarget(target, v2, options);
    assert.equal(result.record.schemaVersion, 2);
    assert.ok(existsSync(join(target, ".archie/runtime/node_modules/.bin/architecture-docs")));
    assert.ok(existsSync(join(target, ".archie/runtime/node_modules/.bin/architecture-conformance")));
    assert.equal(existsSync(join(target, ".archie/release/release-record-v1.json")), false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("a failed v1-to-v2 upgrade compensates to the verified v1 target", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-v1-v2-compensation-"));
  try {
    const v1 = selectLocalRelease(makeV1Bundle(base));
    const next = join(base, "next"); mkdirSync(next);
    const v2Bundle = makeBundle(next); finalizeRelease({ bundleDirectory: v2Bundle, sourceCommit, htmlProvenancePath: provenance });
    const v2 = selectLocalRelease(v2Bundle);
    const target = join(base, "target"); mkdirSync(target);
    const stable = { run: installationRunner(), verifyHtml: () => undefined, verifyApmDeployment: () => undefined };
    bootstrapAndVerifyTarget(target, v1, stable);
    const before = readFileSync(join(target, ".archie/release/release-record-v1.json"), "utf8");
    let failure;
    try { upgradeAndVerifyTarget(target, v2, { ...stable, run: installationRunner(true) }); } catch (error) { failure = error; }
    assert.ok(failure instanceof ReleaseInstallFailure);
    assert.equal(failure.report.compensation, "passed");
    assert.equal(readFileSync(join(target, ".archie/release/release-record-v1.json"), "utf8"), before);
    assert.equal(existsSync(join(target, ".archie/release/release-record-v2.json")), false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

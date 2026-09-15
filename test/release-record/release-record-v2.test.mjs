import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { finalizeRelease, parseReleaseRecordV2, selectLocalRelease, npmProjection } from "../../dist/packages/archie-runtime/src/index.js";
import { bootstrapAndVerifyTarget } from "../../dist/packages/archie-runtime/src/release-install/verify.js";

const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";
const provenance = "packages/archie-runtime/vendor/html-design.provenance.json";
function makeBundle(base) {
  const bundle = join(base, "bundle"); cpSync("test/fixtures/private-bundles/valid", bundle, { recursive: true });
  const specs = [["archie-runtime", "@archie/runtime", { "architecture-docs": "dist/architecture-docs/bin/architecture-docs.mjs" }], ["conformance", "@archie/conformance", { "architecture-conformance": "dist/cli.js" }]];
  const artifacts = [];
  for (const [file, name, bin] of specs) {
    const packageRoot = join(base, file); mkdirSync(join(packageRoot, "package"), { recursive: true });
    writeFileSync(join(packageRoot, "package/package.json"), JSON.stringify({ name, version: "0.1.0-private.0", dependencies: file === "conformance" ? { "@archie/runtime": "0.1.0-private.0" } : {}, engines: { node: ">=24 <25" }, bin }));
    execFileSync("tar", ["-czf", join(bundle, `npm/${file}.tgz`), "-C", packageRoot, "package"]);
    const bytes = readFileSync(join(bundle, `npm/${file}.tgz`));
    const locator = `file:npm/${file}.tgz`;
    artifacts.push({ package: name, version: "0.1.0-private.0", locator, lockFile: `npm/${file}.lock.json`, tarball: `npm/${file}.tgz`, requiredPlatformPayload: file === "archie-runtime" ? "vendor/html-design/SKILL.md" : "dist/cli.js" });
    writeFileSync(join(bundle, `npm/${file}.lock.json`), JSON.stringify({ packages: { [`node_modules/${name}`]: { version: "0.1.0-private.0", resolved: locator, integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}` } } }));
  }
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
    assert.deepEqual(Object.keys(lock.packages).slice(1), ["node_modules/@archie/runtime", "node_modules/@archie/conformance"]);
    assert.equal(selectLocalRelease(first).record.schemaVersion, 2);
  } finally { rmSync(base, { recursive: true, force: true }); }
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

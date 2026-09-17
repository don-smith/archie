import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { bootstrapAndVerifyTarget, finalizeRelease, npmProjection, selectLocalRelease } from "../../../dist/packages/archie-runtime/src/index.js";

const fixture = "test/fixtures/private-bundles/valid";
const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";

function pack(workspace, destination, filename, env) {
  const output = JSON.parse(execFileSync("npm", ["pack", "--json", "--workspace", workspace, "--pack-destination", destination], { encoding: "utf8", env }));
  const packed = join(destination, output[0].filename);
  const target = join(destination, filename);
  renameSync(packed, target);
  return target;
}

function manifest(tarball) {
  return JSON.parse(execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" }));
}

function artifact(tarball, name, locator) {
  const packageManifest = manifest(tarball);
  const bytes = readFileSync(tarball);
  assert.equal(packageManifest.name, name);
  const lockIntegrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  return {
    packageManifest,
    lockEntry: {
      version: packageManifest.version,
      resolved: locator,
      integrity: lockIntegrity,
      dependencies: packageManifest.dependencies ?? {},
      bin: packageManifest.bin ?? {},
      engines: packageManifest.engines ?? {}
    },
    recordArtifact: {
      package: name,
      version: packageManifest.version,
      locator,
      lockIntegrity,
      tarballSha256: createHash("sha256").update(bytes).digest("hex"),
      requiredPlatformPayload: name === "@archie/runtime" ? "dist/architecture-docs/bin/architecture-docs.mjs" : "dist/cli.js",
      dependencies: packageManifest.dependencies ?? {},
      engines: packageManifest.engines ?? {},
      binaries: packageManifest.bin ?? {}
    }
  };
}

function releaseLock(runtimeArtifact, conformanceArtifact) {
  return npmProjection({ version: runtimeArtifact.packageManifest.version, artifacts: [runtimeArtifact.recordArtifact, conformanceArtifact.recordArtifact] }).lock;
}

function isolatedOfflineEnvironment(base) {
  const sourceCache = execFileSync("npm", ["config", "get", "cache"], { encoding: "utf8" }).trim();
  const cache = join(base, "npm-cache");
  mkdirSync(cache);
  execFileSync("cp", ["-cR", join(sourceCache, "_cacache"), cache]);
  return {
    ...process.env,
    npm_config_cache: cache,
    npm_config_offline: "true",
    npm_config_registry: "http://127.0.0.1:9/",
    npm_config_fetch_retries: "0",
    npm_config_audit: "false",
    npm_config_fund: "false"
  };
}

test("bootstrap installs both real packed artifacts with the exact offline projection", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-native-clean-target-"));
  try {
    const bundle = join(base, "bundle");
    const target = join(base, "target");
    const env = isolatedOfflineEnvironment(base);
    cpSync(fixture, bundle, { recursive: true });
    const fixtureInput = JSON.parse(readFileSync(join(bundle, "bundle.json"), "utf8"));
    rmSync(join(bundle, "npm"), { recursive: true, force: true });
    mkdirSync(join(bundle, "npm"));

    const runtimeTarball = pack("@archie/runtime", join(bundle, "npm"), "archie-runtime.tgz", env);
    const conformanceTarball = pack("@archie/conformance", join(bundle, "npm"), "conformance.tgz", env);
    const runtime = artifact(runtimeTarball, "@archie/runtime", "file:npm/archie-runtime.tgz");
    const conformance = artifact(conformanceTarball, "@archie/conformance", "file:npm/conformance.tgz");
    assert.equal(runtime.packageManifest.version, conformance.packageManifest.version);

    const lock = releaseLock(runtime, conformance);
    writeFileSync(join(bundle, "npm/archie-runtime.lock.json"), lock);
    writeFileSync(join(bundle, "npm/conformance.lock.json"), lock);
    writeFileSync(join(bundle, "bundle.json"), `${JSON.stringify({
      format: "archie-private-bundle-input-v3",
      artifacts: [
        { package: "@archie/runtime", version: runtime.packageManifest.version, locator: runtime.lockEntry.resolved, lockFile: "npm/archie-runtime.lock.json", tarball: "npm/archie-runtime.tgz", requiredPlatformPayload: "dist/architecture-docs/bin/architecture-docs.mjs" },
        { package: "@archie/conformance", version: conformance.packageManifest.version, locator: conformance.lockEntry.resolved, lockFile: "npm/conformance.lock.json", tarball: "npm/conformance.tgz", requiredPlatformPayload: "dist/cli.js" }
      ],
      apm: fixtureInput.apm
    }, null, 2)}\n`);

    finalizeRelease({ bundleDirectory: bundle, sourceCommit });
    const npmCalls = [];
    const run = ({ command, args, cwd }) => {
      if (command === "npm") {
        npmCalls.push(args);
        const result = spawnSync(command, args, { cwd, encoding: "utf8", env, timeout: 120000 });
        return { exitCode: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
      }
      if (args[0] === "lock") writeFileSync(join(cwd, "apm.lock.yaml"), readFileSync(join(bundle, "apm/apm.lock.yaml"), "utf8"));
      return { exitCode: 0, stdout: args.join(" ") === "policy status" ? "No policy configured" : "", stderr: "" };
    };
    const installed = bootstrapAndVerifyTarget(target, selectLocalRelease(bundle), { run, verifyApmDeployment: () => undefined });
    assert.equal(installed.record.schemaVersion, 3);
    assert.deepEqual(npmCalls, [["ci", "--ignore-scripts", "--offline"]]);
    assert.equal(readFileSync(join(target, ".archie/runtime/package-lock.json"), "utf8"), lock, "bootstrap must use the exact finalized lock");
    assert.equal(JSON.parse(readFileSync(join(target, ".archie/runtime/package.json"), "utf8")).dependencies["@archie/conformance"], "file:npm/conformance.tgz");

    const architectureDocs = join(target, ".archie/runtime/node_modules/.bin/architecture-docs");
    const architectureConformance = join(target, ".archie/runtime/node_modules/.bin/architecture-conformance");
    assert.ok(existsSync(architectureDocs));
    assert.ok(existsSync(architectureConformance));

    const architectureDocsTarget = join(target, "architecture-docs-smoke");
    cpSync("packages/architecture-docs/test/fixtures/architecture-docs", architectureDocsTarget, { recursive: true });
    const docs = spawnSync(architectureDocs, ["build", "--config", join(architectureDocsTarget, "architecture-docs.config.json")], { cwd: architectureDocsTarget, encoding: "utf8", env, timeout: 120000 });
    assert.equal(docs.status, 0, `${docs.stdout}\n${docs.stderr}`);

    const conformanceSetup = spawnSync(architectureConformance, ["onboard", "setup"], { cwd: target, encoding: "utf8", env, timeout: 120000 });
    assert.equal(conformanceSetup.status, 0, `${conformanceSetup.stdout}\n${conformanceSetup.stderr}`);
    assert.match(conformanceSetup.stdout, /local pinned setup verified/);
    assert.equal(basename(env.npm_config_cache), "npm-cache");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

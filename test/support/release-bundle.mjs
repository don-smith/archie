import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { finalizeRelease, npmProjection, RELEASE_RECORD_FILE } from "../../dist/packages/archie-runtime/src/index.js";

export const fixture = "test/fixtures/private-bundles/valid";
export const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";
export const version = "0.1.0-private.0";

const artifactSpecs = [
  { file: "archie-runtime", name: "@archie/runtime", payload: "dist/architecture-docs/bin/architecture-docs.mjs", bin: { "architecture-docs": "dist/architecture-docs/bin/architecture-docs.mjs" }, dependencies: {} },
  { file: "conformance", name: "@archie/conformance", payload: "dist/cli.js", bin: { "architecture-conformance": "dist/cli.js" }, dependencies: { "@archie/runtime": version } }
];

/** Builds an unfinalized v3 bundle whose npm artifacts are small packed stand-ins for runtime and conformance. */
export function makeBundle(base, name = "bundle") {
  const bundle = join(base, name);
  cpSync(fixture, bundle, { recursive: true });
  mkdirSync(join(bundle, "npm"), { recursive: true });
  const artifacts = [], recordArtifacts = [];
  for (const spec of artifactSpecs) {
    const packageRoot = join(base, `${name}-${spec.file}`, "package");
    rmSync(dirname(packageRoot), { recursive: true, force: true });
    mkdirSync(packageRoot, { recursive: true });
    const engines = { node: ">=24 <25" };
    writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name: spec.name, version, dependencies: spec.dependencies, engines, bin: spec.bin }));
    mkdirSync(dirname(join(packageRoot, spec.payload)), { recursive: true });
    writeFileSync(join(packageRoot, spec.payload), "#!/usr/bin/env node\n");
    const packed = JSON.parse(execFileSync("npm", ["pack", "--json", packageRoot, "--pack-destination", join(bundle, "npm")], { cwd: base, encoding: "utf8" }));
    const tarball = `npm/${spec.file}.tgz`;
    renameSync(join(bundle, "npm", packed[0].filename), join(bundle, tarball));
    const bytes = readFileSync(join(bundle, tarball));
    const locator = `file:${tarball}`;
    artifacts.push({ package: spec.name, version, locator, lockFile: `npm/${spec.file}.lock.json`, tarball, requiredPlatformPayload: spec.payload });
    recordArtifacts.push({ package: spec.name, version, locator, lockIntegrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`, tarballSha256: createHash("sha256").update(bytes).digest("hex"), requiredPlatformPayload: spec.payload, dependencies: spec.dependencies, engines, binaries: spec.bin });
  }
  const lock = npmProjection({ version, artifacts: recordArtifacts }).lock;
  for (const spec of artifactSpecs) writeFileSync(join(bundle, `npm/${spec.file}.lock.json`), lock);
  const input = JSON.parse(readFileSync(join(bundle, "bundle.json"), "utf8"));
  writeFileSync(join(bundle, "bundle.json"), `${JSON.stringify({ ...input, artifacts }, null, 2)}\n`);
  return bundle;
}

export function finalizedBundle(base, name = "bundle") {
  const bundle = makeBundle(base, name);
  finalizeRelease({ bundleDirectory: bundle, sourceCommit });
  return bundle;
}

/** A native-command stand-in: npm "installs" the pinned artifacts with binary links; `apm lock` writes the fixture lock. */
export function installRunner({ calls = [], failNpm = false, policyStatus = { exitCode: 0, stdout: "policy applied", stderr: "" }, policyAudit = 0 } = {}) {
  return ({ command, args, cwd }) => {
    calls.push([command, ...args]);
    if (command === "npm") {
      if (failNpm) return { exitCode: 9, stdout: "", stderr: "injected npm failure" };
      const record = JSON.parse(readFileSync(join(cwd, "..", "release", RELEASE_RECORD_FILE), "utf8"));
      rmSync(join(cwd, "node_modules"), { recursive: true, force: true });
      for (const artifact of record.artifacts) {
        const packageRoot = join(cwd, "node_modules", artifact.package);
        mkdirSync(packageRoot, { recursive: true });
        writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name: artifact.package, version: artifact.version, dependencies: artifact.dependencies, engines: artifact.engines, bin: artifact.binaries }));
        for (const [binary, relativePath] of Object.entries(artifact.binaries)) {
          const file = join(packageRoot, relativePath);
          mkdirSync(dirname(file), { recursive: true });
          writeFileSync(file, "#!/usr/bin/env node\n");
          mkdirSync(join(cwd, "node_modules", ".bin"), { recursive: true });
          const link = join(cwd, "node_modules", ".bin", binary);
          if (!existsSync(link)) symlinkSync(join("..", artifact.package, relativePath), link);
        }
      }
      return { exitCode: 0, stdout: "installed", stderr: "" };
    }
    if (args[0] === "lock") writeFileSync(join(cwd, "apm.lock.yaml"), readFileSync(join(fixture, "apm", "apm.lock.yaml"), "utf8"));
    if (args.join(" ") === "policy status") return policyStatus;
    if (args.join(" ") === "audit --ci") return { exitCode: policyAudit, stdout: "policy audit", stderr: policyAudit ? "blocked" : "" };
    return { exitCode: 0, stdout: "ok", stderr: "" };
  };
}

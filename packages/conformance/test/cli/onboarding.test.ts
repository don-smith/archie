import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../src/commands/run.js";
import { verifyLocalOnboardingSetup, verifyOnboardingRuntime } from "../../src/onboarding-state/setup.js";
import { makeNpmTarball, type NpmTarballManifest } from "../helpers/npm-tarball.js";

const installedManifest: NpmTarballManifest = { name: "@archie/conformance", version: "0.1.0-private.0", bin: { "architecture-conformance": "dist/cli.js" } };

async function target(options: { installed?: boolean; lockfile?: boolean; archiveManifest?: NpmTarballManifest; tarball?: Buffer } = {}): Promise<string> {
  const { installed = true, lockfile = true, archiveManifest = installedManifest } = options;
  const root = await mkdtemp(join(tmpdir(), "architecture-conformance-onboarding-cli-"));
  const runtime = join(root, ".archie/runtime");
  const locator = "file:npm/conformance.tgz";
  const tarball = options.tarball ?? await makeNpmTarball(archiveManifest);
  await mkdir(join(runtime, "npm"), { recursive: true });
  await writeFile(join(runtime, "npm/conformance.tgz"), tarball);
  await writeFile(join(runtime, "package.json"), JSON.stringify({ name: "archie-private-runtime", private: true, dependencies: { "@archie/conformance": locator } }));
  if (lockfile) await writeFile(join(runtime, "package-lock.json"), JSON.stringify({ name: "archie-private-runtime", lockfileVersion: 3, packages: { "": { dependencies: { "@archie/conformance": locator } }, "node_modules/@archie/conformance": { version: installedManifest.version, resolved: locator, integrity: `sha512-${createHash("sha512").update(tarball).digest("base64")}`, bin: installedManifest.bin } } }));
  if (installed) {
    const packageRoot = join(runtime, "node_modules/@archie/conformance");
    await mkdir(join(packageRoot, "dist"), { recursive: true });
    await mkdir(join(runtime, "node_modules/.bin"), { recursive: true });
    await writeFile(join(packageRoot, "package.json"), JSON.stringify(installedManifest));
    await writeFile(join(packageRoot, "dist/cli.js"), "#!/usr/bin/env node\n");
    await symlink(join("..", "@archie", "conformance", "dist", "cli.js"), join(runtime, "node_modules/.bin/architecture-conformance"));
  }
  return root;
}

test("setup rejects an incompatible Node", () => {
  assert.throws(() => verifyOnboardingRuntime("23.11.0"), /Node >=24 <25/);
  assert.throws(() => verifyOnboardingRuntime("24.0.0-rc.1"), /Node >=24 <25/);
  assert.doesNotThrow(() => verifyOnboardingRuntime("24.20.0"));
});

test("setup requires Archie runtime lockfile evidence for the local artifact", async () => {
  const root = await target({ lockfile: false });
  assert.throws(() => verifyLocalOnboardingSetup(root), /setup is missing|lock/i);
});

test("setup rejects missing, escaped, malformed, and tampered tarballs", async () => {
  const missing = await target();
  await rm(join(missing, ".archie/runtime/npm/conformance.tgz"));
  assert.throws(() => verifyLocalOnboardingSetup(missing), /tarball is missing/);

  const escaped = await target();
  const external = join(escaped, "outside-conformance.tgz");
  await writeFile(external, await readFile(join(escaped, ".archie/runtime/npm/conformance.tgz")));
  await rm(join(escaped, ".archie/runtime/npm/conformance.tgz"));
  await symlink(external, join(escaped, ".archie/runtime/npm/conformance.tgz"));
  assert.throws(() => verifyLocalOnboardingSetup(escaped), /target-owned regular file/);

  const malformed = await target({ tarball: gzipSync(Buffer.from("not a tar archive")) });
  assert.throws(() => verifyLocalOnboardingSetup(malformed), /truncated|invalid block alignment|contains no entries/);

  const tampered = await target();
  await writeFile(join(tampered, ".archie/runtime/npm/conformance.tgz"), await makeNpmTarball({ ...installedManifest, extra: "changed" } as NpmTarballManifest));
  assert.throws(() => verifyLocalOnboardingSetup(tampered), /lock or tarball differs/);
});

test("setup rejects tarballs with the wrong package identity or binary contract", async () => {
  const missingBinary = await target({ tarball: await makeNpmTarball(installedManifest, false) });
  assert.throws(() => verifyLocalOnboardingSetup(missingBinary), /omits its declared architecture-conformance binary/);

  for (const [archiveManifest, expected] of [
    [{ ...installedManifest, name: "wrong-package" }, /package identity/],
    [{ ...installedManifest, version: "9.9.9" }, /package identity/],
    [{ ...installedManifest, bin: { "architecture-conformance": "dist/wrong.js" } }, /binary contract/]
  ] as Array<[NpmTarballManifest, RegExp]>) {
    const root = await target({ archiveManifest });
    assert.throws(() => verifyLocalOnboardingSetup(root), expected);
  }
});

test("onboard init writes only safe operational state after Archie pin verification", async () => {
  const root = await target();
  const result = runCli(["onboard", "init", "--root", "tsconfig.json", "--include", "src/**/*.ts", "--exclude", "src/**/*.micro.ts", "--skill-location", ".agents/skills/architecture-conformance-onboarding"], root);
  assert.equal(result.code, 0, result.stderr);
  const state = JSON.parse(await readFile(join(root, ".architecture-conformance", "onboarding.json"), "utf8")) as { version: string; scope: { exclusions: Array<{ path: string; reason: string }> } };
  assert.equal(state.version, "onboarding-state/v1");
  assert.deepEqual(state.scope.exclusions, [{ path: "src/**/*.micro.ts", reason: "command-line exclusion" }]);
  assert.equal("approval" in state, false);
  assert.equal("rules" in state, false);
});

test("onboard refuses a missing Archie-provisioned command without a global fallback", async () => {
  const root = await target({ installed: false });
  const result = runCli(["onboard", "init", "--root", "tsconfig.json", "--skill-location", "skills/onboarding"], root);
  assert.equal(result.code, 3);
  assert.match(result.stderr, /bootstrap or repair the pinned Archie release/i);
});

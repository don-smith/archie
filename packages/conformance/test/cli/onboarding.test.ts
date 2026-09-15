import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../src/commands/run.js";
import { verifyLocalOnboardingSetup, verifyOnboardingRuntime } from "../../src/onboarding-state/setup.js";

process.env.npm_config_user_agent = "npm/11.19.0 node/v24.20.0";

async function target(installed = true, lockfile = true): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "architecture-conformance-onboarding-cli-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ devDependencies: { "architecture-conformance": "0.1.0" } }));
  if (lockfile) await writeFile(join(root, "package-lock.json"), JSON.stringify({ name: "target", lockfileVersion: 3, packages: { "": { devDependencies: { "architecture-conformance": "0.1.0" } }, "node_modules/architecture-conformance": { version: "0.1.0" } } }));
  if (installed) {
    await mkdir(join(root, "node_modules", "architecture-conformance"), { recursive: true });
    await mkdir(join(root, "node_modules", ".bin"), { recursive: true });
    await writeFile(join(root, "node_modules", "architecture-conformance", "package.json"), JSON.stringify({ name: "architecture-conformance", version: "0.1.0", bin: { "architecture-conformance": "dist/src/cli.js" } }));
    await writeFile(join(root, "node_modules", ".bin", "architecture-conformance"), "#!/bin/sh\n");
  }
  return root;
}

test("setup rejects an incompatible Node or an ambient non-npm runtime", () => {
  assert.throws(() => verifyOnboardingRuntime("23.11.0", "npm/11.19.0 node/v23.11.0"), /Node >=24 <25/);
  assert.throws(() => verifyOnboardingRuntime("24.0.0-rc.1", "npm/11.19.0 node/v24.0.0-rc.1"), /Node >=24 <25/);
  assert.throws(() => verifyOnboardingRuntime("24.20.0", "yarn/1.22.0"), /run by npm/);
  assert.doesNotThrow(() => verifyOnboardingRuntime("24.20.0", "npm/11.19.0 node/v24.20.0"));
});

test("setup requires target lockfile evidence for the exact local devDependency", async () => {
  const root = await target(true, false);
  assert.throws(() => verifyLocalOnboardingSetup(root), /package-lock|lockfile/i);
});

test("onboard init writes only safe operational state after local pinned setup verification", async () => {
  const root = await target();
  const result = runCli(["onboard", "init", "--root", "tsconfig.json", "--include", "src/**/*.ts", "--exclude", "src/**/*.micro.ts", "--skill-location", ".agents/skills/architecture-conformance-onboarding"], root);
  assert.equal(result.code, 0);
  const state = JSON.parse(await readFile(join(root, ".architecture-conformance", "onboarding.json"), "utf8")) as { version: string; scope: { exclusions: Array<{ path: string; reason: string }> } };
  assert.equal(state.version, "onboarding-state/v1");
  assert.deepEqual(state.scope.exclusions, [{ path: "src/**/*.micro.ts", reason: "command-line exclusion" }]);
  assert.equal("approval" in state, false);
  assert.equal("rules" in state, false);
});

test("onboard refuses missing or non-local setup without a global fallback", async () => {
  const root = await target(false);
  const result = runCli(["onboard", "init", "--root", "tsconfig.json", "--skill-location", "skills/onboarding"], root);
  assert.equal(result.code, 3);
  assert.match(result.stderr, /install architecture-conformance as an exact devDependency.*commit the lockfile/i);
});

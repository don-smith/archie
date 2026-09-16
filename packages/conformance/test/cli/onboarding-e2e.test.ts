import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../src/commands/run.js";
import { makeNpmTarball, type NpmTarballManifest } from "../helpers/npm-tarball.js";

async function target(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "architecture-conformance-onboarding-e2e-"));
  const runtime = join(root, ".archie/runtime");
  const packageRoot = join(runtime, "node_modules/@archie/conformance");
  const locator = "file:npm/conformance.tgz";
  const manifest: NpmTarballManifest = { name: "@archie/conformance", version: "0.1.0-private.0", bin: { "architecture-conformance": "dist/cli.js" } };
  const tarball = await makeNpmTarball(manifest);
  await mkdir(join(root, "src")); await mkdir(join(packageRoot, "dist"), { recursive: true }); await mkdir(join(runtime, "node_modules/.bin"), { recursive: true }); await mkdir(join(runtime, "npm"), { recursive: true });
  await writeFile(join(runtime, "npm/conformance.tgz"), tarball);
  await writeFile(join(runtime, "package.json"), JSON.stringify({ name: "archie-private-runtime", private: true, dependencies: { "@archie/conformance": locator } }));
  await writeFile(join(runtime, "package-lock.json"), JSON.stringify({ name: "archie-private-runtime", lockfileVersion: 3, packages: { "": { dependencies: { "@archie/conformance": locator } }, "node_modules/@archie/conformance": { version: manifest.version, resolved: locator, integrity: `sha512-${createHash("sha512").update(tarball).digest("base64")}`, bin: manifest.bin } } }));
  await writeFile(join(packageRoot, "package.json"), JSON.stringify(manifest));
  await writeFile(join(packageRoot, "dist/cli.js"), "#!/usr/bin/env node\n");
  await symlink(join("..", "@archie", "conformance", "dist", "cli.js"), join(runtime, "node_modules/.bin/architecture-conformance"));
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" }, include: ["src"] })); await writeFile(join(root, "src", "a.ts"), "export const a = 1;\n");
  return root;
}

test("onboarding lifecycle resumes deterministic evidence and never lets check mutate a baseline", async () => {
  const root = await target();
  assert.equal(runCli(["onboard", "init", "--root", "tsconfig.json", "--include", "src/**/*.ts", "--skill-location", "skills/onboarding"], root).code, 0);
  assert.equal(runCli(["analyze", "--root", "tsconfig.json", "--include", "src/**/*.ts", "--output", ".architecture-conformance/evidence/observed-graph.json", "--summary-output", ".architecture-conformance/evidence/onboarding-summary.md"], root).code, 0);
  assert.equal(runCli(["onboard", "advance", "--checkpoint", "evidence-generated"], root).code, 0);
  await writeFile(join(root, ".architecture-conformance", "realization-map.json"), JSON.stringify({ version: "realization-map/v1", scope: { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [] }, elements: [{ id: "app" }], mappings: [{ elementId: "app", path: "src/a.ts" }] }));
  assert.equal(runCli(["onboard", "advance", "--checkpoint", "classification-drafted"], root).code, 0);
  await writeFile(join(root, ".architecture-conformance", "architecture-contract.json"), JSON.stringify({ version: "architecture-contract/v1", rules: [], exceptions: [] }));
  assert.equal(runCli(["check", "--map", ".architecture-conformance/realization-map.json", "--contract", ".architecture-conformance/architecture-contract.json", "--strict", "--output", ".architecture-conformance/evidence/report.json"], root).code, 0);
  assert.equal(runCli(["onboard", "advance", "--checkpoint", "proposed-contract-checked"], root).code, 0);
  assert.equal(runCli(["onboard", "advance", "--checkpoint", "active-contract-checked"], root).code, 0);
  assert.equal(runCli(["baseline", "--report", ".architecture-conformance/evidence/report.json", "--output", ".architecture-conformance/baseline.json"], root).code, 0);
  assert.equal(runCli(["onboard", "advance", "--checkpoint", "baseline-created"], root).code, 0);
  const state = JSON.parse(await readFile(join(root, ".architecture-conformance", "onboarding.json"), "utf8")) as { checkpoint: string };
  assert.equal(state.checkpoint, "baseline-created");
});

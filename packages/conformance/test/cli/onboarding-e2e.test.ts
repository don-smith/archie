import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../src/commands/run.js";

process.env.npm_config_user_agent = "npm/11.19.0 node/v24.20.0";

async function target(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "architecture-conformance-onboarding-e2e-"));
  await mkdir(join(root, "src")); await mkdir(join(root, "node_modules", "architecture-conformance"), { recursive: true }); await mkdir(join(root, "node_modules", ".bin"), { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ devDependencies: { "architecture-conformance": "0.1.0" } }));
  await writeFile(join(root, "package-lock.json"), JSON.stringify({ name: "target", lockfileVersion: 3, packages: { "": { devDependencies: { "architecture-conformance": "0.1.0" } }, "node_modules/architecture-conformance": { version: "0.1.0" } } }));
  await writeFile(join(root, "node_modules", "architecture-conformance", "package.json"), JSON.stringify({ name: "architecture-conformance", version: "0.1.0", bin: { "architecture-conformance": "dist/src/cli.js" } })); await writeFile(join(root, "node_modules", ".bin", "architecture-conformance"), "#!/bin/sh\n");
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

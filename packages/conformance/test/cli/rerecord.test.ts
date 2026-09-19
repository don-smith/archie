import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { sha256 } from "../../src/artifacts/digest.js";
import { runCli } from "../../src/commands/run.js";
import { makeNpmTarball, type NpmTarballManifest } from "../helpers/npm-tarball.js";

const installedManifest: NpmTarballManifest = { name: "@archie/conformance", version: "0.1.0-private.0", bin: { "architecture-conformance": "dist/cli.js" } };

/** Adds the pinned Archie-runtime evidence `onboard` commands require, as the existing onboarding tests do. */
async function allowOnboardCommands(root: string): Promise<void> {
  const runtime = join(root, ".archie/runtime");
  const locator = "file:npm/conformance.tgz";
  const tarball = await makeNpmTarball(installedManifest);
  await mkdir(join(runtime, "npm"), { recursive: true });
  await writeFile(join(runtime, "npm/conformance.tgz"), tarball);
  await writeFile(join(runtime, "package.json"), JSON.stringify({ name: "archie-private-runtime", private: true, dependencies: { "@archie/conformance": locator } }));
  await writeFile(join(runtime, "package-lock.json"), JSON.stringify({ name: "archie-private-runtime", lockfileVersion: 3, packages: { "": { dependencies: { "@archie/conformance": locator } }, "node_modules/@archie/conformance": { version: installedManifest.version, resolved: locator, integrity: `sha512-${createHash("sha512").update(tarball).digest("base64")}`, bin: installedManifest.bin } } }));
  const packageRoot = join(runtime, "node_modules/@archie/conformance");
  await mkdir(join(packageRoot, "dist"), { recursive: true });
  await mkdir(join(runtime, "node_modules/.bin"), { recursive: true });
  await writeFile(join(packageRoot, "package.json"), JSON.stringify(installedManifest));
  await writeFile(join(packageRoot, "dist/cli.js"), "#!/usr/bin/env node\n");
  await symlink(join("..", "@archie", "conformance", "dist", "cli.js"), join(runtime, "node_modules/.bin/architecture-conformance"));
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "architecture-conformance-rerecord-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" }, include: ["src"] }));
  await writeFile(join(root, "src", "a.ts"), 'import { b } from "./b.js"; export const a = b;\n');
  await writeFile(join(root, "src", "b.ts"), "export const b = 1;\n");
  await writeFile(join(root, "map.json"), JSON.stringify({ version: "realization-map/v1", scope: { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [] }, elements: [{ id: "core" }, { id: "infra" }], mappings: [{ elementId: "core", path: "src/a.ts" }, { elementId: "infra", path: "src/b.ts" }] }));
  await writeFile(join(root, "contract.json"), JSON.stringify({ version: "architecture-contract/v1", exceptions: [], rules: [] }));
  assert.equal(runCli(["analyze", "--root", "tsconfig.json", "--include", "src/**/*.ts", "--output", "evidence/observed-graph.json", "--summary-output", "evidence/onboarding-summary.md"], root).code, 0);
  assert.equal(runCli(["check", "--map", "map.json", "--contract", "contract.json", "--output", "evidence/report.json"], root).code, 0);
  const paths = { state: "onboarding.json", graph: "evidence/observed-graph.json", summary: "evidence/onboarding-summary.md", map: "map.json", contract: "contract.json", report: "evidence/report.json", baseline: "baseline.json" };
  const evidence = Object.fromEntries(await Promise.all(["graph", "summary", "map", "contract", "report"].map(async (name) => [name, sha256(await readFile(join(root, paths[name as keyof typeof paths])))])));
  await writeFile(join(root, paths.state), JSON.stringify({ version: "onboarding-state/v1", scope: { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [] }, skillLocation: "skills/onboarding", paths, checkpoint: "active-contract-checked", evidence }));
  await allowOnboardCommands(root);
  return root;
}

/** Benign drift: the a→b edge becomes a type edge, so the graph ages while every result and gap stays identical. */
async function driftWithoutVerdictChange(root: string): Promise<void> {
  await writeFile(join(root, "src", "a.ts"), 'import type { B } from "./b.js"; export const a: B = { value: 1 };\n');
  await writeFile(join(root, "src", "b.ts"), "export interface B { value: number }\n");
}

/** Verdict-changing drift: an unmapped module appears, which adds a coverage result. */
async function driftWithVerdictChange(root: string): Promise<void> {
  await writeFile(join(root, "src", "c.ts"), "export const c = 2;\n");
}

test("rerecord re-records drifted derived evidence and keeps the checkpoint", async () => {
  const root = await fixture();
  try {
    const before = JSON.parse(await readFile(join(root, "onboarding.json"), "utf8")) as { checkpoint: string; scope: unknown; skillLocation: string; paths: Record<string, string>; evidence: Record<string, string> };
    await driftWithoutVerdictChange(root);
    assert.equal(runCli(["replay", "--state", "onboarding.json", "--verify"], root).code, 3);
    const result = runCli(["onboard", "rerecord", "--state", "onboarding.json"], root);
    assert.equal(result.code, 0, result.stderr);
    const summary = JSON.parse(result.stdout) as { version: string; checkpoint: string; reRecorded: string[]; verdictUnchanged: boolean; counts: Record<string, { before: number; after: number }> };
    assert.equal(summary.version, "onboarding-rerecord/v1");
    assert.equal(summary.checkpoint, "active-contract-checked");
    assert.deepEqual(summary.reRecorded, ["graph", "summary", "report"]);
    assert.equal(summary.verdictUnchanged, true);
    assert.deepEqual(summary.counts.reportResults, { before: 0, after: 0 });
    assert.deepEqual(summary.counts.reportGaps, { before: 0, after: 0 });
    const state = JSON.parse(await readFile(join(root, "onboarding.json"), "utf8")) as typeof before;
    assert.equal(state.checkpoint, before.checkpoint);
    assert.deepEqual(state.scope, before.scope);
    assert.equal(state.skillLocation, before.skillLocation);
    assert.deepEqual(state.paths, before.paths);
    assert.equal(state.evidence.map, before.evidence.map);
    assert.equal(state.evidence.contract, before.evidence.contract);
    for (const name of ["graph", "summary", "report"] as const) {
      const file = state.paths[name as "graph"];
      assert.equal(state.evidence[name], sha256(await readFile(join(root, state.paths[name]!))), `${name} digest matches the rewritten artifact`);
    }
    assert.equal(runCli(["replay", "--state", "onboarding.json", "--verify"], root).code, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("rerecord refuses tampered normative inputs", async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, "map.json"), "tampered");
    const result = runCli(["onboard", "rerecord", "--state", "onboarding.json"], root);
    assert.equal(result.code, 3);
    assert.match(result.stderr, /realization map input digest mismatch/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("rerecord refuses a missing recorded artifact so the old observation stays auditable", async () => {
  const root = await fixture();
  try {
    await driftWithoutVerdictChange(root);
    await rm(join(root, "evidence", "observed-graph.json"));
    const result = runCli(["onboard", "rerecord", "--state", "onboarding.json"], root);
    assert.equal(result.code, 3);
    assert.match(result.stderr, /recorded graph evidence is missing or unreadable/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("rerecord --expect-unchanged-verdict passes on benign drift and refuses a changed verdict without writing", async () => {
  const root = await fixture();
  try {
    await driftWithoutVerdictChange(root);
    const result = runCli(["onboard", "rerecord", "--state", "onboarding.json", "--expect-unchanged-verdict"], root);
    assert.equal(result.code, 0, result.stderr);

    await driftWithVerdictChange(root);
    const stateBefore = await readFile(join(root, "onboarding.json"), "utf8");
    const graphBefore = await readFile(join(root, "evidence", "observed-graph.json"), "utf8");
    const refused = runCli(["onboard", "rerecord", "--state", "onboarding.json", "--expect-unchanged-verdict"], root);
    assert.equal(refused.code, 3);
    assert.match(refused.stderr, /conformance verdict changed; refusing to re-record/);
    assert.equal(await readFile(join(root, "onboarding.json"), "utf8"), stateBefore);
    assert.equal(await readFile(join(root, "evidence", "observed-graph.json"), "utf8"), graphBefore);

    const allowed = runCli(["onboard", "rerecord", "--state", "onboarding.json"], root);
    assert.equal(allowed.code, 0, allowed.stderr);
    const summary = JSON.parse(allowed.stdout) as { verdictUnchanged: boolean; counts: Record<string, { before: number; after: number }> };
    assert.equal(summary.verdictUnchanged, false);
    assert.deepEqual(summary.counts.reportResults, { before: 0, after: 1 });
    assert.equal(runCli(["replay", "--state", "onboarding.json", "--verify"], root).code, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

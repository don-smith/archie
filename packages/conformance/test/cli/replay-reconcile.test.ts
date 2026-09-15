import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { sha256 } from "../../src/artifacts/digest.js";
import { runCli } from "../../src/commands/run.js";

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "architecture-conformance-replay-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" }, include: ["src"] }));
  await writeFile(join(root, "src", "a.ts"), 'import { b } from "./b.js"; export const a = b;\n');
  await writeFile(join(root, "src", "b.ts"), "export const b = 1;\n");
  await writeFile(join(root, "map.json"), JSON.stringify({ version: "realization-map/v1", scope: { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [] }, elements: [{ id: "core" }, { id: "infra" }], mappings: [{ elementId: "core", path: "src/a.ts" }, { elementId: "infra", path: "src/b.ts" }] }));
  await writeFile(join(root, "contract.json"), JSON.stringify({ version: "architecture-contract/v1", exceptions: [], rules: [{ id: "no-core-infra", kind: "dependency-policy", intent: "forbid", enforcement: "active", severity: "error", world: "open", sources: ["core"], forbiddenTargets: ["infra"], edgeKinds: ["runtime"], approval: { approvedBy: "maintainer", approvedAt: "2026-09-04" } }] }));
  assert.equal(runCli(["analyze", "--root", "tsconfig.json", "--include", "src/**/*.ts", "--output", "evidence/observed-graph.json", "--summary-output", "evidence/onboarding-summary.md"], root).code, 0);
  assert.equal(runCli(["check", "--map", "map.json", "--contract", "contract.json", "--output", "evidence/report.json"], root).code, 1);
  const paths = { state: "onboarding.json", graph: "evidence/observed-graph.json", summary: "evidence/onboarding-summary.md", map: "map.json", contract: "contract.json", report: "evidence/report.json", baseline: "baseline.json" };
  const evidence = Object.fromEntries(await Promise.all(["graph", "summary", "map", "contract", "report"].map(async (name) => [name, sha256(await readFile(join(root, paths[name as keyof typeof paths]))) ])));
  await writeFile(join(root, paths.state), JSON.stringify({ version: "onboarding-state/v1", scope: { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [] }, skillLocation: "skills/onboarding", paths, checkpoint: "active-contract-checked", evidence }));
  return root;
}

test("replay requires exactly one source and behavior", () => {
  assert.equal(runCli(["replay", "--regenerate"]).code, 3);
  assert.equal(runCli(["replay", "--state", "state.json", "--map", "map.json", "--verify"]).code, 3);
  assert.equal(runCli(["replay", "--map", "map.json", "--verify", "--regenerate"]).code, 3);
});

test("state replay restores only matching historical evidence without changing state", async () => {
  const root = await fixture();
  try {
    const originalState = await readFile(join(root, "onboarding.json"), "utf8");
    await rm(join(root, "evidence"), { recursive: true });
    const result = runCli(["replay", "--state", "onboarding.json", "--regenerate"], root);
    assert.equal(result.code, 0, result.stderr);
    assert.match(await readFile(join(root, "evidence", "report.json"), "utf8"), /conformance-report\/v1/);
    assert.equal(await readFile(join(root, "onboarding.json"), "utf8"), originalState);
    await writeFile(join(root, "src", "a.ts"), "export const changed = 1;\n");
    assert.equal(runCli(["replay", "--state", "onboarding.json", "--verify"], root).code, 3);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("map replay generates graph and summary but never a report, and verify does not write", async () => {
  const root = await fixture();
  try {
    await rm(join(root, "evidence"), { recursive: true });
    const regenerate = runCli(["replay", "--map", "map.json", "--regenerate"], root);
    assert.equal(regenerate.code, 0, regenerate.stderr);
    assert.match(await readFile(join(root, "evidence", "observed-graph.json"), "utf8"), /normalized-graph\/v1/);
    await assert.rejects(readFile(join(root, "evidence", "report.json")));
    const graph = await readFile(join(root, "evidence", "observed-graph.json"), "utf8");
    assert.equal(runCli(["replay", "--map", "map.json", "--verify"], root).code, 0);
    assert.equal(await readFile(join(root, "evidence", "observed-graph.json"), "utf8"), graph);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("reconciliation is ordered, informational, and non-mutating", async () => {
  const root = await mkdtemp(join(tmpdir(), "architecture-conformance-reconcile-"));
  try {
    const active = { version: "architecture-active-result-set/v1", results: [{ id: "b", fingerprint: "same" }, { id: "a", fingerprint: "old" }, { id: "b", fingerprint: "same" }] };
    const drift = { version: "architecture-drift-record/v1", records: [{ id: "a", fingerprint: "new", state: "open" }, { id: "c", fingerprint: "gone", state: "open" }, { id: "c", fingerprint: "gone", state: "open" }] };
    await writeFile(join(root, "active.json"), JSON.stringify(active)); await writeFile(join(root, "drift.json"), JSON.stringify(drift));
    const before = await Promise.all([readFile(join(root, "active.json"), "utf8"), readFile(join(root, "drift.json"), "utf8")]);
    const result = runCli(["reconcile", "--active", "active.json", "--drift", "drift.json", "--output", "report.json"], root);
    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(await readFile(join(root, "report.json"), "utf8")) as { missing: Array<{ id: string }>; duplicates: Array<{ id: string }>; stale: Array<{ id: string }>; resolvedCandidates: Array<{ id: string }> };
    assert.deepEqual(report.missing.map((item) => item.id), ["b"]);
    assert.deepEqual(report.duplicates.map((item) => item.id), ["b", "c"]);
    assert.deepEqual(report.stale.map((item) => item.id), ["a"]);
    assert.deepEqual(report.resolvedCandidates.map((item) => item.id), ["c"]);
    assert.deepEqual(await Promise.all([readFile(join(root, "active.json"), "utf8"), readFile(join(root, "drift.json"), "utf8")]), before);
    assert.equal(runCli(["reconcile", "--active", "missing.json", "--drift", "drift.json"], root).code, 3);
  } finally { await rm(root, { recursive: true, force: true }); }
});

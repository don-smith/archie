import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../src/commands/run.js";

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "architecture-conformance-cli-")); await mkdir(join(root, "src"));
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" }, include: ["src"], exclude: ["src/**/*.micro.ts"] }));
  await writeFile(join(root, "src", "a.ts"), 'export const b = import("./b.js");\n'); await writeFile(join(root, "src", "b.ts"), "export const b = 1;\n"); await writeFile(join(root, "src", "excluded.micro.ts"), "export const excluded = 1;\n");
  await writeFile(join(root, "map.json"), JSON.stringify({ version: "realization-map/v1", scope: { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [] }, elements: [{ id: "core" }, { id: "infra" }], mappings: [{ elementId: "core", path: "src/a.ts" }, { elementId: "infra", path: "src/b.ts" }] }));
  await writeFile(join(root, "contract.json"), JSON.stringify({ version: "architecture-contract/v1", exceptions: [], rules: [{ id: "no-core-infra", kind: "dependency-policy", intent: "forbid", enforcement: "active", severity: "error", world: "open", sources: ["core"], forbiddenTargets: ["infra"], edgeKinds: ["runtime"], approval: { approvedBy: "maintainer", approvedAt: "2026-08-27" } }] }));
  return root;
}

test("check emits a stable grounded report and a blocking exit for a literal dynamic runtime edge", async () => {
  const root = await fixture(); const first = runCli(["check", "--map", "map.json", "--contract", "contract.json"], root); const second = runCli(["check", "--map", "map.json", "--contract", "contract.json"], root);
  assert.equal(first.code, 1); assert.equal(first.stdout, second.stdout); assert.match(first.stdout, /no-core-infra/);
});

test("strict incomplete coverage takes precedence over violations", async () => {
  const root = await fixture(); const map = JSON.parse(await readFile(join(root, "map.json"), "utf8")) as { mappings: unknown[] };
  map.mappings.pop(); await writeFile(join(root, "map.json"), JSON.stringify(map));
  assert.equal(runCli(["check", "--map", "map.json", "--contract", "contract.json", "--strict"], root).code, 2);
  assert.equal(runCli(["check", "--map", "missing.json", "--contract", "contract.json"], root).code, 3);
});

test("analyze writes graph and graph-linked onboarding summary from one scan", async () => {
  const root = await fixture();
  const result = runCli(["analyze", "--root", "tsconfig.json", "--include", "src/**/*.ts", "--exclude", "src/**/*.micro.ts", "--output", "evidence/graph.json", "--summary-output", "evidence/summary.md"], root);
  assert.equal(result.code, 0);
  const graph = await readFile(join(root, "evidence", "graph.json"), "utf8"); const summary = await readFile(join(root, "evidence", "summary.md"), "utf8"); const observed = JSON.parse(graph) as { scope: { exclusions: Array<{ path: string; reason: string }> }; gaps: Array<{ kind: string; file?: string }> };
  assert.match(summary, /Graph digest:/); assert.match(summary, /src\/a → src\/b/); assert.match(summary, /Declared exclusions: `src\/\*\*\/\*.micro\.ts` \(command-line exclusion\)/);
  assert.deepEqual(observed.scope.exclusions, [{ path: "src/**/*.micro.ts", reason: "command-line exclusion" }]); assert.equal(observed.gaps.some((gap) => gap.kind === "scope-file-not-in-program" && gap.file === "src/excluded.micro.ts"), false);
  assert.equal(runCli(["analyze", "--root", "tsconfig.json", "--include", "src/**/*.ts", "--exclude", "src/**/*.micro.ts"], root).stdout, graph);
});

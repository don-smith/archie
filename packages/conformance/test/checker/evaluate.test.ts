import assert from "node:assert/strict";
import test from "node:test";

import { evaluate } from "../../src/checker/evaluate.js";
import type { ArchitectureContractV1, NormalizedGraphV1, RealizationMapV1 } from "../../src/formats/types.js";

const graph: NormalizedGraphV1 = {
  version: "normalized-graph/v1", nodes: [
    { id: "module:core/a", kind: "source-module", module: "core/a", file: "src/a.ts" },
    { id: "module:infra/b", kind: "source-module", module: "infra/b", file: "src/b.ts" }
  ], edges: [{ id: "edge-a-b", source: "module:core/a", target: "module:infra/b", kind: "runtime", specifier: "../b.js", status: "resolved", span: { file: "src/a.ts", start: { line: 1, column: 1 }, end: { line: 1, column: 24 } } }], exclusions: [], gaps: [], provenance: { adapter: "typescript-program-v1", compilerVersion: "7.0.2", rootConfigs: ["tsconfig.json"], sourceFiles: ["src/a.ts", "src/b.ts"], resolutionInputs: [], compilerOptions: {} }
};
const map: RealizationMapV1 = { version: "realization-map/v1", scope: { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [] }, elements: [{ id: "core" }, { id: "infra" }], mappings: [{ elementId: "core", path: "src/a.ts" }, { elementId: "infra", path: "src/b.ts" }] };
const active = { approvedBy: "maintainer", approvedAt: "2026-08-27" };

test("reports an active forbidden dependency with its source evidence", () => {
  const contract: ArchitectureContractV1 = { version: "architecture-contract/v1", exceptions: [], rules: [{ id: "core-no-infra", kind: "dependency-policy", intent: "core must not import infra", enforcement: "active", severity: "error", world: "open", sources: ["core"], forbiddenTargets: ["infra"], edgeKinds: ["runtime"], approval: active }] };
  const result = evaluate(graph, map, contract);
  assert.equal(result.implementation.length, 1);
  assert.equal(result.implementation[0]?.edge?.id, "edge-a-b");
  assert.equal(result.implementation[0]?.sourceArchitectureId, "core");
});

test("makes proposed rules visible but non-blocking", () => {
  const contract: ArchitectureContractV1 = { version: "architecture-contract/v1", exceptions: [], rules: [{ id: "future-core-no-infra", kind: "dependency-policy", intent: "future boundary", enforcement: "proposed", severity: "error", world: "open", sources: ["core"], forbiddenTargets: ["infra"], edgeKinds: ["runtime"] }] };
  const result = evaluate(graph, map, contract);
  assert.equal(result.implementation[0]?.status, "proposed");
  assert.equal(result.blockingViolations.length, 0);
});

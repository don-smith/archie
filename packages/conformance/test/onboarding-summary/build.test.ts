import assert from "node:assert/strict";
import test from "node:test";

import { digestJson } from "../../src/artifacts/digest.js";
import { buildOnboardingSummary } from "../../src/onboarding-summary/build.js";
import type { NormalizedGraphV1 } from "../../src/formats/types.js";

const graph: NormalizedGraphV1 = {
  version: "normalized-graph/v1",
  scope: { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [{ path: "src/generated/**", reason: "generated" }] },
  nodes: [
    { id: "module:src/a", kind: "source-module", module: "src/a", file: "src/a.ts" },
    { id: "module:src/b", kind: "source-module", module: "src/b", file: "src/b.ts" },
    { id: "module:external:node:fs", kind: "external-module", module: "external:node:fs" }
  ],
  edges: [
    { id: "b", source: "module:src/a", target: "module:src/b", kind: "runtime", specifier: "@workspace/b", status: "resolved", span: { file: "src/a.ts", start: { line: 1, column: 1 }, end: { line: 1, column: 20 } } },
    { id: "a", source: "module:src/a", target: "module:external:node:fs", kind: "type", specifier: "node:fs", status: "resolved", span: { file: "src/a.ts", start: { line: 2, column: 1 }, end: { line: 2, column: 20 } } },
    { id: "c", source: "module:src/b", kind: "runtime", specifier: "missing", status: "unresolved", span: { file: "src/b.ts", start: { line: 1, column: 1 }, end: { line: 1, column: 20 } } }
  ],
  exclusions: [{ path: "src/generated/file.ts", reason: "generated" }],
  gaps: [{ kind: "unresolved-static-import", message: "cannot resolve missing", file: "src/b.ts" }],
  provenance: { adapter: "typescript-program-v1", compilerVersion: "7.0.2", rootConfigs: ["tsconfig.json"], sourceFiles: ["src/a.ts", "src/b.ts"], resolutionInputs: [], compilerOptions: {} }
};

test("renders byte-stable graph-linked scope, coverage, gaps, and dependency aggregates", () => {
  const first = buildOnboardingSummary(graph); const second = buildOnboardingSummary(graph);
  assert.equal(first, second);
  assert.match(first, new RegExp(`Graph digest: ${digestJson(graph)}`));
  assert.match(first, /Roots: `tsconfig.json`/);
  assert.match(first, /Source modules: 2/);
  assert.match(first, /resolved: 2; unresolved: 1/);
  assert.match(first, /workspace-source-imports/);
  assert.match(first, /src\/a → src\/b \(`@workspace\/b`, runtime\)/);
  assert.match(first, /unresolved-static-import/);
  assert.doesNotMatch(first, /pass|architecture ID|approval/i);
});

test("does not mutate an unsorted graph after calculating its digest", () => {
  const unsorted: NormalizedGraphV1 = {
    ...graph,
    scope: { rootConfigs: ["z.json", "a.json"], include: ["z/**/*.ts", "a/**/*.ts"], exclusions: [{ path: "z/**", reason: "generated" }, { path: "a/**", reason: "generated" }] }
  };
  const before = JSON.parse(JSON.stringify(unsorted)) as NormalizedGraphV1;
  const summary = buildOnboardingSummary(unsorted);
  assert.deepEqual(unsorted, before);
  assert.match(summary, new RegExp(`Graph digest: ${digestJson(before)}`));
});

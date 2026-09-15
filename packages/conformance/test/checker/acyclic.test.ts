import assert from "node:assert/strict";
import test from "node:test";

import { acyclicResults } from "../../src/checker/acyclic.js";

test("finds a directed architecture cycle", () => {
  const edge = (id: string) => ({ id, source: `module:${id[0]}`, target: `module:${id[2]}`, kind: "runtime" as const, specifier: id, status: "resolved" as const, span: { file: "src/a.ts", start: { line: 1, column: 1 }, end: { line: 1, column: 2 } } });
  const results = acyclicResults({ id: "no-cycle", kind: "acyclic", intent: "no cycles", enforcement: "active", severity: "error", world: "open", domain: ["a", "b"], edgeKinds: ["runtime"], approval: { approvedBy: "maintainer", approvedAt: "2026-08-27" } }, [{ edge: edge("a-b"), source: "a", target: "b" }, { edge: edge("b-a"), source: "b", target: "a" }]);
  assert.equal(results.length, 1);
  assert.match(results[0]!.message, /a -> b -> a/);
});

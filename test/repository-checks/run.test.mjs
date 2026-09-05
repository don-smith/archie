import assert from "node:assert/strict";
import test from "node:test";
import { runRepositoryCheck } from "../../dist/packages/archie-runtime/src/repository-checks/run.js";
test("preserves target-owned check exits and result meanings", () => {
  const result = runRepositoryCheck({ id: "target-audit", command: `${process.execPath} -e "process.exit(7)"`, authority: "target maintainer", evidencePath: "audit.json", resultMeaning: "findings remain target-defined" }, process.cwd());
  assert.equal(result.exitCode, 7); assert.equal(result.resultMeaning, "findings remain target-defined");
});

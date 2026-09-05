import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("private-trial evaluation preserves replay, drift, recovery, and claim-boundary evidence", () => {
  const directory = mkdtempSync(join(tmpdir(), "archie-private-trial-e2e-"));
  const output = join(directory, "evidence.json");
  try {
    const result = spawnSync(process.execPath, ["scripts/run-private-trial-evaluation.mjs", "--output", output], { encoding: "utf8" });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const evidence = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(evidence.format, "archie-private-trial-evidence-v1");
    assert.equal(evidence.authorization, "not-assessed");
    assert.equal(evidence.replay.byteStable, true);
    assert.equal(evidence.finalization.deterministic, true);
    assert.equal(evidence.coordinatedReplacement.authorization, "not-assessed");
    assert.equal(evidence.coordinatedReplacement.consistency, "passed");
    assert.equal(evidence.capabilities.authorityStopsPreserved, true);
    assert.deepEqual(evidence.policy, { baseline: "passed", noPolicy: "not-applied", blocked: "blocked" });
    assert.equal(evidence.recovery.compensation, "passed");
    for (const mutation of ["npm-lock", "npm-integrity", "apm-locator", "apm-commit", "apm-content-hash", "installed-projection", "html-byte", "shared-manifest"]) {
      assert.equal(evidence.mutations[mutation].rejected, true, `${mutation} mutation was accepted`);
    }
    assert.match(evidence.textReport, /Archie authorization: NOT ASSESSED — locally reviewed private release selected\./);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

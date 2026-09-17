import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("private-trial evaluation proves the integrated release-candidate matrix", () => {
  const directory = mkdtempSync(join(tmpdir(), "archie-private-trial-e2e-"));
  const output = join(directory, "evidence.json");
  try {
    const result = spawnSync(process.execPath, ["scripts/run-private-trial-evaluation.mjs", "--output", output], { encoding: "utf8", timeout: 600000 });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const evidence = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(evidence.format, "archie-private-trial-evidence-v3");
    assert.deepEqual(evidence.candidate, {
      status: "local-only",
      version: "0.1.0-private.1",
      sourceCommit: evidence.candidate.sourceCommit,
      schemaVersion: 3,
      authorization: "not-assessed"
    });
    assert.match(evidence.candidate.sourceCommit, /^[a-f0-9]{40}$/);
    assert.equal(evidence.finalization.deterministic, true);
    assert.deepEqual(evidence.finalization.orderedArtifacts, ["@archie/runtime", "@archie/conformance"]);
    assert.equal(evidence.finalization.artifactManifest.digest, evidence.finalization.repeatedArtifactManifest.digest);
    assert.equal(evidence.installation.byteStable, true);
    assert.equal(new Set(Object.values(evidence.installation.manifests).map(manifest => manifest.digest)).size, 1);
    assert.equal(evidence.legacyPin.rejected, true);
    assert.equal(evidence.recovery.compensation, "passed");
    assert.equal(evidence.recovery.restored, true);
    assert.equal(evidence.integrity.exactNpmLock, true);
    assert.equal(evidence.integrity.skillCount, 8);
    assert.equal(evidence.integrity.skills["html-design"].exact, true);
    assert.equal(evidence.integrity.skills["architecture-review"].exact, true);
    assert.equal(evidence.integrity.architectureDocsEmbedded, true);
    assert.deepEqual(evidence.integrity.binaries, { architectureDocs: "passed", architectureConformance: "passed" });
    assert.ok(Object.values(evidence.integrity.packages).every(value => value.exact));
    assert.ok(Object.values(evidence.integrity.skills).every(value => value.exact));
    assert.ok(Object.values(evidence.integrity.stagedArtifacts).every(value => value.sha256 === value.recordedSha256));
    assert.deepEqual(evidence.policy, { passed: "passed", noPolicy: "not-applied", blocked: "blocked" });
    assert.equal(evidence.capabilities.count, 7);
    assert.equal(evidence.capabilities.authorityStopsPreserved, true);
    for (const [name, mutation] of Object.entries(evidence.mutations)) assert.equal(mutation.rejected, true, `${name} mutation was accepted`);
    assert.equal(evidence.externalGates.push, "not-authorized");
    assert.equal(evidence.externalGates.tag, "not-authorized");
    assert.match(evidence.textReport, /Archie authorization: NOT ASSESSED — locally reviewed private release selected\./);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

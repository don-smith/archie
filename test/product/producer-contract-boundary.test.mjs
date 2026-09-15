import assert from "node:assert/strict";
import test from "node:test";

test("producer package roots expose readers and reject private module paths", async () => {
  const assessment = await import("@archie/assessment");
  const conformance = await import("@archie/conformance");
  assert.deepEqual(Object.keys(assessment).sort(), ["ASSESSMENT_EVIDENCE_V1", "readAssessmentEvidence"]);
  assert.ok(Object.hasOwn(conformance, "readAssessmentEvidence") === false);
  assert.equal(conformance.CONFORMANCE_REPORT_CONTRACT_V1, "conformance-report-contract/v1");
  await assert.rejects(import("@archie/assessment/skills/architecture-assessment/scripts/check-model.mjs"));
  await assert.rejects(import("@archie/conformance/src/formats/validate.js"));
  await assert.rejects(import("@archie/conformance/src/checker/evaluate.js"));
});

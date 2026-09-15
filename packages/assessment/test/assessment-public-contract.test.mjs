import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { ASSESSMENT_EVIDENCE_V1, readAssessmentEvidence } from "../public.mjs";

const root = path.resolve(import.meta.dirname, "fixtures/contracts");
const load = async (name) => JSON.parse(await readFile(path.join(root, name), "utf8"));

test("reads every assessment evidence fixture according to its independent expectation", async () => {
  const cases = await load("cases.json");
  assert.equal(ASSESSMENT_EVIDENCE_V1, "assessment-evidence/v1");
  for (const example of cases) {
    const input = await load(example.input);
    if (example.accepted) {
      const parsed = readAssessmentEvidence(input);
      assert.equal(parsed.status, example.status, example.name);
      assert.equal(parsed.evidence.availability, example.availability, example.name);
    } else {
      assert.throws(() => readAssessmentEvidence(input), new RegExp(example.error), example.name);
    }
  }
});

test("publishes a closed versioned assessment schema", async () => {
  const schema = JSON.parse(await readFile(path.resolve(import.meta.dirname, "../schemas/assessment-evidence-v1.schema.json"), "utf8"));
  assert.equal(schema.$id, ASSESSMENT_EVIDENCE_V1);
  assert.equal(schema.additionalProperties, false);
});

test("assessment evidence parsing is deterministic and preserves the closed field set", async () => {
  const fixture = await load("valid-ready.json");
  const first = JSON.stringify(readAssessmentEvidence(fixture));
  const second = JSON.stringify(readAssessmentEvidence(JSON.parse(first)));
  assert.equal(first, second);
  assert.deepEqual(Object.keys(JSON.parse(first)), ["version", "assessmentId", "status", "completeness", "evidence", "correction", "triage", "authority"]);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  CONFORMANCE_REPORT_CONTRACT_V1,
  CONFORMANCE_STATE_CONTRACT_V1,
  readConformanceReportContract,
  readConformanceStateContract,
} from "../src/public.js";

const root = resolve(process.cwd(), "test/fixtures/contracts");
async function load(name: string): Promise<any> { return JSON.parse(await readFile(resolve(root, name), "utf8")); }

test("reads report and state fixtures with independent expected outcomes", async () => {
  const cases = await load("cases.json");
  assert.equal(CONFORMANCE_REPORT_CONTRACT_V1, "conformance-report-contract/v1");
  assert.equal(CONFORMANCE_STATE_CONTRACT_V1, "conformance-state-contract/v1");
  for (const example of cases) {
    const input = await load(example.input);
    if (example.kind === "report") {
      if (example.accepted) assert.equal(readConformanceReportContract(input).report.result.code, example.code, example.name);
      else assert.throws(() => readConformanceReportContract(input), new RegExp(example.error), example.name);
    } else if (example.accepted) {
      assert.equal(readConformanceStateContract(input).freshness.status, example.freshness, example.name);
    } else assert.throws(() => readConformanceStateContract(input), new RegExp(example.error), example.name);
  }
});

test("publishes closed versioned report and state schemas", async () => {
  for (const [name, id] of [["conformance-report-contract-v1.schema.json", CONFORMANCE_REPORT_CONTRACT_V1], ["conformance-state-contract-v1.schema.json", CONFORMANCE_STATE_CONTRACT_V1]] as const) {
    const schema = JSON.parse(await readFile(resolve(process.cwd(), "schemas", name), "utf8"));
    assert.equal(schema.$id, id);
    assert.equal(schema.additionalProperties, false);
  }
});

test("public contract parsing is deterministic across two runs", async () => {
  const report = await load("valid-report.json");
  const state = await load("valid-state.json");
  const reportFirst = JSON.stringify(readConformanceReportContract(report));
  const reportSecond = JSON.stringify(readConformanceReportContract(JSON.parse(reportFirst)));
  const stateFirst = JSON.stringify(readConformanceStateContract(state));
  const stateSecond = JSON.stringify(readConformanceStateContract(JSON.parse(stateFirst)));
  assert.equal(reportFirst, reportSecond);
  assert.equal(stateFirst, stateSecond);
});

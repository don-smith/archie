import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { CONFORMANCE_REPORT_V1, ONBOARDING_STATE_V1, readConformanceReport, readOnboardingState } from "../../src/public.js";

const packageRoot = resolve(process.cwd());

async function schema(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(resolve(packageRoot, "schemas", name), "utf8")) as Record<string, unknown>;
}

test("publishes closed versioned report and onboarding contracts", async () => {
  const report = await schema("conformance-report-v1.schema.json");
  const onboarding = await schema("onboarding-state-v1.schema.json");
  assert.equal(report.$id, CONFORMANCE_REPORT_V1);
  assert.equal(onboarding.$id, ONBOARDING_STATE_V1);
  assert.equal(report.additionalProperties, false);
  assert.equal(onboarding.additionalProperties, false);
  assert.equal((onboarding.properties as Record<string, Record<string, unknown>>).evidence!.additionalProperties, false);
});

test("public readers validate the frozen document versions and nested closed fields", () => {
  assert.throws(() => readConformanceReport({ version: "conformance-report/v2" }), /unsupported document version/);
  assert.throws(() => readConformanceReport({ version: "conformance-report/v1", extra: true }), /unknown field/);
  assert.throws(() => readConformanceReport({
    version: "conformance-report/v1",
    digests: { realizationMap: "a", contract: "b", graph: "c", provenance: "d", output: "e" },
    results: [{ fingerprint: "f", status: "active", category: "implementation", message: "m", unexpected: true }],
    gaps: [],
    graph: { version: "normalized-graph/v1", nodes: [], edges: [], exclusions: [], gaps: [], provenance: { adapter: "typescript-program-v1" } }
  }), /unknown field/);
  assert.throws(() => readOnboardingState({ version: "onboarding-state/v2" }), /unsupported document version/);
});

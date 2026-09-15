import assert from "node:assert/strict";
import test from "node:test";

import { validateArchitectureActiveResultSet, validateArchitectureContract, validateArchitectureDriftRecord, validateRealizationMap } from "../../src/formats/validate.js";

test("accepts versioned realization maps with one selector per mapping", () => {
  const map = validateRealizationMap({
    version: "realization-map/v1",
    scope: { rootConfigs: ["tsconfig.json"], include: ["src/**/*.ts"], exclusions: [] },
    elements: [{ id: "core" }],
    mappings: [{ elementId: "core", path: "src/core.ts" }]
  });

  assert.equal(map.mappings[0]?.elementId, "core");
});

test("rejects ambiguous realization selectors", () => {
  assert.throws(() => validateRealizationMap({
    version: "realization-map/v1", scope: { rootConfigs: [], include: [], exclusions: [] },
    elements: [{ id: "core" }], mappings: [{ elementId: "core", path: "src/core.ts", module: "core" }]
  }), /exactly one selector/);
});

test("requires active rules to include approval metadata", () => {
  assert.throws(() => validateArchitectureContract({
    version: "architecture-contract/v1", exceptions: [], rules: [{
      id: "no-core-infra", kind: "dependency-policy", intent: "keep core isolated", enforcement: "active",
      severity: "error", world: "open", sources: ["core"], forbiddenTargets: ["infra"], edgeKinds: ["runtime"]
    }]
  }), /approval/);
});

test("validates normalized reconciliation documents without rejecting duplicates", () => {
  const active = validateArchitectureActiveResultSet({ version: "architecture-active-result-set/v1", results: [{ id: "result", fingerprint: "one" }, { id: "result", fingerprint: "one" }] });
  const drift = validateArchitectureDriftRecord({ version: "architecture-drift-record/v1", records: [{ id: "result", fingerprint: "one", state: "open" }] });
  assert.equal(active.results.length, 2); assert.equal(drift.records[0]?.state, "open");
  assert.throws(() => validateArchitectureActiveResultSet({ version: "architecture-active-result-set/v1", results: [{ id: "", fingerprint: "one" }] }), /id/);
  assert.throws(() => validateArchitectureDriftRecord({ version: "architecture-drift-record/v1", records: [{ id: "result", fingerprint: "one" }] }), /state/);
});

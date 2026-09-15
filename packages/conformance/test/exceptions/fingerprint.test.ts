import assert from "node:assert/strict";
import test from "node:test";

import { evidenceFingerprint } from "../../src/exceptions/fingerprint.js";

test("keeps an edge waiver stable when only source lines move", () => {
  const fingerprint = evidenceFingerprint({ ruleId: "no-core-infra", sourceArchitectureId: "core", targetArchitectureId: "infra", sourceModule: "src/core", targetModule: "src/infra", edgeKind: "runtime", specifier: "../infra.js" });
  assert.equal(fingerprint, evidenceFingerprint({ ruleId: "no-core-infra", sourceArchitectureId: "core", targetArchitectureId: "infra", sourceModule: "src/core", targetModule: "src/infra", edgeKind: "runtime", specifier: "../infra.js" }));
  assert.notEqual(fingerprint, evidenceFingerprint({ ruleId: "no-core-infra", sourceArchitectureId: "core", targetArchitectureId: "infra", sourceModule: "src/core", targetModule: "src/infra", edgeKind: "type", specifier: "../infra.js" }));
});

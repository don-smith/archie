import assert from "node:assert/strict";
import test from "node:test";

import { compareBaseline } from "../../src/baseline/compare.js";

const result = { fingerprint: "current", status: "active" as const, category: "implementation" as const, message: "violation" };

test("classifies new, unchanged, reintroduced, and fixed results", () => {
  assert.equal(compareBaseline([result])[0]?.status, "new");
  assert.equal(compareBaseline([result], { version: "conformance-baseline/v1", active: ["current", "gone"], ledger: ["current", "gone", "old"] })[0]?.status, "unchanged");
  assert.equal(compareBaseline([{ ...result, fingerprint: "old" }], { version: "conformance-baseline/v1", active: [], ledger: ["old"] })[0]?.status, "reintroduced");
  const compared = compareBaseline([result], { version: "conformance-baseline/v1", active: ["gone"], ledger: ["gone"] });
  assert.equal(compared.find((item) => item.status === "fixed")?.message, "fixed result gone");
});

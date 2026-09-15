import assert from "node:assert/strict";
import test from "node:test";

import { canonicalize } from "../../src/artifacts/canonical-json.js";
import { sha256 } from "../../src/artifacts/digest.js";

test("canonicalizes object keys and produces a stable SHA-256 digest", () => {
  const value = { z: [3, { b: true, a: "é" }], a: 1 };

  const bytes = canonicalize(value);

  assert.equal(bytes, '{"a":1,"z":[3,{"a":"é","b":true}]}');
  assert.equal(sha256(bytes), "ca4bb7fa64fcdbadb9b46d7b24b9f096da29904b5c897b994d7e8c0d4d6bef26");
});

test("rejects non-JSON values", () => {
  assert.throws(() => canonicalize({ value: Number.NaN }), /finite/);
});

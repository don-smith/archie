import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { finalizeRelease, validateBundleLayout } from "../../../dist/packages/archie-runtime/src/release-record/release-record-v1.js";

const fixture = "test/fixtures/private-bundles/valid";
const provenance = "packages/archie-runtime/vendor/html-design.provenance.json";
const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";
function prepare() { const root = mkdtempSync(join(tmpdir(), "archie-finalize-e2e-")); const bundle = join(root, "bundle"); cpSync(fixture, bundle, { recursive: true }); return { root, bundle }; }

test("release-finalize produces identical local bundle records and receipts", () => {
  const first = prepare(), second = prepare();
  try {
    const one = finalizeRelease({ bundleDirectory: first.bundle, sourceCommit, htmlProvenancePath: provenance });
    const two = finalizeRelease({ bundleDirectory: second.bundle, sourceCommit, htmlProvenancePath: provenance });
    assert.equal(readFileSync(one.recordPath, "utf8"), readFileSync(two.recordPath, "utf8"));
    assert.equal(readFileSync(one.receiptPath, "utf8"), readFileSync(two.receiptPath, "utf8"));
    assert.equal(one.recordSha256, two.recordSha256);
    assert.doesNotThrow(() => validateBundleLayout(first.bundle));
  } finally { rmSync(first.root, { recursive: true, force: true }); rmSync(second.root, { recursive: true, force: true }); }
});

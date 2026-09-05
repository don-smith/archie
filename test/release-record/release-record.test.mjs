import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { finalizeRelease, parseReleaseRecord, serializeReleaseRecord, validateBundleLayout } from "../../dist/packages/archie-runtime/src/release-record/release-record-v1.js";

const fixture = "test/fixtures/private-bundles/valid";
const provenance = "packages/archie-runtime/vendor/html-design.provenance.json";
const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";
function copyFixture() {
  const root = mkdtempSync(join(tmpdir(), "archie-release-record-"));
  const bundle = join(root, "bundle"); cpSync(fixture, bundle, { recursive: true }); return { root, bundle };
}
function finalize(bundle) { return finalizeRelease({ bundleDirectory: bundle, sourceCommit, htmlProvenancePath: provenance }); }

test("canonical unsigned record is deterministic and carries the non-authorization boundary", () => {
  const first = copyFixture(), second = copyFixture();
  try {
    const one = finalize(first.bundle), two = finalize(second.bundle);
    const bytes = readFileSync(one.recordPath, "utf8");
    assert.equal(bytes, readFileSync(two.recordPath, "utf8"));
    assert.equal(one.recordSha256, two.recordSha256);
    assert.deepEqual(parseReleaseRecord(bytes), one.record);
    assert.equal(one.record.authorization.kind, "none");
    assert.match(readFileSync(one.receiptPath, "utf8"), /Archie authorization: NOT ASSESSED — locally reviewed private release selected\./);
  } finally { rmSync(first.root, { recursive: true, force: true }); rmSync(second.root, { recursive: true, force: true }); }
});

test("noncanonical bytes, unknown fields, and authorization variants fail closed", () => {
  const copied = copyFixture();
  try {
    const { recordPath } = finalize(copied.bundle);
    const record = JSON.parse(readFileSync(recordPath, "utf8"));
    assert.throws(() => parseReleaseRecord(`${JSON.stringify(record, null, 2)}\n`), /not canonical/);
    assert.throws(() => parseReleaseRecord(serializeReleaseRecord({ ...record, unexpected: true })), /unsupported or missing fields/);
    assert.throws(() => parseReleaseRecord(serializeReleaseRecord({ ...record, authorization: { kind: "signature", claim: "locally-reviewed-private-trial" } })), /authorization/);
  } finally { rmSync(copied.root, { recursive: true, force: true }); }
});

test("malformed final artifact evidence and unsupported layouts reject", () => {
  const copied = copyFixture();
  try {
    writeFileSync(join(copied.bundle, "npm", "archie-runtime.tgz"), "changed");
    assert.throws(() => finalize(copied.bundle), /gzip|integrity/);
    writeFileSync(join(copied.bundle, "npm", "archie-runtime.tgz"), readFileSync(join(fixture, "npm", "archie-runtime.tgz")));
    writeFileSync(join(copied.bundle, "apm", "apm.lock.yaml"), "resolved_commit: nope\n");
    assert.throws(() => finalize(copied.bundle), /exactly one|malformed/);
    writeFileSync(join(copied.bundle, "unexpected.txt"), "no");
    assert.throws(() => validateBundleLayout(copied.bundle), /unsupported entry/);
  } finally { rmSync(copied.root, { recursive: true, force: true }); }
});

test("unsupported analyzer compatibility is rejected by the parser", () => {
  const copied = copyFixture();
  try {
    const { recordPath } = finalize(copied.bundle);
    const record = JSON.parse(readFileSync(recordPath, "utf8"));
    record.analyzerCompatibility.platform = "linux";
    assert.throws(() => parseReleaseRecord(`${JSON.stringify(record)}\n`), /unsupported analyzer compatibility/);
  } finally { rmSync(copied.root, { recursive: true, force: true }); }
});

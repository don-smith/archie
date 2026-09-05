import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { digestHtmlSnapshot, validateHtmlSnapshotProvenance, verifyHtmlSnapshot } from "../../dist/packages/archie-runtime/src/html-snapshot/verify.js";
const source = "packages/archie-runtime/vendor/html-design";
const provenance = JSON.parse(readFileSync("packages/archie-runtime/vendor/html-design.provenance.json"));
test("snapshot digest matches its complete reviewed file set", () => {
  validateHtmlSnapshotProvenance(provenance); const actual = digestHtmlSnapshot(source);
  assert.equal(actual.digest, provenance.digest.value); assert.equal(actual.fileCount, provenance.digest.fileCount);
});
test("changed, omitted, or extra snapshot bytes reject", () => {
  const root = mkdtempSync(join(tmpdir(), "archie-html-")); cpSync(source, root, { recursive: true });
  try { writeFileSync(join(root, "extra.txt"), "extra"); assert.throws(() => verifyHtmlSnapshot(root, { digest: provenance.digest.value, fileCount: provenance.digest.fileCount }), /mismatch/); unlinkSync(join(root, "extra.txt")); unlinkSync(join(root, "LICENSE")); assert.throws(() => verifyHtmlSnapshot(root, { digest: provenance.digest.value, fileCount: provenance.digest.fileCount }), /mismatch/); } finally { rmSync(root, { recursive: true, force: true }); }
});
test("missing provenance fields and required notices reject", () => {
  assert.throws(() => validateHtmlSnapshotProvenance({ ...provenance, requiredNotices: [] }), /required notices/);
  assert.throws(() => validateHtmlSnapshotProvenance({ ...provenance, license: {} }), /license/);
});

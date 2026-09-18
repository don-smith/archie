import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { validateBundleLayout } from "../../../dist/packages/archie-runtime/src/index.js";
import { makeBundle, sourceCommit } from "../../support/release-bundle.mjs";

function finalizeWithCli(bundle) {
  const result = spawnSync(process.execPath, ["dist/packages/archie-cli/src/release-cli.js", "finalize", "--bundle", bundle, "--source-commit", sourceCommit], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Archie authorization: NOT ASSESSED/);
  return { record: readFileSync(join(bundle, "release-record-v3.json"), "utf8"), receipt: readFileSync(join(bundle, "release-review.txt"), "utf8") };
}

test("release-finalize produces identical local bundle records and receipts", () => {
  const root = mkdtempSync(join(tmpdir(), "archie-finalize-e2e-"));
  try {
    const first = makeBundle(root, "first"), second = makeBundle(root, "second");
    const one = finalizeWithCli(first), two = finalizeWithCli(second);
    assert.equal(one.record, two.record);
    assert.equal(one.receipt, two.receipt);
    assert.equal(JSON.parse(one.record).schemaVersion, 3);
    assert.doesNotThrow(() => validateBundleLayout(first));
    const rejected = spawnSync(process.execPath, ["dist/packages/archie-cli/src/release-cli.js", "finalize", "--bundle", first], { encoding: "utf8" });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /archie-release finalize --bundle <local-directory> --source-commit/);
    assert.match(rejected.stderr, /archie-release build --bundle <output-directory> --ref/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

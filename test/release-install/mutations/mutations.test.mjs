import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { finalizeRelease } from "../../../dist/packages/archie-runtime/src/release-record/release-record-v1.js";
import { selectLocalRelease } from "../../../dist/packages/archie-runtime/src/release-install/selection.js";
import { bootstrapTarget } from "../../../dist/packages/archie-runtime/src/release-install/target-state.js";
import { verifyInstalledTarget } from "../../../dist/packages/archie-runtime/src/release-install/verify.js";

const fixture = "test/fixtures/private-bundles/valid", provenance = "packages/archie-runtime/vendor/html-design.provenance.json";
test("rejects pinned APM lock drift before npm or APM native work", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-mutations-"));
  try {
    const bundle = join(base, "bundle"); cpSync(fixture, bundle, { recursive: true }); finalizeRelease({ bundleDirectory: bundle, sourceCommit: "abcdef0123456789abcdef0123456789abcdef01", htmlProvenancePath: provenance });
    const target = join(base, "target"); mkdirSync(target); bootstrapTarget(target, selectLocalRelease(bundle));
    const lock = join(target, "apm.lock.yaml"); writeFileSync(lock, readFileSync(lock, "utf8").replace(/content_hash: .*/, "content_hash: sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
    let calls = 0;
    assert.throws(() => verifyInstalledTarget(target, { run: () => { calls += 1; return { exitCode: 0, stdout: "", stderr: "" }; } }), /drifted/);
    assert.equal(calls, 0);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

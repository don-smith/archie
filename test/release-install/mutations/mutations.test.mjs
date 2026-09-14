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
test("rejects reordered pinned APM skill subsets before native work", () => {
  for (const relativePath of ["apm.yml", "apm.lock.yaml"]) {
    const base = mkdtempSync(join(tmpdir(), "archie-skill-order-"));
    try {
      const bundle = join(base, "bundle"); cpSync(fixture, bundle, { recursive: true }); finalizeRelease({ bundleDirectory: bundle, sourceCommit: "abcdef0123456789abcdef0123456789abcdef01", htmlProvenancePath: provenance });
      const target = join(base, "target"); mkdirSync(target); bootstrapTarget(target, selectLocalRelease(bundle));
      writeFileSync(join(target, "apm.lock.yaml"), readFileSync(join(bundle, "apm", "apm.lock.yaml")));
      const path = join(target, relativePath);
      const reordered = readFileSync(path, "utf8").replace(/^(\s*)- architecture-docs\n\1- likec4-authoring$/m, "$1- likec4-authoring\n$1- architecture-docs");
      writeFileSync(path, reordered);
      let calls = 0;
      assert.throws(() => verifyInstalledTarget(target, { run: () => { calls += 1; return { exitCode: 0, stdout: "", stderr: "" }; } }), /pinned Archie entry|drifted/);
      assert.equal(calls, 0);
    } finally { rmSync(base, { recursive: true, force: true }); }
  }
});

test("rejects pinned APM lock drift before npm or APM native work", () => {
  const base = mkdtempSync(join(tmpdir(), "archie-mutations-"));
  try {
    const bundle = join(base, "bundle"); cpSync(fixture, bundle, { recursive: true }); finalizeRelease({ bundleDirectory: bundle, sourceCommit: "abcdef0123456789abcdef0123456789abcdef01", htmlProvenancePath: provenance });
    const target = join(base, "target"); mkdirSync(target); bootstrapTarget(target, selectLocalRelease(bundle));
    const lock = join(target, "apm.lock.yaml"); writeFileSync(lock, readFileSync(join(bundle, "apm", "apm.lock.yaml"), "utf8").replace(/content_hash: .*/, "content_hash: sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
    let calls = 0;
    assert.throws(() => verifyInstalledTarget(target, { run: () => { calls += 1; return { exitCode: 0, stdout: "", stderr: "" }; } }), /drifted/);
    assert.equal(calls, 0);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { selectLocalRelease } from "../../../dist/packages/archie-runtime/src/index.js";
import { finalizedBundle } from "../../support/release-bundle.mjs";
import { bootstrapTarget } from "../../../dist/packages/archie-runtime/src/release-install/target-state.js";
import { verifyInstalledTarget } from "../../../dist/packages/archie-runtime/src/release-install/verify.js";

test("rejects reordered pinned APM skill subsets before native work", () => {
  for (const relativePath of ["apm.yml", "apm.lock.yaml"]) {
    const base = mkdtempSync(join(tmpdir(), "archie-skill-order-"));
    try {
      const bundle = finalizedBundle(base);
      const target = join(base, "target"); mkdirSync(target); bootstrapTarget(target, selectLocalRelease(bundle));
      writeFileSync(join(target, "apm.lock.yaml"), readFileSync(join(bundle, "apm", "apm.lock.yaml")));
      const path = join(target, relativePath);
      const reordered = readFileSync(path, "utf8").replace(/^(\s*)- archie\n\1- architecture-assessment$/m, "$1- architecture-assessment\n$1- archie");
      assert.notEqual(reordered, readFileSync(path, "utf8"), `${relativePath} must be reordered`);
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
    const bundle = finalizedBundle(base);
    const target = join(base, "target"); mkdirSync(target); bootstrapTarget(target, selectLocalRelease(bundle));
    const lock = join(target, "apm.lock.yaml"); writeFileSync(lock, readFileSync(join(bundle, "apm", "apm.lock.yaml"), "utf8").replace(/content_hash: .*/, "content_hash: sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
    let calls = 0;
    assert.throws(() => verifyInstalledTarget(target, { run: () => { calls += 1; return { exitCode: 0, stdout: "", stderr: "" }; } }), /drifted/);
    assert.equal(calls, 0);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

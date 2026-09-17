import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { selectLocalRelease } from "../../../dist/packages/archie-runtime/src/index.js";
import { finalizedBundle, installRunner } from "../../support/release-bundle.mjs";
import { bootstrapAndVerifyTarget, verifyInstalledTarget } from "../../../dist/packages/archie-runtime/src/release-install/verify.js";

function root() { return mkdtempSync(join(tmpdir(), "archie-native-flow-")); }
function bundle(base) { return finalizedBundle(base); }
function target(base) { const path = join(base, "target"); mkdirSync(path, { recursive: true }); return path; }
function successfulRunner(calls) { return installRunner({ calls }); }

const options = (calls) => ({ run: successfulRunner(calls), verifyApmDeployment: () => undefined });

test("runs native checks in the required order and reports non-authorization", () => {
  const base = root();
  try {
    const calls = [];
    const result = bootstrapAndVerifyTarget(target(base), selectLocalRelease(bundle(base)), options(calls));
    assert.deepEqual(calls, [["apm", "lock"], ["npm", "ci", "--ignore-scripts", "--offline"], ["apm", "install", "--frozen"], ["apm", "audit", "--ci", "--no-policy"], ["apm", "policy", "status"], ["apm", "audit", "--ci"]]);
    assert.equal(result.report.authorization, "not-assessed");
    assert.equal(result.report.npm, "passed");
    assert.equal(result.report.apm.frozen, "passed");
    assert.equal(result.report.apm.baseline, "passed");
    assert.equal(result.report.apm.policy, "passed");
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("rejects tarball drift before native commands run", () => {
  const base = root();
  try {
    const calls = [];
    const project = target(base);
    const selected = selectLocalRelease(bundle(base));
    bootstrapAndVerifyTarget(project, selected, options(calls));
    const callsAfterBootstrap = calls.length;
    writeFileSync(join(project, ".archie", "runtime", "npm", selected.artifacts[0].tarballName), "changed");
    assert.throws(() => verifyInstalledTarget(project, options(calls)), /tarball differs/);
    assert.equal(calls.length, callsAfterBootstrap);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

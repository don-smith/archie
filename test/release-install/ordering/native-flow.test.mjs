import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
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

test("bridges the deployed skills into .claude/skills for a repository that uses Claude Code", () => {
  const base = root();
  try {
    const project = target(base);
    const selected = selectLocalRelease(bundle(base));
    // What APM deploys and what tells Archie the repository uses Claude Code; the native runner is
    // a stand-in, so the skill trees this bridge links to are placed here rather than by `apm install`.
    mkdirSync(join(project, ".claude"), { recursive: true });
    for (const skill of selected.record.apm.skills) mkdirSync(join(project, ".agents", "skills", skill), { recursive: true });

    const result = bootstrapAndVerifyTarget(project, selected, options([]));
    assert.equal(result.report.claudeSkills, "passed");
    for (const skill of selected.record.apm.skills) {
      assert.equal(readlinkSync(join(project, ".claude", "skills", skill)), `../../.agents/skills/${skill}`);
    }
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("leaves .claude alone in a repository that does not use Claude Code", () => {
  const base = root();
  try {
    const project = target(base);
    const result = bootstrapAndVerifyTarget(project, selectLocalRelease(bundle(base)), options([]));
    assert.equal(result.report.claudeSkills, "not-applied");
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

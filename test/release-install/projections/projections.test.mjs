import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { finalizeRelease } from "../../../dist/packages/archie-runtime/src/release-record/release-record-v1.js";
import { selectLocalRelease } from "../../../dist/packages/archie-runtime/src/release-install/selection.js";
import { bootstrapTarget, readPinnedTarget, upgradeTarget, verifyPinnedTarget } from "../../../dist/packages/archie-runtime/src/release-install/target-state.js";
import { assertPinnedApmProjection, planApmProjection } from "../../../dist/packages/archie-runtime/src/release-install/apm-projection.js";

const fixture = "test/fixtures/private-bundles/valid";
const provenance = "packages/archie-runtime/vendor/html-design.provenance.json";
const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";
function root() { return mkdtempSync(join(tmpdir(), "archie-projections-")); }
function bundle(base) { const path = join(base, "bundle"); cpSync(fixture, path, { recursive: true }); finalizeRelease({ bundleDirectory: path, sourceCommit, htmlProvenancePath: provenance }); return path; }
function target(base) {
  const path = join(base, "target");
  // The fixture has an application package and unrelated APM policy, dependency, and deployment.
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "package.json"), '{"name":"host-app","private":true}\n');
  writeFileSync(join(path, "package-lock.json"), '{"name":"host-app","lockfileVersion":3}\n');
  writeFileSync(join(path, "apm.yml"), "name: host\npolicy:\n  fetch_failure_default: block\ndependencies:\n  apm:\n    - git: file:unrelated/context\n      ref: v1\n      skills:\n        - unrelated\n  mcp: []\ndeployments:\n  - target: .agents/skills/unrelated\n");
  writeFileSync(join(path, "apm.lock.yaml"), "dependencies:\n  apm:\n    - locator: file:unrelated/context\n      ref: v1\n      resolved_commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n      content_hash: sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n      skill: unrelated\ndeployments:\n  - target: .agents/skills/unrelated\n");
  return path;
}
function command(...args) { return spawnSync(process.execPath, ["dist/packages/archie-cli/src/cli.js", ...args], { encoding: "utf8" }); }

test("bootstrap pins a finalized local bundle without mutating application npm state", () => {
  const base = root();
  try {
    const selected = selectLocalRelease(bundle(base));
    const project = target(base);
    const appManifest = readFileSync(join(project, "package.json"), "utf8");
    const appLock = readFileSync(join(project, "package-lock.json"), "utf8");
    bootstrapTarget(project, selected);
    assert.equal(readFileSync(join(project, "package.json"), "utf8"), appManifest);
    assert.equal(readFileSync(join(project, "package-lock.json"), "utf8"), appLock);
    assert.equal(readFileSync(join(project, ".archie/version"), "utf8"), `${selected.record.version}\n`);
    assert.equal(readFileSync(join(project, ".archie/release/release-record-v1.json"), "utf8"), selected.recordBytes);
    const receipt = JSON.parse(readFileSync(join(project, ".archie/release/selection-receipt.json"), "utf8"));
    assert.deepEqual(Object.keys(receipt).sort(), ["format", "recordSha256", "selectedPath", "version"]);
    assert.equal(receipt.selectedPath, selected.bundleDirectory);
    assert.equal(readFileSync(join(project, ".archie/runtime/package.json"), "utf8").includes(selected.record.npm.locator), true);
    assert.equal(existsSync(join(project, ".archie/runtime/npm/archie-runtime.tgz")), true);
    assert.match(readFileSync(join(project, "apm.yml"), "utf8"), /fetch_failure_default: block/);
    assert.match(readFileSync(join(project, "apm.yml"), "utf8"), /file:unrelated\/context/);
    assert.match(readFileSync(join(project, "apm.yml"), "utf8"), /\.agents\/skills\/archie/);
    assert.match(readFileSync(join(project, "apm.lock.yaml"), "utf8"), /\.agents\/skills\/unrelated/);
    assert.match(readFileSync(join(project, "apm.lock.yaml"), "utf8"), /\.agents\/skills\/archie/);
    assert.equal(readPinnedTarget(project).record.version, selected.record.version);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("selection and CLI enforce explicit local selection while verify consumes only the pin", () => {
  const base = root();
  try {
    assert.throws(() => selectLocalRelease("latest"), /explicit local directory/);
    const incomplete = join(base, "incomplete"); cpSync(fixture, incomplete, { recursive: true });
    assert.throws(() => selectLocalRelease(incomplete), /incomplete/);
    const selected = selectLocalRelease(bundle(base));
    const project = target(base);
    assert.match(command("bootstrap", "--target", project).stderr, /Usage/);
    assert.match(command("verify", "--release", selected.bundleDirectory, "--target", project).stderr, /Usage/);
    assert.equal(command("bootstrap", "--release", selected.bundleDirectory, "--target", project).status, 0);
    const verified = command("verify", "--target", project);
    assert.equal(verified.status, 0);
    assert.match(verified.stdout, /NOT ASSESSED/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("upgrade validates the current projection and APM ambiguity fails before writes", () => {
  const base = root();
  try {
    const selected = selectLocalRelease(bundle(base));
    const project = target(base);
    bootstrapTarget(project, selected);
    writeFileSync(join(project, "apm.lock.yaml"), readFileSync(join(project, "apm.lock.yaml"), "utf8").replace(selected.record.apm.resolvedCommit, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));
    assert.throws(() => upgradeTarget(project, selected), /drifted/);
    assert.throws(() => verifyPinnedTarget(project), /drifted/);
    const other = target(join(base, "other"));
    const before = readFileSync(join(other, "apm.yml"), "utf8");
    writeFileSync(join(other, "apm.yml"), before.replace("  mcp: []", `    - git: ${selected.record.apm.locator}\n      ref: v0\n      skills:\n        - archie\n    - git: ${selected.record.apm.locator}\n      ref: v0\n      skills:\n        - archie\n  mcp: []`));
    assert.throws(() => bootstrapTarget(other, selected), /ambiguous/);
    assert.equal(existsSync(join(other, ".archie/version")), false);
    const lockAmbiguous = target(join(base, "lock-ambiguous"));
    const lockBefore = readFileSync(join(lockAmbiguous, "apm.lock.yaml"), "utf8");
    const duplicateLockEntry = `    - locator: ${selected.record.apm.locator}\n      ref: ${selected.record.apm.ref}\n      resolved_commit: ${selected.record.apm.resolvedCommit}\n      content_hash: ${selected.record.apm.contentHash}\n      skill: ${selected.record.apm.skill}\n`;
    writeFileSync(join(lockAmbiguous, "apm.lock.yaml"), lockBefore.replace("deployments:", `${duplicateLockEntry}${duplicateLockEntry}deployments:`));
    assert.throws(() => bootstrapTarget(lockAmbiguous, selected), /ambiguous/);
    assert.equal(existsSync(join(lockAmbiguous, ".archie/version")), false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("APM 0.29-style locks and same-locator unrelated dependencies are structurally retained", () => {
  const base = root();
  try {
    const selected = selectLocalRelease(bundle(base));
    const manifest = "dependencies:\n  apm:\n    - git: file:apm/archie-context\n      ref: v-unrelated\n      skills:\n        - other-skill\ndeployments:\n  - target: agent-skills\n    value: .agents/skills/other-skill\n";
    const lock = "lockfile_version: '1'\ndependencies:\n- name: unrelated-context\n  repo_url: file:apm/archie-context\n  resolved_commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n  resolved_ref: v-unrelated\n  content_hash: sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n  skill_subset:\n  - other-skill\ndeployments:\n- kind: project-relative\n  target: agent-skills\n  value: .agents/skills/other-skill\n";
    const projection = planApmProjection(selected.record, { manifest, lock });
    assert.match(projection.manifest, /v-unrelated/);
    assert.match(projection.lock, /name: unrelated-context/);
    assert.match(projection.lock, /name: archie-context/);
    assert.match(projection.manifest, /\.agents\/skills\/archie/);
    assert.match(projection.lock, /\.agents\/skills\/archie/);
    assertPinnedApmProjection(selected.record, projection);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

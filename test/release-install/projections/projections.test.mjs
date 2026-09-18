import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { RELEASE_RECORD_FILE, selectLocalRelease } from "../../../dist/packages/archie-runtime/src/index.js";
import { bootstrapTarget, readPinnedTarget, verifyPinnedTarget } from "../../../dist/packages/archie-runtime/src/release-install/target-state.js";
import { assertAgentSkillsTarget, assertPinnedApmProjection, planApmProjection } from "../../../dist/packages/archie-runtime/src/release-install/apm-projection.js";
import * as runtime from "../../../dist/packages/archie-runtime/src/index.js";
import { finalizedBundle, makeBundle } from "../../support/release-bundle.mjs";

function root() { return mkdtempSync(join(tmpdir(), "archie-projections-")); }
function bundle(base) { return finalizedBundle(base); }
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
    assert.equal(readFileSync(join(project, `.archie/release/${RELEASE_RECORD_FILE}`), "utf8"), selected.recordBytes);
    const receipt = JSON.parse(readFileSync(join(project, ".archie/release/selection-receipt.json"), "utf8"));
    assert.deepEqual(Object.keys(receipt).sort(), ["format", "recordSha256", "selectedPath", "version"]);
    assert.equal(receipt.selectedPath, selected.bundleDirectory);
    assert.equal(readFileSync(join(project, ".archie/runtime/package.json"), "utf8").includes(selected.record.artifacts[0].locator), true);
    assert.equal(existsSync(join(project, ".archie/runtime/npm/archie-runtime.tgz")), true);
    assert.match(readFileSync(join(project, "apm.yml"), "utf8"), /fetch_failure_default: block/);
    assert.match(readFileSync(join(project, "apm.yml"), "utf8"), /file:unrelated\/context/);
    const stagedManifest = readFileSync(join(project, "apm.yml"), "utf8");
    for (const skill of selected.record.apm.skills) assert.match(stagedManifest, new RegExp(`- ${skill}`));
    assert.match(readFileSync(join(project, "apm.lock.yaml"), "utf8"), /unrelated/);
    assert.throws(() => readPinnedTarget(project), /drifted|pinned Archie entry|unsupported shared/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("selection and CLI enforce explicit local selection while verify consumes only the pin", () => {
  const base = root();
  try {
    assert.throws(() => selectLocalRelease("latest"), /explicit local directory/);
    const incomplete = makeBundle(base, "incomplete");
    assert.throws(() => selectLocalRelease(incomplete), /incomplete/);
    const selected = selectLocalRelease(bundle(base));
    const project = target(base);
    assert.match(command("bootstrap", "--target", project).stderr, /Usage/);
    assert.match(command("verify", "--release", selected.bundleDirectory, "--target", project).stderr, /Usage/);
    bootstrapTarget(project, selected);
    assert.equal(readFileSync(join(project, ".archie", "version"), "utf8"), `${selected.record.version}\n`);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("the packaged runtime does not expose an unverified upgrade staging step", async () => {
  assert.equal("stageUpgradeTarget" in runtime, false);
  await assert.rejects(import("@archie/runtime/dist/release-install/target-state.js"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
});

test("upgrade validates the current projection and APM ambiguity fails before writes", () => {
  const base = root();
  try {
    const selected = selectLocalRelease(bundle(base));
    const project = target(base);
    bootstrapTarget(project, selected);
    assert.throws(() => verifyPinnedTarget(project), /drifted|pinned Archie entry|unsupported shared/);
    const other = target(join(base, "other"));
    const before = readFileSync(join(other, "apm.yml"), "utf8");
    const skillSubset = selected.record.apm.skills.map(skill => `        - ${skill}`).join("\n");
    writeFileSync(join(other, "apm.yml"), before.replace("  mcp: []", `    - git: ${selected.record.apm.locator}\n      ref: v0\n      skills:\n${skillSubset}\n    - git: ${selected.record.apm.locator}\n      ref: v0\n      skills:\n${skillSubset}\n  mcp: []`));
    assert.throws(() => bootstrapTarget(other, selected), /ambiguous/);
    assert.equal(existsSync(join(other, ".archie/version")), false);
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
    assert.match(projection.manifest, /git@github\.com:don-smith\/archie\.git/);
    for (const skill of selected.record.apm.skills) assert.match(projection.manifest, new RegExp(`- ${skill}`));
    assert.equal(projection.lock, lock);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("APM deployment refuses a project whose targets omit agent-skills", () => {
  const manifest = [
    "name: consumer", "version: 1.0.0", "targets:", "  - claude",
    "dependencies:", "  apm: []", "  mcp: []", "includes: auto", "scripts: {}", ""
  ].join("\n");
  assert.throws(() => assertAgentSkillsTarget(manifest), /agent-skills APM target, which this project's apm\.yml does not list \(targets: claude\)/);
  assert.doesNotThrow(() => assertAgentSkillsTarget(manifest.replace("  - claude", "  - claude\n  - agent-skills")));
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { RELEASE_RECORD_FILE, selectLocalRelease } from "../../../dist/packages/archie-runtime/src/index.js";
import { bootstrapAndVerifyTarget, ReleaseInstallFailure, upgradeAndVerifyTarget } from "../../../dist/packages/archie-runtime/src/release-install/verify.js";
import { finalizedBundle, fixture, installRunner } from "../../support/release-bundle.mjs";

function root() { return mkdtempSync(join(tmpdir(), "archie-recovery-")); }
function bundle(base) { return finalizedBundle(base); }

const installedRunner = installRunner();

test("records failure and restores a bootstrap target when native work fails", () => {
  const base = root();
  try {
    const target = join(base, "target"); mkdirSync(target); writeFileSync(join(target, "apm.yml"), "dependencies:\n  apm: []\ndeployments: []\n"); writeFileSync(join(target, "apm.lock.yaml"), "dependencies:\n  apm: []\ndeployments: []\n");
    const originalManifest = readFileSync(join(target, "apm.yml"), "utf8");
    let failure;
    try { bootstrapAndVerifyTarget(target, selectLocalRelease(bundle(base)), { run: () => ({ exitCode: 9, stdout: "", stderr: "offline" }) }); } catch (error) { failure = error; }
    assert.ok(failure instanceof ReleaseInstallFailure);
    assert.equal(failure.report.compensation, "passed");
    assert.equal(readFileSync(join(target, "apm.yml"), "utf8"), originalManifest);
    assert.equal(readFileSync(join(target, ".archie", "release", "install-journal.json"), "utf8").includes("compensated"), true);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("upgrade rejects a broken installed target before it stages a replacement", () => {
  const base = root();
  try {
    const target = join(base, "target"); mkdirSync(target);
    const selected = selectLocalRelease(bundle(base));
    bootstrapAndVerifyTarget(target, selected, { run: installedRunner, verifyApmDeployment: () => undefined });
    const recordPath = join(target, ".archie", "release", RELEASE_RECORD_FILE);
    const before = readFileSync(recordPath, "utf8");
    const runtimeArtifact = selected.record.artifacts[0];
    writeFileSync(join(target, ".archie", "runtime", "node_modules", runtimeArtifact.package, "package.json"), JSON.stringify({ name: runtimeArtifact.package, version: "0.0.0" }));
    assert.throws(() => upgradeAndVerifyTarget(target, selected, { verifyApmDeployment: () => undefined }), ReleaseInstallFailure);
    assert.equal(readFileSync(recordPath, "utf8"), before);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("upgrade rejects modified deployed skill bytes before staging", () => {
  const base = root();
  try {
    const target = join(base, "target"); mkdirSync(target);
    const selected = selectLocalRelease(bundle(base));
    bootstrapAndVerifyTarget(target, selected, { run: installedRunner, verifyApmDeployment: () => undefined });
    const deployedFiles = selected.record.apm.skills.map((skill) => `.agents/skills/${skill}/SKILL.md`);
    for (const relativePath of deployedFiles) {
      const path = join(target, relativePath); mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, `${relativePath}\n`);
    }
    const deployed = [
      "  deployed_files:",
      ...selected.record.apm.skills.flatMap((skill) => [`  - .agents/skills/${skill}`, `  - .agents/skills/${skill}/SKILL.md`]),
      "  deployed_file_hashes:",
      ...deployedFiles.map((relativePath) => `    ${relativePath}: sha256:${createHash("sha256").update(readFileSync(join(target, relativePath))).digest("hex")}`)
    ].join("\n");
    const lockPath = join(target, "apm.lock.yaml");
    writeFileSync(lockPath, readFileSync(join(fixture, "apm", "apm.lock.yaml"), "utf8").replace("  content_hash:", `${deployed}\n  content_hash:`));
    writeFileSync(join(target, deployedFiles[0]), "tampered\n");
    const recordPath = join(target, ".archie", "release", RELEASE_RECORD_FILE);
    const before = readFileSync(recordPath, "utf8");
    let calls = 0;
    assert.throws(() => upgradeAndVerifyTarget(target, selected, { run: () => { calls += 1; return { exitCode: 9, stdout: "", stderr: "must not run" }; } }), ReleaseInstallFailure);
    assert.equal(calls, 0);
    assert.equal(readFileSync(recordPath, "utf8"), before);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test("restores and revalidates the former installed target after native failure", () => {
  const base = root();
  try {
    const target = join(base, "target"); mkdirSync(target);
    const selected = selectLocalRelease(bundle(base));
    bootstrapAndVerifyTarget(target, selected, { run: installedRunner, verifyApmDeployment: () => undefined });
    const installed = join(target, ".archie", "runtime", "node_modules", selected.record.artifacts[0].package, "package.json");
    const before = readFileSync(installed, "utf8");
    let deploymentChecks = 0;
    assert.throws(() => upgradeAndVerifyTarget(target, selected, {
      run: () => ({ exitCode: 2, stdout: "", stderr: "offline" }),
      verifyApmDeployment: () => { deploymentChecks += 1; }
    }), ReleaseInstallFailure);
    assert.equal(readFileSync(installed, "utf8"), before);
    assert.ok(existsSync(join(target, ".archie", "runtime", "node_modules", ".bin", "architecture-docs")), "compensation restores binary links");
    assert.equal(deploymentChecks, 16, "all eight skills are checked before staging and after compensation");
  } finally { rmSync(base, { recursive: true, force: true }); }
});

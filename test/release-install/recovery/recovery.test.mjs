import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { finalizeRelease } from "../../../dist/packages/archie-runtime/src/release-record/release-record-v1.js";
import { selectLocalRelease } from "../../../dist/packages/archie-runtime/src/release-install/selection.js";
import { bootstrapAndVerifyTarget, ReleaseInstallFailure, upgradeAndVerifyTarget } from "../../../dist/packages/archie-runtime/src/release-install/verify.js";

const fixture = "test/fixtures/private-bundles/valid";
const provenance = "packages/archie-runtime/vendor/html-design.provenance.json";
function root() { return mkdtempSync(join(tmpdir(), "archie-recovery-")); }
function bundle(base) { const path = join(base, "bundle"); cpSync(fixture, path, { recursive: true }); finalizeRelease({ bundleDirectory: path, sourceCommit: "abcdef0123456789abcdef0123456789abcdef01", htmlProvenancePath: provenance }); return path; }

function installedRunner({ command, cwd }) { if (command === "npm") { const record = JSON.parse(readFileSync(join(cwd, "..", "release", "release-record-v1.json"), "utf8")); const installed = join(cwd, "node_modules", record.npm.package); mkdirSync(installed, { recursive: true }); writeFileSync(join(installed, "package.json"), JSON.stringify({ name: record.npm.package, version: record.npm.version })); } return { exitCode: 0, stdout: "policy applied", stderr: "" }; }

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

test("restores the former upgrade runtime and pin after native failure", () => {
  const base = root();
  try {
    const target = join(base, "target"); mkdirSync(target);
    const selected = selectLocalRelease(bundle(base));
    bootstrapAndVerifyTarget(target, selected, { run: installedRunner, verifyHtml: () => undefined, verifyApmDeployment: () => undefined });
    const installed = join(target, ".archie", "runtime", "node_modules", selected.record.npm.package, "package.json");
    const before = readFileSync(installed, "utf8");
    assert.throws(() => upgradeAndVerifyTarget(target, selected, { run: () => ({ exitCode: 2, stdout: "", stderr: "offline" }) }), ReleaseInstallFailure);
    assert.equal(readFileSync(installed, "utf8"), before);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

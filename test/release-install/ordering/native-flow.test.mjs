import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { finalizeRelease } from "../../../dist/packages/archie-runtime/src/release-record/release-record-v1.js";
import { selectLocalRelease } from "../../../dist/packages/archie-runtime/src/release-install/selection.js";
import { bootstrapAndVerifyTarget, verifyInstalledTarget } from "../../../dist/packages/archie-runtime/src/release-install/verify.js";

const fixture = "test/fixtures/private-bundles/valid";
const provenance = "packages/archie-runtime/vendor/html-design.provenance.json";
const sourceCommit = "abcdef0123456789abcdef0123456789abcdef01";
function root() { return mkdtempSync(join(tmpdir(), "archie-native-flow-")); }
function bundle(base) { const path = join(base, "bundle"); cpSync(fixture, path, { recursive: true }); finalizeRelease({ bundleDirectory: path, sourceCommit, htmlProvenancePath: provenance }); return path; }
function target(base) { const path = join(base, "target"); mkdirSync(path, { recursive: true }); return path; }
function successfulRunner(calls) { return ({ command, args, cwd }) => { calls.push([command, ...args]); if (command === "npm") { const record = JSON.parse(readFileSync(join(cwd, "..", "release", "release-record-v1.json"), "utf8")); const installed = join(cwd, "node_modules", record.npm.package); mkdirSync(installed, { recursive: true }); writeFileSync(join(installed, "package.json"), JSON.stringify({ name: record.npm.package, version: record.npm.version })); } return { exitCode: 0, stdout: command === "apm" && args[0] === "policy" ? "policy applied" : "clean", stderr: "" }; }; }

const options = (calls) => ({ run: successfulRunner(calls), verifyHtml: () => undefined, verifyApmDeployment: () => undefined });

test("runs native checks in the required order and reports non-authorization", () => {
  const base = root();
  try {
    const calls = [];
    const result = bootstrapAndVerifyTarget(target(base), selectLocalRelease(bundle(base)), options(calls));
    assert.deepEqual(calls, [["npm", "ci", "--ignore-scripts"], ["apm", "install", "--frozen"], ["apm", "audit", "--ci", "--no-policy"], ["apm", "policy", "status"], ["apm", "audit", "--ci"]]);
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
    writeFileSync(join(project, ".archie", "runtime", "npm", selected.tarballName), "changed");
    assert.throws(() => verifyInstalledTarget(project, options(calls)), /tarball differs/);
    assert.equal(calls.length, callsAfterBootstrap);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

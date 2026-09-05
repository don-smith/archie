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
function root() { return mkdtempSync(join(tmpdir(), "archie-policy-")); }
function pinned(base) { const bundle = join(base, "bundle"); cpSync(fixture, bundle, { recursive: true }); finalizeRelease({ bundleDirectory: bundle, sourceCommit: "abcdef0123456789abcdef0123456789abcdef01", htmlProvenancePath: provenance }); const target = join(base, "target"); mkdirSync(target); bootstrapTarget(target, selectLocalRelease(bundle)); return target; }
function runner(policyStatus, policyAudit = 0) { return ({ command, args, cwd }) => { if (command === "npm") { const record = JSON.parse(readFileSync(join(cwd, "..", "release", "release-record-v1.json"), "utf8")); const installed = join(cwd, "node_modules", record.npm.package); mkdirSync(installed, { recursive: true }); writeFileSync(join(installed, "package.json"), JSON.stringify({ name: record.npm.package, version: record.npm.version })); } return command === "apm" && args[0] === "policy" ? policyStatus : command === "apm" && args.join(" ") === "audit --ci" ? { exitCode: policyAudit, stdout: "policy audit", stderr: "blocked" } : { exitCode: 0, stdout: "ok", stderr: "" }; }; }
const html = () => undefined;

test("keeps a no-policy baseline pass distinct from a policy pass", () => { const base = root(); try { const report = verifyInstalledTarget(pinned(base), { run: runner({ exitCode: 0, stdout: "No policy configured", stderr: "" }), verifyHtml: html, verifyApmDeployment: () => undefined }); assert.equal(report.apm.baseline, "passed"); assert.equal(report.apm.policy, "not-applied"); } finally { rmSync(base, { recursive: true, force: true }); } });
test("reports an applied policy block without relabelling baseline success", () => { const base = root(); try { const report = verifyInstalledTarget(pinned(base), { run: runner({ exitCode: 0, stdout: "policy applied", stderr: "" }, 2), verifyHtml: html, verifyApmDeployment: () => undefined }); assert.equal(report.apm.baseline, "passed"); assert.equal(report.apm.policy, "blocked"); } finally { rmSync(base, { recursive: true, force: true }); } });

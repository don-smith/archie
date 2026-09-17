import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { selectLocalRelease } from "../../../dist/packages/archie-runtime/src/index.js";
import { finalizedBundle, installRunner } from "../../support/release-bundle.mjs";
import { bootstrapTarget } from "../../../dist/packages/archie-runtime/src/release-install/target-state.js";
import { verifyInstalledTarget } from "../../../dist/packages/archie-runtime/src/release-install/verify.js";

function root() { return mkdtempSync(join(tmpdir(), "archie-policy-")); }
function pinned(base) { const bundle = finalizedBundle(base); const target = join(base, "target"); mkdirSync(target); bootstrapTarget(target, selectLocalRelease(bundle)); writeFileSync(join(target, "apm.lock.yaml"), readFileSync(join(bundle, "apm", "apm.lock.yaml"), "utf8")); return target; }
function runner(policyStatus, policyAudit = 0) { return installRunner({ policyStatus, policyAudit }); }

test("keeps a no-policy baseline pass distinct from a policy pass", () => { const base = root(); try { const report = verifyInstalledTarget(pinned(base), { run: runner({ exitCode: 0, stdout: "No policy configured", stderr: "" }), verifyApmDeployment: () => undefined }); assert.equal(report.apm.baseline, "passed"); assert.equal(report.apm.policy, "not-applied"); } finally { rmSync(base, { recursive: true, force: true }); } });
test("reports an applied policy block without relabelling baseline success", () => { const base = root(); try { const report = verifyInstalledTarget(pinned(base), { run: runner({ exitCode: 0, stdout: "policy applied", stderr: "" }, 2), verifyApmDeployment: () => undefined }); assert.equal(report.apm.baseline, "passed"); assert.equal(report.apm.policy, "blocked"); } finally { rmSync(base, { recursive: true, force: true }); } });

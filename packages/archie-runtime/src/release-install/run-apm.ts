import { assertPinnedApmProjection } from "./apm-projection.js";
import type { PinnedTarget } from "./target-state.js";
import type { ReleaseRecordV1 } from "../release-record/release-record-v1.js";
import type { CheckStatus } from "./report.js";
import { requireNative, type NativeCommandResult, type NativeCommandRunner } from "./run-npm.js";

function policyStatus(result: NativeCommandResult): "passed" | "not-applied" | "undetermined" {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
  if (result.exitCode !== 0) return "undetermined";
  if (/no policy|not applied|not configured|unavailable/.test(output)) return "not-applied";
  return "passed";
}
export interface ApmCheckResult { frozen: CheckStatus; baseline: CheckStatus; policy: CheckStatus; content: CheckStatus; }
/** Native APM owns lockfile resolution and serialization for the staged manifest. */
export function generateApmLock(targetDirectory: string, run: NativeCommandRunner): void {
  requireNative(run, { command: "apm", args: ["lock"], cwd: targetDirectory }, "apm lock");
}
/** Runs APM's frozen install and keeps its baseline and organization-policy outcomes separate. */
export function runApmChecks(pin: PinnedTarget, run: NativeCommandRunner): ApmCheckResult {
  requireNative(run, { command: "apm", args: ["install", "--frozen"], cwd: pin.targetDirectory }, "apm install --frozen");
  requireNative(run, { command: "apm", args: ["audit", "--ci", "--no-policy"], cwd: pin.targetDirectory }, "APM no-policy baseline audit");
  const status = run({ command: "apm", args: ["policy", "status"], cwd: pin.targetDirectory });
  let policy: CheckStatus = policyStatus(status);
  if (policy === "passed") {
    const audit = run({ command: "apm", args: ["audit", "--ci"], cwd: pin.targetDirectory });
    policy = audit.exitCode === 0 ? "passed" : "blocked";
  }
  assertPinnedApmProjection(pin.record as ReleaseRecordV1, pin.apm);
  return { frozen: "passed", baseline: "passed", policy, content: "passed" };
}

import type { PinnedTarget } from "./target-state.js";
import type { CheckStatus } from "./report.js";
import { type NativeCommandRunner } from "./run-npm.js";
export interface ApmCheckResult {
    frozen: CheckStatus;
    baseline: CheckStatus;
    policy: CheckStatus;
    content: CheckStatus;
}
/** Native APM owns lockfile resolution and serialization for the staged manifest. */
export declare function generateApmLock(targetDirectory: string, run: NativeCommandRunner): void;
/** Runs APM's frozen install and keeps its baseline and organization-policy outcomes separate. */
export declare function runApmChecks(pin: PinnedTarget, run: NativeCommandRunner): ApmCheckResult;

import { type StagedTarget } from "./target-state.js";
import type { SelectedRelease } from "./selection.js";
import type { ReleaseRecordV1 } from "../release-record/release-record-v1.js";
import { type ReleaseInstallReport } from "./report.js";
import { type NativeCommandRunner } from "./run-npm.js";
export type { NativeCommand, NativeCommandResult, NativeCommandRunner } from "./run-npm.js";
export interface ReleaseInstallOptions {
    run?: NativeCommandRunner;
    /** Test and host seam for the immutable snapshot installed by the runtime package. */
    verifyHtml?: (root: string, expected: {
        digest: string;
        fileCount: number;
    }) => void;
    /** Test seam for APM deployment verification. Production checks every deployed skill file against the native lock. */
    verifyApmDeployment?: (root: string, record: ReleaseRecordV1) => void;
}
export declare class ReleaseVerificationFailure extends Error {
    readonly report: ReleaseInstallReport;
    readonly cause?: unknown;
    constructor(message: string, report: ReleaseInstallReport, cause?: unknown);
}
/** Validates the installed projection without allowing a package-manager command to repair it. */
export declare function verifyCurrentInstalledTarget(targetDirectory: string, options?: ReleaseInstallOptions): void;
/** Executes the native, pinned-state-only checks in their required order. */
export declare function verifyInstalledTarget(targetDirectory: string, options?: ReleaseInstallOptions): ReleaseInstallReport;
export declare class ReleaseInstallFailure extends Error {
    readonly report: ReleaseInstallReport;
    readonly cause?: unknown;
    constructor(message: string, report: ReleaseInstallReport, cause?: unknown);
}
export declare function bootstrapAndVerifyTarget(targetDirectory: string, selected: SelectedRelease, options?: ReleaseInstallOptions): StagedTarget & {
    report: ReleaseInstallReport;
};
export declare function upgradeAndVerifyTarget(targetDirectory: string, selected: SelectedRelease, options?: ReleaseInstallOptions): StagedTarget & {
    report: ReleaseInstallReport;
};

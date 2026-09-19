export type CheckStatus = "passed" | "failed" | "not-applied" | "undetermined" | "blocked" | "not-run";
export interface ReleaseInstallReport {
    authorization: "not-assessed";
    recordConsistency: CheckStatus;
    npm: CheckStatus;
    apm: {
        frozen: CheckStatus;
        baseline: CheckStatus;
        policy: CheckStatus;
        content: CheckStatus;
    };
    analyzerCompatibility: CheckStatus;
    /** The `.claude/skills` bridge: `not-applied` when the repository does not use Claude Code. */
    claudeSkills: CheckStatus;
    replay: CheckStatus;
    compensation: CheckStatus;
    failedPhase?: string;
}
export declare function initialInstallReport(): ReleaseInstallReport;
export declare function formatInstallReport(report: ReleaseInstallReport): string;

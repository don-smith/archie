export type CheckStatus = "passed" | "failed" | "not-applied" | "undetermined" | "blocked" | "not-run";

export interface ReleaseInstallReport {
  authorization: "not-assessed";
  recordConsistency: CheckStatus;
  npm: CheckStatus;
  apm: { frozen: CheckStatus; baseline: CheckStatus; policy: CheckStatus; content: CheckStatus };
  analyzerCompatibility: CheckStatus;
  replay: CheckStatus;
  compensation: CheckStatus;
  failedPhase?: string;
}

export function initialInstallReport(): ReleaseInstallReport {
  return {
    authorization: "not-assessed", recordConsistency: "passed", npm: "not-run",
    apm: { frozen: "not-run", baseline: "not-run", policy: "not-run", content: "not-run" },
    analyzerCompatibility: "passed", replay: "not-run", compensation: "not-run"
  };
}

export function formatInstallReport(report: ReleaseInstallReport): string {
  return [
    "Archie private release verification", "Archie authorization: NOT ASSESSED — locally reviewed private release selected.",
    `Record consistency: ${report.recordConsistency}`, `npm: ${report.npm}`,
    `APM frozen install: ${report.apm.frozen}`, `APM baseline audit: ${report.apm.baseline}`,
    `APM policy: ${report.apm.policy}`, `APM content: ${report.apm.content}`,
    `Analyzer compatibility: ${report.analyzerCompatibility}`,
    `Replay: ${report.replay}`, `Compensation: ${report.compensation}`,
    ...(report.failedPhase ? [`Failed phase: ${report.failedPhase}`] : [])
  ].join("\n");
}

export function initialInstallReport() {
    return {
        authorization: "not-assessed", recordConsistency: "passed", npm: "not-run",
        apm: { frozen: "not-run", baseline: "not-run", policy: "not-run", content: "not-run" },
        analyzerCompatibility: "passed", claudeSkills: "not-run", replay: "not-run", compensation: "not-run"
    };
}
export function formatInstallReport(report) {
    return [
        "Archie release verification", "Archie authorization: NOT ASSESSED — locally reviewed release selected.",
        `Record consistency: ${report.recordConsistency}`, `npm: ${report.npm}`,
        `APM frozen install: ${report.apm.frozen}`, `APM baseline audit: ${report.apm.baseline}`,
        `APM policy: ${report.apm.policy}`, `APM content: ${report.apm.content}`,
        `Analyzer compatibility: ${report.analyzerCompatibility}`,
        `Claude Code skills: ${report.claudeSkills}`,
        `Replay: ${report.replay}`, `Compensation: ${report.compensation}`,
        ...(report.failedPhase ? [`Failed phase: ${report.failedPhase}`] : [])
    ].join("\n");
}
//# sourceMappingURL=report.js.map
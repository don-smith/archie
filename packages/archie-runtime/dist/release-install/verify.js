import { existsSync } from "node:fs";
import { join } from "node:path";
import { verifyHtmlSnapshot } from "../html-snapshot/verify.js";
import { assertSupportedEnvironment } from "../analysis/contracts.js";
import { readPinnedTarget, bootstrapTarget, stageUpgradeTarget } from "./target-state.js";
import { initialInstallReport } from "./report.js";
import { beginInstallJournal, compensateInstall, updateInstallJournal } from "./journal.js";
import { assertInstalledNpm, nativeRun, runNpmCi } from "./run-npm.js";
import { generateApmLock, runApmChecks } from "./run-apm.js";
function paths(targetDirectory) {
    const runtime = join(targetDirectory, ".archie", "runtime");
    return { runtime, installedPackage: (name) => join(runtime, "node_modules", name) };
}
function verifyDeployedSkills(targetDirectory, record, verifyApmDeployment) {
    for (const skill of record.apm.skills)
        verifyApmDeployment(join(targetDirectory, ".agents", "skills", skill), record);
}
export class ReleaseVerificationFailure extends Error {
    report;
    cause;
    constructor(message, report, cause) {
        super(message);
        this.report = report;
        this.cause = cause;
        this.name = "ReleaseVerificationFailure";
    }
}
/** Validates the installed projection without allowing a package-manager command to repair it. */
export function verifyCurrentInstalledTarget(targetDirectory, options = {}) {
    const verifyHtml = options.verifyHtml ?? ((root, expected) => { verifyHtmlSnapshot(root, expected); });
    const verifyApmDeployment = options.verifyApmDeployment ?? ((root) => { if (!existsSync(root))
        throw new Error("APM deployed Archie projection is missing"); });
    assertSupportedEnvironment();
    const pin = readPinnedTarget(targetDirectory);
    assertInstalledNpm(pin);
    const p = paths(pin.targetDirectory);
    verifyHtml(join(p.installedPackage(pin.record.npm.package), "vendor", "html-design"), { digest: pin.record.htmlDesignSnapshot.digest.value, fileCount: pin.record.htmlDesignSnapshot.digest.fileCount });
    verifyDeployedSkills(pin.targetDirectory, pin.record, verifyApmDeployment);
}
/** Executes the native, pinned-state-only checks in their required order. */
export function verifyInstalledTarget(targetDirectory, options = {}) {
    const run = options.run ?? nativeRun;
    const verifyHtml = options.verifyHtml ?? ((root, expected) => { verifyHtmlSnapshot(root, expected); });
    const verifyApmDeployment = options.verifyApmDeployment ?? ((root) => { if (!existsSync(root))
        throw new Error("APM deployed Archie projection is missing after frozen install"); });
    const report = initialInstallReport();
    let phase = "preflight";
    try {
        // A record promises only the retained Darwin arm64 / Node 24 analyzer environment.
        assertSupportedEnvironment();
        // Before each package-manager operation, re-read the pinned record, projections, and tarball.
        let pin = readPinnedTarget(targetDirectory);
        const p = paths(pin.targetDirectory);
        phase = "npm";
        runNpmCi(pin, run);
        verifyHtml(join(p.installedPackage(pin.record.npm.package), "vendor", "html-design"), { digest: pin.record.htmlDesignSnapshot.digest.value, fileCount: pin.record.htmlDesignSnapshot.digest.fileCount });
        report.npm = "passed";
        report.html = "passed";
        pin = readPinnedTarget(targetDirectory);
        phase = "apm";
        report.apm = runApmChecks(pin, run);
        verifyDeployedSkills(pin.targetDirectory, pin.record, verifyApmDeployment);
        // Re-read after APM has deployed its projection and revalidate tracked bytes.
        pin = readPinnedTarget(targetDirectory);
        report.apm.content = "passed";
        report.replay = "passed";
        return report;
    }
    catch (failure) {
        report.failedPhase = phase;
        if (phase === "preflight")
            report.recordConsistency = "failed";
        throw new ReleaseVerificationFailure(`pinned release verification failed during ${phase}: ${failure instanceof Error ? failure.message : String(failure)}`, report, failure);
    }
}
export class ReleaseInstallFailure extends Error {
    report;
    cause;
    constructor(message, report, cause) {
        super(message);
        this.report = report;
        this.cause = cause;
        this.name = "ReleaseInstallFailure";
    }
}
function stageAndVerify(targetDirectory, skills, stage, previousPin, options) {
    const journal = beginInstallJournal(targetDirectory, skills);
    const report = initialInstallReport();
    let phase = "staging";
    try {
        updateInstallJournal(targetDirectory, journal, "staging");
        const staged = stage();
        phase = "native-verification";
        updateInstallJournal(targetDirectory, journal, "native-verification");
        generateApmLock(targetDirectory, options.run ?? nativeRun);
        const verified = verifyInstalledTarget(targetDirectory, options);
        updateInstallJournal(targetDirectory, journal, "completed");
        return { ...staged, report: verified };
    }
    catch (failure) {
        const failureReport = failure instanceof ReleaseVerificationFailure ? failure.report : report;
        failureReport.failedPhase ??= phase;
        if (phase === "staging")
            failureReport.recordConsistency = "failed";
        updateInstallJournal(targetDirectory, journal, "failed", failure);
        try {
            compensateInstall(targetDirectory, journal);
            if (previousPin)
                verifyCurrentInstalledTarget(targetDirectory, options);
            failureReport.compensation = "passed";
            updateInstallJournal(targetDirectory, journal, "compensated", failure);
        }
        catch (compensationFailure) {
            failureReport.compensation = "blocked";
            updateInstallJournal(targetDirectory, journal, "compensation-incomplete", compensationFailure);
            throw new ReleaseInstallFailure("release installation failed and compensation is incomplete", failureReport, compensationFailure);
        }
        throw new ReleaseInstallFailure("release installation failed; prior target state was restored", failureReport, failure);
    }
}
export function bootstrapAndVerifyTarget(targetDirectory, selected, options = {}) {
    return stageAndVerify(targetDirectory, selected.record.apm.skills, () => bootstrapTarget(targetDirectory, selected), false, options);
}
export function upgradeAndVerifyTarget(targetDirectory, selected, options = {}) {
    // Do not let staging overwrite a target whose installed runtime, HTML bytes, or deployed skill is already inconsistent.
    try {
        verifyCurrentInstalledTarget(targetDirectory, options);
    }
    catch (failure) {
        const report = initialInstallReport();
        report.failedPhase = "pre-upgrade-verification";
        throw new ReleaseInstallFailure("current installed target verification failed before upgrade staging", report, failure);
    }
    return stageAndVerify(targetDirectory, selected.record.apm.skills, () => stageUpgradeTarget(targetDirectory, selected), true, options);
}
//# sourceMappingURL=verify.js.map
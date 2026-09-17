import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { assertSupportedEnvironment } from "../analysis/contracts.js";
import { readPinnedTarget, bootstrapTarget, stageUpgradeTarget } from "./target-state.js";
import { initialInstallReport } from "./report.js";
import { beginInstallJournal, compensateInstall, updateInstallJournal } from "./journal.js";
import { assertInstalledNpm, nativeRun, runNpmCi } from "./run-npm.js";
import { generateApmLock, runApmChecks } from "./run-apm.js";
function deployedFiles(targetDirectory, record) {
    const files = [];
    const visit = (path) => {
        for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const child = join(path, entry.name);
            if (entry.isDirectory())
                visit(child);
            else if (entry.isFile())
                files.push(relative(targetDirectory, child).split(sep).join("/"));
            else
                throw new Error(`APM deployed Archie projection contains an unsupported entry: ${child}`);
        }
    };
    for (const skill of record.apm.skills)
        visit(join(targetDirectory, ".agents", "skills", skill));
    return files.sort();
}
function lockedDeploymentHashes(lock, record) {
    const hashes = new Map();
    const prefixes = record.apm.skills.map((skill) => `.agents/skills/${skill}/`);
    for (const match of lock.matchAll(/^\s+(\.agents\/skills\/[^:\r\n]+):\s+sha256:([a-f0-9]{64})\s*$/gm)) {
        const path = match[1];
        if (!prefixes.some((prefix) => path.startsWith(prefix)))
            continue;
        if (path.split("/").includes("..") || hashes.has(path))
            throw new Error("APM deployed Archie file hashes are malformed or duplicated");
        hashes.set(path, match[2]);
    }
    return hashes;
}
function verifyDeployedSkills(targetDirectory, record, lock, override) {
    if (override) {
        for (const skill of record.apm.skills)
            override(join(targetDirectory, ".agents", "skills", skill), record);
        return;
    }
    const actualFiles = deployedFiles(targetDirectory, record);
    const expectedHashes = lockedDeploymentHashes(lock, record);
    if (JSON.stringify([...expectedHashes.keys()].sort()) !== JSON.stringify(actualFiles))
        throw new Error("APM deployed Archie file coverage differs from the native lock");
    for (const path of actualFiles) {
        const actual = createHash("sha256").update(readFileSync(join(targetDirectory, path))).digest("hex");
        if (actual !== expectedHashes.get(path))
            throw new Error(`APM deployed Archie file differs from the native lock: ${path}`);
    }
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
    assertSupportedEnvironment();
    const pin = readPinnedTarget(targetDirectory);
    assertInstalledNpm(pin);
    verifyDeployedSkills(pin.targetDirectory, pin.record, pin.apm.lock, options.verifyApmDeployment);
}
/** Executes the native, pinned-state-only checks in their required order. */
export function verifyInstalledTarget(targetDirectory, options = {}) {
    const run = options.run ?? nativeRun;
    const report = initialInstallReport();
    let phase = "preflight";
    try {
        // A record promises only the retained Darwin arm64 / Node 24 analyzer environment.
        assertSupportedEnvironment();
        // Before each package-manager operation, re-read the pinned record, projections, and tarball.
        let pin = readPinnedTarget(targetDirectory);
        phase = "npm";
        runNpmCi(pin, run);
        report.npm = "passed";
        pin = readPinnedTarget(targetDirectory);
        phase = "apm";
        report.apm = runApmChecks(pin, run);
        // Re-read after APM has deployed its projection, then verify every pinned deployed file.
        pin = readPinnedTarget(targetDirectory);
        verifyDeployedSkills(pin.targetDirectory, pin.record, pin.apm.lock, options.verifyApmDeployment);
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
    // Do not let staging overwrite a target whose installed runtime or deployed skills are already inconsistent.
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
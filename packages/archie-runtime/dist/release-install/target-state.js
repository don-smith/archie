import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalize } from "../analysis/canonical-json.js";
import { parseReleaseRecordEvidence } from "../release-record/release-record-v2.js";
import { assertPinnedApmProjection, planApmProjection } from "./apm-projection.js";
import { npmProjection, tarballSha256, validateNpmProjection } from "./npm-projection.js";
const readOptional = (path) => existsSync(path) ? readFileSync(path, "utf8") : undefined;
function paths(targetDirectory) {
    const target = resolve(targetDirectory);
    const archie = join(target, ".archie");
    return {
        target, archie, release: join(archie, "release"), runtime: join(archie, "runtime"), runtimeNpm: join(archie, "runtime", "npm"),
        version: join(archie, "version"), record: join(archie, "release", "release-record-v1.json"), recordV2: join(archie, "release", "release-record-v2.json"), receipt: join(archie, "release", "selection-receipt.json"),
        manifest: join(archie, "runtime", "package.json"), lock: join(archie, "runtime", "package-lock.json"),
        apmManifest: join(target, "apm.yml"), apmLock: join(target, "apm.lock.yaml")
    };
}
function receipt(selected) {
    return `${canonicalize({ format: "archie-local-selection-receipt-v1", recordSha256: selected.recordSha256, selectedPath: selected.bundleDirectory, version: selected.record.version })}\n`;
}
export function readPinnedTarget(targetDirectory) {
    const p = paths(targetDirectory);
    for (const required of [p.version, p.manifest, p.lock, p.apmManifest, p.apmLock])
        if (!existsSync(required))
            throw new Error(`pinned target state is incomplete: ${required}`);
    if (!existsSync(p.record) && !existsSync(p.recordV2))
        throw new Error(`pinned target state is incomplete: ${p.record}`);
    if (existsSync(p.record) && existsSync(p.recordV2))
        throw new Error("pinned target contains duplicate release records");
    const recordPath = existsSync(p.recordV2) ? p.recordV2 : p.record;
    const recordBytes = readFileSync(recordPath, "utf8");
    const record = parseReleaseRecordEvidence(recordBytes);
    if (readFileSync(p.version, "utf8") !== `${record.version}\n`)
        throw new Error("target release pin differs from the pinned record");
    const npm = { manifest: readFileSync(p.manifest, "utf8"), lock: readFileSync(p.lock, "utf8") };
    validateNpmProjection(npm, record);
    if (record.schemaVersion === 2) {
        for (const artifact of record.artifacts) {
            const tarball = join(p.runtimeNpm, artifact.locator.replace(/^file:npm\//, ""));
            if (!existsSync(tarball) || tarballSha256(readFileSync(tarball)) !== artifact.tarballSha256)
                throw new Error(`target ${artifact.package} tarball differs from the pinned record`);
        }
    }
    else {
        const tarball = join(p.runtimeNpm, record.npm.locator.replace(/^file:npm\//, ""));
        if (!record.npm.locator.startsWith("file:npm/") || !existsSync(tarball) || tarballSha256(readFileSync(tarball)) !== record.npm.tarballSha256)
            throw new Error("target runtime tarball differs from the pinned record");
    }
    const apm = { manifest: readFileSync(p.apmManifest, "utf8"), lock: readFileSync(p.apmLock, "utf8") };
    assertPinnedApmProjection(record, apm);
    return { targetDirectory: p.target, record, recordBytes, npm, apm };
}
/** Stages only Archie-owned state and a safely merged APM projection. Native installation is deferred to Phase 5. */
export function stageSelectedRelease(targetDirectory, selected, previous) {
    const p = paths(targetDirectory);
    const existingManifest = readOptional(p.apmManifest);
    const existingLock = readOptional(p.apmLock);
    if ((existingManifest === undefined) !== (existingLock === undefined))
        throw new Error("APM target projection is incomplete; cannot safely preserve shared state");
    const generatedNpm = npmProjection(selected.record);
    const npm = { manifest: generatedNpm.manifest, lock: selected.record.schemaVersion === 2 ? generatedNpm.lock : selected.npmLockBytes };
    validateNpmProjection(npm, selected.record);
    const apm = planApmProjection(selected.record, { manifest: existingManifest, lock: existingLock }, previous);
    mkdirSync(p.release, { recursive: true });
    mkdirSync(p.runtimeNpm, { recursive: true });
    writeFileSync(p.version, `${selected.record.version}\n`);
    if (selected.record.schemaVersion === 2) {
        writeFileSync(p.recordV2, selected.recordBytes);
        if (existsSync(p.record))
            rmSync(p.record);
    }
    else {
        writeFileSync(p.record, selected.recordBytes);
        if (existsSync(p.recordV2))
            rmSync(p.recordV2);
    }
    writeFileSync(p.receipt, receipt(selected));
    writeFileSync(p.manifest, npm.manifest);
    writeFileSync(p.lock, npm.lock);
    if ("artifacts" in selected) {
        for (const artifact of selected.artifacts)
            copyFileSync(artifact.tarballPath, join(p.runtimeNpm, artifact.tarballName));
    }
    else
        copyFileSync(selected.tarballPath, join(p.runtimeNpm, selected.tarballName));
    writeFileSync(p.apmManifest, apm.manifest);
    // APM rejects an empty lockfile; only preserve an existing preimage until native `apm lock` replaces it.
    if (apm.lock !== undefined)
        writeFileSync(p.apmLock, apm.lock);
    return { targetDirectory: p.target, record: selected.record, recordBytes: selected.recordBytes, npm, apm: { ...apm, lock: apm.lock ?? "" }, selectionReceiptPath: p.receipt };
}
export function bootstrapTarget(targetDirectory, selected) {
    const p = paths(targetDirectory);
    if (existsSync(p.record) || existsSync(p.recordV2) || existsSync(p.version))
        throw new Error("target already has a release pin; use upgrade with an explicit local release");
    return stageSelectedRelease(targetDirectory, selected);
}
/** Internal staging step; the public upgrade flow verifies the installed target before calling this. */
export function stageUpgradeTarget(targetDirectory, selected) {
    const previous = readPinnedTarget(targetDirectory);
    return stageSelectedRelease(targetDirectory, selected, previous.record);
}
/** Verify deliberately has no release input: it can only inspect the target-owned pin. */
export function verifyPinnedTarget(targetDirectory) {
    return readPinnedTarget(targetDirectory);
}
//# sourceMappingURL=target-state.js.map
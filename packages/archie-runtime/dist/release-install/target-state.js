import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonicalize } from "../analysis/canonical-json.js";
import { parseReleaseRecord } from "../release-record/release-record-v1.js";
import { assertPinnedApmProjection, planApmProjection } from "./apm-projection.js";
import { npmProjection, tarballSha256, validateNpmProjection } from "./npm-projection.js";
const readOptional = (path) => existsSync(path) ? readFileSync(path, "utf8") : undefined;
function paths(targetDirectory) {
    const target = resolve(targetDirectory);
    const archie = join(target, ".archie");
    return {
        target, archie, release: join(archie, "release"), runtime: join(archie, "runtime"), runtimeNpm: join(archie, "runtime", "npm"),
        version: join(archie, "version"), record: join(archie, "release", "release-record-v1.json"), receipt: join(archie, "release", "selection-receipt.json"),
        manifest: join(archie, "runtime", "package.json"), lock: join(archie, "runtime", "package-lock.json"),
        apmManifest: join(target, "apm.yml"), apmLock: join(target, "apm.lock.yaml")
    };
}
function receipt(selected) {
    return `${canonicalize({ format: "archie-local-selection-receipt-v1", recordSha256: selected.recordSha256, selectedPath: selected.bundleDirectory, version: selected.record.version })}\n`;
}
export function readPinnedTarget(targetDirectory) {
    const p = paths(targetDirectory);
    for (const required of [p.version, p.record, p.manifest, p.lock, p.apmManifest, p.apmLock])
        if (!existsSync(required))
            throw new Error(`pinned target state is incomplete: ${required}`);
    const recordBytes = readFileSync(p.record, "utf8");
    const record = parseReleaseRecord(recordBytes);
    if (readFileSync(p.version, "utf8") !== `${record.version}\n`)
        throw new Error("target release pin differs from the pinned record");
    const npm = { manifest: readFileSync(p.manifest, "utf8"), lock: readFileSync(p.lock, "utf8") };
    validateNpmProjection(npm, record);
    const tarball = join(p.runtimeNpm, record.npm.locator.replace(/^file:npm\//, ""));
    if (!record.npm.locator.startsWith("file:npm/") || !existsSync(tarball) || tarballSha256(readFileSync(tarball)) !== record.npm.tarballSha256)
        throw new Error("target runtime tarball differs from the pinned record");
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
    const npm = npmProjection(selected.record);
    validateNpmProjection(npm, selected.record);
    const apm = planApmProjection(selected.record, { manifest: existingManifest, lock: existingLock }, previous);
    mkdirSync(p.release, { recursive: true });
    mkdirSync(p.runtimeNpm, { recursive: true });
    writeFileSync(p.version, `${selected.record.version}\n`);
    writeFileSync(p.record, selected.recordBytes);
    writeFileSync(p.receipt, receipt(selected));
    writeFileSync(p.manifest, npm.manifest);
    writeFileSync(p.lock, npm.lock);
    copyFileSync(selected.tarballPath, join(p.runtimeNpm, selected.tarballName));
    writeFileSync(p.apmManifest, apm.manifest);
    writeFileSync(p.apmLock, apm.lock);
    return { targetDirectory: p.target, record: selected.record, recordBytes: selected.recordBytes, npm, apm, selectionReceiptPath: p.receipt };
}
export function bootstrapTarget(targetDirectory, selected) {
    const p = paths(targetDirectory);
    if (existsSync(p.record) || existsSync(p.version))
        throw new Error("target already has a release pin; use upgrade with an explicit local release");
    return stageSelectedRelease(targetDirectory, selected);
}
export function upgradeTarget(targetDirectory, selected) {
    const previous = readPinnedTarget(targetDirectory);
    return stageSelectedRelease(targetDirectory, selected, previous.record);
}
/** Verify deliberately has no release input: it can only inspect the target-owned pin. */
export function verifyPinnedTarget(targetDirectory) {
    return readPinnedTarget(targetDirectory);
}
//# sourceMappingURL=target-state.js.map
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { ARCHIE_SKILLS, parseReleaseRecord, validateApmSourceEvidence, validateBundleLayout } from "../release-record/release-record-v1.js";
import { selectLocalReleaseV2 } from "../release-record/release-record-v2.js";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha512Integrity = (bytes) => `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
const object = (value, label) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error(`${label} must be an object`);
    return value;
};
const text = (value, label) => {
    if (typeof value !== "string" || !value)
        throw new Error(`${label} must be a non-empty string`);
    return value;
};
const exactKeys = (value, keys, label) => {
    if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort()))
        throw new Error(`${label} has unsupported or missing fields`);
};
const json = (path, label) => {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        throw new Error(`${label} is not valid JSON`);
    }
};
const skills = (value, label) => {
    if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(ARCHIE_SKILLS))
        throw new Error(`${label} must be the complete sorted Archie skill set`);
    return [...ARCHIE_SKILLS];
};
function bundleFile(root, entry) {
    if (!entry || entry.startsWith("/") || relative(root, resolve(root, entry)).startsWith(".."))
        throw new Error(`bundle path escapes its directory: ${entry}`);
    const path = resolve(root, entry);
    if (!existsSync(path) || !statSync(path).isFile())
        throw new Error(`bundle artifact is missing: ${entry}`);
    return path;
}
function bundleInput(root) {
    const value = object(json(join(root, "bundle.json"), "bundle input"), "bundle input");
    exactKeys(value, ["format", "npm", "apm"], "bundle input");
    if (value.format !== "archie-private-bundle-input-v1")
        throw new Error("bundle input has an unsupported format");
    const npm = object(value.npm, "bundle npm input");
    const apm = object(value.apm, "bundle APM input");
    exactKeys(npm, ["package", "version", "locator", "lockFile", "tarball", "requiredPlatformPayload"], "bundle npm input");
    exactKeys(apm, ["package", "skills", "locator", "ref", "manifest", "lockFile"], "bundle APM input");
    return {
        format: value.format,
        npm: { package: text(npm.package, "bundle npm package"), version: text(npm.version, "bundle npm version"), locator: text(npm.locator, "bundle npm locator"), lockFile: text(npm.lockFile, "bundle npm lockFile"), tarball: text(npm.tarball, "bundle npm tarball"), requiredPlatformPayload: text(npm.requiredPlatformPayload, "bundle npm requiredPlatformPayload") },
        apm: { package: text(apm.package, "bundle APM package"), skills: skills(apm.skills, "bundle APM skills"), locator: text(apm.locator, "bundle APM locator"), ref: text(apm.ref, "bundle APM ref"), manifest: text(apm.manifest, "bundle APM manifest"), lockFile: text(apm.lockFile, "bundle APM lockFile") }
    };
}
/** Selects a complete, already-finalized local bundle; it never resolves a release from a network source. */
export function selectLocalRelease(directory) {
    if (!directory || directory === "latest" || /^[a-z][a-z0-9+.-]*:\/\//i.test(directory))
        throw new Error("release selection must be an explicit local directory");
    let root = resolve(directory);
    if (existsSync(join(root, "bundle.json"))) {
        let format;
        try {
            format = JSON.parse(readFileSync(join(root, "bundle.json"), "utf8")).format;
        }
        catch {
            format = undefined;
        }
        if (format === "archie-private-bundle-input-v2")
            return selectLocalReleaseV2(directory);
    }
    if (!existsSync(root) || !statSync(root).isDirectory())
        throw new Error("release selection must be an existing local directory");
    validateBundleLayout(root);
    const recordPath = join(root, "release-record-v1.json");
    const receiptPath = join(root, "release-review.txt");
    if (!existsSync(recordPath) || !existsSync(receiptPath))
        throw new Error("release bundle is incomplete; final record and review receipt are required");
    const recordBytes = readFileSync(recordPath, "utf8");
    const record = parseReleaseRecord(recordBytes);
    if (!readFileSync(receiptPath, "utf8").includes("Archie authorization: NOT ASSESSED — locally reviewed private release selected."))
        throw new Error("release bundle review receipt does not state the non-authorization boundary");
    const input = bundleInput(root);
    const tarballPath = bundleFile(root, input.npm.tarball);
    if (record.npm.locator !== `file:npm/${basename(tarballPath)}`)
        throw new Error("selected bundle npm locator must identify its target-owned tarball");
    const tarball = readFileSync(tarballPath);
    const npmLockPath = bundleFile(root, input.npm.lockFile);
    const npmLockBytes = readFileSync(npmLockPath, "utf8");
    const lock = object(json(npmLockPath, "bundle npm lock"), "bundle npm lock");
    const packageLock = object(object(lock.packages, "bundle npm lock packages")[`node_modules/${record.npm.package}`], "bundle npm lock package");
    if (input.npm.package !== record.npm.package || input.npm.version !== record.npm.version || input.npm.locator !== record.npm.locator || input.npm.requiredPlatformPayload !== record.npm.requiredPlatformPayload || packageLock.integrity !== record.npm.lockIntegrity || sha512Integrity(tarball) !== record.npm.lockIntegrity || sha256(tarball) !== record.npm.tarballSha256)
        throw new Error("selected bundle npm evidence differs from its finalized record");
    if (input.apm.package !== record.apm.package || JSON.stringify(input.apm.skills) !== JSON.stringify(record.apm.skills) || input.apm.locator !== record.apm.locator || input.apm.ref !== record.apm.ref)
        throw new Error("selected bundle APM evidence differs from its finalized record");
    const manifest = readFileSync(bundleFile(root, input.apm.manifest), "utf8");
    const apmLock = readFileSync(bundleFile(root, input.apm.lockFile), "utf8");
    validateApmSourceEvidence(manifest, apmLock, record.apm);
    return { bundleDirectory: root, record, recordBytes, recordSha256: sha256(recordBytes), tarballPath, tarballName: basename(tarballPath), npmLockBytes };
}
//# sourceMappingURL=selection.js.map
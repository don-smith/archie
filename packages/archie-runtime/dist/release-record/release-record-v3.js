import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { canonicalize } from "../analysis/canonical-json.js";
import { SUPPORTED_ANALYZER } from "../analysis/contracts.js";
import { PRODUCT_VERSION } from "../product-version.js";
import { npmProjection, validateNpmProjection } from "../release-install/npm-projection.js";
import { inspectNpmTarball, normalizeRequiredPlatformPayload } from "../npm-tarball/inspect.js";
export const RELEASE_RECORD_SCHEMA_VERSION = 3;
export const RELEASE_RECORD_FILE = "release-record-v3.json";
export const BUNDLE_INPUT_FORMAT = "archie-private-bundle-input-v3";
export const LOCAL_REVIEW_CLAIM = "locally-reviewed-private-trial";
/** The complete, sorted set of skills an Archie release deploys through APM. */
export const ARCHIE_SKILLS = [
    "archie",
    "architecture-assessment",
    "architecture-conformance-onboarding",
    "architecture-contracts",
    "architecture-docs",
    "architecture-review",
    "html-design",
    "likec4-authoring"
];
export const RELEASE_ARTIFACT_PACKAGES = ["@archie/runtime", "@archie/conformance"];
const REVIEW_BOUNDARY = "Archie authorization: NOT ASSESSED — locally reviewed private release selected.";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha512Integrity = (bytes) => `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
const isSha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function object(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error(`${label} must be an object`);
    return value;
}
function text(value, label) {
    if (typeof value !== "string" || !value)
        throw new Error(`${label} must be a non-empty string`);
    return value;
}
function exactKeys(value, keys, label) {
    if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort()))
        throw new Error(`${label} has unsupported or missing fields`);
}
function parseJson(bytes, label) {
    try {
        return JSON.parse(bytes);
    }
    catch {
        throw new Error(`${label} is not valid JSON`);
    }
}
function skills(value, label) {
    if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(ARCHIE_SKILLS))
        throw new Error(`${label} must be the complete sorted Archie skill set`);
    return [...ARCHIE_SKILLS];
}
function stringMap(value, label) {
    const source = object(value, label);
    const result = {};
    for (const key of Object.keys(source).sort())
        result[key] = text(source[key], `${label}.${key}`);
    return result;
}
function within(root, file) {
    const path = resolve(root, file);
    if (relative(root, path).startsWith(".."))
        throw new Error(`bundle path escapes its directory: ${file}`);
    if (!existsSync(path) || !statSync(path).isFile())
        throw new Error(`bundle artifact is missing: ${file}`);
    return path;
}
function githubSshRepository(locator) {
    const repository = locator.match(/^git@github\.com:([^/]+\/[^/]+)\.git$/)?.[1];
    if (!repository)
        throw new Error("APM locator must be a GitHub SSH repository URL");
    return repository;
}
function bundleInput(root) {
    const value = object(parseJson(readFileSync(join(root, "bundle.json"), "utf8"), "bundle input"), "bundle input");
    exactKeys(value, ["format", "artifacts", "apm"], "bundle input");
    if (value.format !== BUNDLE_INPUT_FORMAT)
        throw new Error("bundle input has an unsupported format");
    if (!Array.isArray(value.artifacts) || value.artifacts.length !== RELEASE_ARTIFACT_PACKAGES.length)
        throw new Error("bundle input must contain exactly the runtime and conformance artifacts");
    const artifacts = value.artifacts.map((entry, index) => {
        const label = `bundle artifact ${index}`;
        const item = object(entry, label);
        exactKeys(item, ["package", "version", "locator", "lockFile", "tarball", "requiredPlatformPayload"], label);
        return {
            package: text(item.package, `${label} package`), version: text(item.version, `${label} version`), locator: text(item.locator, `${label} locator`),
            lockFile: text(item.lockFile, `${label} lockFile`), tarball: text(item.tarball, `${label} tarball`), requiredPlatformPayload: text(item.requiredPlatformPayload, `${label} requiredPlatformPayload`)
        };
    });
    const apm = object(value.apm, "bundle APM input");
    exactKeys(apm, ["package", "skills", "locator", "ref", "manifest", "lockFile"], "bundle APM input");
    return {
        format: BUNDLE_INPUT_FORMAT,
        artifacts,
        apm: {
            package: text(apm.package, "bundle APM package"), skills: skills(apm.skills, "bundle APM skills"), locator: text(apm.locator, "bundle APM locator"),
            ref: text(apm.ref, "bundle APM ref"), manifest: text(apm.manifest, "bundle APM manifest"), lockFile: text(apm.lockFile, "bundle APM lockFile")
        }
    };
}
function field(source, name, label) {
    const matches = [...source.matchAll(new RegExp(`^\\s*(?:-\\s*)?${name}:\\s*([^\\s]+)\\s*$`, "gm"))];
    if (matches.length !== 1)
        throw new Error(`${label} must contain exactly one ${name} field`);
    return matches[0][1];
}
function skillSubset(source, header, label) {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const index = lines.findIndex(line => line.trim() === `${header}:`);
    if (index < 0)
        throw new Error(`${label} is missing ${header}`);
    const values = [];
    for (const line of lines.slice(index + 1)) {
        if (/^\s*-\s+\S+\s*$/.test(line)) {
            values.push(line.trim().slice(2));
            continue;
        }
        if (line.trim())
            break;
    }
    return values;
}
function apmEvidence(root, input) {
    const manifest = readFileSync(within(root, input.manifest), "utf8");
    const lock = readFileSync(within(root, input.lockFile), "utf8");
    const repository = githubSshRepository(input.locator);
    if (field(manifest, "git", "APM manifest") !== input.locator || field(manifest, "ref", "APM manifest") !== input.ref)
        throw new Error("APM manifest differs from bundle input");
    if (JSON.stringify(skillSubset(manifest, "skills", "APM manifest")) !== JSON.stringify(input.skills))
        throw new Error("APM manifest skill subset differs from bundle input");
    if (field(lock, "name", "APM lock") !== input.package || field(lock, "repo_url", "APM lock") !== repository || field(lock, "host", "APM lock") !== "github.com")
        throw new Error("APM lock repository differs from bundle input");
    if (field(lock, "resolved_ref", "APM lock") !== input.ref)
        throw new Error("APM lock ref differs from bundle input");
    if (JSON.stringify(skillSubset(lock, "skill_subset", "APM lock")) !== JSON.stringify(input.skills))
        throw new Error("APM lock skill subset differs from bundle input");
    const resolvedCommit = field(lock, "resolved_commit", "APM lock");
    const contentHash = field(lock, "content_hash", "APM lock");
    if (!/^[a-f0-9]{40}$/i.test(resolvedCommit) || !/^sha256:[a-f0-9]{64}$/i.test(contentHash))
        throw new Error("APM lock evidence is malformed");
    return { package: input.package, skills: input.skills, locator: input.locator, ref: input.ref, resolvedCommit, contentHash };
}
function artifactEvidence(root, input) {
    if (!input.locator.startsWith("file:npm/") || input.locator.includes(".."))
        throw new Error("artifact locators must be target-owned local tarballs");
    const tarball = readFileSync(within(root, input.tarball));
    const inspected = inspectNpmTarball(tarball);
    const manifest = inspected.manifest;
    if (manifest.name !== input.package || manifest.version !== input.version)
        throw new Error("npm tarball package identity differs from bundle input");
    const requiredPlatformPayload = normalizeRequiredPlatformPayload(input.requiredPlatformPayload);
    if (!inspected.files.has(`package/${requiredPlatformPayload}`))
        throw new Error(`npm tarball omits required platform payload: ${requiredPlatformPayload}`);
    const lock = object(parseJson(readFileSync(within(root, input.lockFile), "utf8"), "npm lock"), "npm lock");
    const packageLock = object(object(lock.packages, "npm lock packages")[`node_modules/${input.package}`], `npm lock package ${input.package}`);
    if (packageLock.version !== input.version || packageLock.resolved !== input.locator || packageLock.integrity !== sha512Integrity(tarball))
        throw new Error("npm lock evidence does not match finalized tarball bytes");
    return {
        package: input.package, version: input.version, locator: input.locator, lockIntegrity: sha512Integrity(tarball), tarballSha256: sha256(tarball), requiredPlatformPayload,
        dependencies: stringMap(manifest.dependencies ?? {}, "artifact dependencies"), engines: stringMap(manifest.engines ?? {}, "artifact engines"), binaries: stringMap(manifest.bin ?? {}, "artifact binaries")
    };
}
function analyzer() {
    return { adapter: SUPPORTED_ANALYZER.adapter, typescript: SUPPORTED_ANALYZER.typeScript, nodeMajor: SUPPORTED_ANALYZER.nodeMajor, platform: SUPPORTED_ANALYZER.platform, architecture: SUPPORTED_ANALYZER.architecture, platformPackage: SUPPORTED_ANALYZER.platformPackage, knownDefects: [...SUPPORTED_ANALYZER.knownDefects] };
}
function validateArtifact(value, label) {
    const artifact = object(value, label);
    exactKeys(artifact, ["package", "version", "locator", "lockIntegrity", "tarballSha256", "requiredPlatformPayload", "dependencies", "engines", "binaries"], label);
    for (const key of ["package", "version", "locator", "lockIntegrity", "requiredPlatformPayload"])
        text(artifact[key], `${label}.${key}`);
    const locator = String(artifact.locator);
    if (!locator.startsWith("file:npm/") || locator.includes("..") || !String(artifact.lockIntegrity).startsWith("sha512-") || !isSha256(artifact.tarballSha256) || normalizeRequiredPlatformPayload(String(artifact.requiredPlatformPayload)) !== artifact.requiredPlatformPayload)
        throw new Error(`${label} evidence is malformed`);
    stringMap(artifact.dependencies, `${label}.dependencies`);
    stringMap(artifact.engines, `${label}.engines`);
    stringMap(artifact.binaries, `${label}.binaries`);
}
function validateRecord(record) {
    const value = record;
    exactKeys(value, ["schemaVersion", "product", "version", "sourceCommit", "authorization", "artifacts", "apm", "analyzerCompatibility"], "release record");
    if (record.schemaVersion !== RELEASE_RECORD_SCHEMA_VERSION || record.product !== "archie" || !record.version || !/^[a-f0-9]{40}$/i.test(String(record.sourceCommit)))
        throw new Error("unsupported or malformed release record");
    const authorization = object(record.authorization, "release record authorization");
    exactKeys(authorization, ["kind", "claim"], "release record authorization");
    if (authorization.kind !== "none" || authorization.claim !== LOCAL_REVIEW_CLAIM)
        throw new Error("release record authorization must be explicit local private review only");
    if (!Array.isArray(record.artifacts) || JSON.stringify(record.artifacts.map(artifact => artifact?.package)) !== JSON.stringify(RELEASE_ARTIFACT_PACKAGES) || record.artifacts.some(artifact => artifact?.version !== record.version))
        throw new Error("release record artifacts must be ordered runtime then conformance at the product version");
    record.artifacts.forEach(artifact => validateArtifact(artifact, "release record artifact"));
    const apm = object(record.apm, "release record APM");
    exactKeys(apm, ["package", "skills", "locator", "ref", "resolvedCommit", "contentHash"], "release record APM");
    text(apm.package, "release record APM package");
    githubSshRepository(text(apm.locator, "release record APM locator"));
    if (apm.ref !== `v${record.version}`)
        throw new Error("release record APM ref must be the immutable version tag");
    if (!/^[a-f0-9]{40}$/i.test(String(apm.resolvedCommit)) || !/^sha256:[a-f0-9]{64}$/i.test(String(apm.contentHash)))
        throw new Error("release record APM evidence is malformed");
    skills(apm.skills, "release record APM skills");
    if (canonicalize(record.analyzerCompatibility) !== canonicalize(analyzer()))
        throw new Error("release record has unsupported analyzer compatibility");
}
export function serializeReleaseRecord(record) {
    validateRecord(record);
    return `${canonicalize(record)}\n`;
}
/** The sole release evidence boundary used by selection, target verification, and consumers. */
export function parseReleaseRecord(bytes) {
    const value = object(parseJson(bytes, "release record"), "release record");
    if (value.schemaVersion !== RELEASE_RECORD_SCHEMA_VERSION)
        throw new Error(`unsupported release record schema version: ${String(value.schemaVersion)}; Archie now reads only release record v${RELEASE_RECORD_SCHEMA_VERSION}`);
    validateRecord(value);
    if (serializeReleaseRecord(value) !== bytes)
        throw new Error("release record bytes are not canonical");
    return value;
}
export function validateBundleLayout(bundleDirectory) {
    const root = resolve(bundleDirectory);
    const allowed = new Set(["bundle.json", "npm", "apm", RELEASE_RECORD_FILE, "release-review.txt"]);
    for (const entry of readdirSync(root))
        if (!allowed.has(entry))
            throw new Error(`bundle layout has an unsupported entry: ${entry}`);
    if (!existsSync(join(root, "bundle.json")) || !statSync(join(root, "bundle.json")).isFile())
        throw new Error("bundle layout is missing bundle.json");
    for (const required of ["npm", "apm"])
        if (!existsSync(join(root, required)) || !statSync(join(root, required)).isDirectory())
            throw new Error(`bundle layout is missing ${required}`);
}
export function finalizeRelease(request) {
    const root = resolve(request.bundleDirectory);
    validateBundleLayout(root);
    if (!/^[a-f0-9]{40}$/i.test(request.sourceCommit))
        throw new Error("sourceCommit must be a 40-character Git commit");
    const input = bundleInput(root);
    if (input.apm.ref !== `v${PRODUCT_VERSION}` || input.artifacts.some(artifact => artifact.version !== PRODUCT_VERSION))
        throw new Error("bundle version does not match the Archie product version authority");
    const artifacts = input.artifacts.map(artifact => artifactEvidence(root, artifact));
    if (JSON.stringify(artifacts.map(artifact => artifact.package)) !== JSON.stringify(RELEASE_ARTIFACT_PACKAGES))
        throw new Error("bundle artifacts must be ordered runtime then conformance");
    const record = {
        schemaVersion: RELEASE_RECORD_SCHEMA_VERSION, product: "archie", version: PRODUCT_VERSION, sourceCommit: request.sourceCommit,
        authorization: { kind: "none", claim: LOCAL_REVIEW_CLAIM }, artifacts, apm: apmEvidence(root, input.apm), analyzerCompatibility: analyzer()
    };
    const bundledLock = readFileSync(within(root, input.artifacts[0].lockFile), "utf8");
    const generatedNpm = npmProjection(record);
    if (bundledLock !== generatedNpm.lock)
        throw new Error("bundle npm lock differs from the exact generated projection");
    validateNpmProjection({ manifest: generatedNpm.manifest, lock: bundledLock }, record);
    const bytes = serializeReleaseRecord(record);
    const recordSha256 = sha256(bytes);
    const receipt = [
        "Archie private release review receipt", `Product: ${record.product}@${record.version}`, `Record SHA-256: ${recordSha256}`, "Bundle layout: valid",
        `Artifacts: ${RELEASE_ARTIFACT_PACKAGES.join(", ")}`, `Skills: ${record.apm.skills.join(", ")}`, REVIEW_BOUNDARY,
        "This receipt reports finalized-byte consistency only. Signing, public-release trust, controller distribution, and key operations are deferred.", ""
    ].join("\n");
    const recordPath = join(root, RELEASE_RECORD_FILE);
    const receiptPath = join(root, "release-review.txt");
    writeFileSync(recordPath, bytes);
    writeFileSync(receiptPath, receipt);
    return { record, recordPath, receiptPath, recordSha256 };
}
/** Selects a complete, already-finalized local bundle; it never resolves a release from a network source. */
export function selectLocalRelease(directory) {
    if (!directory || directory === "latest" || /^[a-z][a-z0-9+.-]*:\/\//i.test(directory))
        throw new Error("release selection must be an explicit local directory");
    const root = resolve(directory);
    if (!existsSync(root) || !statSync(root).isDirectory())
        throw new Error("release selection must be an existing local directory");
    validateBundleLayout(root);
    const recordPath = join(root, RELEASE_RECORD_FILE), receiptPath = join(root, "release-review.txt");
    if (!existsSync(recordPath) || !statSync(recordPath).isFile() || !existsSync(receiptPath) || !statSync(receiptPath).isFile())
        throw new Error("release bundle is incomplete; final record and review receipt are required");
    const recordBytes = readFileSync(recordPath, "utf8");
    const record = parseReleaseRecord(recordBytes);
    if (!readFileSync(receiptPath, "utf8").includes(REVIEW_BOUNDARY))
        throw new Error("release bundle review receipt does not state the non-authorization boundary");
    const input = bundleInput(root);
    const artifacts = input.artifacts.map((inputArtifact, index) => {
        const artifact = record.artifacts[index];
        const tarballPath = within(root, inputArtifact.tarball);
        const tarball = readFileSync(tarballPath);
        const tarballName = tarballPath.split(/[\\/]/).pop();
        const lock = object(parseJson(readFileSync(within(root, inputArtifact.lockFile), "utf8"), "npm lock"), "npm lock");
        const packageLock = object(object(lock.packages, "npm lock packages")[`node_modules/${artifact.package}`], "npm lock package");
        if (inputArtifact.package !== artifact.package || inputArtifact.version !== artifact.version || inputArtifact.locator !== artifact.locator || artifact.locator !== `file:npm/${tarballName}` || packageLock.integrity !== artifact.lockIntegrity || packageLock.resolved !== artifact.locator || sha512Integrity(tarball) !== artifact.lockIntegrity || sha256(tarball) !== artifact.tarballSha256)
            throw new Error("selected bundle artifact evidence differs from its finalized record");
        return { record: artifact, tarballPath, tarballName };
    });
    const npmLockBytes = readFileSync(within(root, input.artifacts[0].lockFile), "utf8");
    const generatedNpm = npmProjection(record);
    if (npmLockBytes !== generatedNpm.lock)
        throw new Error("selected bundle npm lock differs from the exact generated projection");
    validateNpmProjection({ manifest: generatedNpm.manifest, lock: npmLockBytes }, record);
    if (canonicalize(apmEvidence(root, input.apm)) !== canonicalize(record.apm))
        throw new Error("selected bundle APM evidence differs from its finalized record");
    return { bundleDirectory: root, record, recordBytes, recordSha256: sha256(recordBytes), artifacts, npmLockBytes };
}
//# sourceMappingURL=release-record-v3.js.map
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { canonicalize } from "../analysis/canonical-json.js";
import { SUPPORTED_ANALYZER } from "../analysis/contracts.js";
import { PRODUCT_VERSION } from "../product-version.js";
import { validateHtmlSnapshotProvenance } from "../html-snapshot/verify.js";
import { ARCHIE_SKILLS, LOCAL_REVIEW_CLAIM, parseReleaseRecord as parseReleaseRecordV1 } from "./release-record-v1.js";
import { npmProjection, validateNpmProjection } from "../release-install/npm-projection.js";
import { inspectNpmTarball, normalizeRequiredPlatformPayload } from "../npm-tarball/inspect.js";
export const RELEASE_RECORD_SCHEMA_VERSION_V2 = 2;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha512Integrity = (bytes) => `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
const object = (value, label) => { if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`); return value; };
const text = (value, label) => { if (typeof value !== "string" || !value)
    throw new Error(`${label} must be a non-empty string`); return value; };
const exactKeys = (value, keys, label) => { if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort()))
    throw new Error(`${label} has unsupported or missing fields`); };
const parseJson = (bytes, label) => { try {
    return JSON.parse(bytes);
}
catch {
    throw new Error(`${label} is not valid JSON`);
} };
const isSha256 = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const skills = (value, label) => { if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(ARCHIE_SKILLS))
    throw new Error(`${label} must be the complete ordered Archie skill set`); return [...ARCHIE_SKILLS]; };
const map = (value, label) => { const source = object(value, label); const result = {}; for (const key of Object.keys(source).sort())
    result[key] = text(source[key], `${label}.${key}`); return result; };
function within(root, file) { const path = resolve(root, file); if (relative(root, path).startsWith("..") || !existsSync(path) || !statSync(path).isFile())
    throw new Error(`bundle artifact is missing: ${file}`); return path; }
function bundleInput(root) {
    const value = object(parseJson(readFileSync(join(root, "bundle.json"), "utf8"), "bundle input"), "bundle input");
    exactKeys(value, ["format", "artifacts", "apm"], "bundle input");
    if (value.format !== "archie-private-bundle-input-v2")
        throw new Error("bundle input has an unsupported format");
    if (!Array.isArray(value.artifacts) || value.artifacts.length !== 2)
        throw new Error("bundle v2 must contain exactly two artifacts");
    const artifacts = value.artifacts.map((entry, index) => { const item = object(entry, `bundle artifact ${index}`); exactKeys(item, ["package", "version", "locator", "lockFile", "tarball", "requiredPlatformPayload"], `bundle artifact ${index}`); return { package: text(item.package, `bundle artifact ${index} package`), version: text(item.version, `bundle artifact ${index} version`), locator: text(item.locator, `bundle artifact ${index} locator`), lockFile: text(item.lockFile, `bundle artifact ${index} lockFile`), tarball: text(item.tarball, `bundle artifact ${index} tarball`), requiredPlatformPayload: text(item.requiredPlatformPayload, `bundle artifact ${index} requiredPlatformPayload`) }; });
    const apm = object(value.apm, "bundle APM input");
    exactKeys(apm, ["package", "skills", "locator", "ref", "manifest", "lockFile"], "bundle APM input");
    return { format: "archie-private-bundle-input-v2", artifacts, apm: { package: text(apm.package, "bundle APM package"), skills: skills(apm.skills, "bundle APM skills"), locator: text(apm.locator, "bundle APM locator"), ref: text(apm.ref, "bundle APM ref"), manifest: text(apm.manifest, "bundle APM manifest"), lockFile: text(apm.lockFile, "bundle APM lockFile") } };
}
function field(textValue, name, label) { const matches = [...textValue.matchAll(new RegExp(`^\\s*(?:-\\s*)?${name}:\\s*([^\\s]+)\\s*$`, "gm"))]; if (matches.length !== 1)
    throw new Error(`${label} must contain exactly one ${name} field`); return matches[0][1]; }
function skillSubset(textValue, header) { const lines = textValue.replace(/\r\n/g, "\n").split("\n"); const index = lines.findIndex(line => line.trim() === `${header}:`); if (index < 0)
    throw new Error(`APM evidence is missing ${header}`); const values = []; for (const line of lines.slice(index + 1)) {
    if (/^\s*-\s+\S+\s*$/.test(line))
        values.push(line.trim().slice(2));
    else if (line.trim())
        break;
} return values; }
function apmEvidence(root, input) { const manifest = readFileSync(within(root, input.manifest), "utf8"); const lock = readFileSync(within(root, input.lockFile), "utf8"); const repo = input.locator.match(/^git@github\.com:([^/]+\/[^/]+)\.git$/)?.[1]; if (!repo)
    throw new Error("APM locator must be a GitHub SSH repository URL"); if (field(manifest, "git", "APM manifest") !== input.locator || field(manifest, "ref", "APM manifest") !== input.ref || JSON.stringify(skillSubset(manifest, "skills")) !== JSON.stringify(input.skills))
    throw new Error("APM manifest differs from bundle input"); if (field(lock, "repo_url", "APM lock") !== repo || field(lock, "resolved_ref", "APM lock") !== input.ref || field(lock, "name", "APM lock") !== input.package || JSON.stringify(skillSubset(lock, "skill_subset")) !== JSON.stringify(input.skills))
    throw new Error("APM lock differs from bundle input"); const resolvedCommit = field(lock, "resolved_commit", "APM lock"), contentHash = field(lock, "content_hash", "APM lock"); if (!/^[a-f0-9]{40}$/i.test(resolvedCommit) || !/^sha256:[a-f0-9]{64}$/i.test(contentHash))
    throw new Error("APM lock evidence is malformed"); return { package: input.package, skills: input.skills, locator: input.locator, ref: input.ref, resolvedCommit, contentHash }; }
function artifactEvidence(root, input) { if (!input.locator.startsWith("file:npm/") || input.locator.includes(".."))
    throw new Error("v2 artifact locators must be target-owned local tarballs"); const tarball = readFileSync(within(root, input.tarball)); const inspected = inspectNpmTarball(tarball), manifest = inspected.manifest; if (manifest.name !== input.package || manifest.version !== input.version)
    throw new Error("npm tarball package identity differs from bundle input"); const requiredPlatformPayload = normalizeRequiredPlatformPayload(input.requiredPlatformPayload); if (!inspected.files.has(`package/${requiredPlatformPayload}`))
    throw new Error(`npm tarball omits required platform payload: ${requiredPlatformPayload}`); const lock = object(parseJson(readFileSync(within(root, input.lockFile), "utf8"), "npm lock"), "npm lock"); const packages = object(lock.packages, "npm lock packages"); const packageLock = object(packages[`node_modules/${input.package}`], `npm lock package ${input.package}`); if (packageLock.version !== input.version || packageLock.resolved !== input.locator || packageLock.integrity !== sha512Integrity(tarball))
    throw new Error("npm lock evidence does not match finalized tarball bytes"); const dependencies = map(manifest.dependencies ?? {}, "artifact dependencies"), engines = map(manifest.engines ?? {}, "artifact engines"), binaries = map(manifest.bin ?? {}, "artifact binaries"); return { package: input.package, version: input.version, locator: input.locator, lockIntegrity: sha512Integrity(tarball), tarballSha256: sha256(tarball), requiredPlatformPayload, dependencies, engines, binaries }; }
function analyzer() { return { adapter: SUPPORTED_ANALYZER.adapter, typescript: SUPPORTED_ANALYZER.typeScript, nodeMajor: SUPPORTED_ANALYZER.nodeMajor, platform: SUPPORTED_ANALYZER.platform, architecture: SUPPORTED_ANALYZER.architecture, platformPackage: SUPPORTED_ANALYZER.platformPackage, knownDefects: [...SUPPORTED_ANALYZER.knownDefects] }; }
function validateHtml(value) { validateHtmlSnapshotProvenance(value); const html = object(value, "release record HTML snapshot"); exactKeys(html, ["format", "upstream", "commit", "sourcePath", "gitTree", "digest", "license", "requiredNotices", "importToolVersion", "verificationCommand"], "release record HTML snapshot"); }
function validateArtifact(value, label) { const artifact = object(value, label); exactKeys(artifact, ["package", "version", "locator", "lockIntegrity", "tarballSha256", "requiredPlatformPayload", "dependencies", "engines", "binaries"], label); for (const key of ["package", "version", "locator", "lockIntegrity", "requiredPlatformPayload"])
    text(artifact[key], `${label}.${key}`); if (!String(artifact.locator).startsWith("file:npm/") || String(artifact.locator).includes("..") || !/^sha512-/.test(String(artifact.lockIntegrity)) || !isSha256(artifact.tarballSha256) || normalizeRequiredPlatformPayload(String(artifact.requiredPlatformPayload)) !== artifact.requiredPlatformPayload)
    throw new Error(`${label} evidence is malformed`); map(artifact.dependencies, `${label}.dependencies`); map(artifact.engines, `${label}.engines`); map(artifact.binaries, `${label}.binaries`); }
export function serializeReleaseRecordV2(record) { validateRecord(record); return `${canonicalize(record)}\n`; }
function validateRecord(record) { const value = record; exactKeys(value, ["schemaVersion", "product", "version", "sourceCommit", "authorization", "artifacts", "apm", "analyzerCompatibility", "htmlDesignSnapshot"], "release record v2"); if (record.schemaVersion !== 2 || record.product !== "archie" || !/^[a-f0-9]{40}$/i.test(record.sourceCommit) || !record.version)
    throw new Error("unsupported or malformed release record v2"); const authorization = object(record.authorization, "release record authorization"); exactKeys(authorization, ["kind", "claim"], "release record authorization"); if (authorization.kind !== "none" || authorization.claim !== LOCAL_REVIEW_CLAIM)
    throw new Error("release record authorization must be explicit local private review only"); if (!Array.isArray(record.artifacts) || record.artifacts.length !== 2 || record.artifacts[0]?.package !== "@archie/runtime" || record.artifacts[1]?.package !== "@archie/conformance" || record.artifacts[0]?.version !== record.version || record.artifacts[1]?.version !== record.version)
    throw new Error("release record v2 artifacts must be ordered runtime then conformance at the product version"); const names = new Set(); for (const artifact of record.artifacts) {
    validateArtifact(artifact, "release record artifact");
    if (names.has(artifact.package))
        throw new Error("release record v2 artifacts must be unique");
    names.add(artifact.package);
} const apm = object(record.apm, "release record APM"); exactKeys(apm, ["package", "skills", "locator", "ref", "resolvedCommit", "contentHash"], "release record APM"); if (!text(apm.package, "release record APM package") || !/^git@github\.com:[^/]+\/[^/]+\.git$/.test(text(apm.locator, "release record APM locator")) || apm.ref !== `v${record.version}` || !/^[a-f0-9]{40}$/i.test(String(apm.resolvedCommit)) || !/^sha256:[a-f0-9]{64}$/.test(String(apm.contentHash)))
    throw new Error("release record APM evidence is malformed"); skills(apm.skills, "release record APM skills"); const expectedAnalyzer = analyzer(); if (canonicalize(record.analyzerCompatibility) !== canonicalize(expectedAnalyzer))
    throw new Error("release record has unsupported analyzer compatibility"); validateHtml(record.htmlDesignSnapshot); }
export function parseReleaseRecordV2(bytes) { const value = object(parseJson(bytes, "release record"), "release record"); validateRecord(value); if (serializeReleaseRecordV2(value) !== bytes)
    throw new Error("release record bytes are not canonical"); return value; }
/** The sole release evidence boundary used by selection and target verification. */
export function parseReleaseRecordEvidence(bytes) { const value = parseJson(bytes, "release record"); if (object(value, "release record").schemaVersion === 2)
    return parseReleaseRecordV2(bytes); return parseReleaseRecordV1(bytes); }
export function selectLocalReleaseV2(directory) {
    if (!directory || directory === "latest" || /^[a-z][a-z0-9+.-]*:\/\//i.test(directory))
        throw new Error("release selection must be an explicit local directory");
    const root = resolve(directory);
    if (!existsSync(root) || !statSync(root).isDirectory())
        throw new Error("release selection must be an existing local directory");
    validateBundleLayoutV2(root);
    const recordPath = join(root, "release-record-v2.json"), receiptPath = join(root, "release-review.txt");
    if (!existsSync(recordPath) || !existsSync(receiptPath))
        throw new Error("release bundle is incomplete; v2 record and review receipt are required");
    const recordBytes = readFileSync(recordPath, "utf8"), record = parseReleaseRecordV2(recordBytes);
    if (!readFileSync(receiptPath, "utf8").includes("Archie authorization: NOT ASSESSED — locally reviewed private release selected."))
        throw new Error("release bundle review receipt does not state the non-authorization boundary");
    const input = bundleInput(root);
    const artifacts = input.artifacts.map((inputArtifact, index) => { const artifact = record.artifacts[index]; const tarballPath = within(root, inputArtifact.tarball), tarball = readFileSync(tarballPath); const lock = object(parseJson(readFileSync(within(root, inputArtifact.lockFile), "utf8"), "npm lock"), "npm lock"), packageLock = object(object(lock.packages, "npm lock packages")[`node_modules/${artifact.package}`], "npm lock package"); if (inputArtifact.package !== artifact.package || inputArtifact.version !== artifact.version || inputArtifact.locator !== artifact.locator || artifact.locator !== `file:npm/${tarballPath.split(/[\\/]/).pop()}` || packageLock.integrity !== artifact.lockIntegrity || packageLock.resolved !== artifact.locator || sha512Integrity(tarball) !== artifact.lockIntegrity || sha256(tarball) !== artifact.tarballSha256)
        throw new Error("selected bundle artifact evidence differs from its finalized record"); return { record: artifact, tarballPath, tarballName: tarballPath.split(/[\\/]/).pop() }; });
    if (JSON.stringify(artifacts.map(artifact => artifact.record.package)) !== JSON.stringify(["@archie/runtime", "@archie/conformance"]))
        throw new Error("selected bundle artifacts are missing, extra, or reordered");
    const npmLockBytes = readFileSync(within(root, input.artifacts[0].lockFile), "utf8"), generatedNpm = npmProjection(record);
    if (npmLockBytes !== generatedNpm.lock)
        throw new Error("selected bundle npm lock differs from the exact generated v2 projection");
    validateNpmProjection({ manifest: generatedNpm.manifest, lock: npmLockBytes }, record);
    const selectedApm = apmEvidence(root, input.apm);
    if (canonicalize(selectedApm) !== canonicalize(record.apm))
        throw new Error("selected bundle APM evidence differs from its finalized record");
    return { bundleDirectory: root, record, recordBytes, recordSha256: sha256(recordBytes), artifacts, npmLockBytes };
}
export function validateBundleLayoutV2(bundleDirectory) { const root = resolve(bundleDirectory); const allowed = new Set(["bundle.json", "npm", "apm", "release-record-v2.json", "release-review.txt"]); for (const entry of readdirSync(root))
    if (!allowed.has(entry))
        throw new Error(`bundle layout has an unsupported entry: ${entry}`); if (!existsSync(join(root, "bundle.json")) || !statSync(join(root, "bundle.json")).isFile())
    throw new Error("bundle layout is missing bundle.json"); for (const required of ["npm", "apm"])
    if (!existsSync(join(root, required)) || !statSync(join(root, required)).isDirectory())
        throw new Error(`bundle layout is missing ${required}`); }
export function finalizeReleaseV2(request) { const root = resolve(request.bundleDirectory); validateBundleLayoutV2(root); if (!/^[a-f0-9]{40}$/i.test(request.sourceCommit))
    throw new Error("sourceCommit must be a 40-character Git commit"); const input = bundleInput(root); if (input.apm.ref !== `v${PRODUCT_VERSION}` || input.artifacts.some(artifact => artifact.version !== PRODUCT_VERSION))
    throw new Error("bundle version does not match the Archie product version authority"); const artifacts = input.artifacts.map(artifact => artifactEvidence(root, artifact)); if (artifacts[0].package !== "@archie/runtime" || artifacts[1].package !== "@archie/conformance")
    throw new Error("bundle v2 artifacts must be ordered runtime then conformance"); const record = { schemaVersion: 2, product: "archie", version: PRODUCT_VERSION, sourceCommit: request.sourceCommit, authorization: { kind: "none", claim: LOCAL_REVIEW_CLAIM }, artifacts, apm: apmEvidence(root, input.apm), analyzerCompatibility: analyzer(), htmlDesignSnapshot: parseJson(readFileSync(request.htmlProvenancePath, "utf8"), "HTML snapshot provenance") }; validateHtml(record.htmlDesignSnapshot); const bundledLock = readFileSync(within(root, input.artifacts[0].lockFile), "utf8"), generatedNpm = npmProjection(record); if (bundledLock !== generatedNpm.lock)
    throw new Error("bundle npm lock differs from the exact generated v2 projection"); validateNpmProjection({ manifest: generatedNpm.manifest, lock: bundledLock }, record); const bytes = serializeReleaseRecordV2(record), recordSha256 = sha256(bytes); const receipt = ["Archie private release review receipt", `Product: ${record.product}@${record.version}`, `Record SHA-256: ${recordSha256}`, "Bundle layout: valid", "Artifacts: @archie/runtime, @archie/conformance", "Archie authorization: NOT ASSESSED — locally reviewed private release selected.", "This receipt reports finalized-byte consistency only. Signing, public-release trust, controller distribution, and key operations are deferred.", ""].join("\n"); const recordPath = join(root, "release-record-v2.json"); writeFileSync(recordPath, bytes); writeFileSync(join(root, "release-review.txt"), receipt); return { record, recordPath, receiptPath: join(root, "release-review.txt"), recordSha256 }; }
//# sourceMappingURL=release-record-v2.js.map
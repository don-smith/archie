import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { canonicalize } from "../analysis/canonical-json.js";
import { SUPPORTED_ANALYZER } from "../analysis/contracts.js";
import { PRODUCT_VERSION } from "../product-version.js";
import { validateHtmlSnapshotProvenance, type HtmlSnapshotProvenance } from "../html-snapshot/verify.js";

export const RELEASE_RECORD_SCHEMA_VERSION = 1 as const;
export const LOCAL_REVIEW_CLAIM = "locally-reviewed-private-trial" as const;

export interface ReleaseRecordV1 {
  schemaVersion: typeof RELEASE_RECORD_SCHEMA_VERSION;
  product: "archie";
  version: string;
  sourceCommit: string;
  authorization: { kind: "none"; claim: typeof LOCAL_REVIEW_CLAIM };
  npm: { package: string; version: string; locator: string; lockIntegrity: string; tarballSha256: string; requiredPlatformPayload: string };
  apm: { package: string; skill: string; locator: string; ref: string; resolvedCommit: string; contentHash: string };
  analyzerCompatibility: { adapter: string; typescript: string; nodeMajor: number; platform: string; architecture: string; platformPackage: string; knownDefects: string[] };
  htmlDesignSnapshot: HtmlSnapshotProvenance;
}

export interface FinalizeReleaseRequest {
  bundleDirectory: string;
  sourceCommit: string;
  htmlProvenancePath: string;
}

export interface FinalizeReleaseResult {
  record: ReleaseRecordV1;
  recordPath: string;
  receiptPath: string;
  recordSha256: string;
}

type BundleInput = {
  format: "archie-private-bundle-input-v1";
  npm: { package: string; version: string; locator: string; lockFile: string; tarball: string; requiredPlatformPayload: string };
  apm: { package: string; skill: string; locator: string; ref: string; manifest: string; lockFile: string };
};

const expectedRecordKeys = ["analyzerCompatibility", "apm", "authorization", "htmlDesignSnapshot", "npm", "product", "schemaVersion", "sourceCommit", "version"];
const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const sha512Integrity = (bytes: Buffer) => `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
const isSha256 = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
};
const string = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
};
const exactKeys = (value: Record<string, unknown>, keys: string[], label: string): void => {
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...keys].sort())) throw new Error(`${label} has unsupported or missing fields`);
};

function parseJson(bytes: string, label: string): unknown {
  try { return JSON.parse(bytes); } catch { throw new Error(`${label} is not valid JSON`); }
}

function readBundleInput(path: string): BundleInput {
  const input = object(parseJson(readFileSync(path, "utf8"), "bundle input"), "bundle input");
  exactKeys(input, ["format", "npm", "apm"], "bundle input");
  if (input.format !== "archie-private-bundle-input-v1") throw new Error("bundle input has an unsupported format");
  const npm = object(input.npm, "bundle npm input");
  const apm = object(input.apm, "bundle APM input");
  exactKeys(npm, ["package", "version", "locator", "lockFile", "tarball", "requiredPlatformPayload"], "bundle npm input");
  exactKeys(apm, ["package", "skill", "locator", "ref", "manifest", "lockFile"], "bundle APM input");
  return {
    format: input.format,
    npm: {
      package: string(npm.package, "bundle npm package"), version: string(npm.version, "bundle npm version"), locator: string(npm.locator, "bundle npm locator"),
      lockFile: string(npm.lockFile, "bundle npm lockFile"), tarball: string(npm.tarball, "bundle npm tarball"), requiredPlatformPayload: string(npm.requiredPlatformPayload, "bundle npm requiredPlatformPayload")
    },
    apm: {
      package: string(apm.package, "bundle APM package"), skill: string(apm.skill, "bundle APM skill"), locator: string(apm.locator, "bundle APM locator"),
      ref: string(apm.ref, "bundle APM ref"), manifest: string(apm.manifest, "bundle APM manifest"), lockFile: string(apm.lockFile, "bundle APM lockFile")
    }
  };
}

function within(root: string, file: string): string {
  const resolved = resolve(root, file);
  if (relative(root, resolved).startsWith("..")) throw new Error(`bundle path escapes its directory: ${file}`);
  if (!existsSync(resolved) || !statSync(resolved).isFile()) throw new Error(`bundle artifact is missing: ${file}`);
  return resolved;
}

function npmTarballPackage(tarball: Buffer): { name: string; version: string } {
  let archive: Buffer;
  try { archive = gunzipSync(tarball); } catch { throw new Error("npm tarball is not a valid gzip archive"); }
  for (let offset = 0; offset + 512 <= archive.length;) {
    const name = archive.subarray(offset, offset + 100).toString("utf8").replace(/\0.*$/, "");
    if (!name) break;
    const sizeText = archive.subarray(offset + 124, offset + 136).toString("utf8").replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeText || "0", 8);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("npm tarball has an invalid entry size");
    const body = archive.subarray(offset + 512, offset + 512 + size);
    if (name === "package/package.json") {
      const manifest = object(parseJson(body.toString("utf8"), "npm tarball package manifest"), "npm tarball package manifest");
      return { name: string(manifest.name, "npm tarball package name"), version: string(manifest.version, "npm tarball package version") };
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error("npm tarball omits package/package.json");
}

function npmEvidence(root: string, npm: BundleInput["npm"]): ReleaseRecordV1["npm"] {
  const tarball = readFileSync(within(root, npm.tarball));
  const manifest = npmTarballPackage(tarball);
  if (manifest.name !== npm.package || manifest.version !== npm.version) throw new Error("npm tarball package identity differs from bundle input");
  const lock = object(parseJson(readFileSync(within(root, npm.lockFile), "utf8"), "npm lock"), "npm lock");
  const packages = object(lock.packages, "npm lock packages");
  const packageLock = object(packages[`node_modules/${npm.package}`], `npm lock package ${npm.package}`);
  if (string(packageLock.version, "npm lock version") !== npm.version) throw new Error("npm lock version differs from bundle input");
  if (string(packageLock.resolved, "npm lock locator") !== npm.locator) throw new Error("npm lock locator differs from bundle input");
  const integrity = string(packageLock.integrity, "npm lock integrity");
  if (integrity !== sha512Integrity(tarball)) throw new Error("npm lock integrity does not match finalized tarball bytes");
  return { package: npm.package, version: npm.version, locator: npm.locator, lockIntegrity: integrity, tarballSha256: sha256(tarball), requiredPlatformPayload: npm.requiredPlatformPayload };
}

function field(text: string, name: string, label: string): string {
  const matches = [...text.matchAll(new RegExp(`^\\s*(?:-\\s*)?${name}:\\s*([^\\s]+)\\s*$`, "gm"))];
  if (matches.length !== 1) throw new Error(`${label} must contain exactly one ${name} field`);
  return matches[0]![1]!;
}

function apmEvidence(root: string, apm: BundleInput["apm"]): ReleaseRecordV1["apm"] {
  const manifest = readFileSync(within(root, apm.manifest), "utf8");
  if (field(manifest, "git", "APM manifest") !== apm.locator || field(manifest, "ref", "APM manifest") !== apm.ref) throw new Error("APM manifest differs from bundle input");
  const lock = readFileSync(within(root, apm.lockFile), "utf8");
  const resolvedCommit = field(lock, "resolved_commit", "APM lock");
  const contentHash = field(lock, "content_hash", "APM lock");
  if (!/^[a-f0-9]{40}$/i.test(resolvedCommit)) throw new Error("APM resolved commit is malformed");
  if (!/^sha256:[a-f0-9]{64}$/i.test(contentHash)) throw new Error("APM content hash is malformed");
  if (field(lock, "resolved_ref", "APM lock") !== apm.ref) throw new Error("APM lock ref differs from bundle input");
  return { package: apm.package, skill: apm.skill, locator: apm.locator, ref: apm.ref, resolvedCommit, contentHash };
}

function validateHtmlRecord(value: unknown): asserts value is HtmlSnapshotProvenance {
  validateHtmlSnapshotProvenance(value);
  const provenance = object(value, "release record HTML snapshot");
  exactKeys(provenance, ["format", "upstream", "commit", "sourcePath", "gitTree", "digest", "license", "requiredNotices", "importToolVersion", "verificationCommand"], "release record HTML snapshot");
  if (provenance.format !== "archie-html-design-snapshot-v1") throw new Error("release record HTML snapshot has an unsupported format");
  const digest = object(provenance.digest, "release record HTML digest");
  exactKeys(digest, ["algorithm", "value", "fileCount"], "release record HTML digest");
  if (digest.algorithm !== "sha256" || !isSha256(digest.value) || !Number.isInteger(digest.fileCount) || Number(digest.fileCount) < 1) throw new Error("release record HTML digest is malformed");
  const license = object(provenance.license, "release record HTML license");
  exactKeys(license, ["path", "sha256"], "release record HTML license");
  if (!isSha256(license.sha256)) throw new Error("release record HTML license is malformed");
}

function releaseAnalyzerCompatibility(): ReleaseRecordV1["analyzerCompatibility"] {
  return { adapter: SUPPORTED_ANALYZER.adapter, typescript: SUPPORTED_ANALYZER.typeScript, nodeMajor: SUPPORTED_ANALYZER.nodeMajor, platform: SUPPORTED_ANALYZER.platform, architecture: SUPPORTED_ANALYZER.architecture, platformPackage: SUPPORTED_ANALYZER.platformPackage, knownDefects: [...SUPPORTED_ANALYZER.knownDefects] };
}

function validateKnownRecord(record: Record<string, unknown>): void {
  exactKeys(record, expectedRecordKeys, "release record");
  if (record.schemaVersion !== RELEASE_RECORD_SCHEMA_VERSION || record.product !== "archie") throw new Error("unsupported release record schema or product");
  if (!/^[a-f0-9]{40}$/i.test(string(record.sourceCommit, "release record sourceCommit"))) throw new Error("release record sourceCommit is malformed");
  string(record.version, "release record version");
  const authorization = object(record.authorization, "release record authorization");
  exactKeys(authorization, ["kind", "claim"], "release record authorization");
  if (authorization.kind !== "none" || authorization.claim !== LOCAL_REVIEW_CLAIM) throw new Error("release record authorization must be explicit local private review only");
  const npm = object(record.npm, "release record npm");
  exactKeys(npm, ["package", "version", "locator", "lockIntegrity", "tarballSha256", "requiredPlatformPayload"], "release record npm");
  for (const key of ["package", "version", "locator", "lockIntegrity", "requiredPlatformPayload"]) string(npm[key], `release record npm ${key}`);
  if (!isSha256(npm.tarballSha256) || !String(npm.lockIntegrity).startsWith("sha512-")) throw new Error("release record npm evidence is malformed");
  const apm = object(record.apm, "release record APM");
  exactKeys(apm, ["package", "skill", "locator", "ref", "resolvedCommit", "contentHash"], "release record APM");
  for (const key of ["package", "skill", "locator", "ref"]) string(apm[key], `release record APM ${key}`);
  if (!/^[a-f0-9]{40}$/i.test(string(apm.resolvedCommit, "release record APM resolvedCommit")) || !/^sha256:[a-f0-9]{64}$/i.test(string(apm.contentHash, "release record APM contentHash"))) throw new Error("release record APM evidence is malformed");
  const compatibility = object(record.analyzerCompatibility, "release record analyzer compatibility");
  exactKeys(compatibility, ["adapter", "typescript", "nodeMajor", "platform", "architecture", "platformPackage", "knownDefects"], "release record analyzer compatibility");
  if (compatibility.adapter !== SUPPORTED_ANALYZER.adapter || compatibility.typescript !== SUPPORTED_ANALYZER.typeScript || compatibility.nodeMajor !== SUPPORTED_ANALYZER.nodeMajor || compatibility.platform !== SUPPORTED_ANALYZER.platform || compatibility.architecture !== SUPPORTED_ANALYZER.architecture || compatibility.platformPackage !== SUPPORTED_ANALYZER.platformPackage || JSON.stringify(compatibility.knownDefects) !== JSON.stringify(SUPPORTED_ANALYZER.knownDefects)) throw new Error("release record has unsupported analyzer compatibility");
  validateHtmlRecord(record.htmlDesignSnapshot);
}

export function serializeReleaseRecord(record: ReleaseRecordV1): string {
  validateKnownRecord(record as unknown as Record<string, unknown>);
  return `${canonicalize(record)}\n`;
}

export function parseReleaseRecord(bytes: string): ReleaseRecordV1 {
  const record = object(parseJson(bytes, "release record"), "release record");
  validateKnownRecord(record);
  if (serializeReleaseRecord(record as unknown as ReleaseRecordV1) !== bytes) throw new Error("release record bytes are not canonical");
  return record as unknown as ReleaseRecordV1;
}

export function validateBundleLayout(bundleDirectory: string): void {
  const root = resolve(bundleDirectory);
  const allowed = new Set(["bundle.json", "npm", "apm", "release-record-v1.json", "release-review.txt"]);
  for (const entry of readdirSync(root)) if (!allowed.has(entry)) throw new Error(`bundle layout has an unsupported entry: ${entry}`);
  for (const required of ["bundle.json", "npm", "apm"]) if (!existsSync(join(root, required))) throw new Error(`bundle layout is missing ${required}`);
  if (!statSync(join(root, "npm")).isDirectory() || !statSync(join(root, "apm")).isDirectory()) throw new Error("bundle npm and APM entries must be directories");
}

export function finalizeRelease(request: FinalizeReleaseRequest): FinalizeReleaseResult {
  const root = resolve(request.bundleDirectory);
  validateBundleLayout(root);
  if (!/^[a-f0-9]{40}$/i.test(request.sourceCommit)) throw new Error("sourceCommit must be a 40-character Git commit");
  const input = readBundleInput(join(root, "bundle.json"));
  if (input.npm.version !== PRODUCT_VERSION || input.apm.ref !== `v${PRODUCT_VERSION}`) throw new Error("bundle version does not match the Archie product version authority");
  const provenance = parseJson(readFileSync(request.htmlProvenancePath, "utf8"), "HTML snapshot provenance");
  validateHtmlRecord(provenance);
  const record: ReleaseRecordV1 = {
    schemaVersion: RELEASE_RECORD_SCHEMA_VERSION, product: "archie", version: input.npm.version, sourceCommit: request.sourceCommit,
    authorization: { kind: "none", claim: LOCAL_REVIEW_CLAIM }, npm: npmEvidence(root, input.npm), apm: apmEvidence(root, input.apm),
    analyzerCompatibility: releaseAnalyzerCompatibility(), htmlDesignSnapshot: provenance as HtmlSnapshotProvenance
  };
  const bytes = serializeReleaseRecord(record);
  const recordSha256 = sha256(bytes);
  const receipt = [
    "Archie private release review receipt", `Product: ${record.product}@${record.version}`, `Record SHA-256: ${recordSha256}`,
    "Bundle layout: valid", "Archie authorization: NOT ASSESSED — locally reviewed private release selected.",
    "This receipt reports finalized-byte consistency only. Signing, public-release trust, controller distribution, and key operations are deferred.", ""
  ].join("\n");
  const recordPath = join(root, "release-record-v1.json");
  const receiptPath = join(root, "release-review.txt");
  writeFileSync(recordPath, bytes); writeFileSync(receiptPath, receipt);
  validateBundleLayout(root);
  return { record, recordPath, receiptPath, recordSha256 };
}

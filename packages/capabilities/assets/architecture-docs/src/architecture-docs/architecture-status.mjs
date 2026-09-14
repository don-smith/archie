import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ArchitectureDocsBuildError } from "./errors.mjs";

const ID = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_STRING = 2000;
const MAX_PATH = 512;
const states = new Set(["current", "stale", "unknown"]);
const executionStates = new Set(["completed", "failed", "not-run"]);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (message, path_ = "$.architectureStatus.snapshot") => { throw new ArchitectureDocsBuildError("Architecture status snapshot is invalid.", { code: "ARCHITECTURE_STATUS_INVALID", issues: [{ path: path_, message, expected: "Provide a normalized architecture status snapshot produced by Archie." }] }); };
function string(value, name, max = MAX_STRING) { if (typeof value !== "string" || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(`${name} must be a bounded string`); return value; }
function id(value, name) { const result = string(value, name, 64); if (!ID.test(result)) fail(`${name} is unsafe`); return result; }
function timestamp(value, name) { const result = string(value, name, 24); if (!ISO.test(result) || Number.isNaN(Date.parse(result)) || new Date(result).toISOString() !== result) fail(`${name} must be canonical UTC`); return result; }
function safePath(value, name) { const result = string(value, name, MAX_PATH); if (result.startsWith("/") || result.includes("\\") || /^[A-Za-z]:/.test(result) || result.split("/").some((part) => !part || part === "." || part === "..")) fail(`${name} is unsafe`); return result; }
function digest(value, name) { const result = string(value, name, 64); if (!SHA256.test(result)) fail(`${name} must be a lowercase SHA-256 digest`); return result; }
function ordered(values, name, mapper = (value) => string(value, name)) { if (!Array.isArray(values)) fail(`${name} must be an array`); const result = values.map((value, index) => mapper(value, `${name}[${index}]`)); if (new Set(result).size !== result.length) fail(`${name} must be unique`); return result; }
function object(value, name) { if (!isObject(value)) fail(`${name} must be an object`); return value; }
function noOutputFields(value, name = "snapshot") { if (!isObject(value) && !Array.isArray(value)) return; for (const [key, child] of Object.entries(value)) { if (key === "stdout" || key === "stderr") fail(`${name}.${key} is not permitted`); noOutputFields(child, `${name}.${key}`); } }
function normalizeCounts(value, name) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) fail(`${name} is invalid`);
  const result = value.map((entry, index) => { const item = object(entry, `${name}[${index}]`); const itemId = id(item.id, `${name}[${index}].id`); if (!Number.isSafeInteger(item.value) || item.value < 0 || item.value > 1_000_000_000) fail(`${name}[${index}].value is invalid`); return { id: itemId, value: item.value }; });
  if (result.some((entry, index) => index && entry.id.localeCompare(result[index - 1].id) < 0)) fail(`${name} must be lexically ordered`);
  return result;
}
function normalizeFindingIds(value, name) {
  if (value === undefined) return undefined;
  const result = ordered(value, name, (entry, field) => id(entry, field));
  if (result.some((entry, index) => index && entry.localeCompare(result[index - 1]) < 0)) fail(`${name} must be lexically ordered`);
  return result;
}
function normalizeExecution(value, name) {
  const item = object(value, name); if (!executionStates.has(item.state)) fail(`${name}.state is unsupported`);
  if (item.state === "not-run") return { state: item.state, reason: string(item.reason, `${name}.reason`) };
  const startedAt = timestamp(item.startedAt, `${name}.startedAt`); const finishedAt = timestamp(item.finishedAt, `${name}.finishedAt`);
  if (Date.parse(startedAt) > Date.parse(finishedAt)) fail(`${name} times are contradictory`);
  if (item.state === "completed") { if (!Number.isInteger(item.exitCode) || item.exitCode < -1 || item.exitCode > 255) fail(`${name}.exitCode is invalid`); return { state: item.state, startedAt, finishedAt, exitCode: item.exitCode }; }
  return { state: item.state, startedAt, finishedAt, reason: string(item.reason, `${name}.reason`) };
}
function normalizeResult(value, name) {
  const item = object(value, name);
  if (item.state === "unknown") return { state: "unknown", reason: string(item.reason, `${name}.reason`) };
  if (item.state !== "reported") fail(`${name}.state is unsupported`);
  const result = { state: "reported", code: id(item.code, `${name}.code`), label: string(item.label, `${name}.label`), summary: string(item.summary, `${name}.summary`) };
  const counts = normalizeCounts(item.counts, `${name}.counts`); const findingIds = normalizeFindingIds(item.findingIds, `${name}.findingIds`);
  if (counts) result.counts = counts; if (findingIds) result.findingIds = findingIds; return result;
}
function normalizeEvidence(value, name) {
  const item = object(value, name);
  if (item.state === "missing") return { state: "missing", reason: string(item.reason, `${name}.reason`) };
  if (item.state !== "present" || !["current", "retained"].includes(item.source)) fail(`${name} is unsupported`);
  return { state: "present", source: item.source, path: safePath(item.path, `${name}.path`), sha256: digest(item.sha256, `${name}.sha256`), observedAt: timestamp(item.observedAt, `${name}.observedAt`), observedRevision: string(item.observedRevision, `${name}.observedRevision`, 256) };
}
function normalizeFreshness(value, name) {
  const item = object(value, name); if (!states.has(item.state)) fail(`${name}.state is unsupported`);
  const reasons = ordered(item.reasons, `${name}.reasons`); if (reasons.some((entry, index) => index && entry.localeCompare(reasons[index - 1]) < 0)) fail(`${name}.reasons must be lexically ordered`);
  if (item.state === "current" && reasons.length) fail(`${name} current state cannot have reasons`);
  if (item.state !== "current" && !reasons.length) fail(`${name} incomplete state needs a reason`);
  return { state: item.state, reasons };
}
function expectedFreshness(generatedAt, revision, evidence, maxAgeSeconds) { if (evidence.state === "missing") return { state: "unknown", reasons: ["evidence-missing"] }; const reasons = []; if (evidence.observedRevision !== revision.commit) reasons.push("revision-mismatch"); if (Date.parse(generatedAt) - Date.parse(evidence.observedAt) > maxAgeSeconds * 1000) reasons.push("age-exceeded"); if (reasons.length) return { state: "stale", reasons: reasons.sort() }; if (revision.workingTree !== "clean") return { state: "unknown", reasons: ["revision-unknown"] }; return { state: "current", reasons: [] }; }
function safeEvidenceRoot(rootDirectory, relative) { const root = path.resolve(rootDirectory); const target = path.resolve(root, relative); if (target !== root && !target.startsWith(`${root}${path.sep}`)) fail("evidence path escapes the architecture-docs root", "$.checks.evidence.path"); return target; }

export function validateArchitectureStatusSnapshot(value, { repositoryName, rootDirectory } = {}) {
  noOutputFields(value);
  const input = object(value, "snapshot"); if (input.kind !== "archie-architecture-status" || input.version !== 1) fail("kind/version is unsupported");
  const repository = object(input.repository, "repository"); const name = string(repository.name, "repository.name"); if (repositoryName !== undefined && name !== repositoryName) fail("repository.name does not match architecture-docs configuration", "$.repository.name");
  const revisionObject = object(repository.revision, "repository.revision"); const revision = { commit: string(revisionObject.commit, "repository.revision.commit", 256), workingTree: revisionObject.workingTree }; if (!["clean", "dirty", "unknown"].includes(revision.workingTree)) fail("repository.revision.workingTree is unsupported");
  const generatedAt = timestamp(input.generatedAt, "generatedAt"); const policy = object(input.freshnessPolicy, "freshnessPolicy"); if (!Number.isSafeInteger(policy.maxAgeSeconds) || policy.maxAgeSeconds < 0 || policy.maxAgeSeconds > 31_536_000) fail("freshnessPolicy.maxAgeSeconds is invalid");
  if (!Array.isArray(input.checks)) fail("checks must be an array"); const checks = input.checks.map((entry, index) => { const check = object(entry, `checks[${index}]`); const normalized = { id: id(check.id, `checks[${index}].id`), title: string(check.title, `checks[${index}].title`), authority: string(check.authority, `checks[${index}].authority`), resultMeaning: string(check.resultMeaning, `checks[${index}].resultMeaning`), limits: ordered(check.limits, `checks[${index}].limits`), execution: normalizeExecution(check.execution, `checks[${index}].execution`), result: normalizeResult(check.result, `checks[${index}].result`), evidence: normalizeEvidence(check.evidence, `checks[${index}].evidence`), freshness: normalizeFreshness(check.freshness, `checks[${index}].freshness`) };
    if (normalized.execution.state !== "not-run" && Date.parse(normalized.execution.startedAt) > Date.parse(generatedAt)) fail(`checks[${index}] starts after generatedAt`); if (normalized.execution.state !== "not-run" && Date.parse(normalized.execution.finishedAt) > Date.parse(generatedAt)) fail(`checks[${index}] finishes after generatedAt`); if (normalized.evidence.state === "present" && Date.parse(normalized.evidence.observedAt) > Date.parse(generatedAt)) fail(`checks[${index}].evidence is after generatedAt`); if (normalized.execution.state !== "completed" && normalized.result.state === "reported") fail(`checks[${index}] cannot report a result without completed execution`);
    const expected = expectedFreshness(generatedAt, revision, normalized.evidence, policy.maxAgeSeconds); if (JSON.stringify(expected) !== JSON.stringify(normalized.freshness)) fail(`checks[${index}].freshness contradicts recorded facts`); return normalized;
  });
  if (new Set(checks.map((check) => check.id)).size !== checks.length) fail("check IDs must be unique");
  return { kind: "archie-architecture-status", version: 1, repository: { name, revision }, generatedAt, freshnessPolicy: { maxAgeSeconds: policy.maxAgeSeconds }, checks };
}

export async function loadArchitectureStatus(config) {
  const filename = config.paths.architectureStatusSnapshot;
  if (!filename) return { configured: false, snapshot: null, projection: { state: "absent", checks: [], counts: { current: 0, stale: 0, unknown: 0, missing: 0, failed: 0, notRun: 0 } } };
  try { await stat(filename); } catch (error) { if (error.code === "ENOENT") return { configured: true, snapshot: null, projection: absentProjection(filename) }; throw error; }
  let parsed; try { parsed = JSON.parse(await readFile(filename, "utf8")); } catch { fail("snapshot is malformed JSON"); }
  const snapshot = validateArchitectureStatusSnapshot(parsed, { repositoryName: config.repository.name });
  for (const [index, check] of snapshot.checks.entries()) if (check.evidence.state === "present") {
    const evidenceFile = safeEvidenceRoot(config.paths.rootDirectory, check.evidence.path);
    let bytes; try { bytes = await readFile(evidenceFile); } catch { fail(`checks[${index}].evidence.path is not locally available`); }
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== check.evidence.sha256) fail(`checks[${index}].evidence.sha256 does not match the local artifact`);
  }
  return { configured: true, snapshot, projection: projectArchitectureStatus(snapshot) };
}
function absentProjection(filename) { return { state: "absent", snapshotPath: filename, checks: [], counts: { current: 0, stale: 0, unknown: 0, missing: 0, failed: 0, notRun: 0 } }; }
export function projectArchitectureStatus(snapshot) {
  const checks = snapshot.checks.map((check) => ({ ...check, incomplete: check.execution.state !== "completed" || check.evidence.state !== "present" || check.freshness.state !== "current" }));
  const counts = { current: checks.filter((check) => check.freshness.state === "current").length, stale: checks.filter((check) => check.freshness.state === "stale").length, unknown: checks.filter((check) => check.freshness.state === "unknown").length, missing: checks.filter((check) => check.evidence.state === "missing").length, failed: checks.filter((check) => check.execution.state === "failed").length, notRun: checks.filter((check) => check.execution.state === "not-run").length };
  return { state: "present", repository: snapshot.repository, generatedAt: snapshot.generatedAt, freshnessPolicy: snapshot.freshnessPolicy, checks, counts };
}
export function snapshotDigest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
export function architectureStatusError(message) { return fail(message); }

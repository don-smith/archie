import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve, sep } from "node:path";
const ID = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MAX_STRING = 2000;
const MAX_PATH = 512;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function fail(message) { throw new Error(`Invalid architecture status v1: ${message}`); }
function rejectOutputFields(value) {
    if (!value || typeof value !== "object")
        return;
    if (Array.isArray(value)) {
        for (const entry of value)
            rejectOutputFields(entry);
        return;
    }
    for (const [key, child] of Object.entries(value)) {
        if (key === "stdout" || key === "stderr")
            fail(`${key} fields are not permitted`);
        rejectOutputFields(child);
    }
}
function object(value, name) { if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${name} must be an object`); return value; }
function string(value, name, max = MAX_STRING) { if (typeof value !== "string" || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value))
    fail(`${name} must be a bounded string`); return value; }
function id(value, name) { const result = string(value, name, 64); if (!ID.test(result))
    fail(`${name} is unsafe`); return result; }
function timestamp(value, name) { const result = string(value, name, 24); if (!ISO.test(result) || Number.isNaN(Date.parse(result)) || new Date(result).toISOString() !== result)
    fail(`${name} must be canonical UTC`); return result; }
function path(value, name) { const result = string(value, name, MAX_PATH); if (result.startsWith("/") || result.includes("\\") || result.split("/").some((part) => part === ".." || part === "" || part === ".") || /^[A-Za-z]:/.test(result))
    fail(`${name} is unsafe`); return result; }
function digest(value, name) { const result = string(value, name, 64); if (!DIGEST.test(result))
    fail(`${name} must be a lowercase SHA-256 digest`); return result; }
function orderedUnique(values, name) { if (!Array.isArray(values))
    fail(`${name} must be an array`); const out = values.map((v, i) => string(v, `${name}[${i}]`)); if (new Set(out).size !== out.length)
    fail(`${name} must be unique`); return out; }
function compareTime(a, b, message) { if (Date.parse(a) > Date.parse(b))
    fail(message); }
function normalizeCounts(value, name) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value) || value.length > 100)
        fail(`${name} must be a bounded array`);
    const result = value.map((entry, index) => { const item = object(entry, `${name}[${index}]`); const itemId = id(item.id, `${name}[${index}].id`); if (!Number.isSafeInteger(item.value) || item.value < 0 || item.value > 1_000_000_000)
        fail(`${name}[${index}].value is invalid`); return { id: itemId, value: item.value }; });
    if (new Set(result.map((entry) => entry.id)).size !== result.length || result.some((entry, index) => index > 0 && entry.id.localeCompare(result[index - 1].id) < 0))
        fail(`${name} must be unique and lexically ordered`);
    return result;
}
function normalizeFindingIds(value, name) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value) || value.length > 1000)
        fail(`${name} must be a bounded array`);
    const result = value.map((entry, index) => id(entry, `${name}[${index}]`));
    if (new Set(result).size !== result.length || result.some((entry, index) => index > 0 && entry.localeCompare(result[index - 1]) < 0))
        fail(`${name} must be unique and lexically ordered`);
    return result;
}
function normalizeRevision(value) {
    const item = object(value, "repository.revision");
    const commit = string(item.commit, "repository.revision.commit", 256);
    if (!/^[A-Za-z0-9._:/@+-]+$/.test(commit))
        fail("repository.revision.commit is unsafe");
    const workingTree = item.workingTree;
    if (workingTree !== "clean" && workingTree !== "dirty" && workingTree !== "unknown")
        fail("repository.revision.workingTree is unsupported");
    return { commit, workingTree };
}
function freshness(generatedAt, revision, evidence, maxAgeSeconds) {
    if (evidence.state === "missing")
        return { state: "unknown", reasons: ["evidence-missing"] };
    const reasons = [];
    if (evidence.observedRevision !== revision.commit)
        reasons.push("revision-mismatch");
    if (Date.parse(generatedAt) - Date.parse(evidence.observedAt) > maxAgeSeconds * 1000)
        reasons.push("age-exceeded");
    if (reasons.length)
        return { state: "stale", reasons: reasons.sort((a, b) => a.localeCompare(b)) };
    if (revision.workingTree !== "clean")
        return { state: "unknown", reasons: ["revision-unknown"] };
    return { state: "current", reasons: [] };
}
function normalizeExecution(value) {
    const item = object(value, "execution");
    const state = item.state;
    if (state === "not-run")
        return { state, reason: string(item.reason, "execution.reason") };
    const startedAt = timestamp(item.startedAt, "execution.startedAt");
    const finishedAt = timestamp(item.finishedAt, "execution.finishedAt");
    compareTime(startedAt, finishedAt, "execution times are contradictory");
    if (state === "completed") {
        if (!Number.isInteger(item.exitCode) || item.exitCode < -1 || item.exitCode > 255)
            fail("execution.exitCode is invalid");
        return { state, startedAt, finishedAt, exitCode: item.exitCode };
    }
    if (state === "failed")
        return { state, startedAt, finishedAt, reason: string(item.reason, "execution.reason") };
    fail("execution.state is unsupported");
}
function normalizeResult(value) {
    const item = object(value, "result");
    if (item.state === "unknown")
        return { state: "unknown", reason: string(item.reason, "result.reason") };
    if (item.state !== "reported")
        fail("result.state is unsupported");
    const result = { state: "reported", code: id(item.code, "result.code"), label: string(item.label, "result.label"), summary: string(item.summary, "result.summary") };
    const counts = normalizeCounts(item.counts, "result.counts");
    const findingIds = normalizeFindingIds(item.findingIds, "result.findingIds");
    if (counts)
        result.counts = counts;
    if (findingIds)
        result.findingIds = findingIds;
    return result;
}
function normalizeEvidence(value) {
    const item = object(value, "evidence");
    if (item.state === "missing")
        return { state: "missing", reason: string(item.reason, "evidence.reason") };
    if (item.state !== "present")
        fail("evidence.state is unsupported");
    const source = item.source;
    if (source !== "current" && source !== "retained")
        fail("evidence.source is unsupported");
    return { state: "present", source, path: path(item.path, "evidence.path"), sha256: digest(item.sha256, "evidence.sha256"), observedAt: timestamp(item.observedAt, "evidence.observedAt"), observedRevision: string(item.observedRevision, "evidence.observedRevision", 256) };
}
function normalizeFreshness(value) {
    const item = object(value, "freshness");
    if (item.state !== "current" && item.state !== "stale" && item.state !== "unknown")
        fail("freshness.state is unsupported");
    const reasons = orderedUnique(item.reasons, "freshness.reasons");
    if (reasons.some((reason, index) => index > 0 && reason.localeCompare(reasons[index - 1]) < 0))
        fail("freshness.reasons must be lexically ordered");
    if (item.state === "current" && reasons.length)
        fail("current freshness cannot have reasons");
    if (item.state !== "current" && !reasons.length)
        fail("incomplete freshness needs a reason");
    return item.state === "current" ? { state: "current", reasons: [] } : { state: item.state, reasons };
}
/** Validates a complete wire snapshot and returns a normalized copy. */
export function validateArchitectureStatusSnapshotV1(value) {
    rejectOutputFields(value);
    const input = object(value, "snapshot");
    if (input.kind !== "archie-architecture-status" || input.version !== 1)
        fail("kind/version is unsupported");
    const repository = object(input.repository, "repository");
    const name = string(repository.name, "repository.name");
    const revision = normalizeRevision(repository.revision);
    const generatedAt = timestamp(input.generatedAt, "generatedAt");
    const policy = object(input.freshnessPolicy, "freshnessPolicy");
    if (!Number.isSafeInteger(policy.maxAgeSeconds) || policy.maxAgeSeconds < 0 || policy.maxAgeSeconds > 31_536_000)
        fail("freshnessPolicy.maxAgeSeconds is invalid");
    const maxAgeSeconds = policy.maxAgeSeconds;
    if (!Array.isArray(input.checks))
        fail("checks must be an array");
    const checks = input.checks.map((entry, index) => {
        const check = object(entry, `checks[${index}]`);
        const result = {
            id: id(check.id, `checks[${index}].id`), title: string(check.title, `checks[${index}].title`), authority: string(check.authority, `checks[${index}].authority`), resultMeaning: string(check.resultMeaning, `checks[${index}].resultMeaning`), limits: orderedUnique(check.limits, `checks[${index}].limits`), execution: normalizeExecution(check.execution), result: normalizeResult(check.result), evidence: normalizeEvidence(check.evidence), freshness: normalizeFreshness(check.freshness)
        };
        compareTime((result.execution.state === "not-run" ? generatedAt : result.execution.startedAt), generatedAt, `checks[${index}] starts after generatedAt`);
        if (result.execution.state !== "not-run")
            compareTime(result.execution.finishedAt, generatedAt, `checks[${index}] finishes after generatedAt`);
        if (result.evidence.state === "present")
            compareTime(result.evidence.observedAt, generatedAt, `checks[${index}].evidence is after generatedAt`);
        const expected = freshness(generatedAt, revision, result.evidence, maxAgeSeconds);
        if (JSON.stringify(expected) !== JSON.stringify(result.freshness))
            fail(`checks[${index}].freshness contradicts recorded facts`);
        if (result.execution.state !== "completed" && result.result.state === "reported")
            fail(`checks[${index}] cannot report a result without completed execution`);
        return result;
    });
    if (new Set(checks.map((check) => check.id)).size !== checks.length)
        fail("check IDs must be unique");
    return { kind: "archie-architecture-status", version: 1, repository: { name, revision }, generatedAt, freshnessPolicy: { maxAgeSeconds }, checks };
}
/** Produces fixed-order canonical UTF-8 JSON bytes. */
export function serializeArchitectureStatusSnapshotV1(snapshot) {
    const normalized = validateArchitectureStatusSnapshotV1(snapshot);
    return `${JSON.stringify(normalized, null, 2)}\n`;
}
export const canonicalizeArchitectureStatusSnapshotV1 = serializeArchitectureStatusSnapshotV1;
function reportObject(value) {
    const input = typeof value === "string" ? (() => { try {
        return JSON.parse(value);
    }
    catch {
        fail("normalized report is malformed JSON");
    } })() : value;
    rejectOutputFields(input);
    const item = object(input, "normalized report");
    if (item.kind !== "archie-architecture-status-report" || item.version !== 1)
        fail("normalized report kind/version is unsupported");
    const result = object(item.result, "normalized report.result");
    const report = { kind: "archie-architecture-status-report", version: 1, checkId: id(item.checkId, "normalized report.checkId"), observedAt: timestamp(item.observedAt, "normalized report.observedAt"), observedRevision: string(item.observedRevision, "normalized report.observedRevision", 256), result: { code: id(result.code, "normalized report.result.code"), label: string(result.label, "normalized report.result.label"), summary: string(result.summary, "normalized report.result.summary") } };
    const counts = normalizeCounts(result.counts, "normalized report.result.counts");
    const findingIds = normalizeFindingIds(result.findingIds, "normalized report.result.findingIds");
    if (counts)
        report.result.counts = counts;
    if (findingIds)
        report.result.findingIds = findingIds;
    if (item.evidence !== undefined) {
        const evidence = object(item.evidence, "normalized report.evidence");
        report.evidence = { path: path(evidence.path, "normalized report.evidence.path"), sha256: digest(evidence.sha256, "normalized report.evidence.sha256"), ...(evidence.observedAt === undefined ? {} : { observedAt: timestamp(evidence.observedAt, "normalized report.evidence.observedAt") }), ...(evidence.observedRevision === undefined ? {} : { observedRevision: string(evidence.observedRevision, "normalized report.evidence.observedRevision", 256) }) };
    }
    return report;
}
/** Adapts a bounded normalized-json-v1 report without looking at process output. */
export function adaptNormalizedJsonReportV1(report, checkId) {
    const result = reportObject(report);
    if (checkId !== undefined && result.checkId !== checkId)
        fail("normalized report identity contradicts configured check");
    return result;
}
export const normalizeNormalizedJsonReportV1 = adaptNormalizedJsonReportV1;
/** Maps an explicit target-owned exit code; it never interprets stdout or stderr. */
export function adaptDeclaredExitMapV1(exitCode, exitMap) {
    if (!Number.isInteger(exitCode))
        fail("exit code is invalid");
    const mapped = exitMap[String(exitCode)];
    if (!mapped)
        return { state: "unknown", reason: "exit-unmapped" };
    const normalized = normalizeResult({ state: "reported", ...mapped });
    return normalized;
}
export const normalizeDeclaredExitMapV1 = adaptDeclaredExitMapV1;
function safeEvidencePath(root, relative) {
    const absolute = resolve(root, relative);
    if (absolute !== resolve(root) && !absolute.startsWith(`${resolve(root)}${sep}`))
        fail("evidence path escapes repository root");
    return absolute;
}
function hashFile(root, relative) {
    const file = safeEvidencePath(root, relative);
    if (!existsSync(file))
        return undefined;
    const bytes = readFileSync(file);
    return createHash("sha256").update(bytes).digest("hex");
}
function executionFromInput(input) {
    const run = input.run ?? input.execution;
    if (!run)
        return { state: "not-run", reason: "no-run-facts" };
    return normalizeExecution(run);
}
function missingEvidence(reason) { return { state: "missing", reason }; }
function buildCheck(input, generatedAt, revision, maxAgeSeconds, root, prior) {
    path(input.evidencePath, "evidencePath");
    const execution = executionFromInput(input);
    const adapter = typeof input.adapter === "object" ? input.adapter.kind : (input.adapter ?? (input.exitMap ? "declared-exit-map-v1" : "declared-exit-map-v1"));
    let result = { state: "unknown", reason: "no-report" };
    let evidence = missingEvidence("evidence-missing");
    if (execution.state === "completed") {
        if (adapter === "normalized-json-v1") {
            const reportPath = (typeof input.adapter === "object" && input.adapter.kind === "normalized-json-v1" ? input.adapter.reportPath : undefined) ?? input.reportPath;
            let report;
            if (input.report !== undefined)
                report = adaptNormalizedJsonReportV1(input.report, input.id);
            else if (reportPath) {
                const absolute = safeEvidencePath(root, path(reportPath, "reportPath"));
                if (existsSync(absolute))
                    report = adaptNormalizedJsonReportV1(readFileSync(absolute, "utf8"), input.id);
            }
            if (report) {
                compareTime(report.observedAt, generatedAt, "normalized report observedAt is after generatedAt");
                if (report.observedRevision !== revision.commit)
                    result = { state: "unknown", reason: "report-revision-mismatch" };
                else
                    result = { state: "reported", ...report.result };
                const reportEvidence = report.evidence;
                if (reportEvidence) {
                    if (reportEvidence.path !== input.evidencePath)
                        fail("normalized report evidence path contradicts configured evidencePath");
                    const actual = hashFile(root, reportEvidence.path);
                    if (actual === undefined)
                        evidence = missingEvidence("evidence-missing");
                    else {
                        if (actual !== reportEvidence.sha256)
                            fail("evidence digest does not match artifact");
                        evidence = { state: "present", source: "current", path: reportEvidence.path, sha256: actual, observedAt: reportEvidence.observedAt ?? report.observedAt, observedRevision: reportEvidence.observedRevision ?? report.observedRevision };
                    }
                }
            }
        }
        else if (adapter === "declared-exit-map-v1") {
            const map = (typeof input.adapter === "object" && input.adapter.kind === "declared-exit-map-v1" ? input.adapter.exitMap : undefined) ?? input.exitMap ?? {};
            result = adaptDeclaredExitMapV1(execution.exitCode, map);
            const evidencePath = path(input.evidencePath, "evidencePath");
            const actual = hashFile(root, evidencePath);
            if (actual)
                evidence = { state: "present", source: "current", path: evidencePath, sha256: actual, observedAt: execution.finishedAt, observedRevision: revision.commit };
        }
        else
            fail("adapter is unsupported");
    }
    if (evidence.state === "missing" && prior?.evidence.state === "present" && path(prior.evidence.path, "retained evidence path") === input.evidencePath) {
        evidence = { ...prior.evidence, source: "retained" };
    }
    const freshnessValue = freshness(generatedAt, revision, evidence, maxAgeSeconds);
    return { id: id(input.id, "check.id"), title: string(input.title ?? input.id, "check.title"), authority: string(input.authority, "check.authority"), resultMeaning: string(input.resultMeaning, "check.resultMeaning"), limits: orderedUnique(input.limits ?? [], "check.limits"), execution, result, evidence, freshness: freshnessValue };
}
/** Builds and atomically publishes one latest snapshot. */
export function writeArchitectureStatusSnapshotV1(options) {
    const generatedAt = timestamp(options.generatedAt, "generatedAt");
    const repository = object(options.repository, "repository");
    const revision = normalizeRevision(repository.revision);
    const name = string(repository.name, "repository.name");
    const maxAgeSeconds = options.maxAgeSeconds ?? 86_400;
    if (!Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 0 || maxAgeSeconds > 31_536_000)
        fail("maxAgeSeconds is invalid");
    if (!Array.isArray(options.checks))
        fail("checks must be an array");
    const priorPath = options.previousSnapshotPath ?? options.outputPath;
    const prior = existsSync(priorPath) ? validateArchitectureStatusSnapshotV1(JSON.parse(readFileSync(priorPath, "utf8"))) : undefined;
    const priorById = new Map(prior?.checks.map((check) => [check.id, check]));
    const checks = options.checks.map((check) => buildCheck(check, generatedAt, revision, maxAgeSeconds, options.repositoryRoot ?? process.cwd(), priorById.get(check.id)));
    const snapshot = validateArchitectureStatusSnapshotV1({ kind: "archie-architecture-status", version: 1, repository: { name, revision }, generatedAt, freshnessPolicy: { maxAgeSeconds }, checks });
    const bytes = serializeArchitectureStatusSnapshotV1(snapshot);
    const target = resolve(options.outputPath);
    const temporary = `${target}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
    try {
        writeFileSync(temporary, bytes, { encoding: "utf8", flag: "wx" });
        renameSync(temporary, target);
    }
    catch (error) {
        try {
            unlinkSync(temporary);
        }
        catch { /* best effort cleanup */ }
        throw error;
    }
    return snapshot;
}
export const publishArchitectureStatusSnapshotV1 = writeArchitectureStatusSnapshotV1;
export const writeArchitectureStatusSnapshot = writeArchitectureStatusSnapshotV1;
export const validateArchitectureStatusSnapshot = validateArchitectureStatusSnapshotV1;
export const serializeArchitectureStatusSnapshot = serializeArchitectureStatusSnapshotV1;
export const createArchitectureStatusSnapshotV1 = writeArchitectureStatusSnapshotV1;
//# sourceMappingURL=architecture-status-v1.js.map
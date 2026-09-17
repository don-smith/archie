import { validateConformanceReport } from "./formats/validate.js";
import { validateOnboardingState } from "./onboarding-state/validate.js";
export const CONFORMANCE_REPORT_V1 = "conformance-report/v1";
export const ONBOARDING_STATE_V1 = "onboarding-state/v1";
export const CONFORMANCE_REPORT_CONTRACT_V1 = "conformance-report-contract/v1";
export const CONFORMANCE_STATE_CONTRACT_V1 = "conformance-state-contract/v1";
import { exactKeys, fail, oneOf, record, string } from "./formats/helpers.js";
function paths(value, label) {
    const raw = record(value, label);
    exactKeys(raw, ["state", "graph", "summary", "map", "contract", "report", "baseline"], label);
    return { state: string(raw.state, `${label}.state`), graph: string(raw.graph, `${label}.graph`), summary: string(raw.summary, `${label}.summary`), map: string(raw.map, `${label}.map`), contract: string(raw.contract, `${label}.contract`), report: string(raw.report, `${label}.report`), baseline: string(raw.baseline, `${label}.baseline`) };
}
function evidence(value, label) {
    const raw = record(value, label);
    exactKeys(raw, ["graph", "summary", "map", "contract", "report", "baseline"], label);
    const result = {};
    for (const key of ["graph", "summary", "map", "contract", "report", "baseline"])
        if (raw[key] !== undefined)
            result[key] = string(raw[key], `${label}.${key}`);
    return result;
}
function freshness(value, label) {
    const raw = record(value, label);
    exactKeys(raw, ["status", "inputs", "reason"], label);
    return { status: oneOf(raw.status, ["fresh", "stale", "unavailable", "unknown"], `${label}.status`), inputs: (Array.isArray(raw.inputs) ? raw.inputs : fail(`${label}.inputs must be an array`)).map((item, index) => { const input = record(item, `${label}.inputs[${index}]`); exactKeys(input, ["kind", "path", "digest"], `${label}.inputs[${index}]`); return { kind: string(input.kind, `${label}.inputs[${index}].kind`), path: string(input.path, `${label}.inputs[${index}].path`), digest: string(input.digest, `${label}.inputs[${index}].digest`) }; }), reason: string(raw.reason, `${label}.reason`) };
}
function checkpoint(value, label) { return oneOf(value, ["scope-selected", "evidence-generated", "classification-drafted", "proposed-contract-checked", "active-contract-checked", "baseline-created"], label); }
function stateReference(value, label) {
    const raw = record(value, label);
    exactKeys(raw, ["version", "identity", "checkpoint", "paths", "evidence"], label);
    if (raw.version !== ONBOARDING_STATE_V1)
        fail(`unsupported state version: ${String(raw.version)}`);
    const selectedCheckpoint = checkpoint(raw.checkpoint, `${label}.checkpoint`);
    const selectedEvidence = evidence(raw.evidence, `${label}.evidence`);
    const required = {
        "scope-selected": [], "evidence-generated": ["graph", "summary"], "classification-drafted": ["graph", "summary", "map"],
        "proposed-contract-checked": ["graph", "summary", "map", "contract", "report"], "active-contract-checked": ["graph", "summary", "map", "contract", "report"],
        "baseline-created": ["graph", "summary", "map", "contract", "report", "baseline"],
    };
    for (const name of required[selectedCheckpoint])
        if (!selectedEvidence[name])
            fail(`${label}.evidence requires ${name} at checkpoint ${selectedCheckpoint}`);
    return { version: ONBOARDING_STATE_V1, identity: string(raw.identity, `${label}.identity`), checkpoint: selectedCheckpoint, paths: paths(raw.paths, `${label}.paths`), evidence: selectedEvidence };
}
export function readConformanceReport(value) { return validateConformanceReport(value); }
export function readOnboardingState(value, repositoryRoot) { return validateOnboardingState(value, repositoryRoot); }
export function readConformanceReportContract(value) {
    const raw = record(value, "conformance report contract");
    exactKeys(raw, ["version", "report", "state"], "conformance report contract");
    if (raw.version !== CONFORMANCE_REPORT_CONTRACT_V1)
        fail(`unsupported document version: ${String(raw.version)}`);
    const reportRaw = record(raw.report, "report");
    exactKeys(reportRaw, ["version", "identity", "result", "evidence", "freshness"], "report");
    if (reportRaw.version !== CONFORMANCE_REPORT_V1)
        fail(`unsupported report version: ${String(reportRaw.version)}`);
    const identity = record(reportRaw.identity, "report.identity");
    exactKeys(identity, ["id", "producer", "outputDigest"], "report.identity");
    if (identity.producer !== "@archie/conformance")
        fail("report.identity.producer must be @archie/conformance");
    const result = record(reportRaw.result, "report.result");
    exactKeys(result, ["code", "meaning", "status"], "report.result");
    const code = result.code;
    if (!Number.isInteger(code) || code < 0 || code > 3)
        fail("report.result.code must be 0, 1, 2, or 3");
    const codeMeanings = { 0: "pass", 1: "blocking-violation", 2: "incomplete-evidence", 3: "invalid-input" };
    const codeStatuses = ["pass", "violation", "incomplete", "invalid"];
    if (result.meaning !== codeMeanings[code])
        fail("report.result meaning does not match result code");
    const parsedResult = { code: code, meaning: result.meaning, status: oneOf(result.status, codeStatuses, "report.result.status") };
    const evidenceRaw = record(reportRaw.evidence, "report.evidence");
    exactKeys(evidenceRaw, ["realizationMap", "contract", "graph", "provenance"], "report.evidence");
    const parsedEvidence = { realizationMap: string(evidenceRaw.realizationMap, "report.evidence.realizationMap"), contract: string(evidenceRaw.contract, "report.evidence.contract"), graph: string(evidenceRaw.graph, "report.evidence.graph"), provenance: string(evidenceRaw.provenance, "report.evidence.provenance") };
    return { version: CONFORMANCE_REPORT_CONTRACT_V1, report: { version: CONFORMANCE_REPORT_V1, identity: { id: string(identity.id, "report.identity.id"), producer: "@archie/conformance", outputDigest: string(identity.outputDigest, "report.identity.outputDigest") }, result: parsedResult, evidence: parsedEvidence, freshness: freshness(reportRaw.freshness, "report.freshness") }, state: stateReference(raw.state, "state") };
}
export function readConformanceStateContract(value) {
    const raw = record(value, "conformance state contract");
    exactKeys(raw, ["version", "stateVersion", "identity", "checkpoint", "paths", "evidence", "freshness"], "conformance state contract");
    if (raw.version !== CONFORMANCE_STATE_CONTRACT_V1)
        fail(`unsupported document version: ${String(raw.version)}`);
    if (raw.stateVersion !== ONBOARDING_STATE_V1)
        fail(`unsupported state version: ${String(raw.stateVersion)}`);
    const state = stateReference({ version: ONBOARDING_STATE_V1, identity: raw.identity, checkpoint: raw.checkpoint, paths: raw.paths, evidence: raw.evidence }, "state");
    return { version: CONFORMANCE_STATE_CONTRACT_V1, stateVersion: ONBOARDING_STATE_V1, identity: state.identity, checkpoint: state.checkpoint, paths: state.paths, evidence: state.evidence, freshness: freshness(raw.freshness, "freshness") };
}
//# sourceMappingURL=public.js.map
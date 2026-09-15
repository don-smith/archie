import { validateConformanceReport } from "./formats/validate.js";
import { validateOnboardingState } from "./onboarding-state/validate.js";
import type { ConformanceReportV1 } from "./formats/types.js";
import type { OnboardingStateV1 } from "./onboarding-state/types.js";

export const CONFORMANCE_REPORT_V1 = "conformance-report/v1" as const;
export const ONBOARDING_STATE_V1 = "onboarding-state/v1" as const;
export const CONFORMANCE_REPORT_CONTRACT_V1 = "conformance-report-contract/v1" as const;
export const CONFORMANCE_STATE_CONTRACT_V1 = "conformance-state-contract/v1" as const;

export type ConformanceResultCode = 0 | 1 | 2 | 3;
export type ConformanceResultMeaning = "pass" | "blocking-violation" | "incomplete-evidence" | "invalid-input";
export type ContractFreshness = "fresh" | "stale" | "unavailable" | "unknown";

export interface ConformanceInputEvidence { kind: string; path: string; digest: string }
export interface ConformanceFreshness { status: ContractFreshness; inputs: ConformanceInputEvidence[]; reason: string }
export interface ConformanceReportContractV1 {
  version: typeof CONFORMANCE_REPORT_CONTRACT_V1;
  report: {
    version: typeof CONFORMANCE_REPORT_V1;
    identity: { id: string; producer: "@archie/conformance"; outputDigest: string };
    result: { code: ConformanceResultCode; meaning: ConformanceResultMeaning; status: "pass" | "violation" | "incomplete" | "invalid" };
    evidence: { realizationMap: string; contract: string; graph: string; provenance: string };
    freshness: ConformanceFreshness;
  };
  state: ConformanceStateReferenceV1;
}
export interface ConformanceStateReferenceV1 {
  version: typeof ONBOARDING_STATE_V1;
  identity: string;
  checkpoint: OnboardingStateV1["checkpoint"];
  paths: OnboardingStateV1["paths"];
  evidence: Partial<Record<"graph" | "summary" | "map" | "contract" | "report" | "baseline", string>>;
}
export interface ConformanceStateContractV1 {
  version: typeof CONFORMANCE_STATE_CONTRACT_V1;
  stateVersion: typeof ONBOARDING_STATE_V1;
  identity: string;
  checkpoint: OnboardingStateV1["checkpoint"];
  paths: OnboardingStateV1["paths"];
  evidence: ConformanceStateReferenceV1["evidence"];
  freshness: ConformanceFreshness;
}

function fail(message: string): never { throw new TypeError(message); }
function record(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`); return value as Record<string, unknown>; }
function exact(raw: Record<string, unknown>, allowed: readonly string[], label: string): void { for (const key of Object.keys(raw)) if (!allowed.includes(key)) fail(`${label} has unknown field ${key}`); }
function string(value: unknown, label: string): string { if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty string`); return value; }
function strings(value: unknown, label: string): string[] { if (!Array.isArray(value)) fail(`${label} must be an array`); return value.map((item, index) => string(item, `${label}[${index}]`)); }
function choice<T extends string>(value: unknown, values: readonly T[], label: string): T { const result = string(value, label) as T; if (!values.includes(result)) fail(`${label} must be one of ${values.join(", ")}`); return result; }
function paths(value: unknown, label: string): ConformanceStateReferenceV1["paths"] {
  const raw = record(value, label); exact(raw, ["state", "graph", "summary", "map", "contract", "report", "baseline"], label);
  return { state: string(raw.state, `${label}.state`), graph: string(raw.graph, `${label}.graph`), summary: string(raw.summary, `${label}.summary`), map: string(raw.map, `${label}.map`), contract: string(raw.contract, `${label}.contract`), report: string(raw.report, `${label}.report`), baseline: string(raw.baseline, `${label}.baseline`) };
}
function evidence(value: unknown, label: string): ConformanceStateReferenceV1["evidence"] {
  const raw = record(value, label); exact(raw, ["graph", "summary", "map", "contract", "report", "baseline"], label);
  const result: ConformanceStateReferenceV1["evidence"] = {};
  for (const key of ["graph", "summary", "map", "contract", "report", "baseline"] as const) if (raw[key] !== undefined) result[key] = string(raw[key], `${label}.${key}`);
  return result;
}
function freshness(value: unknown, label: string): ConformanceFreshness {
  const raw = record(value, label); exact(raw, ["status", "inputs", "reason"], label);
  return { status: choice(raw.status, ["fresh", "stale", "unavailable", "unknown"] as const, `${label}.status`), inputs: (Array.isArray(raw.inputs) ? raw.inputs : fail(`${label}.inputs must be an array`)).map((item, index) => { const input = record(item, `${label}.inputs[${index}]`); exact(input, ["kind", "path", "digest"], `${label}.inputs[${index}]`); return { kind: string(input.kind, `${label}.inputs[${index}].kind`), path: string(input.path, `${label}.inputs[${index}].path`), digest: string(input.digest, `${label}.inputs[${index}].digest`) }; }), reason: string(raw.reason, `${label}.reason`) };
}
function checkpoint(value: unknown, label: string): OnboardingStateV1["checkpoint"] { return choice(value, ["scope-selected", "evidence-generated", "classification-drafted", "proposed-contract-checked", "active-contract-checked", "baseline-created"] as const, label); }
function stateReference(value: unknown, label: string): ConformanceStateReferenceV1 {
  const raw = record(value, label); exact(raw, ["version", "identity", "checkpoint", "paths", "evidence"], label);
  if (raw.version !== ONBOARDING_STATE_V1) fail(`unsupported state version: ${String(raw.version)}`);
  const selectedCheckpoint = checkpoint(raw.checkpoint, `${label}.checkpoint`);
  const selectedEvidence = evidence(raw.evidence, `${label}.evidence`);
  const required: Record<OnboardingStateV1["checkpoint"], readonly string[]> = {
    "scope-selected": [], "evidence-generated": ["graph", "summary"], "classification-drafted": ["graph", "summary", "map"],
    "proposed-contract-checked": ["graph", "summary", "map", "contract", "report"], "active-contract-checked": ["graph", "summary", "map", "contract", "report"],
    "baseline-created": ["graph", "summary", "map", "contract", "report", "baseline"],
  };
  for (const name of required[selectedCheckpoint]) if (!selectedEvidence[name as keyof typeof selectedEvidence]) fail(`${label}.evidence requires ${name} at checkpoint ${selectedCheckpoint}`);
  return { version: ONBOARDING_STATE_V1, identity: string(raw.identity, `${label}.identity`), checkpoint: selectedCheckpoint, paths: paths(raw.paths, `${label}.paths`), evidence: selectedEvidence };
}

export function readConformanceReport(value: unknown): ConformanceReportV1 { return validateConformanceReport(value); }
export function readOnboardingState(value: unknown, repositoryRoot?: string): OnboardingStateV1 { return validateOnboardingState(value, repositoryRoot); }

export function readConformanceReportContract(value: unknown): ConformanceReportContractV1 {
  const raw = record(value, "conformance report contract"); exact(raw, ["version", "report", "state"], "conformance report contract");
  if (raw.version !== CONFORMANCE_REPORT_CONTRACT_V1) fail(`unsupported document version: ${String(raw.version)}`);
  const reportRaw = record(raw.report, "report"); exact(reportRaw, ["version", "identity", "result", "evidence", "freshness"], "report");
  if (reportRaw.version !== CONFORMANCE_REPORT_V1) fail(`unsupported report version: ${String(reportRaw.version)}`);
  const identity = record(reportRaw.identity, "report.identity"); exact(identity, ["id", "producer", "outputDigest"], "report.identity");
  if (identity.producer !== "@archie/conformance") fail("report.identity.producer must be @archie/conformance");
  const result = record(reportRaw.result, "report.result"); exact(result, ["code", "meaning", "status"], "report.result");
  const code = result.code as number;
  if (!Number.isInteger(code) || code < 0 || code > 3) fail("report.result.code must be 0, 1, 2, or 3");
  const codeMeanings: Record<number, ConformanceResultMeaning> = { 0: "pass", 1: "blocking-violation", 2: "incomplete-evidence", 3: "invalid-input" };
  const codeStatuses = ["pass", "violation", "incomplete", "invalid"] as const;
  if (result.meaning !== codeMeanings[code]) fail("report.result meaning does not match result code");
  const parsedResult = { code: code as ConformanceResultCode, meaning: result.meaning as ConformanceResultMeaning, status: choice(result.status, codeStatuses, "report.result.status") };
  const evidenceRaw = record(reportRaw.evidence, "report.evidence"); exact(evidenceRaw, ["realizationMap", "contract", "graph", "provenance"], "report.evidence");
  const parsedEvidence = { realizationMap: string(evidenceRaw.realizationMap, "report.evidence.realizationMap"), contract: string(evidenceRaw.contract, "report.evidence.contract"), graph: string(evidenceRaw.graph, "report.evidence.graph"), provenance: string(evidenceRaw.provenance, "report.evidence.provenance") };
  return { version: CONFORMANCE_REPORT_CONTRACT_V1, report: { version: CONFORMANCE_REPORT_V1, identity: { id: string(identity.id, "report.identity.id"), producer: "@archie/conformance", outputDigest: string(identity.outputDigest, "report.identity.outputDigest") }, result: parsedResult, evidence: parsedEvidence, freshness: freshness(reportRaw.freshness, "report.freshness") }, state: stateReference(raw.state, "state") };
}

export function readConformanceStateContract(value: unknown): ConformanceStateContractV1 {
  const raw = record(value, "conformance state contract"); exact(raw, ["version", "stateVersion", "identity", "checkpoint", "paths", "evidence", "freshness"], "conformance state contract");
  if (raw.version !== CONFORMANCE_STATE_CONTRACT_V1) fail(`unsupported document version: ${String(raw.version)}`);
  if (raw.stateVersion !== ONBOARDING_STATE_V1) fail(`unsupported state version: ${String(raw.stateVersion)}`);
  const state = stateReference({ version: ONBOARDING_STATE_V1, identity: raw.identity, checkpoint: raw.checkpoint, paths: raw.paths, evidence: raw.evidence }, "state");
  return { version: CONFORMANCE_STATE_CONTRACT_V1, stateVersion: ONBOARDING_STATE_V1, identity: state.identity, checkpoint: state.checkpoint, paths: state.paths, evidence: state.evidence, freshness: freshness(raw.freshness, "freshness") };
}

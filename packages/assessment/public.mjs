const VERSION = "assessment-evidence/v1";
const statuses = ["in-progress", "blocked", "ready"];
const availabilityStates = ["available", "unavailable", "unknown"];
const completenessStates = ["complete", "partial"];

function fail(message) { throw new TypeError(message); }
function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}
function exact(value, keys, label) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${label} has unknown field ${key}`);
}
function string(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}
function strings(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((item, index) => string(item, `${label}[${index}]`));
}
function choice(value, values, label) {
  const result = string(value, label);
  if (!values.includes(result)) fail(`${label} must be one of ${values.join(", ")}`);
  return result;
}
function digest(value, label) { return string(value, label); }
function source(value, index) {
  const raw = record(value, `evidence.sources[${index}]`);
  exact(raw, ["id", "kind", "locator", "digest"], `evidence.sources[${index}]`);
  return { id: string(raw.id, `evidence.sources[${index}].id`), kind: choice(raw.kind, ["code", "configuration", "intent", "decision", "test", "history", "external", "developer"], `evidence.sources[${index}].kind`), locator: string(raw.locator, `evidence.sources[${index}].locator`), digest: digest(raw.digest, `evidence.sources[${index}].digest`) };
}

export const ASSESSMENT_EVIDENCE_V1 = VERSION;

export function readAssessmentEvidence(value) {
  const raw = record(value, "assessment evidence");
  exact(raw, ["version", "assessmentId", "status", "completeness", "evidence", "correction", "triage", "authority"], "assessment evidence");
  if (raw.version !== VERSION) fail(`unsupported document version: ${String(raw.version)}`);
  const completenessRaw = record(raw.completeness, "completeness");
  exact(completenessRaw, ["status", "scope", "inventory", "model", "requiredArtifacts", "missingArtifacts"], "completeness");
  const completeness = {
    status: choice(completenessRaw.status, completenessStates, "completeness.status"),
    scope: choice(completenessRaw.scope, completenessStates, "completeness.scope"),
    inventory: choice(completenessRaw.inventory, completenessStates, "completeness.inventory"),
    model: choice(completenessRaw.model, completenessStates, "completeness.model"),
    requiredArtifacts: strings(completenessRaw.requiredArtifacts, "completeness.requiredArtifacts"),
    missingArtifacts: strings(completenessRaw.missingArtifacts, "completeness.missingArtifacts"),
  };
  if (completeness.status === "complete" && (!completeness.requiredArtifacts.length || completeness.missingArtifacts.length || [completeness.scope, completeness.inventory, completeness.model].some((item) => item !== "complete"))) fail("completeness is incomplete");
  const evidenceRaw = record(raw.evidence, "evidence");
  exact(evidenceRaw, ["availability", "sources", "unknowns", "unavailable"], "evidence");
  const evidence = {
    availability: choice(evidenceRaw.availability, availabilityStates, "evidence.availability"),
    sources: Array.isArray(evidenceRaw.sources) ? evidenceRaw.sources.map(source) : fail("evidence.sources must be an array"),
    unknowns: strings(evidenceRaw.unknowns, "evidence.unknowns"),
    unavailable: (Array.isArray(evidenceRaw.unavailable) ? evidenceRaw.unavailable : fail("evidence.unavailable must be an array")).map((item, index) => {
      const unavailable = record(item, `evidence.unavailable[${index}]`);
      exact(unavailable, ["id", "reason"], `evidence.unavailable[${index}]`);
      return { id: string(unavailable.id, `evidence.unavailable[${index}].id`), reason: string(unavailable.reason, `evidence.unavailable[${index}].reason`) };
    }),
  };
  if (evidence.sources.length === 0) fail("evidence requires at least one source");
  const correctionRaw = record(raw.correction, "correction");
  exact(correctionRaw, ["status", "summary", "unresolved"], "correction");
  const correction = { status: choice(correctionRaw.status, ["pending", "completed"], "correction.status"), summary: typeof correctionRaw.summary === "string" ? correctionRaw.summary : fail("correction.summary must be a string"), unresolved: strings(correctionRaw.unresolved, "correction.unresolved") };
  const triageRaw = record(raw.triage, "triage");
  exact(triageRaw, ["status", "recommendations", "unresolved"], "triage");
  const triage = {
    status: choice(triageRaw.status, ["pending", "completed"], "triage.status"),
    recommendations: (Array.isArray(triageRaw.recommendations) ? triageRaw.recommendations : fail("triage.recommendations must be an array")).map((item, index) => {
      const recommendation = record(item, `triage.recommendations[${index}]`);
      exact(recommendation, ["id", "outcome", "reason", "dependencies", "candidateChecks"], `triage.recommendations[${index}]`);
      return { id: string(recommendation.id, `triage.recommendations[${index}].id`), outcome: choice(recommendation.outcome, ["pending", "accepted", "rejected", "deferred"], `triage.recommendations[${index}].outcome`), reason: typeof recommendation.reason === "string" ? recommendation.reason : fail("recommendation.reason must be a string"), dependencies: strings(recommendation.dependencies, `triage.recommendations[${index}].dependencies`), candidateChecks: strings(recommendation.candidateChecks, `triage.recommendations[${index}].candidateChecks`) };
    }),
    unresolved: strings(triageRaw.unresolved, "triage.unresolved"),
  };
  const authorityRaw = record(raw.authority, "authority");
  exact(authorityRaw, ["facts", "recommendations", "approval", "authorization"], "authority");
  const authority = { facts: choice(authorityRaw.facts, ["assessment-evidence"], "authority.facts"), recommendations: choice(authorityRaw.recommendations, ["developer"], "authority.recommendations"), approval: choice(authorityRaw.approval, ["developer"], "authority.approval"), authorization: choice(authorityRaw.authorization, ["none"], "authority.authorization") };
  const status = choice(raw.status, statuses, "status");
  if (status === "ready" && (completeness.status !== "complete" || completeness.missingArtifacts.length || correction.status !== "completed" || correction.unresolved.length || triage.status !== "completed" || triage.unresolved.length || triage.recommendations.some((item) => item.outcome === "pending"))) fail("ready assessment evidence requires complete completeness, correction, and triage");
  return { version: VERSION, assessmentId: string(raw.assessmentId, "assessmentId"), status, completeness, evidence, correction, triage, authority };
}

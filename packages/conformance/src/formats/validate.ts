import type { ArchitectureActiveResultSetV1, ArchitectureContractV1, ArchitectureDriftRecordV1, BaselineV1, ConformanceReportV1, NormalizedGraphV1, RealizationMapV1, Rule } from "./types.js";
import { array, exactKeys, fail, oneOf, record, string, strings, version } from "./helpers.js";

export function validateRealizationMap(value: unknown): RealizationMapV1 {
  const raw = record(value, "realization map"); version(raw, "realization-map/v1");
  const scopeRaw = record(raw.scope, "scope");
  const scope = {
    rootConfigs: strings(scopeRaw.rootConfigs, "scope.rootConfigs"), include: strings(scopeRaw.include, "scope.include"),
    exclusions: array(scopeRaw.exclusions, "scope.exclusions").map((item, index) => { const exclusion = record(item, `scope.exclusions[${index}]`); return { path: string(exclusion.path, "exclusion.path"), reason: string(exclusion.reason, "exclusion.reason") }; })
  };
  const elements = array(raw.elements, "elements").map((item, index) => { const element = record(item, `elements[${index}]`); return { id: string(element.id, "element.id"), ...(typeof element.name === "string" ? { name: element.name } : {}) }; });
  if (new Set(elements.map((element) => element.id)).size !== elements.length) fail("element IDs must be unique");
  const mappings = array(raw.mappings, "mappings").map((item, index) => {
    const mapping = record(item, `mappings[${index}]`); const path = mapping.path; const module = mapping.module;
    if ((typeof path === "string") === (typeof module === "string")) fail("a mapping requires exactly one selector: path or module");
    const elementId = string(mapping.elementId, "mapping.elementId");
    if (!elements.some((element) => element.id === elementId)) fail(`mapping references unknown element ${elementId}`);
    return { elementId, ...(typeof path === "string" ? { path: string(path, "mapping.path") } : { module: string(module, "mapping.module") }) };
  });
  return { version: "realization-map/v1", scope, elements, mappings };
}

function validateRule(value: unknown, index: number): Rule {
  const raw = record(value, `rules[${index}]`); const kind = oneOf(raw.kind, ["dependency-policy", "acyclic"] as const, "rule.kind");
  const shared = { id: string(raw.id, "rule.id"), kind, intent: string(raw.intent, "rule.intent"), enforcement: oneOf(raw.enforcement, ["active", "proposed", "deprecated"] as const, "rule.enforcement"), severity: oneOf(raw.severity, ["error", "warning"] as const, "rule.severity"), world: oneOf(raw.world, ["open", "closed"] as const, "rule.world"), edgeKinds: strings(raw.edgeKinds, "rule.edgeKinds").map((edge) => oneOf(edge, ["runtime", "type"] as const, "rule.edgeKinds")) };
  const approval = raw.approval === undefined ? undefined : (() => { const item = record(raw.approval, "rule.approval"); return { approvedBy: string(item.approvedBy, "approval.approvedBy"), approvedAt: string(item.approvedAt, "approval.approvedAt"), ...(typeof item.reference === "string" ? { reference: item.reference } : {}) }; })();
  if (shared.enforcement === "active" && !approval) fail("active rules require approval metadata");
  if (kind === "dependency-policy") {
    const rule = { ...shared, kind, sources: strings(raw.sources, "rule.sources"), forbiddenTargets: strings(raw.forbiddenTargets, "rule.forbiddenTargets"), ...(raw.allowedTargets === undefined ? {} : { allowedTargets: strings(raw.allowedTargets, "rule.allowedTargets") }), ...(approval ? { approval } : {}) };
    return rule;
  }
  return { ...shared, kind, domain: strings(raw.domain, "rule.domain"), ...(approval ? { approval } : {}) };
}

export function validateArchitectureContract(value: unknown): ArchitectureContractV1 {
  const raw = record(value, "architecture contract"); version(raw, "architecture-contract/v1");
  const rules = array(raw.rules, "rules").map(validateRule);
  if (new Set(rules.map((rule) => rule.id)).size !== rules.length) fail("rule IDs must be unique");
  const exceptions = array(raw.exceptions, "exceptions").map((item, index) => { const exception = record(item, `exceptions[${index}]`); const result = { ruleId: string(exception.ruleId, "exception.ruleId"), fingerprint: string(exception.fingerprint, "exception.fingerprint"), rationale: string(exception.rationale, "exception.rationale"), ...(typeof exception.expiresOn === "string" ? { expiresOn: exception.expiresOn } : {}), ...(typeof exception.removalCondition === "string" ? { removalCondition: exception.removalCondition } : {}), ...(typeof exception.owner === "string" ? { owner: exception.owner } : {}) }; if (!result.expiresOn && !result.removalCondition) fail("exceptions require expiresOn or removalCondition"); return result; });
  return { version: "architecture-contract/v1", rules, exceptions };
}

function validatePosition(value: unknown, label: string): { line: number; column: number } {
  const raw = record(value, label); exactKeys(raw, ["line", "column"], label);
  if (!Number.isInteger(raw.line) || (raw.line as number) < 1) fail(`${label}.line must be a positive integer`);
  if (!Number.isInteger(raw.column) || (raw.column as number) < 0) fail(`${label}.column must be a non-negative integer`);
  return { line: raw.line as number, column: raw.column as number };
}

function validateSpan(value: unknown, label: string): { file: string; start: { line: number; column: number }; end: { line: number; column: number } } {
  const raw = record(value, label); exactKeys(raw, ["file", "start", "end"], label);
  return { file: string(raw.file, `${label}.file`), start: validatePosition(raw.start, `${label}.start`), end: validatePosition(raw.end, `${label}.end`) };
}

function validateEdge(value: unknown, label: string): NormalizedGraphV1["edges"][number] {
  const raw = record(value, label); exactKeys(raw, ["id", "source", "target", "kind", "specifier", "status", "span"], label);
  return {
    id: string(raw.id, `${label}.id`), source: string(raw.source, `${label}.source`),
    ...(raw.target === undefined ? {} : { target: string(raw.target, `${label}.target`) }),
    kind: oneOf(raw.kind, ["runtime", "type"] as const, `${label}.kind`), specifier: typeof raw.specifier === "string" ? raw.specifier : fail(`${label}.specifier must be a string`),
    status: oneOf(raw.status, ["resolved", "unresolved"] as const, `${label}.status`), span: validateSpan(raw.span, `${label}.span`)
  };
}

function validateGap(value: unknown, label: string): NormalizedGraphV1["gaps"][number] {
  const raw = record(value, label); exactKeys(raw, ["kind", "message", "file", "span"], label);
  return { kind: string(raw.kind, `${label}.kind`), message: string(raw.message, `${label}.message`), ...(raw.file === undefined ? {} : { file: string(raw.file, `${label}.file`) }), ...(raw.span === undefined ? {} : { span: validateSpan(raw.span, `${label}.span`) }) };
}

function validateScope(value: unknown, label: string): NonNullable<NormalizedGraphV1["scope"]> {
  const raw = record(value, label); exactKeys(raw, ["rootConfigs", "include", "exclusions"], label);
  return {
    rootConfigs: strings(raw.rootConfigs, `${label}.rootConfigs`), include: strings(raw.include, `${label}.include`),
    exclusions: array(raw.exclusions, `${label}.exclusions`).map((item, index) => {
      const exclusion = record(item, `${label}.exclusions[${index}]`); exactKeys(exclusion, ["path", "reason"], `${label}.exclusions[${index}]`);
      return { path: string(exclusion.path, `${label}.exclusions[${index}].path`), reason: string(exclusion.reason, `${label}.exclusions[${index}].reason`) };
    })
  };
}

export function validateNormalizedGraph(value: unknown): NormalizedGraphV1 {
  const raw = record(value, "normalized graph"); exactKeys(raw, ["version", "scope", "nodes", "edges", "exclusions", "gaps", "provenance"], "normalized graph"); version(raw, "normalized-graph/v1");
  const nodes = array(raw.nodes, "graph.nodes").map((item, index) => {
    const node = record(item, `graph.nodes[${index}]`); exactKeys(node, ["id", "kind", "module", "file"], `graph.nodes[${index}]`);
    return { id: string(node.id, `graph.nodes[${index}].id`), kind: oneOf(node.kind, ["source-module", "external-module"] as const, `graph.nodes[${index}].kind`), module: string(node.module, `graph.nodes[${index}].module`), ...(node.file === undefined ? {} : { file: string(node.file, `graph.nodes[${index}].file`) }) };
  });
  const edges = array(raw.edges, "graph.edges").map((item, index) => validateEdge(item, `graph.edges[${index}]`));
  const exclusions = array(raw.exclusions, "graph.exclusions").map((item, index) => {
    const exclusion = record(item, `graph.exclusions[${index}]`); exactKeys(exclusion, ["path", "reason"], `graph.exclusions[${index}]`);
    return { path: string(exclusion.path, `graph.exclusions[${index}].path`), reason: string(exclusion.reason, `graph.exclusions[${index}].reason`) };
  });
  const gaps = array(raw.gaps, "graph.gaps").map((item, index) => validateGap(item, `graph.gaps[${index}]`));
  const provenanceRaw = record(raw.provenance, "graph.provenance"); exactKeys(provenanceRaw, ["adapter", "compilerVersion", "rootConfigs", "sourceFiles", "resolutionInputs", "compilerOptions"], "graph.provenance");
  if (provenanceRaw.adapter !== "typescript-program-v1") fail("unsupported graph adapter");
  const provenance = { adapter: "typescript-program-v1" as const, compilerVersion: string(provenanceRaw.compilerVersion, "graph.provenance.compilerVersion"), rootConfigs: strings(provenanceRaw.rootConfigs, "graph.provenance.rootConfigs"), sourceFiles: strings(provenanceRaw.sourceFiles, "graph.provenance.sourceFiles"), resolutionInputs: strings(provenanceRaw.resolutionInputs, "graph.provenance.resolutionInputs"), compilerOptions: record(provenanceRaw.compilerOptions, "graph.provenance.compilerOptions") as NormalizedGraphV1["provenance"]["compilerOptions"] };
  return { version: "normalized-graph/v1", ...(raw.scope === undefined ? {} : { scope: validateScope(raw.scope, "graph.scope") }), nodes, edges, exclusions, gaps, provenance };
}

export function validateConformanceReport(value: unknown): ConformanceReportV1 {
  const raw = record(value, "conformance report"); exactKeys(raw, ["version", "digests", "results", "gaps", "graph"], "conformance report"); version(raw, "conformance-report/v1");
  const digests = record(raw.digests, "report.digests"); exactKeys(digests, ["realizationMap", "contract", "graph", "provenance", "output"], "report.digests");
  for (const name of ["realizationMap", "contract", "graph", "provenance", "output"]) string(digests[name], `report.digests.${name}`);
  const results = array(raw.results, "report.results").map((item, index) => {
    const result = record(item, `report.results[${index}]`); exactKeys(result, ["fingerprint", "status", "category", "ruleId", "message", "sourceArchitectureId", "targetArchitectureId", "edge"], `report.results[${index}]`);
    return { fingerprint: string(result.fingerprint, `report.results[${index}].fingerprint`), status: oneOf(result.status, ["active", "waived", "proposed", "new", "unchanged", "reintroduced", "fixed"] as const, `report.results[${index}].status`), category: oneOf(result.category, ["implementation", "documentation", "coverage"] as const, `report.results[${index}].category`), ...(result.ruleId === undefined ? {} : { ruleId: string(result.ruleId, `report.results[${index}].ruleId`) }), message: string(result.message, `report.results[${index}].message`), ...(result.sourceArchitectureId === undefined ? {} : { sourceArchitectureId: string(result.sourceArchitectureId, `report.results[${index}].sourceArchitectureId`) }), ...(result.targetArchitectureId === undefined ? {} : { targetArchitectureId: string(result.targetArchitectureId, `report.results[${index}].targetArchitectureId`) }), ...(result.edge === undefined ? {} : { edge: validateEdge(result.edge, `report.results[${index}].edge`) }) };
  });
  const gaps = array(raw.gaps, "report.gaps").map((item, index) => validateGap(item, `report.gaps[${index}]`));
  const graph = validateNormalizedGraph(raw.graph);
  return { version: "conformance-report/v1", digests: Object.fromEntries(Object.entries(digests).map(([name, digest]) => [name, string(digest, `report.digests.${name}`)])), results, gaps, graph };
}

export function validateBaseline(value: unknown): BaselineV1 {
  const raw = record(value, "baseline"); version(raw, "conformance-baseline/v1");
  return { version: "conformance-baseline/v1", active: strings(raw.active, "baseline.active"), ledger: strings(raw.ledger, "baseline.ledger") };
}

export function validateArchitectureActiveResultSet(value: unknown): ArchitectureActiveResultSetV1 {
  const raw = record(value, "active result set"); version(raw, "architecture-active-result-set/v1");
  return { version: "architecture-active-result-set/v1", results: array(raw.results, "active result set.results").map((item, index) => {
    const result = record(item, `active result set.results[${index}]`);
    return { id: string(result.id, "active result.id"), fingerprint: string(result.fingerprint, "active result.fingerprint") };
  }) };
}

export function validateArchitectureDriftRecord(value: unknown): ArchitectureDriftRecordV1 {
  const raw = record(value, "drift record"); version(raw, "architecture-drift-record/v1");
  return { version: "architecture-drift-record/v1", records: array(raw.records, "drift record.records").map((item, index) => {
    const result = record(item, `drift record.records[${index}]`);
    return { id: string(result.id, "drift record.id"), fingerprint: string(result.fingerprint, "drift record.fingerprint"), state: string(result.state, "drift record.state") };
  }) };
}

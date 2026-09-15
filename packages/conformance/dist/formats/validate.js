function fail(message) { throw new TypeError(message); }
function record(value, label) { if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object`); return value; }
function array(value, label) { if (!Array.isArray(value))
    fail(`${label} must be an array`); return value; }
function string(value, label) { if (typeof value !== "string" || value.length === 0)
    fail(`${label} must be a non-empty string`); return value; }
function strings(value, label) { return array(value, label).map((item, index) => string(item, `${label}[${index}]`)); }
function oneOf(value, choices, label) { const result = string(value, label); if (!choices.includes(result))
    fail(`${label} must be one of ${choices.join(", ")}`); return result; }
function version(value, expected) { if (value.version !== expected)
    fail(`unsupported document version: ${String(value.version)}`); }
export function validateRealizationMap(value) {
    const raw = record(value, "realization map");
    version(raw, "realization-map/v1");
    const scopeRaw = record(raw.scope, "scope");
    const scope = {
        rootConfigs: strings(scopeRaw.rootConfigs, "scope.rootConfigs"), include: strings(scopeRaw.include, "scope.include"),
        exclusions: array(scopeRaw.exclusions, "scope.exclusions").map((item, index) => { const exclusion = record(item, `scope.exclusions[${index}]`); return { path: string(exclusion.path, "exclusion.path"), reason: string(exclusion.reason, "exclusion.reason") }; })
    };
    const elements = array(raw.elements, "elements").map((item, index) => { const element = record(item, `elements[${index}]`); return { id: string(element.id, "element.id"), ...(typeof element.name === "string" ? { name: element.name } : {}) }; });
    if (new Set(elements.map((element) => element.id)).size !== elements.length)
        fail("element IDs must be unique");
    const mappings = array(raw.mappings, "mappings").map((item, index) => {
        const mapping = record(item, `mappings[${index}]`);
        const path = mapping.path;
        const module = mapping.module;
        if ((typeof path === "string") === (typeof module === "string"))
            fail("a mapping requires exactly one selector: path or module");
        const elementId = string(mapping.elementId, "mapping.elementId");
        if (!elements.some((element) => element.id === elementId))
            fail(`mapping references unknown element ${elementId}`);
        return { elementId, ...(typeof path === "string" ? { path: string(path, "mapping.path") } : { module: string(module, "mapping.module") }) };
    });
    return { version: "realization-map/v1", scope, elements, mappings };
}
function validateRule(value, index) {
    const raw = record(value, `rules[${index}]`);
    const kind = oneOf(raw.kind, ["dependency-policy", "acyclic"], "rule.kind");
    const shared = { id: string(raw.id, "rule.id"), kind, intent: string(raw.intent, "rule.intent"), enforcement: oneOf(raw.enforcement, ["active", "proposed", "deprecated"], "rule.enforcement"), severity: oneOf(raw.severity, ["error", "warning"], "rule.severity"), world: oneOf(raw.world, ["open", "closed"], "rule.world"), edgeKinds: strings(raw.edgeKinds, "rule.edgeKinds").map((edge) => oneOf(edge, ["runtime", "type"], "rule.edgeKinds")) };
    const approval = raw.approval === undefined ? undefined : (() => { const item = record(raw.approval, "rule.approval"); return { approvedBy: string(item.approvedBy, "approval.approvedBy"), approvedAt: string(item.approvedAt, "approval.approvedAt"), ...(typeof item.reference === "string" ? { reference: item.reference } : {}) }; })();
    if (shared.enforcement === "active" && !approval)
        fail("active rules require approval metadata");
    if (kind === "dependency-policy") {
        const rule = { ...shared, kind, sources: strings(raw.sources, "rule.sources"), forbiddenTargets: strings(raw.forbiddenTargets, "rule.forbiddenTargets"), ...(raw.allowedTargets === undefined ? {} : { allowedTargets: strings(raw.allowedTargets, "rule.allowedTargets") }), ...(approval ? { approval } : {}) };
        return rule;
    }
    return { ...shared, kind, domain: strings(raw.domain, "rule.domain"), ...(approval ? { approval } : {}) };
}
export function validateArchitectureContract(value) {
    const raw = record(value, "architecture contract");
    version(raw, "architecture-contract/v1");
    const rules = array(raw.rules, "rules").map(validateRule);
    if (new Set(rules.map((rule) => rule.id)).size !== rules.length)
        fail("rule IDs must be unique");
    const exceptions = array(raw.exceptions, "exceptions").map((item, index) => { const exception = record(item, `exceptions[${index}]`); const result = { ruleId: string(exception.ruleId, "exception.ruleId"), fingerprint: string(exception.fingerprint, "exception.fingerprint"), rationale: string(exception.rationale, "exception.rationale"), ...(typeof exception.expiresOn === "string" ? { expiresOn: exception.expiresOn } : {}), ...(typeof exception.removalCondition === "string" ? { removalCondition: exception.removalCondition } : {}), ...(typeof exception.owner === "string" ? { owner: exception.owner } : {}) }; if (!result.expiresOn && !result.removalCondition)
        fail("exceptions require expiresOn or removalCondition"); return result; });
    return { version: "architecture-contract/v1", rules, exceptions };
}
export function validateNormalizedGraph(value) {
    const raw = record(value, "normalized graph");
    version(raw, "normalized-graph/v1");
    for (const key of ["nodes", "edges", "exclusions", "gaps"])
        array(raw[key], key);
    const provenance = record(raw.provenance, "provenance");
    if (provenance.adapter !== "typescript-program-v1")
        fail("unsupported graph adapter");
    return value;
}
export function validateConformanceReport(value) {
    const raw = record(value, "conformance report");
    version(raw, "conformance-report/v1");
    array(raw.results, "report.results");
    array(raw.gaps, "report.gaps");
    validateNormalizedGraph(raw.graph);
    return value;
}
export function validateBaseline(value) {
    const raw = record(value, "baseline");
    version(raw, "conformance-baseline/v1");
    return { version: "conformance-baseline/v1", active: strings(raw.active, "baseline.active"), ledger: strings(raw.ledger, "baseline.ledger") };
}
export function validateArchitectureActiveResultSet(value) {
    const raw = record(value, "active result set");
    version(raw, "architecture-active-result-set/v1");
    return { version: "architecture-active-result-set/v1", results: array(raw.results, "active result set.results").map((item, index) => {
            const result = record(item, `active result set.results[${index}]`);
            return { id: string(result.id, "active result.id"), fingerprint: string(result.fingerprint, "active result.fingerprint") };
        }) };
}
export function validateArchitectureDriftRecord(value) {
    const raw = record(value, "drift record");
    version(raw, "architecture-drift-record/v1");
    return { version: "architecture-drift-record/v1", records: array(raw.records, "drift record.records").map((item, index) => {
            const result = record(item, `drift record.records[${index}]`);
            return { id: string(result.id, "drift record.id"), fingerprint: string(result.fingerprint, "drift record.fingerprint"), state: string(result.state, "drift record.state") };
        }) };
}
//# sourceMappingURL=validate.js.map
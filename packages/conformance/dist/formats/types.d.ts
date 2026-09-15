export type EdgeKind = "runtime" | "type";
export type Enforcement = "active" | "proposed" | "deprecated";
export type World = "open" | "closed";
export type Severity = "error" | "warning";
export interface Span {
    file: string;
    start: {
        line: number;
        column: number;
    };
    end: {
        line: number;
        column: number;
    };
}
export interface SourceScope {
    rootConfigs: string[];
    include: string[];
    exclusions: Array<{
        path: string;
        reason: string;
    }>;
}
export interface RealizationMapV1 {
    version: "realization-map/v1";
    metadata?: Record<string, string>;
    scope: SourceScope;
    elements: Array<{
        id: string;
        name?: string;
    }>;
    mappings: Array<{
        elementId: string;
        path?: string;
        module?: string;
    }>;
}
export interface Approval {
    approvedBy: string;
    approvedAt: string;
    reference?: string;
}
export interface DependencyPolicyRule {
    id: string;
    kind: "dependency-policy";
    intent: string;
    enforcement: Enforcement;
    severity: Severity;
    world: World;
    sources: string[];
    forbiddenTargets: string[];
    allowedTargets?: string[];
    edgeKinds: EdgeKind[];
    approval?: Approval;
}
export interface AcyclicRule {
    id: string;
    kind: "acyclic";
    intent: string;
    enforcement: Enforcement;
    severity: Severity;
    world: World;
    domain: string[];
    edgeKinds: EdgeKind[];
    approval?: Approval;
}
export type Rule = DependencyPolicyRule | AcyclicRule;
export interface ExceptionV1 {
    ruleId: string;
    fingerprint: string;
    rationale: string;
    expiresOn?: string;
    removalCondition?: string;
    owner?: string;
}
export interface ArchitectureContractV1 {
    version: "architecture-contract/v1";
    metadata?: Record<string, string>;
    rules: Rule[];
    exceptions: ExceptionV1[];
}
export interface GraphNode {
    id: string;
    kind: "source-module" | "external-module";
    module: string;
    file?: string;
}
export interface GraphEdge {
    id: string;
    source: string;
    target?: string;
    kind: EdgeKind;
    specifier: string;
    status: "resolved" | "unresolved";
    span: Span;
}
export interface Gap {
    kind: string;
    message: string;
    file?: string;
    span?: Span;
}
export interface Exclusion {
    path: string;
    reason: string;
}
export interface AnalyzerProvenance {
    adapter: "typescript-program-v1";
    compilerVersion: string;
    rootConfigs: string[];
    sourceFiles: string[];
    resolutionInputs: string[];
    compilerOptions: Record<string, string | boolean | number>;
}
export interface NormalizedGraphV1 {
    version: "normalized-graph/v1";
    scope?: SourceScope;
    nodes: GraphNode[];
    edges: GraphEdge[];
    exclusions: Exclusion[];
    gaps: Gap[];
    provenance: AnalyzerProvenance;
}
export interface ReportResult {
    fingerprint: string;
    status: "active" | "waived" | "proposed" | "new" | "unchanged" | "reintroduced" | "fixed";
    category: "implementation" | "documentation" | "coverage";
    ruleId?: string;
    message: string;
    sourceArchitectureId?: string;
    targetArchitectureId?: string;
    edge?: GraphEdge;
}
export interface ConformanceReportV1 {
    version: "conformance-report/v1";
    digests: Record<string, string>;
    results: ReportResult[];
    gaps: Gap[];
    graph: NormalizedGraphV1;
}
export interface BaselineV1 {
    version: "conformance-baseline/v1";
    active: string[];
    ledger: string[];
}
export interface ActiveResult {
    id: string;
    fingerprint: string;
}
export interface ArchitectureActiveResultSetV1 {
    version: "architecture-active-result-set/v1";
    results: ActiveResult[];
}
export interface ArchitectureDriftRecord {
    id: string;
    fingerprint: string;
    state: string;
}
export interface ArchitectureDriftRecordV1 {
    version: "architecture-drift-record/v1";
    records: ArchitectureDriftRecord[];
}
export interface ReconciliationReportV1 {
    version: "architecture-reconciliation-report/v1";
    missing: ActiveResult[];
    duplicates: Array<{
        id: string;
        input: "active" | "drift";
        count: number;
    }>;
    stale: Array<{
        id: string;
        activeFingerprint: string;
        driftFingerprint: string;
    }>;
    resolvedCandidates: ArchitectureDriftRecord[];
}

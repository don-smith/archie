import type { GraphNode, NormalizedGraphV1, ReportResult } from "../formats/types.js";
export interface MappingValidation {
    architectureByNode: Map<string, string>;
    documentation: ReportResult[];
    coverage: ReportResult[];
}
export interface Evaluation {
    graph: NormalizedGraphV1;
    implementation: ReportResult[];
    documentation: ReportResult[];
    coverage: ReportResult[];
    blockingViolations: ReportResult[];
}
export declare function resultFingerprint(result: Omit<ReportResult, "fingerprint">): string;
export declare function sourceNodes(graph: NormalizedGraphV1): GraphNode[];

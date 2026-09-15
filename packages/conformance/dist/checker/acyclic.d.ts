import type { AcyclicRule, GraphEdge, ReportResult } from "../formats/types.js";
export declare function acyclicResults(rule: AcyclicRule, edges: Array<{
    edge: GraphEdge;
    source: string;
    target: string;
}>): ReportResult[];

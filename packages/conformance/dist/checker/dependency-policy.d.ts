import type { DependencyPolicyRule, GraphEdge, ReportResult } from "../formats/types.js";
export declare function dependencyPolicyResults(rule: DependencyPolicyRule, edges: Array<{
    edge: GraphEdge;
    source: string;
    target: string;
}>): ReportResult[];

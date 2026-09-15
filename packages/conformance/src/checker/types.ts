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
export function resultFingerprint(result: Omit<ReportResult, "fingerprint">): string {
  return JSON.stringify([result.ruleId ?? "", result.sourceArchitectureId ?? "", result.targetArchitectureId ?? "", result.edge?.id ?? "", result.category, result.message]);
}
export function sourceNodes(graph: NormalizedGraphV1): GraphNode[] { return graph.nodes.filter((node) => node.kind === "source-module" && node.file !== undefined); }

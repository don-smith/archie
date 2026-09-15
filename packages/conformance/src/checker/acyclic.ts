import { digestJson } from "../artifacts/digest.js";
import type { AcyclicRule, GraphEdge, ReportResult } from "../formats/types.js";

export function acyclicResults(rule: AcyclicRule, edges: Array<{ edge: GraphEdge; source: string; target: string }>): ReportResult[] {
  const relevant = edges.filter(({ edge, source, target }) => rule.edgeKinds.includes(edge.kind) && rule.domain.includes(source) && rule.domain.includes(target));
  const adjacent = new Map<string, Array<{ edge: GraphEdge; target: string }>>();
  for (const { edge, source, target } of relevant) adjacent.set(source, [...(adjacent.get(source) ?? []), { edge, target }]);
  const visited = new Set<string>(); const stack = new Set<string>(); const results: ReportResult[] = [];
  const visit = (source: string, path: string[], edgePath: GraphEdge[]): void => {
    visited.add(source); stack.add(source);
    for (const next of adjacent.get(source) ?? []) {
      const cycleStart = path.indexOf(next.target);
      if (cycleStart >= 0) {
        const cycle = [...path.slice(cycleStart), next.target];
        results.push({ fingerprint: digestJson({ ruleId: rule.id, cycle, edge: next.edge.id }), status: rule.enforcement === "proposed" ? "proposed" : "active", category: "implementation", ruleId: rule.id, message: `cycle detected: ${cycle.join(" -> ")}`, sourceArchitectureId: source, targetArchitectureId: next.target, edge: next.edge });
      } else if (!visited.has(next.target)) visit(next.target, [...path, next.target], [...edgePath, next.edge]);
    }
    stack.delete(source);
  };
  for (const id of rule.domain) if (!visited.has(id)) visit(id, [id], []);
  return results;
}

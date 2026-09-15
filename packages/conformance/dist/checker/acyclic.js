import { digestJson } from "../artifacts/digest.js";
export function acyclicResults(rule, edges) {
    const relevant = edges.filter(({ edge, source, target }) => rule.edgeKinds.includes(edge.kind) && rule.domain.includes(source) && rule.domain.includes(target));
    const adjacent = new Map();
    for (const { edge, source, target } of relevant)
        adjacent.set(source, [...(adjacent.get(source) ?? []), { edge, target }]);
    const visited = new Set();
    const stack = new Set();
    const results = [];
    const visit = (source, path, edgePath) => {
        visited.add(source);
        stack.add(source);
        for (const next of adjacent.get(source) ?? []) {
            const cycleStart = path.indexOf(next.target);
            if (cycleStart >= 0) {
                const cycle = [...path.slice(cycleStart), next.target];
                results.push({ fingerprint: digestJson({ ruleId: rule.id, cycle, edge: next.edge.id }), status: rule.enforcement === "proposed" ? "proposed" : "active", category: "implementation", ruleId: rule.id, message: `cycle detected: ${cycle.join(" -> ")}`, sourceArchitectureId: source, targetArchitectureId: next.target, edge: next.edge });
            }
            else if (!visited.has(next.target))
                visit(next.target, [...path, next.target], [...edgePath, next.edge]);
        }
        stack.delete(source);
    };
    for (const id of rule.domain)
        if (!visited.has(id))
            visit(id, [id], []);
    return results;
}
//# sourceMappingURL=acyclic.js.map
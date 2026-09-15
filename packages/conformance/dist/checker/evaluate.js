import { digestJson } from "../artifacts/digest.js";
import { validateMapAgainstGraph } from "../realization/validate-map.js";
import { acyclicResults } from "./acyclic.js";
import { dependencyPolicyResults } from "./dependency-policy.js";
export function evaluate(graph, map, contract) {
    const mapping = validateMapAgainstGraph(graph, map);
    const implementation = [];
    const mappedEdges = graph.edges.flatMap((edge) => {
        const source = mapping.architectureByNode.get(edge.source);
        const target = edge.target ? mapping.architectureByNode.get(edge.target) : undefined;
        return source && target ? [{ edge, source, target }] : [];
    });
    for (const rule of contract.rules) {
        if (rule.kind === "dependency-policy")
            implementation.push(...dependencyPolicyResults(rule, mappedEdges));
        else {
            if (rule.world === "closed")
                for (const architectureId of new Set(mapping.architectureByNode.values()))
                    if (!rule.domain.includes(architectureId))
                        mapping.coverage.push({ fingerprint: digestJson({ ruleId: rule.id, architectureId }), status: "active", category: "coverage", ruleId: rule.id, message: `closed acyclic rule ${rule.id} omits mapped architecture ID ${architectureId}`, sourceArchitectureId: architectureId });
            implementation.push(...acyclicResults(rule, mappedEdges));
        }
    }
    const blockingViolations = implementation.filter((result) => result.status === "active" && contract.rules.some((rule) => rule.id === result.ruleId && rule.enforcement === "active" && rule.severity === "error"));
    return { graph, implementation, documentation: mapping.documentation, coverage: mapping.coverage, blockingViolations };
}
//# sourceMappingURL=evaluate.js.map
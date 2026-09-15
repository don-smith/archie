import { digestJson } from "../artifacts/digest.js";
export function dependencyPolicyResults(rule, edges) {
    return edges.filter(({ edge, source, target }) => {
        if (!rule.sources.includes(source) || !rule.edgeKinds.includes(edge.kind))
            return false;
        if (rule.world === "closed")
            return !rule.allowedTargets?.includes(target);
        return rule.forbiddenTargets.includes(target);
    }).map(({ edge, source, target }) => {
        const message = rule.world === "closed" ? `${source} may not depend on ${target} outside the closed allowlist` : `${source} may not depend on ${target}`;
        return { fingerprint: digestJson({ ruleId: rule.id, source, target, edge: edge.id }), status: rule.enforcement === "proposed" ? "proposed" : "active", category: "implementation", ruleId: rule.id, message, sourceArchitectureId: source, targetArchitectureId: target, edge };
    });
}
//# sourceMappingURL=dependency-policy.js.map
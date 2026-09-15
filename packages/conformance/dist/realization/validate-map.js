import { digestJson } from "../artifacts/digest.js";
import { globMatches, matchesMapping } from "./selectors.js";
function result(category, message) { return { fingerprint: digestJson({ category, message }), status: "active", category, message }; }
export function validateMapAgainstGraph(graph, map) {
    const documentation = [];
    const coverage = [];
    const architectureByNode = new Map();
    const sources = graph.nodes.filter((node) => node.kind === "source-module" && node.file !== undefined);
    for (const mapping of map.mappings) {
        const matches = sources.filter((node) => matchesMapping(node, mapping));
        if (matches.length === 0)
            documentation.push(result("documentation", `stale realization selector for ${mapping.elementId}`));
    }
    for (const node of sources) {
        const included = map.scope.include.some((pattern) => globMatches(node.file, pattern));
        const excluded = map.scope.exclusions.some((exclusion) => globMatches(node.file, exclusion.path));
        if (!included || excluded)
            continue;
        const matches = map.mappings.filter((mapping) => matchesMapping(node, mapping));
        if (matches.length === 0)
            coverage.push(result("coverage", `no realization mapping for ${node.file}`));
        else if (matches.length > 1)
            documentation.push(result("documentation", `overlapping realization mappings for ${node.file}`));
        else
            architectureByNode.set(node.id, matches[0].elementId);
    }
    for (const gap of graph.gaps)
        coverage.push({ fingerprint: digestJson({ category: "coverage", gap }), status: "active", category: "coverage", message: gap.message });
    return { architectureByNode, documentation, coverage };
}
//# sourceMappingURL=validate-map.js.map
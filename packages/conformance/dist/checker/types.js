export function resultFingerprint(result) {
    return JSON.stringify([result.ruleId ?? "", result.sourceArchitectureId ?? "", result.targetArchitectureId ?? "", result.edge?.id ?? "", result.category, result.message]);
}
export function sourceNodes(graph) { return graph.nodes.filter((node) => node.kind === "source-module" && node.file !== undefined); }
//# sourceMappingURL=types.js.map
import { digestJson } from "../artifacts/digest.js";
function sourceName(node, fallback) { return node?.module ?? fallback; }
function lines(items) { return items.length === 0 ? "- None\n" : `${items.map((item) => `- ${item}`).join("\n")}\n`; }
/** Produces a deterministic, evidence-only reading view of one normalized graph. */
export function buildOnboardingSummary(graph) {
    if (!graph.scope)
        throw new TypeError("normalized graph is missing selected scope");
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    const sourceModules = graph.nodes.filter((node) => node.kind === "source-module").sort((a, b) => (a.file ?? "").localeCompare(b.file ?? ""));
    const resolved = graph.edges.filter((edge) => edge.status === "resolved");
    const unresolved = graph.edges.length - resolved.length;
    const gaps = new Map();
    for (const gap of graph.gaps)
        gaps.set(gap.kind, [...(gaps.get(gap.kind) ?? []), gap]);
    const aggregate = graph.edges.map((edge) => `${sourceName(byId.get(edge.source), edge.source)} → ${edge.target ? sourceName(byId.get(edge.target), edge.target) : "unresolved"} (\`${edge.specifier}\`, ${edge.kind})`).sort();
    const workspace = graph.edges.filter((edge) => !edge.specifier.startsWith(".") && edge.target && byId.get(edge.target)?.kind === "source-module").map((edge) => `${sourceName(byId.get(edge.source), edge.source)} → ${sourceName(byId.get(edge.target), edge.target)} (\`${edge.specifier}\`, ${edge.kind})`).sort();
    const exclusions = [...graph.exclusions].sort((a, b) => a.path.localeCompare(b.path) || a.reason.localeCompare(b.reason));
    const gapLines = [...gaps.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([kind, items]) => [kind, ...items.sort((a, b) => `${a.file ?? ""}:${a.message}`.localeCompare(`${b.file ?? ""}:${b.message}`)).map((gap) => `  - ${gap.file ?? "-"}: ${gap.message}`)]);
    return [
        "# Architecture Conformance onboarding evidence", "", `Graph digest: ${digestJson(graph)}`, "", "## Selected scope", `Roots: ${[...graph.scope.rootConfigs].sort().map((root) => `\`${root}\``).join(", ") || "(none)"}`, `Includes: ${[...graph.scope.include].sort().map((include) => `\`${include}\``).join(", ") || "(none)"}`, `Declared exclusions: ${[...graph.scope.exclusions].sort((a, b) => a.path.localeCompare(b.path)).map((exclusion) => `\`${exclusion.path}\` (${exclusion.reason})`).join(", ") || "(none)"}`, "", "## Coverage", `Source modules: ${sourceModules.length}`, `Analyzed files: ${sourceModules.map((node) => `\`${node.file}\``).join(", ") || "(none)"}`, "Observed exclusions:", lines(exclusions.map((exclusion) => `\`${exclusion.path}\` (${exclusion.reason})`)).trimEnd(), "", "## Gaps", lines(gapLines).trimEnd(), "", "## Import evidence", `Imports — resolved: ${resolved.length}; unresolved: ${unresolved}`, "All source-to-target/specifier aggregates:", lines(aggregate).trimEnd(), "", "## workspace-source-imports", "Bare specifiers that resolve to selected source modules:", lines(workspace).trimEnd(), ""
    ].join("\n");
}
//# sourceMappingURL=build.js.map
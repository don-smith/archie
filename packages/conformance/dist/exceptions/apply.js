import { evidenceFingerprint } from "./fingerprint.js";
import { digestJson } from "../artifacts/digest.js";
function expired(exception) { return exception.expiresOn !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(exception.expiresOn) || exception.expiresOn < new Date().toISOString().slice(0, 10)); }
export function applyExceptions(results, exceptions, graph) {
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const used = new Set();
    const diagnostics = [];
    const adjusted = results.map((result) => {
        if (result.status !== "active" || !result.edge || !result.ruleId || !result.sourceArchitectureId || !result.targetArchitectureId || !result.edge.target)
            return result;
        const source = nodes.get(result.edge.source);
        const target = nodes.get(result.edge.target);
        if (!source || !target)
            return result;
        const fingerprint = evidenceFingerprint({ ruleId: result.ruleId, sourceArchitectureId: result.sourceArchitectureId, targetArchitectureId: result.targetArchitectureId, sourceModule: source.module, targetModule: target.module, edgeKind: result.edge.kind, specifier: result.edge.specifier });
        const exception = exceptions.find((item) => item.ruleId === result.ruleId && item.fingerprint === fingerprint && !expired(item));
        if (!exception)
            return { ...result, fingerprint };
        used.add(exception);
        return { ...result, fingerprint, status: "waived" };
    });
    for (const exception of exceptions)
        if (!used.has(exception))
            diagnostics.push({ fingerprint: digestJson({ exception }), status: "active", category: "documentation", ruleId: exception.ruleId, message: expired(exception) ? `expired exception for ${exception.ruleId}` : `unmatched exception for ${exception.ruleId}` });
    return { results: adjusted, diagnostics };
}
//# sourceMappingURL=apply.js.map
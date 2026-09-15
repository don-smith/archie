import { digestJson } from "../artifacts/digest.js";
export function compareBaseline(results, baseline) {
    if (!baseline)
        return results.map((result) => result.status === "active" ? { ...result, status: "new" } : result);
    const previous = new Set(baseline.active);
    const ledger = new Set(baseline.ledger);
    const current = results.map((result) => {
        if (result.status !== "active")
            return result;
        return { ...result, status: previous.has(result.fingerprint) ? "unchanged" : ledger.has(result.fingerprint) ? "reintroduced" : "new" };
    });
    for (const fingerprint of previous)
        if (!results.some((result) => result.fingerprint === fingerprint && result.status === "active"))
            current.push({ fingerprint: digestJson({ fixed: fingerprint }), status: "fixed", category: "implementation", message: `fixed result ${fingerprint}` });
    return current;
}
//# sourceMappingURL=compare.js.map
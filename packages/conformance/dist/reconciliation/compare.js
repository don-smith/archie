function sorted(items) { return [...items].sort((a, b) => a.id.localeCompare(b.id) || a.fingerprint.localeCompare(b.fingerprint) || ("state" in a && "state" in b ? String(a.state).localeCompare(String(b.state)) : 0)); }
function grouped(items) {
    const result = new Map();
    for (const item of items)
        result.set(item.id, [...(result.get(item.id) ?? []), item]);
    return result;
}
/** Compares opaque normalized records without changing their lifecycle or content. */
export function reconcile(activeInput, driftInput) {
    const active = grouped(sorted(activeInput.results));
    const drift = grouped(sorted(driftInput.records));
    const ids = [...new Set([...active.keys(), ...drift.keys()])].sort();
    const duplicates = ids.flatMap((id) => {
        const activeItems = active.get(id) ?? [];
        const driftItems = drift.get(id) ?? [];
        return [
            ...(activeItems.length > 1 ? [{ id, input: "active", count: activeItems.length }] : []),
            ...(driftItems.length > 1 ? [{ id, input: "drift", count: driftItems.length }] : [])
        ];
    });
    const missing = ids.flatMap((id) => !drift.has(id) ? [active.get(id)[0]] : []);
    const stale = ids.flatMap((id) => {
        const left = active.get(id)?.[0];
        const right = drift.get(id)?.[0];
        return left && right && left.fingerprint !== right.fingerprint ? [{ id, activeFingerprint: left.fingerprint, driftFingerprint: right.fingerprint }] : [];
    });
    const resolvedCandidates = ids.flatMap((id) => !active.has(id) ? [drift.get(id)[0]] : []);
    return { version: "architecture-reconciliation-report/v1", missing, duplicates, stale, resolvedCandidates };
}
//# sourceMappingURL=compare.js.map
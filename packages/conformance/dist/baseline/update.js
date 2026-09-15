export function updateBaseline(report, previous) {
    const active = report.results.filter((result) => ["active", "new", "unchanged", "reintroduced"].includes(result.status)).map((result) => result.fingerprint).sort();
    const ledger = [...new Set([...(previous?.ledger ?? []), ...(previous?.active ?? []), ...active])].sort();
    return { version: "conformance-baseline/v1", active, ledger };
}
//# sourceMappingURL=update.js.map
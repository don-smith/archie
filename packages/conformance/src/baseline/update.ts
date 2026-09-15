import type { BaselineV1, ConformanceReportV1 } from "../formats/types.js";

export function updateBaseline(report: ConformanceReportV1, previous?: BaselineV1): BaselineV1 {
  const active = report.results.filter((result) => ["active", "new", "unchanged", "reintroduced"].includes(result.status)).map((result) => result.fingerprint).sort();
  const ledger = [...new Set([...(previous?.ledger ?? []), ...(previous?.active ?? []), ...active])].sort();
  return { version: "conformance-baseline/v1", active, ledger };
}

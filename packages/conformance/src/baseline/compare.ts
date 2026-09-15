import { digestJson } from "../artifacts/digest.js";
import type { BaselineV1, ReportResult } from "../formats/types.js";

export function compareBaseline(results: ReportResult[], baseline?: BaselineV1): ReportResult[] {
  if (!baseline) return results.map((result) => result.status === "active" ? { ...result, status: "new" as const } : result);
  const previous = new Set(baseline.active); const ledger = new Set(baseline.ledger);
  const current = results.map((result) => {
    if (result.status !== "active") return result;
    return { ...result, status: previous.has(result.fingerprint) ? "unchanged" as const : ledger.has(result.fingerprint) ? "reintroduced" as const : "new" as const };
  });
  for (const fingerprint of previous) if (!results.some((result) => result.fingerprint === fingerprint && result.status === "active")) current.push({ fingerprint: digestJson({ fixed: fingerprint }), status: "fixed", category: "implementation", message: `fixed result ${fingerprint}` });
  return current;
}

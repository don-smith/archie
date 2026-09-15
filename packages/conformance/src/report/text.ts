import type { ConformanceReportV1 } from "../formats/types.js";

export function renderText(report: ConformanceReportV1): string {
  const lines = [`Architecture conformance: ${report.results.length} result(s), ${report.gaps.length} gap(s)`];
  for (const result of report.results) lines.push(`[${result.status}] ${result.category}${result.ruleId ? ` ${result.ruleId}` : ""}: ${result.message}${result.edge ? ` (${result.edge.span.file}:${result.edge.span.start.line}:${result.edge.span.start.column})` : ""}`);
  return `${lines.join("\n")}\n`;
}

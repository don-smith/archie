import { digestJson } from "../artifacts/digest.js";
import { applyExceptions } from "../exceptions/apply.js";
import type { ArchitectureContractV1, BaselineV1, ConformanceReportV1, NormalizedGraphV1, RealizationMapV1 } from "../formats/types.js";
import { compareBaseline } from "../baseline/compare.js";
import { evaluate } from "../checker/evaluate.js";

export function buildReport(graph: NormalizedGraphV1, map: RealizationMapV1, contract: ArchitectureContractV1, baseline?: BaselineV1): ConformanceReportV1 {
  const evaluation = evaluate(graph, map, contract); const exceptions = applyExceptions(evaluation.implementation, contract.exceptions, graph);
  const results = compareBaseline([...exceptions.results, ...evaluation.documentation, ...evaluation.coverage, ...exceptions.diagnostics], baseline).sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
  const gaps = [...graph.gaps].sort((a, b) => `${a.kind}:${a.message}`.localeCompare(`${b.kind}:${b.message}`));
  const digests = { realizationMap: digestJson(map), contract: digestJson(contract), graph: digestJson(graph), provenance: digestJson(graph.provenance) };
  return { version: "conformance-report/v1", digests: { ...digests, output: digestJson({ version: "conformance-report/v1", digests, results, gaps }) }, results, gaps, graph };
}

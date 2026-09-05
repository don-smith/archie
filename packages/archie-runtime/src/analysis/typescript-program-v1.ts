import { ANALYZER_ID, SUPPORTED_ANALYZER, assertSupportedEnvironment, type AnalysisRequest, type AnalysisResponse } from "./contracts.js";
import { analyzeTypeScriptProgram } from "./typescript-program-v1-core.js";

/** The retained compiler-backed adapter; its known compatibility defects remain explicit in provenance. */
export function analyzeTypeScriptProgramV1(request: AnalysisRequest): AnalysisResponse {
  assertSupportedEnvironment();
  const graph = analyzeTypeScriptProgram({ rootConfigs: request.rootConfigs, scope: { rootConfigs: request.rootConfigs, include: request.include, exclusions: request.exclusions } }, request.repositoryRoot);
  return {
    contractVersion: "analysis-response-v1", adapter: ANALYZER_ID,
    observations: graph.edges.map((edge) => ({ source: edge.source, specifier: edge.specifier, effect: edge.kind, resolution: edge.target ? (edge.target.includes("external:") ? "external" : "resolved") : "unresolved" })),
    gaps: graph.gaps.map(({ kind, message }) => ({ kind, message })), provenance: SUPPORTED_ANALYZER, complete: graph.gaps.length === 0
  };
}

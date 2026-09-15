import { ANALYZER_ID, assertSupportedEnvironment } from "./contracts.js";
import { analyzeTypeScriptProgram } from "./typescript-program-v1-core.js";
/** Returns the complete normalized graph needed by deterministic conformance consumers. */
export function analyzeTypeScriptProgramV2(request) {
    assertSupportedEnvironment();
    const graph = analyzeTypeScriptProgram({ rootConfigs: request.rootConfigs, scope: { rootConfigs: request.rootConfigs, include: request.include, exclusions: request.exclusions } }, request.repositoryRoot);
    return { contractVersion: "analysis-response-v2", adapter: ANALYZER_ID, graph, complete: graph.gaps.length === 0 };
}
//# sourceMappingURL=typescript-program-v2.js.map
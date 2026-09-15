import { analyzeTypeScriptProgramV2 } from "@archie/runtime";
/** Adapts Conformance's graph input to Runtime's public full-fidelity analysis contract. */
export function analyzeTypeScriptProgram(input, repositoryRoot = process.cwd()) {
    return analyzeTypeScriptProgramV2({
        contractVersion: "analysis-request-v1",
        repositoryRoot,
        rootConfigs: input.rootConfigs,
        include: input.scope.include,
        exclusions: input.scope.exclusions
    }).graph;
}
//# sourceMappingURL=runtime-analysis.js.map
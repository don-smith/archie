import { analyzeTypeScriptProgramV2, type NormalizedGraphV1 } from "@archie/runtime";

import type { SourceScope } from "./formats/types.js";

interface TypeScriptProgramInput { rootConfigs: string[]; scope: SourceScope }

/** Adapts Conformance's graph input to Runtime's public full-fidelity analysis contract. */
export function analyzeTypeScriptProgram(input: TypeScriptProgramInput, repositoryRoot = process.cwd()): NormalizedGraphV1 {
  return analyzeTypeScriptProgramV2({
    contractVersion: "analysis-request-v1",
    repositoryRoot,
    rootConfigs: input.rootConfigs,
    include: input.scope.include,
    exclusions: input.scope.exclusions
  }).graph;
}

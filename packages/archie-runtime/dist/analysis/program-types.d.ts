import type { NormalizedGraphV1, SourceScope } from "./graph-types.js";
export interface TypeScriptProgramInput {
    rootConfigs: string[];
    scope: SourceScope;
}
export type AnalysisResult = NormalizedGraphV1;

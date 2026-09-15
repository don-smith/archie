import { type NormalizedGraphV1 } from "@archie/runtime";
import type { SourceScope } from "./formats/types.js";
interface TypeScriptProgramInput {
    rootConfigs: string[];
    scope: SourceScope;
}
/** Adapts Conformance's graph input to Runtime's public full-fidelity analysis contract. */
export declare function analyzeTypeScriptProgram(input: TypeScriptProgramInput, repositoryRoot?: string): NormalizedGraphV1;
export {};

import type { NormalizedGraphV1 } from "./graph-types.js";
import type { TypeScriptProgramInput } from "./program-types.js";
/** The only module allowed to call the pinned TypeScript compiler API. */
export declare function analyzeTypeScriptProgram(input: TypeScriptProgramInput, repositoryRoot?: string): NormalizedGraphV1;

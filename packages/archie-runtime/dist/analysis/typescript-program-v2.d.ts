import { type AnalysisRequest, type AnalysisResponseV2 } from "./contracts.js";
/** Returns the complete normalized graph needed by deterministic conformance consumers. */
export declare function analyzeTypeScriptProgramV2(request: AnalysisRequest): AnalysisResponseV2;

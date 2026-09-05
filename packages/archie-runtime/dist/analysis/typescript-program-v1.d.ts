import { type AnalysisRequest, type AnalysisResponse } from "./contracts.js";
/** The retained compiler-backed adapter; its known compatibility defects remain explicit in provenance. */
export declare function analyzeTypeScriptProgramV1(request: AnalysisRequest): AnalysisResponse;

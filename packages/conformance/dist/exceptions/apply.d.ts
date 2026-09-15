import type { ExceptionV1, NormalizedGraphV1, ReportResult } from "../formats/types.js";
export declare function applyExceptions(results: ReportResult[], exceptions: ExceptionV1[], graph: NormalizedGraphV1): {
    results: ReportResult[];
    diagnostics: ReportResult[];
};

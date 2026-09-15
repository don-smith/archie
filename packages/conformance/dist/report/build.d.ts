import type { ArchitectureContractV1, BaselineV1, ConformanceReportV1, NormalizedGraphV1, RealizationMapV1 } from "../formats/types.js";
export declare function buildReport(graph: NormalizedGraphV1, map: RealizationMapV1, contract: ArchitectureContractV1, baseline?: BaselineV1): ConformanceReportV1;

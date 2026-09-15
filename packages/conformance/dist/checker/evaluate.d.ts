import type { ArchitectureContractV1, NormalizedGraphV1, RealizationMapV1 } from "../formats/types.js";
import type { Evaluation } from "./types.js";
export declare function evaluate(graph: NormalizedGraphV1, map: RealizationMapV1, contract: ArchitectureContractV1): Evaluation;

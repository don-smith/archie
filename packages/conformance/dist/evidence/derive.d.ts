import type { ArchitectureContractV1, BaselineV1, ConformanceReportV1, NormalizedGraphV1, RealizationMapV1 } from "../formats/types.js";
import type { OnboardingEvidence, OnboardingStateV1 } from "../onboarding-state/types.js";
declare function readJson(path: string): unknown;
/** Reads a normative artifact and refuses bytes other than the recorded digest. */
export declare function verifiedInput(path: string, digest: string, name: string): unknown;
export interface NormativeInputs {
    map?: RealizationMapV1;
    contract?: ArchitectureContractV1;
    baseline?: BaselineV1;
}
/** Verifies the normative inputs an onboarding state retains, and only those, against their recorded digests. */
export declare function verifiedNormativeInputs(state: OnboardingStateV1, repositoryRoot: string): NormativeInputs;
export interface DerivedEvidence {
    graph: NormalizedGraphV1;
    graphJson: string;
    summary: string;
    report?: ConformanceReportV1;
    reportJson?: string;
}
/** Re-derives the derived evidence of one onboarding state from current source; the report needs a map and a contract. */
export declare function deriveEvidence(state: OnboardingStateV1, inputs: NormativeInputs, repositoryRoot: string): DerivedEvidence;
export { readJson };
export type { OnboardingEvidence };

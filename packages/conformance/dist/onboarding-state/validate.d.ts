import type { SourceScope } from "../formats/types.js";
import type { OnboardingCheckpoint, OnboardingEvidence, OnboardingPaths, OnboardingStateV1 } from "./types.js";
export declare function requiredEvidenceFor(checkpoint: OnboardingCheckpoint): readonly OnboardingEvidence[];
export declare function defaultOnboardingState(input: {
    scope: SourceScope;
    skillLocation: string;
    paths?: Partial<OnboardingPaths>;
}): OnboardingStateV1;
export declare function validateOnboardingState(value: unknown, repositoryRoot?: string): OnboardingStateV1;

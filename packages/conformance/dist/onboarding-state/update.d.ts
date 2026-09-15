import type { OnboardingCheckpoint, OnboardingStateV1 } from "./types.js";
/** Advances only one evidence-backed operational checkpoint; it never edits normative artifacts. */
export declare function advanceOnboardingState(stateInput: unknown, update: {
    checkpoint: OnboardingCheckpoint;
}, repositoryRoot?: string): OnboardingStateV1;

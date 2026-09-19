import type { OnboardingEvidence, OnboardingStateV1 } from "../onboarding-state/types.js";
import { readJson } from "./derive.js";
export interface RerecordCounters {
    before: number;
    after: number;
}
export interface RerecordOutcome {
    checkpoint: OnboardingStateV1["checkpoint"];
    modules: RerecordCounters;
    graphNodes: RerecordCounters;
    graphEdges: RerecordCounters;
    reportResults: RerecordCounters;
    reportGaps: RerecordCounters;
    verdictUnchanged: boolean;
    reRecorded: OnboardingEvidence[];
}
/** Re-derives graph, summary, and report from current source, rewrites them, and re-records only their evidence digests. */
export declare function rerecord(stateInput: unknown, options?: {
    expectUnchangedVerdict?: boolean;
    repositoryRoot?: string;
}): {
    state: OnboardingStateV1;
    outcome: RerecordOutcome;
};
export { readJson };

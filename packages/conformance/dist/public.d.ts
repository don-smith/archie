import type { ConformanceReportV1 } from "./formats/types.js";
import type { OnboardingStateV1 } from "./onboarding-state/types.js";
export declare const CONFORMANCE_REPORT_V1: "conformance-report/v1";
export declare const ONBOARDING_STATE_V1: "onboarding-state/v1";
export declare const CONFORMANCE_REPORT_CONTRACT_V1: "conformance-report-contract/v1";
export declare const CONFORMANCE_STATE_CONTRACT_V1: "conformance-state-contract/v1";
export type ConformanceResultCode = 0 | 1 | 2 | 3;
export type ConformanceResultMeaning = "pass" | "blocking-violation" | "incomplete-evidence" | "invalid-input";
export type ContractFreshness = "fresh" | "stale" | "unavailable" | "unknown";
export interface ConformanceInputEvidence {
    kind: string;
    path: string;
    digest: string;
}
export interface ConformanceFreshness {
    status: ContractFreshness;
    inputs: ConformanceInputEvidence[];
    reason: string;
}
export interface ConformanceReportContractV1 {
    version: typeof CONFORMANCE_REPORT_CONTRACT_V1;
    report: {
        version: typeof CONFORMANCE_REPORT_V1;
        identity: {
            id: string;
            producer: "@archie/conformance";
            outputDigest: string;
        };
        result: {
            code: ConformanceResultCode;
            meaning: ConformanceResultMeaning;
            status: "pass" | "violation" | "incomplete" | "invalid";
        };
        evidence: {
            realizationMap: string;
            contract: string;
            graph: string;
            provenance: string;
        };
        freshness: ConformanceFreshness;
    };
    state: ConformanceStateReferenceV1;
}
export interface ConformanceStateReferenceV1 {
    version: typeof ONBOARDING_STATE_V1;
    identity: string;
    checkpoint: OnboardingStateV1["checkpoint"];
    paths: OnboardingStateV1["paths"];
    evidence: Partial<Record<"graph" | "summary" | "map" | "contract" | "report" | "baseline", string>>;
}
export interface ConformanceStateContractV1 {
    version: typeof CONFORMANCE_STATE_CONTRACT_V1;
    stateVersion: typeof ONBOARDING_STATE_V1;
    identity: string;
    checkpoint: OnboardingStateV1["checkpoint"];
    paths: OnboardingStateV1["paths"];
    evidence: ConformanceStateReferenceV1["evidence"];
    freshness: ConformanceFreshness;
}
export declare function readConformanceReport(value: unknown): ConformanceReportV1;
export declare function readOnboardingState(value: unknown, repositoryRoot?: string): OnboardingStateV1;
export declare function readConformanceReportContract(value: unknown): ConformanceReportContractV1;
export declare function readConformanceStateContract(value: unknown): ConformanceStateContractV1;

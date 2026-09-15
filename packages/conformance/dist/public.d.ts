import type { ConformanceReportV1 } from "./formats/types.js";
import type { OnboardingStateV1 } from "./onboarding-state/types.js";
export declare const CONFORMANCE_REPORT_V1: "conformance-report/v1";
export declare const ONBOARDING_STATE_V1: "onboarding-state/v1";
/** Reads the versioned report contract without exposing checker implementation modules. */
export declare function readConformanceReport(value: unknown): ConformanceReportV1;
/** Reads operational onboarding state without exposing onboarding implementation modules. */
export declare function readOnboardingState(value: unknown, repositoryRoot?: string): OnboardingStateV1;

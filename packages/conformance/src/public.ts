import { validateConformanceReport } from "./formats/validate.js";
import { validateOnboardingState } from "./onboarding-state/validate.js";
import type { ConformanceReportV1 } from "./formats/types.js";
import type { OnboardingStateV1 } from "./onboarding-state/types.js";

export const CONFORMANCE_REPORT_V1 = "conformance-report/v1" as const;
export const ONBOARDING_STATE_V1 = "onboarding-state/v1" as const;

/** Reads the versioned report contract without exposing checker implementation modules. */
export function readConformanceReport(value: unknown): ConformanceReportV1 {
  return validateConformanceReport(value);
}

/** Reads operational onboarding state without exposing onboarding implementation modules. */
export function readOnboardingState(value: unknown, repositoryRoot?: string): OnboardingStateV1 {
  return validateOnboardingState(value, repositoryRoot);
}

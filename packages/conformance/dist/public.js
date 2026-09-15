import { validateConformanceReport } from "./formats/validate.js";
import { validateOnboardingState } from "./onboarding-state/validate.js";
export const CONFORMANCE_REPORT_V1 = "conformance-report/v1";
export const ONBOARDING_STATE_V1 = "onboarding-state/v1";
/** Reads the versioned report contract without exposing checker implementation modules. */
export function readConformanceReport(value) {
    return validateConformanceReport(value);
}
/** Reads operational onboarding state without exposing onboarding implementation modules. */
export function readOnboardingState(value, repositoryRoot) {
    return validateOnboardingState(value, repositoryRoot);
}
//# sourceMappingURL=public.js.map
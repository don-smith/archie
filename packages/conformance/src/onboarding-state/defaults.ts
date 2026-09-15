import type { OnboardingPaths } from "./types.js";

export const defaultOnboardingPaths: OnboardingPaths = {
  state: ".architecture-conformance/onboarding.json",
  graph: ".architecture-conformance/evidence/observed-graph.json",
  summary: ".architecture-conformance/evidence/onboarding-summary.md",
  map: ".architecture-conformance/realization-map.json",
  contract: ".architecture-conformance/architecture-contract.json",
  report: ".architecture-conformance/evidence/report.json",
  baseline: ".architecture-conformance/baseline.json"
};

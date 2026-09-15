import type { SourceScope } from "../formats/types.js";

export type OnboardingCheckpoint = "scope-selected" | "evidence-generated" | "classification-drafted" | "proposed-contract-checked" | "active-contract-checked" | "baseline-created";
export type OnboardingEvidence = "graph" | "summary" | "map" | "contract" | "report" | "baseline";

export interface OnboardingPaths {
  state: string;
  graph: string;
  summary: string;
  map: string;
  contract: string;
  report: string;
  baseline: string;
}

/** Operational resume information; architectural intent stays in map and contract files. */
export interface OnboardingStateV1 {
  version: "onboarding-state/v1";
  scope: SourceScope;
  skillLocation: string;
  paths: OnboardingPaths;
  checkpoint: OnboardingCheckpoint;
  evidence: Partial<Record<OnboardingEvidence, string>>;
}

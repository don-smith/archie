import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { analyzeTypeScriptProgram } from "../runtime-analysis.js";
import { sha256 } from "../artifacts/digest.js";
import { buildReport } from "../report/build.js";
import { renderJson } from "../report/json.js";
import { buildOnboardingSummary } from "../onboarding-summary/build.js";
import { validateArchitectureContract, validateBaseline, validateRealizationMap } from "../formats/validate.js";
import type { ArchitectureContractV1, BaselineV1, ConformanceReportV1, NormalizedGraphV1, RealizationMapV1 } from "../formats/types.js";
import type { OnboardingEvidence, OnboardingStateV1 } from "../onboarding-state/types.js";

function readJson(path: string): unknown { return JSON.parse(readFileSync(path, "utf8")); }

/** Reads a normative artifact and refuses bytes other than the recorded digest. */
export function verifiedInput(path: string, digest: string, name: string): unknown {
  const bytes = readFileSync(path);
  if (sha256(bytes) !== digest) throw new Error(`${name} input digest mismatch`);
  return JSON.parse(bytes.toString("utf8"));
}

export interface NormativeInputs { map?: RealizationMapV1; contract?: ArchitectureContractV1; baseline?: BaselineV1 }

/** Verifies the normative inputs an onboarding state retains, and only those, against their recorded digests. */
export function verifiedNormativeInputs(state: OnboardingStateV1, repositoryRoot: string): NormativeInputs {
  const mapDigest = state.evidence.map, contractDigest = state.evidence.contract, baselineDigest = state.evidence.baseline;
  return {
    ...(mapDigest ? { map: validateRealizationMap(verifiedInput(resolve(repositoryRoot, state.paths.map), mapDigest, "realization map")) } : {}),
    ...(contractDigest ? { contract: validateArchitectureContract(verifiedInput(resolve(repositoryRoot, state.paths.contract), contractDigest, "architecture contract")) } : {}),
    ...(baselineDigest ? { baseline: validateBaseline(verifiedInput(resolve(repositoryRoot, state.paths.baseline), baselineDigest, "baseline")) } : {})
  };
}

export interface DerivedEvidence { graph: NormalizedGraphV1; graphJson: string; summary: string; report?: ConformanceReportV1; reportJson?: string }

/** Re-derives the derived evidence of one onboarding state from current source; the report needs a map and a contract. */
export function deriveEvidence(state: OnboardingStateV1, inputs: NormativeInputs, repositoryRoot: string): DerivedEvidence {
  const graph = analyzeTypeScriptProgram({ rootConfigs: state.scope.rootConfigs, scope: state.scope }, repositoryRoot);
  const graphJson = renderJson(graph);
  const summary = buildOnboardingSummary(graph);
  if (!inputs.map || !inputs.contract) return { graph, graphJson, summary };
  const report = buildReport(graph, inputs.map, inputs.contract, inputs.baseline);
  return { graph, graphJson, summary, report, reportJson: renderJson(report) };
}

export { readJson };
export type { OnboardingEvidence };

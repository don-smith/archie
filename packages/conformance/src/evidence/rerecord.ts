import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { sha256 } from "../artifacts/digest.js";
import { renderJson } from "../report/json.js";
import { validateOnboardingState } from "../onboarding-state/validate.js";
import type { OnboardingEvidence, OnboardingStateV1 } from "../onboarding-state/types.js";
import { deriveEvidence, readJson, verifiedNormativeInputs } from "./derive.js";

export interface RerecordCounters { before: number; after: number }

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

function verdict(report: { results: Array<{ fingerprint: string; status: string }>; gaps: Array<{ kind: string; message: string }> }): string {
  return JSON.stringify([report.results.map((result) => `${result.fingerprint}:${result.status}`).sort(), report.gaps.map((gap) => `${gap.kind}:${gap.message}`).sort()]);
}

interface GraphCounts { source: number; nodes: number; edges: number }
function graphCounts(graphJson: string): GraphCounts {
  const graph = JSON.parse(graphJson) as { nodes: Array<{ kind: string }>; edges: unknown[] };
  return { source: graph.nodes.filter((node) => node.kind === "source-module").length, nodes: graph.nodes.length, edges: graph.edges.length };
}

interface ReportCounts { results: number; gaps: number }
function reportCounts(reportJson: string): ReportCounts {
  const report = JSON.parse(reportJson) as { results: unknown[]; gaps: unknown[] };
  return { results: report.results.length, gaps: report.gaps.length };
}

function recordedArtifact(path: string, name: string): string {
  try { return readFileSync(path, "utf8"); }
  catch { throw new Error(`recorded ${name} evidence is missing or unreadable at ${path}; restore the recorded observation first (for example with 'replay --state ... --regenerate' when source is unchanged) so the re-record stays auditable`); }
}

function writeArtifact(path: string, value: string): void { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }

/** Re-derives graph, summary, and report from current source, rewrites them, and re-records only their evidence digests. */
export function rerecord(stateInput: unknown, options: { expectUnchangedVerdict?: boolean; repositoryRoot?: string } = {}): { state: OnboardingStateV1; outcome: RerecordOutcome } {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const before = validateOnboardingState(stateInput);
  const inputs = verifiedNormativeInputs(before, repositoryRoot);
  const derived = deriveEvidence(before, inputs, repositoryRoot);
  const derivedPairs = {
    graph: [derived.graphJson, sha256(derived.graphJson)] as const,
    summary: [derived.summary, sha256(derived.summary)] as const,
    ...(derived.reportJson ? { report: [derived.reportJson, sha256(derived.reportJson)] as const } : {})
  } as Record<"graph" | "summary" | "report", readonly [string, string] | undefined>;
  const beforeGraph = before.evidence.graph ? graphCounts(recordedArtifact(resolve(repositoryRoot, before.paths.graph), "graph")) : graphCounts(derived.graphJson);
  const beforeReportJson = before.evidence.report ? recordedArtifact(resolve(repositoryRoot, before.paths.report), "report") : derived.reportJson;
  const beforeReportCounts = beforeReportJson ? reportCounts(beforeReportJson) : { results: 0, gaps: 0 };
  const verdictUnchanged = (derived.reportJson ?? beforeReportJson) === undefined
    || (derived.reportJson !== undefined && beforeReportJson !== undefined && verdict(derived.report!) === verdict(JSON.parse(beforeReportJson)));
  if (options.expectUnchangedVerdict && !verdictUnchanged) throw new Error("conformance verdict changed; refusing to re-record — resolve or approve the changed results with the maintainer first");
  for (const [name, pair] of Object.entries(derivedPairs)) if (pair) writeArtifact(resolve(repositoryRoot, before.paths[name as "graph" | "summary" | "report"]), pair[0]);
  const evidence = { ...before.evidence, ...Object.fromEntries(Object.entries(derivedPairs).filter((entry): entry is [string, readonly [string, string]] => entry[1] !== undefined).map(([name, [, digest]]) => [name, digest])) };
  const state = validateOnboardingState({ ...before, evidence }, repositoryRoot);
  const afterGraph = graphCounts(derived.graphJson);
  const afterReportCounts = derived.reportJson ? reportCounts(derived.reportJson) : { results: 0, gaps: 0 };
  const outcome: RerecordOutcome = {
    checkpoint: state.checkpoint,
    modules: { before: beforeGraph.source, after: afterGraph.source },
    graphNodes: { before: beforeGraph.nodes, after: afterGraph.nodes },
    graphEdges: { before: beforeGraph.edges, after: afterGraph.edges },
    reportResults: { before: beforeReportCounts.results, after: afterReportCounts.results },
    reportGaps: { before: beforeReportCounts.gaps, after: afterReportCounts.gaps },
    verdictUnchanged,
    reRecorded: Object.entries(derivedPairs).filter((entry): entry is [string, readonly [string, string]] => entry[1] !== undefined && before.evidence[entry[0] as keyof typeof before.evidence] !== entry[1][1]).map(([name]) => name as OnboardingEvidence)
  };
  writeArtifact(resolve(repositoryRoot, before.paths.state), renderJson(state));
  return { state, outcome };
}

export { readJson };

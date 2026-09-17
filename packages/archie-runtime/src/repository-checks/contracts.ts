export interface RepositoryCheck {
  id: string;
  command: string;
  authority: string;
  evidencePath: string;
  resultMeaning: string;
}
export interface RepositoryCheckResult {
  id: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  resultMeaning: string;
}

/** The immutable identity used by a generated architecture-status snapshot. */
export interface ArchitectureStatusRevisionV1 {
  commit: string;
  workingTree: "clean" | "dirty" | "unknown";
}

export type ArchitectureStatusExecutionV1 =
  | { state: "completed"; startedAt: string; finishedAt: string; exitCode: number }
  | { state: "failed"; startedAt: string; finishedAt: string; reason: string }
  | { state: "not-run"; reason: string };

export type ArchitectureStatusResultV1 =
  | { state: "reported"; code: string; label: string; summary: string; counts?: Array<{ id: string; value: number }>; findingIds?: string[] }
  | { state: "unknown"; reason: string };

export type ArchitectureStatusEvidenceV1 =
  | { state: "present"; source: "current" | "retained"; path: string; sha256: string; observedAt: string; observedRevision: string }
  | { state: "missing"; reason: string };

export type ArchitectureStatusFreshnessV1 =
  | { state: "current"; reasons: [] }
  | { state: "stale"; reasons: string[] }
  | { state: "unknown"; reasons: string[] };

export interface ArchitectureStatusCheckV1 {
  id: string;
  title: string;
  authority: string;
  resultMeaning: string;
  limits: string[];
  execution: ArchitectureStatusExecutionV1;
  result: ArchitectureStatusResultV1;
  evidence: ArchitectureStatusEvidenceV1;
  freshness: ArchitectureStatusFreshnessV1;
}

export interface ArchitectureStatusSnapshotV1 {
  kind: "archie-architecture-status";
  version: 1;
  repository: { name: string; revision: ArchitectureStatusRevisionV1 };
  generatedAt: string;
  freshnessPolicy: { maxAgeSeconds: number };
  checks: ArchitectureStatusCheckV1[];
}

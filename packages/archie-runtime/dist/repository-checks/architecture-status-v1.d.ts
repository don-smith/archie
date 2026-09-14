import type { ArchitectureStatusResultV1, ArchitectureStatusSnapshotV1, ArchitectureStatusRevisionV1, RepositoryCheck } from "./contracts.js";
export interface ArchitectureStatusRunFactsV1 {
    state: "completed" | "failed" | "not-run";
    startedAt?: string;
    finishedAt?: string;
    exitCode?: number;
    reason?: string;
}
export interface ArchitectureStatusExitMappingV1 {
    code: string;
    label: string;
    summary: string;
    counts?: Array<{
        id: string;
        value: number;
    }>;
    findingIds?: string[];
}
export interface ArchitectureStatusCheckInputV1 extends RepositoryCheck {
    title?: string;
    limits?: string[];
    adapter?: "normalized-json-v1" | "declared-exit-map-v1" | {
        kind: "normalized-json-v1";
        reportPath?: string;
    } | {
        kind: "declared-exit-map-v1";
        exitMap: Record<string, ArchitectureStatusExitMappingV1>;
    };
    exitMap?: Record<string, ArchitectureStatusExitMappingV1>;
    reportPath?: string;
    run?: ArchitectureStatusRunFactsV1;
    execution?: ArchitectureStatusRunFactsV1;
    report?: unknown;
}
export interface ArchitectureStatusWriterOptionsV1 {
    outputPath: string;
    repositoryRoot?: string;
    repository: {
        name: string;
        revision: ArchitectureStatusRevisionV1;
    };
    generatedAt: string;
    checks: ArchitectureStatusCheckInputV1[];
    previousSnapshotPath?: string;
    maxAgeSeconds?: number;
}
export interface NormalizedJsonReportV1 {
    kind: "archie-architecture-status-report";
    version: 1;
    checkId: string;
    observedAt: string;
    observedRevision: string;
    result: {
        code: string;
        label: string;
        summary: string;
        counts?: Array<{
            id: string;
            value: number;
        }>;
        findingIds?: string[];
    };
    evidence?: {
        path: string;
        sha256: string;
        observedAt?: string;
        observedRevision?: string;
    };
}
/** Validates a complete wire snapshot and returns a normalized copy. */
export declare function validateArchitectureStatusSnapshotV1(value: unknown): ArchitectureStatusSnapshotV1;
/** Produces fixed-order canonical UTF-8 JSON bytes. */
export declare function serializeArchitectureStatusSnapshotV1(snapshot: unknown): string;
export declare const canonicalizeArchitectureStatusSnapshotV1: typeof serializeArchitectureStatusSnapshotV1;
/** Adapts a bounded normalized-json-v1 report without looking at process output. */
export declare function adaptNormalizedJsonReportV1(report: unknown, checkId?: string): NormalizedJsonReportV1;
export declare const normalizeNormalizedJsonReportV1: typeof adaptNormalizedJsonReportV1;
/** Maps an explicit target-owned exit code; it never interprets stdout or stderr. */
export declare function adaptDeclaredExitMapV1(exitCode: number, exitMap: Record<string, ArchitectureStatusExitMappingV1>): ArchitectureStatusResultV1;
export declare const normalizeDeclaredExitMapV1: typeof adaptDeclaredExitMapV1;
/** Builds and atomically publishes one latest snapshot. */
export declare function writeArchitectureStatusSnapshotV1(options: ArchitectureStatusWriterOptionsV1): ArchitectureStatusSnapshotV1;
export declare const publishArchitectureStatusSnapshotV1: typeof writeArchitectureStatusSnapshotV1;
export declare const writeArchitectureStatusSnapshot: typeof writeArchitectureStatusSnapshotV1;
export declare const validateArchitectureStatusSnapshot: typeof validateArchitectureStatusSnapshotV1;
export declare const serializeArchitectureStatusSnapshot: typeof serializeArchitectureStatusSnapshotV1;
export declare const createArchitectureStatusSnapshotV1: typeof writeArchitectureStatusSnapshotV1;

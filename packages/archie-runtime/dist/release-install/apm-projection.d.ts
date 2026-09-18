import type { ReleaseRecord } from "../release-record/release-record-v3.js";
export interface ApmProjection {
    manifest: string;
    lock?: string;
}
/**
 * APM deploys a package only when the project's targets overlap the package's own. The Archie context
 * declares `agent-skills`; a project without it is skipped with a warning and a successful exit, which
 * is indistinguishable from an install that worked, so this is checked before deployment is attempted.
 */
export declare function assertAgentSkillsTarget(manifest: string): void;
/** Plans only an APM-valid manifest. Native APM owns the companion lock's metadata and serialization. */
export declare function planApmProjection(record: ReleaseRecord, current: {
    manifest?: string;
    lock?: string;
}, previous?: ReleaseRecord): ApmProjection;
/** Rejects manifest or native APM 0.29 lock drift before Archie treats the target as pinned. */
export declare function assertPinnedApmProjection(record: ReleaseRecord, projection: Required<ApmProjection>): void;

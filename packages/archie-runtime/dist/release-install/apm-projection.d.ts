import type { ReleaseRecord } from "../release-record/release-record-v3.js";
export interface ApmProjection {
    manifest: string;
    lock?: string;
}
/** Plans only an APM-valid manifest. Native APM owns the companion lock's metadata and serialization. */
export declare function planApmProjection(record: ReleaseRecord, current: {
    manifest?: string;
    lock?: string;
}, previous?: ReleaseRecord): ApmProjection;
/** Rejects manifest or native APM 0.29 lock drift before Archie treats the target as pinned. */
export declare function assertPinnedApmProjection(record: ReleaseRecord, projection: Required<ApmProjection>): void;

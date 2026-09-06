import { type ReleaseRecordV1 } from "../release-record/release-record-v1.js";
export interface ApmProjection {
    manifest: string;
    lock?: string;
}
/** Plans only an APM-valid manifest. Native APM owns the companion lock's metadata and serialization. */
export declare function planApmProjection(record: ReleaseRecordV1, current: {
    manifest?: string;
    lock?: string;
}, previous?: ReleaseRecordV1): ApmProjection;
/** Rejects manifest or native APM 0.29 lock drift before Archie treats the target as pinned. */
export declare function assertPinnedApmProjection(record: ReleaseRecordV1, projection: Required<ApmProjection>): void;

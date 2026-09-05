import type { ReleaseRecordV1 } from "../release-record/release-record-v1.js";
export interface ApmProjection {
    manifest: string;
    lock: string;
}
/** Plans only structurally unambiguous APM projections; unrelated dependency, deployment, and policy bytes are retained. */
export declare function planApmProjection(record: ReleaseRecordV1, current: {
    manifest?: string;
    lock?: string;
}, previous?: ReleaseRecordV1): ApmProjection;
/** Rejects target-side generated APM projection drift before an upgrade can replace the existing pin. */
export declare function assertPinnedApmProjection(record: ReleaseRecordV1, projection: ApmProjection): void;

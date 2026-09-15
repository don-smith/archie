import type { ReleaseRecordV1 } from "../release-record/release-record-v1.js";
import type { ReleaseRecordV2 } from "../release-record/release-record-v2.js";
export interface NpmProjection {
    manifest: string;
    lock: string;
}
export type ReleaseRecordForNpm = ReleaseRecordV1 | ReleaseRecordV2;
export declare function npmProjection(record: ReleaseRecordForNpm): NpmProjection;
export declare function validateNpmProjection(projection: NpmProjection, record: ReleaseRecordForNpm): void;
export declare function tarballSha256(tarball: Buffer): string;

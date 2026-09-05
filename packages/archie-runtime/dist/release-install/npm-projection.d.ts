import type { ReleaseRecordV1 } from "../release-record/release-record-v1.js";
export interface NpmProjection {
    manifest: string;
    lock: string;
}
export declare function npmProjection(record: ReleaseRecordV1): NpmProjection;
export declare function validateNpmProjection(projection: NpmProjection, record: ReleaseRecordV1): void;
export declare function tarballSha256(tarball: Buffer): string;

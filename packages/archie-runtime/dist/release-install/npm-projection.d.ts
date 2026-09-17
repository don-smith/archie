import type { ReleaseRecord } from "../release-record/release-record-v3.js";
export interface NpmProjection {
    manifest: string;
    lock: string;
}
export declare function npmProjection(record: Pick<ReleaseRecord, "version" | "artifacts">): NpmProjection;
export declare function validateNpmProjection(projection: NpmProjection, record: Pick<ReleaseRecord, "version" | "artifacts">): void;
export declare function tarballSha256(tarball: Buffer): string;

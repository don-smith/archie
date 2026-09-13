import { type ReleaseRecordV1 } from "../release-record/release-record-v1.js";
export interface SelectedRelease {
    bundleDirectory: string;
    record: ReleaseRecordV1;
    recordBytes: string;
    recordSha256: string;
    tarballPath: string;
    tarballName: string;
    npmLockBytes: string;
}
/** Selects a complete, already-finalized local bundle; it never resolves a release from a network source. */
export declare function selectLocalRelease(directory: string): SelectedRelease;

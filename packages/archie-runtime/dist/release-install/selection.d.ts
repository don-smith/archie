import { type ReleaseRecordV1 } from "../release-record/release-record-v1.js";
import { type SelectedReleaseV2 } from "../release-record/release-record-v2.js";
export interface SelectedReleaseV1 {
    bundleDirectory: string;
    record: ReleaseRecordV1;
    recordBytes: string;
    recordSha256: string;
    tarballPath: string;
    tarballName: string;
    npmLockBytes: string;
}
export type SelectedRelease = SelectedReleaseV1 | SelectedReleaseV2;
/** Selects a complete, already-finalized local bundle; it never resolves a release from a network source. */
export declare function selectLocalRelease(directory: string): SelectedRelease | SelectedReleaseV2;

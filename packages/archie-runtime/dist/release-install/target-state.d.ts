import { type ReleaseRecordV1 } from "../release-record/release-record-v1.js";
import { type ReleaseRecordV2 } from "../release-record/release-record-v2.js";
import { type ApmProjection } from "./apm-projection.js";
import { type NpmProjection } from "./npm-projection.js";
import type { SelectedRelease } from "./selection.js";
export interface PinnedTarget {
    targetDirectory: string;
    record: ReleaseRecordV1 | ReleaseRecordV2;
    recordBytes: string;
    apm: Required<ApmProjection>;
    npm: NpmProjection;
}
export interface StagedTarget extends PinnedTarget {
    selectionReceiptPath: string;
}
export declare function readPinnedTarget(targetDirectory: string): PinnedTarget;
/** Stages only Archie-owned state and a safely merged APM projection. Native installation is deferred to Phase 5. */
export declare function stageSelectedRelease(targetDirectory: string, selected: SelectedRelease, previous?: ReleaseRecordV1 | ReleaseRecordV2): StagedTarget;
export declare function bootstrapTarget(targetDirectory: string, selected: SelectedRelease): StagedTarget;
/** Internal staging step; the public upgrade flow verifies the installed target before calling this. */
export declare function stageUpgradeTarget(targetDirectory: string, selected: SelectedRelease): StagedTarget;
/** Verify deliberately has no release input: it can only inspect the target-owned pin. */
export declare function verifyPinnedTarget(targetDirectory: string): PinnedTarget;

import type { ArchitectureActiveResultSetV1, ArchitectureDriftRecordV1, ReconciliationReportV1 } from "../formats/types.js";
/** Compares opaque normalized records without changing their lifecycle or content. */
export declare function reconcile(activeInput: ArchitectureActiveResultSetV1, driftInput: ArchitectureDriftRecordV1): ReconciliationReportV1;

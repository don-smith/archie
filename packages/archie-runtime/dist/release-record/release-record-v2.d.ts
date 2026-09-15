import { type HtmlSnapshotProvenance } from "../html-snapshot/verify.js";
import { ARCHIE_SKILLS, LOCAL_REVIEW_CLAIM, type ReleaseRecordV1 } from "./release-record-v1.js";
export declare const RELEASE_RECORD_SCHEMA_VERSION_V2: 2;
export type ReleaseArtifactV2 = {
    package: string;
    version: string;
    locator: string;
    lockIntegrity: string;
    tarballSha256: string;
    requiredPlatformPayload: string;
    dependencies: Record<string, string>;
    engines: Record<string, string>;
    binaries: Record<string, string>;
};
export interface ReleaseRecordV2 {
    schemaVersion: 2;
    product: "archie";
    version: string;
    sourceCommit: string;
    authorization: {
        kind: "none";
        claim: typeof LOCAL_REVIEW_CLAIM;
    };
    artifacts: [ReleaseArtifactV2, ReleaseArtifactV2];
    apm: {
        package: string;
        skills: typeof ARCHIE_SKILLS[number][];
        locator: string;
        ref: string;
        resolvedCommit: string;
        contentHash: string;
    };
    analyzerCompatibility: {
        adapter: string;
        typescript: string;
        nodeMajor: number;
        platform: string;
        architecture: string;
        platformPackage: string;
        knownDefects: string[];
    };
    htmlDesignSnapshot: HtmlSnapshotProvenance;
}
export interface FinalizeReleaseV2Result {
    record: ReleaseRecordV2;
    recordPath: string;
    receiptPath: string;
    recordSha256: string;
}
export interface SelectedReleaseV2 {
    bundleDirectory: string;
    record: ReleaseRecordV2;
    recordBytes: string;
    recordSha256: string;
    artifacts: {
        record: ReleaseArtifactV2;
        tarballPath: string;
        tarballName: string;
    }[];
    npmLockBytes: string;
}
export declare function serializeReleaseRecordV2(record: ReleaseRecordV2): string;
export declare function parseReleaseRecordV2(bytes: string): ReleaseRecordV2;
/** The sole release evidence boundary used by selection and target verification. */
export declare function parseReleaseRecordEvidence(bytes: string): ReleaseRecordV1 | ReleaseRecordV2;
export declare function selectLocalReleaseV2(directory: string): SelectedReleaseV2;
export declare function validateBundleLayoutV2(bundleDirectory: string): void;
export declare function finalizeReleaseV2(request: {
    bundleDirectory: string;
    sourceCommit: string;
    htmlProvenancePath: string;
}): FinalizeReleaseV2Result;

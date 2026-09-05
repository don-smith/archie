import { type HtmlSnapshotProvenance } from "../html-snapshot/verify.js";
export declare const RELEASE_RECORD_SCHEMA_VERSION: 1;
export declare const LOCAL_REVIEW_CLAIM: "locally-reviewed-private-trial";
export interface ReleaseRecordV1 {
    schemaVersion: typeof RELEASE_RECORD_SCHEMA_VERSION;
    product: "archie";
    version: string;
    sourceCommit: string;
    authorization: {
        kind: "none";
        claim: typeof LOCAL_REVIEW_CLAIM;
    };
    npm: {
        package: string;
        version: string;
        locator: string;
        lockIntegrity: string;
        tarballSha256: string;
        requiredPlatformPayload: string;
    };
    apm: {
        package: string;
        skill: string;
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
export interface FinalizeReleaseRequest {
    bundleDirectory: string;
    sourceCommit: string;
    htmlProvenancePath: string;
}
export interface FinalizeReleaseResult {
    record: ReleaseRecordV1;
    recordPath: string;
    receiptPath: string;
    recordSha256: string;
}
export declare function serializeReleaseRecord(record: ReleaseRecordV1): string;
export declare function parseReleaseRecord(bytes: string): ReleaseRecordV1;
export declare function validateBundleLayout(bundleDirectory: string): void;
export declare function finalizeRelease(request: FinalizeReleaseRequest): FinalizeReleaseResult;

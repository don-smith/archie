export declare const RELEASE_RECORD_SCHEMA_VERSION: 3;
export declare const RELEASE_RECORD_FILE: "release-record-v3.json";
export declare const BUNDLE_INPUT_FORMAT: "archie-private-bundle-input-v3";
export declare const LOCAL_REVIEW_CLAIM: "locally-reviewed-private-trial";
/** The complete, sorted set of skills an Archie release deploys through APM. */
export declare const ARCHIE_SKILLS: readonly ["archie", "architecture-assessment", "architecture-conformance-onboarding", "architecture-contracts", "architecture-docs", "architecture-review", "html-design", "likec4-authoring"];
export type ArchieSkill = typeof ARCHIE_SKILLS[number];
export declare const RELEASE_ARTIFACT_PACKAGES: readonly ["@archie/runtime", "@archie/conformance"];
export type ReleaseArtifact = {
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
export interface ReleaseRecord {
    schemaVersion: typeof RELEASE_RECORD_SCHEMA_VERSION;
    product: "archie";
    version: string;
    sourceCommit: string;
    authorization: {
        kind: "none";
        claim: typeof LOCAL_REVIEW_CLAIM;
    };
    artifacts: [ReleaseArtifact, ReleaseArtifact];
    apm: {
        package: string;
        skills: ArchieSkill[];
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
}
export interface FinalizeReleaseRequest {
    bundleDirectory: string;
    sourceCommit: string;
}
export interface FinalizeReleaseResult {
    record: ReleaseRecord;
    recordPath: string;
    receiptPath: string;
    recordSha256: string;
}
export interface SelectedRelease {
    bundleDirectory: string;
    record: ReleaseRecord;
    recordBytes: string;
    recordSha256: string;
    artifacts: {
        record: ReleaseArtifact;
        tarballPath: string;
        tarballName: string;
    }[];
    npmLockBytes: string;
}
export declare function serializeReleaseRecord(record: ReleaseRecord): string;
/** The sole release evidence boundary used by selection, target verification, and consumers. */
export declare function parseReleaseRecord(bytes: string): ReleaseRecord;
export declare function validateBundleLayout(bundleDirectory: string): void;
export declare function finalizeRelease(request: FinalizeReleaseRequest): FinalizeReleaseResult;
/** Selects a complete, already-finalized local bundle; it never resolves a release from a network source. */
export declare function selectLocalRelease(directory: string): SelectedRelease;

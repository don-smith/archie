export interface HtmlSnapshotDigest {
    algorithm: "sha256";
    digest: string;
    fileCount: number;
    files: string[];
}
export declare function digestHtmlSnapshot(root: string): HtmlSnapshotDigest;
export declare function verifyHtmlSnapshot(root: string, expected: Pick<HtmlSnapshotDigest, "digest" | "fileCount">): HtmlSnapshotDigest;
export interface HtmlSnapshotProvenance {
    format: "archie-html-design-snapshot-v1";
    upstream: string;
    commit: string;
    sourcePath: string;
    gitTree: string;
    digest: Pick<HtmlSnapshotDigest, "algorithm" | "digest" | "fileCount"> & {
        value?: string;
    };
    license: {
        path: string;
        sha256: string;
    };
    requiredNotices: string[];
    importToolVersion: string;
    verificationCommand: string;
}
export declare function validateHtmlSnapshotProvenance(value: unknown): asserts value is HtmlSnapshotProvenance;

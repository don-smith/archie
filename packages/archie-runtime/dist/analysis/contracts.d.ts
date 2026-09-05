export declare const ANALYZER_ID: "typescript-program-v1";
export declare const SUPPORTED_ANALYZER: Readonly<{
    adapter: "typescript-program-v1";
    typeScript: "7.0.2";
    nodeMajor: 24;
    platform: "darwin";
    architecture: "arm64";
    platformPackage: "@typescript/typescript-darwin-arm64@7.0.2";
    knownDefects: string[];
}>;
export interface AnalysisRequest {
    contractVersion: "analysis-request-v1";
    repositoryRoot: string;
    rootConfigs: string[];
    include: string[];
    exclusions: Array<{
        path: string;
        reason: string;
    }>;
}
export interface DependencyObservation {
    source: string;
    specifier: string;
    effect: "runtime" | "type";
    resolution: "resolved" | "external" | "unresolved" | "ambiguous" | "unsupported";
}
export interface AnalysisResponse {
    contractVersion: "analysis-response-v1";
    adapter: typeof ANALYZER_ID;
    observations: DependencyObservation[];
    gaps: Array<{
        kind: string;
        message: string;
    }>;
    provenance: typeof SUPPORTED_ANALYZER;
    complete: boolean;
}
export declare function assertSupportedEnvironment(environment?: {
    node: string;
    platform: NodeJS.Platform;
    architecture: NodeJS.Architecture;
}): void;

export const ANALYZER_ID = "typescript-program-v1" as const;
export const SUPPORTED_ANALYZER = Object.freeze({
  adapter: ANALYZER_ID, typeScript: "7.0.2", nodeMajor: 24, platform: "darwin", architecture: "arm64",
  platformPackage: "@typescript/typescript-darwin-arm64@7.0.2",
  knownDefects: ["named-type-only-re-export-classified-as-runtime", "config-diagnostic-repeated-per-source-file"]
});

export interface AnalysisRequest {
  contractVersion: "analysis-request-v1";
  repositoryRoot: string;
  rootConfigs: string[];
  include: string[];
  exclusions: Array<{ path: string; reason: string }>;
}
export interface DependencyObservation {
  source: string; specifier: string; effect: "runtime" | "type"; resolution: "resolved" | "external" | "unresolved" | "ambiguous" | "unsupported";
}
export interface AnalysisResponse {
  contractVersion: "analysis-response-v1";
  adapter: typeof ANALYZER_ID;
  observations: DependencyObservation[];
  gaps: Array<{ kind: string; message: string }>;
  provenance: typeof SUPPORTED_ANALYZER;
  complete: boolean;
}

export function assertSupportedEnvironment(environment = { node: process.versions.node, platform: process.platform, architecture: process.arch }): void {
  if (!environment.node.startsWith("24.") || environment.platform !== "darwin" || environment.architecture !== "arm64") {
    throw new Error("Unsupported analyzer environment: requires Darwin arm64 with Node 24 and TypeScript 7.0.2");
  }
}

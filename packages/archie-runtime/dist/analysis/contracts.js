export const ANALYZER_ID = "typescript-program-v1";
export const SUPPORTED_ANALYZER = Object.freeze({
    adapter: ANALYZER_ID, typeScript: "7.0.2", nodeMajor: 24, platform: "darwin", architecture: "arm64",
    platformPackage: "@typescript/typescript-darwin-arm64@7.0.2",
    knownDefects: ["named-type-only-re-export-classified-as-runtime", "config-diagnostic-repeated-per-source-file"]
});
export function assertSupportedEnvironment(environment = { node: process.versions.node, platform: process.platform, architecture: process.arch }) {
    if (!environment.node.startsWith("24.") || environment.platform !== "darwin" || environment.architecture !== "arm64") {
        throw new Error("Unsupported analyzer environment: requires Darwin arm64 with Node 24 and TypeScript 7.0.2");
    }
}
//# sourceMappingURL=contracts.js.map
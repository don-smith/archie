export interface InspectedNpmTarball {
    manifest: Record<string, unknown>;
    files: ReadonlySet<string>;
}
/** Strictly inspects the narrow ustar subset emitted by npm pack for Archie packages. */
export declare function inspectNpmTarball(tarball: Buffer): InspectedNpmTarball;
export declare function normalizeNpmBinaryPath(path: unknown): string;
export declare function normalizeRequiredPlatformPayload(path: string): string;

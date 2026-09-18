import { type NativeCommandRunner } from "../release-install/run-npm.js";
import { type ReleaseArtifact } from "./release-record-v3.js";
export interface BuildBundleOptions {
    /** Directory the bundle input is written to. Created if absent; existing bundle files are replaced. */
    bundleDirectory: string;
    /** Monorepo checkout the artifacts are packed from. */
    workspaceRoot: string;
    /** GitHub SSH locator for the APM context repository. */
    locator: string;
    /** Immutable ref: a `v<version>` tag, or the full commit SHA of the checkout. */
    ref: string;
    /** Repository-relative subfolder holding the APM context, when it is not the repository root. */
    path?: string;
    run?: NativeCommandRunner;
}
export interface BuildBundleResult {
    bundleDirectory: string;
    version: string;
    artifacts: ReleaseArtifact[];
    apm: {
        package: string;
        locator: string;
        ref: string;
        path?: string;
        resolvedCommit: string;
        contentHash: string;
    };
}
/**
 * Assembles a bundle input directory from a monorepo checkout: packs both artifacts, generates their
 * shared npm lock, and has native APM resolve the context pin. Finalization is a separate step, so this
 * makes no authorization claim and reviews nothing.
 */
export declare function buildReleaseBundle(options: BuildBundleOptions): BuildBundleResult;

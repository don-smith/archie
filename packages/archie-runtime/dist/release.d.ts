/**
 * The release surface: building, finalizing, installing, verifying and removing a private bundle.
 *
 * It exists separately from the package barrel because the barrel also exports the analyzer, which
 * imports TypeScript at load. The release CLIs run from a bare clone that has installed nothing, so
 * they must reach this surface without pulling in any third-party dependency.
 */
export * from "./product-version.js";
export * from "./analysis/canonical-json.js";
export * from "./analysis/contracts.js";
export * from "./npm-tarball/inspect.js";
export * from "./release-record/release-record-v3.js";
export * from "./release-record/build-bundle.js";
export * from "./release-install/npm-projection.js";
export * from "./release-install/apm-projection.js";
export { bootstrapTarget, readPinnedTarget, verifyPinnedTarget, type PinnedTarget, type StagedTarget } from "./release-install/target-state.js";
export * from "./release-install/report.js";
export * from "./release-install/run-npm.js";
export * from "./release-install/run-apm.js";
export * from "./release-install/journal.js";
export * from "./release-install/claude-skills.js";
export * from "./release-install/verify.js";
export * from "./release-install/uninstall.js";

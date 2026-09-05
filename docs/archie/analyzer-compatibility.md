# Analyzer compatibility: `typescript-program-v1`

The first private-trial proof supports only the retained compiler-backed `typescript-program-v1` adapter on **Darwin arm64**, **Node 24**, **TypeScript 7.0.2**, and `@typescript/typescript-darwin-arm64@7.0.2`. Any other platform or Node major fails before analysis; it is not an implied compatible configuration.

The core receives language-neutral requests and returns normalized observations, gaps, provenance, and completeness. TypeScript compiler objects stay inside the adapter.

Known retained defects are visible in compatibility evidence and later reports:

- `export type { Named }` is type-only, but `export { type Named }` is classified as runtime.
- A compiler-option diagnostic is repeated once per source file.

They are intentionally not repaired or hidden in this release. Python analysis, TypeScript LSP substitution, non-Darwin platforms, and a broader compatibility claim are deferred.

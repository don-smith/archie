# Acceptance fixture matrix

| Case | Automated evidence |
| --- | --- |
| Passing graph | `test/analyzer/typescript-program-v1.test.ts` |
| Forbidden edge | `test/checker/evaluate.test.ts` and `test/cli/run.test.ts` |
| Cycle | `test/checker/acyclic.test.ts` |
| Incomplete coverage | `validateMapAgainstGraph` reports graph gaps and unmapped source files |
| Stale realization | `validateMapAgainstGraph` reports empty selectors |
| Exact waiver | `test/exceptions/fingerprint.test.ts` |
| Waiver invalidation | `test/exceptions/fingerprint.test.ts` changes the edge kind |
| Stable report | `test/cli/run.test.ts` compares repeated output bytes |
| Baseline history | `test/baseline/compare.test.ts` |

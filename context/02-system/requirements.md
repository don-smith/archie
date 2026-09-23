# 02-system — requirements

**Role:** owns the project-local runtime, the deployed context projection, and the analyzer and producer/consumer evidence contracts.

## Context

Builds on [root requirements](../requirements.md). This node owns the system boundary: what a repository receives, how deployed bytes are verified against canonical sources, and what evidence the analyzer and target-owned commands certify.

## Requirements

- **ARCHIE.SYS-R01 A project-local runtime pins released artifacts.** The runtime ships the two release artifact packages (`@archie/runtime`, `@archie/conformance`) and the eight APM-deployed skills, pinned to an immutable ref inside the target. `refines: ARCHIE-R01`
- **ARCHIE.SYS-R02 Deployed context is an exact projection.** The shipped APM context byte-matches its canonical sources: the eight skill trees, the two reference documents, and the runtime dispatch script; the projection check fails on any byte difference. `refines: ARCHIE-R01`
- **ARCHIE.SYS-R03 Analyzer support is exact and limited.** One analyzer adapter is supported, with a pinned TypeScript version, Node major, platform and architecture payload, and recorded known defects; unsupported environments are rejected up front. `refines: ARCHIE-R04`
- **ARCHIE.SYS-R04 The VRS tree is excluded from shipped content.** `context/` is not on any package file allowlist and is not part of the APM projection or any installed target path. `refines: ARCHIE-R06`
- **ARCHIE.SYS-R05 Target-owned commands keep their meaning.** Repository-local checks and analyzers remain target-owned with original exits and evidence meanings; Archie never converts advisory results or target-owned checks into one universal architecture result. `refines: ARCHIE-R04`

## Assumptions

- **ARCHIE.SYS-A01 The analyzer payload is a platform package.** The supported analyzer requires its exact platform package (`@typescript/typescript-darwin-arm64`) as a runtime dependency of the runtime package.

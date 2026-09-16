# Conformance migration record

Archie now owns the complete Conformance product. The migration from `arch-conformance` is complete at pinned source revision `361b4259a405113deaf777a38dea12f229b5b461`.

This document began as the research note for finishing a partial migration. It now records what moved, where it lives, and what still needs developer review. It is not an instruction to install or maintain a separate Conformance product.

## Current ownership

The canonical implementation is the private `@archie/conformance` workspace at `packages/conformance/`. It owns:

- realization-map and contract formats;
- deterministic rule evaluation;
- dependency-policy and cycle checks;
- exact exceptions and baselines;
- report construction and rendering;
- replay and reconciliation;
- onboarding state;
- the `architecture-conformance` CLI and exit semantics;
- Conformance skills, documentation, fixtures, and tests.

Runtime owns the shared TypeScript analyzer contract and implementation. Conformance consumes `analysis-response-v2` through the public `@archie/runtime` boundary rather than carrying another compiler-backed analyzer.

The canonical skills live at:

- `packages/conformance/skills/architecture-conformance-onboarding/`
- `packages/conformance/skills/architecture-contracts/`

Archie's generated context projects those exact trees into `packages/archie-context/.apm/skills/`.

## Target command

The Archie v2 release installs `@archie/runtime` and `@archie/conformance` into the target-owned runtime. Target repositories invoke Conformance only through:

```sh
.archie/runtime/node_modules/.bin/architecture-conformance ...
```

Do not install a standalone package, use a global link, or allow `npx` to download a command. Onboarding verifies the local tarball, generated npm projection, installed package, binary link, and release-record-v2 evidence when present.

## Migration evidence

`source-import-manifest.json` records Conformance as a completed Archie-owned migration. `packages/conformance/migration-inventory.json` maps all 98 tracked paths from the pinned source revision. The retained evidence includes:

- frozen CLI fixtures and exit meanings;
- parity coverage for checks, replay, reconciliation, onboarding, malformed input, and stale state;
- versioned report and onboarding contracts;
- package-boundary tests;
- packed Runtime and Conformance artifacts;
- v1-to-v2 upgrade and compensation coverage;
- native v2 installation through the generated manifest and bundled npm lock.

The former `packages/capabilities/assets/conformance/` copy has been removed. `scripts/import-owned-sources.mjs` verifies the pinned source, inventory summary, and absence of that legacy tree without recreating it.

## Historical context

The first Archie foundation import copied two skills and the TypeScript analyzer while leaving the checker, CLI, and most tests in `arch-conformance`. The copied skills still assumed a separately installed `architecture-conformance` package. That halfway state motivated this workstream.

Phases 1 through 7 replaced the partial import with the canonical workspace, parity evidence, public contracts, a separate Conformance release artifact, project-local execution, and completed-migration records. Architecture Docs remains a downstream consumer of versioned reports rather than checker internals.

The sibling `arch-conformance` repository remains a writable rollback reference. Archie does not push to it, archive it, or make it read-only. Any such change requires a separate developer decision.

## Deferred review

Automated migration and installation checks do not constitute developer acceptance. Review of the inventories, parity normalization, report contracts, `analysis-response-v2`, `release-record-v2`, Assessment output, and integrated Conformance behavior remains deferred to the Phase 8 release-candidate trial on another substantial repository.

## Short answer

They have been **partially integrated**.

Archie copied selected parts of `arch-conformance`, but the complete conformance product is still only in this repository. Given Archie's recorded product decisions, I think the integration should be finished, but as a deliberate migration rather than by merging the repositories wholesale.

## What has already moved into Archie

Archie records `arch-conformance` as a source input pinned to this repository’s current HEAD, `361b425`:

- `~/projects/archie/source-import-manifest.json`
- `arch-conformance` is currently clean at that exact revision.

The imported or retained pieces are:

1. **Two operating skills**
   - `architecture-conformance-onboarding`
   - `architecture-contracts`

   The Archie copies are byte-for-byte copies of the source versions.

2. **The TypeScript analyzer**
   - The compiler-backed analyzer core was copied into `@archie/runtime`.
   - Supporting path, canonical JSON, and digest utilities were also retained.
   - The analyzer core differs mostly through import-path rewrites.
   - Archie wraps it with a smaller analysis request/response contract in:
     - `packages/archie-runtime/src/analysis/typescript-program-v1.ts`
     - `packages/archie-runtime/src/analysis/contracts.ts`

3. **Capability routing**
   - Archie exposes conformance onboarding and architecture contracts as selectable capabilities.
   - It also has a generic repository-check abstraction, although that abstraction does not implement conformance policy.

This first appeared in Archie commit `53d9d6a`, `feat: establish Archie private trial foundation`.

## What has not moved

The actual `architecture-conformance` product remains here:

- realization-map and contract formats
- deterministic rule evaluation
- dependency-policy and cycle checks
- exact exceptions
- baselines
- report construction and rendering
- replay and reconciliation
- onboarding state machinery
- CLI commands and exit semantics
- most conformance tests

Archie has:

- no `architecture-conformance` package dependency
- no production import from this repository
- no conformance engine workspace
- no `architecture-conformance` executable
- no Git history relationship such as a fork or subtree

This creates a visible gap. The copied Archie skills still tell target repositories to run:

```sh
npx --no-install architecture-conformance ...
```

So the Archie capability currently assumes that the target separately installs the standalone package. Archie itself cannot supply the command.

## The nature of the overlap

| Area | Relationship |
|---|---|
| Product intent | Conformance is one of Archie’s named capabilities |
| Skills | Copied verbatim into Archie |
| TypeScript analysis | Copied and wrapped inside `@archie/runtime` |
| Checker and contract engine | Still only in `arch-conformance` |
| CLI | Still only in `arch-conformance` |
| npm dependency | None |
| Git relationship | Separate repositories |
| Documentation/visualization | Intended downstream consumer of versioned reports, not part of the checker |

One subtle point is important: the overlap is not accidental duplication. Archie’s foundation artifacts explicitly say that Archie should own the full conformance core and CLI. The accepted scope says the developer does not intend to maintain separate npm products:

`~/projects/archie/.myflow/workstreams/archie-foundation/scope/20260905T010634Z_archie-product-boundaries-and-prototype-gates.md`

The corresponding research lists the complete conformance implementation as material to move into Archie:

`~/projects/archie/.myflow/workstreams/archie-foundation/research/20260905T004310Z_archie-monorepo-product-boundaries.md`

Delivery stopped after importing the skills and analyzer.

## Should they be integrated?

**Yes, based on Archie's recorded product decision.** Maintaining the current halfway state has few benefits:

- the analyzer already exists in both repositories;
- the skills exist in both repositories;
- the skills expect a CLI Archie does not provide;
- changes to the analyzer or skill contracts can drift;
- users must understand two installation and versioning stories even though Archie claims one product version.

I would finish the migration like this:

1. Add a cohesive Archie workspace, probably `@archie/conformance`.
2. Move the complete engine, artifact formats, CLI, and tests into it.
3. Continue exposing the binary as `architecture-conformance` for target-repository compatibility.
4. Have Archie’s skills and installer provision that binary from the Archie release rather than requiring an unrelated package.
5. Keep Architecture Docs downstream. It should consume versioned conformance reports, not import checker internals. That matches `ARCHITECTURE_CONFORMANCE.md`.
6. Add parity tests against this repository before declaring the migration complete.
7. Once parity and installation replay pass, record this as a completed migration in `source-import-manifest.json`, as Archie is now doing for Architecture Docs.
8. Archive this repository or mark it read-only. Do not keep both as writable canonical implementations.

I would **not** delete or freeze `arch-conformance` yet. Today it is still the only complete implementation. Archie’s current uncommitted work is about migrating Architecture Docs and does not materially advance conformance consolidation.

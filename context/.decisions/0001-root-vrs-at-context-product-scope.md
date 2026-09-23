# 0001 — Root VRS tree at `context/`, maintainer-only

Status: accepted (2026-09-22, developer decision).

## Context

Archie's settled product, system, delivery, and documentation rules lived in eleven `docs/archie/` documents plus `README.md` and the capability catalog, with precedence maintained by convention. The public release `0.3.0` work needed one project-owned, navigable layer of settled maintainer intent — and a decision on where it lives, what it owns, and whether it is installed anywhere.

## Options

### Option A — Root `context/` VRS tree, maintainer-only — chosen

Adopt the LiveStore root-and-scoped-node shape at the repository root. The tree owns requirements, specifications, terminology, roadmap, open questions, accepted decisions, and real deltas. It is a source-only maintainer module: packages, APM projections, and installed targets exclude it, and the two deployed reference sources (`docs/archie/managed-site-guide.md`, `docs/archie/deep-module-vocabulary.md`) remain canonical at their existing paths with byte-for-byte projections.

### Option B — Leave the existing documents as permanent peers — rejected

Eleven documents plus `README.md` would remain competing intent authorities. Overlap was already maintained by convention, and drift between peer authorities is the exact problem this workstream fixes.

### Option C — Move every document verbatim into `context/` — rejected

Instructions, installed skill references, historical backlog entries, and speculative roadmap text have different jobs from settled specifications. A verbatim move would copy instruction and history into the intent layer, where no-code proposals and runbooks are not requirements.

### Option D — Stage the migration behind a broad open delta — rejected

A broad "documents not yet derived" delta would be a placeholder for work already assigned to this release, not a specific, observable divergence. Deltas record named divergences with closure checks.

## Evidence

- 2026-09-22 — developer decision: `context/` is the canonical maintainer intent layer, `.decisions/` is the repository ADR location, the intent of nine non-projected documents migrates into the tree, and the two deployed references stay at their paths. Recorded in the scope correction and design artifacts of the public-release workstream.
- 2026-09-22 — scope alignment and research inventory: the beneficiary is Archie maintainers and their agents; the tree has no installed target-repository role; the product is not npm-published and gains no authorization claim.
- LiveStore `context/spec.md` — controlling precedent for root-and-scoped-node structure, the ID scheme, maturity markers, decision and delta records, and structural checks.

## Consequences

- `context/` is the sole current settled-intent source for maintenance; product documents become derived or companion surfaces.
- The intent of nine non-projected `docs/archie/` documents migrates into owning nodes; the two projected reference sources remain at their paths.
- Packages, APM projections, and installed targets exclude the tree; the APM projection still contains exactly the eight skills, the two reference documents, and the runtime dispatch script.
- A dependency-free structural checker and its test suite enforce the mechanical invariants; semantic review remains a maintainer and agent responsibility.
- The legacy authorization wire value is preserved and tracked as an open design question with a specific delta; no release-format change is implied by this decision.

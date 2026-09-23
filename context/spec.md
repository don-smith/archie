# Archie intent layer — spec

## Status: Draft

This document specifies the composition of the Archie intent layer (`context/`): its structure, node conventions, ID scheme, maturity markers, refines rule, source precedence, decision and delta formats, and the mechanical enforcement of these invariants. It builds on [requirements.md](./requirements.md); subsystem contracts live in the responsibility nodes, not here.

## Purpose

The `context/` tree is the single authoritative intent layer for Archie maintainers. It answers "what should Archie do and why". The implementation and its documentation answer "what Archie does". The gap between intent and implementation is tracked in [`.delta/`](./.delta/).

## Tree structure

```text
context/                     root: Archie the product (this node)
  01-product/                product identity, capability membership, routing, authority stops
  02-system/                 runtime, context projection, analyzer and producer/consumer contracts
  03-delivery/               lockstep SemVer, tag versus commit pins, schema v3, local release,
                             verification and recovery
  04-docs/                   source precedence and how guides derive from the VRS
  .decisions/                accepted decision records (NNNN-slug.md)
  .delta/                    known divergence records (DELTA-NNN-slug.md)
```

Numeric prefixes encode dependency direction within a level: a higher-numbered node may depend on lower-numbered siblings, never the reverse. Order across kinds is reading order only.

## Node conventions

- `vision.md` exists at the root only. A node states its role in 1–3 sentences atop its `requirements.md`.
- Every node has a `requirements.md` and a `spec.md`, both non-empty.
- Companion directories `.decisions/` and `.delta/` hold records; the tree rejects empty companion directories.
- There is no deeper node purely to mirror a workspace path; add a node only when its responsibility has a real settled contract.

## ID scheme

All IDs carry the uniform `ARCHIE` prefix so they are globally unique when quoted outside the repository. Namespace kinds: assumptions `-A`, trade-offs `-T`, requirements `-R`, design questions `-DQ`. IDs are sequential per namespace and stable: add a sequential ID rather than renumbering casually, and renumbering updates all references in the same commit.

| Namespace prefix | Node directory |
| --- | --- |
| `ARCHIE-*` | `.` |
| `ARCHIE.PROD-*` | `01-product/` |
| `ARCHIE.SYS-*` | `02-system/` |
| `ARCHIE.DEL-*` | `03-delivery/` |
| `ARCHIE.DOCS-*` | `04-docs/` |

The tree root (`.`) holds root-namespace IDs. An ID declared in a file outside its mapped directory is a structural error.

## Declaring and referencing IDs

- A requirement (or trade-off, assumption, or design question) declares its ID as a bold token at the start of its bullet: `**ARCHIE-Rnn <summary>.**`
- A child requirement that constrains a parent concept ends with a backticked `` `refines: <parent-id>` `` marker at the end of the bullet, for example the trailing `` `refines: ARCHIE-R05` ``. Every `refines:` target must be an ID declared somewhere in the tree.
- `refines:` is a reference, not a declaration: only bold tokens declare.

## Maturity markers

- Every `spec.md` carries exactly one `## Status` heading with one of `Draft`, `Active`, or `Stable`.
- Unmarked spec content describes present supported behavior.
- Non-shipping behavior that has code opens with the bold marker `` `**Maturity: experimental**` ``.
- No-code proposals never appear as spec, requirements, or ontology content; they surface only as open questions in [open-questions.md](./open-questions.md).
- Any other maturity spelling is rejected by the checker; `proposal` is not a legal marker.

## Source precedence

- This tree is the only always-current intent layer (see [decision 0001](./.decisions/0001-root-vrs-at-context-product-scope.md)). Public documentation describes or derives from it and never silently conflicts with it.
- The two deployed reference sources remain canonical at their existing paths and byte-project into skills: `docs/archie/managed-site-guide.md` (per-capability problem, result, and starting point) and `docs/archie/deep-module-vocabulary.md` (deep-module terms). The VRS owns their product rules and terms; those files own explanatory wording and workflows.
- `README.md` and package documentation are derived entry points, not intent authorities.
- Private MyFlow workstreams are evidence only; their content and paths never become requirements or public source material.
- Divergence between intent and reality is recorded in `.delta/`, not by keeping a second authority.

## Decisions

Every accepted choice is recorded in `.decisions/NNNN-slug.md` with:

1. a `Status: accepted (YYYY-MM-DD, authority)` line;
2. a `## Context` section naming the question;
3. a `## Options` section listing at least two alternatives, one marked `chosen` and the rest `rejected`;
4. a dated `## Evidence` section; and
5. a `## Consequences` section.

No `.proposed/` records are committed. Do not write decision records for obvious version-number mechanics.

## Deltas

Known divergence from settled intent is recorded in `.delta/DELTA-NNN-slug.md` with:

1. an `Owner:` line naming the module that owns the divergence;
2. a `Status:` line with exactly `open` or `resolved`;
3. an `## Observed divergence` section; and
4. a `## Closure check` section stating what must happen before the delta closes.

A delta records a specific, observable divergence; it is not a placeholder for work already assigned.

## Enforcement

The mechanical invariants of this document are checked by a dependency-free repository-local CLI, `scripts/check-intent-tree.mjs`, and its suite `test/context/intent-tree.test.mjs`:

- required root files and node files exist and are non-empty; required directories exist and are non-empty;
- ID uniqueness across the whole tree and namespace-to-directory placement per the ID scheme table above;
- `refines:` targets resolve to declared IDs;
- relative Markdown link targets exist;
- spec `## Status` headers carry exactly one legal value;
- only `**Maturity: experimental**` is a legal maturity marker;
- decision-record shape (numbered filename, accepted dated status, options with a chosen and rejected alternatives, dated evidence, consequences);
- delta-record shape (numbered filename, owner, open or resolved status, observed divergence, closure check).

The checker validates structure, never semantic truth: it does not decide whether a product claim is true. Semantic review is a maintainer and agent responsibility.

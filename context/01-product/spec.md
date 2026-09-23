# 01-product — spec

## Status: Draft

Current product behavior. Unmarked content describes present supported behavior; proposals live in open questions, not here.

## Product shape

Archie is an architecture agent for a code repository: an assessment, a bounded review, evidence-backed architecture documentation, deterministic conformance, and drift reporting, delivered as one package of agent skills plus a pinned project-local runtime. It arrives through a clone-based install requiring Node 24, npm 11, Git, and APM 0.29, and is developed and used on macOS and Linux.

## Capability membership

The seven registered capabilities, their authority stops, and result meanings:

| Capability | Result | Authority stop | Result meaning |
|---|---|---|---|
| `assessment` | Validated fact model and assessment | The developer corrects facts and triages recommendations | Model completeness |
| `architecture-docs` | Claims, authored pages, ordered page map, preview, handoff | A maintainer approves claims; HTML Design owns the final site | Artifact validity |
| `likec4-authoring` | Compiled model and selected views | Returns claims and gaps to Architecture Docs | LikeC4 syntax and reference validity |
| `conformance-onboarding` | Observed import graph, onboarding summary, setup proposal | The maintainer chooses architecture intent and approvals | Observed setup evidence |
| `architecture-contracts` | Normative contract or exact exception, deterministic conformance result | A maintainer decides intent, approvals, exceptions, baselines | Deterministic conformance result |
| `architecture-review` | Triaged findings and a phased polish plan | The developer triages every finding; findings are not a pass | Findings, not an architecture pass |
| `html-design` | A checked HTML artifact following its profile | Presentation only; content owners decide content | Artifact profile validity |

Excluded from shipped membership: MyFlow lifecycle behavior, general development skills, named-agent dependencies, and the retired `codebase-locator` and `codebase-analyzer` modules. Repository-local checks remain target-owned commands with their original exits and evidence meanings.

## Routing and authority

- Archie invokes an owner only when the host makes it available and the request matches its trigger; an unavailable owner is recommended by stable capability ID without claiming an equivalent ran.
- One primary owner is selected; another is added only when its contract is necessary for the request.
- Capability outcomes keep their meanings: observed code never activates rules or becomes approved intent by itself.
- The `archie` skill coordinates; it does not replace the skills it coordinates and imposes no architecture-document format on a repository.

## Operating modes

Archie works in two modes. **Onboarding mode** inventories repository evidence, existing conventions, architecture assets, ownership, unknowns, approval requirements, and the safest next action. **Operational mode** handles a specific architecture question or change: it selects the narrowest capability that owns the work and returns an evidence-backed result.

Operational mode includes the named Drift Detection playbook ([`skills/archie/references/drift-detection.md`](../../skills/archie/references/drift-detection.md)). It compares a declared boundary by coordinating existing repository-owned checks; it creates no capability or repository contract and writes no target assets.

## Workspace ownership

- Architecture Docs is a first-class workspace (`packages/architecture-docs/`): it owns evidence-backed pages, claims, LikeC4 compilation, preview and handoff generation, approval, and publication checks; `likec4-authoring` is the narrower skill backed by the same module. HTML Design owns the final `site/` presentation; Architecture Docs validates that presentation against the accepted handoff.
- Assessment and Conformance are Archie-owned canonical workspaces (`packages/assessment/`, `packages/conformance/`) backed by exact per-path migration inventories. The former sibling repositories for Architecture Docs, Assessment, and Conformance were retired on 2026-09-17; the source-import manifest and migration inventories remain historical records with exact sibling revisions (for example the Architecture Docs migration from the former `c4archviewer` proof at `f2b7c5f1353c5e76fe8739a657632edafc66580f`, with later managed-site documentation and architecture status consumer changes ported at `81a008e629de8ff28b5db01a436c4425827feff5`).
- Architecture Review ships as an Archie-owned skill adapted from MyFlow, using host-neutral developer checkpoints; it may run its analysis serially. Codebase Design is not a shipped skill; its deep-module vocabulary ships as a shared reference used by Assessment and Architecture Review.

## Managed-site page

The packaged managed-site Archie page is the sole narrow exception to target-owned architecture assets. Archie supplies that page and requires its stable metadata: ID `archie`, navigation title `Archie`, and slug `archie`, along with hidden completeness markers used by warning-only checks. This contract does not create an Archie-wide architecture-document format. The target repository still owns every other page, model, glossary, evidence source, local adaptation of the Archie page, and review rule. The per-capability problem, result, and starting point are documented in the managed-site guide ([`docs/archie/managed-site-guide.md`](../../docs/archie/managed-site-guide.md)).

## Adapter policy

The core product is agent-neutral: adapters translate discovery and invocation mechanics only, and never fork capability logic. A new adapter is added only when there is a real consumer and a bounded compatibility test; it must use canonical skills and runtime contracts, keep installation project-local, preserve explicit invocation and authority boundaries, avoid silently changing ordinary agent behavior, and carry its own end-to-end trial evidence.

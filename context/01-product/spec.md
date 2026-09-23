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

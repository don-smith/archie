# Archie capability catalog

This catalog is the contract between Archie and the seven registered product capabilities. Stable capability IDs describe responsibilities, not local paths or replacement implementations. An adapter resolves an available owner by ID and reports missing owners or prerequisites.

| Capability | Trigger | Inputs | Outputs | Authority | Dependencies and gap |
|---|---|---|---|---|---|
| `assessment` | A whole-system architecture question needs evidence recovery and evaluation before redesign, alignment, or refactoring. | Architecture Assessment skill, an optional brief, approved scope, drivers, scenarios, and repository evidence. | Validated fact model and assessment. | Product source stays read-only. The developer corrects facts and triages recommendations. | Requires the skill and its presentation checks. It is not a bounded inspection. |
| `architecture-docs` | A repository needs evidence-backed architecture pages or an updated documentation handoff. | Existing asset contract, repository evidence, claims ledger, Markdown, page map, and LikeC4 workspace. | Claims, authored pages, ordered page map, preview, and handoff. | A maintainer approves claims. HTML Design owns the final site. | Requires the `architecture-docs` command from the project-local Archie runtime. It does not approve architectural truth. |
| `likec4-authoring` | Architecture Docs needs a supported C4 model or a view that answers a named question. | Evidence inventory, claims ledger, target config, architecture question, and known source links. | Compiled model, selected views, claim IDs, assumptions, and gaps. | Returns results to Architecture Docs. Compilation proves syntax and references, not architectural truth. | Runs through the Architecture Docs command in the project-local Archie runtime. It does not own prose, claim approval, or publication. |
| `conformance-onboarding` | A TypeScript repository needs observed dependency evidence before the maintainer defines conformance rules. | Approved roots, includes, exclusions, and an Archie installation supplying the pinned conformance CLI. | Observed import graph, onboarding summary, and setup proposal. | The maintainer chooses architecture intent and approvals. Observed code cannot activate rules. | Local setup must pass before analysis. The import graph is an output, not a standalone capability. |
| `architecture-contracts` | A maintainer needs a realization map, normative contract, exact exception, or explicit baseline. | Observed evidence, current realization map, contract, CLI report, and maintainer decisions. | Precise contract or exception and a deterministic conformance result. | A maintainer decides intent, active-rule approval, exceptions, and baseline handling. | Requires target-owned conformance artifacts. It never weakens a rule merely to pass CI. |
| `architecture-review` | There is no current work item, but one bounded module needs a proactive, layer-by-layer structural review. | Bounded module, directory, or file; repository instructions; and repository evidence. | Triaged findings and a phased polish plan in `.archie/reviews/`. | The developer triages every finding. Accepted phases become proposed work items; findings are not an architecture pass. | Runs the Architecture Review skill. It never edits source and does not implement its plan. |
| `html-design` | Architecture content needs a self-contained presentation: the final site from a handoff, an Assessment review packet, or a standalone document. | The Architecture Docs handoff or other approved content, and a profile (rail document, review packet, or application shell). | A checked HTML artifact. | Presentation only. It never changes claims, evidence, page intent, or source. | Ships with Archie beside the other skills; its scripts need no extra installation. |

## Selection rules

- Invoke an owner only when the host makes it available and the request matches its trigger.
- Recommend an unavailable owner by stable capability ID. Name the missing dependency and do not claim that Archie ran an equivalent capability.
- Select one primary owner. Add another only when its contract is necessary for the request.
- Preserve the selected capability's result meaning, authority stops, and approval rules.
- Use `assessment` for whole-system work and `architecture-review` for a bounded module review.
- Use `html-design` for presentation; route content changes to the capability that owns the content.
- Treat the observed import graph as a `conformance-onboarding` output. Do not advertise it as a standalone command.
- Record gaps rather than filling them with copied instructions, invented repository contracts, or host-specific assumptions.

The repository's Archie foundation and managed-site guide explain the same capability boundaries for human review. This file provides the portable routing detail used by Archie.

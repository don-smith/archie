# Archie capability catalog

This catalog is the contract between Archie and the six registered product capabilities. Stable capability IDs describe responsibilities, not local paths or replacement implementations. An adapter resolves an available owner by ID and reports missing owners or prerequisites.

| Capability | Trigger | Inputs | Outputs | Authority | Dependencies and gap |
|---|---|---|---|---|---|
| `assessment` | A whole-system architecture question needs evidence recovery and evaluation before redesign, alignment, or refactoring. | Architecture Assessment skill, planning artifact, approved scope, drivers, scenarios, and repository evidence. | Validated fact model and assessment. | Product source stays read-only. The developer corrects facts and triages recommendations. | Requires the skill and its presentation checks. It is not a bounded inspection. |
| `architecture-docs` | A repository needs evidence-backed architecture pages or an updated documentation handoff. | Existing asset contract, repository evidence, claims ledger, Markdown, page map, and LikeC4 workspace. | Claims, authored pages, ordered page map, preview, and handoff. | A maintainer approves claims. HTML Design owns the final site. | Requires the `architecture-docs` command from the project-local Archie runtime. It does not approve architectural truth. |
| `likec4-authoring` | Architecture Docs needs a supported C4 model or a view that answers a named question. | Evidence inventory, claims ledger, target config, architecture question, and known source links. | Compiled model, selected views, claim IDs, assumptions, and gaps. | Returns results to Architecture Docs. Compilation proves syntax and references, not architectural truth. | Runs through the Architecture Docs command in the project-local Archie runtime. It does not own prose, claim approval, or publication. |
| `conformance-onboarding` | A TypeScript repository needs observed dependency evidence before the maintainer defines conformance rules. | Approved roots, includes, exclusions, and an exact target-local `architecture-conformance` devDependency. | Observed import graph, onboarding summary, and setup proposal. | The maintainer chooses architecture intent and approvals. Observed code cannot activate rules. | Local setup must pass before analysis. The import graph is an output, not a standalone capability. |
| `architecture-contracts` | A maintainer needs a realization map, normative contract, exact exception, or explicit baseline. | Observed evidence, current realization map, contract, CLI report, and maintainer decisions. | Precise contract or exception and a deterministic conformance result. | A maintainer decides intent, active-rule approval, exceptions, and baseline handling. | Requires target-owned conformance artifacts. It never weakens a rule merely to pass CI. |
| `structural-inspection` | One bounded module needs a broad, layer-by-layer advisory inspection. | Bounded module scope, repository evidence, and an available host owner. | Layered advisory findings and phased options. | The developer triages findings before follow-up. Findings are not an architecture pass. | Starts through Archie. The first release may have no host owner, and there is no standalone command. |

## Selection rules

- Invoke an owner only when the host makes it available and the request matches its trigger.
- Recommend an unavailable owner by stable capability ID. Name the missing dependency and do not claim that Archie ran an equivalent capability.
- Select one primary owner. Add another only when its contract is necessary for the request.
- Preserve the selected capability's result meaning, authority stops, and approval rules.
- Use `assessment` for whole-system work and `structural-inspection` for a bounded advisory inspection.
- Treat the observed import graph as a `conformance-onboarding` output. Do not advertise it as a standalone command.
- Record gaps rather than filling them with copied instructions, invented repository contracts, or host-specific assumptions.

The repository's Archie foundation and managed-site guide explain the same capability boundaries for human review. This file provides the portable routing detail used by Archie.

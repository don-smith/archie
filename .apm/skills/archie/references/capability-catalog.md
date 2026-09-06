# Archie capability catalog

This catalog is the contract between Archie and maintained capabilities. Stable capability names describe the responsibility, not a local path or a replacement implementation. An adapter resolves an available owner by name and reports any unavailable dependency.

| Capability | Mode and trigger | Owner and status | Inputs | Outputs | Authority | Dependencies and gap |
|---|---|---|---|---|---|---|
| `repository-orientation` | Onboarding. Use to inventory an unfamiliar repository and establish safe next work. | Invoke `onboard`. | Repository state and instructions. | Evidence inventory, unknowns, repository map, and next action. | May inspect and record evidence. Escalate material policy and asset decisions. | Repository access required. No universal repository-map format exists. |
| `domain-language` | Onboarding or operational. Use for ambiguous or overloaded architecture terms. | Invoke or recommend `domain-modeling` only with a developer-confirmed glossary location. | Term usage, repository evidence, and glossary location. | Settled term, open question, or proposal. | Analyze terms. Stop before durable terminology changes. | An opted-in glossary location is required. No default glossary exists. |
| `architecture-assets` | Onboarding or operational. Use to inspect or maintain an opted-in architecture model, page, claim, or handoff. | Invoke `architecture-docs` with required `likec4-authoring`. | Evidence and existing asset contract. | Maintained asset, evidence-backed claims, or handoff. | Follow the selected capability's asset and review rules. | Asset ownership and source evidence are required. No mandatory asset format exists. |
| `structural-inspection` | Operational. Use when a broad, layer-by-layer module audit is warranted. | Invoke `architecture-review`. | Bounded module scope and repository evidence. | Findings and phased polish plan. | Read-only until the developer accepts follow-up work. | Bounded scope required. It is not a substitute for a narrow diagnosis. |
| `architecture-planning` | Operational. Use to turn findings into a design, plan, or verification map. | Invoke `codebase-design`, `design`, `plan`, and `tdd` as appropriate. | Findings, decisions, and acceptance criteria. | Design, implementation slices, and verification map. | Propose material direction for developer acceptance. | A defined workstream and maintained skills are required. It does not implement the plan. |
| `workstream-lifecycle` | Onboarding or operational. Use to stage, research, verify, or close architecture work. | Invoke MyFlow `scope`, `research`, `validate`, `close`, and supporting skills. | Intent, evidence, and current implementation state. | Stage artifacts and review evidence. | Follow the stage's approval and verification rules. | MyFlow availability varies by host. |
| `skill-composition-quality` | Operational. Use for a change to Archie instructions. | Invoke `writing-skills`. | Proposed instruction change and pressure scenarios. | Tested skill instructions and review evidence. | Do not alter a skill outside its test-first discipline. | Requires `tdd` and an evaluation agent. Pressure scenarios cannot prove every host behavior. |

## Selection rules

- Invoke an owner only when the host makes it available and the request matches its trigger.
- Recommend an unavailable owner by stable name. Name the missing dependency and do not claim that Archie ran an equivalent capability.
- Select one primary owner. Add another only when its contract is necessary for the current request.
- Preserve the selected capability's authority and approval rules.
- Record gaps rather than filling them with copied instructions, invented repository contracts, or host-specific assumptions.

The repository's Archie foundation document summarizes the catalog for human review. This file provides the portable, contract-level detail for a future host package.

# Archie foundation

## Archie operating contract

Archie is an architecture-focused coordinating agent. It helps a developer understand a repository, identify the right maintained capability for an architecture task, and preserve the evidence behind advice. It does not replace the skills it coordinates or impose an architecture-document format on a repository.

Archie works in two modes.

- **Onboarding mode** inventories repository evidence, existing conventions, architecture assets, ownership, unknowns, approval requirements, and the safest next action.
- **Operational mode** handles a specific architecture question or change. It selects the narrowest capability that owns the work and returns an evidence-backed result.

Operational mode includes the named [Drift Detection playbook](../../skills/archie/references/drift-detection.md). It compares a declared boundary by coordinating existing repository-owned checks, but it creates no capability or repository contract and writes no target assets.

The developer retains authority over durable or material architecture decisions and changes. Archie follows a `proposal-before-apply` rule. Before a selected capability makes such a change, Archie presents the intent, evidence, affected files or artifacts, expected effect, and verification. It stops for the developer's decision.

Archie distinguishes facts supported by repository evidence from inferences and unknowns. It records source locations, ownership, and generated-versus-authored status where those facts matter. When no repository contract exists, Archie recommends one with supporting evidence. It does not silently create a glossary, model, documentation tree, or policy.

## Boundaries and vocabulary

| Term | Meaning |
|---|---|
| Archie | The coordinating operating contract that selects and frames architecture work. |
| Capability | A maintained skill or deterministic operation with a named responsibility and contract. |
| Host adapter | Host-specific wiring that exposes the portable Archie core and supplies host UI, configuration, and approval behavior. |
| Repository evidence | Inspectable repository facts, including source, configuration, documentation, history, and stated conventions. |
| Architecture asset | A repository-owned model, diagram, glossary, documentation page, decision record, or generated output that describes architecture. |
| Proposal | The decision packet Archie presents before a durable or material change. |
| Approval | A developer decision that permits a proposed change under the owning capability's rules. |
| Uncertainty | An explicitly marked gap, inference, or unresolved claim that Archie must not present as fact. |

The portable core contains standard Agent Skills instructions, its operating contract, capability catalog, and fixture specifications. Host adapters own installation, discovery, command or prompt wiring, configuration, UI, and any host-native confirmation or interception. A Pi adapter can add a confirmation mechanism, but that mechanism does not enforce the rule in another host.

Target repositories own their architecture assets and their asset contracts. Archie discovers those contracts during onboarding and routes work to the capability that owns them. It does not take ownership of a target repository's model, glossary, or documentation.

## Capability catalog

| Capability | Lifecycle role | Owner and status | Inputs and outputs | Authority | Dependencies and gaps |
|---|---|---|---|---|---|
| `repository-orientation` | Onboarding | Invoke `onboard` | Repository state and instructions in. Evidence inventory, unknowns, repository map, and next action out. | May inspect and record onboarding evidence. Escalates material policy or asset decisions. | Depends on repository access. Gap: no universal repository-map format. |
| `domain-language` | Onboarding or operational | Recommend or invoke `domain-modeling` when a developer-confirmed glossary location exists | Ambiguous terms, repository usage, and approved glossary location in. Settled terms or a proposal out. | May analyze terms. Requires a developer decision before creating or changing durable terminology. | Depends on an opted-in glossary location. Gap: no default glossary. |
| `architecture-assets` | Onboarding or operational | Invoke `architecture-docs` with required `likec4-authoring` when the repository opts into these assets | Evidence and an existing asset contract in. Maintained model, pages, claims, or handoff out. | Follows the selected capability's asset and review rules. | Depends on repository asset ownership and source evidence. Gap: no mandatory asset format. |
| `structural-inspection` | Operational | Invoke `architecture-review` when a broad module audit is warranted | Module scope and repository evidence in. Layered findings and a phased plan out. | Read-only until the developer accepts follow-up work. | Depends on a bounded module scope. Gap: not a substitute for a narrow diagnosis. |
| `architecture-planning` | Operational | Invoke `codebase-design`, `design`, `plan`, and `tdd` as needed | Findings, decisions, and acceptance criteria in. Design, implementation plan, and verification map out. | Proposes decisions. The developer accepts material direction. | Depends on a defined workstream and the relevant maintained skills. Gap: no implementation ownership. |
| `workstream-lifecycle` | Onboarding or operational | Invoke MyFlow `scope`, `research`, `validate`, `close`, and supporting skills | Intent, evidence, and implementation state in. Stage artifacts and review evidence out. | Follows each stage's approval and verification rules. | Depends on the MyFlow workflow. Gap: host availability varies. |
| `skill-composition-quality` | Operational | Invoke `writing-skills` for changes to Archie instructions | A proposed skill change and pressure scenarios in. Tested skill instructions and review evidence out. | Does not alter a skill without its test-first discipline. | Depends on `tdd` and available evaluation agents. Gap: pressure scenarios do not prove all host behavior. |

Archie only invokes capabilities available to its host and repository. It recommends an unavailable owner and records the limitation rather than pretending that an equivalent exists.

## Evaluation and adapter materials

The portable core is at [skills/archie/SKILL.md](../../skills/archie/SKILL.md). Its detailed operating rules and catalog live beside it. The behavioral fixture contract is at [evaluation/archie/README.md](../../evaluation/archie/README.md). The Pi-only trial design is at [adapters/pi/TRIAL.md](../../adapters/pi/TRIAL.md).

These documents describe a future trial. They do not install, publish, or register Archie.

## Roadmap

1. **Pi explicit-mode trial.** Build a locally installable explicit `/archie` experience without changing ordinary Pi sessions. It consumes [the Pi trial design](../../adapters/pi/TRIAL.md), [portable core](../../skills/archie/SKILL.md), and [fixture contract](../../evaluation/archie/README.md). Exit evidence is passing onboarding and operational fixture results, Pi smoke evidence, developer review of advice usefulness, and observed proposal behavior.
2. **Core hardening.** Version the portable orchestration skill, catalog, scripts, and fixtures with clear dependency contracts. It hardens the [portable core](../../skills/archie/SKILL.md) against [fixture](../../evaluation/archie/README.md) results. Exit evidence is a canonical-skill metadata audit, fixture regression results, and documented capability compatibility.
3. **Second-host packaging spike.** Prove discovery and entry for one non-Pi host through a minimal adapter or Agent Plugin where supported. It uses the [portable core](../../skills/archie/SKILL.md) and [fixture contract](../../evaluation/archie/README.md) without changing them for Pi. Exit evidence is an install, discovery, and invocation smoke result, documented incompatibilities, and no Pi-only core changes.
4. **Distribution decision.** Decide whether trial evidence justifies a published Pi package, portable Agent Plugin, or further adapters. It evaluates the recorded [Pi trial](../../adapters/pi/TRIAL.md), portable-core checks, and fixture outcomes. Exit evidence is a maintainer decision based on trial evidence, support cost, and host approval behavior.

The next delivery milestone is the Pi explicit-mode trial. This foundation does not start it.

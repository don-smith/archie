# Archie foundation

## Archie operating contract

Archie is an architecture-focused coordinating agent. It helps a developer understand a repository, identify the right maintained capability for an architecture task, and preserve the evidence behind advice. It does not replace the skills it coordinates or otherwise impose an architecture-document format on a repository.

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

Target repositories normally own their architecture assets and their asset contracts. Archie discovers those contracts during onboarding and routes work to the capability that owns them.

The packaged managed-site Archie page is the sole narrow exception. Archie supplies that page and requires its stable metadata: ID `archie`, navigation title `Archie`, and slug `archie`, along with hidden completeness markers used by warning-only checks. This contract does not create an Archie-wide architecture-document format. The target repository still owns every other page, model, glossary, evidence source, local adaptation of the Archie page, and review rule.

## Capability catalog

| Capability | Use it for | Result | Authority | Dependencies and gaps |
|---|---|---|---|---|
| `assessment` | A whole-system, evidence-led architecture assessment | Validated fact model and assessment | The developer corrects facts and triages recommendations. Product source stays read-only. | Requires the Architecture Assessment skill, approved drivers and scope (from a brief or its first checkpoint), and its stated presentation checks. |
| `architecture-docs` | Evidence-backed architecture documentation | Claims, authored pages, ordered page map, preview, and handoff | A maintainer approves claims. HTML Design owns the final site. | Requires the Architecture Docs command from the target's project-local Archie runtime and repository evidence. |
| `likec4-authoring` | C4 model and view work for Architecture Docs | Compiled model and selected views | Returns claims and unresolved gaps to Architecture Docs. Compilation does not establish architectural truth. | Requires the Architecture Docs evidence inventory, claims ledger, and target config. |
| `conformance-onboarding` | Deterministic TypeScript dependency evidence and conformance setup | Observed import graph, onboarding summary, and setup proposal | The maintainer chooses architecture intent and approval. | Requires an exact target-local `architecture-conformance` dependency. |
| `architecture-contracts` | A realization map, normative contract, exact exception, or explicit baseline | Contract or exception plus a deterministic conformance result | A maintainer decides intent, active rules, exceptions, and baseline handling. | Requires observed evidence and the target-owned conformance artifacts. |
| `architecture-review` | A proactive, layer-by-layer review of one bounded module | Triaged findings and a phased polish plan | The developer triages every finding; accepted phases become proposed work items. Findings are not an architecture pass. | Requires the Architecture Review skill. It never edits source. |
| `html-design` | Self-contained HTML presentation: the final documentation site, review packets, and documents | A checked artifact that follows its profile | Presentation only. It never changes architecture claims, evidence, or source. | Ships with Archie beside the other skills and needs no extra installation. |

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

<!-- archie-guide:v1 -->
# Working with Archie

<!-- archie-topic:overview -->
Archie coordinates architecture work in this repository. It inspects repository evidence, identifies the narrowest registered capability for a request, and keeps that capability's result and authority limits intact. Archie does not replace the capability, declare architectural truth, or make material architecture decisions for the developer.

This guide describes the Archie product contract. A repository's Archie page should adapt it with local paths, commands, owners, evidence, and availability facts. Keep the `archie-*` comments when adapting the guide. Architecture Docs carries the authored page through its page map and handoff. HTML Design owns the final site presentation.

<!-- archie-topic:working-relationship -->
## How developers work with Archie

Start with the architecture question and the repository scope that matters. Archie checks local instructions and architecture assets, labels facts, inferences, and unknowns, then names the capability that owns the next step. If the owner or a required dependency is unavailable, Archie reports that gap instead of simulating the workflow.

The developer or maintainer keeps decision authority. Before a capability applies a durable or material architecture change, Archie presents the intent, evidence, affected artifacts, expected effect, and verification. Work continues only after the required decision. Advisory findings never become a pass result, and observed code never becomes approved architecture intent by itself.

## Capabilities

### Assessment

<!-- archie-capability:assessment:problem -->
**Problem.** Use Assessment to recover and evaluate the architecture of a whole system when redesign, alignment, or refactoring needs a shared evidence base.

<!-- archie-capability:assessment:when-to-use -->
**When to use it.** Choose it for a whole-repository question that needs a fact model, current and intended views, explicit gaps, and evidence-led findings. Use Architecture Review instead for one bounded module.

<!-- archie-capability:assessment:result -->
**Result.** The Architecture Assessment skill produces a validated fact model and assessment. It remains read-only over product source. The developer corrects recovered facts and triages recommendations, so completeness does not mean that every recommendation is approved.

<!-- archie-capability:assessment:start -->
**Start.** Ask Archie for a whole-system Assessment and give the Architecture Assessment skill an optional brief with drivers, scope, and scenarios; without one it agrees them with you at its first checkpoint. Results go to `.archie/assessments/` unless you choose another location. Assessment cannot become ready when its required skill or presentation check is unavailable.

### Architecture Docs

<!-- archie-capability:architecture-docs:problem -->
**Problem.** Use Architecture Docs to maintain evidence-backed architecture pages, claims, page order, and the architecture content handed to the site composer.

<!-- archie-capability:architecture-docs:when-to-use -->
**When to use it.** Choose it when onboarding or updating repository architecture documentation, recording claim evidence and review state, or rebuilding the documentation handoff after approved content changes.

<!-- archie-capability:architecture-docs:result -->
**Result.** Architecture Docs owns authored Markdown, the claims ledger, the ordered page map, `preview/`, and `handoff/`. A maintainer approves claims. HTML Design alone owns the final `site/`, and its presentation must consume the architecture handoff rather than an unrelated copy.

<!-- archie-capability:architecture-docs:start -->
**Start.** Ask Archie to route the work to Architecture Docs. Run its commands from the target repository through the `architecture-docs` command in the project-local Archie runtime (`.archie/runtime`) and its `architecture-docs.config.json`. Begin by inventorying existing architecture assets before creating or moving authored content.

### LikeC4 authoring

<!-- archie-capability:likec4-authoring:problem -->
**Problem.** Use LikeC4 authoring to express supported C4 elements, relationships, and views that answer specific architecture questions.

<!-- archie-capability:likec4-authoring:when-to-use -->
**When to use it.** Choose it while Architecture Docs needs a new or corrected model or view. Start with system context and containers, then add a deeper or dynamic view only when a named question requires it.

<!-- archie-topic:c4-view-selection -->
Select the smallest view set that answers the reader's question. A context view shows people, the documented system, and relevant external systems. A container view shows independently running or separately stored units. Component, dynamic, and deployment views need a specific question and evidence. Do not turn directories into containers or create one view per source area.

<!-- archie-capability:likec4-authoring:result -->
**Result.** LikeC4 authoring returns a validated workspace, selected view IDs, source links, claim IDs, assumptions, gaps, and the compiler result to Architecture Docs. LikeC4 compilation proves syntax and references, not architectural truth. Maintainer-approved evidence and claims provide that meaning.

<!-- archie-capability:likec4-authoring:start -->
**Start.** Ask Archie to use LikeC4 authoring as part of Architecture Docs, then provide the evidence inventory, claims ledger, target config, and the architecture question each view must answer. Compile through the Architecture Docs command in the project-local Archie runtime, not an unpinned global CLI.

### Conformance onboarding

<!-- archie-capability:conformance-onboarding:problem -->
**Problem.** Use Conformance onboarding to collect deterministic TypeScript dependency evidence and prepare a proposal for maintainer-owned conformance rules.

<!-- archie-capability:conformance-onboarding:when-to-use -->
**When to use it.** Choose it when a TypeScript repository needs its current dependency structure observed before a maintainer defines realization maps, contracts, approvals, exceptions, or baselines.

<!-- archie-topic:observed-import-graph -->
The observed import graph is an output of Conformance onboarding, not a standalone Archie capability or command. It records what the analyzer found under the approved roots, includes, and exclusions. Gaps and unmatched evidence stay visible. The graph does not decide intended architecture.

<!-- archie-capability:conformance-onboarding:result -->
**Result.** Conformance onboarding produces the observed import graph, an onboarding summary, and a setup proposal. The maintainer chooses architecture intent and approvals. Archie and the analyzer cannot promote observed relationships into active rules.

<!-- archie-capability:conformance-onboarding:start -->
**Start.** Ask Archie to route the request to Conformance onboarding, then run `.archie/runtime/node_modules/.bin/architecture-conformance onboard setup` from the target repository. The CLI ships inside the pinned Archie runtime, so the target needs no `architecture-conformance` dependency of its own; never use a global executable or `npx`. If local setup fails, repair the Archie installation before analysis.

### Architecture Contracts

<!-- archie-capability:architecture-contracts:problem -->
**Problem.** Use Architecture Contracts to draft or change the normative realization map, contract, exact exception, or explicit baseline checked against observed evidence.

<!-- archie-capability:architecture-contracts:when-to-use -->
**When to use it.** Choose it after Conformance onboarding when a maintainer is ready to define intended relationships, or when a deterministic check needs a reviewed contract change rather than a CI workaround.

<!-- archie-capability:architecture-contracts:result -->
**Result.** The capability produces a precise contract or exception and a deterministic conformance report. Only the CLI decides whether evidence conforms to the approved rules. A maintainer decides intent, active-rule approval, exceptions, and baseline handling.

<!-- archie-capability:architecture-contracts:start -->
**Start.** Ask Archie to route the work to Architecture Contracts with the current observed evidence, realization map, contract, and CLI report. After the maintainer supplies the required decision, run `.archie/runtime/node_modules/.bin/architecture-conformance check --map <map> --contract <contract> --strict` and trace results to their rule and source evidence.

### Architecture Review

<!-- archie-capability:architecture-review:problem -->
**Problem.** Use Architecture Review when there is no current work item but one bounded module deserves attention: before a release, after a major refactor, or when it has grown enough to warrant a structural review.

<!-- archie-capability:architecture-review:when-to-use -->
**When to use it.** Choose it for a proactive, layer-by-layer review of one module, directory, or file. Use Assessment when the question concerns the whole system, needs a validated fact model, or must compare current and intended architecture.

<!-- archie-capability:architecture-review:result -->
**Result.** Architecture Review produces triaged findings and a phased polish plan in one living artifact. The developer triages every finding, and accepted phases become proposed work items for the repository's tracker. Findings are advisory: they are not an architecture pass, and the review never edits source.

<!-- archie-capability:architecture-review:start -->
**Start.** Ask Archie to review a bounded module. The review confirms the layer split with you, reads every file in scope, and writes to `.archie/reviews/` unless you choose another location. Implement accepted phases later through the repository's normal workflow.

### HTML Design

<!-- archie-capability:html-design:problem -->
**Problem.** Use HTML Design when architecture content needs a readable, accessible, self-contained presentation: the final documentation site, an assessment review packet, or another standalone document.

<!-- archie-capability:html-design:when-to-use -->
**When to use it.** Choose it to compose the final `site/` from the Architecture Docs handoff, to build an Assessment `packet.html`, or to restyle an artifact with a named palette. Use Architecture Docs to change the architecture content itself.

<!-- archie-capability:html-design:result -->
**Result.** HTML Design produces a self-contained artifact that follows its profile (rail document, review packet, or application shell) and passes its artifact checker. It owns presentation only and never changes claims, evidence, page intent, or source.

<!-- archie-capability:html-design:start -->
**Start.** Ask Archie to compose or restyle the artifact with HTML Design. It ships with Archie beside the other skills, so its scaffold, palette, refresh, and check scripts run without any extra installation.

<!-- archie-topic:stewardship -->
## Ongoing stewardship

Treat architecture documentation and checks as maintained repository assets after onboarding. Update claims and authored Markdown when repository evidence changes. Recompile affected LikeC4 views, rebuild the Architecture Docs preview and handoff, and ask HTML Design to recompose the site from that handoff. Reapprove claims only through the maintainer review flow.

Revisit conformance evidence when source scope or dependencies change. A maintainer must review changes to realization maps, contracts, active rules, exceptions, and baselines. Keep Assessment findings and Architecture Review findings tied to their evidence and triage decisions instead of presenting old advice as current fact.

An Archie-managed site should keep an obvious `Archie` area with slug `archie` in the ordered Architecture Docs page map. Run the repository's preview, publication, and final-site checks after changes. Missing or stale Archie material should be fixed, but its warning does not replace the checks that own claims, model validity, conformance, or final HTML.

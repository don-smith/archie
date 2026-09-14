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
**When to use it.** Choose it for a whole-repository question that needs a fact model, current and intended views, explicit gaps, and evidence-led findings. Use Structural inspection instead for a bounded advisory inspection.

<!-- archie-capability:assessment:result -->
**Result.** The Architecture Assessment skill produces a validated fact model and assessment. It remains read-only over product source. The developer corrects recovered facts and triages recommendations, so completeness does not mean that every recommendation is approved.

<!-- archie-capability:assessment:start -->
**Start.** Ask Archie for a whole-system Assessment and supply the Architecture Assessment skill with a planning artifact that names the workstream, drivers, scope, and acceptance criteria. Assessment cannot become ready when its required skill or presentation check is unavailable.

### Architecture Docs

<!-- archie-capability:architecture-docs:problem -->
**Problem.** Use Architecture Docs to maintain evidence-backed architecture pages, claims, page order, and the architecture content handed to the site composer.

<!-- archie-capability:architecture-docs:when-to-use -->
**When to use it.** Choose it when onboarding or updating repository architecture documentation, recording claim evidence and review state, or rebuilding the documentation handoff after approved content changes.

<!-- archie-capability:architecture-docs:result -->
**Result.** Architecture Docs owns authored Markdown, the claims ledger, the ordered page map, `preview/`, and `handoff/`. A maintainer approves claims. HTML Design alone owns the final `site/`, and its presentation must consume the architecture handoff rather than an unrelated copy.

<!-- archie-capability:architecture-docs:start -->
**Start.** Ask Archie to route the work to Architecture Docs. Run its commands from the target repository through the pinned target-local `architecture-docs` package and its `architecture-docs.config.json`. Begin by inventorying existing architecture assets before creating or moving authored content.

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
**Start.** Ask Archie to use LikeC4 authoring as part of Architecture Docs, then provide the evidence inventory, claims ledger, target config, and the architecture question each view must answer. Compile through the pinned Architecture Docs package, not an unpinned global CLI.

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
**Start.** The target must first pin an exact target-local `architecture-conformance` devDependency. Ask Archie to route the request to Conformance onboarding, then run `npx --no-install architecture-conformance onboard setup` from the target repository. If local setup fails, stop and install the exact dependency before analysis.

### Architecture Contracts

<!-- archie-capability:architecture-contracts:problem -->
**Problem.** Use Architecture Contracts to draft or change the normative realization map, contract, exact exception, or explicit baseline checked against observed evidence.

<!-- archie-capability:architecture-contracts:when-to-use -->
**When to use it.** Choose it after Conformance onboarding when a maintainer is ready to define intended relationships, or when a deterministic check needs a reviewed contract change rather than a CI workaround.

<!-- archie-capability:architecture-contracts:result -->
**Result.** The capability produces a precise contract or exception and a deterministic conformance report. Only the CLI decides whether evidence conforms to the approved rules. A maintainer decides intent, active-rule approval, exceptions, and baseline handling.

<!-- archie-capability:architecture-contracts:start -->
**Start.** Ask Archie to route the work to Architecture Contracts with the current observed evidence, realization map, contract, and CLI report. After the maintainer supplies the required decision, run `architecture-conformance check --map <map> --contract <contract> --strict` and trace results to their rule and source evidence.

### Structural inspection

<!-- archie-capability:structural-inspection:problem -->
**Problem.** Use Structural inspection for a broad, layer-by-layer look at one bounded module when the developer needs advisory findings and phased follow-up options.

<!-- archie-capability:structural-inspection:when-to-use -->
**When to use it.** Choose it for a bounded module inspection. Use Assessment when the question concerns the whole system, needs a validated fact model, or must compare current and intended architecture.

<!-- archie-capability:structural-inspection:result -->
**Result.** Structural inspection produces layered advisory findings and phased options. The developer triages those findings before follow-up. They are not an architecture pass, an approved plan, or a substitute for a target-owned deterministic check.

<!-- archie-capability:structural-inspection:start -->
**Start.** Structural inspection starts through Archie. Give Archie the bounded module scope and the question to inspect. The first release may have no available owner in the current host. When that happens, Archie reports the unavailable owner and stops rather than substituting Assessment or inventing a standalone command.

<!-- archie-topic:stewardship -->
## Ongoing stewardship

Treat architecture documentation and checks as maintained repository assets after onboarding. Update claims and authored Markdown when repository evidence changes. Recompile affected LikeC4 views, rebuild the Architecture Docs preview and handoff, and ask HTML Design to recompose the site from that handoff. Reapprove claims only through the maintainer review flow.

Revisit conformance evidence when source scope or dependencies change. A maintainer must review changes to realization maps, contracts, active rules, exceptions, and baselines. Keep Assessment findings and Structural inspection findings tied to their evidence and triage decisions instead of presenting old advice as current fact.

An Archie-managed site should keep an obvious `Archie` area with slug `archie` in the ordered Architecture Docs page map. Run the repository's preview, publication, and final-site checks after changes. Missing or stale Archie material should be fixed, but its warning does not replace the checks that own claims, model validity, conformance, or final HTML.

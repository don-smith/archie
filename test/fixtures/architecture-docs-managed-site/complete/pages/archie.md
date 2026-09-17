<!-- archie-guide:v1 -->
# Working with Archie

Archie coordinates evidence-led architecture work in this repository. It helps developers choose the right workflow, keeps authority with maintainers, and turns reviewed results into durable architecture stewardship.

<!-- archie-topic:overview -->
## What Archie is

Archie is a coordinating agent, not a replacement for repository owners or the tools that produce architecture evidence. Start with `/skill:archie`, describe the decision or change, and let Archie route the request to the capability that owns the next step.

> The developer remains the authority for intent, boundaries, approvals, and adoption. Archie proposes; the repository's maintainers decide what becomes true.

<!-- archie-topic:working-relationship -->
## How developers work with Archie

Bring a concrete question, the relevant repository context, and any planning artifact the workflow requires. Archie explains the selected capability, records evidence and uncertainty, and pauses for developer decisions instead of silently applying architectural changes.

<!-- archie-topic:stewardship -->
## After onboarding: ongoing stewardship

Keep the architecture model, claims, contracts, and documentation close to the code they describe. Re-run the owning workflow when boundaries change, review the resulting evidence, and use the managed site as the durable record of current intent rather than a one-time report.

<!-- archie-topic:observed-import-graph -->
## Observed import graph

Conformance onboarding can produce an observed TypeScript import graph to make current relationships visible. It is evidence for a maintainer conversation, not an architectural truth claim and not a standalone Archie command. The target must provide the exact local `architecture-conformance` dependency before analysis can run.

<!-- archie-topic:c4-view-selection -->
## Choosing and reading C4 views

Use a view whose scope matches the decision: context for boundaries, containers for responsibilities, and components only when a bounded implementation detail matters. LikeC4 compilation proves syntax and references; it does not prove that the architecture is correct. Read each view alongside its claims and evidence.

## Capabilities

<!-- archie-capability:assessment:problem -->
<!-- archie-capability:assessment:when-to-use -->
<!-- archie-capability:assessment:result -->
<!-- archie-capability:assessment:start -->
### Assessment

- **Problem:** Whole-system architecture questions need evidence, not a quick opinion.
- **When to use:** Use it when the decision spans the repository or several system boundaries.
- **Result:** An evidence-led assessment with findings, uncertainty, and developer checkpoints.
- **Start:** Start Archie with the Architecture Assessment skill and provide a planning artifact.

<!-- archie-capability:architecture-docs:problem -->
<!-- archie-capability:architecture-docs:when-to-use -->
<!-- archie-capability:architecture-docs:result -->
<!-- archie-capability:architecture-docs:start -->
### Architecture Docs

- **Problem:** Architecture knowledge drifts when prose, models, and evidence are maintained separately.
- **When to use:** Use it to curate the model, claims ledger, page map, and handoff for this site.
- **Result:** Reviewed Markdown, LikeC4 views, provenance, and an HTML Design handoff.
- **Start:** Use the target-local Architecture Docs commands; HTML Design owns the final `site/` presentation.

<!-- archie-capability:likec4-authoring:problem -->
<!-- archie-capability:likec4-authoring:when-to-use -->
<!-- archie-capability:likec4-authoring:result -->
<!-- archie-capability:likec4-authoring:start -->
### LikeC4 authoring

- **Problem:** Readers need stable, named views of system relationships at the right level.
- **When to use:** Use it when model structure or a view needs to be created or changed.
- **Result:** A compilable model and selected views that support the authored explanation.
- **Start:** Start the LikeC4 authoring workflow and validate references before relying on a view.

<!-- archie-capability:conformance-onboarding:problem -->
<!-- archie-capability:conformance-onboarding:when-to-use -->
<!-- archie-capability:conformance-onboarding:result -->
<!-- archie-capability:conformance-onboarding:start -->
### Conformance onboarding

- **Problem:** Existing code relationships and intended boundaries are often not recorded together.
- **When to use:** Use it when a repository is adopting conformance checks or needs current relationship evidence.
- **Result:** An observed import graph and a setup proposal for maintainer review.
- **Start:** Install the exact target-local `architecture-conformance` dependency first; Archie does not substitute a different package.

<!-- archie-capability:architecture-contracts:problem -->
<!-- archie-capability:architecture-contracts:when-to-use -->
<!-- archie-capability:architecture-contracts:result -->
<!-- archie-capability:architecture-contracts:start -->
### Architecture Contracts

- **Problem:** Maintainer-approved boundaries need deterministic checks that stay close to the code.
- **When to use:** Use it after intent and evidence have been reviewed and a realization map is ready.
- **Result:** Contracts, exceptions, and strict checks for the approved architecture.
- **Start:** Begin with the maintainer-approved map and contract; the strict check belongs to Architecture Contracts.

<!-- archie-capability:architecture-review:problem -->
<!-- archie-capability:architecture-review:when-to-use -->
<!-- archie-capability:architecture-review:result -->
<!-- archie-capability:architecture-review:start -->
### Architecture Review

- **Problem:** A module can drift structurally without any current work item that would surface it.
- **When to use:** Use it for a proactive, layer-by-layer review of one bounded module.
- **Result:** Triaged findings and a phased polish plan that become work items.
- **Start:** Ask Archie to review the module; accepted phases become work items in the repository's tracker.

<!-- archie-capability:html-design:problem -->
<!-- archie-capability:html-design:when-to-use -->
<!-- archie-capability:html-design:result -->
<!-- archie-capability:html-design:start -->
### HTML Design

- **Problem:** Architecture content needs a readable, accessible, self-contained presentation.
- **When to use:** Use it to compose the final site from the handoff or to build a review packet.
- **Result:** A checked HTML artifact that follows its profile.
- **Start:** Ask Archie to compose the site from the current handoff with HTML Design.

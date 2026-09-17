# Archie roadmap

Archie is one integrated private product. This roadmap sequences the work after the Foundation milestone without treating imported capabilities as permanent standalone products.

## Current baseline

Foundation closes with:

- one private monorepo and product version;
- a project-local npm runtime plus an APM-deployed six-skill context;
- explicit local release selection with no authorization claim;
- private Git SSH context identity, APM-native locks, frozen installation, replay, recovery, and byte-level deployment verification;
- Architecture Docs owned and shipped as an Archie workspace;
- a successful Jaspyr trial in which the deployed Archie project skill was used without changing ordinary Pi behavior.

The deployed skills are currently:

1. `archie`
2. `architecture-assessment`
3. `architecture-conformance-onboarding`
4. `architecture-contracts`
5. `architecture-docs`
6. `likec4-authoring`

This membership is accepted for the Foundation release line. It can change only through an explicit product-boundary decision.

## Conformance consolidation status

Archie now owns the complete Conformance engine, formats, CLI, skills, tests, reports, replay, reconciliation, and onboarding state in `@archie/conformance`. The private release records Runtime and Conformance as ordered local artifacts and verifies the project-local `architecture-conformance` binary. Parity against pinned `arch-conformance@361b4259a405113deaf777a38dea12f229b5b461` and the versioned report contracts are retained as migration evidence.

The sibling `arch-conformance` repository was retired on 2026-09-17 after consolidation; Archie is the only source. Architecture Docs consumption of the public Conformance contracts remains a later integration workstream.

## Deployment hardening and next private release

Do not publish a new private release from the current source merely to mark Foundation closed. Publish after conformance consolidation and deployment hardening produce one coherent release candidate.

Hardening should cover:

- one canonical parser for bundle and native-lock evidence where duplication creates drift risk;
- full release finalization against the complete integrated product;
- GitHub SSH preflight and immutable tag/ref confirmation;
- clean bootstrap, replay, upgrade, tamper rejection, and compensated-failure trials;
- explicit evidence that selected artifacts match installed npm, APM, and embedded Architecture Docs bytes;
- operator documentation for credentials, target prerequisites, failure reports, and recovery boundaries;
- a release decision that still distinguishes local consistency from authorization or trust.

## Ownership decisions

Resolve these independently rather than reopening Foundation:

- **HTML Design:** decided on 2026-09-17 to ship HTML Design as a first-class Archie capability. The standalone `html-design-skill` repository stays separate, and duplication is accepted. Preserve provenance and notices.
- **Architecture Docs source:** Archie is canonical. `c4archviewer` was retired on 2026-09-17 after its managed-site documentation and architecture status work was ported.
- **Conformance source:** Archie is canonical. `arch-conformance` was retired on 2026-09-17.
- **Assessment source:** Archie is canonical. `architecture-assessment` was retired on 2026-09-17. Assessment must not depend on MyFlow.
- **Drift Detection:** keep the implemented playbook parked at Verify until the developer reviews its final pressure output. Do not infer acceptance from automated checks alone.

## Broader trials

After the next private release candidate:

- trial repositories with and without pre-existing APM state;
- exercise TypeScript repositories of different sizes and architectures;
- test Architecture Docs against real maintained documentation sets;
- test conformance report handoff into Architecture Docs without importing checker internals;
- record false positives, unsupported environments, operator friction, and recovery outcomes;
- promote a capability from trial status only after its claims match observed behavior.

## Coding-agent adapters

Keep the core product agent-neutral. Pi is the proven adapter, not the product boundary.

Add other coding-agent adapters only when there is a real consumer and a bounded compatibility test. Each adapter must:

- use canonical Archie skills and runtime contracts;
- keep installation project-local;
- preserve explicit invocation and authority boundaries;
- avoid silently changing ordinary agent behavior;
- translate only discovery/invocation mechanics, not fork capability logic;
- carry its own end-to-end trial evidence.

## Later candidates

- Review whether merge-impact architecture checking deserves a dedicated Archie playbook after the Drift Detection review. Treat prior exploration as input, not a product contract.
- Revisit signed records or controller trust only when private distribution needs authorization rather than local consistency proof.
- Expand analyzer support beyond the current TypeScript seam through explicit compatibility contracts and characterization tests.

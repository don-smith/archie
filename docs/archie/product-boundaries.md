# Archie product boundaries

Archie is a private, lockstep product for locally reviewed trials. Its one version is the root `package.json` version and every workspace package must match it. The product is not published; it has no public coordinates or license decision.

## Included capabilities

| Capability | Request | Output | Authority stop | Result meaning |
|---|---|---|---|---|
| Assessment | Repository architecture assessment | Fact model and assessment | Developer approves recommendations | Model completeness |
| Architecture Docs | Evidence-backed documentation | Claims, pages, handoff | Maintainer approves claims | Artifact validity |
| LikeC4 authoring | C4 model work | Compiled model and selected views | Returns claims to documentation | Model/view validity |
| Conformance onboarding | Conformance setup | Observed graph and setup proposal | Cannot approve intent | Observed setup evidence |
| Architecture Contracts | Normative contract change | Contract or exception | Maintainer decision first | Deterministic conformance result |
| Structural inspection | Broad structural inspection | Layered advisory findings | Developer triage first | Findings, not an architecture pass |

Each capability is independently selectable. Routing never converts advisory results or target-owned checks into one universal architecture result. Material capabilities retain the proposal-before-apply stop.

Architecture Docs is a first-class private workspace at `packages/architecture-docs/`. It owns evidence-backed pages, claims, LikeC4 compilation, preview and handoff generation, approval, and publication checks. `likec4-authoring` remains a narrower skill backed by the same module. HTML Design owns the final `site/` presentation, while Architecture Docs validates that presentation against the accepted handoff.

## Excluded first-release membership

MyFlow lifecycle behavior, general development skills, Architecture Review source, named-agent dependencies, `codebase-locator`, and `codebase-analyzer` are not shipped or required. Structural inspection uses a portable task contract and may run serially. Repository-local checks remain target-owned commands with their original exits and evidence meanings.

The source-import manifest records exact sibling revisions for current imports and completed migrations. Architecture Docs was migrated from the former `c4archviewer` proof at `f2b7c5f1353c5e76fe8739a657632edafc66580f`; its generated example site was deliberately excluded. Assessment and Conformance now have Archie-owned canonical workspaces backed by exact per-path migration inventories. Their former sibling repositories remain writable rollback references until the developer reviews the finished release candidate. Signing, trusted distribution, key material, public release trust, and publication are deferred.

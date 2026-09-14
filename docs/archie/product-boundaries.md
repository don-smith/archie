# Archie product boundaries

Archie is a private, lockstep product for locally reviewed trials. Its one version is the root `package.json` version and every workspace package must match it. The product is not published; it has no public coordinates or license decision.

## Included capabilities

| Capability | Request | Output | Authority stop | Result meaning |
|---|---|---|---|---|
| Assessment | Repository architecture assessment | Fact model and assessment | Developer approves recommendations | Model completeness |
| Architecture Docs | Evidence-backed documentation | Claims, pages, handoff | Maintainer approves claims | Artifact validity |
| LikeC4 authoring | C4 model work | Compiled model and selected views | Returns claims to documentation | LikeC4 syntax and reference validity |
| Conformance onboarding | Conformance setup | Observed import graph and setup proposal | Cannot approve intent | Observed setup evidence |
| Architecture Contracts | Normative contract change | Contract or exception | Maintainer decision first | Deterministic conformance result |
| Structural inspection | Broad structural inspection | Layered advisory findings | Developer triage first | Findings, not an architecture pass |

Each capability is independently selectable. Routing never converts advisory results or target-owned checks into one universal architecture result. Material capabilities retain the proposal-before-apply stop.

## Excluded first-release membership

MyFlow lifecycle behavior, general development skills, Architecture Review source, named-agent dependencies, `codebase-locator`, and `codebase-analyzer` are not shipped or required. Structural inspection uses a portable task contract and may run serially. Repository-local checks remain target-owned commands with their original exits and evidence meanings.

The source-import manifest records the exact sibling revisions reviewed before import. Imported Assessment instructions are adapted to remove a MyFlow runtime dependency. Signing, trusted distribution, key material, public release trust, and publication are deferred.

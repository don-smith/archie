# 01-product — requirements

**Role:** owns Archie's product identity, capability membership, routing rules, and authority stops.

## Context

Builds on [root requirements](../requirements.md). This node owns the product-facing contract; the runtime and context projection (`02-system/`), delivery (`03-delivery/`), and documentation (`04-docs/`) boundaries live in the sibling nodes.

## Assumptions

- **ARCHIE.PROD-A01 The seven capabilities are the shipped membership.** `assessment`, `architecture-docs`, `likec4-authoring`, `conformance-onboarding`, `architecture-contracts`, `architecture-review`, and `html-design` are the registered product capabilities with stable IDs.

## Requirements

- **ARCHIE.PROD-R01 Capability membership is the stable set of seven.** Stable capability IDs describe responsibilities, not local paths or replacement implementations; an adapter resolves an available owner by ID. `refines: ARCHIE-R02`
- **ARCHIE.PROD-R02 Routing preserves result meaning and authority.** The selected capability's result meaning, authority stops, and approval rules survive routing; routing never produces a universal architecture verdict, and a review finding is not an architecture pass. `refines: ARCHIE-R02`
- **ARCHIE.PROD-R03 Material changes stop for the developer.** Durable or material changes follow the proposal-before-apply rule: intent, evidence, affected files, expected effect, and verification are presented, and the developer decides. `refines: ARCHIE-R03`
- **ARCHIE.PROD-R04 Product identity is lockstep.** One version across workspaces and generated projections; every workspace package matches the root version, and the product version is not the release-record schema version. `refines: ARCHIE-R01`
- **ARCHIE.PROD-R05 Distribution stays private.** The product is not published to npm, has no public package coordinates, and is installed from a clone of this repository; packages stay private with no publish configuration. `refines: ARCHIE-R01`

# 04-docs — requirements

**Role:** owns source precedence in the repository: what is canonical, what derives from the VRS, and how guides stay honest to their owning nodes.

## Context

Builds on [root requirements](../requirements.md) and the VRS decision [0001](../.decisions/0001-root-vrs-at-context-product-scope.md). This node owns the documentation boundary: the two deployed reference sources remain canonical at their existing paths, and every other public document derives from or accompanies the tree.

## Requirements

- **ARCHIE.DOCS-R01 The VRS tree is the sole current intent authority.** Public documentation describes and derives from `context/` and never silently conflicts with it; divergence is recorded as a delta, not as a second authority. `refines: ARCHIE-R05`
- **ARCHIE.DOCS-R02 Deployed reference sources stay canonical at their paths.** `docs/archie/managed-site-guide.md` and `docs/archie/deep-module-vocabulary.md` remain the source for their explanatory wording and workflows and byte-project into the shipped skills; the VRS owns their product rules and terms. `refines: ARCHIE-R05`
- **ARCHIE.DOCS-R03 Guides derive from owning nodes.** Operational how-tos derive from the delivery and system nodes; step-by-step runbooks may remain as companion files under the owning node rather than separate authorities. `refines: ARCHIE-R05`


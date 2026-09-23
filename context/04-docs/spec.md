# 04-docs — spec

## Status: Draft

Current documentation behavior. Unmarked content describes present supported behavior.

## Canonical and derived surfaces

- `context/` is the only always-current settled-intent source for maintainers (decision [0001](../.decisions/0001-root-vrs-at-context-product-scope.md)).
- `docs/archie/managed-site-guide.md` is the canonical per-capability guide: each capability's problem, result, and starting point. It byte-projects to `skills/archie/references/managed-site-guide.md`.
- `docs/archie/deep-module-vocabulary.md` is the canonical deep-module term source for Assessment and Architecture Review. It byte-projects to both skills' `references/deep-module-vocabulary.md`.
- `README.md` is a derived entry point: install, use, uninstall, and status, pointing at the managed-site guide and the product boundaries.
- `AGENTS.md` is the repository working contract for agents, including the verification gates and the generated-file policy.
- Operational how-tos (release bundle building, evidence reading, recovery, repository trials) derive from `03-delivery/` and `02-system/`; where a step-by-step runbook is kept, it is a companion under the owning node, not an intent authority.

## Projection behavior

The APM context projection contains exactly the eight skill trees, the two reference documents above, and the runtime dispatch script, verified byte-for-byte by `node scripts/sync-context-skills.mjs --check` and `test/context/context.test.mjs`. The VRS tree never appears in a projection or packed package.

## Validation and review

The structure of this tree is validated by `scripts/check-intent-tree.mjs`; semantic truth is reviewed by maintainers and agents. A diverging claim that cannot be settled truthfully becomes a specific delta with an owner and closure check instead of an alternate authority.


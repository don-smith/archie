# Archie

Archie is an architecture-focused agent product: architecture assessment, architecture review, architecture documentation with LikeC4 and HTML Design, deterministic conformance, and drift detection, delivered as one private package. This repository is the monorepo for all of it.

## Start here

- **Backlog:** [docs/archie/backlog.md](docs/archie/backlog.md) lists outstanding and completed work. Read it before choosing work, and update it when work lands or new work is found.
- **Product boundaries and roadmap:** [docs/archie/product-boundaries.md](docs/archie/product-boundaries.md), [docs/archie/roadmap.md](docs/archie/roadmap.md), [docs/archie/foundation.md](docs/archie/foundation.md).
- **Routing:** `skills/archie/SKILL.md` and `skills/archie/references/capability-catalog.md` define the seven capabilities and how Archie selects them.

## Layout

| Path | Owns |
|---|---|
| `skills/archie/` | The root Archie skill, operating contract, capability catalog, Drift Detection playbook |
| `packages/assessment/` | Architecture Assessment skill, schemas, validators |
| `packages/architecture-review/` | Architecture Review skill |
| `packages/architecture-docs/` | Architecture Docs and LikeC4 authoring skills and the `architecture-docs` command |
| `packages/html-design/` | HTML Design skill; `src/check-artifact.mjs` is bundled into the skill at build time |
| `packages/conformance/` | Conformance engine, `architecture-conformance` CLI, onboarding and contracts skills |
| `packages/archie-runtime/` | Runtime: analyzer, repository checks, release record v3, install and verification |
| `packages/archie-cli/` | `archie` and `archie-release` commands |
| `packages/capabilities/` | Capability contracts |
| `packages/archie-context/` | The APM skill context (generated projection plus `apm.yml` and `apm.lock.yaml`) |
| `docs/archie/` | Product documentation; `managed-site-guide.md` and `deep-module-vocabulary.md` are canonical sources projected into skills |

## Generated files: regenerate, never hand-edit

- `packages/*/dist`, `packages/archie-runtime/dist/architecture-docs`, product-version files, and the bundled html-design checker: `npm run build`
- `packages/archie-context/.apm/skills/*` and projected reference copies: `node scripts/sync-context-skills.mjs`
- `packages/archie-context/apm.lock.yaml`: `apm install` in `packages/archie-context`, then delete the `.agents/` and `apm_modules/` it creates
- `evaluation/private-trials/latest.json`: `npm run private-trial:evaluate` on a clean, committed tree

## Verify

```bash
npm run typecheck
npm test                        # builds first
npm run pack:check
npm run test:architecture-docs
npm run test:e2e                # ARCHIE_E2E_PUBLISHED_CONTEXT=1 also installs the published context from GitHub
node scripts/sync-context-skills.mjs --check
```

The private-trial evaluator refuses a dirty tree, so commit before running it or the end-to-end suite that includes it.

## Distribution

Nothing is published to npm; every `@archie/*` package is private. A release bundle is a local directory holding the Runtime and Conformance tarballs plus locks; `archie bootstrap --release <dir>` installs them into a target's `.archie/runtime`. This monorepo's remote is the public GitHub repository `git@github.com:don-smith/archie.git`. The existing release tags `v0.1.0-private.0` and `v0.1.0-private.1` point at earlier context-only commits holding just the APM skill context, which targets fetch with native APM. APM can also install the context straight from this repository's `packages/archie-context` subfolder; how Archie should install into repositories going forward is open (backlog N0). See [docs/archie/private-release-bundle.md](docs/archie/private-release-bundle.md).

## Working rules

- `.myflow/` holds local MyFlow workstream artifacts. It stays on disk and gitignored; never commit it.
- Archie must not require tools a consuming repository cannot install automatically, and must not read sibling checkouts from disk.
- Manual review is not a release gate. It is recorded as "not-performed: verified through use until an evaluation system exists"; Archie is verified by installing it into real repositories and using it.
- Pushing to `main` is normal; creating or moving release tags changes what targets install, so do that only with the developer's approval.

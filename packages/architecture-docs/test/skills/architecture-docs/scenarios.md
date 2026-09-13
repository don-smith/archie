# architecture-docs pressure scenarios

The RED record was captured before `skills/architecture-docs/SKILL.md` existed.

## RED baseline

- **Empty-root pressure:** The unskilled response chose a convenient root without asking, and put generated files beside authored sources.
- **Populated-root pressure:** The unskilled response replaced an existing model and treated an old HTML directory as builder-owned.
- **Approval pressure:** The unskilled response published inferred runtime and pattern claims after a successful compiler run, without a page-map or topic review.

Observed failure: root safety, ten-class inventory, provenance, optional-specialist boundaries, and publication approval were implicit or missing.

- **Copied-skill pressure:** The prior skill derived `PACKAGE_DIR` from its deployment path. In an APM copy under a consumer repository, that path had no package binary. The command actually lived in the project's pinned `.archie/runtime`, so source-checkout discovery was the failure.

## GREEN scenarios

The skill must ask before moving/adopting/replacing content; default safely to `docs/architecture/`; record all ten evidence classes; consume glossary and ADRs; route domain modeling and architecture review only on their triggers; hand off context/container-first LikeC4 authoring; propose a curated page map; render provisional claims; and require explicit claim/page-map approval before publication.

The expanded GREEN behavior requires the agent to run every build, preview, HTML, browser, approval, and publication command from `TARGET_DIR` through `.archie/runtime/node_modules/.bin/architecture-docs`. It must not assume that the target repository has this package's npm scripts, derive a package path from the skill deployment, use a global executable, or download a missing package. A reviewed `skillCommand` config array uses `skill:run`, which preserves argv boundaries without a shell.

The handoff GREEN behavior requires the agent to emit `<root>/handoff/` with its manifest, claims, page map, copied Markdown, view manifest, and LikeC4 bundle, then keep `html-design` responsible for the final `site/` presentation.

## Variation / REFACTOR evidence

- Existing glossary/ADRs are consumed rather than rewritten.
- Absent optional specialists do not become silent substitutes.
- Requested audit context is marked unavailable until installed.
- Existing unowned output blocks publication.
- Maintainer rejection remains visible and blocks publication.

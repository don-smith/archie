---
name: architecture-docs
description: Use when onboarding an unfamiliar repository into evidence-backed architecture documentation, creating a curated LikeC4 model and Markdown pages, handing architecture content to html-design, or preparing a maintainer-reviewed architecture docs publication.
---

# Architecture docs

This is the orchestration skill. It produces authored inputs under one root, an architecture-owned `handoff/` bundle, and a disposable `preview/`. The independently invoked `html-design` skill owns final HTML under `<root>/site/`. It never claims architectural truth or approves on behalf of a maintainer.

**REQUIRED SUB-SKILL:** Use `likec4-authoring` for model authoring. Read its `c4-method.md`, `likec4-reference.md`, and `diagram-review-checklist.md` through that skill.

## Package setup

Set `TARGET_DIR` to the repository being documented, normally the current working directory. Run commands from that directory. The target's pinned Archie runtime provides `architecture-docs`; every default command uses that project-local executable and never downloads a package or derives runtime code from the copied skill location.

```bash
ARCHIE_RUNTIME_DIR="$TARGET_DIR/.archie/runtime"
"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" <command> \
  --config "$TARGET_DIR/architecture-docs.config.json"
```

If the reviewed target config declares `skillCommand`, invoke the same operation through `"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" skill:run <command> --config ...`. The runner appends the command and its normal options as argv with no shell. It reports the selected override and fails if it cannot execute it.

Read [package-commands.md](package-commands.md) for Archie runtime resolution, preview, approval, publication, HTML, browser, and handoff behavior. Do not assume that `npm run build` in the target repository invokes this package.

## Handoff to html-design

When `html-design` will compose the presentation—which is the normal path—`architecture-docs` is the evidence and content producer, not the final visual owner.

The builder emits a stable, generated bundle at `<root>/handoff/`. Each page record includes ordered `viewIds` and an `initialViewId`; the final consumer should declare those IDs on the page, mount the initial view, and provide a page-local view selector.

```text
handoff/
├── manifest.json                 # version, ownership, paths, semantic/input digests
├── composition-guide.md          # generated architecture-to-html-design adapter
├── claims.json                   # normalized evidence and review state
├── page-map.json                 # ordered home and area pages
├── pages/<page-id>.md            # copied Markdown prose
├── delta.json / delta.md         # baseline or update changes
└── assets/
    ├── views.json                # compiled view metadata and semantic digests
    └── likec4-views.js           # compiled LikeC4 web component bundle
```

The handoff is self-contained for presentation work. Its paths are bundle-relative, its manifest contains no local absolute paths or secrets, and its digests identify the exact authored and semantic compiled inputs consumed. Each page record carries ordered `viewIds` and an `initialViewId`, so the consumer can mount every declared view without guessing. A page with `viewIds: []` is prose-only: omit its interactive-view section, selector, mount, and view metadata rather than falling back to a global model view. The generated LikeC4 JavaScript is a compiler artifact and is not assumed byte-for-byte deterministic; use `views.json` and semantic digests for identity. `architecture-docs` owns the model, evidence ledger, authored Markdown, page map, handoff, and `preview/`. `html-design` owns the final `site/` presentation and may restyle or restructure it without editing those inputs. Neither skill silently overwrites the other skill's owned files.

Use this sequence:

1. Build `architecture-docs` and inspect the handoff manifest.
2. Invoke `html-design` with the handoff as its only architecture-content source; use the `rail-document` profile for long-form architecture docs.
3. Let `html-design` publish the final `site/` output and run its artifact, browser, theme, narrow-layout, and print checks.
4. Rebuild the handoff when claims, page order, Markdown, or LikeC4 views change; treat changed digests as a new composition input.
5. Run architecture preview checks before maintainer approval, then run the final-site contract and browser checks against every composed route. Run publication checks only after the handoff and final site both pass.

The builder's `preview/` is disposable and is not the long-term presentation source. An existing `site/` is outside the architecture builder's destination set and remains untouched. After composition, `site/assets/architecture-handoff.json` records the handoff digest so publication checks can detect a stale presentation.

## Onboarding sequence

1. Ask where docs belong. Default to `docs/architecture/`. Inventory existing model, pages, ledger, glossary, ADRs, and any existing `site/` or `handoff/` before creating or moving files. Ask explicitly before adopting, moving, replacing, or deleting authored content. An unmarked generated directory is never force-overwritten.
2. Emit and validate the bundle handoff before invoking `html-design`; do not pass raw repository paths when the handoff contains the required claims, page map, Markdown, views, and LikeC4 assets.
3. Examine applicable evidence: existing documentation, manifests, runtime entry points, deployment and persistence definitions, integration clients, representative tests, source relationships, glossary/domain language, and ADR/decision sources. Record every class as `examined` or `not-applicable` with a reason.
4. Write candidate claims to `evidence/claims.json`. Give every material claim one basis: `confirmed-evidence`, `maintainer-provided-intent`, `inference-awaiting-confirmation`, or `unresolved`. Record evidence entries, topics, page targets, optional LikeC4 element targets, and review state.
5. Consume existing glossary and ADRs. Invoke `domain-modeling` only when an important term or boundary needs resolution. Invoke `architecture-review` only when the developer asks for audit findings as supporting evidence. Never turn review findings into canonical architecture facts.
6. Hand the evidence inventory and ledger path to `likec4-authoring`. Require context and containers first, then only focused deeper views that answer onboarding questions. Preserve assumptions, unresolved gaps, source links, and claim IDs.
7. Propose one home page and a small ordered set of major-area pages. Markdown owns prose, JSON owns the page map, LikeC4 owns model structure and named views, and the ledger owns provenance and approval. Do not derive pages from raw elements or directories.
8. Build a provisional preview and handoff with the package command. Show pending and rejected claims visibly. Ask the maintainer to review the boundary, runtime units, external systems, flows, vocabulary, patterns, and page map. Record reviewer, timestamp, and current digests only after explicit approval.
9. Run build, preview checks, HTML checks, browser checks, final-site contract checks, final-site browser checks, then publication checks. Publication fails for stale approvals, missing required topics, rejected references, missing area evidence, invalid model references, or unowned output. Never silently drop a provisional claim.

## Package command sequence

From the target repository:

```bash
"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" build \
  --config "$TARGET_DIR/architecture-docs.config.json"

# Update only the architecture input bundle; never replace site/.
"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" build \
  --config "$TARGET_DIR/architecture-docs.config.json" --handoff-only

"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" check \
  --config "$TARGET_DIR/architecture-docs.config.json" \
  --mode preview

"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" check:html \
  --config "$TARGET_DIR/architecture-docs.config.json"

"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" check:browser \
  --config "$TARGET_DIR/architecture-docs.config.json"

# Validate the independently composed site after html-design publishes it.
"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" check:site \
  --config "$TARGET_DIR/architecture-docs.config.json"
"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" check:site:browser \
  --config "$TARGET_DIR/architecture-docs.config.json"
```

After the maintainer has reviewed the preview, record only the claims they explicitly approve:

```bash
"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" approve \
  --config "$TARGET_DIR/architecture-docs.config.json" \
  --reviewer maintainer@example.com \
  --claims purpose,actors,boundary

"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" check \
  --config "$TARGET_DIR/architecture-docs.config.json" \
  --mode publication
```

## Safety rules

- Only `<root>/handoff/` and `<root>/preview/` are generated and replaceable. The final `<root>/site/` belongs to html-design and remains untouched.
- Compilation proves LikeC4 syntax, not architectural truth.
- Missing optional skills are reported, not substituted.
- Approval identity is supplied by the maintainer, not inferred by the skill.
- A failed build preserves authored inputs and previous generated `preview/` and `handoff/` outputs.
- A rejected claim remains visible and blocks publication when referenced.

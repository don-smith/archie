# Architecture docs configuration

The root `architecture-docs.config.json` is strict JSON, version `1`, and is resolved relative to its own directory. `root` is the authored architecture-docs root; model, page, and ledger paths are relative to that root. The builder-generated destination is always `<root>/preview`. The final `<root>/site` is owned independently by `html-design`.

## Inputs

- `repository.name` and optional `shortLabel` identify the repository.
- `model.workspace` points to a LikeC4 workspace and `initialView` names a compiled view.
- `document.title` supplies the document title.
- `pages.home` is required. `pages.areas` is an ordered list of curated major areas. Each page has `id`, `title`, `summary`, `markdown`, `viewIds`, and `claimIds`; `initialViewId` optionally names the first view to mount and must be one of `viewIds` (otherwise the first `viewIds` entry is used). An empty `viewIds` list is valid for a prose-only page such as a glossary or check index: the generated preview and independently composed final site must omit the interactive-model section, selector, and LikeC4 mount. Area pages also have a lowercase hyphenated `slug`.
- `evidence.ledger` points to the structured claims ledger.
- `palette` supplies document light/dark and diagram semantic colors.
- `sourceLinks.browserRoot` is an explicit HTTP(S) repository browser root. LikeC4 `link ./path` values are rewritten in a temporary workspace and canonical sources are not edited.
- `supplementalInputs` is an optional ordered array of `{ id, source, destination }` declarations. IDs and handoff destinations are unique. Sources resolve below the config directory, must be regular authored files, and cannot read from `preview/`, `handoff/`, or `site/`. Destinations are normalized paths below the staged handoff and cannot collide with package-managed files. The builder treats each file as opaque bytes.
- `skillCommand` is an optional reviewed argv array. It has a non-empty executable and literal arguments. `architecture-docs skill:run` invokes it from the target root without a shell; it does not parse or approve the command's meaning.

Paths must be relative, cannot traverse, and model/output paths cannot overlap. Unknown fields are errors with stable JSON paths.

## Archie-managed targets

A target is Archie-managed when `<config-directory>/.archie/version` exists. This marker is outside the closed configuration schema and is the only activation signal. Managed targets should include exactly one `pages.areas` record with `id`, `title`, and `slug` set to `archie`, `Archie`, and `archie`.

The Architecture Docs and final-site check reports expose `warnings` and `warningCount` for incomplete Archie material. These warnings are non-blocking: `ok`, `assertPublication`, thrown publication errors, and process exit codes depend only on `diagnostics`. The deployed Archie guide at `.agents/skills/archie/references/managed-site-guide.md` supplies the current guide version and required markers, so its version and marker inventory are not duplicated in this configuration contract.

## Evidence and publication

`evidence/claims.json` records all ten discovery classes as `examined` or `not-applicable` with a reason. Each claim has a stable ID, statement, basis, topic tags, evidence entries, page targets, optional LikeC4 element targets, and review state. Bases are `confirmed-evidence`, `maintainer-provided-intent`, `inference-awaiting-confirmation`, or `unresolved`.

A preview may contain pending claims. Generated pages label them provisional and include their evidence. Publication additionally requires a current page-map digest, approved claims for the home topics (purpose, actors, boundary, runtime units, flows, domain language, patterns, and navigation), and responsibilities plus interface/flow evidence for each area. Rejected claims remain visible and block publication when referenced.

Record approval only after an explicit maintainer decision:

```bash
node scripts/approve-architecture-docs.mjs \
  --config architecture-docs.config.json \
  --reviewer maintainer@example.com \
  --claims purpose,actors,boundary
```

The helper writes a claim digest and ordered page-map digest. Any change to reviewed claim content or page order invalidates the corresponding approval.

## Generated ownership and handoff

The builder emits two generated directories:

- `<root>/handoff/` is the stable architecture-to-`html-design` bundle. Its `manifest.json` records ownership, bundle-relative file paths, counts, semantic digests, and the pinned compiler version. It contains `composition-guide.md`, normalized claims, the ordered page map, copied Markdown, `delta.json`, `delta.md`, compiled view metadata, the LikeC4 web-component bundle, and any declared supplemental files. Each supplemental manifest record has its source and destination declarations plus the SHA-256 of the copied bytes.
- `<root>/preview/` is the disposable builder-owned regression preview and is replaced atomically.
- `<root>/site/` is never read or replaced by the architecture builder. `html-design` owns the final presentation there and writes `site/assets/architecture-handoff.json` with the current handoff digest.

An existing generated directory without its ownership marker fails with `OUTPUT_NOT_OWNED`; there is no force-overwrite option. Authored model, page, evidence, and configuration files are never removed by the builder.

## Commands

```bash
npm run build
npm run check:html
npm run check                 # publication mode
npm run test:browser
npm run check:site
npm run check:site:browser
npm run verify
npm run serve                 # disposable preview
npm run serve:site            # independently composed final site
# Faster architecture update when the final site already exists:
"$PWD/.archie/runtime/node_modules/.bin/architecture-docs" build --config architecture-docs.config.json --handoff-only
```

Install Chromium separately when needed: `npx playwright install chromium`. The `preview/` child is the architecture preview document root. Serve the independently composed `site/` separately.

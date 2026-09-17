# Architecture Docs

Architecture Docs is Archie's evidence-backed documentation module. It combines curated Markdown, a reviewed claims ledger, and a LikeC4 workspace into a static interactive preview and a self-contained handoff for HTML Design.

The module owns:

- architecture evidence, claims, authored pages, and page order;
- LikeC4 compilation and interactive view metadata;
- the disposable `preview/` and stable `handoff/` outputs;
- maintainer approval and publication checks; and
- validation of an independently composed final site against the accepted handoff.

HTML Design owns the final `site/` presentation. The separately invocable `likec4-authoring` skill owns model-authoring judgment and returns its results to `architecture-docs`.

## Command

Archie's installed runtime exposes the command from the target repository:

```bash
ARCHIE_RUNTIME_DIR="$PWD/.archie/runtime"
"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" build --config architecture-docs.config.json
"$ARCHIE_RUNTIME_DIR/node_modules/.bin/architecture-docs" check --config architecture-docs.config.json --mode preview
```

See [`docs/configuration.md`](docs/configuration.md) for the configuration, evidence, generated-output, and approval contracts.

Targets with `.archie/version` beside their configuration are Archie-managed. After configuration validation succeeds, preview, publication, and final-site checks report Archie documentation completeness in a separate `warnings` collection and `warningCount`; warnings never change `ok`, publication assertions, or command exit status. Duplicate configured page IDs and slugs are blocking configuration errors, including duplicates for the Archie area. The deployed guide at `.agents/skills/archie/references/managed-site-guide.md` defines the required version and topic/capability markers. Warning codes reachable through valid configurations include `ARCHIE_GUIDE_UNREADABLE`, `ARCHIE_AREA_MISSING`, `ARCHIE_AREA_METADATA_INVALID`, `ARCHIE_GUIDE_VERSION_MISSING`, `ARCHIE_GUIDE_VERSION_MISMATCH`, `ARCHIE_MARKER_MISSING`, and `ARCHIE_MARKER_DUPLICATE`. `ARCHIE_AREA_DUPLICATE` is defensive evaluator-only behavior for isolated direct inputs; it is not a valid checker or CLI outcome and does not permit publication of malformed duplicate routes.

## Development

From the Archie repository root:

```bash
npm ci
npm test -- packages/architecture-docs/test
npm run test:architecture-docs
```

This workspace was migrated from the former `c4archviewer` proof at commit `f2b7c5f1353c5e76fe8739a657632edafc66580f`. The Archie managed-site documentation warnings and the deterministic architecture status consumer were later ported from `c4archviewer` at `81a008e629de8ff28b5db01a436c4425827feff5`. Generated example-site output was deliberately not migrated.

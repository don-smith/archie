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

## Development

From the Archie repository root:

```bash
npm ci
npm test -- packages/architecture-docs/test
npm run test:architecture-docs
```

This workspace was migrated from the former `c4archviewer` proof at commit `f2b7c5f1353c5e76fe8739a657632edafc66580f`. Generated example-site output was deliberately not migrated.

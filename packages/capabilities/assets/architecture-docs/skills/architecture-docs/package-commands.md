# Package commands

`architecture-docs` is installed as a local Pi package, but its builder runs against the repository where the documentation is being authored.

## Run from the target repository

Set `TARGET_DIR` to the repository being documented and run every command from that directory. The target must pin `architecture-docs`; do not use a copied skill location, a sibling package checkout, a global executable, or a network install to find it.

```bash
npx --no-install architecture-docs <command> \
  --config "$TARGET_DIR/architecture-docs.config.json"
```

If the target config has a reviewed `skillCommand` argv prefix, replace the command form with `npx --no-install architecture-docs skill:run <command> --config ...`. That launcher appends the selected subcommand and normal options as argv, runs at `TARGET_DIR`, and does not use a shell.

## Commands

```bash
# Build the disposable architecture preview and html-design handoff bundle at <root>/handoff/.
npx --no-install architecture-docs build \
  --config "$TARGET_DIR/architecture-docs.config.json"

# Update only the handoff after authored changes; site/ remains untouched.
npx --no-install architecture-docs build \
  --config "$TARGET_DIR/architecture-docs.config.json" --handoff-only

# Check authored inputs and generated output without requiring approval.
npx --no-install architecture-docs check \
  --config "$TARGET_DIR/architecture-docs.config.json" \
  --mode preview

# Check the generated preview HTML and browser behavior. These checks do not validate site/.
npx --no-install architecture-docs check:html \
  --config "$TARGET_DIR/architecture-docs.config.json"
npx --no-install architecture-docs check:browser \
  --config "$TARGET_DIR/architecture-docs.config.json"

# Record explicit maintainer approval after the preview has been reviewed.
npx --no-install architecture-docs approve \
  --config "$TARGET_DIR/architecture-docs.config.json" \
  --reviewer maintainer@example.com \
  --claims purpose,actors,boundary

# Check the independently composed final site against the page map.
npx --no-install architecture-docs check:site \
  --config "$TARGET_DIR/architecture-docs.config.json"
npx --no-install architecture-docs check:site:browser \
  --config "$TARGET_DIR/architecture-docs.config.json"

# Check publication readiness.
npx --no-install architecture-docs check \
  --config "$TARGET_DIR/architecture-docs.config.json" \
  --mode publication
```

A composed final site must also contain `site/assets/architecture-handoff.json` whose `architectureHandoffDigest` matches the current handoff manifest. `check:site` validates every final route's page ID and receipt; pages with declared views must also provide their ordered views, initial view, selector, and accessible diagram frame, while pages with `viewIds: []` must omit that interactive surface. `check:site:browser` exercises each applicable initial render, selector, zoom, theme, narrow layout, and print fallback. Run the independently installed html-design artifact checker and visual review against `site/` as well.

For an Archie-managed target, identified by `.archie/version` beside the configuration, the reports also include warning-only documentation findings. The deployed guide under `.agents/skills/archie/references/managed-site-guide.md` defines the required guide and content markers. Commands print each warning as `warning <code>:`; warnings do not affect `ok`, publication assertions, or exit status. A warning-only check therefore exits zero, while any existing diagnostic still exits nonzero.

Run `npx --no-install architecture-docs --help` from `TARGET_DIR` for the command list.

## Install from a local checkout

Install dependencies once in the package checkout:

```bash
cd /path/to/c4archviewer
npm ci
```

Register the checkout for personal use without copying it:

```bash
pi install /path/to/c4archviewer
```

Register it for one project and commit the resulting `.pi/settings.json` when the team should share it:

```bash
cd /path/to/target-repository
pi install /path/to/c4archviewer -l
```

Use `pi -e /path/to/c4archviewer` for one-session testing. Restart Pi or run `/reload` after changing the package or its skills.

A local package path is a source reference, not a generated skill copy. Changes in the checkout are therefore available to later Pi sessions.

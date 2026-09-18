# Archie backlog

This is the tracked backlog for Archie. Update it when work lands or new work is found: move finished items to Done with their commits, and add new findings under Outstanding.

Last updated 2026-09-18. `main` is pushed to `git@github.com:don-smith/archie.git`; product version `0.1.0-private.1`; the eight-skill APM context is also tagged there as `v0.1.0-private.1` (context-only commit `858fd77`).

## Outstanding

### Next: use Archie on real repositories

| ID | Item | Kind |
|---|---|---|
| N0 | **Decided on 2026-09-18: a scripted install that wraps `archie bootstrap`.** Installation is `git clone --depth 1 git@github.com:don-smith/archie.git /tmp/archie-install && /tmp/archie-install/install.sh`, run from inside the target repository. `curl \| bash` is not an option: `raw.githubusercontent.com` refuses a private repository without a token, whereas the clone reuses the SSH access the developer already has, and it lets them read the script before running it. The script calls `archie bootstrap` rather than copying files, because `dispatch-runtime.mjs` hard-fails without `.archie/release/release-record-v3.json`, and because the record carries `archie verify`, the install journal and compensation, tarball integrity, and per-file skill content hashes. APM stays: the script hides it from the developer, so it is an implementation detail rather than a user-facing dependency, removable later if it gets in the way. Groundwork already verified: the monorepo is `main` on GitHub with the `v0.1.0-private.0` and `v0.1.0-private.1` tags still resolving (the `v0.1.0-private.1` lock is unchanged), and `apm install don-smith/archie/packages/archie-context#<ref>` installs all eight skills byte-identically from the subfolder, locked with `virtual_path: packages/archie-context`, `is_virtual: true`, `package_type: apm_package`. What a consuming repository commits: the pin (`.archie/release/`, `.archie/version`, `.archie/runtime/package-lock.json`), the eight skill trees, and the two npm tarballs (N0b). What it never commits: `.archie/runtime/node_modules/`, which is machine-local and rehydrated. Implementation is N0a, N0b, N0c. | decided |
| N0a | **Build the scripted install.** (a) Extract bundle construction out of the `run-private-trial-evaluation.mjs` test harness into a reusable `archie-release build --output <dir>`, sibling to `finalize` in `packages/archie-cli/src/release-cli.ts`, with the fixture APM section replaced by real evidence generated from `packages/archie-context`. (b) `install.sh` in the repository root, heavily commented so a developer can audit it: check `node >=24 <25` and fail clearly; detect an existing install and offer upgrade; detect a release record v1 or v2 pin and name exactly what to remove (this subsumes N2); `archie-release build`; `archie bootstrap --release`; Playwright browsers (P7); add `.archie/runtime/node_modules/` to the target's `.gitignore`; finish by telling the developer to invoke the `archie` skill. (c) `uninstall.sh`: read the install journal rather than re-deriving paths; remove only the eight recorded skill trees, never `rm -rf` a whole skills directory that may hold skills Archie does not own; **keep `.archie/assessments/`** and say so in the output. Both scripts re-runnable. No monorepo build is needed on the target: `packages/*/dist` is committed (235 files, ~1.3MB) and is pure JavaScript and type declarations. | implementation |
| N0b | **Commit the two npm tarballs into the consuming repository so worktrees can hydrate.** Bootstrap copies them to `.archie/runtime/npm/*.tgz` and the lock resolves them as `file:npm/*.tgz`, but `*.tgz` is gitignored, so a fresh branch or worktree holds a lock pointing at absent files and `npm ci` fails. They are 177KB combined (runtime 126.8KB, conformance 50.6KB), pure JavaScript and type declarations with no native code, so committing them is cheap and makes a worktree self-hydrating without a clone of Archie. Needs a `.gitignore` exception in the target. | implementation |
| N0c | **Hydration self-check when the `archie` skill is invoked.** Pin present but `.archie/runtime/node_modules` missing means installed-but-unhydrated, not uninstalled, so hydrate rather than reinstall. Branch on cost: warm caches (Playwright browsers live in the machine-global `~/.cache/ms-playwright`, npm cache is global too) hydrate inline in seconds and just say so; a cold first install prints the exact one-line command for the developer to run in their own terminal, because a multi-minute download inside an agent turn looks hung and can time out. | implementation |
| N1 | Install Archie into a handful of repositories and use it: `archie bootstrap` from a finalized local bundle, then work through Assessment, Architecture Review, Architecture Docs with HTML Design, Conformance, and Drift Detection. Record friction, false positives, and wrong routes as new backlog items. `docs/archie/substantial-repository-trial-checklist.md` is a usage guide, not a gate. Assessment's no-MyFlow lifecycle and HTML Design in an installed Archie are verified this way. | manual (developer) |
| N2 | Remove and reinstall any repository still pinned to release record v1 or v2 (for example the Jaspyr trial): delete `.archie/release`, `.archie/runtime`, and `.archie/version`, then bootstrap. | manual (developer) |

### Product follow-ups

| ID | Item | Where |
|---|---|---|
| P1 | Architecture Docs consumption of the public Conformance report contracts (a planned later workstream). | `docs/archie/roadmap.md`, `docs/archie/producer-contract-handoff.md` |
| P2 | Drift Detection playbook is shipped but parked at Verify: the developer has not reviewed its final pressure output. | `.myflow/workstreams/drift-detection-playbook/` |
| P3 | Archie routing evaluation fixtures use retired capability names (`architecture-planning`, `repository-orientation`, `architecture-assets`, `structural-inspection`). Nothing runs them; rewrite for the seven current capabilities or remove. | `evaluation/archie/fixtures/` |
| P4 | HTML Design's generated references came across as built output. Port its generator if HTML Design needs to evolve inside Archie. | `packages/html-design/` |
| P5 | The managed-site guide stayed at `archie-guide:v1` while its capability markers changed. No managed sites exist yet; bump the guide version next time the marker set changes. | `docs/archie/managed-site-guide.md` |
| P6 | `@archie/runtime` pins `@typescript/typescript-darwin-arm64` in its dependencies, so the install is wrong on Linux, x64, and Windows. Resolve the correct TypeScript native package for the host platform instead. Independent of the install mechanism, and a blocker before N1 goes beyond the developer's own machine. | `packages/archie-runtime/package.json` |
| P7 | Playwright browsers never download under `npm ci --ignore-scripts`, so anything that renders is broken on a fresh install. Recommended: keep `--ignore-scripts` and add an explicit `npx playwright install chromium` step, which gets the browser without granting arbitrary postinstall execution to the whole dependency closure. Fallback if that proves awkward: drop `--ignore-scripts`. Decide whether the ~150MB download happens at install time or on first use. Also drop `--offline` now that the script has network access; `@archie/*` resolve from `file:` tarballs and the rest from the public registry. | `packages/archie-runtime/src/release-install/run-npm.ts` |

### Tidy-ups

| ID | Item | Where |
|---|---|---|
| T1 | The npm lock template is still named `release-npm-lock-v2.json` though it serves release record v3. Rename or document. | `packages/archie-runtime/vendor/` |
| T2 | The source manifest and migration inventories keep absolute `/Users/don/projects/...` paths of retired repositories as history. Decide whether to keep them. | `source-import-manifest.json`, `packages/*/migration-inventory.json` |
| T3 | Deployment hardening: one canonical parser for bundle and native-lock evidence (P2 severity). | `docs/archie/roadmap.md` |
| T4 | Watch for flakiness: once, right after `npm install` and `apm install`, two release-record tests failed together, then passed on every rerun (four combined runs). Not reproduced. | `test/release-record/release-record-v3.test.mjs` |

### Your housekeeping

| ID | Item |
|---|---|
| H1 | Delete the GitHub repositories for `arch-conformance` and `c4archviewer`. |
| H2 | Delete `/Users/don/projects/archie-backups/` when comfortable (pre-rewrite bundle, commit map, `.myflow` tarball, retired repository bundles). |

### Later candidates (roadmap, demand-led)

Other coding-agent adapters; a merge-impact checking playbook after the Drift Detection review; analyzer support beyond TypeScript; signed records or controller trust if distribution ever needs authorization.

## Done

| Area | What | Commits |
|---|---|---|
| Integration | Both feature branches merged; c4archviewer changes ported; `.myflow` removed from history; worktrees, branches, and sibling repositories retired with bundles kept | `e9bd9a3`, `3108f00`, `4be0bcf`, history rewrite, `2323fb1` |
| Tidy-up | One Architecture Docs sequence (the old statusless path skipped the build); runtime command wording; retirement recorded in docs; unused migration fixtures removed; managed site plus status test; MyFlow workstream statuses | `55ee0c4` |
| Assessment | No MyFlow: optional brief, `.archie/assessments/`, work-item hand-off, shared deep-module vocabulary, html-design default | `2161b62` |
| HTML Design | `packages/html-design` workspace and skill; dependency-free checker bundle; nothing reads sibling repositories | `aa6fbfb`, `81047a8` |
| Architecture Review | `packages/architecture-review` workspace and skill adapted from MyFlow; owns the `architecture-review` capability | `5eadfb7`, `dc2427a` |
| Capabilities | Seven capabilities; guide, catalog, foundation, boundaries, fixtures | `dc2427a` |
| Release | Release record v3 with eight skills; runtime HTML snapshot, v1/v2 code, `import:owned`, and `IMPORTS.json` removed; legacy pins refused; install-compensation symlink bug fixed | `32769aa` |
| Verification records | Manual review recorded as "not-performed: verified through use"; fresh evidence | `f25e6ee`, `58c19a0` |
| Publication | Version `0.1.0-private.1`; context published and tagged on GitHub; bundle fixture pinned to the native lock; published-context end-to-end test passes; evidence regenerated | `825986e`, `24a9ce8`, `566b81d` |

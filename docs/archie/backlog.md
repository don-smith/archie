# Archie backlog

This is the tracked backlog for Archie. Update it when work lands or new work is found: move finished items to Done with their commits, and add new findings under Outstanding.

Last updated 2026-09-18. `main` is pushed to `git@github.com:don-smith/archie.git`; product version `0.1.0-private.1`; the eight-skill APM context is also tagged there as `v0.1.0-private.1` (context-only commit `858fd77`).

## Outstanding

### Next: use Archie on real repositories

| ID | Item | Kind |
|---|---|---|
| N0 | **Choose how Archie installs into a repository, now that GitHub `don-smith/archie` is the monorepo.** Done on 2026-09-18: the monorepo was force-pushed as `main` (its first remote; the two context-only commits were replaced) and the `v0.1.0-private.0` and `v0.1.0-private.1` tags were kept, so existing pins still resolve (verified: the `v0.1.0-private.1` lock is unchanged). Also verified: `apm install don-smith/archie/packages/archie-context#<ref>` installs all eight skills straight from the monorepo subfolder, byte-identical to `packages/archie-context/.apm/skills`, recorded in the lock with `virtual_path: packages/archie-context`, `is_virtual: true`, `package_type: apm_package`. Remaining: decide the install mechanism (APM subfolder install, an install script, or a skills CLI; Archie is repository-scoped and invoked as the first skill). If APM stays: tag monorepo commits for releases instead of publishing a separate context tree; update release record v3's APM evidence and projection (they expect a root package named `archie-context` with `git:` and `skills:` entries, and would need the virtual path), the bundle fixture, the published-context test, and `docs/archie/private-release-bundle.md`. Note that the existing tags point at context-only commits, not monorepo history. | decision (developer), then implementation |
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

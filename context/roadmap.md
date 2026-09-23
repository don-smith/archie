# Archie roadmap

Current direction and ordered work for Archie maintainers. Past milestones are history, not future requirements; unshipped proposals stay in [open-questions.md](./open-questions.md).

## Current state

- The public repository is the delivery path; the product is installed from a clone and verified by installing it into real repositories and using it, rather than by a formal review gate (see [03-delivery](./03-delivery/requirements.md)).
- Historical tags `v0.1.0-private.0` and `v0.1.0-private.1` install an earlier skills-only context; they are history and are not moved.
- The current product identity is `0.3.0`, as recorded in the root `package.json`, `README.md`, and generated projections.

## In flight

- **Public release `0.3.0`.** Align the lockstep product identity, make this intent layer the maintainer source of truth, correct user-visible private-trial wording without changing release-record schema v3, and record candidate evidence before creating the approved immutable `v0.3.0` tag. Schema v3 and the legacy authorization wire value remain unchanged.
- **Drift Detection playbook.** Shipped with the product; its final pressure output awaits developer review before it is treated as verified.

## Milestones

History, not current requirements; the commits are the durable record.

- **Foundation (2026-09-17).** One private monorepo and lockstep product version; project-local npm runtime plus the APM-deployed skill context; explicit local release selection with no authorization claim; private Git SSH context identity, APM-native locks, frozen installation, replay, recovery, and byte-level deployment verification; Architecture Docs owned and shipped as an Archie workspace; a successful Jaspyr trial using the deployed project skill without changing ordinary agent behavior. The first six skills shipped, then Architecture Review and HTML Design were added through an explicit product-boundary decision (capabilities and memberships `dc2427a`, `5eadfb7`; HTML Design workspace `aa6fbfb`, `81047a8`).
- **Sibling retirement (2026-09-17).** The former sibling repositories for Architecture Docs (`c4archviewer`), Assessment, and Conformance were retired after their work was consolidated; the source-import manifest and per-package migration inventories record the exact revisions and remain historical records. Conformance is fully consolidated in `@archie/conformance` with parity evidence pinned to `arch-conformance@361b4259a405113deaf777a38dea12f229b5b461`.
- **Release record v3 (`32769aa`).** The v3 record with the eight-skill context, exact npm lock, APM evidence, and analyzer compatibility; legacy v1/v2 pins are refused; install compensation and byte-level verification land with the record. Feature branches merged, `.myflow` removed from history, and worktrees and sibling checkouts retired with bundles kept (`e9bd9a3`, `3108f00`, `4be0bcf`, `2323fb1`).
- **Publication `0.1.0-private.1` (`825986e`, `24a9ce8`, `566b81d`).** The context-only tags `v0.1.0-private.0` and `v0.1.0-private.1` published the earlier skills-only context; the bundle fixture pins the native APM lock; the published-context end-to-end test passes; fresh evidence regenerated. Manual review recorded as `not-performed: verified through use until an evaluation system exists` (`f25e6ee`, `58c19a0`).
- **Jaspyr trial (2026-09-19).** Installing into a real pre-v3 repository found four install defects unreachable from the clean-checkout suite (worktree rejection, incomplete pre-v3 refusal, rollback misdetection, missing `apm.lock.yaml` handling). The scripted install and uninstall, the hydration self-check, the APM-target assertion, the committed-tarball rule, the Claude Code skill bridge, and the compensation-safe journal followed (`N0a`–`N0f`, plus the hardening commit). One pre-v3 pin remains in that trial repository; removing it is open developer work below.
- **Conformance re-record (`ebfeb23`, `323c6a7`).** `onboard rerecord` verifies the normative map, contract, and retained baseline against their recorded digests and re-records only digests at the unchanged checkpoint; `--expect-unchanged-verdict` turns the benign case into a CI assertion; replay diagnostics split source drift from on-disk divergence.
- **Assessment and HTML Design (`2161b62`, `aa6fbfb`, `81047a8`).** Assessment ships without a MyFlow lifecycle (optional brief, `.archie/assessments/`, shared deep-module vocabulary); the HTML Design workspace and skill ship with a dependency-free checker bundle.

## Open work

Tracked items with their owning area and current kind. Update this list when work lands or new work is found; finished items move to a milestone with their commits.

| ID | Item | Kind |
|---|---|---|
| N1 | Install Archie into a handful of repositories and use it: bootstrap from a finalized local bundle, then work through Assessment, Architecture Review, Architecture Docs with HTML Design, Conformance, and Drift Detection; record friction, false positives, and wrong routes as new items. The [substantial-repository trial checklist](./03-delivery/guides/substantial-repository-trial-checklist.md) is a usage guide, not a gate. | manual (developer) |
| N2 | Remove the pre-v3 pin in the repository that still holds one (the Jaspyr trial). | manual (developer) |
| P1 | Architecture Docs consumption of the public Conformance report contracts (a planned later workstream). | later workstream |
| P3 | Routing evaluation fixtures use retired capability names; rewrite them for the seven current capabilities or remove them. | `evaluation/archie/fixtures/` |
| P4 | HTML Design's generated references came across as built output; port its generator if the skill needs to evolve inside Archie. | `packages/html-design/` |
| P5 | Bump the managed-site guide version next time its capability markers change. | `docs/archie/managed-site-guide.md` |
| P6 | `@archie/runtime` pins `@typescript/typescript-darwin-arm64` in its dependencies, so the install is wrong on Linux, x64, and Windows; resolve the host-correct TypeScript native package. A blocker before substantial trials beyond the developer's own machine. See [ARCHIE-DQ02](./open-questions.md). | `packages/archie-runtime/package.json` |
| P7 | Playwright browsers never download under `npm ci --ignore-scripts`; keep the flag and add an explicit `npx playwright install chromium` step, or drop the flag; decide whether the browser download happens at install time or on first use. | `packages/archie-runtime/src/release-install/run-npm.ts` |
| T1 | The npm lock template is still named `release-npm-lock-v2.json` though it serves release record v3; rename or document. | `packages/archie-runtime/vendor/` |
| T2 | The source manifest and migration inventories keep absolute paths of retired repositories as history; decide whether to keep them. | `source-import-manifest.json`, `packages/*/migration-inventory.json` |
| T3 | One canonical parser for bundle and native-lock evidence; duplication today creates drift risk. | release-record and lock evidence seam |
| T4 | Watch for release-record test flakiness (one unreproduced pair of failures directly after installs; never repeated). | `test/release-record/` |
| T5 | An uninstall leaves APM's own artifacts (`apm_modules/` and its `.gitignore`) behind in a repository that had neither before; harmless and rehydratable, but the repository does not go back to having no APM. | uninstall and journal |

## Future direction

- **Adapters.** Keep the core product agent-neutral; Pi is the proven adapter, not the product boundary. Add other coding-agent adapters only when there is a real consumer and a bounded compatibility test. Each adapter must use canonical Archie skills and runtime contracts, keep installation project-local, preserve explicit invocation and authority boundaries, avoid silently changing ordinary agent behavior, translate only discovery and invocation mechanics (never fork capability logic), and carry its own end-to-end trial evidence. See [01-product spec](./01-product/spec.md).
- **Later candidates.** A merge-impact checking playbook after the Drift Detection review (prior exploration is input, not a product contract); signed records or controller trust only when private distribution needs authorization rather than local consistency proof; analyzer support beyond the current TypeScript seam through explicit compatibility contracts and characterization tests.

Capability and platform direction is settled only when it enters this tree; until then it is tracked as open questions and specific deltas, never as speculative requirements.

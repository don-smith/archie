---
name: architecture-conformance-onboarding
description: Use when onboarding an unfamiliar TypeScript repository to deterministic architecture-conformance evidence and maintainer-reviewed checks.
---

# Architecture Conformance onboarding

The CLI creates evidence; the maintainer chooses architecture and approval. Do not turn observed code into intent.

## Start or resume

1. From the target repository, run `.archie/runtime/node_modules/.bin/architecture-conformance onboard setup`. If the project-local executable is missing or does not resolve into the pinned `@archie/conformance` package, stop and repair the Archie installation. Never use a global executable or download through `npx`.
2. Choose the repository’s skill-discovery directory with the maintainer. Initialize once:
   ```sh
   .archie/runtime/node_modules/.bin/architecture-conformance onboard init \
     --root tsconfig.json --include 'src/**/*.ts' \
     --exclude 'src/**/*.micro.ts' \
     --skill-location .agents/skills/architecture-conformance-onboarding
   ```
   This records `onboarding-state/v1`, operational paths, and the chosen location only.
3. On resume, read `.architecture-conformance/onboarding.json`, verify the referenced digests and artifacts, then continue from its checkpoint. Do not rely on a prior conversation as approval.

## Evidence lifecycle

1. Confirm roots, includes, and exclusions with the maintainer. Do not select an architecture ID.
2. Generate evidence once:
   ```sh
   .archie/runtime/node_modules/.bin/architecture-conformance analyze \
     --root tsconfig.json --include 'src/**/*.ts' \
     --exclude 'src/**/*.micro.ts' \
     --output .architecture-conformance/evidence/observed-graph.json \
     --summary-output .architecture-conformance/evidence/onboarding-summary.md
   ```
   Read the summary and gaps with the maintainer. Stop on unresolved or out-of-scope evidence until the maintainer resolves scope or records the limitation.
3. Ask the maintainer to author or revise the realization map. Run `check` with proposed rules and present its deterministic JSON report. The agent must not select an architecture ID, create an active rule, or manufacture approval.
4. Before an active check, ask the maintainer whether to approve each rule and provide its approval metadata. Present strict gaps before interpreting violations.
5. Before a baseline, show the explicit JSON report and ask how the maintainer wants to handle active results. The agent must not create a baseline through `check`, create broad exceptions, or call any result passing.
6. After each satisfied evidence boundary, advance only the operational checkpoint, for example:
   ```sh
   .archie/runtime/node_modules/.bin/architecture-conformance onboard advance \
     --checkpoint evidence-generated
   ```

## Stops

Stop and request a maintainer decision for missing local setup, source gaps, map overlap/unmatched/stale evidence, architecture classification, proposed-to-active approval, exceptions, and baseline handling. Maps, contracts, exceptions, approvals, and baselines are maintainer-owned normative artifacts; state only points to evidence.

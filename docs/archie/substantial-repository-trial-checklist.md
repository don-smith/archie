# Substantial-repository trial checklist

Use this only after the local Phase 8 packet is green. Choose a repository that is large enough to exercise real package boundaries and has a clean Git state or disposable worktree.

## Before installation

- Record the repository commit, Node/npm/APM versions, current Archie state, and any existing APM manifest or lock.
- Keep a recoverable copy of existing `.archie`, `.agents/skills`, `apm.yml`, and `apm.lock.yaml` state.
- Select the reviewed local release directory explicitly. Do not use `latest`, a network URL, or an unreviewed replacement record.
- Confirm separately whether GitHub SSH preflight or an immutable private context tag is approved. Do not create or push a tag as part of this checklist without that approval.

## Install and replay

1. Bootstrap the local candidate and save its JSON report and stderr.
2. Confirm `.archie/runtime/package-lock.json` names exactly `@archie/runtime` and `@archie/conformance` at the candidate version.
3. Run both `.archie/runtime/node_modules/.bin/architecture-docs` and `.archie/runtime/node_modules/.bin/architecture-conformance` on the repository.
4. Confirm all six `.agents/skills` trees are present and the APM lock still retains unrelated target state.
5. Run `archie verify --format json` twice. The second replay must not change tracked files or target-owned release bytes.
6. If this repository has a v1 installation, run the explicit v1-to-v2 upgrade and verify the old pin before staging.

## Product behavior to inspect

- Run one Architecture Assessment. Check factual citations, unknowns, current-versus-intended separation, recommendation usefulness, and the developer approval stop.
- Set up one small active Conformance policy and one deliberate violation. Check pass, blocking violation, incomplete evidence, and invalid-input meanings without treating them as an overall architecture score.
- Confirm generated Architecture Docs and embedded HTML assets still match the repository evidence and do not silently consume private producer internals.
- Note unsupported source patterns, false positives, missing evidence, confusing instructions, and operator friction.

## Recovery

- Preserve one pre-upgrade copy, inject or reproduce one safe installation failure, and confirm compensation restores the previous verified state.
- Run `archie verify --format json` after recovery.
- Stop if compensation is blocked, installed bytes differ from the selected record, or unrelated APM state changes.

## Decision record

Record the repository and candidate commits, commands, reports, observed benefits, regressions, gaps, and one of these outcomes:

- continue local trials;
- fix before another trial;
- approve a separate immutable-ref or private-release operation;
- reject the candidate.

A successful trial does not itself authorize push, tag, publication, or sibling-repository archival.

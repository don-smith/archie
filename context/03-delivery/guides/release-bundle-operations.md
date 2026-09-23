# Release bundle operations

An Archie release bundle is a maintainer-reviewed local directory. Version 3 contains the Runtime and Conformance npm artifacts (`@archie/runtime`, `@archie/conformance`) plus the eight-skill APM context: `archie`, `architecture-assessment`, `architecture-conformance-onboarding`, `architecture-contracts`, `architecture-docs`, `architecture-review`, `html-design`, and `likec4-authoring`. The normative guarantees behind these steps live in the [03-delivery spec](../spec.md) and [requirements](../requirements.md); this guide is the step-by-step companion.

## Prerequisites and authority

Use Node 24, npm 11, APM 0.29, Git, and SSH access to the context repository. Credentials stay in the operator's SSH agent or normal package-manager configuration. Never put tokens, keys, environment files, or credential material in the bundle.

Finalization, bootstrap, upgrade, and verify are local operations. They do not authorize publication, pushing, tagging, archiving sibling repositories, or making them read-only. Obtain separate developer approval before any Git push or tag operation.

## Bundle contents

The finalization input contains only:

```text
bundle.json
npm/
  archie-runtime.tgz
  archie-runtime.lock.json
  conformance.tgz
  conformance.lock.json
apm/
  apm.yml
  apm.lock.yaml
```

`bundle.json` uses `archie-private-bundle-input-v3`. Its ordered `artifacts` array contains `@archie/runtime` first and `@archie/conformance` second. Both artifacts use the Archie product version and target-owned `file:npm/*.tgz` locators. Each entry names its lock file, tarball, and required payload. The Runtime lock is the complete npm v3 install lock: its root lists both local artifacts and it retains the exact dependency closure required by their packed manifests. Finalization rejects a lock whose root or direct artifact entries differ from the generated projection. The Runtime's required payload is its Architecture Docs command (`dist/architecture-docs/bin/architecture-docs.mjs`); Conformance's is `dist/cli.js`. The APM entry names the private Git SSH locator, an immutable ref, the repository-relative subfolder holding the context, the native manifest and lock, and all eight skills. An immutable ref is either the `v<version>` tag or a full 40-character commit SHA; a bundle built from a clone is pinned by commit. The subfolder is required because the monorepo has no root `apm.yml`, so the context resolves only through `packages/archie-context`.

## Build and finalize

Build the input from a monorepo checkout, then finalize it:

```bash
archie-release build \
  --bundle ./release-bundle \
  --ref $(git rev-parse HEAD)

archie-release finalize \
  --bundle ./release-bundle \
  --source-commit <40-character-Git-commit>
```

`build` packs both artifacts, generates their shared npm lock, writes the APM manifest, and has native APM resolve the pin into `apm/apm.lock.yaml`. It defaults to the `git@github.com:don-smith/archie.git` locator and the `packages/archie-context` subfolder, overridable with `--locator` and `--path`, and packs from the current directory unless `--workspace` names another checkout. It reviews nothing and makes no authorization claim; finalization remains the separate step that closes the record.

Finalization strictly checks each npm archive's ustar headers, checksums, bounds, termination, unique safe entry names, package identity, product version, lock integrity, SHA-256 digest, dependencies, engines, and binaries. It rejects archive links and unsupported entry types. It normalizes the required payload as a safe package-relative path and requires the corresponding regular file in the npm archive. It also checks the APM locator, ref, resolved commit, content hash, skill order, and analyzer compatibility. It writes:

```text
release-record-v3.json
release-review.txt
```

The closed record rejects missing, extra, duplicated, reordered, network-located, mixed-version, or mutated artifacts. Its authorization declaration remains:

```json
{"kind":"none","claim":"locally-reviewed-private-trial"}
```

The receipt states that authorization was not assessed. It proves finalized-byte consistency only. It does not claim signing, publisher identity, public-release trust, controller distribution, key handling, or permission to publish.

## Private context preflight

Before finalization, confirm that the target Git identity can read the context repository:

```bash
git ls-remote git@github.com:don-smith/archie.git
```

`archie-release build` then writes the manifest and runs `apm lock` for you. Two constraints govern its shape. The dependency must use the mapping form with a `path:` key: the plain string spec that `apm install` writes into `apm.yml` resolves the same bytes but produces a lock with no `skill_subset`, which the pinned projection requires. And the consuming project's APM targets must include `agent-skills`; a project whose targets do not overlap logs `Package targets [agent-skills] do not overlap authorized active targets; skipping`, deploys nothing, and still exits successfully.

Confirm the generated lock's resolved commit, content hash, ref, repository, virtual path, and skill subset before finalizing. Do not reuse a lock from different context bytes. Creating or moving a `v<version>` tag still needs separate developer approval; pinning by commit SHA does not.

## Target operations

Select a reviewed local directory explicitly:

```bash
archie bootstrap --release ./release-bundle --format json
archie upgrade --release ./next-release-bundle --format json
archie verify --format json
```

Bootstrap and upgrade reject `latest`, network selectors, incomplete bundles, and replacement records outside the selected directory. Verify accepts no release selector and reads the target-owned v3 pin. Application `package.json` and `package-lock.json` remain untouched.

Archie copies both tarballs under `.archie/runtime/npm/`, writes the generated two-artifact manifest, copies the finalized complete Runtime lock without regenerating that lock on the target, and runs `npm ci --ignore-scripts --offline`. The target's npm cache must contain the lock's external dependency bytes; offline mode forbids registry recovery. Archie verifies both installed manifests and requires these project-local links to resolve into their recorded packages:

```text
.archie/runtime/node_modules/.bin/architecture-docs
.archie/runtime/node_modules/.bin/architecture-conformance
```

APM lock and frozen installation then deploy the eight recorded skill trees, including `html-design`, whose scripts run without installed dependencies. Replay re-reads the target pin and checks npm, APM, every deployed skill file against the native lock, and analyzer compatibility without selecting a new release.

## Upgrade, failure reports, and recovery

Release record v3 is a clean break. Archie reads only v3 records, and bootstrap refuses a target that still holds a v1 or v2 pin: remove `.archie/release`, `.archie/runtime`, and `.archie/version`, then bootstrap the v3 release. An upgrade verifies the installed v3 state before staging any file. The install journal records every touched record, npm file and binary link, APM file, and deployed projection. If staging or native verification fails, Archie restores the previous state and verifies it again. A blocked compensation remains a failure and preserves the journal for diagnosis.

Capture a machine-readable failure report while retaining stderr:

```bash
archie upgrade --release ./next-release-bundle --format json \
  > failure-report.json 2> failure-report.stderr
```

Inspect `failure-report.json`, `failure-report.stderr`, and `.archie/release/install-journal.json`. Do not rerun with edited records, copied locks, network locators, or manually repaired installed bytes. Restore the last reviewed local bundle or resolve the named prerequisite, then run `archie verify --format json`. Escalate any `compensation: blocked` result before another upgrade attempt.

## Local release-candidate evidence

Run `npm run private-trial:evaluate` to build two independent local v3 bundles and exercise the integrated matrix. The evaluator uses genuine Runtime and Conformance packs, the exact generated lock, real offline npm installation, both installed commands, byte comparisons for both packages and all eight skills, replay, refusal of a pre-v3 pin, mutation rejection, policy outcomes, and compensation. Its retained packet is `evaluation/private-trials/latest.json`; see [the evidence guide](./release-candidate-evidence.md) for reading it.

The local evaluator deliberately does not run GitHub SSH preflight or create the immutable private context ref. It records those gates as deferred and uses the retained APM identity fixture while byte-checking the current canonical skills. After the eight-skill context is published at `v<version>`, run `ARCHIE_E2E_PUBLISHED_CONTEXT=1 npm run test:e2e -- private-trials` to exercise native APM locking and frozen deployment against it. Follow [the substantial-repository trial checklist](./substantial-repository-trial-checklist.md) before any release decision.

Until the external context gate and developer repository trial are complete, the candidate is local-only and not release-approved.

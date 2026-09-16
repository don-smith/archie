# Private release bundle

A private Archie release bundle is a maintainer-reviewed local directory. Version 2 contains the Runtime and Conformance npm artifacts plus the six-skill APM context.

## Prerequisites and authority

Use Node 24, npm 11, APM 0.29, Git, and SSH access to the private context repository. Credentials stay in the operator's SSH agent or normal package-manager configuration. Never put tokens, keys, environment files, or credential material in the bundle.

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

`bundle.json` uses `archie-private-bundle-input-v2`. Its ordered `artifacts` array contains `@archie/runtime` first and `@archie/conformance` second. Both artifacts use the Archie product version and target-owned `file:npm/*.tgz` locators. Each entry names its lock file, tarball, and required payload. The Runtime lock is the complete npm v3 install lock: its root lists both local artifacts and it retains the exact dependency closure required by their packed manifests. Finalization rejects a lock whose root or direct artifact entries differ from the v2 projection. The APM entry names the private Git SSH locator, immutable version ref, native manifest and lock, and all six skills.

Run:

```bash
archie-release finalize \
  --bundle ./release-bundle \
  --source-commit <40-character-Git-commit>
```

Finalization strictly checks each npm archive's ustar headers, checksums, bounds, termination, unique safe entry names, package identity, product version, lock integrity, SHA-256 digest, dependencies, engines, and binaries. It rejects archive links and unsupported entry types. It normalizes the required payload as a safe package-relative path and requires the corresponding regular file in the npm archive. It also checks the APM locator, ref, resolved commit, content hash, skill order, analyzer compatibility, and HTML Design provenance. It writes:

```text
release-record-v2.json
release-review.txt
```

The closed record rejects missing, extra, duplicated, reordered, network-located, mixed-version, or mutated artifacts. Its authorization declaration remains:

```json
{"kind":"none","claim":"locally-reviewed-private-trial"}
```

The receipt states that authorization was not assessed. It proves finalized-byte consistency only. It does not claim signing, publisher identity, public-release trust, controller distribution, key handling, or permission to publish.

## Private context preflight

Before finalization, confirm that the target Git identity can read the private context repository:

```bash
git ls-remote git@github.com:don-smith/archie.git
```

With separate developer approval, publish the exact `packages/archie-context/` tree and create the immutable `v<version>` tag. Then create the bundle APM manifest with `git: git@github.com:don-smith/archie.git`, the approved ref, and the six Archie skills. Run `apm lock` in the bundle context and confirm its resolved commit, content hash, ref, repository, and skill subset before finalizing. Do not reuse a lock from different context bytes.

## Target operations

Select a reviewed local directory explicitly:

```bash
archie bootstrap --release ./release-bundle --format json
archie upgrade --release ./next-release-bundle --format json
archie verify --format json
```

Bootstrap and upgrade reject `latest`, network selectors, incomplete bundles, and replacement records outside the selected directory. Verify accepts no release selector and reads the target-owned v1 or v2 pin. Application `package.json` and `package-lock.json` remain untouched.

For v2, Archie copies both tarballs under `.archie/runtime/npm/`, writes the generated two-artifact manifest, copies the finalized complete Runtime lock without regenerating that lock on the target, and runs `npm ci --ignore-scripts --offline`. The target's npm cache must contain the lock's external dependency bytes; offline mode forbids registry recovery. Archie verifies both installed manifests and requires these project-local links to resolve into their recorded packages:

```text
.archie/runtime/node_modules/.bin/architecture-docs
.archie/runtime/node_modules/.bin/architecture-conformance
```

APM lock and frozen installation then deploy the six recorded skill trees. Replay re-reads the target pin and checks npm, APM, deployed files, analyzer compatibility, and HTML snapshot evidence without selecting a new release.

## Upgrade, failure reports, and recovery

A v1-to-v2 upgrade verifies the installed v1 state before staging any v2 file. The install journal records every touched record, npm, APM, and deployed projection. If staging or native verification fails, Archie restores the previous state and verifies it again. A blocked compensation remains a failure and preserves the journal for diagnosis.

Capture a machine-readable failure report while retaining stderr:

```bash
archie upgrade --release ./next-release-bundle --format json \
  > failure-report.json 2> failure-report.stderr
```

Inspect `failure-report.json`, `failure-report.stderr`, and `.archie/release/install-journal.json`. Do not rerun with edited records, copied locks, network locators, or manually repaired installed bytes. Restore the last reviewed local bundle or resolve the named prerequisite, then run `archie verify --format json`. Escalate any `compensation: blocked` result before another upgrade attempt.

## Local release-candidate evidence

Run `npm run private-trial:evaluate` to build two independent local v2 bundles and exercise the integrated matrix. The evaluator uses genuine Runtime and Conformance packs, the exact generated lock, real offline npm installation, both installed commands, byte comparisons for both packages and all six skills, replay, v1-to-v2 upgrade, mutation rejection, policy outcomes, and compensation. Its retained packet is `evaluation/private-trials/latest.json`.

The local evaluator deliberately does not run GitHub SSH preflight or create the immutable private context ref. It records those gates as deferred and uses the retained APM identity fixture while byte-checking the current canonical skills. Follow [the substantial-repository trial checklist](substantial-repository-trial-checklist.md) before any release decision.

Until the external context gate and developer repository trial are complete, the candidate is local-only and not release-approved.

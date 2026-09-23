# 03-delivery — spec

## Status: Draft

Current delivery behavior. Unmarked content describes present supported behavior.

## Release identity

The product version is the lockstep root `package.json` version; the release-record schema version is the constant `3` (`RELEASE_RECORD_SCHEMA_VERSION`) and is independent of the product version. The bundle input format token `archie-private-bundle-input-v3` and the record file `release-record-v3.json` are protocol format names and stay stable.

## The release record

Finalization validates the bundle input, npm archives (headers, checksums, bounds, termination, unique safe entry names, package identity, product version, lock integrity, digest, dependencies, engines, binaries), the APM manifest and lock (locator, immutable ref, resolved commit, content hash, exact eight-skill set in order), and analyzer compatibility. It writes `release-record-v3.json` and `release-review.txt`, whose non-authorization boundary sentence states:

> Archie authorization: NOT ASSESSED — locally reviewed release selected.

The receipt boundary also states that signing, public-release trust, controller distribution, and key operations are deferred. Selection accepts both this current sentence and its historical wording (`locally reviewed private release selected`), so previously finalized v3 bundles remain selectable. The record's `authorization` field carries the required legacy literal `authorization: {kind: 'none', claim: 'locally-reviewed-private-trial'}`; it is wire evidence, not review evidence (see [DELTA-001](../.delta/DELTA-001-legacy-authorization-wire.md)). Selection requires the explicit local directory, re-verifies every artifact byte, checks the exact npm lock projection and APM evidence, and rejects missing, extra, duplicated, reordered, network-located, mixed-version, or mutated artifacts.

## Local operations

- `build` packs both artifacts, generates their shared npm lock, writes the APM manifest, and resolves the pin into `apm/apm.lock.yaml`; it reviews nothing and makes no authorization claim.
- `finalize` closes the record and receipt after strict checks; `bootstrap`, `upgrade`, and `verify` install or verify a pinned release in a target.
- Install never pushes, never tags, and never touches the target application's `package.json` or `package-lock.json`; it writes `.agents/skills/`, the release pin, runtime tarballs, and the APM files, with an optional Claude Code symlink bridge.
- The scripted install (`install.sh` at the repository root) wraps `archie bootstrap`: it checks Node 24, npm, Git, and APM; detects an existing install and upgrades it; names exactly what to remove for a pre-v3 pin; verifies that the target's APM targets overlap (`agent-skills`); builds and finalizes a bundle from the clone's commit; bootstraps; writes `.archie/.gitignore`; installs the Playwright browser; and points the developer at the `archie` skill. `uninstall.sh` replays the install journal and restores preimages. A consuming repository commits the pin (`.archie/release/`, `.archie/version`, `.archie/runtime/package-lock.json`), the eight skill trees, and the two npm tarballs; it never commits `.archie/runtime/node_modules/`, which is machine-local and rehydrated. A pin whose `node_modules` is absent is treated as unhydrated, not uninstalled: the runtime attempts `npm ci --ignore-scripts --offline`, succeeds in seconds on a warm cache, and on a cold cache prints the single command to run.
- Recovery replays the install journal with exact bytes; uninstall restores every touched path and keeps `.archie/assessments/` as the target's work product.

The bundle input, build and finalize commands, preflight checks, target operations, and failure-report procedure are documented step by step in [the bundle-operations guide](./guides/release-bundle-operations.md).

## Release candidate evidence

`npm run private-trial:evaluate` builds two independent local v3 bundles from a clean checkout and exercises the integrated matrix with genuine packs, the exact generated lock, real offline npm installation, both installed commands, byte comparisons for both packages and all eight skills, replay, refusal of a pre-v3 pin, mutation rejection, policy outcomes, and compensation. It writes `evaluation/private-trials/latest.json` in `archie-private-trial-evidence-v3` format.

The local evaluator does not run GitHub SSH preflight or create the immutable context ref; it records those gates as deferred, and the candidate stays `local-only` and is not release-approved until the external context gate and a developer repository trial are complete. After the eight-skill context is published at `v<version>`, `ARCHIE_E2E_PUBLISHED_CONTEXT=1 npm run test:e2e -- private-trials` exercises native APM locking and frozen deployment against the commit-pinned fixture. Reading the packet is documented in [the evidence guide](./guides/release-candidate-evidence.md); the developer-owned manual trial follows [the substantial-repository trial checklist](./guides/substantial-repository-trial-checklist.md).

## Verification

A release is verified by installing it into real repositories and using it; manual review is recorded as not-performed rather than treated as a gate. Structural release checks are local and deterministic; no external publisher, registry, or signing gate exists today. Signing, trusted distribution, key operations, controller distribution, and publication remain deferred; a release decision always distinguishes local consistency from authorization or trust.

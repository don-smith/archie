# 03-delivery — spec

## Status: Draft

Current delivery behavior. Unmarked content describes present supported behavior.

## Release identity

The product version is the lockstep root `package.json` version; the release-record schema version is the constant `3` (`RELEASE_RECORD_SCHEMA_VERSION`) and is independent of the product version. The bundle input format token `archie-private-bundle-input-v3` and the record file `release-record-v3.json` are protocol format names and stay stable.

## The release record

Finalization validates the bundle input, npm archives (headers, checksums, bounds, termination, unique safe entry names, package identity, product version, lock integrity, digest, dependencies, engines, binaries), the APM manifest and lock (locator, immutable ref, resolved commit, content hash, exact eight-skill set in order), and analyzer compatibility. It writes `release-record-v3.json` and `release-review.txt`, whose non-authorization boundary sentence states:

> Archie authorization: NOT ASSESSED — locally reviewed private release selected.

The receipt boundary also states that signing, public-release trust, controller distribution, and key operations are deferred. The record's `authorization` field carries the required legacy literal `authorization: {kind: 'none', claim: 'locally-reviewed-private-trial'}`; it is wire evidence, not review evidence (see [DELTA-001](../.delta/DELTA-001-legacy-authorization-wire.md)). Selection requires the explicit local directory, re-verifies every artifact byte, checks the exact npm lock projection and APM evidence, and rejects missing, extra, duplicated, reordered, network-located, mixed-version, or mutated artifacts.

## Local operations

- `build` packs both artifacts, generates their shared npm lock, writes the APM manifest, and resolves the pin into `apm/apm.lock.yaml`; it reviews nothing and makes no authorization claim.
- `finalize` closes the record and receipt after strict checks; `bootstrap`, `upgrade`, and `verify` install or verify a pinned release in a target.
- Install never pushes, never tags, and never touches the target application's `package.json` or `package-lock.json`; it writes `.agents/skills/`, the release pin, runtime tarballs, and the APM files, with an optional Claude Code symlink bridge.
- Recovery replays the install journal with exact bytes; uninstall restores every touched path and keeps `.archie/assessments/` as the target's work product.

## Verification

A release is verified by installing it into real repositories and using it; manual review is recorded as not-performed rather than treated as a gate. Structural release checks are local and deterministic; no external publisher, registry, or signing gate exists today.

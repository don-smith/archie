# 03-delivery — requirements

**Role:** owns lockstep SemVer, tag-versus-commit pins, release-record schema v3, local release, verification, and recovery.

## Context

Builds on [root requirements](../requirements.md). This node owns the delivery boundary: what a release record certifies, how pins stay immutable, and why selection and recovery are local operations. The specific legacy authorization-wire divergence is tracked in [DELTA-001](../.delta/DELTA-001-legacy-authorization-wire.md).

## Requirements

- **ARCHIE.DEL-R01 Product version and record schema are independent.** The product SemVer is the lockstep root-version identity; the release-record schema version remains `3` and is documented separately. `refines: ARCHIE-R01`
- **ARCHIE.DEL-R02 Records pin exact bytes and refs.** The release record pins the product version, source commit, artifact identities and hashes, the exact npm lock projection, APM manifest and lock evidence, and analyzer compatibility; the record is canonical serialized bytes. `refines: ARCHIE-R07`
- **ARCHIE.DEL-R03 Only immutable refs pin APM context.** The APM ref is the `v<version>` tag or a full 40-character commit SHA; a moving branch never pins deployed context. `refines: ARCHIE-R07`
- **ARCHIE.DEL-R04 Selection is local and exact.** Selection requires an explicit local directory, verifies every artifact byte against the finalized record, and never resolves a release from a network source; bundle artifact locators are target-owned local tarballs. `refines: ARCHIE-R07`
- **ARCHIE.DEL-R05 The authorization wire value is preserved.** The record keeps `authorization: {kind: 'none', claim: 'locally-reviewed-private-trial'}` as a required legacy v3 literal, and the review receipt retains the authorization-not-assessed warning; local byte verification never authorizes a release. `refines: ARCHIE-R07`

## Assumptions

- **ARCHIE.DEL-A01 Release operations are maintainer-local.** Finalization, bootstrap, upgrade, and verify change only the target and require no registry, signing service, or network release resolution.

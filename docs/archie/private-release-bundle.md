# Private release bundle

A private Archie release bundle is a maintainer-reviewed local directory. Run:

```bash
archie-release finalize --bundle ./release-bundle --source-commit <40-character-Git-commit>
```

The bundle must contain only:

```text
bundle.json
npm/
  package-lock.json
  archie-runtime.tgz
apm/
  apm.yml
  apm.lock.yaml
```

`bundle.json` uses `archie-private-bundle-input-v1` and identifies the exact relative paths, npm package/version/locator/platform payload, and APM package/skill/locator/ref. Finalization checks the npm lock integrity against the finalized tarball and checks the APM manifest and lock locator, ref, resolved commit, and content hash. It writes these two additional files:

```text
release-record-v1.json
release-review.txt
```

The record is canonical JSON with a closed `release-record-v1` field set. It binds the final npm and APM evidence, retained analyzer compatibility, and full immutable HTML Design provenance. It has exactly one authorization declaration:

```json
{"kind":"none","claim":"locally-reviewed-private-trial"}
```

A passing receipt says:

```text
Archie authorization: NOT ASSESSED — locally reviewed private release selected.
```

That is a consistency statement about bytes selected for local review. It is not a claim of release provenance. Signing, public-release trust, controller distribution, trust roots, key operations, rollback policy, and publication configuration are deferred. The record never contains a signature, signer, key, trust root, or release sequence.

`archie-release finalize` is local-only. It does not fetch artifacts, publish a package, change a target, or choose a release for bootstrap, upgrade, or verify.

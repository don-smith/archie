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

## Target selection and projection planning

Select the reviewed local directory explicitly when staging a target:

```bash
archie bootstrap --release ./release-bundle
archie upgrade --release ./next-release-bundle
archie verify
```

`bootstrap` and `upgrade` reject `latest`, network selectors, incomplete bundles, and any replacement record not contained in the chosen local directory. `verify` accepts no `--release` option; it reads only the target-owned `.archie/release/release-record-v1.json` and `.archie/version` pin.

Before an upgrade stages a replacement, Archie verifies the current installed runtime package, HTML snapshot, and deployed APM skill against the existing pin. Planning then stages the replacement record, a selection receipt, and a nested npm manifest/lock under `.archie/`. The receipt may retain the selected local path for diagnosis, but that path is not replay identity. The npm tarball is copied into `.archie/runtime/npm/`; application `package.json` and `package-lock.json` are not edited. Archie structurally merges only its APM dependency and lock entry in root `apm.yml` and `apm.lock.yaml`, retaining unrelated dependencies, deployments, and policy or failing before writes when the supported shared structure is ambiguous. `archie bootstrap`, `archie upgrade`, and `archie verify` run the pinned native checks after staging. They use `npm ci --ignore-scripts`, `apm install --frozen`, a no-policy baseline audit, policy status, and a policy-aware audit. Their report keeps baseline and policy results separate. A pass still says that Archie authorization is not assessed.

Run `npm run private-trial:evaluate` to regenerate the retained hermetic evaluation packet at `evaluation/private-trials/latest.json`. It records deterministic finalization, selected-artifact installation proof, replay byte manifests, drift rejection, recovery, capability authority checks, and the coordinated record-plus-artifact replacement boundary. See [private-trial evidence](private-trial-evidence.md) for the matrix and claim limit. Signing, public-release trust, controller distribution, trust roots, and key operations remain deferred.

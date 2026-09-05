# Private-trial evidence

Run the hermetic private-trial evaluator from a clean checkout:

```bash
npm run private-trial:evaluate
```

It writes `evaluation/private-trials/latest.json`. The packet records the local bundle flow, environment versions, deterministic finalization result, tracked-byte manifests, mutation rejections, policy outcomes, recovery result, capability authority checks, and the text report.

The evaluator stages finalized copies of `test/fixtures/private-bundles/valid`. Its native command runner is deterministic so the npm and APM failure cases can be replayed without network access. It models the required `npm ci --ignore-scripts`, `apm install --frozen`, baseline audit, policy status, and policy audit sequence. `npm run test:e2e -- apm-context` separately runs APM 0.29 against the frozen context.

A successful packet says only that a maintainer selected consistent local bytes. It must contain:

```text
Archie authorization: NOT ASSESSED — locally reviewed private release selected.
```

The coordinated replacement case changes an APM content hash and finalizes a new record. It passes because both artifacts were locally selected together. That result is deliberate. Archie does not detect authorization attacks, and it does not claim signing, trusted publication, controllers, keys, rollback policy, or public-release trust.

Review `latest.json`, run one selected-bundle trial, and record the maintainer decision under `.myflow/workstreams/archie-foundation/verify/` before Close.

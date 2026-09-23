# Release candidate evidence

How to run the retained local release-candidate evaluator and read its packet. The normative guarantees are in the [03-delivery spec](../spec.md); the bundle build and target steps are in [release-bundle-operations](./release-bundle-operations.md).

## Running the evaluator

Run the retained release-candidate evaluator from a clean checkout:

```bash
npm run private-trial:evaluate
```

The command builds both private workspaces first, then the evaluator requires a clean Git working tree before packing. The evaluator creates two independent `release-record-v3` bundles from genuine npm packs, and writes `evaluation/private-trials/latest.json`. Tracked or non-ignored untracked changes fail before packing, so the recorded `sourceCommit` identifies the packaged source. Ignored dependency and build state remains constrained by package allowlists. The packet records environment versions, deterministic record and bundle digests, clean bootstrap, two verify replays, same-version replay, refusal of a pre-v3 pin, mutation rejection, policy outcomes, compensation, package and skill byte identity, both project-local commands, capability authority stops, and deferred external gates.

## What runs natively

The evaluator uses real `npm ci --ignore-scripts --offline` with an isolated cache and an unreachable registry. It installs the exact generated lock and compares each installed Runtime and Conformance package with the selected tarball. It also executes the installed `architecture-docs` and `architecture-conformance` commands.

The local evaluator does not resolve or publish the Git context. A deterministic APM seam stages the retained lock identity, deploys the current eight canonical skill trees, records every deployed file hash, and exercises frozen install, baseline, pass, block, and no-policy outcomes. `npm run test:e2e -- apm-context` separately exercises native APM 0.29 frozen installation against its accepted fixture.

## Reading the packet

A usable local packet has:

- `format: archie-private-trial-evidence-v3`;
- `candidate.status: local-only` and `candidate.authorization: not-assessed`;
- identical `finalization.artifactManifest` and `repeatedArtifactManifest` digests;
- `installation.byteStable: true`;
- `legacyPin.rejected: true` and compensated recovery with equal before/after digests;
- exact npm lock, artifact, package, eight-skill, command-link, and embedded Architecture Docs evidence;
- every mutation rejected;
- separate pass, block, and no-policy outcomes;
- GitHub SSH, immutable ref, push, and tag recorded as not run or not authorized.

The text receipt must contain:

```text
Archie authorization: NOT ASSESSED — locally reviewed release selected.
```

Selection also accepts the historical boundary wording `Archie authorization: NOT ASSESSED — locally reviewed private release selected.`, so previously finalized v3 bundles remain selectable.

Manual review is recorded honestly rather than left pending: every migration's `gateEvidence.manualReview` in `source-import-manifest.json` reads `not-performed: verified through use until an evaluation system exists`. Archie is verified by installing it into real repositories and using it; findings from that use become roadmap items.

This packet proves local byte consistency and recovery behavior. It does not approve the candidate, verify a real immutable context ref, exercise a substantial external repository, or claim signing, publisher identity, public-release trust, controller distribution, or permission to publish.

Use [the substantial-repository trial checklist](./substantial-repository-trial-checklist.md) for the developer-owned manual trial. Record findings before any push, tag, archival, or release decision.

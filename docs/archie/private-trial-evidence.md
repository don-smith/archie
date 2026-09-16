# Private-trial evidence

Run the retained release-candidate evaluator from a clean checkout:

```bash
npm run private-trial:evaluate
```

The command first requires a clean Git worktree, then builds both private workspaces, creates two independent `release-record-v2` bundles from genuine npm packs, and writes `evaluation/private-trials/latest.json`. Tracked or non-ignored untracked changes fail before packing, so the recorded `sourceCommit` identifies the packaged source. Ignored dependency and build state remains constrained by package allowlists and the immutable HTML snapshot provenance. The packet records environment versions, deterministic record and bundle digests, clean bootstrap, two verify replays, same-version replay, v1-to-v2 upgrade, mutation rejection, policy outcomes, compensation, package and skill byte identity, both project-local commands, capability authority stops, and deferred external gates.

## What runs natively

The evaluator uses real `npm ci --ignore-scripts --offline` with an isolated cache and an unreachable registry. It installs the exact generated v2 lock and compares each installed Runtime and Conformance package with the selected tarball. It also executes the installed `architecture-docs` and `architecture-conformance` commands.

The local evaluator does not resolve or publish the private Git context. A deterministic APM seam stages the retained lock identity, deploys the current six canonical skill trees, records every deployed file hash, and exercises frozen install, baseline, pass, block, and no-policy outcomes. `npm run test:e2e -- apm-context` separately exercises native APM 0.29 frozen installation against its accepted fixture.

## Reading the packet

A usable local packet has:

- `format: archie-private-trial-evidence-v2`;
- `candidate.status: local-only` and `candidate.authorization: not-assessed`;
- identical `finalization.artifactManifest` and `repeatedArtifactManifest` digests;
- `installation.byteStable: true`;
- passing `v1ToV2Upgrade` and compensated recovery with equal before/after digests;
- exact npm lock, artifact, package, six-skill, command-link, and embedded Architecture Docs evidence;
- every mutation rejected;
- separate pass, block, and no-policy outcomes;
- GitHub SSH, immutable ref, push, and tag recorded as not run or not authorized.

The text receipt must contain:

```text
Archie authorization: NOT ASSESSED — locally reviewed private release selected.
```

This packet proves local byte consistency and recovery behavior. It does not approve the candidate, verify a real immutable private context ref, exercise a substantial external repository, or claim signing, publisher identity, public-release trust, controller distribution, or permission to publish.

Use [the substantial-repository trial checklist](substantial-repository-trial-checklist.md) for the developer-owned manual trial. Record findings before any push, tag, archival, or release decision.

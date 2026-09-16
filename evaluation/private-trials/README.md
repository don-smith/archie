# Private-trial evidence

Run the integrated local release-candidate evaluator from a clean checkout:

```bash
npm run private-trial:evaluate
```

It writes `latest.json` in `archie-private-trial-evidence-v2` format. The evaluator packs the real Runtime and Conformance workspaces twice, finalizes both v2 bundles, installs the exact offline npm projection, deploys and hashes the current six-skill context through the deterministic APM seam, and exercises bootstrap, verify replay, same-version replay, v1-to-v2 upgrade, tamper rejection, policy outcomes, and compensation.

The packet is local consistency evidence, not release approval. GitHub SSH preflight, a real immutable private context ref, push, tag, and publication remain explicit external gates. Review the packet with `docs/archie/private-trial-evidence.md` and run `docs/archie/substantial-repository-trial-checklist.md` before any release decision.

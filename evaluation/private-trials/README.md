# Private-trial evidence

Run the integrated local release-candidate evaluator from a clean checkout:

```bash
npm run private-trial:evaluate
```

It builds both private workspaces first and requires a clean Git working tree before packing. The evaluator creates two independent `release-record-v3` bundles from genuine npm packs and writes `evaluation/private-trials/latest.json` in `archie-private-trial-evidence-v3` format. The packet records environment versions, deterministic record and bundle digests, clean bootstrap, two verify replays, same-version replay, refusal of a pre-v3 pin, mutation rejection, policy outcomes, compensation, package and skill byte identity, both project-local commands, capability authority stops, and deferred external gates.

The packet is local consistency evidence, not release approval. GitHub SSH preflight, a real immutable context ref, push, tag, and publication remain explicit external gates. Review the packet with [the evidence guide](../../context/03-delivery/guides/release-candidate-evidence.md) and run [the substantial-repository trial checklist](../../context/03-delivery/guides/substantial-repository-trial-checklist.md) before any release decision.

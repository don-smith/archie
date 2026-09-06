# Private-trial evidence

Run the retained evaluation from a clean checkout:

```bash
npm run private-trial:evaluate
```

The command writes `evaluation/private-trials/latest.json`. It records the host versions, finalized record digest, replay byte manifests, text result, policy outcomes, recovery result, capability authority checks, and rejection result for each mutation.

The evaluator stages the selected npm tarball in `.archie/runtime/npm/`, extracts that tarball for its hermetic npm simulation, and compares its HTML snapshot with the installed copy. The native clean-target regression (`npm run test:e2e -- private-trials`) resolves the six-skill context from the private Git SSH locator, generates an APM 0.29 lock, and runs `apm install --frozen` without a target-local context source. The hermetic evaluator separately compares every deployed skill with the canonical context source.

The mutation matrix covers npm lock, integrity, locator, and tarball bytes. It covers APM locator, ref, resolved commit, content hash, deployed projection, and shared manifest drift. It also rejects installed runtime and HTML changes.

`npm run test:e2e -- pi-discovery` installs the frozen context in a temporary project and starts Pi with `/skill:archie`. The test gives Pi a temporary local provider that returns a fixed response, so it checks the full skill invocation without network access or model credentials.

A passing packet proves only that the selected local bytes stayed consistent through this trial. The report says `Archie authorization: NOT ASSESSED — locally reviewed private release selected.` It makes no claim about signing, publisher identity, public-release trust, controller distribution, key handling, rollback policy, or public publication.

# Private-trial evidence

Run the retained evaluation from a clean checkout:

```bash
npm run private-trial:evaluate
```

The command writes `evaluation/private-trials/latest.json`. It records the host versions, finalized record digest, replay byte manifests, text result, policy outcomes, recovery result, capability authority checks, and rejection result for each mutation.

The retained evaluator exercises the v1 compatibility path: it stages the selected Runtime tarball in `.archie/runtime/npm/`, extracts that tarball for its hermetic npm simulation, and compares its HTML snapshot with the installed copy. The native clean-target regression resolves the six-skill context from the private Git SSH locator, generates an APM 0.29 lock, and runs `apm install --frozen` without a target-local context source. The hermetic evaluator separately compares every deployed skill with the canonical context source.

The v2 package and upgrade tests cover ordered Runtime and Conformance artifacts, exact offline projection, package identity, both project-local binary links, and compensation from a failed v1-to-v2 upgrade. Phase 8 must extend the retained release-candidate evidence packet across that v2 path before the developer trial; this page does not claim that integrated trial evidence yet.

`npm run test:e2e -- pi-discovery` installs the frozen context in a temporary project and starts Pi with `/skill:archie`. The test gives Pi a temporary local provider that returns a fixed response, so it checks the full skill invocation without network access or model credentials.

A passing packet proves only that the selected local bytes stayed consistent through this trial. The report says `Archie authorization: NOT ASSESSED — locally reviewed private release selected.` It makes no claim about signing, publisher identity, public-release trust, controller distribution, key handling, rollback policy, or public publication.

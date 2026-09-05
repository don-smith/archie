# Archie fixture evaluation contract

This directory specifies a small behavioral evaluation suite. It is an evaluation contract, not a production fixture corpus and not a complete automated judgment of architecture advice.

Each fixture is a Markdown manifest with these fields:

- **Seed files.** The minimal repository-shaped evidence available to Archie.
- **Allowed capabilities.** The maintained owners that the evaluator makes available.
- **Prompt.** The developer request.
- **Expected route.** The primary capability Archie selects or recommends.
- **Evidence and uncertainty observations.** Required source markers, ownership observations, and labels for missing or inferred facts.
- **Developer decision required.** Whether Archie must stop before a durable or material change.
- **Allowed-write behavior.** What Archie may draft, inspect, or write before a decision.
- **Deterministic assertions.** Markers and ordering a future runner or reviewer can check.
- **Human review rubric.** The bounded quality review for the case.

The five fixtures are hermetic except for the maintained capabilities named in their manifests. A later trial records the fixture prompt, Archie output, selected route, assertion result, reviewer score, and relevant host smoke evidence under that trial's workstream or evaluation record.

## Deterministic assertions

A future runner or reviewer checks the declared primary route, named evidence markers, uncertainty markers, developer-decision ordering, and permitted write behavior. These checks do not score whether architecture advice was wise.

## Human review rubric

A developer reviewer scores each advisory result on four questions:

1. Did Archie select the correct capability?
2. Does each material claim trace to the declared repository evidence?
3. Does it label uncertainty and inference accurately?
4. Does it give a useful next action?

Record one short rationale with the score. The developer owns that review. A passing deterministic check does not replace it.

## Adapter checks

Core fixtures test the portable behavior only. [The Pi smoke template](adapters/pi-smoke.md) separately tests installation, discovery, explicit invocation, and the confirmation or interception behavior that the adapter actually implements.

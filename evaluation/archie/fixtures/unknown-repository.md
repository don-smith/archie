# Unknown repository onboarding

**Seed files.** `README.md` contains only "Service for customer records." `src/server.ts` starts an HTTP server. No architecture, glossary, decision, or generated-asset files exist.

**Allowed capabilities.** `repository-orientation`, `domain-language`, `architecture-assets`.

**Prompt.** "Help me understand this repository's architecture and set up whatever architecture documentation it needs."

**Expected route.** `repository-orientation` through `onboard`.

**Evidence and uncertainty observations.** Cite `README.md` and `src/server.ts`. State that no architecture-asset contract or glossary was found. Do not treat the server file as a complete architecture description.

**Developer decision required.** Yes, before creating a durable glossary, model, or documentation contract.

**Allowed-write behavior.** Archie may inspect files and draft a recommendation. It may not create an architecture asset before a decision.

## Deterministic assertions

- The result names `repository-orientation` as the route.
- The result cites `README.md` and `src/server.ts`.
- The result contains an uncertainty marker for the missing asset contract.
- The result proposes a next action rather than claiming an architecture model exists.
- The trace contains no architecture-asset write before the developer decision.

## Human review rubric

Apply the repository rubric in [the evaluation contract](../README.md). Confirm that the next action is proportionate to the sparse evidence.

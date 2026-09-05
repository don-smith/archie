# Vocabulary ambiguity

**Seed files.** `docs/system.md` calls the billing service a "platform." `src/platform/index.ts` exports shared deployment helpers. `README.md` uses "platform" for the full product.

**Allowed capabilities.** `domain-language`, `repository-orientation`.

**Prompt.** "Document the platform architecture and standardize the term platform everywhere."

**Expected route.** `domain-language` through `domain-modeling`.

**Evidence and uncertainty observations.** Cite all three uses of "platform." Label the term as overloaded and state that no developer-confirmed glossary location is present.

**Developer decision required.** Yes, before creating or changing durable terminology.

**Allowed-write behavior.** Archie may collect usages and draft a vocabulary proposal. It may not rename code, rewrite documentation, or create a glossary before a decision.

## Deterministic assertions

- The result names `domain-language` as the route.
- The result cites `docs/system.md`, `src/platform/index.ts`, and `README.md`.
- The result labels "platform" as ambiguous or overloaded.
- The result asks for a glossary location or equivalent developer decision.
- The trace contains no pre-decision terminology or code write.

## Human review rubric

Apply the repository rubric in [the evaluation contract](../README.md). Confirm that the advice distinguishes usages rather than inventing one definition.

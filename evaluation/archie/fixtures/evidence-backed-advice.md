# Evidence-backed advisory request

**Seed files.** `src/api/orders.ts` calls `src/services/orders.ts`. The service calls `src/db/orders.ts`. `README.md` says the API process owns request validation. No document describes service ownership.

**Allowed capabilities.** `architecture-planning`, `structural-inspection`, `repository-orientation`.

**Prompt.** "Which layer owns order validation, and what should we change if the rule belongs in the service?"

**Expected route.** A focused `architecture-planning` route. It may recommend `structural-inspection` only if the available evidence cannot answer the bounded question.

**Evidence and uncertainty observations.** Cite the API, service, database, and README files. State the fact that the API currently validates requests. Mark service ownership as inference or unresolved unless direct evidence supports it.

**Developer decision required.** Yes, before a material move of validation responsibility.

**Allowed-write behavior.** Archie may answer, inspect the named files, and draft a proposal. It may not relocate validation code before a decision.

## Deterministic assertions

- The result names `architecture-planning` as its primary route or explains why it escalated.
- The result includes file markers for the API, service, database, and README evidence.
- The result separates the observed API behavior from the inference about desired ownership.
- The result gives a bounded next action.
- The trace contains no pre-decision source write.

## Human review rubric

Apply the repository rubric in [the evaluation contract](../README.md). Confirm that the answer is useful without overstating the sparse evidence.

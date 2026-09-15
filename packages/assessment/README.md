# @archie/assessment

This private workspace is Archie's canonical source for the `architecture-assessment` skill. The skill recovers a typed factual model before architecture judgment and keeps current code, intended architecture, inference, and unresolved gaps separate.

The deployed skill is self-contained under `skills/architecture-assessment/`. `packages/archie-context` is generated from that directory.

## Verify

```bash
npm test --workspace @archie/assessment
npm run check:model --workspace @archie/assessment
```

Controlled evaluation definitions, prompts, fixtures, and the runner live under `evaluation/`. Model campaigns require the `pi` executable and configured credentials. Unavailable models or credentials are recorded as gaps. The runner does not substitute models.

Assessment is read-only against product source. Factual correction and recommendation approval remain developer decisions.

## Public evidence contract

The package exports `readAssessmentEvidence` and `ASSESSMENT_EVIDENCE_V1` from its package root. The closed `assessment-evidence/v1` contract publishes completeness, evidence availability, factual correction, recommendation triage, and authority. Its schema is available at `@archie/assessment/schemas/assessment-evidence-v1.schema.json`.

A `ready` document must report complete scope, inventory, and model coverage, completed factual correction, and completed recommendation triage. `unavailable` and `unknown` evidence remain explicit non-ready outcomes. The contract does not approve recommendations or claim authorization.

# Producer contract handoff

Phase 5 froze the producer records that later Architecture Status and Architecture Docs work may read.

`@archie/assessment` published `assessment-evidence/v1`. It reports model completeness, evidence availability, factual correction, recommendation triage, and authority. `ready` means those gates are complete. `unavailable` and `unknown` evidence stay visible and cannot be interpreted as approval. Recommendation outcomes remain developer-owned.

`@archie/conformance` kept the parity-frozen `conformance-report/v1` and `onboarding-state/v1` artifacts. Its public consumer envelopes are `conformance-report-contract/v1` and `conformance-state-contract/v1`. They add report identity, result code meanings, evidence digests, freshness inputs, and state versions without changing the producer artifact bytes.

Conformance result codes are fixed: `0` pass, `1` blocking violation, `2` incomplete evidence, and `3` invalid input. Freshness is `fresh`, `stale`, `unavailable`, or `unknown`. A downstream consumer must preserve these meanings and must not convert missing or uncertain evidence into a pass.

The package roots export readers only. Validators, engines, storage, and renderers remain private. This handoff does not define adapters, status rendering, managed-site warnings, or documentation consumption.

# DELTA-001 — Legacy authorization wire vs public product identity

Owner: `packages/archie-runtime/src/release-record/release-record-v3.ts` (the release-record module).

Status: open

## Observed divergence

The v3 release record requires `authorization: {kind: 'none', claim: 'locally-reviewed-private-trial'}` — the `LOCAL_REVIEW_CLAIM` constant — as a wire value the closed validator enforces byte-for-byte. Archie's public identity is the `0.3.0` product hosted in a public repository with real-repository trial evidence, so the claim's private-trial wording no longer describes the product. The value is a legacy protocol literal, not review evidence; local byte verification still does not authorize a release, and the receipt keeps its authorization-not-assessed warning. The v3 schema and its exact serialization and parsing remain unchanged and are not part of this divergence.

## Closure check

Close only after a separately approved release-format decision that rewords or removes the field, together with backward-compatibility tests proving that previously persisted v3 pins and receipts remain selectable. No such format change is authorized in the current release workstream; the release-record module keeps this delta open until that decision lands.

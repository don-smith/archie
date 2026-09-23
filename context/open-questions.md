# Archie open questions

Unresolved design questions. No speculative requirements live here; each question names what accepting it would change, and an open question never claims shipped behavior.

## Design questions

- **ARCHIE-DQ01 Legacy authorization wire wording.** The v3 release record requires the wire value `authorization: {kind: 'none', claim: 'locally-reviewed-private-trial'}` even though Archie's public identity is the `0.3.0` product with a public repository. Whether a future release format should reword or remove the field is tracked as [DELTA-001](./.delta/DELTA-001-legacy-authorization-wire.md). No such format change is authorized today; accepting this question would start a separately approved release-format decision with backward-compatibility tests.

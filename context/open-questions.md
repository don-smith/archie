# Archie open questions

Unresolved design questions. No speculative requirements live here; each question names what accepting it would change, and an open question never claims shipped behavior.

## Design questions

- **ARCHIE-DQ01 Legacy authorization wire wording.** The v3 release record requires the wire value `authorization: {kind: 'none', claim: 'locally-reviewed-private-trial'}` even though Archie's public identity is the `0.3.0` product with a public repository. Whether a future release format should reword or remove the field is tracked as [DELTA-001](./.delta/DELTA-001-legacy-authorization-wire.md). No such format change is authorized today; accepting this question would start a separately approved release-format decision with backward-compatibility tests.
- **ARCHIE-DQ02 Host-platform analyzer packaging.** `@archie/runtime` pins `@typescript/typescript-darwin-arm64` as a plain dependency, so the install is wrong on Linux, x64, and Windows; the current contract supports exactly the Darwin arm64 analyzer environment, and broader analyzer support is deferred. Accepting this question would select how the runtime resolves the host-correct TypeScript native package (for example per-platform optional dependencies) and would require compatibility evidence for each added platform. Owner: the runtime analysis and release-install modules.

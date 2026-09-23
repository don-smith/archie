# Archie root requirements

**Role:** owns the product-level assumptions, trade-offs, and top-level requirements that every responsibility node refines. Subsystem contracts live in the nodes, not here.

## Context

This tree is the sole current settled-intent source for Archie maintenance; it is not installed into targets. Node directories own their contracts: `01-product/` (identity, capabilities, authority), `02-system/` (runtime, context projection, analyzer and producer/consumer evidence), `03-delivery/` (versioning, release records, verification, recovery), `04-docs/` (source precedence and derived guides).

## Assumptions

- **ARCHIE-A01 macOS and Linux are the development and use platforms.** Archie is developed and used on macOS and Linux; install requires Node 24, npm 11, Git, and APM 0.29.
- **ARCHIE-A02 One lockstep product.** Archie ships as one product: the root `package.json` version governs every workspace package and generated projection.
- **ARCHIE-A03 Private distribution.** Archie is not published to npm; installing repositories obtain the runtime and conformance artifacts and the APM-deployed skill context from a clone of this repository.
- **ARCHIE-A04 Local review authority.** Releases are reviewed locally; there is no signing, trusted-publisher authorization, or public-release trust mechanism.

## Acceptable trade-offs

- **ARCHIE-T01 Clone-based install over registry publication.** Installing from a clone lets every byte be read before it runs and needs no registry account; it costs a copy step and keeps distribution private.
- **ARCHIE-T02 Local review over external authorization.** The release record states that authorization was not assessed; the warning is retained rather than replaced with an invented claim.

## Requirements

- **ARCHIE-R01 The product is one lockstep identity.** Every workspace, lock, generated projection, fixture, and public claim uses the single root-version identity.
- **ARCHIE-R02 Capabilities are independently selectable and keep their own meaning.** The seven registered capabilities preserve their result meanings and authority stops; routing never merges them into one universal architecture verdict.
- **ARCHIE-R03 Durable or material changes stop for the developer.** Archie presents a decision packet before applying; the developer decides, and a confirmation mechanism in one host does not enforce the rule in another.
- **ARCHIE-R04 Claims are evidence-backed.** Facts supported by repository evidence are distinguished from inferences and unknowns; no repository contract is invented silently.
- **ARCHIE-R05 The root `context/` tree is the sole current settled-intent source.** It owns Archie-maintainer requirements, specifications, terminology, roadmap, open questions, decisions, and deltas.
- **ARCHIE-R06 The VRS tree is maintainer-only.** `context/` is a source-only module and is excluded from every package artifact and installed target projection.
- **ARCHIE-R07 Release identity is exact and local.** The release record pins the product version, source commit, artifact hashes, lock, and APM evidence; selection never resolves a release from the network.
- **ARCHIE-R08 Architecture assets are target-owned.** Targets own their architecture assets and asset contracts; Archie discovers them during onboarding and routes work to the owning capability, and the packaged managed-site Archie page is the sole narrow packaged exception.

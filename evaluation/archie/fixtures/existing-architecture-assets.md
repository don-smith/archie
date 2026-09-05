# Existing architecture-assets onboarding

**Seed files.** `docs/architecture/overview.md` says it is maintained by the platform team and generated from `architecture/model.c4`. `architecture/model.c4` contains a LikeC4 model. `scripts/render-architecture.sh` writes the generated page.

**Allowed capabilities.** `repository-orientation`, `architecture-assets`.

**Prompt.** "Onboard Archie and refresh the architecture docs so they match the repository."

**Expected route.** `repository-orientation` first, then `architecture-assets` through `architecture-docs` with `likec4-authoring` for the requested upkeep.

**Evidence and uncertainty observations.** Identify `architecture/model.c4` as source material, `docs/architecture/overview.md` as generated output, the platform team as maintainer, and `scripts/render-architecture.sh` as the generation path. Mark any unverified freshness claim as uncertainty.

**Developer decision required.** Follow the discovered asset contract. Require a decision for a material source-model or ownership change.

**Allowed-write behavior.** Archie may inspect and propose a refresh. It may not replace the model, generated-output arrangement, or maintainer contract without a decision.

## Deterministic assertions

- The result records source and generated ownership separately.
- The route names `architecture-assets` after orientation.
- The result cites the model, generated page, and render script.
- The result does not propose a replacement documentation system.
- A trace shows no source-model or ownership write before the required decision.

## Human review rubric

Apply the repository rubric in [the evaluation contract](../README.md). Confirm that the selected route preserves the existing contract.

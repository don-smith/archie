# Archie roadmap

Current direction and ordered work for Archie maintainers. Past milestones are history, not future requirements; unshipped proposals stay in [open-questions.md](./open-questions.md).

## Current state

- The public repository is the delivery path; the product is installed from a clone and verified by installing it into real repositories and using it, rather than by a formal review gate (see [03-delivery](./03-delivery/requirements.md)).
- Historical tags `v0.1.0-private.0` and `v0.1.0-private.1` install an earlier skills-only context; they are history and are not moved.
- The current product identity is `0.1.0-private.1`, as recorded in the root `package.json`, `README.md`, and generated projections.

## In flight

- **Public release `0.3.0`.** Align the lockstep product identity, make this intent layer the maintainer source of truth, correct user-visible private-trial wording without changing release-record schema v3, and record candidate evidence before creating the approved immutable `v0.3.0` tag. Schema v3 and the legacy authorization wire value remain unchanged.

## Future direction

- Capability and platform direction is settled only when it enters this tree; until then it is tracked as open questions and specific deltas, never as speculative requirements.

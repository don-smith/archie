# likec4-authoring pressure scenarios

These scenarios are process tests, not syntax snapshots. The RED record was captured before `skills/likec4-authoring/SKILL.md` existed.

## RED baseline

- **Context-first pressure:** Given a repository with a clear API and two workers, the unskilled response jumped directly to component diagrams and proposed one page per directory.
- **Missing-evidence pressure:** Given no deployment definition, the unskilled response invented a hosted deployment and called it confirmed.
- **Link/approval pressure:** Given a private repository with no known remote branch, the unskilled response guessed a GitHub URL and treated LikeC4 compilation as architectural approval.

Observed failure: no reliable context/container-first boundary, no explicit ambiguity question, and no distinction between syntax validation and maintainer truth.

## GREEN scenarios

The skill must require: context then containers; questions for ambiguous boundaries; source links only from evidence or explicit configuration; LikeC4 validation; focused deeper views tied to onboarding questions; and claim IDs returned to `architecture-docs`.

The expanded GREEN behavior also requires the agent to:

- read the C4 method before choosing levels or supporting views;
- distinguish systems, containers, components, actors, stores, and external systems;
- use concrete directional relationship labels and protocols where known;
- consult the LikeC4 reference before writing syntax, predicates, dynamic views, or deployment views;
- run the package entry point from the installed package rather than assuming target-project scripts exist; and
- run the diagram review checklist before handoff.

## Variation / REFACTOR evidence

- Missing evidence remains unresolved or `not-applicable` with a reason.
- Unresolved intent is returned as an assumption/question, never a fact.
- Optional deeper views are omitted when no onboarding question needs them.
- Invalid LikeC4 workspaces stop the handoff.
- An unavailable optional specialist is reported, never silently substituted.
- A target repository without application-level LikeC4 or Architecture Docs dependencies still invokes the command from its pinned `.archie/runtime`.

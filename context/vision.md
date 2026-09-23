# Archie vision

## Problem

Architecture decisions in real repositories drift: reviews fade, documentation goes stale, and dependency rules are rarely checked. Maintainers have no single, evidence-backed view of what their system is, why it is that way, and whether it still matches.

## Vision

Archie is an architecture agent for a code repository. It assesses a whole system, reviews one module in depth, maintains evidence-backed architecture documentation, checks dependency rules deterministically, and reports drift — delivered as one package of agent skills plus a pinned project-local runtime. Archie routes each request to the capability that owns it and stops for the developer's decision before anything durable changes: Archie proposes; the developer decides what becomes true.

## Non-goals

- Archie is not published to npm and is not registry-distributed, signed, or trusted-publisher-authorized; repositories install it from a clone of this repository.
- Archie is not a universal architecture authority. Findings are not an architecture pass, and observed code never becomes approved intent by itself.
- Archie does not impose an architecture-document format on target repositories.
- This `context/` tree is a maintainer-only intent layer; it is never installed into target repositories.

## Success criteria

- A maintainer or agent can answer "what is the settled intent for Archie's product, system, delivery, and documentation" from this tree alone, with the two deployed reference sources at their existing paths.
- Settled intent is source-backed, and open questions and deltas stay distinct from claims of shipped behavior.
- The tree's mechanical structure is enforced by a repository-local checker; semantic truth is reviewed by maintainers, not certified by machines.

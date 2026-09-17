# Architecture Review

Architecture Review is Archie's proactive-improvement capability. When there is no current work item but a module deserves attention, it reviews one bounded module, directory, or file top-down and layer by layer. It reads every file in scope, sweeps ten structural dimensions per layer, triages every finding with the developer, and produces a phased polish plan in `.archie/reviews/`. Accepted phases become work items in the repository's own tracker or planning flow. The review never edits source.

The skill lives in `skills/architecture-review/`. Its `references/deep-module-vocabulary.md` is generated from `docs/archie/deep-module-vocabulary.md` by `scripts/sync-context-skills.mjs`; edit the canonical document, not the copy.

This workspace was adapted from MyFlow's `skills/architecture-review` at commit `74965c241a5822479905057c0eecf77f49dc130d`. The review method is unchanged. MyFlow repository maps, shared metadata scripts, Pi's question tool, named subagents, and design/plan chaining were replaced with plain Git commands, host-neutral developer checkpoints, optional parallel analysis with a serial fallback, an Archie artifact location, and a work-item hand-off.

From the Archie repository root:

```bash
npm test --workspace @archie/architecture-review
```

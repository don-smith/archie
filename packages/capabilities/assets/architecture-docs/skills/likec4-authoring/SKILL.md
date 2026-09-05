---
name: likec4-authoring
description: Use when authoring or reviewing an evidence-backed LikeC4 architecture model for an unfamiliar repository, especially when deciding which C4 views and source links answer onboarding questions.
---

# LikeC4 authoring

Use this skill for C4 model authoring only. `architecture-docs` owns repository discovery, Markdown prose, claims approval, page maps, and publication.

**REQUIRED REFERENCES:** Read `c4-method.md` before choosing levels or views. Read `likec4-reference.md` before writing or editing LikeC4 syntax. Read `diagram-review-checklist.md` before handoff.

## Package setup

Resolve these paths before running commands:

- `TARGET_DIR`: the repository being documented.
- `SKILL_DIR`: the directory containing this `SKILL.md`.
- `PACKAGE_DIR`: two directories above `SKILL_DIR`.

The package command is:

```bash
node "$PACKAGE_DIR/bin/architecture-docs.mjs" <command> \
  --config "$TARGET_DIR/architecture-docs.config.json"
```

Do not run an unpinned global LikeC4 CLI when the package command can compile the workspace.

## Method

1. Accept the evidence inventory and claims-ledger path from `architecture-docs`. Do not invent evidence or silently promote an inference.
2. Identify the C4 mode: retro-document an existing repository, update an existing model, review a model, or design a model from maintainer-provided intent. For repository onboarding, use retro-documentation.
3. Read `c4-method.md` and choose the smallest view set that answers named onboarding questions. Context and containers come first.
4. Infer a candidate boundary and vocabulary from repository evidence, then ask the maintainer to confirm ambiguous actors, external systems, runtime units, technologies, and important flows.
5. Read `likec4-reference.md` for the exact syntax needed by the selected views. Author `specification`, `model`, and `views` blocks using LikeC4 only.
6. Add source links only for repository paths or explicit HTTP(S) sources supplied by evidence or configuration. Never guess a host, branch, source path, or architectural intent.
7. Add component, dynamic, deployment, code, or companion data views only when a named onboarding question needs deeper detail. Do not create one view per directory or file.
8. Compile and inspect the workspace through the package command:

   ```bash
   node "$PACKAGE_DIR/bin/architecture-docs.mjs" build \
     --config "$TARGET_DIR/architecture-docs.config.json"
   ```

9. Run `diagram-review-checklist.md`. Return the validated workspace, selected view IDs, source links, explicit assumptions, unresolved gaps, and claim IDs to `architecture-docs`.

## C4 rules that must survive authoring

- A context view contains actors, the documented system, and relevant external systems.
- A container is independently running or separately stored. It is not a directory, package, class, or arbitrary subsystem.
- A component is an important internal responsibility inside one container.
- Every material element has a responsibility description. Technologies are included only when supported by evidence or maintainer intent.
- Every relationship is directional and has a concrete intent label. Add a protocol or technology when known.
- Dynamic views describe one meaningful scenario in runtime order.
- Deployment views map logical containers to physical nodes; they do not create a second logical model.
- Assumptions and unresolved intent stay visible. Compiler success proves syntax, not architectural truth.

## Handoff boundary

Return:

- the validated LikeC4 workspace path;
- view IDs and the onboarding question answered by each view;
- claim IDs represented by material model statements;
- useful source links;
- explicit assumptions and unresolved gaps; and
- the compiler result.

Do not write Markdown pages, approve claims, choose the final page map, or publish generated HTML from this skill.

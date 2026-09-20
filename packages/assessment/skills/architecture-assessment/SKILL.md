---
name: architecture-assessment
description: Use when a developer needs an evidence-led, whole-system architecture explanation and assessment before redesign, alignment, or refactoring.
argument-hint: "[target] [--brief <file>] [--output <dir>]"
---

# Architecture assessment

Recover and assess a software system without changing product source. One typed fact index feeds every explanation and diagram. Validate that factual model before making architecture judgments.

Invocation:

```text
architecture-assessment [target] [--brief <file>] [--output <dir>]
```

`target` defaults to the Git root for a whole-system assessment. An optional brief supplies drivers, audience, scope, exclusions, scenarios, and linked intent sources. Without a brief, establish them with the developer at Checkpoint 1. `--output` chooses the assessment directory; otherwise use a repository instruction, then the default `.archie/assessments/<yyyymmdd>-<slug>/`.

## Required composition

**RELATED CAPABILITY: `architecture-review`.** Architecture Review inspects one bounded module layer by layer; Assessment explains and judges the whole system. Do not invoke `architecture-review` or nest its per-layer workflow. Reuse these shared invariants directly:

- enumerate the full approved scope;
- read every included production file;
- cite file-and-line evidence;
- persist work progressively;
- present findings for explicit developer triage;
- never edit assessed product source.

**REQUIRED REFERENCE: [the deep-module vocabulary](references/deep-module-vocabulary.md).** Read it when interfaces or seams are in scope. Use its terms exactly. A module hides implementation behind an interface at a seam. An adapter satisfies that interface where behavior varies. Judge depth by caller leverage and maintainer locality, not file size or interface line counts.

**CONDITIONAL GLOSSARY WORK.** Only when code and tracked language leave a same-name, synonym, homonym, or context translation unresolved, use a host glossary or domain-language skill if one is available; otherwise record the unresolved terms in the model. Do not create or update a repository glossary during factual recovery without an explicit developer checkpoint.

**REQUIRED SUB-SKILL: `html-design`.** Archie ships it beside this skill. Use it for `packet.html`. Read its profile, pattern, diagram, foundation, example, and quality guidance selected by the packet's content. Run `html-design/scripts/check-artifact.mjs <packet> --profile review-packet`. Without this skill and a passing check, the assessment cannot become `ready`.

The controlled evaluation exception is narrow. A fixed fixture prompt may provide approved drivers, scenarios, target, and `assessment/` output without a developer brief. During a controlled evaluation, do not search for or load `html-design`, omit `packet.html`, and do not run build or package commands in the target. Hash approved source before and after the run. Use an isolated copy if later verification needs those commands. Never use this exception for a product repository.

## Rehydrate and validate the input

1. Inspect repository-local instructions and the brief when one is supplied.
2. Read the intent, design, research, glossary, decision, and architecture sources the brief links or the repository tracks.
3. Read `git status --short`. Record applicable repository instructions and current Git state.
4. Establish drivers, audience, scope, exclusions, and expected-change or quality scenarios from the brief, or propose them for approval at Checkpoint 1. If the developer cannot supply drivers or the scope stays unclear, stop and state exactly what is missing. Do not invent an unindexed assessment.
5. Resolve the assessment directory (`--output`, then a repository instruction, then `.archie/assessments/<yyyymmdd>-<slug>/`). If the repository has not recorded whether `.archie/assessments/` is tracked or ignored, ask once and follow that decision. Create this bundle from the templates:

   ```text
   assessment/assessment.md
   assessment/architecture-model.json
   assessment/evidence/inventory.md
   assessment/evidence/flows.md
   assessment/evidence/evolution.md
   assessment/packet.html
   ```

   Here `assessment/` stands for the resolved assessment directory.

Read [the artifact contract](references/artifact-contract.md) before the first write.

## Checkpoint 1: approve scope and scenarios

Inventory manifests and lockfiles such as `Cargo.lock`, tracked intent, decisions, deployment files, source, tests, generated files, and relevant history. Propose:

- included and excluded paths with reasons;
- stakeholders and intended audience;
- architecture drivers;
- 3 to 7 concrete runtime, failure, recovery, deployment, or change scenarios.

Get developer approval before exhaustive recovery. A controlled prompt may explicitly preapprove this checkpoint.

Write every approved file to `architecture-model.json.scope.expectedFiles` and `inventory`. Classify excluded, generated, test, and documentation files instead of silently omitting them. Every included production file must end with `coverage: read`.

## Recover facts before judgment

Read [the fact model](references/fact-model.md), then work by runtime unit and responsibility.

1. Read every included production file in full. Use manifests and reference searches to verify consumers and dependency direction.
2. Record system context, people, external systems, runtime and deployment units, packages, crates, important modules, stores, and durable artifacts.
3. Type every significant relationship. Keep source dependency, call, command, event, data read, data write, data ownership, lifecycle, build, deploy, trust, and documented intent distinct.
4. Record each important interface with owner, consumers, inputs, outputs, invariants, errors, ordering, idempotency, consistency, timing, versioning, trust, adapters, and test seam.
5. Trace important startup, request, command, event, mutation, persistence, failure, recovery, and replication flows.
6. Record data authority, ownership, persistence, replication, and retention.
7. Record canonical terms, aliases, homonyms, code spellings, and context translations. Do not treat different bounded-context terms as defects without evidence of missing translation.
8. Record current and intended facts separately. A divergence needs both current code evidence and tracked intent or developer evidence.
9. Run each approved scenario and record its current response. For change scenarios, name additions, modifications, deletions, registration points, layers, languages, contracts, tests, documents, and owners.
10. Use relevant Git history only after filtering initial imports, generated changes, bulk formatting, migrations, and reorganizations. Co-change is association, not causality. Record confidence and history limits.

Write the inventory and model progressively after each runtime unit or cohesive file batch. Confirmed current facts require code or configuration evidence. Confirmed intended facts require tracked intent, a decision, or developer evidence. Label inferences and unresolved gaps. Never hide uncertainty in prose.

Run after each batch:

```text
node "$SKILL_DIR/scripts/check-model.mjs" <assessment-dir>/architecture-model.json
```

## Build focused factual views

Use the model to write concise, question-specific views:

- system context and external trust;
- runtime and deployment units;
- important module and source dependency direction;
- interfaces, seams, and adapters;
- selected runtime and data flows;
- data authority and ownership;
- current architecture;
- intended architecture and exact divergences;
- expected-change surfaces.

Every report claim and diagram uses `[model:<id>]` references. A diagram records its question, scope, abstraction level, relationship type, and model IDs before markup exists. Do not mix static dependency and runtime traffic on an unlabeled arrow.

## Checkpoint 2: correct recovered facts

Present the inventory, factual narrative, model, focused views, terms, flows, and unresolved gaps. Ask the developer to correct facts and approve the model for assessment. Persist corrections and set `factualCorrection.status` to `completed` with a concise summary, then rerun `check-model.mjs`.

Do not assess before factual correction. A controlled prompt may preapprove continuation only after the recovered model and checkpoint record have been persisted.

## Apply assessment lenses

Read [the assessment lenses](references/assessment-lenses.md). Select lenses supported by drivers and evidence. For each lens, record strengths and non-risks before candidate findings.

Assess:

- current alignment with tracked intent;
- dependency direction, real cycles, facade bypass, and typed edge semantics;
- module responsibility, depth, leverage, and locality;
- interface and cross-language type-contract completeness;
- data authority, consistency, and trust;
- sibling consistency and explainable variants;
- domain language and seam translations;
- expected-change surface and extension mechanisms;
- temporal coupling and owner coordination when history supports it;
- relevant runtime and operational qualities;
- existing enforcement and candidate architecture checks.

Do not call every two-way runtime interaction a source cycle. Events retain schema, semantic, ordering, delivery, and observability coupling. Central registries can improve discoverability and validation. Deletions and coordinated edits can be correct. Explain the observed cost and trade-off against the approved scenarios.

Each candidate finding includes:

- stable ID and title;
- code, configuration, intent, decision, or history evidence;
- affected driver and scenario;
- current impact and likely change cost;
- strengths or load-bearing decisions that a change must preserve;
- options and trade-offs;
- certainty and unresolved gaps;
- candidate architecture checks;
- documentation consequences.

Do not compute a universal architecture score.

## Synthesize and publish

Update `assessment.md` with separate current and intended views, load-bearing decisions, strengths, non-risks, candidate findings, trade-offs, and gaps. Keep exhaustive coverage and traces in `evidence/`.

Use `html-design` to build a self-contained review packet from the same model IDs. Choose diagrams by relationship type. Do not copy prose into decorative diagrams or invent a second design system.

If `html-design` is unavailable, keep the model and Markdown `in-progress`, omit `packet.html`, and add an actionable `html-unavailable` blocker. The bundle must not become `ready`.

Run:

```text
node "$SKILL_DIR/scripts/check-assessment.mjs" <assessment-dir>
```

The checker uses the `html-design` skill deployed beside this skill. Pass `--html-skill-dir <dir>` only when html-design is installed elsewhere.

## Checkpoint 3: triage recommendations

After factual validation and complete judgment, present each recommendation for the developer to accept, reject, or defer. Persist every item under `recommendations` with a stable `rec-` ID, title, outcome, reason, dependencies, and candidate checks. Never auto-accept a recommendation.

Assessment remains source-read-only. Never edit product source. Write only inside the resolved assessment directory until triage. If the repository tracks architecture documentation, prepare a separate documentation proposal containing only validated facts, accepted direction, decisions, and status.

Rerun both checkers after triage and packet updates. Mark the bundle `ready` only when factual correction is completed, no recommendation remains pending, no blockers remain, the Markdown and model status agree, every reference resolves, and the HTML check passes.

## Handoff

Read [the artifact contract](references/artifact-contract.md) for status and publication rules. The ready assessment is evidence for the developer's own planning. Offer accepted recommendations as proposed work items for the repository's tracker or planning flow rather than implementing them here. With developer approval, route validated facts to `architecture-docs` and accepted measurable rules to `architecture-contracts`.

Read [the evaluation guide](references/evaluation.md) only when maintaining this skill, its fixtures, runner, or model matrix.

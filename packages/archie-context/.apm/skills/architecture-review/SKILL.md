---
name: architecture-review
description: Use when there is no current work item but a module deserves a structural review - before a release, after a major refactor, or when it has grown enough to warrant an audit. Reviews one bounded module, directory, or file top-down and layer by layer, reads every file in scope, triages each finding with the developer, and produces a phased polish plan that becomes work items. Language-agnostic. Never edits source.
argument-hint: "[target path: file, directory, or module] [--output <file>]"
---

# Architecture Review

Review one bounded target layer by layer and produce a single living artifact: every triaged finding plus a phased polish plan. The artifact is the product. Accepted phases become work items in the repository's own tracker or planning flow; this skill never implements them and never edits source.

Invocation:

```text
architecture-review [target] [--output <file>]
```

Architecture Review answers "what should we fix in this module?". It differs from the related Archie capabilities: `architecture-assessment` explains and judges a whole system against its drivers, `architecture-contracts` enforces accepted rules, and `architecture-docs` records accepted architecture knowledge. Route to one of those when the request is really theirs.

## Developer checkpoints

Every decision point in this skill is a **structured developer checkpoint**: a single question with a short header and concrete, mutually exclusive options, where the developer can always answer in their own words instead. Use the host's structured question tool when one is available. Otherwise, ask in conversation with the same numbered options and wait for the answer. Never replace a checkpoint with an open "what do you think?" prompt, and never proceed on an assumed answer.

## Parallel analysis

Some steps benefit from parallel analysis, such as mapping files to responsibilities, finding the dependency direction, or explaining a large file's call graph. When the host supports subagents, you may delegate those tasks, giving each one the complete context including the target path, and wait for every delegate before continuing. Without subagents, do the same analysis yourself, serially. The review's rules are identical either way.

## Metadata

Capture metadata with plain commands from the repository root. Copy the values verbatim.

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
git rev-parse --show-toplevel
git branch --show-current
git rev-parse --short HEAD
git config user.name
```

Use the top-level directory's name as the repository name. When `git config user.name` is empty, record the author as `unknown`.

## Flow

1. Identify the target → 2. Plan the layer structure → 3. Layer-split checkpoint → 4. Skeleton artifact → 5. Per-layer review (loop) → 6. Capture emergent principles → 7. Synthesize cross-cutting themes → 8. Phased polish plan → 9. Present and hand off → 10. Follow-ups

## Steps

### Step 1: Identify the target

1. **Argument is empty:** run a checkpoint. Question: "What are we reviewing?". Header: "Target". Options: "Single module" (one package, project, crate, or namespace directory); "Single subdirectory" (a subtree inside a module); "Single file" (a deep review of one large file); "Other" (the developer gives a path).

2. **Validate that the target exists** by listing the resolved path. If it is missing, ask for a corrected path.

3. **Capture target context:**
   - Read repository-local instructions (for example `AGENTS.md`, `CLAUDE.md`, or contributing guides) and follow their policy for artifacts and review. Use any glossary, decision records, or architecture documentation they name instead of assuming conventional paths.
   - Read the target's manifest if one exists (`package.json`, `pom.xml`, `*.csproj`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `build.gradle[.kts]`, `mix.exs`). The manifest names public exports, dependencies, and the ecosystem.
   - Read any `README.md` or architecture document at the target root.
   - For a single file, read it fully.
   - Enumerate every source file in scope, filtering by the extensions visible at the target root. Record the total file count and a rough line count.

### Step 2: Plan the layer structure

Layers mirror dependency direction. Higher layers consume lower-layer vocabulary, so the review walks from the public surface inward.

1. **Categorize each in-scope file by responsibility.** Typical role buckets:
   - public surface, facade, or entry point (the file users import)
   - type vocabulary and shared types
   - authoring DSL or public API
   - command, dispatch, or UI surface
   - configuration and loaders
   - validation
   - orchestration and runtime
   - sessions and I/O lifecycle
   - persistence and on-disk format
   - cross-cutting utilities

2. **For complex targets, analyze in parallel** (see Parallel analysis):
   - Map every source file in the target to one responsibility bucket and return a file → responsibility table.
   - Identify the import or use-graph dependency direction: which files are leaves, which are hubs, and a topologically ordered list from leaves to hubs.

3. **Synthesize a layer proposal:**
   - Group by responsibility, not file count. A layer can be one file (a barrel) or more than a hundred (an enterprise data access layer).
   - Order top-down by review direction: the entry point is Layer 0, the deepest concern is Layer N. The entry point is whatever a request hits first: a library barrel, an MVC controller, `lib.rs`, or `__init__.py`.
   - **Layers with more than about ten files get sub-layers** (3.1, 3.2, and so on), grouped by file-name cohesion. For example, a .NET data layer might split into 3.1 `DbContext` and migrations, 3.2 entities and value objects, 3.3 entity configurations, 3.4 repositories, and 3.5 specifications.
   - Aim for 3 to 10 top-level layers, with each sub-layer reviewable in one Step 5 pass.
   - Flag files that fit no bucket as cross-cutting utility candidates.

### Step 3: Layer-split checkpoint

1. **Surface the proposal.** Question: "Proposed split: {N} top-level layers, {file count} files. L0 — {names or count}; L1 — ...; {sub-layers if any}. Approve?". Header: "Layers". Options: "Approve (Recommended)"; "Adjust split" (reorder, merge, or split); "Reduce scope" (drop layers, for example to review one bounded context of a monolith at a time); "Specify manually".

2. **Loop until approved.** Adjustments return to Step 2.3 and then back here.

### Step 4: Create the skeleton artifact

1. **Read [the review template](templates/architecture-review.md)** in full.

2. **Resolve the artifact path**, in order: `--output`, then a repository instruction, then `.archie/reviews/<yyyymmdd>-<topic>.md`, where `<topic>` is a brief kebab-case description of the target. If the repository has not recorded whether `.archie/reviews/` is tracked or ignored, ask once with a checkpoint and follow that decision.

3. **Fill the metadata** from the Metadata commands: `repository`, `branch`, `commit`, `author`, and `date` and `last_updated` (the same UTC timestamp).

4. **Write the skeleton** with `status: in-progress` in the frontmatter. Sections:
   - **Frontmatter:** date, author, commit, branch, repository, target, target_kind, layer_count, `phases` (derived from the `### Phase N — name` headings; see Step 8), unresolved_finding_count, status, tags, last_updated, last_updated_by.
   - **Conventions:** the finding shape (ID, Evidence, Current state, Desired state, Proposed improvement, Severity, Effort, Blast radius, Class, Status, Depends on, Cross-cut tag).
   - **Methodology principles:** a placeholder (`_principles emerge during Step 5 triage and are captured at Step 6_`).
   - **Layers:** one empty `## Layer N — {name}` heading per layer from Step 3.
   - **Cross-cutting themes:** a placeholder (`_written last, after all layers have been seen_`).
   - **Consolidated polish plan:** a placeholder (`_phases assembled after Step 7 cross-cut synthesis_`).

5. **Every later write is an in-place edit.** Never rewrite the whole file: the artifact is the durable checkpoint between sessions.

### Step 5: Per-layer review (loop)

**For each layer and sub-layer, in order (L0, L0.1, L0.2, L1, L1.1, ...)**, run the five sub-steps below. The `## Layer N` section fills progressively, and the tally at the end of each layer is the visible progress marker.

#### 5.1. Read files

1. **Batch a large layer.** When a layer was not split into sub-layers at Step 3 and holds more than about ten files, propose batches by file-name cohesion (for example all `*Repository.cs`, all `*Configuration.cs`, `DbContext.cs` with migrations, and entities). Checkpoint question: "Layer {N}: {count} files. Batches: {B1 — count}; {B2 — count}; .... Approve?". Header: "Layer {N} batches". Options: "Approve"; "Adjust batches"; "Promote to sub-layers" (each batch becomes L{N}.{x} with its own tally).

2. **Read every file fully**: the whole layer when unbatched, or the current batch.

3. **Resolve non-obvious call graphs.** For any file whose structure is unclear from one read, enumerate its public symbols, functions or methods, and call sites, and highlight outsized functions (see Parallel analysis).

4. **Verify external consumers** with the ecosystem's reference search (`rg "from \"<module>\""`, `grep -r "import <pkg>"`, `grep -r "using <namespace>"`, `rg "use <crate>::"`). Keep the counts; they feed the wise-decision lens at triage.

5. **Iterate over batches.** After 5.2 to 5.5 close for the current batch, return to step 2 for the next batch.

#### 5.2. Dimension sweep

1. **Walk ten dimensions** across every file in the layer. Hold candidate findings; do not triage yet. Use the terms from [the deep-module vocabulary](references/deep-module-vocabulary.md) for boundaries, public surfaces, depth, and seams.
   - **Boundary**: what does the layer own? Does anything leak up or down?
   - **Public surface**: exported or public names, types, and ergonomics. Do siblings reach past the facade? Audit consumer counts per symbol.
   - **Coherence and single responsibility**: does each file and function or method do one thing?
   - **Granularity**: are functions or methods too big or too small? Are there god parameter lists? Is the code over- or under-decomposed?
   - **Programming by intention**: does each file read top-down as a story? Are named operations preferred over inline blocks, with helpers below their entry points?
   - **DRY**: is a pattern duplicated within the layer or across siblings?
   - **Domain language**: is the domain vocabulary consistent? Do legacy names linger?
   - **Naming**: are file, type, function, and constant names clear, and symmetric where the concept is symmetric?
   - **Error and fail-soft posture**: is it uniform across the layer? Do multi-state returns use the language's idiomatic discriminated form?
   - **Module-graph hygiene**: no cycles, and type-only back-references only where the language supports them.

2. **Produce a candidate findings list** (typically 6 to 14 per layer). Each candidate carries: ID (`L<layer>-<seq>`), Evidence (`file:line` plus a short quote), Current state, Desired state, Proposed improvement, Severity (Low, Med, High), Effort (S, M, L), Blast radius (internal, public-API, on-disk, cross-module), and Class (polish or redesign).

#### 5.3. Triage each candidate

1. **Present each candidate as a checkpoint.** Question: "L{X}-{YY} — {headline}. Evidence: `file:line` ({short quote}). Current: {one sentence}. Desired: {one sentence}. Pick a triage outcome.". Header: "L{X}-{YY}". Options: "{Concrete option A — action}"; "{Concrete option B — action}"; "Defer" (post-release).

2. **Batch independent candidates.** Present 2 to 4 at once when their answers do not depend on each other. Present them one at a time when they do, or when the blast radius is `public-API` or `cross-module`.

3. **Author options that force the right calls:**
   - **Deletion candidates with zero current consumers:** always offer "Keep as composition primitive" or "Keep as type-narrowing idiom" beside the drop option. The developer judges abstraction value, not the skill.
   - **Multi-state return candidates** (property-presence discrimination, partially tagged shapes, null as a state, exceptions as a state): offer "Convert to {the target language's discriminated form}". TypeScript: `{ kind: "ok" } | { kind: "err" }`. Java 17+: a sealed interface with records. .NET 9+: records with pattern matching. Rust: an `enum`. Kotlin: a sealed class. Python 3.10+: a matched `Union`. Go: a tagged struct with a type switch.
   - **File-size candidates** (more than about 200 lines for TypeScript, Rust, or Go; 300 for Python or Kotlin; 400 for C#; 500 for Java): offer "Split into a `<layer>/` directory with one concern per file", with the proposed decomposition inline.

#### 5.4. Persist each triaged finding

1. **Edit the `## Layer N` section** as soon as the developer picks an outcome, appending the finding's full block.

2. **Set the status verbatim** from the chosen option: `**accepted** — {summary}`, `**rejected** — {reason}`, `**deferred** — post-release`, or `**accepted (absorbed into LX-YY)**` when the change rides with another finding.

3. **Maintain the counter.** Increment `unresolved_finding_count` when filing a candidate in 5.2, and decrement it on each triage outcome. It must reach zero before Step 6.

#### 5.5. Tally

1. **Append a tally table** at the end of each layer pass, or each batch within a layer:

   ```markdown
   ### Layer N — tally

   | Status | Count |
   |---|---|
   | accepted | {A} |
   | rejected | {R} |
   | deferred | {D} |
   | withdrawn | {W} |

   Cross-cutting tags introduced: {list}. Reused: {list}.
   Dependency edges within Layer N: {bullets, for example "L1-04 depends on L1-02"}.
   ```

2. **Roll up batched layers.** Prefix per-batch tallies with the batch ID (`### Layer 3 — batch 3.2 (Repositories) — tally`). After all batches close, append a `### Layer 3 — roll-up` table summing the counts.

### Step 6: Capture emergent methodology principles

1. **Identify candidates.** A principle usually surfaces when the developer reverses an earlier finding with a generalizable reason, picks the same kind of option across several independent triages, or states a rule that should guide future reviews.

2. **Ask explicitly.** Question: "Across {F} findings, did any methodology principle emerge during triage that should be named?". Header: "Methodology". Options: "No new principle" (recommended if none was stated; proceed to theme synthesis); "Capture one principle" (the developer describes it and the skill drafts an M{N} block); "Capture multiple" (one at a time).

3. **Record captured principles** in the artifact's Methodology principles section:

   ```markdown
   ### M{N} — {principle name}

   **Origin:** {finding ID and a one-sentence quote of the developer's reasoning, if available}.

   **Rule.** {One paragraph: what to do, why, and when to apply it.}

   **Apply to (keep):** {bullet list.}
   **Apply to (drop / change):** {bullet list.}
   ```

### Step 7: Synthesize cross-cutting themes

1. **Group findings by cross-cut tag** across all layers. Each tag becomes a theme.

2. **Write one section per theme** under `## Cross-cutting themes`:

   ```markdown
   ### T{N} — {theme name} ({active | closed by L{X}-{YY}})

   **Findings:** {comma-separated finding IDs}.

   {One paragraph: what unifies these findings, what the theme delivers when implemented, and the closing finding, if any.}
   ```

3. **Confirm the grouping.** Question: "{N} cross-cutting themes: {T1 — name; T2 — name; ...}. Approve grouping or adjust?". Header: "Themes". Options: "Approve grouping (Recommended)"; "Merge themes" (the developer names which); "Split a theme" (the developer names which); "Other".

### Step 8: Consolidated polish plan

Each phase should be able to become one work item in the repository's tracker or planning flow. Size phases by signals that planning and implementation can act on (file count, finding count, blast-radius mix, coordination need), not by human-day estimates.

1. **Topologically sort findings** by their `Depends on` edges. Findings without dependencies land in early phases.

2. **Group by leverage:**
   - **Foundation** (no dependencies, low risk): small renames, new utility files, documentation fixes.
   - **Vocabulary**: type and file renames.
   - **Locality**: moving strings, constants, or types to their proper homes (one phase per locality theme).
   - **Structural**: file splits and directory restructures (one phase per layer's directory split).
   - **Behavioural**: shape conversions, dispatcher introductions, pipeline redesigns.
   - **Public-API**: additive surface changes that need downstream coordination.

3. **Describe each phase by these signals:**
   - **Findings:** count and ID list.
   - **Files touched:** count and repository-relative paths.
   - **Blast-radius mix:** breakdown across `internal`, `public-API`, `on-disk`, and `cross-module`.
   - **Coordination:** `none`, `sibling-package change required`, or `downstream consumer release required`.
   - **Class mix:** the ratio of `polish` to `redesign` findings.

4. **Flag risk** for phases that touch on-disk formats or public-API shape, or that need cross-module coordination (sibling packages, downstream artifacts, dependent crates).

5. **Draw the phase dependency graph** in ASCII at the end of the plan section:

   ```text
   Phase 1 (Foundation)
      ↓
   Phase 2 (Vocabulary)
      ↓
      ├──► Phase 3 (Locality)
      └──► Phase 4 (Structural)
                 ↓
       Phase 5 (Behavioural)
                 ↓
       Phase 6 (Public-API)
   ```

6. **Confirm the plan and flip the status.** Question: "{N} phases ({F} findings across {Files} files). Approve or adjust?". Header: "Plan". Options:
   - "Approve (Recommended)". Rebuild the `phases:` frontmatter array from the `### Phase N — name` headings, one `{ n, title, depends_on, blast_radius, effort }` entry per heading in body order:
     - `depends_on`: earlier phases only, from the dependency graph.
     - `blast_radius`: the phase's widest of `internal`, `public-API`, `on-disk`, and `cross-module`.
     - `effort`: `S`, `M`, or `L`.

     For example: `phases: [{ n: 1, title: Foundation, depends_on: [], blast_radius: internal, effort: S }, { n: 2, title: Vocabulary, depends_on: [1], blast_radius: internal, effort: M }]`. Then change `status: in-progress` to `status: ready` and continue to Step 9.
   - "Adjust phase boundaries" (describe).
   - "Resequence phases" (describe).
   - "Other".

### Step 9: Present and hand off

1. **Display the completion summary:**

   ```text
   Architecture review written to:
   <artifact path>

   {F} findings reviewed: {A} accepted, {R} rejected, {D} deferred, {W} withdrawn.
   {P} methodology principles captured, {T} cross-cutting themes, {N} phases across {Files} files.
   ```

2. **Offer the hand-off as a proposal.** Propose each accepted phase as a work item for the repository's tracker or planning flow, in dependency order, with the phase's findings, files, blast radius, and risks. Create or file nothing without the developer's approval. Implementation happens later, one phase at a time, in the repository's normal workflow; this skill does not start it.

3. **Route related work, only with approval:** an accepted rule that can be checked mechanically goes to `architecture-contracts`, and validated architecture knowledge worth recording goes to `architecture-docs`.

### Step 10: Handle follow-ups

1. **Append; never rewrite.** Add a `## Follow-up review {ISO 8601 timestamp}` section and leave earlier content unchanged.

2. **Update the frontmatter:** `last_updated`, `last_updated_by`, and `last_updated_note: "Updated <brief description>"`.

3. **Start a fresh review instead** when the target has materially changed (new files or restructured layers).

## Guidelines

1. **Be structured.** Every decision is a developer checkpoint with concrete options. The developer answers and the skill records.
2. **Be grounded.** Every finding cites `file:line` and a short quote, and triage questions embed that evidence verbatim. A candidate that cannot be grounded in code is not a finding.
3. **Be top-down.** Walk the facade or entry point first (Layer 0) and persistence last. Fixing the runtime before the public surface would invert the dependency direction.
4. **Be cumulative.** Each layer's tally and each finding's cross-cut tag feed the Step 7 synthesis. Never skip the tally.
5. **Be linear.** Findings depend on each other. Topologically sort them before phasing: a rename lands before the directory split that uses the new name.
6. **Respect the wise-decision lens.** When a candidate proposes dropping a symbol with no current consumers, deletion is one option, never the only one. The developer judges abstraction value.

## Critical rules

- Read every in-scope file fully in Step 5.1. Partial reads bias findings toward whatever happened to load.
- Confirm the layer split (Step 3) before creating the artifact (Step 4).
- Read every file in a layer (5.1) before producing its candidate findings (5.2).
- Triage every candidate at a checkpoint (5.3). Never auto-accept a finding, even when the answer seems obvious.
- Edit the artifact immediately after each triage outcome (5.4). Never queue accepted findings for one write at the end of a layer.
- Run methodology capture (Step 6) before theme synthesis (Step 7), because a principle named in Step 6 informs theme labels.
- Never edit source files during the review. The artifact is the product; implementation flows through the repository's own work items (Step 9).
- Methodology emerges from triage, never from a pre-built list. Record a principle inline when it first surfaces, then format it at Step 6.
- Always include frontmatter, use snake_case for multi-word fields, and keep tags relevant.
- Keep `status: in-progress` through Steps 1 to 7; it changes to `ready` only at the Step 8 confirmation.

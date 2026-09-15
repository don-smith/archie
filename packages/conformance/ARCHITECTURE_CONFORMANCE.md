# Architecture conformance

Status: project charter

## Purpose

Architecture Conformance will help teams define, test, and evolve the intentional architecture of a software system.

The project will turn architectural decisions into executable contracts and fitness functions. Deterministic tools will compare those contracts with evidence extracted from a repository, report drift, and make architectural change explicit. Given the same commit, configuration, analyzer versions, and contract, the tools should produce the same normalized graph and conformance result.

The project is intended for continuous use. It should be useful when first opening an unfamiliar repository, while improving an established system, during feature development, and in CI after the architecture has become well understood.

## Motivation

Software architecture often exists as a mixture of code structure, deployment configuration, diagrams, documentation, conventions, and knowledge held by maintainers. These sources rarely remain aligned without deliberate work.

Readable architecture documentation helps a team orient itself, but orientation is only the beginning. Once the architecture can be seen and navigated, it becomes possible to discuss responsibility, coupling, dependency direction, seams, patterns, data ownership, integrations, and runtime behavior. That conversation leads to architectural decisions and refactoring. The resulting intent then needs executable protection.

This creates a continuing cycle:

```text
Assessment -> Model -> View -> Conversation -> Change
     ^                                          |
     |                                          v
     +--------------- Validation <--------------+
```

The stages have distinct purposes:

1. **Assessment** gathers evidence about the current implementation, deployment, dependencies, data, integrations, and established decisions.
2. **Model** organizes that evidence into stable architectural concepts and relationships.
3. **View** makes the architecture navigable and understandable at useful levels of detail.
4. **Conversation** allows maintainers to challenge what exists, resolve ambiguity, identify unhealthy dependencies, and state what should be preserved or changed.
5. **Change** improves the implementation, model, or architectural intent.
6. **Validation** tests whether the implementation conforms to approved intent and whether the model still reflects the implementation.

Validation feeds the next assessment. The architecture can therefore change without becoming accidental.

## Architectural fitness functions

The project adopts the term **architectural fitness function** from *Building Evolutionary Architectures*. A fitness function evaluates how closely a system satisfies an architectural objective.

Architecture conformance rules are one class of fitness function. Examples include:

- domain modules must not depend on infrastructure modules;
- adapters must not depend on other adapters;
- a data store may be accessed only by its declared owner;
- an external system may be called only through a named adapter;
- modules within a bounded context must remain acyclic;
- events may be published and consumed only by declared participants;
- callers must cross a seam through its declared interface;
- independently deployed units must appear in deployment configuration;
- no production module may remain outside the architecture classification.

Other fitness functions concern performance, resilience, security, observability, recoverability, and operational behavior. The project should leave room for those checks while distinguishing them from static conformance.

An LLM may help discover architecture, draft contracts, or explain diagnostics. It must not decide whether a conformance check passes. CI results must come from deterministic code and explicit evidence.

## Core position

A readable architecture model and an executable architecture contract are related, but they are not the same artifact.

A C4 model can identify important systems, containers, components, responsibilities, relationships, and flows. It does not by itself state the complete enforcement semantics of each relationship. For example, a relationship from an application API to a database could mean any of the following:

- the dependency exists;
- the dependency is required;
- the dependency is allowed;
- only that API may access the database;
- access must pass through a particular repository interface;
- all other database access is forbidden.

The executable contract must remove that ambiguity.

The model should remain optimized for architectural understanding. A companion contract should reference stable model element IDs and express realization and enforcement details without turning the visual model into a source-code analysis language.

## The four core artifacts

Architecture Conformance will keep four concepts separate.

| Artifact | Responsibility |
|---|---|
| Approved architecture model | Human-readable architectural concepts, responsibilities, relationships, and flows |
| Realization map | Deterministic mapping between model IDs and source, package, class, interface, manifest, endpoint, event, data, or infrastructure evidence |
| Architecture contract | Approved assertions, enforcement modes, scope, severity, and temporary exceptions |
| Observed architecture graph | Facts extracted from a specific repository commit by pinned analyzers |

The conformance engine compares the observed graph with the architecture contract. It reports results in terms of model elements and source evidence.

### Approved architecture model

The model may contain both observed facts and maintainer-provided intent, provided their provenance and status remain explicit. It is the shared language for assessment and conversation.

The model must not silently turn observed structure into desired architecture. Existing dependencies may be accidental. Likewise, maintainer intent may describe a target that the code does not yet satisfy.

### Realization map

The realization map connects stable architectural identity with implementation details that may move over time. It can classify code through:

- package, namespace, or path selectors;
- module manifests and exported interfaces;
- class, type, or symbol selectors;
- inheritance or interface implementation;
- annotations or explicit architecture tags;
- API and event definitions;
- deployment and infrastructure resources;
- data schemas and migration ownership.

Every mapping must be testable. Ambiguous, empty, duplicate, and stale mappings are diagnostics rather than silent omissions.

### Architecture contract

The contract is normative. It records the architectural constraints that maintainers have chosen to preserve or move toward.

Each rule should have:

- a stable ID and plain-language intent;
- the model elements or realization selectors it applies to;
- a precise assertion type;
- an enforcement state such as proposed, active, or deprecated;
- severity and CI behavior;
- provenance and approval information;
- evidence produced on failure;
- any approved exceptions;
- links to related architectural claims or decisions.

Observed facts can suggest a rule, but they do not become normative until a maintainer approves the intent.

### Observed architecture graph

Analyzers convert repository evidence into a language-neutral graph. The graph should represent nodes and typed edges with source locations and analyzer provenance.

Possible node types include:

- repository and package;
- module and namespace;
- class, type, function, and interface;
- runtime process and deployable unit;
- endpoint and external system;
- event, command, and subscriber;
- database, schema, queue, and topic;
- deployment node and infrastructure resource.

Possible edge types include:

- imports or depends on;
- calls or implements;
- publishes or subscribes;
- reads or writes;
- exposes or invokes;
- deploys to;
- owns;
- realizes a model element.

The graph format should be stable and serializable so analyzers, rules, reports, and visual consumers can evolve independently.

## Conformance semantics

The first rule set should focus on structural properties that can be evaluated reliably:

- allowed dependency;
- forbidden dependency;
- required dependency;
- access only through a named interface;
- permitted dependents;
- layering and dependency direction;
- absence of cycles;
- module independence;
- ownership of data and infrastructure;
- declared event publishers and consumers;
- required realization of model elements;
- no unexplained model-level relationships;
- no unclassified code within declared scope.

Rules must state whether they use open-world or closed-world semantics.

An open-world rule asserts what is known without assuming that every unmentioned relationship is forbidden. A closed-world rule treats the declared set as complete. This distinction is necessary for useful incremental adoption and strict CI enforcement.

## Three forms of drift

The validator must report three different problems.

### Implementation drift

The implementation violates approved architectural intent. Examples include a domain package importing persistence code or a new service calling a database it does not own.

### Documentation drift

The implementation contains an intentional architectural change that the approved model does not describe, or the model still describes a realization that no longer exists.

### Coverage drift

The repository has code or relationships that the analyzers did not classify. This is the most dangerous failure mode because incomplete analysis can create a false passing result.

Strict conformance should fail on unexplained nodes, edges, analyzer failures, and scope gaps. Reports must include coverage measures alongside rule results.

## Determinism and trust

A conformance result is trustworthy only if its inputs and coverage are visible.

Every report should identify:

- repository and commit;
- architecture model digest;
- contract digest;
- realization-map digest;
- analyzer names, versions, and configuration digests;
- normalized observed-graph digest;
- analyzed and excluded paths;
- mapped and unmapped nodes;
- classified and unclassified edges;
- passed, failed, waived, and unevaluated rules;
- source locations for every violation.

The command-line tool must use meaningful exit codes and machine-readable output. A passing result with incomplete mandatory analysis must be impossible.

Regular-expression scans may support limited discovery, but production analyzers should prefer compiler, parser, bytecode, or language-server information when available. The tool must state the precision and limitations of each analyzer.

## Static, behavioral, deployment, and operational checks

The project should label each fitness function by evaluation method.

### Static conformance

Static checks inspect source, compiled code, schemas, manifests, and infrastructure definitions. Given pinned inputs, they should be reproducible.

### Contract and integration tests

These checks validate interface behavior, event compatibility, runtime ordering, failure handling, and integration assumptions that static analysis cannot prove.

### Deployment conformance

These checks inspect deployment manifests and infrastructure state. They can verify runtime units, placement, isolation, resource ownership, and required policy configuration.

### Operational fitness

These checks evaluate recorded measurements such as latency, recovery time, error budgets, or logging coverage. The evaluation can be deterministic for a fixed dataset, although the measured system behavior varies over time.

Reports must not present one method as proof of a property it cannot observe. A static import graph cannot prove runtime resilience, and a production trace cannot prove that an unobserved dependency is impossible.

## Code conventions and explicit tags

The realization map should use existing structural conventions before requiring code changes. Packages, namespaces, manifests, exports, schemas, and deployment resources often provide enough information.

Explicit architecture tags are appropriate when architectural identity cannot be inferred safely. Tags may identify concepts such as event handlers, aggregate roots, privileged adapters, module interfaces, or data owners.

Tags are architectural claims and must themselves be validated:

- every tag references an existing stable model ID;
- every required tagged role has a realization;
- incompatible roles cannot be assigned to the same element;
- retired IDs cannot remain in source;
- tags cannot exempt surrounding code from classification;
- moved or renamed implementations cannot leave stale mappings.

The project should avoid framework-specific annotations in its core format. Language adapters may translate native annotations or metadata into the normalized graph.

## Adoption in an existing repository

Many repositories will begin with no architecture contract and with known structural problems. The tool must support improvement without treating the existing implementation as ideal or forcing an all-at-once cleanup.

A typical onboarding sequence is:

1. Inventory existing documentation, decisions, source structure, runtime entry points, deployment, persistence, events, integrations, and representative tests.
2. Run deterministic analyzers to create an initial observed graph.
3. Build and review an evidence-backed architecture model.
4. Use the visual model to discuss responsibilities, seams, coupling, patterns, and accidental dependencies.
5. Record approved architectural intent.
6. Create the realization map and initial contracts.
7. Run the first conformance report.
8. Fix high-value violations or record specific temporary exceptions.
9. Enable changed-code checks and full CI checks.
10. Tighten coverage and rules as the architecture improves.

This resembles introducing tests to an untested codebase. The first useful test may expose an existing failure. The team can then repair the code or record the discrepancy explicitly, while preventing new violations.

Existing violations must not disappear behind broad ignore patterns. A temporary exception should identify the exact rule and evidence fingerprint, explain why it exists, name an owner where available, and define an expiry date or removal condition. Changes to the affected dependency should invalidate the exception and require review.

## Contract and architecture change over time

Contract evolution is part of the product, not an administrative detail.

The system should preserve enough information to answer:

- what architecture was approved for a given commit or release;
- which rules were added, changed, deprecated, or removed;
- which model elements and realizations changed;
- which observed nodes and edges appeared or disappeared;
- which violations are new, fixed, unchanged, waived, or reintroduced;
- whether documentation and conformance results use the same inputs.

A material intentional change should follow this sequence:

1. Propose the changed architectural intent.
2. Update affected claims, model elements, and contracts.
3. Review and approve the architectural change.
4. Implement or refactor the code.
5. Run conformance checks.
6. Rebuild architecture documentation and visual handoffs.
7. Record the model, contract, observed-graph, and report digests together.

The workflow may support either contract-first change or baseline-first onboarding. It must always distinguish current observation from approved intent.

## Architecture conversation

The project is not only a CI gate. Its larger purpose is to improve the quality of architectural conversations.

A useful report should allow a maintainer to move between:

- a model element or relationship;
- the contract that governs it;
- the code and configuration that realize it;
- current violations and approved exceptions;
- changes since a previous commit or contract;
- the decision or evidence behind the rule.

This supports questions such as:

- Why is this dependency allowed?
- Is this relationship intentional or merely observed?
- Which callers cross this seam?
- Does this module have more responsibility than the model claims?
- What would break if this relationship were removed?
- Is a new pattern being introduced?
- Has an approved refactoring completed its architectural goal?

The tooling should provide evidence for these conversations without trying to replace maintainer judgment.

## Relationship to architecture visualization

Architecture Conformance should produce a presentation-neutral report. Architecture documentation and visualization tools can consume that report later.

A future C4-based view could distinguish:

- an intentional relationship with a passing contract;
- an expected relationship with no observed realization;
- an observed relationship that violates a contract;
- an observed relationship that has not yet been classified;
- a relationship covered by a temporary exception;
- a model element with incomplete analyzer coverage.

Color alone should not carry this meaning. The visual integration should use labels, status text, legends, accessible line styles, and links to evidence. A user should be able to select a relationship and inspect its contract, realization, violations, and history.

This integration is downstream of the conformance engine. The engine should not depend on a specific diagramming or site-generation tool.

## Project boundary

The new Architecture Conformance project should own:

- the architecture-contract schema;
- realization-map semantics;
- the normalized observed-graph format;
- deterministic rule evaluation;
- analyzer interfaces and conformance requirements;
- baseline and exception handling;
- contract and result deltas;
- command-line and CI behavior;
- machine-readable conformance reports;
- the `architecture-contracts` skill.

Language and platform analyzers may be separate adapters so the core does not accumulate every parser and toolchain.

Architecture documentation tooling can consume conformance reports, associate them with stable model IDs, and present them in generated handoffs and sites. The two projects should share explicit versioned formats rather than depend on each other's internal code.

## The `architecture-contracts` skill

The skill will help a maintainer translate architectural understanding into an executable contract. It can use an LLM during authoring, but its output must be checked by deterministic tooling.

The skill should:

1. Accept an evidence-backed model, claims ledger, architecture decisions, and observed graph when available.
2. Identify candidate architectural constraints without treating current structure as intended structure.
3. Ask the maintainer to resolve ambiguous intent and enforcement semantics.
4. Create or update the realization map.
5. Author precise rules with stable IDs, scope, rationale, enforcement state, and provenance.
6. Run the deterministic checker and present grounded failures.
7. Help classify existing violations as fixes, explicit temporary exceptions, or rejected candidate rules.
8. Record approval without claiming approval on the maintainer's behalf.
9. Preserve contract and report deltas during later changes.
10. Hand versioned artifacts to CI and architecture-documentation consumers.

The skill should not infer that a common pattern is the desired pattern, silently weaken a failing rule, approve its own output, or use an LLM judgment as a pass condition.

## Initial capabilities

The first useful release should remain narrow. It should prove the full contract-to-report path for one ecosystem before pursuing broad language support.

A practical initial scope is:

- a versioned contract format;
- stable references to external model IDs;
- a realization map using path and module selectors;
- one deterministic source dependency analyzer;
- a normalized node-and-edge graph;
- forbidden, allowed, required, layered, interface-only, and acyclic rules;
- strict reporting of unmapped code and analyzer gaps;
- exact temporary exceptions with invalidation behavior;
- JSON and human-readable reports;
- model, contract, analyzer, graph, and report digests;
- baseline-to-current delta reporting;
- CI exit behavior;
- an initial `architecture-contracts` skill.

The first release does not need runtime metrics, automatic C4 overlays, support for every programming language, or a universal architecture ontology.

## Development direction

A likely sequence is:

### Phase 1: contract semantics

Define the vocabulary, rule meanings, open-world and closed-world behavior, realization semantics, coverage requirements, report format, and digest rules. Build small fixtures for valid and invalid architectures.

### Phase 2: one end-to-end analyzer

Support one language or ecosystem well enough to produce source-grounded nodes and dependency edges. Evaluate the initial structural rules and fail on incomplete required analysis.

### Phase 3: existing-system adoption

Add baselines, exact exceptions, changed-code reporting, debt reduction, and contract deltas. Exercise the workflow against a non-trivial repository with known violations.

### Phase 4: architecture-contract authoring

Create the skill and maintainer checkpoints. Connect evidence-backed model IDs to realizations and deterministic rules.

### Phase 5: integration formats

Stabilize the report contract for architecture-documentation consumers. Verify cross-project compatibility through fixtures and contract tests.

### Phase 6: richer evidence

Add adapters for events, API definitions, data ownership, deployment, and further languages based on concrete project needs.

### Phase 7: visual conformance

Add optional presentation of contract status, violations, exceptions, coverage, and history within architecture views.

## Design principles

1. **Intent is approved, not inferred.** Observation can propose a contract but cannot authorize it.
2. **Unknown is a result.** Unmapped code, unsupported syntax, and analyzer failure remain visible.
3. **Coverage accompanies conformance.** A passing rule without adequate coverage is not a passing architecture.
4. **Every failure cites evidence.** Diagnostics identify rule, source, target, edge type, and source location.
5. **The model and contract have separate jobs.** The model explains architecture. The contract removes enforcement ambiguity.
6. **Stable architecture IDs outlive file paths.** Realization mappings absorb implementation movement.
7. **Existing debt is explicit.** Exceptions are narrow, reviewable, and invalidated by relevant change.
8. **Architecture can evolve.** Contract changes are supported, versioned, reviewed, and compared.
9. **Tools exchange versioned artifacts.** The checker, analyzers, skills, CI, and visual consumers do not share hidden assumptions.
10. **No LLM in the pass condition.** Machine results come from pinned analyzers and deterministic rules.

## Measures of success

The project will be succeeding when a team can:

- open an unfamiliar repository and produce an observed architecture graph with stated coverage;
- turn selected architectural intentions into readable executable contracts;
- see exact source evidence when a rule fails;
- distinguish implementation, documentation, and coverage drift;
- introduce checks in a repository that already has violations without hiding them;
- detect a new forbidden dependency in CI;
- review the architectural delta of a proposed change;
- trace a contract to its model element, decision, realization, and history;
- update the architecture intentionally without disabling protection;
- pass conformance results to a visual architecture tool through a stable report format.

## Open decisions

The new project should resolve these questions through discovery and prototypes:

- Which language or ecosystem should prove the first end-to-end implementation?
- Should the contract and realization map be separate files or sections of one versioned document?
- Which stable model-reference format avoids coupling the project to one modeling tool while supporting LikeC4 well?
- What is the smallest normalized graph that supports useful rules without becoming a universal code model?
- How should changed-code checks relate to periodic full scans?
- What evidence fingerprint should invalidate an existing exception?
- How should monorepos compose contracts across package and system boundaries?
- Which rule failures block CI immediately, and which begin in reporting mode?
- How should proposed target architecture appear beside current observed architecture?
- Which coverage threshold or strictness policy is safe for each analyzer?

## Sources

- Neal Ford, Rebecca Parsons, and Patrick Kua, *Building Evolutionary Architectures: Support Constant Change*.
- [Fitness function-driven development, Thoughtworks](https://www.thoughtworks.com/insights/articles/fitness-function-driven-development)
- [ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html)

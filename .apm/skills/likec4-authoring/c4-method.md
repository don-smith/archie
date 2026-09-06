# C4 method for architecture documentation

This guide adapts the C4 method to evidence-backed LikeC4 authoring. Use it with `likec4-reference.md`; the reference explains the language, while this guide explains what to model and why.

## The abstraction levels

C4 is a set of views over one architecture model. Each level answers a different question.

| Level | Question | Typical elements | Audience |
|---|---|---|---|
| System context | Who uses the system and what does it touch? | People, the system being documented, external systems | Everyone involved in the product |
| Container | What independently running or stored parts make up the system? | Web apps, APIs, workers, queues, databases | Developers, operators, architects |
| Component | What important responsibilities live inside one container? | Services, adapters, controllers, repositories | The team working on that container |
| Code | How is one component implemented? | Classes, functions, modules | Developers working in that code |

A container is a separately running or separately stored unit. It is not a directory, package, class, or arbitrary subsystem. A component is a meaningful internal responsibility inside one container. If a unit cannot be deployed, run, or stored separately, do not call it a container merely because it has a directory.

Context and container views are enough for most onboarding work. Start there. Add a component view only when a named question requires it. Add code-level detail only when the user asks for it or a small, high-risk component cannot be understood otherwise.

## Supporting views

Supporting views add a dimension to the main context/container/component model.

| Need | LikeC4 view | Use it when |
|---|---|---|
| A business or product portfolio | Context-style landscape view | Several systems and their shared actors need comparison |
| A production topology | Deployment view | The placement of containers on nodes, regions, clusters, or managed services matters |
| One use-case sequence | Dynamic view | A specific request, event, or workflow needs its runtime order explained |
| A data movement story | Dynamic view with data-oriented relationship labels | The path and transformation of important data matters |

Do not use a supporting view to avoid making the context and container model. A deployment view does not replace a container view. A dynamic view explains one scenario; it does not enumerate every relationship in the system.

## Choose the view from the question

Before authoring a view, write the onboarding question it answers.

- "What is this system and who depends on it?" → context view.
- "Which runtime units make it work?" → container view.
- "How does the API handle account changes?" → component view of the API.
- "What happens when a customer starts checkout?" → dynamic view.
- "Where does the worker run in production?" → deployment view.
- "How do our products relate?" → system landscape view.

If no question needs a deeper view, do not add one. More boxes do not make a model more useful.

## Authoring order

1. Inventory evidence before naming elements. Read documentation, manifests, runtime entry points, deployment and persistence definitions, integrations, representative tests, and source relationships as applicable.
2. State the candidate system boundary. Separate the system being documented from actors and external systems.
3. Ask about ambiguous actors, external systems, runtime units, and important flows. Put unresolved answers in assumptions or the claims ledger.
4. Author the context model first.
5. Author containers inside the system boundary. Include independently running applications, workers, stores, queues, or other runtime units. Do not include every module.
6. Add relationships that explain useful flows. Label direction, intent, and protocol where known.
7. Add one focused deeper view at a time, tied to a question.
8. Compile the workspace and inspect the generated view metadata.
9. Review the model against the checklist before handing it to `architecture-docs`.

Compilation proves that the LikeC4 source is valid. It does not prove that the boundary, names, responsibilities, or inferred technology are true.

## Evidence and uncertainty

Use these distinctions consistently:

- **Confirmed evidence:** directly supported by code, configuration, tests, or explicit documentation.
- **Maintainer-provided intent:** supplied by the maintainer even if the implementation does not yet show it.
- **Inference awaiting confirmation:** a reasonable interpretation that must remain visibly provisional.
- **Unresolved:** insufficient evidence to model the claim safely.

Do not turn a successful compiler run into approval. Do not turn an architecture-review finding into a description of how the system works. Review findings may support a claim about a risk or inconsistency, but the current architecture still needs its own evidence.

## Context view rules

A context view normally contains:

- the people or automated actors that use the system;
- the one internal system being documented; and
- external systems, partners, or services that the system interacts with.

Keep the system boundary obvious. An external payment provider, identity provider, or email service is not a container inside the product. A person who operates the product is not an external system.

Context relationships should explain why the interaction exists. Prefer "Customer manages subscriptions through" over "Uses". Keep arrows directional. If both directions matter, write two relationships with distinct intent labels.

## Container view rules

A container view normally contains:

- user-facing applications or interfaces;
- APIs and independently running services;
- workers, schedulers, or batch processes;
- databases, caches, queues, or object stores; and
- external systems that are needed to explain the container flows.

Give each container a short responsibility and its technology when evidence supports it. Do not invent a framework, cloud service, deployment mode, or database engine to fill an empty field. Mark the technology as unknown or leave it out and record the gap.

Relationships between containers should say what crosses the boundary and how:

```text
web -> api "Submits subscription changes" "HTTPS/JSON"
api -> database "Reads and writes subscription state" "SQL"
api -> queue "Publishes SubscriptionChanged events" "AMQP"
worker -> email "Sends renewal notices" "HTTPS"
```

The exact LikeC4 form is shown in `likec4-reference.md`. The labels are the important part: direction, intent, and protocol must agree.

## Component view rules

Choose one container and show only its important internal responsibilities. Good component candidates include an application service, policy engine, adapter, repository, event handler, or integration gateway.

Do not turn every file or namespace into a component. A component view should explain a behavior or boundary that the container view cannot explain. Keep external systems and stores only when they are needed to explain the component's flow.

## Dynamic view rules

A dynamic view describes one scenario in runtime order.

- Name the scenario in the view title.
- Start with the initiating actor or component.
- Use one step per meaningful interaction, not every function call.
- Include success and failure branches only when they matter to the question.
- Keep responses and callbacks explicit.
- Do not mix unrelated use cases in one sequence.

For a checkout flow, a useful sequence might be:

```text
customer -> web "Starts checkout"
web -> api "Submits checkout"
api -> payment "Authorizes payment"
payment -> api "Returns authorization"
api -> database "Stores subscription"
api -> email "Sends confirmation"
```

If several independent notifications happen after a state change, use a parallel block when the LikeC4 version supports it. Otherwise use separate clearly ordered steps and record the limitation.

## Deployment view rules

Use deployment views only when runtime placement changes how the system is understood. Show nodes such as a browser, cluster, host, region, or managed service, then place instances of logical containers on those nodes. Keep logical container names aligned with the container view. Do not create a second architecture model with deployment-only names.

Deployment evidence must come from deployment manifests, infrastructure code, runbooks, hosting configuration, or maintainer intent. A package dependency alone does not prove a deployment node.

## Diagram density and naming

- Keep context views small enough to understand at a glance.
- Split a container's components across focused views when the view becomes crowded.
- Use stable IDs that describe the domain element, not its current file path.
- Use human-readable titles and descriptions. Explain acronyms.
- Keep relationship labels short in the diagram and put detail in the page prose.
- Prefer one clear view over several nearly identical views.

## Handoff to architecture-docs

Return these items to the orchestration skill:

- the validated LikeC4 workspace path;
- the selected view IDs and the question each view answers;
- claim IDs represented by material model statements;
- useful source links that came from evidence or explicit configuration;
- explicit assumptions and unresolved gaps; and
- the compiler result.

`architecture-docs` owns Markdown prose, the page map, ledger approval, publication, and generated HTML. This skill owns C4 modeling judgment and LikeC4 syntax.

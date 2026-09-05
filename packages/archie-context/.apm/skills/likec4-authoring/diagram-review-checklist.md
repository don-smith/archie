# LikeC4 diagram review checklist

Run this checklist before handing a model to `architecture-docs`. Fix the model, add the missing explanation to the Markdown page, or mark the item not applicable with a reason.

## Scope and level

- [ ] The view has a clear title.
- [ ] The view type and scope are obvious from its title and description.
- [ ] The view answers one named onboarding question.
- [ ] Context views show actors, the documented system, and relevant external systems.
- [ ] Container views show independently running or stored units, not arbitrary directories.
- [ ] Component views stay inside one container.
- [ ] Deployment views show placement of logical containers rather than inventing new logical elements.
- [ ] Dynamic views describe one scenario in meaningful runtime order.
- [ ] The view does not mix abstraction levels without an explicit reason.

## Elements

- [ ] Every element has a stable ID, useful name, and responsibility description.
- [ ] Every element kind matches its role: actor, system, container, component, database, queue, or external system.
- [ ] Technologies are present when confirmed by evidence and absent or qualified when unknown.
- [ ] External systems are outside the documented system boundary.
- [ ] Actors are people or automated users, not internal runtime units.
- [ ] Acronyms and unusual terms are explained in the page prose or glossary.
- [ ] Elements are not duplicated under different names.
- [ ] The view is not overcrowded. Split it if the reader cannot follow the main story.

## Relationships

- [ ] Every relationship has a direction that matches its label.
- [ ] Every relationship has a concrete intent, not only "Uses", "Calls", or "Reads".
- [ ] Inter-container relationships name the protocol or technology when known.
- [ ] Bidirectional behavior is represented as two intentional relationships when the two directions mean different things.
- [ ] Relationships are supported by evidence or marked as inference or maintainer intent.
- [ ] No relationship points to an undefined or incorrectly scoped element.
- [ ] Dynamic steps represent meaningful interactions, not implementation noise.
- [ ] Dynamic responses, callbacks, errors, and branches are included when they matter to the question.

## LikeC4 source

- [ ] The workspace has the required `specification`, `model`, and `views` blocks for its scope.
- [ ] Element and view IDs use valid identifiers and stable fully qualified names.
- [ ] Scoped views use predicates deliberately. `*`, `_`, and `**` are not interchangeable.
- [ ] Named views refer to existing elements and relationships.
- [ ] Source links use repository-relative paths or explicit HTTP(S) URLs from evidence.
- [ ] The package compiler passes without errors.
- [ ] Compiler success is not being presented as maintainer approval.

## Documentation and evidence

- [ ] The accompanying Markdown explains the view's purpose and scope.
- [ ] A legend or prose explanation covers meaningful shapes, colors, line styles, and icons.
- [ ] Assumptions are explicit.
- [ ] Pending, inferred, rejected, or unresolved claims remain visible.
- [ ] Claim IDs and evidence paths are returned to `architecture-docs`.
- [ ] The model does not assert deployment, technology, intent, or ownership that the evidence cannot support.

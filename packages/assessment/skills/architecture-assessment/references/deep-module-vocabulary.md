# Deep-module vocabulary

## Contents

- Glossary
- Deep and shallow modules
- Principles
- Designing for testability
- Relationships
- Rejected framings
- Deepening a cluster
- Testing strategy: replace, don't layer

Use this vocabulary when an Archie capability judges modules, interfaces, and seams. It describes design quality in terms of leverage for callers, locality for maintainers, and testability through the interface. It is reference material, not a workflow: the capability that links it decides when a judgment is in scope and how findings are triaged.

## Glossary

Use these terms exactly. Do not substitute "component", "service", "API", or "boundary"; consistent language is the point.

**Module**: anything with an interface and an implementation. The term is deliberately scale-agnostic: a function, class, package, or tier-spanning slice. _Avoid_: unit, component, service.

**Interface**: everything a caller must know to use the module correctly. That includes the type signature, but also invariants, ordering constraints, error modes, required configuration, and performance characteristics. _Avoid_: API, signature (both refer only to the type-level surface).

**Implementation**: what is inside a module. It is distinct from **adapter**: a small adapter can have a large implementation (a Postgres repository), and a large adapter can have a small implementation (an in-memory fake). Say "adapter" when the seam is the topic, and "implementation" otherwise.

**Depth**: leverage at the interface, meaning the amount of behaviour a caller or test can exercise per unit of interface it has to learn. A module is **deep** when a large amount of behaviour sits behind a small interface. It is **shallow** when the interface is nearly as complex as the implementation.

**Seam** (Michael Feathers): a place where behaviour can change without editing in that place. It is the location at which a module's interface lives. Where to put a seam is its own design decision, separate from what goes behind it. _Avoid_: boundary (overloaded with DDD's bounded context).

**Adapter**: a concrete thing that satisfies an interface at a seam. The term describes a role (which slot it fills), not substance (what is inside).

**Leverage**: what callers get from depth, meaning more capability per unit of interface they learn. One implementation pays back across N call sites and M tests.

**Locality**: what maintainers get from depth. Change, bugs, knowledge, and verification concentrate in one place rather than spreading across callers. Fix it once and it is fixed everywhere.

## Deep and shallow modules

A **deep module** has a small interface with a large implementation behind it. A **shallow module** has a large interface over a thin implementation that mostly passes calls through.

When judging or designing an interface, ask:

- Can the number of operations shrink?
- Can the parameters be simpler?
- Can more complexity hide inside?

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be composed internally of small, swappable parts that are not part of its interface. A module can have **internal seams**, private to its implementation and used by its own tests, as well as the **external seam** at its interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. Wanting to test past the interface suggests the module has the wrong shape.
- **One adapter means a hypothetical seam; two adapters mean a real one.** Do not introduce a seam unless something actually varies across it.

## Designing for testability

1. **Accept dependencies instead of creating them.** `processOrder(order, paymentGateway)` is testable. A `processOrder(order)` that constructs its own gateway is not.
2. **Return results instead of producing side effects.** `calculateDiscount(cart): Discount` is testable. An `applyDiscount(cart): void` that mutates the cart total is harder to test.
3. **Keep the surface area small.** Fewer operations mean fewer tests, and fewer parameters mean simpler test setup.

## Relationships

- A **module** has exactly one **interface**, the surface it presents to callers and tests.
- **Depth** is a property of a **module**, measured against its **interface**.
- A **seam** is where a **module**'s **interface** lives.
- An **adapter** sits at a **seam** and satisfies the **interface**.
- **Depth** produces **leverage** for callers and **locality** for maintainers.

## Rejected framings

- **Depth as a ratio of implementation lines to interface lines.** This rewards padding the implementation. Use depth as leverage instead.
- **"Interface" as a language `interface` keyword or a class's public methods.** This is too narrow: the interface includes every fact a caller must know.
- **"Boundary".** This is overloaded with DDD's bounded context. Say **seam** or **interface**.

## Deepening a cluster

Classify a deepening candidate's dependencies. The category determines how the deepened module is tested across its seam.

1. **In-process.** Pure computation or in-memory state with no I/O. This is always deepenable: merge the modules and test through the new interface directly, with no adapter.
2. **Local-substitutable.** Dependencies with local test stand-ins, such as an embedded database or in-memory filesystem. This is deepenable if the stand-in exists. The seam stays internal, with no port at the module's external interface.
3. **Remote but owned (ports and adapters).** Services the team owns across a network. Define a port at the seam, keep the logic in one deep module, and inject the transport as an adapter: an in-memory adapter for tests and a network adapter in production.
4. **True external.** Third-party services the team does not control. The deepened module takes the dependency as an injected port, and tests provide a mock adapter.

Seam discipline:

- Do not introduce a port unless at least two adapters are justified, typically production and test. A single-adapter seam is just indirection.
- Do not expose internal seams through the interface just because tests use them.

## Testing strategy: replace, don't layer

- Once tests exist at the deepened module's interface, old unit tests on the former shallow modules are waste.
- Write new tests at the deepened module's interface, because the interface is the test surface.
- Assert on observable outcomes through the interface, not internal state.
- Tests should survive internal refactors. A test that must change when the implementation changes is testing past the interface.

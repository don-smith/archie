# LikeC4 reference

This package uses the LikeC4 compiler pinned in the repository root. Use this document for exact `.c4` and `.likec4` authoring. Use `c4-method.md` for C4 modeling judgment and `diagram-review-checklist.md` before handoff.

## Workspace shape

A workspace normally contains one or more `.c4` or `.likec4` files. The authored model uses these top-level blocks:

```likec4
specification {
  // element and relationship kinds used by this workspace
}

model {
  // actors, systems, containers, components, stores, and relationships
}

deployment {
  // optional physical deployment nodes and instances
}

views {
  // named context, container, component, dynamic, and deployment views
}
```

Keep the specification, model, and views easy to locate. Split files only when the boundary is clear. LikeC4 merges compatible top-level blocks, but cross-file references should use fully qualified names rather than relying on a short name that happens to resolve in one file.

Strings may use single or double quotes. Escape the matching quote. Use comments for notes that should not become model content.

```likec4
// A short comment.
/* A comment that spans
   multiple lines. */
```

The repository builder compiles the workspace as part of `architecture-docs build`. Do not claim that a snippet is valid without compiling it against the pinned version.

## Specification

The specification defines the element kinds available to the model. Keep names stable and choose kinds that communicate the C4 role.

```likec4
specification {
  element actor { style { shape person } }
  element system
  element container
  element component { style { shape component } }
  element database { style { shape cylinder } }
  element queue { style { shape queue } }
  element externalSystem { style { shape rectangle } }
}
```

Common kind choices:

| Kind | C4 role | Typical use |
|---|---|---|
| `actor` | Person or automated user | Customer, operator, scheduled job outside the system boundary |
| `system` | Software system | The system being documented or another system at context level |
| `container` | Runtime or separately stored unit | Web app, API, worker, database, queue |
| `component` | Internal responsibility | Account service, policy engine, adapter |
| `database` | Persistent store | Relational database, document store, object store |
| `queue` | Message or task transport | Queue, topic, event stream |
| `externalSystem` | System outside the documented boundary | Payment provider, identity service, email provider |

The kind name is project vocabulary. The C4 level comes from the view and hierarchy. A custom `system` kind nested under another system is usually a modeling mistake unless the project deliberately uses a system landscape or product hierarchy.

## Model elements

Elements have an identifier and a title. Descriptions, technologies, links, and child elements add useful evidence-backed detail.

```likec4
model {
  customer = actor "Customer" {
    description "Manages an account and subscriptions."
    link ./docs/personas/customer.md "Evidence"
  }

  ledger = system "CloudLedger SaaS" {
    description "Manages customer accounts and recurring subscriptions."

    web = container "Web application" {
      technology "TypeScript"
      description "Presents account and billing workflows."
      link ./src/web.ts "Source"
    }

    api = container "Application API" {
      technology "Node.js"
      description "Applies account and subscription rules."

      accounts = component "Account service" {
        description "Reads and updates customer accounts."
      }
    }

    data = database "Application database" {
      technology "PostgreSQL"
      description "Stores private account and subscription state."
    }
  }

  payment = externalSystem "Payment provider" {
    description "Authorizes recurring payments."
  }
}
```

### Naming and identity

- Use lowercase, stable identifiers for authored elements. Avoid encoding a temporary file path in an ID.
- A fully qualified name is the dot-separated path created by nesting, such as `ledger.api.accounts`.
- Dots separate name segments. Do not put dots inside one identifier.
- Use the fully qualified name when the reference crosses a file boundary or when a short name could be ambiguous.
- Do not rename an element only to match a directory. Rename it when the domain concept or responsibility changed.

### Descriptions and technology

Use descriptions for responsibility, not implementation trivia. Use `technology` only for a confirmed or explicitly supplied technology. A package dependency is evidence that a library is available, not proof that it is a separately deployed container.

A database, queue, or object store is a container-level element when it is part of the runtime architecture. It is not a component of the API merely because the API owns the data access code.

### Source links

Use repository-relative links when the target repository provides the evidence:

```likec4
link ./src/api/index.ts "Source"
link ./infra/production.tf "Deployment evidence"
```

Use an explicit HTTP(S) link only when that source is known and configured. Never invent a GitHub host, branch, path, or line URL. A source link is a relationship to evidence, not proof that the linked file says everything in the element description.

## Relationships

Relationships are directional. Put the source on the left and the target on the right. The label describes the intent from source to target.

```likec4
model {
  customer -> web "Manages an account"
  web -> api "Submits subscription changes" "HTTPS/JSON"
  api -> data "Reads and writes subscription state" "SQL"
  api -> payment "Authorizes recurring payment" "HTTPS/JSON"
}
```

Use concrete labels:

| Weak | Better |
|---|---|
| `Uses` | `Submits subscription changes to` |
| `Calls` | `Requests payment authorization from` |
| `Reads` | `Reads customer account state from` |
| `Sends` | `Publishes SubscriptionChanged events to` |

If both directions matter, write two relationships with distinct meaning:

```likec4
web -> api "Submits account changes" "HTTPS/JSON"
api -> web "Returns account state" "HTTPS/JSON"
```

Do not create a relationship between two elements in the same hierarchy when LikeC4 rejects that relationship. Move the relationship to the appropriate parent or use a component/dynamic view that represents the interaction correctly.

Relationships should be evidence-backed. HTTP client code, SDK usage, database adapters, queue producers, event handlers, deployment configuration, tests, and maintainer statements are useful sources. Do not infer a protocol from a generic function name.

## Context views

A context view shows the documented system, its actors, and relevant external systems. Keep the scope focused.

```likec4
views {
  view systemContext of ledger {
    title "System context"
    description "Customers manage subscriptions through CloudLedger, which uses payment and email providers."
    include customer, ledger, payment
  }
}
```

Include an external system when it helps explain a meaningful boundary or flow. Do not include every vendor named in a lockfile. A context view should not contain the API, database, or internal modules. Those belong in a container or deeper view.

For multiple related software systems, use a landscape-style context view and keep the product boundary explicit:

```likec4
views {
  view productLandscape {
    title "Product landscape"
    description "The systems used by support and customer operations."
    include customer, ledger, support, payment
  }
}
```

## Container views

A container view shows the independently running or stored parts of one system.

```likec4
views {
  view containers of ledger {
    title "Runtime containers"
    description "The web application, API, and database form the CloudLedger runtime."
    include ledger.*, payment
  }
}
```

`ledger.*` selects the direct children of `ledger` in this scoped view. If the model has nested components, do not assume they belong in a container view. Use a component view for those.

A container view should make these questions answerable:

- Which process receives user requests?
- Which process applies business rules?
- Which unit stores durable state?
- Which external systems are called?
- Which protocols or event transports connect them?

## Component views

A component view focuses on one container.

```likec4
views {
  view apiComponents of ledger.api {
    title "API components"
    description "The API components that apply account and subscription rules."
    include *
    include ledger.data, payment
  }
}
```

Use `include *` as the base set for the scoped element's direct contents, then add related stores or external systems when they explain the flow. Do not use a component view to display unrelated containers.

## Dynamic views

A dynamic view describes one scenario as ordered steps. Use model elements as the endpoints and label each step with the action.

```likec4
views {
  dynamic view checkoutFlow {
    title "Checkout flow"
    description "A customer request is authorized, stored, and confirmed."
    customer -> web "Starts checkout"
    web -> api "Submits checkout"
    api -> payment "Authorizes payment"
    payment -> api "Returns authorization"
    api -> data "Stores subscription"
    api -> email "Sends confirmation"
    email -> customer "Delivers confirmation"
  }
}
```

Keep one use case per dynamic view. Include a response or callback when it changes the explanation. If the LikeC4 version supports flow-control blocks, use them only when the branch or parallelism is important and validate the result:

```likec4
dynamic view renewalFlow {
  title "Subscription renewal"
  api -> payment "Requests renewal"
  payment -> api "Returns renewal result"
  parallel {
    api -> data "Stores renewal state"
    api -> email "Sends renewal notice"
  }
}
```

Do not use dynamic views to list every function call. The useful unit is a meaningful runtime interaction.

## Deployment views

Deployment modeling maps logical elements to physical nodes. Use it only when deployment placement matters to the question.

```likec4
deployment {
  production = deploymentNode "Production" {
    webInstance = instanceOf ledger.web
    apiInstance = instanceOf ledger.api
    databaseInstance = instanceOf ledger.data
  }
}

views {
  deployment view productionTopology {
    title "Production topology"
    description "The CloudLedger runtime deployed in production."
    include production.**
  }
}
```

Deployment evidence should come from infrastructure code, deployment manifests, hosting configuration, runbooks, or maintainer intent. Keep instance names tied to logical elements with `instanceOf`; do not create deployment-only versions of the API or database.

If the exact deployment grammar is uncertain, consult the pinned LikeC4 version and compile a minimal fixture before adding a large topology.

## Predicates and scope

Selectors are not interchangeable:

| Selector | Meaning in a scoped view | Use |
|---|---|---|
| `parent.*` | Direct children of `parent` | Show a system's containers or a container's components |
| `parent._` | Direct children connected to the accumulated result | Reduce disconnected children |
| `parent.**` | Recursive descendants connected to the accumulated result | Explore a deep subtree when justified |
| `*` | The scoped element's direct contents in a scoped view | Start a focused component view |
| `-> target` | Incoming or outgoing relationship predicate, depending on the complete form | Select connected elements deliberately |

Treat wildcard behavior as syntax, not intuition. If a view is unexpectedly empty or crowded, reduce it to one include predicate, compile, and add rules incrementally.

## Views, navigation, and style

Named views can include a `title` and `description`. Use those fields to state the question and scope. A view may include style rules, links, metadata, or navigation to another view when those features are supported by the pinned compiler.

Prefer model semantics over visual decoration. Use styles to make kinds and boundaries legible, not to encode unsupported claims. If color, shape, icon, border, or line style carries meaning, explain it in the page prose or legend.

Layout is a review concern. Reordering declarations, adjusting view scope, and splitting a crowded view are usually safer than adding many style overrides. Validate and inspect the rendered explorer after changes.

## Validation workflow

From a target repository containing `architecture-docs.config.json`:

```bash
# PACKAGE_DIR is the local c4archviewer checkout.
node "$PACKAGE_DIR/bin/architecture-docs.mjs" build \
  --config "$TARGET_DIR/architecture-docs.config.json"

node "$PACKAGE_DIR/bin/architecture-docs.mjs" check \
  --config "$TARGET_DIR/architecture-docs.config.json" \
  --mode preview
```

The build compiles the LikeC4 workspace and checks configured view and element references. Preview checks allow pending claims. Publication checks add current approval and required evidence coverage. Use the package command rather than an unpinned global LikeC4 CLI.

When a compile error occurs:

1. Read the first diagnostic, not the cascade.
2. Check identifiers and fully qualified names.
3. Check that the element kind is defined in `specification`.
4. Check that every view reference exists.
5. Reduce the view to a minimal include set.
6. Rebuild and inspect the generated view metadata.

Never report a model as validated when only the text was inspected.

## Quick reference

```likec4
specification {
  element actor { style { shape person } }
  element system
  element container
  element component { style { shape component } }
  element database { style { shape cylinder } }
  element externalSystem { style { shape rectangle } }
}

model {
  user = actor "User" { description "Uses the system." }
  app = system "Example system" {
    web = container "Web" { technology "TypeScript" description "Presents the UI." }
    api = container "API" { technology "Node.js" description "Applies rules." }
    db = database "Database" { technology "PostgreSQL" description "Stores state." }
  }
  external = externalSystem "External provider" { description "Provides an external capability." }
  user -> app.web "Uses the web application"
  app.web -> app.api "Submits requests" "HTTPS/JSON"
  app.api -> app.db "Reads and writes state" "SQL"
  app.api -> external "Requests an external operation" "HTTPS/JSON"
}

views {
  view context of app {
    title "System context"
    include user, app, external
  }
  view containers of app {
    title "Containers"
    include app.*
  }
  dynamic view operation {
    title "Operation flow"
    user -> app.web "Starts operation"
    app.web -> app.api "Submits operation"
    app.api -> app.db "Stores result"
  }
}
```

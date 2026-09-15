# Architecture Conformance

Architecture Conformance turns maintainer-approved dependency rules into a repeatable TypeScript check. It separates observed source evidence from architecture intent. The tool does not infer that an existing dependency is approved.

## Requirements

- Node `>=24 <25`
- npm
- TypeScript `7.0.2`, pinned in `package.json` and the lockfile

## What the tool checks

The v0 TypeScript adapter reads explicit `tsconfig` roots and their reachable project references. It records static ESM imports, re-exports, and string-literal dynamic imports from `.ts`, `.tsx`, `.mts`, and `.cts` files. An explicit `import type` or `export type` is a `type` edge. Other imports are `runtime` edges.

It does not inspect Python, CommonJS `require`, nonliteral dynamic imports, calls, HTTP traffic, events, databases, or deployment configuration. Unsupported or unresolved evidence becomes a gap. In strict mode, gaps fail the check.

The first two rule kinds are:

- `dependency-policy`, which forbids named source-to-target architecture relationships and can use open or closed-world semantics
- `acyclic`, which finds dependency cycles among named architecture IDs

## How the commands fit together

```text
TypeScript source + explicit tsconfigs
                |
                v
          analyze -> observed graph JSON
                |
 maintainer writes realization map + contract
                |
                v
           check -> fresh graph + conformance report
                |
                v
        baseline -> saved report-history snapshot
```

Each file has a separate job.

| Artifact | Created by | Used for |
| --- | --- | --- |
| Observed graph | `analyze` or internally by `check` | Source-level evidence, gaps, and investigation |
| Realization map | Maintainer | Maps source modules to stable architecture IDs |
| Architecture contract | Maintainer | States approved dependency and cycle rules |
| Conformance report | `check` | Grounded pass, failure, coverage, waiver, and baseline results |
| Baseline | `baseline` | Compares a later report with known results |

`check` does not consume a graph file. It analyzes source again from the realization map's root configs. That is deliberate. CI must check current source rather than reuse stale evidence from a previous `analyze` run.

## Local onboarding bootstrap

Install a published version as an exact devDependency in the target, commit the target lockfile, and invoke only its local executable. Do not use a global link or permit `npx` to download a version.

```sh
npm install --save-dev --save-exact architecture-conformance@0.1.1
npx --no-install architecture-conformance onboard setup
npx --no-install architecture-conformance onboard init \
  --root tsconfig.json --include 'src/**/*.ts' \
  --exclude 'src/**/*.micro.ts' \
  --skill-location .agents/skills/architecture-conformance-onboarding
```

Initialization writes operational `onboarding-state/v1` at `.architecture-conformance/onboarding.json`. It records scope, artifact paths, selected skill location, lifecycle checkpoint, and evidence digests; realization maps, contracts, approvals, exceptions, and baselines retain their separate ownership. Resume by reading this state and re-validating its evidence. Default graph, onboarding-summary, and report paths are regenerable under `.architecture-conformance/evidence/`; teams may configure retained locations.

## 1. Inspect source evidence with `analyze`

Start with `analyze` when you need to see what the adapter found or where its coverage ends.

```sh
architecture-conformance analyze \
  --root packages/core/tsconfig.json \
  --include 'packages/core/src/**' \
  --exclude 'packages/core/src/**/*.micro.ts' \
  --output graph.json \
  --summary-output onboarding-summary.md
```

Use one `--root` for every package config you want in the same scan. Repeat `--exclude` for source files that are deliberately outside the selected evidence, such as test files. Do not use a base config that has no `include`, `files`, or project references. TypeScript will otherwise discover files across the repository before Architecture Conformance applies its scope.

The graph is canonical JSON. It is intentionally one line so equal inputs have equal bytes and digests. It is a machine artifact, not a human report. Format a disposable view instead of editing it:

```sh
jq . graph.json | less -R
```

List every resolved edge with source module, target module, edge kind, and original specifier:

```sh
jq -r '
  (.nodes | map({key: .id, value: .module}) | from_entries) as $module
  | .edges[]
  | select(.status == "resolved")
  | [$module[.source], ($module[.target] // .specifier), .kind, .specifier]
  | @tsv
' graph.json | less -R
```

List gaps before trusting the graph:

```sh
jq -r '.gaps[] | [.kind, (.file // "-"), .message] | @tsv' graph.json | less -R
```

The graph is useful for finding source modules with surprising import directions, repeated dependencies, unresolved imports, and unsupported loading. It does not decide whether those relationships are good architecture.

## Workspace package imports

For static bare imports, re-exports, and string-literal dynamic imports, the pinned TypeScript project checker resolves paths, package entry points, and supported subpaths. A resolution to selected repository source becomes the existing source-module edge. When a package export resolves to an emitted declaration, the adapter maps it back to selected source only through an exact path derived from that project's declared `rootDir` and `outDir` or `declarationDir`. A resolution to repository source outside selected scope is a `workspace-source-outside-scope` gap; dependencies remain external modules and failed resolutions remain unresolved gaps. The command still does not discover workspace configs—supply explicit roots and scope.

## 2. Classify source with a realization map

A realization map tells the checker which stable architecture ID owns each in-scope source module. IDs are your vocabulary. They do not come from file paths.

This small map classifies two source areas. Replace the IDs and paths with maintainer decisions for your repository.

```json
{
  "version": "realization-map/v1",
  "scope": {
    "rootConfigs": ["packages/example/tsconfig.json"],
    "include": ["packages/example/src/**"],
    "exclusions": []
  },
  "elements": [
    { "id": "domain" },
    { "id": "infrastructure" }
  ],
  "mappings": [
    { "elementId": "domain", "path": "packages/example/src/domain/**" },
    { "elementId": "infrastructure", "path": "packages/example/src/infrastructure/**" }
  ]
}
```

Each in-scope source module must match exactly one mapping. Missing, stale, and overlapping mappings remain results. The checker never guesses which architecture ID wins.

## 3. State intent with an architecture contract

A contract says what maintainers want to preserve. Start with proposed rules while you review evidence. Proposed rules appear in reports but do not block CI.

```json
{
  "version": "architecture-contract/v1",
  "exceptions": [],
  "rules": [
    {
      "id": "domain-no-infrastructure",
      "kind": "dependency-policy",
      "intent": "Domain code must not import infrastructure code.",
      "enforcement": "proposed",
      "severity": "error",
      "world": "open",
      "sources": ["domain"],
      "forbiddenTargets": ["infrastructure"],
      "edgeKinds": ["runtime", "type"]
    }
  ]
}
```

Change a rule to `active` only after a maintainer supplies its approval metadata. The CLI validates that approval metadata has a shape. It cannot prove that a person approved it.

## 4. Run `check`

`check` loads the map and contract, builds fresh source evidence, validates the map, evaluates rules, applies exact exceptions, and writes a conformance report.

```sh
architecture-conformance check \
  --map realization-map.json \
  --contract architecture-contract.json \
  --strict \
  --output report.json
```

Use text output to read the result. Keep JSON output when another tool or a baseline needs it.

```sh
architecture-conformance check \
  --map realization-map.json \
  --contract architecture-contract.json \
  --strict \
  --format text
```

A report distinguishes implementation drift, documentation drift, and coverage drift. A failure contains the rule ID, mapped architecture IDs, import specifier, and source span when source evidence exists.

## 5. Replay evidence

`replay` has two explicit source modes and two explicit behaviors. It creates evidence only. It does not approve a contract, update onboarding state, create a baseline, or change conformance exit behavior.

Use state mode to reproduce one recorded observation. It reads the state-recorded map, contract, scope, paths, and evidence digests. It regenerates or verifies graph, summary, and report only when each recomputed digest matches the state. This is useful for restoring missing derived files from an unchanged observation.

```sh
architecture-conformance replay \
  --state .architecture-conformance/onboarding.json \
  --verify
```

Use map mode to analyze a current realization-map scope. It writes or verifies graph and summary only. The outputs are deterministic paths under the map directory: `evidence/observed-graph.json` and `evidence/onboarding-summary.md`. Map mode cannot produce a conformance report because a realization map does not supply a contract.

```sh
architecture-conformance replay \
  --map .architecture-conformance/realization-map.json \
  --regenerate
```

Each invocation needs exactly one of `--state` or `--map` and exactly one of `--regenerate` or `--verify`. Verification writes nothing. Bad selections, unreadable inputs, stale state evidence, and output mismatches return code `3`.

## 6. Reconcile local drift records

`reconcile` compares two consumer-produced JSON documents. The package treats their IDs, fingerprints, and drift `state` values as opaque. It does not parse consumer reports or Markdown, alter an input, suppress a result, or decide a lifecycle action.

```sh
architecture-conformance reconcile \
  --active architecture/conformance/active-results.json \
  --drift architecture/conformance/drift-records.json \
  --output architecture/conformance/evidence/reconciliation.json
```

The active document uses `architecture-active-result-set/v1` and has `results` with non-empty `id` and `fingerprint` values. The drift document uses `architecture-drift-record/v1` and has `records` with non-empty `id`, `fingerprint`, and `state` values. Duplicate IDs remain valid input because the report identifies them.

A reconciliation report has ordered `missing`, `duplicates`, `stale`, and `resolvedCandidates` categories. Findings are informational and return code `0`. Invalid or unreadable input returns code `3`.

## 7. Save and compare a baseline

A baseline records current active result fingerprints. It supports incremental adoption without hiding a result behind a broad ignore.

```sh
architecture-conformance baseline --report report.json --output baseline.json
```

Pass that baseline to later checks:

```sh
architecture-conformance check \
  --map realization-map.json \
  --contract architecture-contract.json \
  --baseline baseline.json \
  --output report.json
```

Later reports classify results as new, unchanged, waived, reintroduced, or fixed. `check` never writes a baseline. Do not overwrite a baseline casually. Its ledger is the history needed to identify a reintroduced result.

## Public contracts

The package publishes closed, versioned JSON schemas for downstream readers:

- `schemas/conformance-report-v1.schema.json` describes report identity, digests, results, gaps, and observed graph evidence.
- `schemas/onboarding-state-v1.schema.json` describes operational resume state and retained evidence digests.

Consumers can import the package root for `readConformanceReport`, `readOnboardingState`, and the two frozen producer version constants. Checker, rendering, storage, and analyzer modules remain private implementation details.

The later-consumer handoff uses two closed envelopes that do not change parity-frozen report bytes: `readConformanceReportContract` reads `conformance-report-contract/v1`, and `readConformanceStateContract` reads `conformance-state-contract/v1`. These contracts carry result codes and meanings, report identity, evidence digests, freshness inputs, and the nested `onboarding-state/v1` state version. Their schemas are exported under `@archie/conformance/schemas/`.

Result codes are fixed. `0` means pass, `1` means blocking violation, `2` means incomplete evidence, and `3` means invalid input. Freshness is explicit as `fresh`, `stale`, `unavailable`, or `unknown`; consumers must not turn an unavailable or unknown input into a pass.

## Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | No blocking active violation and no strict incompleteness |
| 1 | Active blocking violation |
| 2 | Strict analysis or coverage gap. This takes precedence over violations. |
| 3 | Invalid arguments or unreadable, invalid, or incompatible input |

## Support limits

`typescript-program-v1` supports explicit root configs and their project references, static ESM imports, re-exports, and string-literal dynamic imports. Nonliteral dynamic imports, CommonJS `require`, unresolved imports, compiler diagnostics, unsupported files, and scope files outside a program are gaps. Workspace declaration-to-source correspondence requires a unique path derived from declared `rootDir` and `outDir` or `declarationDir`. The command does not discover workspace configs.

For repeat CI, run the same local command: `npx --no-install architecture-conformance check --map .architecture-conformance/realization-map.json --contract .architecture-conformance/architecture-contract.json --baseline .architecture-conformance/baseline.json --strict`. Read [TypeScript support](docs/typescript-support.md), the [compiler upgrade policy](docs/compiler-upgrade-policy.md), [the onboarding skill](skills/architecture-conformance-onboarding/SKILL.md), and [the maintainer workflow](skills/architecture-contracts/SKILL.md) before activating rules.

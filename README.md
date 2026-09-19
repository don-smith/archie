# Archie

Archie is an architecture agent for a code repository. It assesses a system's architecture, reviews
one module in depth, maintains evidence-backed architecture documentation, checks dependency rules
deterministically, and reports drift. It arrives as one package of agent skills plus a pinned
runtime.

Archie routes each request to the capability that owns it and stops for your decision before
anything durable changes. It proposes; you decide what becomes true.

## What Archie does

| Capability | Use it when |
|---|---|
| Architecture Assessment | A whole system needs a recovered fact model and evidence-led findings before redesign or alignment. |
| Architecture Review | No work item is open, but one bounded module deserves a layer-by-layer structural review. |
| Architecture Docs | Architecture pages, their claims, and the evidence behind them need to be written or brought back up to date. |
| LikeC4 authoring | A C4 model or a view has to answer a named architecture question. |
| Conformance onboarding | A TypeScript repository needs its current dependency structure observed before anyone writes rules. |
| Architecture Contracts | A maintainer is ready to state intended dependencies and check them deterministically. |
| HTML Design | Architecture content needs a readable, self-contained HTML presentation. |

You select each capability on its own, and each keeps its own meaning. A review finding is not an
architecture pass, and observed code never becomes approved intent by itself.
[Product boundaries](docs/archie/product-boundaries.md) states the limits in full, and
[Working with Archie](docs/archie/managed-site-guide.md) describes each capability's problem,
result, and starting point.

## Install

Archie is not published to npm. You install it from a clone of this repository, and the clone is all
you need: no registry account and no token.

Run this from inside the repository you want Archie in:

```bash
git clone --depth 1 https://github.com/don-smith/archie.git /tmp/archie-install
cd /path/to/your/repo
/tmp/archie-install/install.sh
```

There is no `curl | bash` one-liner, deliberately. Cloning first means you can read `install.sh`
before you run it, and it is commented throughout for exactly that.

You need Node 24, npm, git, and [APM](https://github.com/danielmeppiel/apm) 0.29 on your PATH. The
install checks all four up front and stops with a specific message if one is missing.

Options: `--target <dir>` to install somewhere other than the current directory, and
`--skip-browsers` to defer the Playwright download.

### What the install does

1. It packs the Archie runtime and conformance artifacts from the clone. The built output is
   committed, so nothing is compiled and the clone installs no dependencies.
2. APM resolves the eight Archie skills from this repository at the clone's exact commit.
3. The installer finalizes a release record pinning all of it, then installs that into your
   repository.
4. It links the skills into `.claude/skills/` if your repository uses Claude Code (see below).
5. It downloads the Playwright browser, which is stored once per machine rather than once per
   repository.

It never pushes, never tags, and never touches your application's `package.json` or
`package-lock.json`.

### What lands in your repository

| Path | Committed? |
|---|---|
| `.agents/skills/*` | yes — the eight skills, shared with your team |
| `.claude/skills/*` | your choice — symlinks, and only if you use Claude Code (see below) |
| `.archie/release/`, `.archie/version` | yes — the pin |
| `.archie/runtime/package-lock.json`, `.archie/runtime/npm/*.tgz` | yes — about 185KB, so branches and worktrees hydrate offline |
| `apm.yml`, `apm.lock.yaml` | yes |
| `.archie/runtime/node_modules/` | no — machine-local, rehydrated on demand |

A fresh branch or worktree carries the pin but not the installed tree. You do not need to reinstall:
the first time the `archie` skill runs there, it hydrates from your local npm cache in seconds, and
if the cache is cold it prints the one command to run.

### Claude Code

APM deploys every skill to `.agents/skills/`. Claude Code does not read that directory: it
discovers skills in `~/.claude/skills`, `<repo>/.claude/skills`, and plugins, and nowhere else.
Adding `claude` to your `apm.yml` targets does not change this. APM's agent-specific targets govern
other primitives, and skills deploy to `.agents/skills/` either way. So when your repository has a
`.claude/` directory, the install also writes one relative symlink per skill:

```
.claude/skills/archie -> ../../.agents/skills/archie
```

Links, not copies. `.agents/skills/` stays the single source of bytes, which is what the release
record's per-file hashes verify; a copy would be a second version of each skill that nothing checks
and every upgrade has to remember. Each install reconciles the whole set, so a skill added, renamed
or dropped by an upgrade never leaves a broken one behind, and the uninstall removes them.

Archie writes a name only when it is free or already holds one of its own links. If
`.claude/skills/<name>` is a skill of yours, or your own link to somewhere else, it is left exactly
as it is and the install reports `Claude Code skills: blocked`, so you can see that that skill will
not reach Claude Code under that name.

No `.claude/` directory means no bridge and nothing created. That is how APM itself decides whether
a repository uses a given agent, and Archie does not seed agent directories a repository has not
asked for. Create `.claude/` and install again if you want them. Claude Code is the only agent
bridged today; the same mechanism extends to another that turns out not to read `.agents/skills/`.

Committing the links is your repository's choice, and depends on whether your `.gitignore` covers
`.claude/`. Committed, a clone or a new worktree has the skills immediately; ignored, each
developer gets them from their own install. Windows is the caveat: a checkout without symlink
support (developer mode off, or `core.symlinks=false`) turns committed links into plain text files
holding the link text, and Claude Code finds no skill there. Archie is developed and used on macOS
and Linux. If Windows matters to you, keep `.claude/` ignored and let each install create them.

## Use

Open your coding agent in the repository and invoke the `archie` skill. Describe the architecture
question or the change you are making. Archie works out what the repository needs and routes from
there.

## Uninstall

```bash
/tmp/archie-install/uninstall.sh
```

This replays the install journal, which holds the exact bytes of every path the install touched, so
paths that did not exist before are removed and paths that did are restored. A skills directory
holding skills Archie does not own keeps them, in `.agents/skills` and in `.claude/skills` alike.

`.archie/assessments/` is kept. It is your work product, not Archie's, and the uninstall says so
rather than quietly deleting it.

## Status

Archie is early. The version is `0.1.0-private.1`, the two release tags install an earlier
skills-only context, and the product is verified by installing it into real repositories and using
it rather than by a formal review gate. It is developed and used on macOS and Linux.

## License

[MIT](LICENSE). The bundled html-design artifact checker includes third-party code; see
[THIRD_PARTY_NOTICES.md](packages/html-design/skills/html-design/THIRD_PARTY_NOTICES.md).

## Development

See [AGENTS.md](AGENTS.md) for the monorepo layout, the generated files, and the verification gates,
and [the backlog](docs/archie/backlog.md) for outstanding work.

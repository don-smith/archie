# Archie

Architecture assessment, review, documentation, conformance, and drift detection, delivered to a
repository as one private package of agent skills plus a pinned runtime.

Archie is private. Nothing is published to npm, and installing it needs read access to this
repository and nothing else.

## Install

Run this from inside the repository you want Archie in:

```bash
git clone --depth 1 git@github.com:don-smith/archie.git /tmp/archie-install
cd /path/to/your/repo
/tmp/archie-install/install.sh
```

There is no `curl | bash` one-liner, deliberately. A private repository will not serve raw files
without a token, and cloning first means you can read `install.sh` before you run it — it is
commented throughout for exactly that.

You need Node 24, npm, git, and [APM](https://github.com/danielmeppiel/apm) 0.29 on your PATH. The
install checks all four up front and stops with a specific message if one is missing.

Options: `--target <dir>` to install somewhere other than the current directory, and
`--skip-browsers` to defer the Playwright download.

### What it does

1. Packs the Archie runtime and conformance artifacts from the clone. Nothing is compiled — the
   built output is committed — so no dependency install happens in the clone.
2. Has APM resolve the eight Archie skills from this repository at the clone's exact commit.
3. Finalizes a release record pinning all of it, and installs it into your repository.
4. Links the skills into `.claude/skills/` if your repository uses Claude Code (see below).
5. Downloads the Playwright browser, which is stored once per machine rather than per repository.

It never pushes, never tags, and never touches your application's `package.json` or
`package-lock.json`.

### What lands in your repository

| Path | Committed? |
|---|---|
| `.agents/skills/*` | yes — the eight skills, shared with your team |
| `.claude/skills/*` | your choice — symlinks, and only if you use Claude Code (see below) |
| `.archie/release/`, `.archie/version` | yes — the pin |
| `.archie/runtime/package-lock.json`, `.archie/runtime/npm/*.tgz` | yes — 177KB, so branches and worktrees hydrate offline |
| `apm.yml`, `apm.lock.yaml` | yes |
| `.archie/runtime/node_modules/` | no — machine-local, rehydrated on demand |

A fresh branch or worktree carries the pin but not the installed tree. You do not need to reinstall:
the first time the `archie` skill runs there, it hydrates from your local npm cache in seconds, and
if the cache is cold it prints the one command to run.

### Claude Code

APM deploys every skill to `.agents/skills/`. Claude Code does not read that directory: it
discovers skills in `~/.claude/skills`, `<repo>/.claude/skills`, and plugins, and nowhere else.
Adding `claude` to your `apm.yml` targets does not change this — APM's agent-specific targets
govern other primitives, and skills deploy to `.agents/skills/` either way. So when your repository
has a `.claude/` directory, the install also writes one relative symlink per skill:

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

Open your coding agent in the repository and invoke the `archie` skill. It works out what the
repository needs and routes from there.

## Uninstall

```bash
/tmp/archie-install/uninstall.sh
```

This replays the install journal, which holds the exact bytes of every path the install touched, so
paths that did not exist before are removed and paths that did are restored. A skills directory
holding skills Archie does not own keeps them, in `.agents/skills` and in `.claude/skills` alike.

`.archie/assessments/` is kept. It is your work product, not Archie's, and the uninstall says so
rather than quietly deleting it.

## Development

See [AGENTS.md](AGENTS.md) for the monorepo layout, the generated files, and the verification gates,
and [docs/archie/backlog.md](docs/archie/backlog.md) for outstanding work.

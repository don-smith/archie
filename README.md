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
4. Downloads the Playwright browser, which is stored once per machine rather than per repository.

It never pushes, never tags, and never touches your application's `package.json` or
`package-lock.json`.

### What lands in your repository

| Path | Committed? |
|---|---|
| `.agents/skills/*` | yes — the eight skills, shared with your team |
| `.archie/release/`, `.archie/version` | yes — the pin |
| `.archie/runtime/package-lock.json`, `.archie/runtime/npm/*.tgz` | yes — 177KB, so branches and worktrees hydrate offline |
| `apm.yml`, `apm.lock.yaml` | yes |
| `.archie/runtime/node_modules/` | no — machine-local, rehydrated on demand |

A fresh branch or worktree carries the pin but not the installed tree. You do not need to reinstall:
the first time the `archie` skill runs there, it hydrates from your local npm cache in seconds, and
if the cache is cold it prints the one command to run.

## Use

Open your coding agent in the repository and invoke the `archie` skill. It works out what the
repository needs and routes from there.

## Uninstall

```bash
/tmp/archie-install/uninstall.sh
```

This replays the install journal, which holds the exact bytes of every path the install touched, so
paths that did not exist before are removed and paths that did are restored. A skills directory
holding skills Archie does not own keeps them.

`.archie/assessments/` is kept. It is your work product, not Archie's, and the uninstall says so
rather than quietly deleting it.

## Development

See [AGENTS.md](AGENTS.md) for the monorepo layout, the generated files, and the verification gates,
and [docs/archie/backlog.md](docs/archie/backlog.md) for outstanding work.

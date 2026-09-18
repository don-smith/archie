#!/usr/bin/env bash
#
# Installs Archie into the repository you run it from.
#
#   git clone --depth 1 git@github.com:don-smith/archie.git /tmp/archie-install
#   cd /path/to/your/repo
#   /tmp/archie-install/install.sh
#
# Everything this script does is local to the repository you run it in, except
# for two network reads: npm fetches the runtime's public dependencies, and APM
# resolves the Archie skill context from GitHub. It never pushes, never tags,
# and never touches your application's package.json or package-lock.json.
#
# Run `uninstall.sh` from the same clone to reverse it.

set -euo pipefail

CLONE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$(pwd)"
SKIP_BROWSERS=0

while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="$(cd "$2" && pwd)"; shift 2 ;;
    --skip-browsers) SKIP_BROWSERS=1; shift ;;
    -h|--help) sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "install.sh: unknown option $1" >&2; exit 2 ;;
  esac
done

say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mInstall stopped:\033[0m %s\n' "$*" >&2; exit 1; }

# --- Preflight ---------------------------------------------------------------
# Archie pins Node 24. Failing here is far clearer than a stack trace later.

command -v node >/dev/null || die "Node is not on PATH. Archie needs Node 24."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" = "24" ] || die "Archie needs Node 24 (found $(node -v)). Its packages declare engines: node >=24 <25."
command -v npm >/dev/null || die "npm is not on PATH."
command -v git >/dev/null || die "git is not on PATH."
command -v apm >/dev/null || die "APM is not on PATH. Archie deploys its skills with APM 0.29; see https://github.com/danielmeppiel/apm."
[ -d "$TARGET/.git" ] || die "$TARGET is not a Git repository. Archie installs into a repository."

REF="$(git -C "$CLONE" rev-parse HEAD)"
git -C "$CLONE" diff --quiet || die "the Archie clone at $CLONE has local modifications; install from a clean clone so the pin matches a published commit."

# The pin is resolved from GitHub by APM, so the commit has to exist there.
git -C "$CLONE" cat-file -e "$REF^{commit}" 2>/dev/null || die "cannot resolve $REF in the Archie clone."

# --- Existing installs -------------------------------------------------------
# A v1 or v2 pin is a clean break: Archie reads only v3 records and refuses the
# older ones, so say exactly what to remove rather than failing deep in bootstrap.

if [ -f "$TARGET/.archie/release/release-record-v3.json" ]; then
  say "Archie is already installed here; upgrading it in place."
  MODE="upgrade"
elif [ -e "$TARGET/.archie/release" ] || [ -e "$TARGET/.archie/version" ]; then
  die "this repository holds a pre-v3 Archie pin. Remove it first:
    rm -rf $TARGET/.archie/release $TARGET/.archie/runtime $TARGET/.archie/version
  Your assessments in .archie/assessments are not affected."
else
  MODE="bootstrap"
fi

# --- APM target --------------------------------------------------------------
# The Archie context declares the agent-skills target. APM silently skips a
# package whose targets do not overlap the project's, exiting 0 with nothing
# deployed, so this is checked before anything is staged.

if [ -f "$TARGET/apm.yml" ] && ! grep -qE '^\s*-\s*agent-skills\s*$' "$TARGET/apm.yml"; then
  die "$TARGET/apm.yml does not list the agent-skills target, so APM would skip every Archie skill and still report success.
  Add this under its targets: and run the install again:
    - agent-skills"
fi

# --- Build the release bundle ------------------------------------------------
# packages/*/dist is committed, so nothing is compiled here: this packs the two
# artifacts, generates their shared npm lock, and has APM resolve the skill pin.

# The release CLIs import @archie/runtime by name. A bare clone has no
# node_modules, so the workspace links npm would create are made here directly:
# instant, offline, and enough because the release entry point deliberately
# avoids every third-party dependency.
mkdir -p "$CLONE/node_modules/@archie"
ln -sfn ../../packages/archie-runtime "$CLONE/node_modules/@archie/runtime"
ln -sfn ../../packages/conformance "$CLONE/node_modules/@archie/conformance"

BUNDLE="$(mktemp -d "${TMPDIR:-/tmp}/archie-bundle.XXXXXX")"
trap 'rm -rf "$BUNDLE"' EXIT

say "Building the release bundle from $REF"
node "$CLONE/packages/archie-cli/dist/release-cli.js" build \
  --bundle "$BUNDLE" --workspace "$CLONE" --ref "$REF"

say "Finalizing the release record"
node "$CLONE/packages/archie-cli/dist/release-cli.js" finalize \
  --bundle "$BUNDLE" --source-commit "$REF"

# --- Install -----------------------------------------------------------------

say "Installing Archie into $TARGET"
node "$CLONE/packages/archie-cli/dist/cli.js" "$MODE" --release "$BUNDLE" --target "$TARGET"

# --- Repository hygiene ------------------------------------------------------
# node_modules is machine-local and rehydrated on demand. The two tarballs are
# 177KB of plain JavaScript and are committed on purpose: without them a fresh
# branch or worktree holds a lock pointing at files that are not there. The
# negations re-include them for repositories whose root .gitignore has *.tgz.

say "Writing .archie/.gitignore"
mkdir -p "$TARGET/.archie"
cat > "$TARGET/.archie/.gitignore" <<'IGNORE'
# Machine-local: rehydrated by install.sh or on first use of the archie skill.
runtime/node_modules/
runtime/.npm-cache/

# Pinned Archie artifacts. Committed so branches and worktrees hydrate offline.
!runtime/npm/
!runtime/npm/*.tgz
IGNORE

# --- Browsers ----------------------------------------------------------------
# The runtime installs with --ignore-scripts, which is deliberate: it keeps
# arbitrary postinstall scripts in the dependency closure from running. That
# also means Playwright never downloads its browser, so it is requested here,
# explicitly and on its own. The download is machine-global (~/.cache/
# ms-playwright), so it happens once per machine rather than once per repository.

if [ "$SKIP_BROWSERS" = "1" ]; then
  say "Skipping the Playwright browser (--skip-browsers). Rendering will not work until you run: npx playwright install chromium"
else
  say "Installing the Playwright browser (once per machine; ~150MB on a cold cache)"
  (cd "$TARGET/.archie/runtime" && npx --yes playwright install chromium) \
    || say "Playwright browser install failed. Archie is installed; run 'npx playwright install chromium' before using rendering."
fi

# --- Done --------------------------------------------------------------------

cat <<DONE

Archie is installed in $TARGET.

  Committed:   .archie/release, .archie/version, .archie/runtime/package-lock.json,
               .archie/runtime/npm/*.tgz, .agents/skills/*, apm.yml, apm.lock.yaml
  Not committed: .archie/runtime/node_modules (rehydrated on demand)

Next: open your coding agent in this repository and invoke the 'archie' skill.
It will work out what this repository needs and route you from there.

To remove Archie: $CLONE/uninstall.sh --target $TARGET
DONE

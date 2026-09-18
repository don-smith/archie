#!/usr/bin/env bash
#
# Removes Archie from the repository you run it from.
#
#   /tmp/archie-install/uninstall.sh
#
# This replays the install journal Archie wrote, which holds the exact bytes of
# every path the install touched. Paths that did not exist before are removed;
# paths that did are restored. Nothing is guessed from the directory layout, so
# a skills directory holding skills Archie does not own keeps them.
#
# Your assessments in .archie/assessments are work product Archie creates but
# does not own. They are always kept, and named in the output if present.

set -euo pipefail

CLONE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$(pwd)"
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="$(cd "$2" && pwd)"; shift 2 ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "uninstall.sh: unknown option $1" >&2; exit 2 ;;
  esac
done

say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mUninstall stopped:\033[0m %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null || die "Node is not on PATH."
[ -f "$TARGET/.archie/release/install-journal.json" ] \
  || die "no Archie install journal at $TARGET/.archie/release/install-journal.json.
  Without it nothing can be removed safely, because there is no record of what Archie added
  and what was already there. Remove the pin by hand if you are sure:
    rm -rf $TARGET/.archie/release $TARGET/.archie/runtime $TARGET/.archie/version"

if [ "$ASSUME_YES" != "1" ]; then
  printf 'Remove Archie from %s? [y/N] ' "$TARGET"
  read -r reply
  case "$reply" in [yY]*) ;; *) echo "Nothing was changed."; exit 0 ;; esac
fi

say "Replaying the install journal"
node --input-type=module -e '
import { uninstallTarget } from "'"$CLONE"'/packages/archie-runtime/dist/release.js";
const result = uninstallTarget(process.argv[1]);
console.log(JSON.stringify(result));
' "$TARGET" > "${TMPDIR:-/tmp}/archie-uninstall.$$.json"

PRESERVED="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).preserved.join(", ")' "${TMPDIR:-/tmp}/archie-uninstall.$$.json")"
rm -f "${TMPDIR:-/tmp}/archie-uninstall.$$.json"

cat <<DONE

Archie has been removed from $TARGET.
DONE

if [ -n "$PRESERVED" ]; then
  cat <<KEPT
Kept on purpose: $PRESERVED
  This is your own work product, not Archie's. Nothing else refers to it, and
  reinstalling Archie will pick it up again. Delete it yourself if you mean to.
KEPT
fi

cat <<NEXT

Your repository still has the Archie files that were committed, now deleted in
the working tree. Review and commit the deletions when you are ready:
  git -C $TARGET status
NEXT

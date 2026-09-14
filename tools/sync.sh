#!/usr/bin/env bash
#
# Keep the eight standalone repositories and this one in step.
#
#   tools/sync.sh push [app ...]     work done here → each app's own repo
#   tools/sync.sh pull [app ...]     work done there → here
#   tools/sync.sh status             what has diverged, changing nothing
#
# With no app named, every app is done.
#
# WHY BOTH DIRECTIONS
# -------------------
# The eight repositories are not history. Each is still the address its trainer
# is published from, still the thing somebody else can fork, and still where an
# issue about that trainer belongs. A merge that quietly killed all eight would
# have traded those away for a directory layout.
#
# So the monorepo is where the work happens and the eight are downstream — but
# `pull` exists because sooner or later a fix will land in one of them directly,
# from a phone or from somebody else's pull request, and the alternative to
# pulling it is retyping it.
#
# `git subtree` recomputes the mapping between this repository's history and the
# app's on every run. It is slow — tens of seconds for Syllogimous — and it is
# not broken.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
manifest="tools/apps.json"
owner="${MINDBUILD_OWNER:-Gagafutzi}"

command -v git >/dev/null || { echo "no git" >&2; exit 1; }

# Reads the manifest without a JSON dependency beyond the node already required
# to build the site.
apps() {
  node -e '
    const m = require("./tools/apps.json");
    const want = process.argv.slice(1);
    for (const a of m.apps) {
      const name = a.prefix.replace(/^apps\//, "");
      if (want.length && !want.includes(name)) continue;
      console.log([name, a.prefix, a.repo, a.branch].join(" "));
    }
  ' "$@"
}

remote_for() { echo "git@github.com:${owner}/$1.git"; }

# A dirty tree makes every one of these operations ambiguous, and `subtree` is
# not the place to find that out.
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Commit or stash first." >&2
  exit 1
fi

cmd="${1:-}"; shift || true

case "$cmd" in
  push)
    apps "$@" | while read -r name prefix repo branch; do
      echo "── $name → $repo"
      # `git subtree push` prints a progress counter per commit — a thousand of
      # them, carriage-returned onto one line, which scrolls the actual result
      # off the top of anything capturing the output.
      git subtree push --prefix="$prefix" "$(remote_for "$repo")" "$branch" 2>&1 \
        | tr '\r' '\n' | grep -vE '^[0-9]+/[0-9]+ ' || true
    done
    ;;

  pull)
    apps "$@" | while read -r name prefix repo branch; do
      echo "── $name ← $repo"
      # No --squash: the histories were grafted unsquashed and mixing the two
      # produces a subtree that can no longer be split.
      git subtree pull --prefix="$prefix" "$(remote_for "$repo")" "$branch" \
        -m "Take $name's own commits back from $repo"
    done
    ;;

  status)
    apps "$@" | while read -r name prefix repo branch; do
      remote="$(remote_for "$repo")"
      git fetch -q "$remote" "$branch" 2>/dev/null || { printf "%-12s unreachable\n" "$name"; continue; }
      here="$(git subtree split --prefix="$prefix" 2>/dev/null | tail -1)"
      there="$(git rev-parse FETCH_HEAD)"
      if [ "$here" = "$there" ]; then
        printf "%-12s in step\n" "$name"
      elif git merge-base --is-ancestor "$there" "$here" 2>/dev/null; then
        printf "%-12s %s commit(s) to push\n" "$name" "$(git rev-list --count "$there..$here")"
      elif git merge-base --is-ancestor "$here" "$there" 2>/dev/null; then
        printf "%-12s %s commit(s) to pull\n" "$name" "$(git rev-list --count "$here..$there")"
      else
        printf "%-12s diverged — pull before pushing\n" "$name"
      fi
    done
    ;;

  *)
    sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac

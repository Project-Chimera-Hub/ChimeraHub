# mindbuild

Eight trainers, one record, one day's total — and a quota the desktop enforces.

```
apps/       the eight grafted in with git subtree, histories intact — and rrt,
            which was written here
shell/      the hub: a menu, a frame to run a trainer in, and the meter
gate/       the quota, and the window that holds you to it
tools/      the build
```

## Why it is a shell and not a rewrite

Eight repositories were merged here by **moving** them. An Angular app, a Vite
app, and six pages of plain HTML, each still exactly what it was and each still
buildable on its own — Syllogimous still produces its Android APK from
`apps/syllogimous` without knowing this repository exists.

The alternative was one framework and one rewrite, and it was never close.
Seven working trainers are worth more than seven consistent ones, and the merge
that rewrites them is the merge that never finishes.

So the shared part is small on purpose: `tools/build-site.mjs` decides where
each app lands, and nothing else touches an app's source.

## What actually makes it one application

Not the menu. The meter.

The archive already had adapters that turn any of eight storage formats into
minutes-per-day — that is the only code in this project that understands all of
them, and it already has to be right for the archive to be worth anything. The
shell hands it the same snapshots and reads the same numbers back:

```
a trainer's localStorage  →  apps/archive/js/adapters.js  →  minutes for today
```

That is the reason to put them on one origin. They shared an origin on GitHub
Pages already, which is why moving them here changed nobody's saved history:
localStorage is per origin, not per path.

The shell never writes to a trainer's keys, never injects script into a frame,
and never asks a trainer to report anything. A trainer that has never heard of
this page works here exactly as well as one that has — which is the whole
reason eight repositories could be merged in an afternoon.

## Reading an app's history

Every commit from all eight repositories is here — 1100 of them — but

```bash
git log -- apps/rnb          # shows about seven
```

is not how to see them. `git subtree add` grafts the original history on as a
parent, and those commits carry their *original* paths: RNB's work is recorded
against `js/deck.js`, not `apps/rnb/js/deck.js`. The path filter finds only the
graft and what came after.

```bash
git log --follow -- apps/rnb/js/deck.js   # crosses the rename
git log <a commit from before the graft>  # the old history, from its own tip
```

Nothing is lost; it is indexed under the name it had at the time.

## Build

```bash
node tools/build-site.mjs        # → dist/, based at /mindbuild/
BASE=/ node tools/build-site.mjs # → dist/, at a domain root
```

`.github/workflows/pages.yml` is the only workflow that runs. Each app kept its
own when it was grafted in; GitHub reads workflows from the root only, so those
are inert history rather than eight competing deploys.

## Test

```bash
node test/run.js                 # the shell's meter
node apps/archive/test/run.js    # the archive's merge
python3 gate/test_gate.py        # the gate's decisions, with no display
```

## The gate

A training quota your desktop enforces: under it, a window sits over the screen
with the trainers in it. It counts off disk — out of Firefox's own SQLite,
through the same adapters — because a rule enforced by the thing it is a rule
about is not a rule.

It never touches PAM or the greeter, so it is escapable, deliberately:
**Ctrl-Alt-F3 → `systemctl --user stop mindbuild-gate`** always works. See
[gate/README.md](gate/README.md) before installing it.

## The archive is not a trainer

It is the record, it is a file, and the file is the point — nothing a browser
holds survives clearing site data. Time spent maintaining it is not training and
is never counted toward the quota: a quota that could be met by tidying is a
quota that will be.

## Third-party art

One thing here was not written here: the animal silhouettes in
`apps/rrt/animals.js`, from [game-icons.net](https://game-icons.net) by
Delapouite, Lorc, Skoll and Caro Asercion, used under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The credit is carried
in that file, in [apps/rrt/README.md](apps/rrt/README.md), and beside the
setting that turns them on. Everything else is the repository's own.

# mindbuild

Eight trainers, one record, one day's total — and a quota the desktop enforces.

```
apps/       the eight grafted in with git subtree, histories intact — and rrt,
            which was written here
shell/      the hub: a menu, a frame to run a trainer in, and the meter
gate/       the quota, and the window that holds you to it
tools/      the build
sketches/   probes rather than trainers: one page, one question, a number
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

One run, two sites. `dist/` is the hub; `dist/open/` is the same hub with the
gate taken out. See below.

`.github/workflows/pages.yml` is the only workflow that runs. Each app kept its
own when it was grafted in; GitHub reads workflows from the root only, so those
are inert history rather than eight competing deploys.

## Android

```bash
tools/build-apk.sh              # → apk/mindbuild-debug.apk
```

A new version is that command again. There is no app source to update: the APK
is `tools/build-site.mjs`'s output in a WebView, so rebuilding the site is
rebuilding the app, and `tools/apk/` holds only what Capacitor needs to wrap it.
Both generated directories there — `www/`, a copy of `dist/`, and `android/`,
scaffolded from `capacitor.config.ts` — are ignored rather than checked in, for
the same reason `dist/` is.

It is not a browser pointed at the Pages site. The whole site is copied inside
and it runs with the network off, which is the same promise the archive makes
about a USB stick in five years and is worth more on a phone than anywhere
else. It is also not gated: the build sets `APK=1`, which puts the **gate-free**
hub at the root, because on a phone there is no daemon to answer `127.0.0.1`
and no screen for one to hold.

Building needs a JDK and an Android SDK. If you have neither, do not install
them — push a `v*` tag, or press **Run workflow** on *Build APK* in the Actions
tab, and let the runner hand you the file. That is the point of
`.github/workflows/apk.yml`: it runs on request rather than on every push,
because an APK is not something anyone wants forty of.

The icon and splash are generated from `shell/favicon.svg`, so the mark on the
home screen is the mark in the tab.

The output is signed with the debug key: enough to install on your own phone,
not enough for the Play Store.

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

## The hub without the gate, at `open/`

The hub posts a heartbeat to `127.0.0.1:8787` so the gate knows a session is
live. On a machine with no gate installed nothing answers it, and to a privacy
extension a website reaching into the local network is a port scan — Port
Authority and uBlock's LAN list both stop it and say so. They are right to. The
request was never going to be answered on that machine anyway, so all it could
produce there was the warning.

So the build writes a second site beside the first:

```
dist/        the hub, gate wiring and all
dist/open/   the same hub, and nothing that talks to this machine
```

No heartbeat, no gate card, and no quota line — nothing set that number and
nothing is enforcing it, so a "12 min to go" would be a demand invented by the
page making it. The figure, the bar, the streak and the caps stay, because what
happened is true either way.

It is one generated file. `tools/build-site.mjs` takes `shell/index.html`, cuts
between the `gate:begin`/`gate:end` markers, sets `data-gate="off"`, and points
every asset at the parent directory — the same stylesheet, the same scripts,
the same adapters, the same eight trainers, not copies of any of them. Nothing
here can drift from the site above it, because there is nothing here to drift:
one attribute, and `shell/js/shell.js` reads it.

Same origin, so the same saved history. `mindbuild/` and `mindbuild/open/` are
one localStorage between them — train in either and the other has counted it.

The two are identical in every other respect, the look included.

## The look, and the background

Monospace throughout, wide-tracked caps for anything that announces itself,
desaturated sage on near-black, and not one rounded corner. It replaced Loosh —
Syllogimous's theme, ported by hand: crimson, 16px radii, a sigil behind it all.

Still no build step and still no webfont. The display face is whatever monospace
the machine already has, for the same reason the archive has neither: a page
that renders identically on a plane is worth more than one that renders slightly
better online.

The hierarchy is type, not colour. A heading is a heading because it is tracked
out to `.3em`, not because it is a different colour from the paragraph under it
— which is why the background can be swapped for any photograph at all without
the page falling apart.

**Appearance → Background → Choose image** does exactly that, and it is the one
setting here. The picture is downscaled to 2560px, re-encoded, and kept in
**IndexedDB** — deliberately not in localStorage, because that is where every
trainer's history lives and the quota there is shared between all of them. A
couple of megabytes of wallpaper is exactly what would push a Syllogimous
history of a thousand items over the edge. Nothing decorative gets to compete
with a record.

It never leaves the machine. There is nowhere for it to go: these are static
pages, and the gate-free one does not make a request to anything.

The default is drawn rather than photographed — three stands of firs, seeded and
rejection-sampled onto a sloped ground, with fog between them, as an inline SVG.
No request to anybody, nothing to license, nothing to go 404 in a year.

One thing is deliberately not sage: the eight colour dots on the trainer cards.
They are the same eight hues as the segments in the day's bar, and that pairing
is the only thing tying a card to its share of the day. They are data, not
decoration.

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

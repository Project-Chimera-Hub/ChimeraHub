# Chimera Hub

Four trainers and three more exercises, one record, one day's total — and a
quota the desktop enforces.

**Live:** <https://project-chimera-hub.github.io/ChimeraHub/> ·
**Community:** [Discord](https://discord.com/invite/chmr)

```
apps/       the trainers, each grafted in with git subtree and its history
            intact, plus the archive that keeps the record
apps/more/  the additional exercises, in their own box, not counted toward
            the day
shell/      the hub: a menu, a frame to run a trainer in, and the meter
gate/       the quota, and the window that holds you to it
shared/     code that belongs to the hub and the gate but to no one app
tools/      the build, the APK, and the upstream sync
sketches/   probes rather than trainers: one page, one question, a number
test/       the hub's tests
```

## The trainers

| Trainer | What it trains |
|---|---|
| CCT | spoken arithmetic against the clock |
| Chimera | add the digits you hear, judge the number you see — with n-back, eWMT, CCT and dichotic modes stacked on top |
| eWMT | the Affective N-Back: position, colour and voice, n steps back |
| Relational N-back | four streams of relations, n back |

And three **additional exercises**, which run here like the four but are not
counted toward the day:

| Exercise | What it trains |
|---|---|
| Attention Training | selective, switching and divided attention over a soundscape |
| Earshot | tracking moving sounds by ear — 3D multiple object tracking for the ears |
| N-back Constant Change | Quad Box's 3D quad n-back, with modalities and variant that keep changing (Vite) |

All seven come from [projectchimera-dot](https://github.com/projectchimera-dot).
The **Training archive** sits beside them: not a trainer, the record.

## A shell, not a rewrite

Each app was merged here by **moving** it, not rewriting it. A Svelte app built
with Vite and a set of plain HTML pages are each still exactly what they were
and each still runs on its own, without knowing this repository exists.
Working trainers are worth more than consistent ones.

So the shared part is small on purpose: `tools/build-site.mjs` decides where
each app lands, and nothing else touches an app's source.

## What makes it one application: the meter

The archive has adapters that turn every trainer's storage format into
minutes per day. The hub hands it the same snapshots and reads the same numbers
back:

```
a trainer's localStorage  →  apps/archive/js/adapters.js  →  minutes for today
```

That is why everything is served from one origin. The hub never writes to a
trainer's keys, never injects script into a frame, and never asks a trainer to
report anything — a trainer that has never heard of this page works here
exactly as well as one that has.

## Reading an app's history

`git subtree add` grafts each app's original history on as a parent, and those
commits carry their *original* paths, so

```bash
git log -- apps/relational                     # shows only the graft and after
git log --follow -- apps/relational/src/app.js # crosses the rename
```

Nothing is lost; it is indexed under the name it had at the time.

## Build and deploy

```bash
node tools/build-site.mjs        # → dist/, based at /ChimeraHub/
BASE=/ node tools/build-site.mjs # → dist/, at a domain root
```

One run, two sites: `dist/` is the hub, `dist/open/` is the same hub with the
gate taken out (see below).

Every push to `main` builds and publishes the site through
`.github/workflows/pages.yml` (**Deploy site**), which can also be started by
hand from the Actions tab. It needs **Settings → Pages → Source: GitHub
Actions**. Each app kept its own old workflows when it was grafted in; GitHub
reads workflows from the root only, so those are inert history.

**Visit counts.** Set a repository variable `GOATCOUNTER` to a
[GoatCounter](https://www.goatcounter.com) site code and the deployed hub
counts page views, one per hub visit and one per trainer opened. No cookies and
no personal data. The snippet is added by the build only, so the source, a
local build and the APK make no outbound request at all.

## Sharing data

The hub used to carry a **Share your data** card for Syllogimous's answers; it
left with Syllogimous. The kit behind it stays, standalone and reusable —
[`shared/share-kit/`](shared/share-kit/README.md) explains what it is for and
how to add it to another tool — and `node tools/check-shared.mjs <folder>`
still validates and merges uploads into `chimerahub-dataset/`, which is
ignored by git.

## Android

```bash
tools/build-apk.sh              # → apk/chimerahub-debug.apk
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
**Ctrl-Alt-F3 → `systemctl --user stop chimerahub-gate`** always works. See
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
the same adapters, the same trainers, not copies of any of them. Nothing
here can drift from the site above it, because there is nothing here to drift:
one attribute, and `shell/js/shell.js` reads it.

Same origin, so the same saved history. `ChimeraHub/` and `ChimeraHub/open/` are
one localStorage between them — train in either and the other has counted it.

The two are identical in every other respect, the look included.

## The look, and the background

Monospace throughout, wide-tracked caps for anything that announces itself,
old gold on black, and not one rounded corner. It replaced Loosh —
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
couple of megabytes of wallpaper is exactly what would push a long training
history over the edge. Nothing decorative gets to compete
with a record.

It never leaves the machine. There is nowhere for it to go: these are static
pages, and the gate-free one does not make a request to anything.

The default is drawn rather than photographed — three stands of firs, seeded and
rejection-sampled onto a sloped ground, with fog between them, as an inline SVG.
No request to anybody, nothing to license, nothing to go 404 in a year.

One thing is deliberately not gold: the colour dots on the trainer cards.
They are the same hues as the segments in the day's bar, and that pairing is
the only thing tying a card to its share of the day. They are data, not
decoration.

The archive wears this theme too — the same palette, the same type, the same
drawing behind it. It cannot import the stylesheet, because it is published as
its own repository with no build step, so the theme is a copy and `test/run.js`
holds the two files to the same values. Two pages one click apart that look
like two applications is the thing a shared look exists to prevent.

## Retired trainers, and what removing them kept

Syllogimous, Isomorph, the ladder Relational N-back, Precision N-back, 3D
Rotation, Synaesthesia colours, Running Order, the Attentional Shield eWMT,
DorsalFlow and Controlled Hallucination all used to be here. They are gone
from the hub; their history is in this repository's log.

**What was removed is the trainers. What reads their records stays**, and the
distinction is the whole reason this repository has an archive. Every adapter
for a retired trainer is still in `apps/archive/js/adapters.js`, so a file
somebody exported in 2025, or a browser that still holds the keys, is still
months of their training and still reads. A record that stops being readable
when an app is retired is not a record.

The meter reads them too, for the streak — a day trained is a day trained —
but counts only the four trainers on the hub toward today and the quota:
`TRAINERS` in `shell/js/shell.js` is the filter.

Two names carried over. **eWMT** is the Affective N-Back now, under the source
name the Attentional Shield had, because it is the same slot and a day of
either is a day of eWMT. **Relational N-back** is the four-stream trainer now,
under a new source name (`relational`), because the ladder trainer that had the
name measured difficulty in a different unit and the archive never lets a
number travel without its unit.

## The archive is not a trainer

It is the record, it is a file, and the file is the point — nothing a browser
holds survives clearing site data. Time spent maintaining it is not training and
is never counted toward the quota: a quota that could be met by tidying is a
quota that will be.

## Additional exercises, not counted

`apps/more/` holds exercises the hub opens like any other but keeps in a box
of their own, below the trainers: none has an adapter, so the meter cannot see
them and their minutes do not count toward the day or the quota. Writing one
an adapter is what moves it up into `TRAINERS` in `shell/js/shell.js`.

- `att/` — Attention Training: selective attention, rapid switching and divided
  attention over a set of environmental sounds, one page with its sounds beside
  it. It keeps a `.wav` of every `.mp3` it plays and asks only for the mp3s, so
  the build leaves the wavs out of the site and the APK.
- `earshot/` — Earshot: identical sounds move around your head and you follow
  the targets by ear, with the speed adapting to find your threshold. Plain
  pages; every sound is synthesised in the browser. Headphones are needed.
- `quadbox/` — N-back Constant Change: Quad Box's 3D quad n-back, with a
  schedule that redraws the variant every training day and the permutation of
  modalities on a plateau. A Svelte app; `tools/build-site.mjs` builds it with
  Vite at a relative base, so the same output runs on Pages, under `open/` and
  in the APK.

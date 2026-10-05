# Chimera Hub

Eight trainers and three more exercises, one record, one day's total — and a
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
shared/     code that belongs to the hub and the gate but to no one app,
            including harness/: the trainer harness and the record format
templates/  the trainer a new one starts from
tools/      the build, the APK, the upstream sync, and the tools a trainer
            is made, checked and accepted with
sketches/   probes rather than trainers: one page, one question, a number
test/       the hub's tests
```

## Categories

The hub's trainers are laid out like apps on a phone. Each category is a
folder on the home screen, showing a preview of what is inside; tapping one
opens it, and folders can hold folders. Every trainer sits in one place: its
first category, or a folder inside it. All of it comes from
`shell/js/catalog.js`, the one list of trainers, categories and folders.

| Folder | | Inside |
|---|---|---|
| RRT | relational reasoning training | Syllogimous, Running Order, and the **Relational N-back** folder: Relation Streams, Relational N-back |
| N-back | | eWMT, Threshold N-back, N-back Constant Change |
| CCT | cognitive control training | CCT, Chimera |
| ATT | attention training technique | Attention Training |
| MOT | multiple object tracking | Earshot |
| Posner, Spatial, Imagery, Inhibition, Speed, Other | | empty, with a link to submit a trainer |

A trainer's other categories (Relation Streams and Relational N-back are
n-backs too, Chimera has n-back modes) stay in the catalog for the data and
the submission check, without a second copy on the screen.

## The trainers

| Trainer | What it trains |
|---|---|
| Syllogimous | relational and syllogistic reasoning (Angular) |
| Relation Streams | n-back over relations, with a ladder |
| CCT | spoken arithmetic against the clock |
| Chimera | add the digits you hear, judge the number you see — with n-back, eWMT, CCT and dichotic modes stacked on top |
| eWMT | the Affective N-Back: position, colour and voice, n steps back |
| Relational N-back | four streams of relations, n back |
| Running Order | relational reasoning at CCT's pace: each card places a symbol, you name its rank |
| Threshold N-back | n-back at your perceptual threshold for sound and position, held there by a staircase (React, Vite) |

And three **additional exercises**, which run here like the eight but are not
counted toward the day:

| Exercise | What it trains |
|---|---|
| Attention Training | selective, switching and divided attention over a soundscape |
| Earshot | tracking moving sounds by ear — 3D multiple object tracking for the ears |
| N-back Constant Change | Quad Box's 3D quad n-back, with modalities and variant that keep changing (Vite) |

Syllogimous, Relation Streams, Running Order and Threshold N-back come from
[Gagafutzi](https://github.com/Gagafutzi) — the last three by way of
[mindbuild](https://github.com/Gagafutzi/mindbuild), this hub's predecessor —
and the other seven from [projectchimera-dot](https://github.com/projectchimera-dot).
The **Training archive** sits beside them: not a trainer, the record.

## A shell, not a rewrite

Each app was merged here by **moving** it, not rewriting it. An Angular app, a
Svelte app built with Vite and a set of plain HTML pages are each still exactly
what they were and each still runs on its own, without knowing this repository
exists — Syllogimous still produces its Android APK from `apps/syllogimous`.
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

`dist/` is the hub; `dist/open/` is the same page again, kept so older links
still work.

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

## Adding a trainer

Anyone can build a trainer and submit it; the hub's leaders approve what goes
on. [CONTRIBUTING-TRAINERS.md](CONTRIBUTING-TRAINERS.md) is the whole of it
for a developer — the criteria, and how to submit. In short:

- **Build it on the harness.** `node tools/new-trainer.mjs <id> --category …`
  writes a complete trainer (Posner cueing) on `shared/harness/`, which gives
  every trainer the same screens, look, pausing, timing, settings, level and
  record, and runs on its own with nothing fetched.
- **Check it.** `node tools/check-trainer.mjs <dir> --browser` tests every
  criterion a program can: the record format and a real sample of it, no
  network, pausing, staying in its frame, phone width, license, README, size.
- **Submit it** with the *Submit a trainer* issue form. The **Trainer
  submission** workflow (`.github/workflows/trainer-submission.yml`) runs the
  check on the repository and reports on the issue. A leader's `approved`
  label grafts it into `apps/<id>/` with its history, adds it to the catalog
  (`tools/add-trainer.mjs`) and opens a pull request; `CODEOWNERS` makes a
  leader's review of that pull request the second approval, and merging it
  deploys the trainer.

`tools/build-site.mjs` builds or copies every catalog trainer that has a
`chimera.json`, so accepting one never means editing the build.

For the approval to be enforced, **Settings → Branches** needs a rule on
`main` requiring a pull request with review from Code Owners. A repository
secret `SUBMISSIONS_TOKEN` (fine-grained, contents and pull requests: write)
lets the import pull request start the tests by itself.

## The record format

Every trainer submitted from now on writes its sessions in **the Chimera
record format** — [shared/harness/FORMAT.md](shared/harness/FORMAT.md) — under
`chimera.<app>.record.v1` in localStorage: a table of sessions, each with an
optional table of trials, with fixed columns that may be left empty where a
trainer does not measure something. The archive reads it with one general
adapter (`readChimeraRecord`), and the meter, "Read this browser" and the
gate's Firefox scan all find those keys by pattern, so a trainer that writes
it is counted, archived and shareable without a line of hub code. The
trainers already here keep their own adapters, which produce the same records.

## Sharing data

The hub's **Share your data** card makes a file of every session this browser
holds and leaves the upload to the player: the hub itself still sends nothing.
It reads:

- **Syllogimous, Relation Streams, CCT, Chimera, Relational N-back, Running
  Order and Threshold N-back**
  through the archive's adapters, the same readings the meter counts
  from (`Today.readings()`), along with any retired trainer still in the
  browser. Syllogimous (and Isomorph, if it was ever played) go in answer by
  answer, as they always did.
- **Earshot** (`earshot.sessions.v1`) and **Quad Box** (its `QuadBoxNBack`
  IndexedDB) directly, in `shell/js/share.js`, because the meter does not count
  them and so they have no adapter. The Quad Box database is only ever opened,
  never created: an empty one made by the hub would stop Quad Box saving games.
- **Not eWMT or Attention Training.** eWMT keeps running totals and no
  sessions, and ATT keeps nothing.

One row is one session (one answer for Syllogimous and Isomorph), in
[share-kit](shared/share-kit/README.md)'s fixed format, with `level` in the
trainer's own unit: Syllogimous's level, Relation Streams' load, CCT's and
Chimera's peak items a minute, Relational N-back's and Quad Box's n, Earshot's speed threshold in degrees per second. `app` says
which, and levels are never comparable across apps.

`node tools/check-shared.mjs <folder>` validates and merges uploads into
`chimerahub-dataset/`, which is ignored by git.

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
else. The build sets `APK=1`, which writes the hub at the root without the
analytics counter.

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
node test/run.js                 # the shell's meter, the catalog, the record
                                 # format, the harness and the submission tools
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

The website no longer talks to it. The hub used to post a heartbeat to
`127.0.0.1:8787` and show a Gate card; both are gone, so opening the site never
asks for local-network access and never trips a privacy extension. The gate
still works, counting off disk alone — the scan-only fallback described in its
README, which is coarser by a minute or two.

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

**Appearance → Background** offers the two drawn pictures — **Lake**, the
default, and **Forest** — or **Choose image** for a picture of your own, and it
is the one setting here. Lake is a large moon low over still water, its light
broken across it, with mountains, fog, dark shores and firs; it is drawn by
`tools/backgrounds/lake.py` into `shell/backgrounds/lake.svg`, and into
`lake-tall.svg` framed for a phone held upright. Change a number there and run
it again to redraw it. The archive keeps the forest, as it cannot load the
hub's files. The picture is downscaled to 2560px, re-encoded, and kept in
**IndexedDB** — deliberately not in localStorage, because that is where every
trainer's history lives and the quota there is shared between all of them. A
couple of megabytes of wallpaper is exactly what would push a long training
history over the edge. Nothing decorative gets to compete
with a record.

It never leaves the machine. There is nowhere for it to go: these are static
pages, and the hub does not make a request to anything.

The default is drawn rather than photographed — three stands of firs, seeded and
rejection-sampled onto a sloped ground, with fog between them, as an inline SVG.
No request to anybody, nothing to license, nothing to go 404 in a year.

One thing is deliberately not gold: the colour dots on the trainer cards.
They are the same hues as the segments in the day's bar, and that pairing is
the only thing tying a card to its share of the day. They are data, not
decoration.

**Every trainer wears it as well**, without being rewritten. The plain-page
trainers (Running Order, CCT, Relational N-back, eWMT, Chimera, Attention
Training, Earshot) each carry a `chimera-hub.css`, linked last in their
`<head>`, that reassigns the app's own colour, type and corner variables to
the hub's and squares its controls; colours that carry meaning in the task —
right, wrong, a stimulus's hue — are left as each app chose them. Delete the
one `<link>` and the app is what it was. Syllogimous defaults to its "Chimera
Hub" theme (a saved theme is kept), Quad Box's dark theme is re-coloured in
its `app.css`, and Relation Streams, Threshold N-back and the archive were
already in it. None of them fetches a font, an icon set or a script: Syllogimous
used to, and a webfont `@import` that failed offline left its entire
stylesheet unapplied. `test/run.js` checks every trainer's page for both.

The archive wears this theme too — the same palette, the same type, the same
drawing behind it. It cannot import the stylesheet, because it is published as
its own repository with no build step, so the theme is a copy and `test/run.js`
holds the two files to the same values. Two pages one click apart that look
like two applications is the thing a shared look exists to prevent.

## Retired trainers, and what removing them kept

Isomorph, 3D Rotation, Synaesthesia colours, the Attentional Shield eWMT,
DorsalFlow and Controlled Hallucination all used to be here. They are gone
from the hub; their history is in this repository's log.

**What was removed is the trainers. What reads their records stays**, and the
distinction is the whole reason this repository has an archive. Every adapter
for a retired trainer is still in `apps/archive/js/adapters.js`, so a file
somebody exported in 2025, or a browser that still holds the keys, is still
months of their training and still reads. A record that stops being readable
when an app is retired is not a record.

The meter reads them too, for the streak — a day trained is a day trained —
but counts only the eight trainers on the hub toward today and the quota:
`TRAINERS` in `shell/js/shell.js` is the filter.

**Running Order and Precision N-back came back** from mindbuild, where work on
both carried on after they left. Precision N-back is **Threshold N-back** on
the hub — the name says what it does: a staircase holds every modality at the
edge of what you can tell apart. Its source is still `precision` and its
history is still under `nback-performance`, so the archive's adapter never
noticed the rename. It loaded Tailwind, Tone.js and Chart.js from CDNs and so
did not start offline; they are built and bundled now. Running Order's webfont
went for the same reason.

Two names carried over. **eWMT** is the Affective N-Back now, under the source
name the Attentional Shield had, because it is the same slot and a day of
either is a day of eWMT. **Relational N-back** is the four-stream trainer,
under its own source name (`relational`). The ladder trainer that had the name
first is back on the hub as **Relation Streams** (source `rnb`), renamed so the
two are never mistaken for each other: they measure difficulty in different
units, and the archive never lets a number travel without its unit.

## The archive is not a trainer

It is the record, it is a file, and the file is the point — nothing a browser
holds survives clearing site data. Time spent maintaining it is not training and
is never counted toward the quota: a quota that could be met by tidying is a
quota that will be.

## Additional exercises, not counted

`apps/more/` holds exercises the hub opens like any other but does not count:
none has an adapter, so the meter cannot see them and their minutes do not
count toward the day or the quota. On the menu they sit in their categories
beside the counted trainers, with "Not counted" where the minutes would be and
a dashed edge. Writing one an adapter — or having it write the Chimera record
format — is what sets `counted: true` on it in `shell/js/catalog.js`.

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

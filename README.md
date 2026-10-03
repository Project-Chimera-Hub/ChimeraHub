# Chimera Hub

Ten trainers, one record, one day's total — and a quota the desktop enforces.

**Live:** <https://project-chimera-hub.github.io/ChimeraHub/> ·
**Community:** [Discord](https://discord.com/invite/chmr)

```
apps/       the trainers, each grafted in with git subtree and its history
            intact, plus the archive that keeps the record
apps/more/  DorsalFlow and Controlled Hallucination, in their own box, not
            yet counted toward the day
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
| Syllogimous | relational and syllogistic reasoning (Angular) |
| Relational N-back | n-back over relations, with a ladder |
| Precision N-back | n-back with a tighter response window (Vite) |
| 3D Rotation | mental rotation of molecules |
| CCT | spoken arithmetic against the clock |
| eWMT | attentional shield n-back |
| Running Order | relational updating — a running order of symbols |
| Synaesthesia colours | grapheme–colour association |
| DorsalFlow | motion in noise, by eye or — AudioFlow — by ear (not yet counted) |
| Controlled Hallucination | inducing and steering visual hallucinations (not yet counted) |

The **Training archive** sits beside them: not a trainer, the record.

## A shell, not a rewrite

Each app was merged here by **moving** it, not rewriting it. An Angular app, a
Vite app and a set of plain HTML pages are each still exactly what they were and
each still builds on its own — Syllogimous still produces its Android APK from
`apps/syllogimous` without knowing this repository exists. Working trainers
are worth more than consistent ones.

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
git log -- apps/rnb                       # shows only the graft and after
git log --follow -- apps/rnb/js/deck.js   # crosses the rename
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

## Sharing data

The hub's **Share your data** card lets a player save an anonymised file of
their Syllogimous answers and upload it through a MEGA file
request. Nothing is sent by the page itself. The code is a standalone,
reusable kit — [`shared/share-kit/`](shared/share-kit/README.md), which also
explains what the system is for and how to add it to another tool — and
`node tools/check-shared.mjs <folder>` validates and merges the uploads into
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

**Appearance → Background → Choose image** does exactly that, and it is the one
setting here. The picture is downscaled to 2560px, re-encoded, and kept in
**IndexedDB** — deliberately not in localStorage, because that is where every
trainer's history lives and the quota there is shared between all of them. A
couple of megabytes of wallpaper is exactly what would push a Syllogimous
history of a thousand items over the edge. Nothing decorative gets to compete
with a record.

It never leaves the machine. There is nowhere for it to go: these are static
pages, and the hub does not make a request to anything.

The default is drawn rather than photographed — three stands of firs, seeded and
rejection-sampled onto a sloped ground, with fog between them, as an inline SVG.
No request to anybody, nothing to license, nothing to go 404 in a year.

One thing is deliberately not gold: the eight colour dots on the trainer
cards. They are the same eight hues as the segments in the day's bar, and that
pairing is the only thing tying a card to its share of the day. They are data,
not decoration.

The archive wears this theme too — the same palette, the same type, the same
drawing behind it. It cannot import the stylesheet, because it is published as
its own repository with no build step, so the theme is a copy and `test/run.js`
holds the two files to the same values. Two pages one click apart that look
like two applications is the thing a shared look exists to prevent.

## Isomorph, and what removing it kept

Isomorph was the ninth trainer and the only one that arrived as a *build*
rather than as a repository: one 2.2 MB file, Angular compiled to nothing but
itself, with no source here to build it from again. It was a second build of
the **Syllogimous codebase** with a different set of modes switched on.

It is gone, because it stopped being a different set. Every one of its
twenty-nine modes is a Syllogimous mode now, written from source with its own
tests, so the bundle was offering a subset of the trainer next to it in the
menu — two cards for one thing, and the older one unrebuildable.

**What was removed is the trainer. What reads its records stays**, and the
distinction is the whole reason this repository has an archive. Because
everything here shares an origin and localStorage is per origin rather than per
path, Isomorph's page shimmed `localStorage` so every key it wrote landed under
`ISO/` — otherwise it would have opened onto the Syllogimous history, appended
its own questions to it, and served a progression model trained on two
different sets of modes. It would not have looked like a collision; it would
have looked like the app forgetting things.

`readIsomorph` in `apps/archive/js/adapters.js` takes that prefix off again and
reads what is underneath with the Syllogimous reader — same code, because it is
the same format — under its own source name and its own difficulty unit. A
level of 27 on Isomorph's modes is not a level of 27 on Syllogimous's, and the
archive's rule is that a difficulty never travels without what it was measured
in. The meter and the browser sweep still find those keys too.

So a file somebody exported in 2025, or a browser they still have, is still
months of their training and still reads. A record that stops being readable
when an app is retired is not a record.

One case the prefix could not cover: a backup Isomorph exported *itself* was
written from inside the shim, so the keys in the file come out plain and the
file is indistinguishable from a Syllogimous backup. The shim therefore kept
one key the app did not ask for, `SYL_APP`, which the app's own export swept up
with the rest — so the file says which app it came from, and the archive files
it under that app rather than under a guess.

## The archive is not a trainer

It is the record, it is a file, and the file is the point — nothing a browser
holds survives clearing site data. Time spent maintaining it is not training and
is never counted toward the quota: a quota that could be met by tidying is a
quota that will be.

## More trainers, not counted

`apps/more/` holds trainers the hub opens like any other but keeps in a box of
their own, below the rest: none has an adapter yet, so the meter cannot see
them and their minutes do not count toward the day or the quota. Writing one an
adapter is what moves it up into `TRAINERS` in `shell/js/shell.js`.

- `dorsalflow/` — a Vite app's built output: the page, one script and one
  stylesheet in `assets/`. There is no source for it here, only the build, so
  the script is kept pretty-printed (`assets/dorsalflow.js`) and edited in
  place. Its one addition is **AudioFlow**, a third program beside Motion
  Discrimination and 2-Step Memory: the same task by ear. A band of noise
  sweeps left or right across the head, carried by interaural time and level
  differences, inside stereo static, and the answer is which way it went. It
  runs on DorsalFlow's own machinery — the staircase, the 20-level table, the
  session record (`mode: "audio-flow"`), the history and the level matrix —
  with the staircase driving the sweep's level against the static. A level's
  noise percentage is the static's loudness and its drift speed is how far the
  sound travels, with the start point jittered from Level 5 so the endpoints
  stop giving the direction away. Its styles are in `assets/audioflow.css`,
  because the compiled Tailwind sheet holds only the classes the original
  source used. Headphones are needed.

- `hallucination/` — Controlled Hallucination, a single page. It grew out of
  the Prophantasia Trainer (a coloured flash, then a blank field, on a loop),
  but prophantasia is one skill on the way rather than the goal: the page is
  about inducing visual hallucinations and steering them top-down. It opens
  with a primer — seeing as the brain's best guess, top-down prediction held
  in check by the bottom-up signal — and orders eight exercises by how much
  the screen still supplies: Afterimage (keep it, steer it), Fading (Troxler),
  Gaps (a faint object at the edge of vision that comes and goes — slow soft
  fades under once a second, or held steady while the user blinks fast — to
  be kept through every gap), Two readings (a Necker cube and a turning ball of dots), Noise (a seed
  faded out of static, or a word only), Flash (the original's Access and
  Projection, and Compose), Ganzfeld (an even field with pink noise and a
  journal) and Generate (an image from words alone). Each carries notes on
  what it induces, why, what you control and what to notice. Trial exercises
  are self-rated and keep a quiet difficulty whose ambiguity tiers (Loose,
  Defined, Exact) tighten slowly; Two readings measures control objectively,
  as dominance durations held on purpose against those watched passively.
  Flicker induction is left out on purpose: 8–12 Hz is the classic
  photosensitive seizure trigger. Kept under `hallucination.` in localStorage,
  carrying over anything saved under its old name.

GOATED n-Back, Adaptive Posner, Speed Memory × Schulte and Relational
Integration used to sit beside it and are retired. None had an adapter, so no
record anywhere reads their storage and nothing is lost from the archive.

## Third-party art

One thing here was not written here: the animal silhouettes in
`apps/rrt/animals.js`, from [game-icons.net](https://game-icons.net) by
Delapouite, Lorc, Skoll and Caro Asercion, used under
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The credit is carried
in that file, in [apps/rrt/README.md](apps/rrt/README.md), and beside the
setting that turns them on. Everything else is the repository's own.

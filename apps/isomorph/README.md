# Isomorph

Relations about relations. Nothing here is true or false.

Isomorph assumes you have already trained on classic relational reasoning —
chains of "north of" and "bigger than" are taken as read. What it trains is
what those chains leave out: deciding what a relation *is*, seeing that two
systems share a structure, and saying when the premises do not settle
something.

No item is answered true-or-false. Every one is answered by **picking**, by
**selecting every option that applies**, or by **building** the answer — so
"it could be either" is an answer, and a guess is worth almost nothing.

Twenty-nine modes in five families:

```
A · Isomorphism and algebra   Hidden Algebra, Structure Match, Motif Search,
                              Projection, Partial Isomorphism, Common Sub-System
B · Analogy                   Context Shifts, Analogy Completion, Cross-System
                              Analogy, Second-Order Analogy, Partial Analogy,
                              Mapping Conflict, Odd Analogy
C · Incomplete information    Contradiction, Missing Premise, Minimal Premises,
                              Possibility Sets
D · New algebras              RCC8 Regions, Interval Algebra, Oblique Basis,
                              Frames, Cyclic Dominance, Betweenness,
                              Pivot Transforms
Induction (kept from Loosh)   Infer the Relation, Relational Web, Transformation
                              Matching, Axis Maps, Mutual Moves
```

You start with one mode from each family; the rest open as you show you can do
them. Every item is generated, so they do not run out, and each mode climbs its
own ladder.

## What is in this directory

```
index.html   the whole app: one file, 2.2 MB, and nothing else
```

That is not a summary. It is the entire app — the Angular bundle, the
stylesheet, Bootstrap Icons as an inlined `woff2`, the lot. **There is no
source here**, which makes this the one trainer in mindbuild that cannot be
rebuilt from what the repository holds. It was brought in as a finished build
rather than grafted with `git subtree` like the other eight, because a finished
build was what there was.

The practical consequence: a fix to Isomorph is not a fix made here. It is a
new build, dropped over this file, and then re-read against the four edits
below — which is the reason the first three are written into the head of the
file with the reasoning next to them rather than applied by a script nobody
would think to run again. The fourth cannot be, and is held in place by a test
instead.

## The four things that are not the shipped build

**A relative `<base href>`.** It shipped pointing at
`/tools/meta-relational-reasoning-training.html`, which is one path on one
site. It is `./` here, so the page runs at `apps/isomorph/` in this repository,
at `isomorph/` in the built site, and at the root of the WebView in the APK.
Routing is hash-based, so nothing else about the path matters.

**No webfont.** Two `@import`s of a Google Fonts face — for `Playpen Sans`,
which nothing in the file uses. They were a request to a third party on every
load, for nothing. mindbuild's promise is that a trainer works on a plane and
works in five years; an outbound request for an unused font fails both and buys
nothing.

**A `localStorage` shim, which is the important one.** See below.

**The Mindbuild theme preset**, which is the one edit that is not in the head.
See below.

`<meta charset>` and a viewport meta were added too, since the file had neither
— it was being served with the encoding in an HTTP header, and without the
viewport the phone build would render it at 980px.

## Why the theme preset is in the bundle

Isomorph is framed by the hub, and two different dark schemes either side of an
iframe border read as two applications rather than one. Syllogimous answers that
with a `Mindbuild` preset — the hub's own tokens, square and unlit — and this
build predates it.

Every other deviation here is a few lines in the head, which the bundle knows
nothing about. This one cannot be. The Appearance page lists whatever is in the
presets object, and that object is a module-local const inside a minified
bundle: there is no way to add to it from outside, and a preset that is not in
it is a preset nobody can pick. Applying the palette from the head instead would
mean a stylesheet fighting the inline variables the theme system writes on
`<html>` — and would leave no way to choose it, or to go back.

So the preset is inserted into the presets object itself, immediately after the
default, which is where Syllogimous lists it too. The values are not retyped:
they are the ones in `theme.service.ts`, the wallpaper SVG included, and
`test/run.js` reads the preset out of both files and compares them. That is the
part worth keeping. Two consequences follow from an edit that lives inside a
file nobody here can rebuild, and the test covers both — a build dropped over
this one takes the preset out again silently, and a preset written in two places
can drift, which would put the two trainers back to looking like two
applications. A second test checks that every setting the preset names is one
this older build actually has, since a preset written against today's
Syllogimous could otherwise name a variable this bundle has never heard of and
quietly do nothing.

## Why the storage is prefixed

Isomorph is a second build of the **Syllogimous codebase**. It writes the same
key names as `apps/syllogimous` — `SYL_HISTORY_C:0`, `SYL_PG_SETTINGSv1`,
`syllogimous-ability:…`, `SYL_TRAINING_UNIT:…` — all of them, exactly.

Every app in mindbuild is served from one origin, and localStorage is per
origin, not per path. So without something in between, opening this page would
have opened onto whatever Syllogimous history was already there: its questions
appended to that history, its ability estimates written over those ones, and
both apps thereafter served by a progression model fitted to two disjoint sets
of modes. Nothing would have errored. It would have read as the app quietly
losing track of what it had asked you.

The shim at the top of `index.html` redefines `window.localStorage` for this
document before anything else in it runs, and puts `ISO/` in front of every key
read or written. The bundle is untouched and knows nothing about it, which is
the same rule the shell keeps from the other side: a trainer that has never
heard of mindbuild works here exactly as well as one that has.

The prefix is uniform rather than a rename per key family, and deliberately so.
A list of families would have to be kept in step with a minified bundle nobody
here can edit, and the first key a later build invents would land unprefixed —
straight back into Syllogimous's bag, which is the one outcome this must not
have.

One key is the shim's own rather than the app's: **`SYL_APP`**, holding
`isomorph`. A backup this app exports is written from inside the shim, so the
keys in that file come out plain, and a plain file is indistinguishable from a
Syllogimous backup — same keys, six mode names in common, and the same filename:
it writes `syllogimous-export_<date>.json`, which it also did not change. `SYL_APP` rides
along in the export (the app sweeps up everything under `SYL_`) and is what the
archive reads to file the import under the right app instead of a guess. The
shim will not let the app delete it, so "Wipe data" clears the account and
leaves the app's name.

## Storage

Everything under `ISO/`. This page shares an origin with every other trainer in
mindbuild, and the shim is what keeps that share honest — in particular, the
app's own "Wipe data" reaches only its own keys, because the shim's `clear()`
is scoped to the prefix and the app never calls it anyway.

The archive reads `ISO/` through `readIsomorph` in
`apps/archive/js/adapters.js`, which strips the prefix and hands what is left to
the Syllogimous reader: it is the same format, so it is the same code. What
differs is the source name and the difficulty unit — `isomorph-level` rather
than `syllogimous-level`, because a level of 27 prices Isomorph's modes and
Syllogimous's differently and the archive never lets a number travel without
what it was measured in.

The shell's meter counts it the same way, off the same adapters. The gate finds
it on disk through `isomorph_from` in `apps/archive/tools/firefox-storage.py`.

## Credits

Isomorph descends from Loosh Syllogimous and, through it, from the
relational-reasoning trainers before it. Bootstrap Icons (MIT) and animate.css
(MIT) are embedded in the bundle and carry their licences in it.

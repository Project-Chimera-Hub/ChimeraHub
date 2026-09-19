# Running Order

Relational reasoning training at CCT's pace.

You hold a few symbols in order in your head. Every beat, one card places a new
symbol next to one you already hold — above or below it, and higher up the
ladder also left or right of it, and bigger or smaller than it. If that makes
one too many, the **oldest** symbol leaves and the ranks close up. You answer
where the new symbol now stands, on the axis the card asks about, before the
next card arrives.

```
holding  1st 2nd 3rd  (1st oldest)   card: new above the 2nd
  → the new symbol goes in 2nd, the oldest leaves, everything closes up
  → answer: 1
```

The home page shows that example with real symbols, dealt from whichever set is
in play, because written out in fixed shapes it would be a picture of a game
nobody plays.

## Why this shape

The obvious way to speed up relational reasoning is to shorten the premises
until they fit in a second. That fails in a specific way: a task whose stimuli
keep a fixed meaning is learned as a lookup table, and a lookup table is no
longer loading what the task was chosen to load — the finding is Ackerman's, and
it is the reason consistent-mapping practice stops predicting ability.

So the rule here is that **no card contains its own answer**. The new symbol's
rank depends on where its reference stands *now*, which depends on every
insertion and departure before it. Each symbol carries two bindings — where it
is, and how old it is — and both change every beat; keeping them straight is the
work, and discarding the stale ones is part of it. The symbols themselves are
generated stroke by stroke and never repeat, so none of them can come to mean
anything. The animal set trades that away on purpose — see "What is on the
cards" below, which says what it buys and what it costs.

What that leaves is close to what the literature says predicts fluid
intelligence best: relational integration and binding, held under time pressure
(Oberauer and colleagues on which working-memory functions predict intelligence;
Halford on relational complexity; Chuderski on what time pressure does to the
relationship between working memory and reasoning).

**It is not a claim that training this raises anything.** Meta-analyses of
working-memory training find far transfer weak at best. What the design can
honestly claim is that it keeps the task at the edge of capacity and measures it
cleanly.

## What is on the cards

Two stimulus sets, and the choice is a real trade rather than a skin.

**Generated marks** are the default. Each is three or four strokes on a 3×3
lattice, connected, spanning the lattice both ways, and at least two strokes from
anything held or just departed — measured up to all eight turns and mirrors, so a
mirrored twin never appears beside its twin. They never repeat, which is the
argument in the section above: nothing about a mark can be learned in place of
the order.

**Animals** are a fixed pool of 34 silhouettes, named and recognisable at a
glance. A picture with a name is encoded in one word, so almost none of the beat
goes on taking the symbol in and almost all of it on the order — which is the
point, and also why it is easier. They are drawings, not characters from a font:
SVG paths on the same kind of grid the marks use, so they scale with the size
axis and take the accent colour when they are the new one, exactly as a mark
does. Which also means they look the same on every machine, which an emoji
does not. It is the way in when the marks are the part that defeats you, and it
is honest about what it costs: the pool is small, so stimuli recur, and a fixed
set is exactly the consistent mapping that automatises. What it measures drifts
from relational load toward how good a verbal chain you can build.

So bits per second is **not comparable between the sets**. Every session record
carries the set it used, the best-ever figure is kept per set, and the archive
reads it as `raw.stimuli`.

## The walkthrough

The rules are three sentences long and still do not read well on paper, because
what they describe is a thing that changes. So there is a walkthrough — "How it
works" beside the start button, and offered by itself on a first visit.

It shows the same cards the session deals, untimed, with the list drawn **before
and after** each one and a sentence saying what moved and why. The list is
visible while the idea is new, then taken away — which is the task itself. Then
eight paced beats at 2.6 s, recorded nowhere, before the second and third
dimensions arrive the same way.

## The beat

A card is on screen for a slice of the interval — never more than half of it —
and then a **masking screen** takes its place: a scatter of the same kind of
symbols over the whole card, strokes for strokes and animals for animals,
because a mask has to be made of what it masks. It is there so the card does
not sit on the retina after it has gone, which is what keeps the order
something you hold rather than something you are still looking at.

An episode opens differently. The first symbol arrives on its own, with nothing
to place it against, and the **encoding period** is how long that beat lasts —
never shorter than one interval, since a beat faster than the cards arrive
would be a card in all but name. The symbol itself goes at 60% of it, so there
is a real gap before the first card whatever the period.

Standard mode fixes all three: 0.4 s visible, masked, and 1.5 s to take the
first symbol in. Custom mode puts the exposure and the encoding period on
sliders and lets the mask be turned off. Both are worth knowing about when
reading a figure: an unmasked card is worth an afterimage, and a long encoding
period is a head start, so neither kind of session is comparable with one run
the standard way — the same caution the two stimulus sets come with, and for
the same reason.

## The ladder, and what holds you on it

Difficulty moves on three fronts, and the controller drives them together:

- **Pace.** The interval moves on every answer toward a target accuracy, stated
  above chance so it means the same at every size.
- **Symbols.** 3 to 7 of them — how many are held, not which set they come from.
- **Dimensions.** Height, then width, then size — 1D, 2D, 3D.

When the pace is at its floor and you are still above target, speed has nowhere
to go and the level rises instead: symbols first, then a dimension, with the
symbol count dropping back when a dimension is added. At the ceiling and below
target it goes the other way. The ladder is ordered by what it makes you carry,
`d · log2(s)` bits, so every rung is more than the one before it.

The score is that same quantity over time — **relational throughput**, in bits
per second, discounted for guessing. It rises with pace, symbols and dimensions
alike, which is what lets one number follow you across levels that are otherwise
not comparable.

## Files

```
index.html    the page: settings, the stream, the results
model.js      the model, the glyphs, the controller, the score — no DOM
animals.js    the animal silhouettes, as path data, with their credit
test/run.js   node apps/rrt/test/run.js
```

`model.js` is separate so the parts that must be right can be tested without a
browser: that ranks stay a permutation on every axis, that the oldest symbol is
the one that leaves, that answers come out even across the ranks, that pressing
one key forever scores exactly chance, and that the model is indifferent to which
stimulus set fills the cards.

## Credits

The animal drawings in `animals.js` are from
[game-icons.net](https://game-icons.net) ([the
repository](https://github.com/game-icons/icons)), by **Delapouite**, **Lorc**,
**Skoll** and **Caro Asercion** — the comment above each row says which. Their
path data is used unmodified under the [Creative Commons Attribution 3.0
Unported licence](https://creativecommons.org/licenses/by/3.0/), and the same
credit appears beside the setting in the app. Everything else here is the
repository's own.

## Storage

Everything under `rrt_prog`, `rrt_sett` and `rrt_theme`. This page shares an
origin with every other trainer in mindbuild, so **"Wipe data" removes those
three keys and nothing else** — `localStorage.clear()` here would take the whole
record with it.

The archive reads `rrt_prog` through `apps/archive/js/adapters.js`, the same way
it reads CCT: by storage snapshot, because this trainer has no export of its own.
It keeps the last thousand sessions.

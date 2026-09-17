# Running Order

Relational reasoning training at CCT's pace.

You hold a few symbols in order in your head. Every beat, one card places a new
symbol next to one you already hold — above or below it, and higher up the
ladder also left or right of it, and bigger or smaller than it. If that makes
one too many, the **oldest** symbol leaves and the ranks close up. You answer
where the new symbol now stands, on the axis the card asks about, before the
next card arrives.

```
holding  ● ▲ ■   (● oldest)     card: ★ above ▲     ● leaves     answer: 1
```

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
anything.

What that leaves is close to what the literature says predicts fluid
intelligence best: relational integration and binding, held under time pressure
(Oberauer and colleagues on which working-memory functions predict intelligence;
Halford on relational complexity; Chuderski on what time pressure does to the
relationship between working memory and reasoning).

**It is not a claim that training this raises anything.** Meta-analyses of
working-memory training find far transfer weak at best. What the design can
honestly claim is that it keeps the task at the edge of capacity and measures it
cleanly.

## The ladder, and what holds you on it

Difficulty moves on three fronts, and the controller drives them together:

- **Pace.** The interval moves on every answer toward a target accuracy, stated
  above chance so it means the same at every size.
- **Symbols.** 3 to 7 of them.
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
test/run.js   node apps/rrt/test/run.js
```

`model.js` is separate so the parts that must be right can be tested without a
browser: that ranks stay a permutation on every axis, that the oldest symbol is
the one that leaves, that answers come out even across the ranks, and that
pressing one key forever scores exactly chance.

## Storage

Everything under `rrt_prog`, `rrt_sett` and `rrt_theme`. This page shares an
origin with every other trainer in mindbuild, so **"Wipe data" removes those
three keys and nothing else** — `localStorage.clear()` here would take the whole
record with it.

The archive reads `rrt_prog` through `apps/archive/js/adapters.js`, the same way
it reads CCT: by storage snapshot, because this trainer has no export of its own.
It keeps the last thousand sessions.

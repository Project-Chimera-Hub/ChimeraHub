# Relation Algebra

Nested relations, combined in your head. The same task works in six
materials: places on a grid, numbers, notes, days of the week, compass
headings, and a tile's orientation. Inspired by IMAGI-WORLD, a structure
n-back of spoken spatial premises; rebuilt so the answer depends on what a
sentence means, never on its wording.

## What it trains

Relational integration: combining several relations, some of them nested,
into one model, and reading answers off it. Each trial describes objects
(Red, Blue, Green, Gold, Violet, White) by how they relate:

- **Plain:** "Gold is two steps north of Red."
- **Nested:** "The place one step east of Gold is north of the place two
  steps west of Red." Both sides are places built from an object.
- **Marks:** the same thing as definitions, "Let P be the place one step east
  of Gold."
- **Perspective:** "Standing at Blue and facing west, Red is two steps ahead
  and one to the left."

**Tasks:**
- **Questions:** "Is Gold one step south-east of Violet?" Yes, No, or Can't
  tell when nothing links the two.
- **Possible?** Can every premise be true at once?
- **How far?** Steps apart, along the grid or in king's moves.
- **Structure n-back:** is this the same arrangement as the one n
  descriptions back? It usually comes back worded quite differently, and
  optionally turned (up to rotation).

## How difficulty is measured

One level, 1 to 20. It moves up a step after a session at 80% or better and
down after one under 60%. The level sets:

| Level | Objects | Nesting per side | Steps | Also |
| --- | --- | --- | --- | --- |
| 1–2 | 3 | none | 1 | |
| 3–6 | 3–4 | 1 | 1–2 | perspective from 3; offsets on both sides from 4; diagonals from 5 |
| 7–12 | 4–5 | 2 | 2–3 | two-part moves ("two north and one east") from 10; a second loop in Possible? from 10 |
| 13–20 | 5–6 | 3 | 3 | |

In structure n-back, n is 1 at levels 1–5, 2 at 6–10, 3 at 11–15 and 4 at
16–20.

The questions always ask about the two objects joined by the longest chain of
premises, so higher levels mean combining more of them.

## Controls

- **F:** Yes / Same / Possible.
- **J:** No / Different / Impossible.
- **K:** Can't tell.
- **1–4:** the options in How far?
- **Space:** go on.
- **Escape:** pause.

After a mistake (or always, if you set it), the answer is worked through:
- the true relation;
- which mistake the offered answer belongs to;
- each premise reduced to what it means;
- a drawing of the arrangement.

**Read aloud** uses the device's own voice. It can hide the text while
reading, so the premises have to be held by ear.

## The mathematics, and what each part does here

- **Points and vectors (affine space).** Objects and places are points;
  relations are vectors. The generator only ever writes point = vector +
  point, so every sentence is well-formed. Nested phrases branch to the right
  only ("the place … of the place … of Red"), so they can be followed by ear.
- **A premise is an equation.** "The place a of X is r of the place b of Y"
  means X + a = Y + b + r, so X − Y = b + r − a. The generator picks the
  world first and solves for r. It keeps a premise only when r can be said
  and the nesting changes the answer.
- **Free paraphrases.** These follow from commutativity, inverses and
  scalars: "north of X" is "X is south of …"; steps come in any order; a
  step and its reverse cancel. A match in n-back is the same arrangement
  described afresh, so remembered wording doesn't help.
- **Graphs.** Premises link objects. The answer is the sum of relations
  along a path, and the path's length is how many premises must be combined.
- **Loops (Kirchhoff).** Going round any loop must bring you back to where
  you started. *Possible?* rounds contain loops, and an impossible one has a
  single premise that breaks a loop.
- **Rank.** When a premise on the path is missing, the two objects aren't
  linked, and the answer is *Can't tell*. The objects are split into two
  groups of at least two, so the gap has to be noticed, not seen.
- **Symmetry (D₄).** The square's rotations and reflections give the n-back
  lures: turned, mirrored, flipped. "Up to rotation" makes turning count as
  the same.
- **Clock arithmetic.** Notes wrap at the octave (ℤ₁₂), days at the week
  (ℤ₇), and headings in 45° steps (ℤ₈). "Four semitones above" is "eight
  below".
- **Change of basis.** Perspective premises are rotations of the frame:
  ahead and right turned into compass directions.
- **Non-commutative composition.** Orientations (the group D₄) are where
  order matters: "turned a quarter right, then mirrored" is not "mirrored,
  then turned a quarter right". The lure is the same steps in the wrong
  order.
- **One engine, six groups.** The equations, paths, loops, lures and
  matching are written once for any group. Space, numbers, notes, days,
  headings and orientations are only different groups. A different material
  each session (Material: "A different one each session") holds the
  operation constant and varies the material.
- **Lures are the answers of particular mistakes.** The wrong answers
  offered are what you'd get by:
  - ignoring the nesting;
  - dropping one side's offsets;
  - applying offsets with the wrong sign;
  - composing the steps in the wrong order;
  - reading a perspective premise as if facing north;
  - being one step off;
  - mirroring or turning the true answer.

  Each session records how often each trap was seen through.
- **Cognitive maps (a hope, not a finding).** Animals track position by
  adding displacement vectors (path integration). Some researchers argue the
  brain's spatial maps also hold abstract relations (Behrens et al., 2018).
  That is a reason to think vector composition might train something general.
  It is not evidence that it does.

## Files

- `algebra.js`: the engine. Groups, terms, premises, the solver, lures and
  tasks; no page code.
- `test/algebra.test.js`: `node apps/relations/test/algebra.test.js`. About
  75,000 checks across every material and level:
  - the group laws;
  - every premise solves to the truth;
  - every answer and n-back target is right;
  - every sentence is clean.
- `trainer.js`: the page, on the hub's harness.

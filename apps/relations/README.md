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

## Sessions and rounds

A session is a run of **rounds** and lasts as long as you set: 10, 15, 20,
30 or 45 minutes, or 1, 1½, 2, 3, 4 or 5 hours. A round is a set number of
trials (4 to 100, 12 by default) of one task in one material.

- **Task** and **Material** can each be fixed or set to change every round.
  With both changing, all 24 pairings come up within 24 rounds. A session
  picks up the rotation where the last one stopped.
- **The level moves after every round**, not just at the end of the session.
- **Long sessions are saved as they go.** Every trial is checkpointed. If
  the tab is closed or crashes, the next time the page opens the unfinished
  session is filed in the record, marked as not completed, and its level is
  kept.
- Between rounds a line sums up the round and names the next one.
  The next round starts after 8 seconds, or straight away on Space.

## Compact notation

By default every text is in a short code that has to be learnt. It is not
meant to be guessed: write this table down, or keep the Chimera Hub guide
open, until it reads like words. Set **Text** to *Words* to have every
premise written out instead.

**Objects:** R Red, B Blue, G Green, **O Gold**, V Violet, W White.

**A premise is an equation.** Each side is a *term*: an object, then moves
applied to it. `R6=B4488` says "one east of Red is two west and two north
of Blue".

| Material | A move is written | Example |
| --- | --- | --- |
| Space | one keypad digit per step | `R=B99` Red is two steps north-east of Blue |
| Numbers | a signed step | `R+2=B−7` |
| Notes, days, headings | a signed step that wraps; the first line names the modulus (`mod 12`, `mod 7`, `mod 8`) | `mod 8` / `R=B+3`: a heading three 45° steps clockwise of Blue's |
| Orientations | one letter per operation, applied left to right | `R=Bmq` Red is Blue mirrored, then turned a quarter right |

**Space digits**, laid out as on a keypad:

```
7 8 9      7 north-west  8 north  9 north-east
4 · 6      4 west                 6 east
1 2 3      1 south-west  2 south  3 south-east
```

**Perspective:** `R=B@2<<` reads "standing at Blue facing 2 (south), Red is
two steps to the left". After `@` and a facing digit:

- `^` ahead
- `v` behind
- `<` left
- `>` right

**Orientation letters:**

- `q` a quarter turn right, `Q` a quarter turn left, `h` a half turn;
- `m` mirror left-right, `M` mirror top-bottom;
- `d` flip on the rising diagonal, `D` on the falling one.

Order matters here: `mq` is not `qm`.

**Marks** name places, so a long nested term can be built in steps:
`P=R6`, then `B=P88`. Mark letters are P S T U X Y Z A C E F J K L N; after
the fifteenth they double (PP, SS, …). A mark never contains a digit or a
lower-case letter, so it can't be mistaken for a move.

**Questions and answers:**

| Code | Asks | Answers |
| --- | --- | --- |
| `R=B6?` | Is this true? | `=` yes, `≠` no, `?` can't tell (nothing links them) |
| `∃?` | Can every premise be true at once? | `∃` possible, `∅` impossible |
| `\|R−B\|₁?` | Steps apart along the grid (or by number) | the distance |
| `\|R−B\|∞?` | Steps apart in king's moves | the distance |
| `≡3?` | The same arrangement as 3 back? | `≡` same, `≢` different |
| `≅3?` | The same up to rotation? | `≡` same, `≢` different |
| `⊢1/3` | Hold this: the first of the 3 before scoring starts | `»` go on |

**Explanations** start with ✓ or ✗ and the true relation (`≠ · O=B7`). `⇒`
opens each premise reduced to a single move. The trap the offered answer
belongs to is a symbol:

| Symbol | Trap |
| --- | --- |
| `∅n` | nesting ignored |
| `−L`, `−R` | the left or right side's moves dropped |
| `±` | wrong sign |
| `⇄` | composed in the wrong order |
| `@8` | perspective read as if facing north |
| `±1` | one step off |
| `↻`, `↻↻`, `↺` | turned a quarter, half way, a quarter back |
| `⇋`, `⇅`, `⤡` | mirrored east-west, north-south, on a diagonal |
| `⁻¹` | undone instead of done |
| `m·m` | seen in a mirror |
| `−` | reversed |
| `⇆` | two objects swapped (n-back) |
| `≠` | a new arrangement (n-back) |

The round summary reads `#3 · 75% · L4→5 · → nback/days · 41m`: round 3,
75% right, level 4 to 5, next round structure n-back in days, 41 minutes
left.

## How difficulty is measured

One level, 1 to 20. It moves up a step after a round at 80% or better and
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

- **F:** Yes / Same / Possible (`=`, `≡`, `∃`).
- **J:** No / Different / Impossible (`≠`, `≢`, `∅`).
- **K:** Can't tell (`?`).
- **1–4:** the options in How far?
- **Space:** go on (`»`).
- **Escape:** pause.

After a mistake (or always, if you set it), the answer is worked through:
- the true relation;
- which mistake the offered answer belongs to;
- each premise reduced to what it means;
- a drawing of the arrangement.

**Feedback sound** (a high tone when right, a low one when wrong) can be
turned off in Settings.

**Play** sets how a trial reaches you:

- **On screen:** read it.
- **On screen, read aloud:** read it and hear it.
- **Eyes closed (audio only):** hear it, and answer without looking (below).

## Eyes closed

Every premise and question is spoken in the spoken code (below), and the
whole screen under the bar becomes the answer pad:

| Answers | Pad | Keys |
| --- | --- | --- |
| 1 (go on) | anywhere | Space |
| 2 | left half, right half | F, J |
| 3 | left, middle, right: yes, can't tell, no | F, K, J |
| 4 | quarters: 1 2 above 3 4 | 1–4 |

- The phone buzzes on every touch, and the screen is kept on while the
  session runs.
- Two soft rising notes mean the question comes next. The answer is timed
  from the end of the question.
- How far? says its choices after the question, smallest first, in pad order.
- Each round opens with its number, task and material ("Round 3. n-back,
  days, 2 back."). It closes with the score, the level and the minutes left,
  then goes straight on.
- Mistakes are explained in a few words: "Wrong. No. Red is Blue nine. Trap:
  one step off." Set Explain to *Always* to hear every answer explained.
  With Feedback sound off and Explain on *After mistakes*, a right answer is
  silent.
- **Speech rate** (0.8× to 1.75×) and **Silence between premises** (none to
  1.5 s) set the pace.
- Escape or Pause stops the voice. Resuming says the interrupted line again.

The voice is the most natural one the device has: voices named Natural or
Neural first, then Premium or Enhanced, then Google's, then the default.
On Windows that means Edge's or Windows' natural voices. On Apple devices,
download an Enhanced or Premium voice in the system's speech settings. On
Android, the Google voices are used. Without any speech engine, the trial
is shown on screen instead.

## The spoken code

The compact code said word for word, with words that are hard to mix up
by ear. Every spoken line stands for exactly one written line; the tests read
each one back.

| Written | Spoken |
| --- | --- |
| `=` | is |
| `R B G O V W` | Red, Blue, Green, Gold, Violet, White |
| space digits | the digit as a word; a run of 2 is *double*, 3 *triple*, 4 *quad*, more "*n* times" |
| `@4` | face four |
| `^ v < >` | front, back, left, right (runs as above) |
| `+n`, `−n` | up *n*, down *n* |
| `q Q h` | right, left, half |
| `m M d D` | mirror, flip, rise, fall |
| `mod 12` | mod 12 |
| marks `P S T U X Y Z A C E F J K L N` | Fox, Jar, Key, Lamp, Moon, Nest, Oak, Pond, Rope, Sun, Tent, Cup, Drum, Hat, Kite; a doubled letter adds *big* (`PP` is "big Fox") |
| `R=B6?` | Is Red Blue six? |
| `∃?` | Possible? |
| `\|R−B\|₁?`, `\|R−B\|∞?` | Red to Blue, grid? / king? (numbers: "Red to Blue?") |
| `≡2?`, `≅2?` | Same as 2 back? / Same as 2 back, any turn? |
| `⊢1/2` | Hold, 1 of 2 |

Examples:

- `W1166=B666944` is "White double one double six is Blue triple six nine
  double four".
- `V=W@6vvv<<<` is "Violet is White face six triple back triple left".
- `W+5=O+1−5` is "White up 5 is Gold up 1 down 5".
- `R=BQdmm` is "Red is Blue left rise double mirror".

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
  each round (Material: "A different material each round") holds the
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
  97,000 checks across every material and level:
  - the group laws;
  - every premise solves to the truth;
  - every answer and n-back target is right;
  - every sentence is clean;
  - every line of compact notation, parsed back, is true of the world;
  - every spoken line reads back to its written line.
- `trainer.js`: the page, on the hub's harness: rounds, checkpoints,
  explanations and drawings.

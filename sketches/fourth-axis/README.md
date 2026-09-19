# Fourth axis

A probe, not a trainer. It asks one question and answers it with a number:
when three axes are real 3D position and a fourth is some other channel, is
that fourth axis being **read**, or is it decoration the eye skips?

```bash
open sketches/fourth-axis/index.html      # no build step, no network, no storage
node sketches/fourth-axis/test/run.js
```

## What a channel has to do to be an axis

Five requirements, and a channel that misses any of them is a label rather
than a dimension:

| | |
|---|---|
| **metric** | equal steps read as equal |
| **separable** | position on it survives the other three moving |
| **composable** | two steps then three lands where five lands |
| **neighbourly** | "adjacent" is visible locally, without counting from zero |
| **preserving** | the same object displaced still reads as the same object |

The last one is what rules out size, amount, opacity and weight. Those are
properties *of* the object, so moving along them changes what the thing is
rather than where it is — and a scene stops being one object at four
coordinates and becomes two unrelated objects. That failure is invisible in a
still picture and obvious the moment you try to say "the same one, four steps
along".

Needle angle against a drawn dial passes all five: the object is untouched,
only its pointer turns. That is the candidate on trial here.

## The fourth axis is a ring

Twelve positions on a loop, which is `modulus` in Syllogimous's composed
spaces (`apps/syllogimous/src/app/syllogimous/utils/ndspace.utils.ts`). On a
ring nothing is greater than anything else, because you can reach it going
either way, so the only claim that distinguishes anything is displacement —
how many steps round. A clock face is exactly that structure drawn, which is
why the needle and the arithmetic fit each other without being made to.

The dial is drawn in **screen space, never in the scene's**. That is the
separability requirement made literal: a dial lying in the lattice would
foreshorten as the scene turned, so orbiting the three spatial axes would
change the fourth one's reading, the two would be a single integral percept,
and the probe would be measuring the camera.

## How it measures

Every trial is a fresh scene and one conjunctive claim about two of its
objects, covering all four axes at once:

```
D is east of, above, north of and 4 steps clockwise from B.
```

Half the claims are true. Every false one is false on **exactly one** axis,
and the tally is kept per lied-about axis. So x, y and z are the within-trial
baseline — they say whether you were attending at all — and the ring rows
across encodings are the result. A needle whose lies go unnoticed at the rate
the size control's do is a needle nobody is reading.

Three things about reading the table:

- **Compare a ring row against the same row under another encoding**, never
  against the x row beside it. Flipping "east" to "west" is the coarsest lie
  available; a ring lie can be one step. The axes are not magnitude-matched
  and cannot be.
- **Near and far ring lies are separate rows**, because a channel can carry a
  coarse reading and no fine one. Hue is the one to watch: if `ring 3+ out`
  holds up while `ring 1–2 out` collapses, hue is being read as a category and
  not as a position.
- **A dozen trials is nothing.** The interesting differences are tens of
  percent, and twelve trials cannot see them.

## The encodings

| | |
|---|---|
| **Needle** | angle against a dial — the candidate |
| **Needle + hue** | the same position said twice, to see what redundancy buys |
| **Hue** | twelve hues stepped in OKLCH, not HSL, whose hues are not evenly spaced perceptually and would lose the metric requirement before the encoding got a chance |
| **Size** | the control. It should fail twice over: it is a property of the object, and it cannot close into a loop — position 11 sits next to position 0 |

Hue's weakness is structural and worth predicting before you look: a needle
carries its own ruler, and hue's ruler is the legend, off the object. Counting
eight steps round means leaving the pair, reading the wheel, and coming back.

## What it does not test

**Slice layout** — the w axis laid out as a row of 3D cross-sections — is the
honest fallback for an *ordered* fourth axis and is deliberately absent: it
spends a real screen axis to buy the fake one, so comparing it here would
compare layouts rather than channels.

**Time as a scrubber** is absent for a sharper reason. It passes four of the
five requirements and fails *neighbourly*: you see one slice at a time, so
every comparison across w goes through memory instead of through the eye. It
works as logic — which is why the textual 4D mode uses it — and poorly as
vision.

**Nesting**, where each cell contains a smaller copy of the lattice, is the
other survivor, and it is a different shape of question: ordered rather than
cyclic, metric on a log scale, and traversed by zooming. It would need its own
page.

## No storage

Nothing is written to `localStorage`, deliberately, on an origin the meter
reads. A probe is not training and must never be able to satisfy a quota, and
the surest way to guarantee that is to leave no key behind. The cost is that a
session is one sitting; **Show as TSV** is how a result leaves the page.

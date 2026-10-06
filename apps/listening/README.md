# Listening Integration

Relational integration by ear, with nothing to press. Built on Dark's
Relational Integration Training and its Integration program, for headphones,
a walk, and a locked screen.

## What it trains

Relational integration in working memory: holding a stream of sounds and
comparing two relations between them. Each sound is a spoken number at a
**place** (left to right) and a **pitch** (lower to higher). From the (n+2)th
sound on, you compare:

- the **earlier pair**: the previous sound and the sound n+1 back, and
- the **later pair**: the current sound and the sound n back.

Each pair is judged in a quality you choose: number, place or pitch. The
relation is Step (how far and which way), Distance (how far apart), or, for
numbers, Sum. Same relation: a match. The other qualities change at random
and are there to be ignored.

The two pairs can be judged in **different qualities**, for example "did the
place move as far as the number stepped?". That integrates relations across
dimensions, the hardest setting, and nothing else on the hub trains it.

As in Relational Integration's Integration program, about a third of the
trials are lures built to sound right: off by one, right with the wrong
partner, or (Step, depth 2 and up) the right size the wrong way. The rest are
40% matches and 25% plain non-matches.

## How difficulty is measured

It isn't: there is no input, so nothing to score and nothing to adapt to. You
set the difficulty: depth (n, 1 to 4), the qualities and relation, the time
between sounds, the range of numbers, how many places and pitches, and how
far apart the pitches are. The record keeps every setting, the depth as its
level (`n`), and every trial's type.

## Controls

None during a round. Each trial is **think, then hear**: decide silently in
the pause, then a tone gives the answer, two rising notes for a match and one
low note for different. The answer tones can be turned off.

**Play / Pause** and **End round** are on the page, and Play / Pause on the
phone's lock screen.

## Playing with the screen locked

The round is rendered ahead of time into one sound file and played as audio,
which phones keep playing with the screen off. This is the hub's one
exception to stopping when the page is hidden. The manifest says
`"audioOnly": true`, and the trainer stops instead:

- when you go back to the hub's menu (the hub posts `chimera:leave`),
- when the page is closed, or
- at End round.

Training time is the time the audio actually played. In the Android app,
playing on with the screen locked depends on the system letting the app's
audio run in the background.

## Voices

The spoken numbers are Dark's recordings for Relational Integration Training:
Amy, Bryce, or the two alternating by sound. `audio/` holds the numbers 1 to
19, the widest range offered, copied from `../rit/audio/` by
`tools/voices.mjs`, so this folder runs on its own. Pitch is changed by playing the recording faster or
slower, so higher sounds are also slightly shorter.

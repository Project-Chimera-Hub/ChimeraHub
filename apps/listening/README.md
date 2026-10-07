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

**Any of the three** is a choice for either pair:

- **Any in both pairs:** a match is any quality whose relation repeats, so
  number, place and pitch all have to be followed at once.
- **Any in one pair:** the other pair's quality is compared with each of the
  three ("did anything move as far as the number stepped?").

With Any, a non-match must miss in every comparison, so each trial is redrawn
until nothing matches by accident. The answer tone says which quality
matched: the two rising notes in the middle for number, moving left to right
for place, an octave higher for pitch. The record notes the quality for
every match and lure.

As in Relational Integration's Integration program, about a third of the
trials are lures built to sound right: off by one, right with the wrong
partner, or (Step, depth 2 and up) the right size the wrong way. The rest are
40% matches and 25% plain non-matches. With Any and Distance, near misses
are hard to avoid in three comparisons at once, so lures run to about half
and plain non-matches fewer.

## How difficulty is measured

It isn't: there is no input, so nothing to score and nothing to adapt to. You
set the difficulty: depth (n, 1 to 4), the qualities and relation, the time
between sounds, the range of numbers, how many places and pitches, and how
far apart the pitches are. The record keeps every setting, the depth as its
level (`n`), and every trial's type.

## Controls

None during a session. Each trial is **think, then hear**: decide silently in
the pause, then a tone gives the answer, two rising notes for a match and one
low note for different. The answer tones can be turned off.

**Play / Pause** and **End round** (or **End session**) are on the page, and
Play / Pause on the phone's lock screen.

## Sessions

**Session length** is one round, or 10, 15, 20, 30 or 45 minutes, or 1, 1½
or 2 hours of rounds back to back. Each round starts with three soft ticks.
The last round is shortened so the session ends on time, and is left out if
fewer than 5 trials would fit. The whole session is one entry in the record,
with each trial's round and each round's trials and seconds. Ending early
keeps what was heard, marked as not completed.

## Playing with the screen locked

Each round is rendered ahead of time into one sound file and played as audio,
which phones keep playing with the screen off. In a session, the next round
is prepared while the current one plays and starts when it ends. (Whether a
phone lets the next round start with the screen off is up to the phone; if it
holds it back, it starts when the screen comes on.) This is the hub's one
exception to stopping when the page is hidden. The manifest says
`"audioOnly": true`, and the trainer stops instead:

- when you go back to the hub's menu (the hub posts `chimera:leave`),
- when the page is closed, or
- at End round or End session.

Training time is the time the audio actually played. In the Android app,
playing on with the screen locked depends on the system letting the app's
audio run in the background.

## Voices

The spoken numbers are Dark's recordings for Relational Integration Training:
Amy, Bryce, or the two alternating by sound. `audio/` holds the numbers 1 to
19, the widest range offered, copied from `../rit/audio/` by
`tools/voices.mjs`, so this folder runs on its own. Pitch is changed by playing the recording faster or
slower, so higher sounds are also slightly shorter.

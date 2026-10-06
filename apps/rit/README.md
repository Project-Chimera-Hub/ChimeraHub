# Relational Integration Training

Made by **Dark** (Chimera Hub Discord). This is Dark's v37 ("baseline
scaling"), with the changes listed at the end so it runs on the hub.

Numbers appear one at a time around a circle, each shown and spoken. On every
number from the (n+2)th on, you judge whether two differences are equal:

- **ΔA** = |current − the number n back|
- **ΔB** = |previous − the number n+1 back|

They are equal → **Match**; otherwise → **Different**. At 1-back, `7, 4, 1` is
a match (|1−4| = 3 = |4−7|) and `7, 4, 2` is not.

## What it trains

Relational integration in working memory. You hold a stream of numbers, then
combine two relations between them, each a difference, rather than just
recognising a repeat. ΔB can be worked out a number early. ΔA needs the
number that has just appeared, so half of every answer is computed under the
clock.

## How difficulty is measured

- **Depth (n)** is the level in the hub's record, in units of `n`. You set it,
  from 1 to 10.
- **Speed** adapts after every round. Display and blank times move by a
  percentage looked up from your correct answers out of 20, from −4% (slower)
  at 10 or fewer to +10% (faster) at 20. The steps can be edited in Configure.
  The times reached are kept in each session's `settings`.
- **Range ladder** (plain numbers only): after five rounds in a row under half
  the baseline times, the numbers' range grows by one (1–5, 1–6, … up to
  1–99). After five rounds that aren't, it shrinks.
- **Value Complexity** (optional) hides some numbers inside expressions
  (`18÷3`, `√(36)`, `25% of (20+16)`) and turns the speech off.

## Controls

- **Match**: the left button, `F` or `←`.
- **Different**: the right button, `J` or `→`.
- **Show Calculation (Hold)**: shows the last answer's arithmetic.
- **Exit** ends the round. A round left part-way is still saved, marked
  unfinished.

## Changes for Chimera Hub

Dark's code is otherwise unchanged; each change is marked `Chimera Hub` in
`index.html`.

- **Audio:** the three voices' spoken numbers moved out of the page into
  `audio/<voice>.js` (the file was 11 MB). The language menu lists only the
  languages that have recordings: English (two voices) and German.
- **Record:** each round is written in the Chimera record format
  (`chimera.rit.record.v1`), with a trial log, so the hub counts its minutes
  and the archive keeps it.
- **Pausing:** the round pauses when the page is hidden. That time isn't
  counted, and resuming moves on to the next number.
- **Fix: duplicate rows.** An answered trial was also logged a second time as
  unanswered. A stale copy of the game state was read inside the timers. The
  last trial of a round, if unanswered, was never logged.
- **Fix: adaptive steps.** These now scale to rounds of any length. They were
  counts out of 20 applied to any number of trials.
- **Fix: range ladder.** It stops at 1–99, the last number with a recording.
- **Keyboard keys** added for Match and Different.
- **No emoji** in the interface. The text symbols ✓, ✗, ▲ and ▼ stay.
- **Wider on a computer:** at 900 px wide and up, the menus widen, the
  settings run in two columns, and the round is scaled to the window's height.
  Phones are unchanged. `chimera-hub.css` also adds about 20 Tailwind classes
  the app uses but its compiled CSS left out (`flex-1`, `col-span-2`, …), which
  had squashed the voice buttons and the range grid in every theme.
- **Look:** a "Chimera Hub – Gold" theme (`chimera-hub.css`) is the default.
  Dark's Cyan and Dark themes are still in the theme menu.

## Licence

See `LICENSE`: shipped with Dark's permission, licence to be confirmed.

# Relational Integration Training

Made by **Dark** (Chimera Hub Discord). This is Dark's v37 ("baseline
scaling"), with the changes listed at the end so it runs on the hub.

Numbers appear one at a time around a circle, each shown and spoken. On every
number from the (n+2)th on, you judge whether two differences are equal:

- **ΔA** = |current − the number n back|
- **ΔB** = |previous − the number n+1 back|

They are equal → **Match**; otherwise → **Different**. At 1-back, `7, 4, 1` is
a match (|1−4| = 3 = |4−7|) and `7, 4, 2` is not.

## The Integration program (default)

**Classic** is Dark's original: every round compares distances, and the
non-matches are random numbers. **Integration** keeps the task and builds
on what the research behind it found:

- **Three relations, rotating by round.** Distance |a − b|, Step a − b (how
  far *and* which way) and Sum a + b. One relation per round, named before it
  starts, then the next round moves on to the next one.
- **Lures, about a third of the trials.** These are non-matches built to look
  like matches:
  - *near miss:* the relation is off by one, so a rough sense of size isn't
    enough;
  - *wrong partner:* the relation holds, but with a neighbour of the number
    n back, so it has to be bound to the right position;
  - *wrong direction:* for Step, the right size the other way. Never at
    1-back, where it would always be the number two back, a giveaway
    pattern rather than a lure.

  The rest are 40% matches and 25% plain non-matches. A shortfall carries
  over, so each round keeps those rates.
- **Sensitivity, not percent correct.** Each round reports d′ (hits against
  false alarms), and how many lures of each kind you saw through. Both are in
  the record.

### Why, and what it doesn't do

- **Relational integration predicts reasoning beyond memory span.** That's
  Oberauer et al. (2008), and, in school science grades, Krumm et al. (2012).
  Its standard measure, the relation-monitoring task, builds in *competing*
  configurations: non-targets that partly fit. A non-match that is wildly off
  can be rejected by a glance at size, without integrating anything. The lures
  close that gap.
- **The relation counts, not just the comparison.** Holyoak & Monti (2021)
  separate representing first-order relations (A:B) from integrating them
  into a higher-order one (A:B :: C:D), and treat interference control as a
  component of its own. Each trial here is that analogy, built fresh. The
  wrong-partner lure is the interference. Step makes the relation carry
  direction, as analogies do.
- **The core of integration is drawing on what you know.** Hannon & Daneman
  (2014) call this knowledge integration. Here the relations draw on
  arithmetic: signed steps and sums, and Value Complexity's expressions. Verbal
  and conceptual knowledge is beyond a number task.
- **Practice is specific to its material and its operation.** Hilbert et al.
  (2017) found working-memory training improved the trained operation, across
  verbal and numerical material, but not other operations, figural material or
  reasoning. They suspect task-specific strategies. Two things follow:
  - Rotating relations keeps one arithmetic shortcut from carrying the
    training.
  - The rotation is by round, not by trial. Oberauer et al. found the
    specific cost of switching wasn't related to intelligence, so mid-round
    switching would add a different skill.

  The material here is numbers only. The hub's other relational trainers
  carry spatial and figural relations; train across them.
- **What to expect.** Wang, Sun & Xiao (2025) trained relational integration
  for a month against an active control: 29 against 28 people, measured with
  Sandia matrices and resting EEG. They report frontoparietal changes and
  suggest it can enhance fluid intelligence. That is one small study, and set
  against Hilbert et al., it is a reason to train this rather than proof that
  it transfers. The hub's record exists partly so that question can be looked
  at with more data.
- **What can be prepared in advance.** The second relation (previous against
  n+1 back) can be worked out one number early. The first can't, and the
  lures make it exact.

Sources:
[Oberauer et al., 2008](https://www.sciencedirect.com/science/article/abs/pii/S0160289608000214);
[Krumm et al., 2012](https://www.sciencedirect.com/science/article/abs/pii/S104160801200057X);
[Hannon & Daneman, 2014](https://www.sciencedirect.com/science/article/abs/pii/S016028961400138X);
[Hilbert et al., 2017](https://www.sciencedirect.com/science/article/abs/pii/S0160289616302252);
[Holyoak & Monti, 2021](https://pubmed.ncbi.nlm.nih.gov/32762521/);
[Wang, Sun & Xiao, 2025](https://pubmed.ncbi.nlm.nih.gov/39843684/).

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
`index.html`, and Dark's original rounds are the Classic program.

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

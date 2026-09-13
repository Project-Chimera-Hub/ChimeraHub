# Synth

A grapheme–colour synesthesia trainer. One self-contained HTML file, no build
step and no network: **https://gagafutzi.github.io/Synth-v2/**

Every letter and digit carries a colour (its identity) and a shape (its type —
square for uppercase, circle for lowercase, triangle for digits). The goal is to
move from conscious decoding to automatic recognition.

## Modes

**Learn** browses all 36 symbols. **Decode**, **Find colour** and
**Multi-sensory** drill single symbols; **Tone ID** tests the pitch channel on
its own. **Word**, **Phrase**, **Flash recall** and **Match check** read whole
strings. **Memory** holds a growing sequence. **Logic** continues a coloured
sequence, **Confusions** drills only the pairs you actually mix up, and
**Automaticity** and **Pop-out** measure whether any of it has stuck.

## The two measurements

Accuracy cannot tell you whether the training worked, because the adaptive timer
holds it at 85% by construction. These can:

- **Stroop interference** — a letter is printed in a colour that matches or
  clashes with its trained one, and you name the ink. If the association has
  become involuntary you cannot ignore the letter, and clashing trials get
  slower. The gap in milliseconds is the score.
- **Search slope** — find one symbol in a field of 6, 12 or 20. A flat slope
  means the target pops out regardless of field size: parallel search, which is
  what an automatic colour looks like. A climbing slope means you are still
  scanning one symbol at a time.

Both are withheld until they have ~30 trials, because a difference off six
trials is noise.

## The timer

Decoding effort scales with the number of *distinct* symbols, not word length —
`sees` is two lookups, not four. So the window is `base + unit × demand`, where
demand counts unique symbols weighted by how well you know each. A weighted
staircase moves `unit` until you sit at the target accuracy; the steps satisfy
`down/up = (1 − P)/P`, which is what makes it settle at P rather than wherever
equal steps happen to balance.

## Your data

Everything lives in this browser's localStorage. Tools → Data → Export writes a
JSON file; the [training archive](https://github.com/Gagafutzi/training-archive)
reads it, or reads `synth5_en` straight out of storage.

# Relational Four-Stream N-Back Design

## Goal
Build a client-only n-back trainer in which the user tracks four concurrent streams: position, spoken digit, enclosing shape, and an abstract relation symbol. Every response is governed by a relation prompt that changes trial-by-trial, preventing a fixed same/different rule from being memorized.

## Core comparison convention
For every stream, the prompt is interpreted as a transformation from the **current** stimulus to the remembered N-back stimulus:

`remembered N-back stimulus = relation(current stimulus)`

Examples:
- current digit 9, prompt -3 -> target if N-back digit is 6.
- current square (4 sides), prompt -3 -> target if N-back shape is circle (1 side).
- current position with prompt North -> target if the N-back position is one cell north of current.

## Modes
- 2D: 3x3 grid.
- 3D static: 3x3x3 cube shown at a fixed camera angle.
- 3D rotating: 3x3x3 cube with continuous view rotation. Relations use cube-local coordinates, so camera rotation never changes the correct answer.

## Streams
### Position
2D prompts: North, South, East, West, Row, Column.
3D adds Above and Below. Direction prompts move by one logical cell; Row/Column test shared cube-local coordinates.

### Sound
Digits 0-9, spoken aloud with SpeechSynthesis when available. Prompts are Before, After, +x, -x. Before/After mean -1/+1 using the same current-to-N-back convention. Invalid offsets are never generated.

### Shape
The enclosing outline is the shape stream and the center remains available for the relation symbol. Ordered shape values are Circle=1, Triangle=3, Square=4, Pentagon=5, Hexagon=6. Prompts are Fewer sides, More sides, +x, -x. Offsets that would land outside the shape bank are never used.

### Relation
The glyph inside the active cell represents one semantic relation. The user decodes its meaning. The trial prompt asks for a semantic relationship between current and N-back relation concepts, not graphic identity. Each semantic concept has multiple deliberately similar glyph variants.

Initial semantic relation bank:
- Same
- Opposite
- Contains
- Inside
- Leads to
- Follows
- Greater
- Less

Relation prompts:
- Same relation
- Inverse relation
- Same family

Inverse pairs are Contains/Inside, Leads to/Follows, Greater/Less; Same and Opposite are self-family concepts and Same matches itself under inverse only when explicitly defined by the library.

## Trial generation
1. Choose current prompts independently for all four streams.
2. Decide target/non-target per stream using a configurable target probability.
3. For target streams, construct a current stimulus that satisfies the prompt against the N-back item, or choose a viable prompt for the current/N-back pair.
4. For non-target streams, reject accidental matches.
5. Add N-1/N+1 lures to a fraction of non-target trials when N>=2.
6. Save ground-truth booleans with each trial.

The prompt changes on every trial. Immediate prompt repetition is avoided when alternatives are valid.

## Input and feedback
Four aligned prompt/button cards sit under the display: Position, Sound, Shape, Relation. The user presses only buttons whose current-vs-N-back relation satisfies the prompt. Keyboard bindings: A, S, D, F. A response can be toggled during the response window; scoring is finalized at the next trial.

Per-stream feedback can be enabled/disabled. Feedback reports HIT, MISS, FALSE ALARM, or CORRECT REJECTION and never reveals future answers.

## Timing
Configurable stimulus interval and visible duration. Default N=2, 2500 ms interval, 900 ms visible duration, 30 scored trials plus N warm-up trials.

## Scoring
Per-stream and combined hit/miss/false-alarm/correct-rejection counts, accuracy, and optional lure accuracy. Session summaries are stored in localStorage.

## Wiki
An in-app Wiki documents the comparison convention, every position/number/shape prompt, all shape values, every semantic relation, inverse pairs, families, and every glyph variant.

## Technical architecture
Static GitHub Pages app using HTML, CSS and browser ES modules. Pure logic modules remain DOM-free and are tested with Node's built-in test runner. 3D positions are projected to a Canvas using cube-local coordinates and a camera rotation matrix. No network calls, accounts, analytics, backend or external runtime dependencies.

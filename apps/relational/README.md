# Relational N-Back

Four-stream relational N-back trainer. Static site, browser ES modules, no build step and no dependencies.

## The one rule for relation icons

Every relation icon shows **two different shapes**. Count their sides
(Circle = 1, Triangle = 3, Square = 4, Pentagon = 5, Hexagon = 6):

> **Fewer sides = first term. More sides = second term.**
> Read the icon as *first term → relation → second term*.

Left versus right placement is randomised on every draw and never carries meaning.
Size, nesting and height carry the relation, and which shape gets the big role, the
outer role or the higher role is decided **only** by side count.

| Relation | What the icon does |
| --- | --- |
| Same | Both shapes share a centre at matching size |
| Opposite | Both shapes at matching size, held apart |
| Contains | Fewer-sided shape is the big outer one |
| Inside | Fewer-sided shape is the small inner one |
| Leads to | Fewer-sided shape is the higher one |
| Follows | Fewer-sided shape is the lower one |
| Greater | Fewer-sided shape is the big one |
| Less | Fewer-sided shape is the small one |

This matches `assets/relations/relation-guide.png`, where the circle is the subject
in all eight drawings. The convention lives in one place: `SUBJECT_RULE` in
`src/constants.js` and the `first`/`second` assignment in `src/symbols.js`.

When the Shape stream is on, a **white outline** is drawn around the icon. That
outline is the Shape stimulus with its own response button; only the **yellow**
shapes inside form the relation.

## In this build

- The game view is pinned to the viewport: the current N sits directly above the
  grid and the response deck directly below it, with the grid sized from the space
  that is left. Nothing scrolls out of view at any window size.
- Disabled streams are not shown at all. Position off removes the grid or cube
  entirely; Shape off removes the outline; Relation off removes the icon; Sound off
  plays nothing.
- Per-trial feedback stays on screen instead of being cleared the instant the next
  stimulus is drawn.
- Pause freezes the current trial and resumes it with its remaining time. Space
  toggles pause in both directions.
- In-session relation cheat sheet on the `H` key or the RELATIONS button.
- Variable N with a configurable floor; the distance for the current trial is
  always printed above the grid.
- Pre-recorded digit audio (1–8) from `assets/audio`, with a setup-screen warning
  when clips are missing.
- 2D 3×3, 3D static and 3D rotating cube modes using cube-local coordinates.

## Keyboard

| Key | Action |
| --- | --- |
| A / S / D / F | Position / Sound / Shape / Relation |
| Space | Pause and resume |
| H | Relation cheat sheet (pauses the session) |
| Escape | Close the cheat sheet |

## Development

```bash
npm test      # node --test tests/*.test.js
npm run serve # http://localhost:4173
```

Logic modules (`relations`, `trialGenerator`, `session`, `symbols`, `projection`,
`geometry`) are DOM-free and covered by the test suite.

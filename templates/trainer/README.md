# __NAME__

__WHAT__

## What it trains

<!-- One paragraph: the ability, and the paradigm this trainer is built on. -->

Posner cueing: covert orienting of spatial attention. A cue draws attention
to one of two locations; the target then appears at the cued location (valid)
or the other one (invalid). The cost of an invalid cue in response time and
accuracy is the measure, and training aims to make attention both faster to
move and quicker to recover from a miscue.

**Category:** __CATEGORY__

**Research basis:** Posner, M. I. (1980). Orienting of attention. *Quarterly
Journal of Experimental Psychology*, 32(1), 3–25.

## How difficulty is measured

<!-- The unit of `level`, which way is harder, and what moves it. -->

`level` is the target's exposure in milliseconds (`target-ms`): smaller is
harder. After a session it gets 15% shorter at 85% accuracy or better and
15% longer under 70%.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Target on the left | F | Left button |
| Target on the right | J | Right button |
| Pause | Escape | Pause button |

## Data

Sessions are kept in the Chimera record format under
`chimera.__ID__.record.v1` in localStorage, with one trial row per target.
**History → Export record** saves them as a file.

## Running it

Open `index.html`. There is no build step and nothing is fetched from the
network.

## License

MIT, see [LICENSE](LICENSE).

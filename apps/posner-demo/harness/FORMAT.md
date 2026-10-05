# The Chimera record format, version 1

Every trainer on Chimera Hub writes its sessions in this format. It's what
makes a trainer compatible with the **archive**. If your trainer writes it,
these all read your data with no code from you and no adapter from us:

- the hub's meter and the day's total,
- the desktop gate's quota,
- the Training archive,
- Share your data.

The format is a **table of sessions**, with an optional **table of trials**
for each session. Every column has a fixed name, type and meaning. **Most
columns may be empty.** Fill in what your trainer measures and leave out
(or set to `null`) what it doesn't. An empty column means "this trainer
doesn't measure that". It never means zero.

The machine-readable version of this page is
[`record.js`](record.js): the same columns, a validator, and a function that
flattens a record into two CSV tables. `node tools/check-trainer.mjs` runs
the validator against your trainer.

---

## Where it lives

One JSON value per trainer, in `localStorage`, under

```
chimera.<app>.record.v1
```

`<app>` is your trainer's id: lower-case letters, digits and dashes, starting
with a letter (`stroop-switch`, `mot3d`). It's the same id as in the hub's
catalog and the archive's `source`. The hub finds this key by its pattern, so
a new trainer is counted the day it lands.

Rewrite the whole value when a session ends. Don't write it on every trial:
the hub recounts whenever any trainer's storage changes.

## The file

```json
{
  "format": "chimera-record",
  "version": 1,
  "app": "stroop-switch",
  "appVersion": "1.2.0",
  "units": { "level": "switch-rate" },
  "sessions": [ { … }, { … } ],
  "state": { "nextLevel": 4 }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `format` | string | **yes** | Always `"chimera-record"`. |
| `version` | integer | **yes** | Always `1` for this version. |
| `app` | string | **yes** | The trainer's id: its catalog id, its archive source and the `<app>` in the key. |
| `appVersion` | string | | The trainer's own version, if it has one. |
| `units` | object | **yes** | `units.level` names what `level` is measured in (`"n"`, `"premises"`, `"ms"`…). `units.score`, if the trainer reports a score. |
| `sessions` | array | **yes** | One entry per session, oldest first. |
| `state` | object | | The trainer's current standing (ability estimate, the level it will start at next…). |

## Sessions: one row per sitting, block or game

Whatever your trainer calls one run.

| Column | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | **yes** | Unique and stable within the app. Re-exporting must give the same id. |
| `start` | time | **yes** | When it started, epoch milliseconds, UTC. |
| `end` | time | | When it ended, epoch milliseconds, UTC. |
| `activeSeconds` | number | **yes** | Seconds actually spent training, **pauses excluded**. This is what the meter counts. |
| `completed` | boolean | | Finished, rather than abandoned part-way. |
| `mode` | string | | Mode, variant or game type, named as the player sees it. |
| `modalities` | array | | Streams in play, e.g. `["position","audio"]`. |
| `level` | number | | Difficulty at the start, in `units.level`. |
| `levelEnd` | number | | Difficulty at the end, in `units.level`. |
| `levelUnit` | string | | Overrides `units.level` for this session only. |
| `trials` | integer | | Trials, items or questions presented. |
| `correct` | integer | | How many of them were answered correctly. |
| `accuracy` | fraction | | 0 to 1. Computed from `correct / trials` when absent. |
| `hits` | integer | | Signal detection: targets responded to. |
| `misses` | integer | | Signal detection: targets missed. |
| `falseAlarms` | integer | | Signal detection: responses to non-targets. |
| `correctRejections` | integer | | Signal detection: non-targets let pass. |
| `dPrime` | number | | Sensitivity, if the trainer computes it. |
| `rtMeanMs` | number | | Mean response time, ms. |
| `rtMedianMs` | number | | Median response time, ms. |
| `rtSdMs` | number | | Standard deviation of response time, ms. |
| `score` | number | | Any other headline number, in `units.score`. |
| `input` | string | | `"keyboard"`, `"touch"`, `"mouse"` or `"voice"`. |
| `settings` | object | | The settings in force, as the trainer stores them. |
| `extra` | object | | Anything else this trainer measures, in its own vocabulary. |
| `trialLog` | array | | The trials, one row each (below). |

## Trials: one row per stimulus

Optional, and worth including: it's the only way anyone can later answer
questions about lures, streaks or response time by condition. For a
multi-stream n-back, write **one row per stream per trial**, with `modality`
saying which stream.

| Column | Type | Required | Meaning |
|---|---|---|---|
| `i` | integer | **yes** | Position in the session, from 0. |
| `t` | number | | Milliseconds from the session's start to the stimulus. |
| `block` | integer | | Block within the session, from 0. |
| `level` | number | | Difficulty on this trial. |
| `modality` | string | | Which stream this row is about. |
| `stimulus` | any | | What was shown or played. |
| `target` | boolean | | Whether a response was called for (a match, a go). |
| `response` | any | | What the player did. Empty for no response. |
| `correct` | boolean | | Whether that was right. |
| `rtMs` | number | | Response time, ms. Empty for no response. |
| `extra` | object | | Anything else about this trial. |

## Types

- **time**: epoch milliseconds, UTC (`Date.now()`). Not seconds, and not a
  date string.
- **fraction**: a number from 0 to 1. Write `0.85`, not `85`.
- **integer**: a whole number.
- **any**: a string, a number, or a small object or array.
- **Empty**: leave the field out, or write `null`. Never write `0`, `""` or
  `-1` to mean "unknown".

A field that isn't in these tables belongs in `extra`. The validator warns
about any other unknown field.

## The rules that matter

1. **Difficulty never travels without its unit.** A session with a `level`
   needs `units.level` or `levelUnit`. The archive stores it as
   `<app>-<unit>` (for example `stroop-switch-switch-rate`), so your "n"
   and another trainer's "n" are never put on one axis.
2. **Ids are forever.** Importing the same file twice must change nothing,
   and the archive merges on `app + id`. Use something like
   `start + "-" + random` and never renumber.
3. **`activeSeconds` is training time.** Stop the clock when the page is
   hidden (`visibilitychange`), when a pause menu is open, and between
   blocks while the player reads results. The quota is enforced on this
   number.
4. **Days are UTC.** A session belongs to the UTC day of its `start`,
   because that's how the archive has always split days.
5. **No personal data.** No names, no free text the player typed, no device
   identifiers. Share your data reads from here.
6. **Keep the history.** Don't trim old sessions to save space without a
   reason. If you must cap the trial log, keep the session rows.

## How it's read

| Reader | Where |
|---|---|
| Archive, gate, meter | `readChimeraRecord` in `apps/archive/js/adapters.js`: one archive record per session, minutes summed by UTC day. |
| Hub meter | `shell/js/today.js`: every key matching `chimera.*.record.v1`. |
| Archive's "Read this browser" | `apps/archive/js/app.js`: the same pattern. |
| Gate, off disk | `apps/archive/tools/firefox-storage.py`: the same pattern, in Firefox's own storage. |
| Validation and CSV | `shared/harness/record.js`: `validate(record)` and `toTables(record)`. |

## A complete example

```json
{
  "format": "chimera-record",
  "version": 1,
  "app": "dual-nback-demo",
  "units": { "level": "n" },
  "sessions": [
    {
      "id": "1759650000000-k3x9",
      "start": 1759650000000,
      "end": 1759650312000,
      "activeSeconds": 298,
      "completed": true,
      "mode": "dual",
      "modalities": ["position", "audio"],
      "level": 3,
      "levelEnd": 4,
      "trials": 40,
      "correct": 34,
      "accuracy": 0.85,
      "hits": 18, "misses": 2, "falseAlarms": 4, "correctRejections": 56,
      "rtMeanMs": 612,
      "input": "keyboard",
      "settings": { "intervalMs": 2500 },
      "trialLog": [
        { "i": 0, "t": 0, "modality": "position", "stimulus": 4, "target": false, "response": null, "correct": true },
        { "i": 0, "t": 0, "modality": "audio", "stimulus": "k", "target": false, "response": null, "correct": true },
        { "i": 3, "t": 7500, "modality": "position", "stimulus": 4, "target": true, "response": "match", "correct": true, "rtMs": 540 }
      ]
    }
  ],
  "state": { "nextLevel": 4 }
}
```

## Existing trainers

The trainers that were on the hub before this format already have their own
adapters in the archive, which turn their storage into the same records. They
meet the requirement as they are. Every trainer submitted from now on writes
this format.

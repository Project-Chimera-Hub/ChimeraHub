# share-kit

**Let the people who use your training tool share their results with you: on
purpose, anonymously, and without you running a server.**

One JavaScript file, no dependencies. Your tool turns its own answer history
into a small file with a fixed shape. The player saves it, can open it and see
exactly what is in it, and uploads it to wherever you collect files (a MEGA or
Dropbox file request, say). On your side, one command checks every upload and
merges the good ones into a single dataset.

---

## Why bother

Cognitive-training tools are usually built and tuned on one person's data: the
author's. The questions that matter most can't be answered from one person:

- How much harder is showing premises one at a time than all at once?
- Does a level of 12 in one mode mean the same as a 12 in another?
- How fast do people actually improve, and where do they stall?
- Do people who train one thing get better at another?

Answering them needs many players' answer-by-answer histories. The usual ways
of getting those are all bad for someone:

| Approach | The problem |
|---|---|
| Analytics that phone home | Players are tracked without really choosing it; your tool stops working offline; you run or rent a backend. |
| "Send me your save file" | Save files hold far more than you need: settings, text the player typed, exact timestamps. Every tool's format is different. |
| A survey | People can't remember their accuracy by mode, and self-report is not data. |

share-kit takes a different route, and the benefits follow from it:

**For players**
- **Nothing leaves their device unless they choose to send it.** The tool
  makes a file; the player uploads it. No background requests, no tracking,
  and the tool still works on a plane.
- **They can see what they're sending.** The file is plain JSON with a fixed,
  short list of fields. No premises, no free text, no settings, no time of day.
- **No account, no name.** Each device gets a random 16-hex-digit participant
  id. It ties one person's uploads together and is what they quote to have
  them deleted. It says nothing about who they are.

**For tool authors**
- **About twenty lines to integrate** (below), and no server to run.
- **You can't accidentally collect too much.** The kit writes only the
  fields in its schema and drops anything else you hand it.
- **Files from different tools merge.** Every tool writes the same shape,
  with its own `app` name, so data from several trainers can be analysed
  together.

**For whoever analyses the data**
- **Uploads are untrusted, and handled that way.** Anyone with an upload link
  can upload anything. The checker parses with `JSON.parse` only, ignores file
  names, skips symlinks and oversized files, and accepts a file only if every
  field of every row passes the same validator that wrote it. One tampered row
  rejects the whole file.
- **Duplicates handle themselves.** People upload again as they keep playing.
  The merge keeps, for each participant, app and day, the most complete copy.
- **Spreadsheet-safe.** Mode names must start with a letter or digit, so no
  cell can be read as a formula.

### What it is not

- **Not anonymous in the legal sense.** Rows linked by a participant id are
  *pseudonymous*: under GDPR that is still personal data. Ask for consent (the
  kit's card does), say what the data is for, and honour deletion requests.
- **Not a random sample.** Only people who choose to share will. Keep that in
  mind before generalising from it.
- **Not tamper-proof.** Validation rejects malformed and suspicious files, but
  a player can still edit numbers within the allowed ranges. Treat it as
  self-reported data with a strict format.

---

## Integrating it

### 1. Include the file

```html
<script src="share-kit.js"></script>
```

or `const ShareKit = require("./share-kit.js")` in Node.

### 2. Describe your answers

Map each answer your tool has stored to this shape. Only `app`, `mode` and
`at` are required; leave out whatever your tool doesn't have.

```js
const answers = myHistory.map((item) => ({
  app: "my-trainer",          // lowercase letters, digits, hyphens
  mode: item.modeName,        // the name a player would recognise
  at: item.answeredAtMs,      // ms since epoch; used for day and order, never written
  correct: item.wasRight,     // true/false, or 0..1 for partial credit
  seconds: item.timeTaken,    // how long the answer took
  level: item.difficulty,     // your difficulty number, if you have one
  premises: item.premiseCount,
  rungs: item.modifiers,      // short tags such as "third-axis"
  clock: item.timeLimit,      // seconds allowed, or null for untimed
  presentation: "0",          // how items were shown, your own short code
  timer: "0",                 // your timer setting, short code
  answerMode: "boolean",      // how it was answered: boolean, choice, …
}));
```

### 3. Make the file and hand it over

```js
const { file, skipped } = ShareKit.makeFile(answers, { tool: "my-trainer" });
console.log(ShareKit.summary(file));   // "412 answers, 9 modes, 30 days. Participant …"
ShareKit.download(file);               // the browser's save dialog
```

Put that behind a consent checkbox and a button, and link to your upload
location. [`example.html`](example.html) is a complete, working page.
mindbuild's own version is the "Share your data" card on its hub
(`shell/index.html`, `shell/js/share.js`).

### 4. Check and merge what people upload

Download everything from your upload location into one folder, then:

```bash
node tools/check-shared.mjs ~/Downloads/uploads --out mindbuild-dataset
```

It writes `dataset.json`, `dataset.csv` (one row per answer, with a
`participant` column) and `report.txt` (what was accepted and what was turned
away, with the reason). The checker is in the mindbuild repository; it is
thirty lines around `ShareKit.validate` and `ShareKit.merge`, and those two
functions are all you need to write your own.

**Keep the output out of public repositories.** `mindbuild-dataset/` is in
mindbuild's `.gitignore` for that reason.

---

## The file format (`mindbuild-share`, version 1)

```json
{
  "format": "mindbuild-share",
  "version": 1,
  "tool": "mindbuild",
  "participant": "c01e52a32951546b",
  "made": "2026-09-29",
  "answers": 616,
  "modes": 34,
  "apps": { "syllogimous": 616 },
  "rows": [
    { "app": "syllogimous", "mode": "Nested Spaces", "correct": 1, "seconds": 52.1,
      "day": "2026-09-28", "seq": 8, "level": 12.08, "premises": 7,
      "rungs": ["collide"], "clock": 57, "presentation": "1", "timer": "2",
      "answerMode": "boolean" }
  ]
}
```

| Field | Meaning | Allowed |
|---|---|---|
| `app` | which trainer | `a-z 0-9 -`, up to 40 |
| `mode` | mode name | starts with a letter or digit; letters, digits, space, `'()/&.,+-`; up to 80 |
| `correct` | right (1), wrong (0), partial, or unscored | 0–1 or null |
| `seconds` | time taken | 0–3600 or null |
| `day` | UTC date of the answer | `YYYY-MM-DD`, not after `made` |
| `seq` | order within that day | integer ≥ 1 |
| `level` | the tool's own difficulty | number or null |
| `premises` | premise count | integer or null |
| `rungs` | modifiers the item carried | up to 40 short tags |
| `clock` | time limit in seconds | 0–3600 or null |
| `presentation`, `timer`, `answerMode` | the tool's own short codes | `a-z 0-9 -`, up to 20, or null |

No other field is allowed anywhere in the file. `answers`, `modes` and `apps`
must match the rows. The exact time of an answer is deliberately not stored:
`day` and `seq` keep what analysis needs (learning over days, order within a
session) without a timestamp.

A new field means a new `version`. Readers should reject versions they don't
know rather than guess.

---

## Licence

MIT. Copy `share-kit.js` into your project and change what you like. If you
change the format, change `format` too, so files from different schemas are
never mistaken for each other.

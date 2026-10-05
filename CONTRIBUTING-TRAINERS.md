# Putting a trainer on Chimera Hub

This page is for developers who want their trainer on the hub. It covers how
to build one, the criteria it has to meet, and how it gets submitted and
approved.

**The short version:**

```bash
git clone https://github.com/Project-Chimera-Hub/ChimeraHub
node ChimeraHub/tools/new-trainer.mjs my-trainer --name "My Trainer" --category nback \
     --what "One line on what it trains" --maintainer your-github-name
# build it, play it, export a sample record into my-trainer/test/
node ChimeraHub/tools/check-trainer.mjs my-trainer --browser
# push my-trainer to its own public repository, then open a
# "Submit a trainer" issue on ChimeraHub
```

---

## 1. Build it on the harness

`tools/new-trainer.mjs` gives you a complete, working trainer: Posner cueing,
built on the **harness** (`shared/harness/`), with the harness copied in so
your trainer runs on its own. Open its `index.html`, play a session, then
replace the inside of `session` in `trainer.js` with your own trials.

The harness gives every trainer the same shape and look, and handles the
parts that are easy to get wrong:

- **Screens:** home, how-it-works, settings, the session, results and
  history.
- **Look:** the hub's style (gold on black, monospace, square corners), at
  phone and desk sizes.
- **Input:** response buttons that are also keys, with response times
  measured from the stimulus.
- **Pausing:** on Escape, on the pause button, and whenever the page is
  hidden. Waits and response windows stop with it, and paused time is never
  counted.
- **Level:** kept between sessions and moved by a rule you can replace.
- **Record:** sessions saved in the Chimera record format, with accuracy,
  signal-detection counts and response times filled in from your trial log.
- **Export:** an "Export record" button on the history screen.

The API is documented at the top of
[`shared/harness/harness.js`](shared/harness/harness.js), and
[`templates/trainer/trainer.js`](templates/trainer/trainer.js) is a worked
example.

**You don't have to use the harness.** A trainer in React, Svelte or plain
JavaScript is welcome if it meets the criteria below. Using the harness meets
most of them for you.

## 2. The criteria

"**Must**" items are required, and `tools/check-trainer.mjs` tests most of
them. "**Should**" items are what reviewers look for; a trainer can be
accepted without them, but it's better with them.

### Data: compatible with the archive

1. **Must: write the Chimera record format.** Every session goes in
   `localStorage` under `chimera.<id>.record.v1`, in the format specified in
   [`shared/harness/FORMAT.md`](shared/harness/FORMAT.md). It's a table of
   sessions, each with an optional table of trials. The columns are fixed,
   and most may be left empty when your trainer doesn't measure that thing.
   This is what makes a trainer compatible with the archive: the archive, the
   day's meter, the desktop gate and Share your data all read it with no code
   from you. The harness writes it for you.
2. **Must: count only training time.** `activeSeconds` excludes pauses, menus
   and time the page was hidden. The quota is enforced on this number.
3. **Must: give every level a unit.** If a session has a `level`, it has
   `units.level` (`"n"`, `"premises"`, `"target-ms"`…). Your README says which
   direction is harder.
4. **Must: keep ids stable.** A session's `id` never changes, so importing the
   same record twice changes nothing.
5. **Must: include a real sample.** Add `test/sample-record.json`, exported
   from a session you actually played (History → Export record). The check
   validates it, and the hub's tests read it on every build.
6. **Should: include the trial log.** It's the only way anyone can later ask
   questions about lures, streaks or response time by condition.
7. **Must: store no personal data.** No names, no typed text, no device ids.

### Running on the hub

8. **Must: open from `index.html`, using relative paths only.** The hub serves
   each trainer from a sub-folder (`/ChimeraHub/<id>/`), in a frame, and the
   APK serves it from the phone itself. If you have a build step, declare it in
   `chimera.json` as `{ "command": "npm run build", "output": "dist" }`. It must
   run under `npm ci` and produce output with a relative base (`./`).
9. **Must: load nothing from the network.** No CDN scripts, no web fonts, no
   remote images or sounds, no `fetch` to anywhere. Bundle everything. The hub
   and its APK run with the network off.
10. **Must: no analytics, trackers or API keys.**
11. **Must: pause when the page is hidden.** The hub hides a trainer's frame
    when the player goes back to the menu, and the trainer must stop
    presenting trials and stop counting time (`visibilitychange`).
12. **Must: stay in its frame.** Don't touch `top` or `parent`, and don't use
    `target="_top"`. Don't read or write another app's storage.
13. **Should: namespace your own storage keys** as `chimera.<id>.…`, so they
    can't collide with another trainer's on the same origin.
14. **Must: work on a phone and at a desk.** Touch targets at least 44px,
    usable at 360px wide with no sideways scrolling, and keyboard controls.
15. **Must: stay under 25 MB, without `node_modules`.**

### The repository

16. **Must: have a `chimera.json` at the root.** Example:

    ```json
    {
      "id": "my-trainer",
      "name": "My Trainer",
      "what": "One line on what it trains (90 characters at most)",
      "categories": ["nback"],
      "unit": "n",
      "license": "MIT",
      "maintainer": "your-github-name",
      "repository": "https://github.com/your-github-name/my-trainer",
      "build": null
    }
    ```

    The first entry in `categories` is the main one, and you can list more.
    The categories are `rrt`, `nback`, `cct`, `att`, `mot`, `posner`,
    `spatial`, `imagery`, `inhibition`, `speed` and `other`.
17. **Must: use a license that lets the hub ship it.** Any OSI-approved
    license (MIT, Apache-2.0, GPL-3.0…), and it covers the assets too. You must
    have the right to submit everything in the repository.
18. **Must: have a README** with three sections: **What it trains** (the
    ability, the paradigm, and references to the research it rests on), **How
    difficulty is measured** (the unit, which way is harder, and what moves
    it), and **Controls**.
19. **Must: live in a public repository you maintain.** The hub grafts it in
    with its history, and that repository stays its home. Fixes made on the
    hub are pushed back there, and issues about it belong there.

### What reviewers judge

The check can't test these. A hub leader plays the trainer and decides:

- **It trains something.** It rests on a known paradigm or a clear
  rationale, and it's a real addition rather than a reskin of a trainer
  already on the hub.
- **Difficulty adapts.** A beginner can start, a strong player is still
  challenged after weeks, and the level moves in response to performance.
- **It's playable.** Instructions are clear before the first trial, feedback
  is immediate, and nothing is ambiguous under time pressure.
- **It's accessible.** Colour is never the only way information is shown,
  sound-only trainers say so up front (and say if headphones are needed), and
  motion respects reduced-motion settings where it can.
- **It's honest.** It makes no claims beyond the evidence, and it has no
  dark patterns.

## 3. Submit it

1. **Check it** from a clone of this repository:

   ```bash
   node tools/check-trainer.mjs path/to/my-trainer --browser
   ```

   It prints every criterion it can test. Fix every `FAIL` before
   submitting. (`--browser` needs Playwright: `npm i -D playwright && npx playwright install chromium`.)
2. **Push** the trainer to its own public GitHub repository. Tag the version
   you want reviewed (`git tag v1.0.0 && git push --tags`).
3. **Open a ["Submit a trainer"](https://github.com/Project-Chimera-Hub/ChimeraHub/issues/new?template=submit-trainer.yml)
   issue.** Give the repository address and the tag, and confirm the
   criteria.

## 4. What happens next

```
issue opened ──► check runs ──► report on the issue ──► fix and /recheck …
                                     │ passes
                                     ▼
                         leader plays and reviews it
                                     │ adds the "approved" label
                                     ▼
          grafted into apps/<id>/ with its history, added to the catalog,
          tests run, pull request opened
                                     │ leader reviews and merges
                                     ▼
                     on the hub, counted, archived, in the APK
```

- **The check** is the *Trainer submission* workflow. It clones your
  repository, runs `check-trainer.mjs --browser`, and posts the report on
  your issue, labelled `ready-for-review` or `needs-changes`. Editing the
  issue or commenting `/recheck` runs it again. It never builds or runs your
  code beyond loading the page in a headless browser.
- **Approval** is in two steps, and both are a leader's: the `approved`
  label (only maintainers and admins can add it, and the workflow checks
  this), and the review of the import pull request, which `CODEOWNERS`
  requires before anything merges.
- **On the hub,** your trainer has a card in its categories and is counted
  toward the day and the quota. Its sessions go into the archive and Share
  your data.

## 5. After it's on the hub

- **Updates:** push to your repository, then either open a pull request here
  that runs `tools/sync.sh pull <id>`, or ask a leader to run it. Run
  `check-trainer.mjs --update` first.
- **Changing the record:** put new measures under `extra`, never
  repurpose a column, and never change a session's id. The archive keeps
  every record it has ever read.
- **Retiring a trainer** removes its card, but never its records. The format
  reader stays, so years of somebody's training are still readable.

Questions before you start: the [Discord](https://discord.com/invite/chmr).

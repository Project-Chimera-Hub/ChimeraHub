"use strict";

/*
 * Tests for the shell, run under node over the very file the browser loads —
 * the archive's convention, and for its reason: a suite that runs against a
 * transpiled copy is a suite about a copy.
 *
 *   node test/run.js
 *
 * What is tested is the meter, because the meter is the whole promise. The
 * shell's claim is that its trainers can be counted without any of them
 * knowing this page exists; if the count is wrong the gate locks a machine over
 * a number nobody can defend.
 */

const assert = require("assert");
const path = require("path");
const { readFileSync } = require("fs");

/* `today.js` reads a global `localStorage` and calls the global `readFile` that
   `adapters.js` defines. Under node both have to be put where it will look —
   which is the same wiring the browser does with two script tags. */
const store = {};
global.localStorage = {
  get length() { return Object.keys(store).length; },
  key(i) { return Object.keys(store)[i]; },
  getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; },
};
global.readFile = require("../apps/archive/js/adapters.js").readFile;

const Today = require("../shell/js/today.js");

function reset() { for (const k of Object.keys(store)) delete store[k]; }

/* Fixed days rather than "now": a suite that passes only between 00:00 and
   23:00 UTC is a suite that fails on someone else's afternoon. */
const DAY = "2026-09-10";
const at = (h, m) => Date.parse(`${DAY}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00Z`);

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

/* ------------------------------------------------------------------ *
 * Fixtures — each in the shape its own trainer writes                 *
 * ------------------------------------------------------------------ */

/* Relational N-back: newest first, with an id and a wall-clock duration. */
function relational(sessions) {
  store.rel4_nback_history_v2 = JSON.stringify(sessions.map((s, i) => ({
    id: s.at + "-" + i,
    date: new Date(s.at).toISOString(),
    mode: "dual",
    n: 2,
    trials: 40,
    durationSec: s.minutes * 60,
    combinedAccuracy: 80,
    streams: {},
  })));
}

/* Chimera: oldest first, and the time read from trials × average interval —
   so a minute here is 60 one-second trials under a longer planned length. */
function chimera(sessions) {
  store.apasat_history_v1 = JSON.stringify(sessions.map((s) => ({
    timestamp: s.at,
    mode: "adaptive",
    durationSec: 3600,
    totalTrials: s.minutes * 60,
    avgSpeedMs: 1000,
    finalSpeedMs: 1000,
    fastestSpeedMs: 900,
    overallAccuracy: 75,
  })));
}

/* ------------------------------------------------------------------ *
 * The count                                                           *
 * ------------------------------------------------------------------ */

test("an empty browser is an empty day, not an error", () => {
  reset();
  assert.deepStrictEqual(Today.minutesOn(DAY), {});
  assert.strictEqual(Today.totalMinutes(DAY), 0);
});

test("a trainer's own storage becomes that day's minutes", () => {
  reset();
  relational([{ at: at(9), minutes: 12 }]);
  assert.strictEqual(Math.round(Today.minutesOn(DAY).relational), 12);
});

test("two trainers on one day add up", () => {
  reset();
  relational([{ at: at(9), minutes: 12 }]);
  chimera([{ at: at(18), minutes: 8 }]);
  assert.strictEqual(Math.round(Today.totalMinutes(DAY)), 20);
});

test("another day's sessions do not count toward this one", () => {
  reset();
  relational([{ at: at(9), minutes: 12 }, { at: at(9) - 86400000, minutes: 40 }]);
  assert.strictEqual(Math.round(Today.totalMinutes(DAY)), 12,
    "yesterday's training was counted toward today's quota");
});

test("a source with nothing today is absent rather than zero", () => {
  reset();
  relational([{ at: at(9), minutes: 12 }]);
  chimera([{ at: at(9) - 86400000, minutes: 40 }]);
  const by = Today.minutesOn(DAY);
  assert.ok(!("chimera" in by), "a source with no time today appeared in the day");
});

test("garbage under a trainer's key does not take the day down with it", () => {
  reset();
  store.rel4_nback_history_v2 = "{ this is not json";
  store.apasat_history_v1 = JSON.stringify({ history: "not an array" });
  store.affective_nback_v3 = JSON.stringify({ totals: "nonsense" });
  assert.doesNotThrow(() => Today.minutesOn(DAY));
  assert.strictEqual(Today.totalMinutes(DAY), 0);
});

test("eWMT's one day of milliseconds reaches the meter", () => {
  reset();
  /* The app names the day locally and unpadded; the fixture day is one where
     that and the UTC day agree. */
  store.affective_nback_v3 = JSON.stringify({ v: 3, settings: {},
    totals: { allMs: 7200000, dayKey: "2026-9-10", dayMs: 600000 } });
  assert.strictEqual(Math.round(Today.minutesOn(DAY).ewmt), 10);
});

/* Retired trainers. The hub no longer offers them and the meter does not count
   them toward the day — `counted` in shell/js/catalog.js is the filter — but their
   records are still read, because a streak is history and history does not
   stop being true when an app leaves. */

test("a chunked Syllogimous history reaches the meter", () => {
  reset();
  const q = { answeredAt: at(9), createdAt: at(9) - 30000, answered: true, type: "Syllogism" };
  store.SYL_HISTORY_IDX = JSON.stringify([0]);
  store["SYL_HISTORY_C:0"] = JSON.stringify([q, { ...q, answeredAt: at(9) + 60000, createdAt: at(9) + 30000 }]);
  assert.strictEqual(Math.round(Today.minutesOn(DAY).syllogimous * 60), 60,
    "the meter still asked for SYL_HISTORY and saw no Syllogimous");
});

test("Isomorph reaches the meter, and does not arrive as Syllogimous", () => {
  reset();
  const q = (at) => ({ answeredAt: at, createdAt: at - 30000, answered: true,
                       type: "RCC8 Regions", userAnswer: true, isValid: true });
  store["ISO/SYL_APP"] = "isomorph";
  store["ISO/SYL_HISTORY_IDX"] = JSON.stringify([0]);
  store["ISO/SYL_HISTORY_C:0"] = JSON.stringify([q(at(9)), q(at(9) + 60000)]);
  const by = Today.minutesOn(DAY);
  assert.strictEqual(Math.round(by.isomorph * 60), 60);
  assert.ok(!("syllogimous" in by), "Isomorph's answers were credited to Syllogimous");
});

test("both builds in one browser are two trainers, not one", () => {
  /* Isomorph and Syllogimous write the same key names and share this origin.
     The prefix on Isomorph's keys is the only thing between them, and the
     failure it prevents is silent: one app's day swallowing the other's, with
     a plausible total either way. */
  reset();
  const q = (at, type) => ({ answeredAt: at, createdAt: at - 30000, answered: true,
                             type: type, userAnswer: true, isValid: true });
  store["ISO/SYL_APP"] = "isomorph";
  store["ISO/SYL_HISTORY_IDX"] = JSON.stringify([0]);
  store["ISO/SYL_HISTORY_C:0"] = JSON.stringify([q(at(9), "Frames")]);
  store.SYL_HISTORY_IDX = JSON.stringify([0]);
  store["SYL_HISTORY_C:0"] = JSON.stringify([q(at(10), "Syllogism")]);

  const by = Today.minutesOn(DAY);
  assert.strictEqual(Math.round(by.isomorph * 60), 30);
  assert.strictEqual(Math.round(by.syllogimous * 60), 30);
  assert.strictEqual(Math.round(Today.totalMinutes(DAY) * 60), 60);
});

/* ------------------------------------------------------------------ *
 * The file a player shares                                            *
 * ------------------------------------------------------------------ */

const Kit = require("../shared/share-kit/share-kit.js");
const Share = require("../shell/js/share.js");

/* Quad Box's games as its IndexedDB holds them: the game's meta, its scores
   per stimulus, and a status. */
const quadGame = (h, extra) => ({
  id: h, title: "quad", nBack: 3, rules: "default", tags: ["position", "audio", "shape", "color"],
  trialTime: 2500, numTrials: 30, start: at(h) - 75000, timestamp: at(h), completedTrials: 30,
  status: "completed",
  scores: { position: { hits: 9, misses: 1 }, audio: { hits: 8, misses: 2 }, shape: { hits: 7, misses: 3 }, color: { hits: 6, misses: 4 } },
  ...extra,
});

test("every trainer that keeps sessions is in the shared file", () => {
  reset();
  chimera([{ at: at(9), minutes: 2 }]);
  relational([{ at: at(10), minutes: 3 }]);
  store.mp_prog = JSON.stringify({ history: [{ ts: at(11), acc: 80, correct: 40, total: 50, lowestISI: 1500, durationSec: 300, nback: 2 }] });
  store["earshot.sessions.v1"] = JSON.stringify([{
    id: "x", startedAt: at(12) - 240000, endedAt: at(12), partial: false, key: "ring/6/2/all/8",
    setup: "Ring, 6 sounds, 2 targets, all around, 8 s tracking",
    config: { mode: "ring", n: 6, t: 2, frontOnly: false, duration: 8, sound: "beeps" },
    threshold: 42.5, accuracy: 0.7, reversals: 6, trials: [{ n: 1, speed: 40, correct: true, picked: [3, 5] }],
  }]);
  /* eWMT has a day of minutes and no sessions, so it adds nothing. */
  store.affective_nback_v3 = JSON.stringify({ v: 3, settings: {}, totals: { allMs: 60000, dayKey: "2026-9-10", dayMs: 60000 } });

  const file = Share.build(at(23), [quadGame(13), quadGame(14, { status: "tombstone" })]);
  assert.deepStrictEqual(Kit.validate(file), { ok: true, errors: [] });
  assert.deepStrictEqual(file.apps, { chimera: 1, relational: 1, cct: 1, earshot: 1, quadbox: 1 });

  const by = Object.fromEntries(file.rows.map((r) => [r.app, r]));
  assert.deepStrictEqual(file.rows.map((r) => r.app), ["chimera", "relational", "cct", "earshot", "quadbox"],
    "not in the order trained");
  assert.strictEqual(by.chimera.correct, 0.75);
  assert.strictEqual(by.relational.level, 2);
  assert.strictEqual(by.cct.level, 40, "CCT's level is its peak rate, 60000 / 1500 ms");
  assert.deepStrictEqual(
    [by.earshot.mode, by.earshot.level, by.earshot.correct, by.earshot.seconds],
    ["ring 6/2 all 8s", 42.5, 0.7, 240]);
  assert.deepStrictEqual(
    [by.quadbox.mode, by.quadbox.level, by.quadbox.correct, by.quadbox.seconds, by.quadbox.clock],
    ["quad", 3, 0.75, 75, 2.5]);
  assert.deepStrictEqual(by.quadbox.rungs, ["position", "audio", "shape", "color"]);

  /* What the player configured or did inside a session stays home. */
  const text = JSON.stringify(file);
  for (const leak of ["beeps", "picked", "Ring, 6 sounds", String(at(12))]) {
    assert.ok(!text.includes(leak), `the shared file carries ${JSON.stringify(leak)}`);
  }
});

test("a session the kit cannot hold whole keeps its row", () => {
  /* A two-hour Relational session is over the kit's hour. Losing the row for
     it would be losing the session; the figure goes, the row stays. */
  reset();
  relational([{ at: at(9), minutes: 120 }]);
  const file = Share.build(at(23), [quadGame(10, { status: "cancelled", title: "tally dual", rules: "variable" })]);
  assert.strictEqual(file.answers, 2);
  assert.strictEqual(file.rows[0].seconds, null);
  assert.strictEqual(file.rows[1].mode, "tally dual variable");
  assert.ok(file.rows[1].rungs.includes("ended-early"));
});

test("the shared file keeps a retired trainer's answers and none of its words", () => {
  /* Syllogimous left the hub, and a browser that played it still holds its
     answers — the ones this card was first made for. */
  reset();
  const q = (t, type, extra) => ({
    answeredAt: t, createdAt: t - 20000, answered: true, type,
    userAnswer: true, isValid: true, answerMode: "boolean",
    premises: ["<span class=\"subject\">Wallet</span> is left of Scale", "Scale is left of Puppy"],
    conclusion: "Wallet is left of Puppy",
    timerTypeOnAnswer: "2", gameModeOnAnswer: "1",
    difficulty: { level: 6.2, premises: 2, rungs: ["negation"], seconds: 40, carousel: true },
    ...extra,
  });
  store.SYL_HISTORY_IDX = JSON.stringify([0]);
  store["SYL_HISTORY_C:0"] = JSON.stringify([q(at(10), "Syllogism"), q(at(9), "Linear Arrangement", { userAnswer: false })]);
  store.SYL_KEYBINDS = JSON.stringify({ answerTrue: "ArrowUp" });

  const file = Share.build(at(23));
  const text = JSON.stringify(file);
  for (const leak of ["Wallet", "Puppy", "ArrowUp", "subject", String(at(9))]) {
    assert.ok(!text.includes(leak), `the shared file carries ${JSON.stringify(leak)}`);
  }
  const [wrong, right] = file.rows;
  assert.deepStrictEqual(right, {
    app: "syllogimous", mode: "Syllogism", level: 6.2, premises: 2, rungs: ["negation"],
    clock: 40, presentation: "1", timer: "2", answerMode: "boolean", correct: 1,
    seconds: 20, day: DAY, seq: 2,
  });
  assert.strictEqual(wrong.correct, 0);
});

test("the participant id is made once and kept", () => {
  reset();
  const a = Share.build().participant;
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.strictEqual(Share.build().participant, a,
    "a second file got a new id, so one player's files cannot be joined or deleted together");
});

function kitFile(answers, participant) {
  return Kit.makeFile(answers, { tool: "test", participant: participant || "0123456789abcdef", now: at(23) }).file;
}
const ans = (h, mode, extra) => ({ app: "demo", mode, at: at(h), correct: true, seconds: 12.34, ...extra });

test("share-kit writes only files its own validator accepts", () => {
  const { file, skipped } = Kit.makeFile([
    ans(9, "Linear Arrangement", { level: 5.678, rungs: ["third-axis", "<b>"] }),
    ans(10, "=cmd()"),                   // would open as a formula in a spreadsheet
    ans(11, "Frames", { secret: "me" }), // an unknown field is dropped, not carried
  ], { tool: "test", participant: "0123456789abcdef", now: at(23) });
  assert.strictEqual(skipped, 1);
  assert.deepStrictEqual(Kit.validate(file), { ok: true, errors: [] });
  assert.deepStrictEqual(file.rows[0].rungs, ["third-axis"]);
  assert.strictEqual(file.rows[0].level, 5.68);
  assert.ok(!JSON.stringify(file).includes("secret"));
});

test("share-kit turns away every way a file can be tampered with", () => {
  const good = kitFile([ans(9, "Syllogism"), ans(10, "Syllogism")]);
  const bad = (edit) => { const f = JSON.parse(JSON.stringify(good)); edit(f); return Kit.validate(f).ok; };
  assert.ok(bad(() => {}), "the untouched file was rejected");
  assert.ok(!bad((f) => { f.rows[0].name = "Jo"; }), "an extra field in a row");
  assert.ok(!bad((f) => { f.email = "a@b.c"; }), "an extra top-level field");
  assert.ok(!bad((f) => { f.rows[0].mode = "<img onerror=x>"; }), "markup in a mode");
  assert.ok(!bad((f) => { f.rows[0].correct = 7; }), "a score out of range");
  assert.ok(!bad((f) => { f.rows.pop(); }), "counts that no longer match the rows");
  assert.ok(!bad((f) => { f.participant = "jo@example.com"; }), "an identifying participant");
  assert.ok(!bad((f) => { f.rows[0].day = "2999-01-01"; }), "a day after the file was made");
  /* JSON.parse makes these ordinary keys, and a bare lookup in an object
     literal finds them on the prototype — the bug this line exists for. */
  assert.ok(!Kit.validate(JSON.parse(JSON.stringify(good).replace('"rows":[{', '"rows":[{"constructor":1,'))).ok);
  assert.ok(!Kit.validate(JSON.parse(JSON.stringify(good).replace("{", '{"__proto__":{"x":1},'))).ok);
});

test("uploading twice counts each answer once", () => {
  const morning = kitFile([ans(9, "A"), ans(10, "B")]);
  const evening = kitFile([ans(9, "A"), ans(10, "B"), ans(20, "C")]);
  const other = kitFile([ans(9, "A")], "fedcba9876543210");
  const rows = Kit.merge([evening, morning, other]);
  assert.strictEqual(rows.length, 4);
  assert.deepStrictEqual(rows.filter((r) => r.participant === "0123456789abcdef").map((r) => r.mode), ["A", "B", "C"]);
});

/* ------------------------------------------------------------------ *
 * What the quota may not include                                      *
 * ------------------------------------------------------------------ */

test("the archive contributes no minutes", () => {
  reset();
  /* The archive's own keys, as `app.js` writes them. They must be invisible to
     the meter: maintaining the record is not training, and a gate that could be
     satisfied by tidying is a gate that will be. */
  store["archive.unsaved"] = "3";
  store["archive.savedAt"] = new Date(at(12)).toISOString();
  store["mindbuild.quota.minutes"] = "20";
  assert.strictEqual(Today.totalMinutes(DAY), 0);
});

/* ------------------------------------------------------------------ *
 * The streak                                                          *
 * ------------------------------------------------------------------ */

test("a streak counts back from the last day trained", () => {
  reset();
  const today = new Date();
  const days = [0, 1, 2].map((back) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - back);
    return d.getTime();
  });
  relational(days.map((t) => ({ at: t, minutes: 10 })));
  assert.strictEqual(Today.streak(), 3);
});

test("a gap ends the streak", () => {
  reset();
  const today = new Date();
  const days = [0, 1, 3].map((back) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - back);
    return d.getTime();
  });
  relational(days.map((t) => ({ at: t, minutes: 10 })));
  assert.strictEqual(Today.streak(), 2, "a missed day did not end the streak");
});

/* ------------------------------------------------------------------ *
 * Every trainer is reachable                                          *
 * ------------------------------------------------------------------ */

test("every key the shell watches is one an adapter recognises", () => {
  /* The failure this catches is silence: a trainer renames its storage key, the
     adapter stops matching, and the meter reports a smaller day rather than an
     error. Here the shape is known good, so a null means the wiring broke. */
  const probes = [
    ["mp_prog", JSON.stringify({ history: [{ ts: at(9), acc: 80, correct: 8, total: 10, lowestISI: 2000, durationSec: 60, nback: 1 }] })],
    ["apasat_history_v1", JSON.stringify([{ timestamp: at(9), mode: "adaptive", durationSec: 120, totalTrials: 30, avgSpeedMs: 2000, overallAccuracy: 80 }])],
    ["affective_nback_v3", JSON.stringify({ v: 3, settings: {}, totals: { allMs: 60000, dayKey: "2026-9-10", dayMs: 60000 } })],
    ["rel4_nback_history_v2", JSON.stringify([{ id: "a", date: new Date(at(9)).toISOString(), n: 2, durationSec: 60, combinedAccuracy: 80 }])],
    /* Retired, still read. */
    ["nback-performance", JSON.stringify([{ date: new Date(at(9)).toISOString(), duration: 60000, settings: {}, totalMatches: 5, hits: 4, falseAlarms: 0 }])],
    ["spatial-rotation.progress.v1", JSON.stringify({ history: [{ ts: at(9), seconds: 60, attempts: 20, accuracy: 0.8, mode: "m" }] })],
  ];
  /* Isomorph needs two keys to be recognised at all — the index and the chunk
     it names — so it cannot be a one-key probe like the rest. */
  reset();
  store["ISO/SYL_HISTORY_IDX"] = JSON.stringify([0]);
  store["ISO/SYL_HISTORY_C:0"] = JSON.stringify([{ answeredAt: at(9), createdAt: at(9) - 60000,
    answered: true, type: "Frames", userAnswer: true, isValid: true }]);
  assert.ok(Today.totalMinutes(DAY) > 0,
    "Isomorph produced no minutes — its adapter stopped matching");

  for (const [key, value] of probes) {
    reset();
    store[key] = value;
    assert.ok(Today.totalMinutes(DAY) > 0, `${key} produced no minutes — its adapter stopped matching`);
  }
});

const CATALOG = require("../shell/js/catalog.js");

test("every card on the hub opens an app that is in the repository", () => {
  /* Paths are relative to the site, and the build puts each app at the path
     its directory under apps/ has — so a card whose directory is missing is
     a card that opens a 404 inside the frame. */
  const paths = CATALOG.trainers.map((t) => t.path);
  assert.ok(paths.length >= 11, `only ${paths.length} trainers in the catalog`);
  for (const p of paths) {
    /* Syllogimous is Angular, and its page is built from src/. */
    const dir = path.join(__dirname, "..", "apps", p);
    const file = ["index.html", "src/index.html"].map((f) => path.join(dir, f))
      .find((f) => require("fs").existsSync(f));
    assert.ok(file, `the card for ${p} opens nothing: no index.html in ${dir}`);
  }
});

test("every counted trainer is a source an adapter reports", () => {
  /* The meter finds a trainer's minutes by its id. A card whose id no adapter
     uses is a trainer the day can never see, shown as if it could.

     Two ways to be read: the trainers that were here before the record format
     each have an adapter of their own; every trainer since writes the format,
     ships a sample of it, and is read by `readChimeraRecord`. */
  const LEGACY = ["cct", "chimera", "ewmt", "precision", "relational", "rnb", "rrt", "syllogimous"];
  const ids = CATALOG.trainers.filter((t) => t.counted).map((t) => t.id);
  const adapters = readFileSync(path.join(__dirname, "..", "apps", "archive", "js", "adapters.js"), "utf8");
  for (const id of LEGACY) assert.ok(ids.includes(id), `${id} is no longer counted`);
  for (const id of ids) {
    if (LEGACY.includes(id)) {
      /* Syllogimous's reader is shared with Isomorph's and takes the source as
         an argument rather than spelling it out. */
      assert.ok(adapters.includes(`source: "${id}"`) || adapters.includes(`Shaped(data, "${id}"`),
        `no adapter reports source "${id}"`);
      continue;
    }
    const dir = path.join(__dirname, "..", "apps", id);
    const sample = path.join(dir, "test", "sample-record.json");
    assert.ok(require("fs").existsSync(path.join(dir, "chimera.json")), `${id} has no chimera.json`);
    assert.ok(require("fs").existsSync(sample), `${id} has no test/sample-record.json`);
    const reading = require("../apps/archive/js/adapters.js").readFile(readFileSync(sample, "utf8"));
    assert.ok(reading && !reading.error && reading.source === id,
      `${id}'s sample record is not read as ${id}: ${reading && (reading.error || reading.source)}`);
  }
});

test("no trainer's page loads anything from the network", () => {
  /* The hub and its APK run with the network off, and a stylesheet that
     @imports a webfont is worse than slow offline: Chrome fires `error` on it,
     and Syllogimous's whole stylesheet stayed media=print because of exactly
     that. Pages and the stylesheets they ship, as written in the repository. */
  const fs = require("fs");
  const remote = /<(script|link)\b[^>]*\s(src|href)=["'](https?:)?\/\/|@import\s+url\(\s*["']?https?:|googletagmanager|gtag\(/i;
  const pages = [];
  for (const t of CATALOG.trainers) {
    const dir = path.join(__dirname, "..", "apps", t.path);
    for (const f of ["index.html", "src/index.html", "chimera-hub.css", "styles.css", "src/app.css",
                     "src/assets/css/thickstrap.css"]) {
      const file = path.join(dir, f);
      if (fs.existsSync(file)) pages.push(file);
    }
  }
  assert.ok(pages.length >= 11, `only ${pages.length} pages found`);
  for (const file of pages) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      assert.ok(!remote.test(line), `${path.relative(path.join(__dirname, ".."), file)}:${i + 1} loads from the network: ${line.trim().slice(0, 100)}`);
    });
  }
});

test("every plain-page trainer wears the hub's look", () => {
  /* The ones whose own stylesheet is not the hub's carry chimera-hub.css,
     linked last so it wins. Syllogimous, Threshold N-back, Relation Streams
     and Quad Box are themed in their own source instead. */
  const fs = require("fs");
  for (const id of ["rrt", "cct", "relational", "ewmt", "chimera", "att", "earshot"]) {
    const t = CATALOG.trainers.find((x) => x.id === id);
    const dir = path.join(__dirname, "..", "apps", t.path);
    assert.ok(fs.existsSync(path.join(dir, "chimera-hub.css")), `${id} has no chimera-hub.css`);
    const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
    const at = html.indexOf('href="chimera-hub.css"');
    assert.ok(at > 0, `${id}'s page does not link chimera-hub.css`);
    assert.ok(!/<link[^>]+rel="stylesheet"/i.test(html.slice(at + 30, html.indexOf("</head>"))) &&
              !/<style\b/i.test(html.slice(at, html.indexOf("</head>"))),
      `${id} loads a stylesheet after chimera-hub.css, which then loses`);
  }
});

test("the catalog is consistent: ids, categories and colours", () => {
  const cats = new Set(CATALOG.categories.map((c) => c.id));
  assert.strictEqual(cats.size, CATALOG.categories.length, "two categories share an id");
  for (const want of ["rrt", "nback", "cct", "att", "mot", "posner"]) {
    assert.ok(cats.has(want), `the ${want} category is missing`);
  }
  const ids = new Set(), colours = new Set();
  for (const t of CATALOG.trainers) {
    assert.ok(/^[a-z][a-z0-9-]*$/.test(t.id), `${t.id}: ids are lower-case and dashed`);
    assert.ok(!ids.has(t.id), `${t.id} is in the catalog twice`);
    ids.add(t.id);
    assert.ok(!colours.has(t.colour), `${t.id} shares its colour with another trainer`);
    colours.add(t.colour);
    assert.ok(Array.isArray(t.categories) && t.categories.length, `${t.id} has no category`);
    for (const c of t.categories) assert.ok(cats.has(c), `${t.id}: no category called ${c}`);
    assert.strictEqual(typeof t.counted, "boolean", `${t.id}: counted is not a boolean`);
    assert.ok(t.name && t.what && t.path.endsWith("/"), `${t.id}: name, what or path missing`);
  }
});

test("the home screen is a tree every trainer is in, once", () => {
  /* Folders, like a phone's: each category is one, folders sit in a category
     or another folder, and a trainer sits in its first category or the folder
     it names. A folder whose parent does not exist, or a cycle, would leave
     trainers that no tap reaches. */
  const cats = new Set(CATALOG.categories.map((c) => c.id));
  const folders = CATALOG.folders || [];
  const nodes = new Set([...cats, ...folders.map((f) => f.id)]);
  assert.strictEqual(nodes.size, cats.size + folders.length, "a folder shares an id with a category or another folder");
  for (const f of folders) {
    assert.ok(nodes.has(f.parent) && f.parent !== f.id, `folder ${f.id} has no parent ${f.parent}`);
    let at = f.parent, hops = 0;
    while (!cats.has(at)) { at = folders.find((x) => x.id === at).parent; assert.ok(++hops < 20, `folder ${f.id} is in a cycle`); }
  }
  for (const t of CATALOG.trainers) {
    const home = t.folder || t.categories[0];
    assert.ok(nodes.has(home), `${t.id} sits in ${home}, which is not a folder`);
    if (t.folder) {
      let at = t.folder;
      while (!cats.has(at)) at = folders.find((x) => x.id === at).parent;
      assert.ok(t.categories.includes(at), `${t.id}'s folder is under ${at}, a category it does not list`);
    }
  }
  const rnf = folders.find((f) => f.id === "relational-nback");
  assert.ok(rnf, "the Relational N-back folder is gone");
  assert.deepStrictEqual(CATALOG.trainers.filter((t) => t.folder === "relational-nback").map((t) => t.id).sort(),
    ["listening", "relational", "rit", "rnb"]);
});

test("the page loads the catalog before the shell", () => {
  const html = readFileSync(path.join(__dirname, "..", "shell", "index.html"), "utf8");
  assert.ok(html.includes("js/catalog.js"), "shell/index.html does not load catalog.js");
  assert.ok(html.indexOf("js/catalog.js") < html.indexOf("js/shell.js"),
    "catalog.js loads after shell.js, so `CATALOG` is undefined when the shell runs");
});

/* ------------------------------------------------------------------ *
 * The quota's caps                                                    *
 * ------------------------------------------------------------------ *
 *
 * A cap is a share of the *counted* day, not the raw one. Every case below
 * turns on that distinction, and getting it backwards is the difference
 * between "CCT can never carry a quota" and "CCT can carry one slowly".
 */

const Q = require("../shared/quota.js");
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.01, `${what}: ${a} ≠ ${b}`);

test("an uncapped day counts every minute of itself", () => {
  near(Q.apply({ relational: 12, chimera: 8 }).total, 20, "uncapped total");
});

test("cct alone can never satisfy a quota, however long it runs", () => {
  near(Q.apply({ cct: 600 }).total, 0, "ten hours of cct");
});

test("a capped source under its ceiling is counted whole", () => {
  const r = Q.apply({ relational: 20, cct: 1 });
  near(r.total, 21, "total");
  near(r.counted.cct, 1, "cct");
  assert.deepStrictEqual(r.capped, [], "a source under its ceiling was reported as capped");
});

test("cct at its ceiling supplies a fifth of the day", () => {
  /* 16 uncapped and cct effectively unlimited: the fixed point is
     16 / (1 - 0.20) = 20, of which cct may be 20%. */
  const r = Q.apply({ relational: 10, ewmt: 6, cct: 600 });
  near(r.total, 20, "total");
  near(r.counted.cct, 4, "cct at 20% of 20");
});

test("two caps at their ceiling supply their sum of the day", () => {
  /* The policy is general, and a gate.json may name more than one source. */
  const r = Q.apply({ relational: 15, synth: 600, cct: 600 }, { synth: 0.05, cct: 0.20 });
  near(r.total, 20, "total");
  near(r.counted.synth, 1, "synth at 5% of 20");
  near(r.counted.cct, 4, "cct at 20% of 20");
});

test("a capped source keeps its raw figure alongside the counted one", () => {
  const r = Q.apply({ relational: 15, cct: 600 });
  near(r.raw.cct, 600, "raw cct");
  assert.ok(r.counted.cct < r.raw.cct, "counted was not below raw");
  assert.deepStrictEqual(r.capped, ["cct"]);
});

test("capping never invents time", () => {
  for (const day of [{ relational: 3, cct: 99 }, { ewmt: 7, cct: 7 }, { chimera: 1, cct: 40 }]) {
    const r = Q.apply(day);
    const rawTotal = Object.values(day).reduce((a, b) => a + b, 0);
    assert.ok(r.total <= rawTotal + 1e-9, `counted ${r.total} exceeded raw ${rawTotal}`);
    for (const s of Object.keys(r.counted)) {
      assert.ok(r.counted[s] <= day[s] + 1e-9, `${s} counted above its raw minutes`);
    }
  }
});

test("an empty day survives the policy", () => {
  const r = Q.apply({});
  near(r.total, 0, "total");
  assert.deepStrictEqual(r.capped, []);
});

test("removing the caps counts everything", () => {
  near(Q.apply({ chimera: 50, cct: 50 }, {}).total, 100, "uncapped by configuration");
});

test("the archive cannot be rescued by a cap it is not in", () => {
  /* The archive never reaches the policy, but if it ever did it must not add
     minutes: it is not in the caps and would be treated as uncapped training. */
  const r = Q.apply({ relational: 10 });
  assert.ok(!("archive" in r.counted), "the archive appeared in a counted day");
});

/* ------------------------------------------------------------------ *
 * Pausing the trainer the hub has covered                             *
 * ------------------------------------------------------------------ *
 *
 * Returning to the hub left the trainer running: the frame is hidden and its
 * `src` is deliberately not reassigned, so trials went on being presented and
 * clocks went on counting behind a menu. The shell meanwhile stops its own
 * session clock when the stage is hidden and recounts the day on the grounds
 * that nothing is being timed — an assertion that was true of the shell and
 * false of the thing it framed, while the meter credited the minutes to
 * whichever trainer was open.
 *
 * What is tested is the signal, not a trainer's reaction to it. The shell's
 * whole claim here is that it delivers the *browser's* own signal and injects
 * nothing, so a trainer that honours the standard API and knows nothing about
 * this page pauses correctly — which means the thing worth pinning down is that
 * a document behaving as the browser's does sees exactly what a real tab switch
 * would show it.
 */

const Pause = require("../shell/js/pause.js");

/**
 * A frame whose document answers visibility the way a real one does.
 *
 * `hidden` and `visibilityState` are prototype getters in the browser, so they
 * are prototype getters here: the shadow-and-delete this module turns on is
 * only correct against that shape, and a fake with own data properties would
 * pass while the real thing broke.
 */
function fakeFrame() {
  const proto = {
    get hidden() { return false; },
    get visibilityState() { return "visible"; },
  };
  const doc = Object.create(proto);
  const seen = [];
  doc.dispatchEvent = (e) => { seen.push(["doc", e.type, doc.visibilityState]); return true; };

  const win = { Event: class { constructor(type) { this.type = type; } } };
  win.dispatchEvent = (e) => { seen.push(["win", e.type, doc.visibilityState]); return true; };

  return { frame: { contentWindow: win, contentDocument: doc }, doc, seen };
}

test("covering the stage tells the frame it is hidden, as a tab switch would", () => {
  const { frame, doc, seen } = fakeFrame();
  assert.strictEqual(Pause.setFrameHidden(frame, true), true, "the signal was not delivered");

  assert.strictEqual(doc.hidden, true, "the document still reports itself showing");
  assert.strictEqual(doc.visibilityState, "hidden", "visibilityState was not changed");
  /* And the state is already right when the event arrives: a listener reads
     `document.hidden` rather than the event, so firing first would have it read
     the old answer. */
  assert.deepStrictEqual(seen, [
    ["doc", "visibilitychange", "hidden"],
    ["win", "blur", "hidden"],
  ], "the frame saw the wrong signal, or saw it in the wrong state");
});

test("re-opening the trainer hands the frame back to the browser", () => {
  const { frame, doc, seen } = fakeFrame();
  Pause.setFrameHidden(frame, true);
  seen.length = 0;

  assert.strictEqual(Pause.setFrameHidden(frame, false), true);
  assert.deepStrictEqual(seen, [
    ["doc", "visibilitychange", "visible"],
    ["win", "focus", "visible"],
  ], "the frame was not told it is showing again");
});

test("resuming uncovers the native getters rather than answering for them", () => {
  /* The failure this catches is the obvious implementation. Setting `hidden` to
     false leaves an own property that goes on saying false when the browser
     hides the tab for real — so the trainer stops pausing on a genuine tab
     switch, which is the case the API exists for and the one rnb's clock
     depends on. */
  const { frame, doc } = fakeFrame();
  Pause.setFrameHidden(frame, true);
  Pause.setFrameHidden(frame, false);

  assert.ok(!Object.prototype.hasOwnProperty.call(doc, "hidden"),
    "the shell is still answering for `hidden`, so a real tab switch is masked");
  assert.ok(!Object.prototype.hasOwnProperty.call(doc, "visibilityState"),
    "the shell is still answering for `visibilityState`");
  assert.strictEqual(doc.hidden, false, "the native getter did not come back");
});

test("pausing twice is the same as pausing once", () => {
  /* `home()` runs on every hash change, including one that does not move. */
  const { frame, doc } = fakeFrame();
  Pause.setFrameHidden(frame, true);
  Pause.setFrameHidden(frame, true);
  assert.strictEqual(doc.hidden, true);
  Pause.setFrameHidden(frame, false);
  assert.strictEqual(doc.hidden, false, "two pauses took two resumes to undo");
});

test("an empty frame is not an error", () => {
  /* The hub is the first thing shown, so `home()` runs before anything is
     loaded, and a frame between documents is an ordinary state. Throwing out of
     a navigation handler would take the hub down with it. */
  for (const frame of [null, {}, { contentWindow: null, contentDocument: null }]) {
    assert.strictEqual(Pause.setFrameHidden(frame, true), false,
      "an empty frame reported a delivered signal");
  }
});

test("the shell states the frame's visibility on both paths", () => {
  /* Read off the shipped file: the wiring is what makes the module do anything,
     and a module with no call site is the failure this whole area started as. */
  const src = require("fs").readFileSync(
    path.join(__dirname, "..", "shell", "js", "shell.js"), "utf8");

  const home = src.slice(src.indexOf("function home()"));
  assert.ok(/Pause\.setFrameHidden\(\$\("frame"\), true\)/.test(home.slice(0, 600)),
    "home() does not pause the trainer it is covering");

  const show = src.slice(src.indexOf("function show("), src.indexOf("function home()"));
  assert.ok(/Pause\.setFrameHidden\(\$\("frame"\), false\)/.test(show),
    "show() does not un-pause the trainer it is opening");

  /* And the page has to load it, or both calls are a ReferenceError that takes
     out navigation entirely. */
  const html = require("fs").readFileSync(
    path.join(__dirname, "..", "shell", "index.html"), "utf8");
  assert.ok(html.includes("js/pause.js"), "shell/index.html does not load pause.js");
  assert.ok(html.indexOf("js/pause.js") < html.indexOf("js/shell.js"),
    "pause.js loads after shell.js, so `Pause` is undefined when the shell runs");
});

/**
 * And the trainers honour it.
 *
 * The shell delivers the browser's own hidden signal and nothing more, so a
 * trainer only pauses if it listens. Two of the four do, each through the
 * pause it already has, and each only on the way into hiding: the PAUSE
 * button is on screen when you come back, and resuming by itself would
 * restart a session in front of somebody still finding their keys.
 *
 * CCT and Chimera do not listen, and are not made to here — they are the
 * projectchimera-dot apps as they stand. Leaving one for the hub leaves its
 * session running behind the menu.
 *
 * Checked statically, against the shipped file: what a dependency-free suite
 * can own is that the wiring is still there at all, which is the way this
 * would regress — a handler deleted in a refactor, and a trainer quietly
 * running behind the menu again.
 */
const PAUSED_TRAINERS = [
  ["ewmt", "apps/ewmt/index.html", /if \(!paused\) togglePause\(\)/],
  ["relational", "apps/relational/src/app.js", /togglePause\(true\)/],
];

for (const [name, file, pauses] of PAUSED_TRAINERS) {
  test(`${name} pauses when the page it is in goes hidden`, () => {
    const src = readFileSync(path.join(__dirname, "..", file), "utf8");
    const at = src.search(/addEventListener\(\s*['"]visibilitychange['"]/);
    assert.ok(at >= 0, `${name} does not listen for the signal the shell sends`);
    const handler = src.slice(at, at + 400);
    assert.ok(handler.includes("document.hidden"),
      `${name} listens but never asks whether it is hidden`);
    assert.ok(pauses.test(handler), `${name} hears it and does not pause`);
  });
}

/* ------------------------------------------------------------------ *
 * The archive wears the hub's theme, and the copy cannot drift         *
 * ------------------------------------------------------------------ *
 *
 * The archive is published as its own repository and has no build step, so it
 * cannot import the hub's stylesheet — the theme is a *copy*, including the
 * 24 kB drawing of the forest. A copy nobody checks is how two pages one click
 * apart end up looking like two applications, which is the thing the shared
 * look exists to prevent.
 *
 * So the values are not asserted against a third list kept here. They are read
 * out of both stylesheets and compared, which is the only arrangement where
 * "they agree" cannot rot. The names differ on purpose: the archive keeps the
 * tracker's vocabulary (`--bg-card`) because every rule in its file is written
 * against it, and only the values moved. The mapping is written out below, so
 * a rename on either side fails here rather than silently stopping the check.
 */

const SHELL_CSS = path.join(__dirname, "..", "shell", "css", "shell.css");
const ARCHIVE_CSS = path.join(__dirname, "..", "apps", "archive", "css", "base.css");

/**
 * The custom properties a stylesheet's `:root` sets.
 *
 * Read to the matching `}` rather than to the first one: `--bg-image` is an
 * SVG data URI with braces nowhere in it but semicolons everywhere, and the
 * naive split takes the picture apart.
 */
function rootTokens(file) {
  const src = readFileSync(file, "utf8");
  const at = src.indexOf(":root {");
  assert.ok(at >= 0, `${path.basename(file)} has no :root block`);
  const body = src.slice(at + ":root {".length, src.indexOf("\n}", at));

  const out = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([\s\S]*?);\s*(?=\n|$)/g)) {
    out[m[1]] = m[2].replace(/\s+/g, " ").trim();
  }
  return out;
}

/* Same name on both sides, and the same value. */
const SHARED = [
  "--bg", "--accent", "--accent-2", "--accent-rgb", "--ok", "--bad",
  "--radius", "--shadow", "--font-display", "--font-body",
];

/* Different name, same value: the archive's own vocabulary over the hub's. */
const RENAMED = {
  "--bg-card": "--panel",
  "--bg-hover": "--panel-hi",
  "--text-primary": "--ink-strong",
  "--text-secondary": "--ink",
  "--text-muted": "--dim",
  /* The forest is the hub's second picture now and the archive's only one. */
  "--bg-image": "--bg-forest",
};

test("the archive's theme is the hub's, value for value", () => {
  const hub = rootTokens(SHELL_CSS);
  const archive = rootTokens(ARCHIVE_CSS);

  for (const name of SHARED) {
    assert.ok(name in hub, `the hub no longer defines ${name}`);
    assert.ok(name in archive, `the archive no longer defines ${name}`);
    assert.strictEqual(archive[name], hub[name],
      `${name} differs between the hub and the archive, so the two pages read`
      + " as two applications one click apart");
  }

  for (const [here, there] of Object.entries(RENAMED)) {
    assert.ok(here in archive, `the archive no longer defines ${here}`);
    assert.ok(there in hub, `the hub no longer defines ${there}`);
    assert.strictEqual(archive[here], hub[there],
      `the archive's ${here} is no longer the hub's ${there}`);
  }

  /* The picture is the expensive half of the copy, and the one a careless edit
     would truncate rather than change — so it is checked for being there at
     full length as well as for matching. */
  assert.ok(archive["--bg-image"].length > 20000,
    "the archive's forest is a fraction of its size — the copy was truncated");
});

/**
 * And the shapes came over with the colours.
 *
 * The theme's own rule is that nothing is rounded, and a stylesheet keeps a
 * `--radius: 0` token so the rules that used it still read as shape decisions.
 * A rule that hard-codes its own radius slips straight past that, which is how
 * the tracker's 10px cards would come back one panel at a time.
 */
test("nothing in the archive rounds a corner behind the token's back", () => {
  const src = readFileSync(ARCHIVE_CSS, "utf8");
  const hard = [...src.matchAll(/border-radius:\s*([^;]+);/g)]
    .map(m => m[1].trim())
    /* The source dot is round, and the hub's own is too: six colours telling
       six trainers apart is data rather than decoration. */
    .filter(v => v !== "50%" && !v.startsWith("var(--radius"));

  assert.deepStrictEqual(hard, [],
    `the archive rounds a corner the theme does not: ${hard.join(", ")}`);
});

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * The Chimera record format                                           *
 * ------------------------------------------------------------------ *
 *
 * What every new trainer writes, and the one thing that lets a trainer onto
 * the meter without an adapter. Two copies of its reading exist — the
 * validator in shared/harness/record.js and the archive's reader, which
 * cannot import it — and these hold them to one answer.
 */

const CR = require("../shared/harness/record.js");
const { readChimeraRecord } = require("../apps/archive/js/adapters.js");

function chimeraRecord(app, sessions) {
  const f = CR.create(app, "n", "1.0.0");
  f.sessions = sessions;
  return f;
}

test("a minimal Chimera record is valid, and every optional column may be empty", () => {
  const f = chimeraRecord("probe", [{ id: "a", start: at(9), activeSeconds: 300 }]);
  const v = CR.validate(f);
  assert.ok(v.ok, v.errors.join("; "));
  f.sessions[0].level = null; f.sessions[0].accuracy = null; f.sessions[0].trialLog = null;
  assert.ok(CR.validate(f).ok, "nulls in optional columns were refused");
});

test("the validator refuses what would corrupt the record", () => {
  const bad = (mut) => { const f = chimeraRecord("probe", [{ id: "a", start: at(9), activeSeconds: 60 }]); mut(f); return CR.validate(f); };
  assert.ok(!bad((f) => { delete f.sessions[0].id; }).ok, "a session without an id passed");
  assert.ok(!bad((f) => { f.sessions.push({ id: "a", start: at(10), activeSeconds: 1 }); }).ok, "a repeated id passed");
  assert.ok(!bad((f) => { f.sessions[0].start = 1700000000; }).ok, "seconds where milliseconds belong passed");
  assert.ok(!bad((f) => { f.sessions[0].accuracy = 80; }).ok, "a percentage where a fraction belongs passed");
  assert.ok(!bad((f) => { f.units = {}; f.sessions[0].level = 3; }).ok, "a level with no unit passed");
  assert.ok(!bad((f) => { f.app = "My Trainer"; }).ok, "an app id with spaces passed");
  assert.ok(bad((f) => { f.sessions[0].colour = "red"; }).warnings.length, "an unknown column went unremarked");
});

test("the archive reads a Chimera record: a session per row, minutes by UTC day", () => {
  const f = chimeraRecord("probe", [
    { id: "a", start: at(9), activeSeconds: 600, level: 2, levelEnd: 3, trials: 20, correct: 15, mode: "dual",
      trialLog: [{ i: 0, t: 0, correct: true, rtMs: 512 }] },
    { id: "b", start: at(18), activeSeconds: 300, accuracy: 0.5 },
  ]);
  const r = readChimeraRecord(f);
  assert.strictEqual(r.source, "probe");
  assert.strictEqual(r.records.length, 2);
  near(r.minutes[DAY], 15, "minutes on the day");
  const a = r.records[0];
  assert.strictEqual(a.difficulty, 3, "difficulty is where the session ended");
  assert.strictEqual(a.unit, "probe-n", "the unit is not prefixed with the app");
  near(a.correct, 0.75, "accuracy from correct/trials");
  assert.strictEqual(a.label, "dual");
  assert.strictEqual(a.raw.trialCount, 1, "the trial log was not counted");
  assert.ok(!("trialLog" in a.raw), "the trial log went into raw");
  assert.strictEqual(r.records[1].unit, null, "a session with no level was given a unit");
  /* And by way of the dispatcher, which is what the meter and the gate call. */
  assert.strictEqual(require("../apps/archive/js/adapters.js").readFile(JSON.stringify(f)).source, "probe");
});

test("a trainer writing the format is on the meter with no line of hub code", () => {
  reset();
  store[CR.key("probe")] = JSON.stringify(chimeraRecord("probe", [{ id: "a", start: at(9), activeSeconds: 900 }]));
  near(Today.minutesOn(DAY).probe || 0, 15, "probe's minutes");
  /* A key that only looks like one is not read. */
  store["chimera.probe.record.v2"] = store[CR.key("probe")].replace('"probe"', '"other"');
  assert.ok(!Today.minutesOn(DAY).other, "a v2 key was read as v1");
  reset();
});

test("every record the validator passes, the archive reads, and the other way round", () => {
  const good = chimeraRecord("probe", [{ id: "a", start: at(9), activeSeconds: 60 }]);
  assert.ok(CR.validate(good).ok && readChimeraRecord(good), "a valid record was not read");
  for (const broken of [
    Object.assign({}, good, { format: "something-else" }),
    Object.assign({}, good, { version: 2 }),
    Object.assign({}, good, { app: "Not An Id" }),
  ]) {
    assert.ok(!CR.validate(broken).ok, "the validator passed " + JSON.stringify(broken).slice(0, 60));
    assert.strictEqual(readChimeraRecord(broken), null, "the archive read what the validator refuses");
  }
});

test("the record flattens to two tables with every column, empty where unsaid", () => {
  const f = chimeraRecord("probe", [{ id: "a", start: at(9), activeSeconds: 60, mode: "x, y",
    trialLog: [{ i: 0, correct: false }, { i: 1, rtMs: 400 }] }]);
  const t = CR.toTables(f);
  const sHead = t.sessions.split("\n")[0].split(",");
  assert.strictEqual(sHead.length, CR.SESSION.length, "sessions table lost or gained a column");
  assert.ok(t.sessions.includes('"x, y"'), "a comma in a cell was not quoted");
  assert.strictEqual(t.trials.trim().split("\n").length, 3, "two trials and a header");
  assert.ok(t.trials.split("\n")[1].startsWith("probe,a,0,"), "trials do not join to their session");
});

test("FORMAT.md documents every column, and its example is a valid record", () => {
  const md = readFileSync(path.join(__dirname, "..", "shared", "harness", "FORMAT.md"), "utf8");
  for (const col of CR.FILE.concat(CR.SESSION, CR.TRIAL)) {
    assert.ok(md.includes("| `" + col.name + "` | " + col.type + " |"),
      `FORMAT.md has no row for ${col.name} (${col.type})`);
  }
  const example = md.slice(md.indexOf("## A complete example"));
  const json = example.slice(example.indexOf("```json") + 7, example.indexOf("```", example.indexOf("```json") + 7));
  const v = CR.validate(JSON.parse(json));
  assert.ok(v.ok && !v.warnings.length, "the example is not clean: " + v.errors.concat(v.warnings).join("; "));
  assert.ok(readChimeraRecord(JSON.parse(json)), "the archive does not read the example");
});

/* ------------------------------------------------------------------ *
 * Reading a submission issue                                          *
 * ------------------------------------------------------------------ */

function parseSubmission(body) {
  try {
    const out = require("child_process").execFileSync(process.execPath,
      [path.join(__dirname, "..", "tools", "parse-submission.mjs")],
      { env: { ISSUE_BODY: body }, stdio: ["ignore", "pipe", "pipe"] }).toString();
    return Object.fromEntries(out.trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
  } catch (e) { return null; }
}
const issue = (repo, ref) => `### Repository\n\n${repo}\n\n### Branch or tag\n\n${ref}\n\n### Main category\n\nPosner — Posner cueing\n`;

test("a submission issue gives a repository and a ref, and nothing else", () => {
  assert.deepStrictEqual(parseSubmission(issue("https://github.com/someone/stroop-switch/", "v1.0.0")),
    { owner: "someone", repo: "stroop-switch", url: "https://github.com/someone/stroop-switch", ref: "v1.0.0" });
  assert.strictEqual(parseSubmission(issue("https://github.com/a/b.git", "_No response_")).ref, "main",
    "an empty ref is main");
  for (const [repo, ref] of [
    ["https://gitlab.com/a/b", "main"],
    ["https://github.com/a/b; rm -rf /", "main"],
    ["https://github.com/a/b", "main; curl evil"],
    ["https://github.com/a/b", "--upload-pack=touch /tmp/x"],
    ["https://github.com/a/b", "../../etc"],
    ["https://github.com/a/b\nhttps://github.com/c/d", "main"],
  ]) {
    assert.strictEqual(parseSubmission(issue(repo, ref)), null, `accepted ${repo} @ ${ref}`);
  }
});

test("the issue form offers exactly the catalog's categories", () => {
  const form = readFileSync(path.join(__dirname, "..", ".github", "ISSUE_TEMPLATE", "submit-trainer.yml"), "utf8");
  const offered = form.slice(form.indexOf("id: category"), form.indexOf("validations", form.indexOf("id: category")))
    .split("\n").filter((l) => /^\s+- /.test(l)).map((l) => l.replace(/^\s+- /, "").split(" — ")[0].trim());
  assert.deepStrictEqual(offered, CATALOG.categories.map((c) => c.name));
});

/* ------------------------------------------------------------------ *
 * The harness and the tools a trainer is made and checked with        *
 * ------------------------------------------------------------------ */

const Harness = require("../shared/harness/harness.js");

test("the harness summarises a trial log into the record's columns", () => {
  const log = [
    { i: 0, target: true, response: "m", correct: true, rtMs: 400 },
    { i: 1, target: true, response: null, correct: false },
    { i: 2, target: false, response: null, correct: true },
    { i: 3, target: false, response: "m", correct: false, rtMs: 600 },
    { i: 4, target: true, response: "m", correct: true, rtMs: 500 },
  ];
  const s = Harness.summarize(log);
  assert.deepStrictEqual([s.trials, s.correct, s.hits, s.misses, s.falseAlarms, s.correctRejections],
    [5, 3, 2, 1, 1, 1]);
  near(s.accuracy, 0.6, "accuracy");
  assert.strictEqual(s.rtMedianMs, 500);
  assert.strictEqual(s.rtMeanMs, 500);
  assert.ok(typeof s.dPrime === "number" && isFinite(s.dPrime), "no d' from a log with targets and foils");
  near(Harness.probit(0.975), 1.95996, "probit");
  assert.deepStrictEqual(Harness.summarize([]), {}, "an empty log should say nothing, not zero");
});

test("the default level rule climbs, holds and falls, inside its bounds", () => {
  const cfg = { level: { min: 1, max: 3 } };
  assert.strictEqual(Harness.staircase({ accuracy: 0.9 }, 2, cfg), 3);
  assert.strictEqual(Harness.staircase({ accuracy: 0.9 }, 3, cfg), 3, "climbed past max");
  assert.strictEqual(Harness.staircase({ accuracy: 0.7 }, 2, cfg), 2);
  assert.strictEqual(Harness.staircase({ accuracy: 0.4 }, 1, cfg), 1, "fell past min");
  assert.strictEqual(Harness.staircase({}, 2, cfg), 2, "moved with no accuracy to go on");
});

test("a trainer made by new-trainer.mjs, with a played session, passes check-trainer", () => {
  const os = require("os"), fs = require("fs"), cp = require("child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chimera-trainer-"));
  const out = path.join(dir, "probe-trainer");
  const tool = (name, args) => cp.spawnSync(process.execPath, [path.join(__dirname, "..", "tools", name), ...args],
    { encoding: "utf8" });
  try {
    let r = tool("new-trainer.mjs", ["probe-trainer", "--category", "posner", "--maintainer", "someone", "--out", out]);
    assert.strictEqual(r.status, 0, r.stderr);
    r = tool("check-trainer.mjs", [out]);
    assert.strictEqual(r.status, 1, "passed with no sample record");
    assert.ok(/no test\/sample-record\.json/.test(r.stdout), "did not say what was missing");

    const rec = CR.create("probe-trainer", "target-ms", "0.1.0");
    rec.sessions.push({ id: "1-a", start: at(9), activeSeconds: 120, level: 300, levelEnd: 255,
      trials: 2, correct: 2, accuracy: 1, trialLog: [{ i: 0, correct: true, rtMs: 300 }, { i: 1, correct: true, rtMs: 320 }] });
    fs.mkdirSync(path.join(out, "test"));
    fs.writeFileSync(path.join(out, "test", "sample-record.json"), JSON.stringify(rec));
    r = tool("check-trainer.mjs", [out]);
    assert.strictEqual(r.status, 0, r.stdout);

    /* And it refuses what it exists to refuse. */
    fs.appendFileSync(path.join(out, "index.html"), '<script src="https://cdn.example.com/x.js"></script>\n');
    r = tool("check-trainer.mjs", [out]);
    assert.strictEqual(r.status, 1, "a CDN script passed");
    assert.ok(r.stdout.includes("cdn.example.com"), "the CDN line was not named");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

for (const [name, fn] of cases) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}
console.log(`\n${passed}/${cases.length} passed`);

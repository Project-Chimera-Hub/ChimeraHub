"use strict";

/*
 * Tests for the shell, run under node over the very file the browser loads —
 * the archive's convention, and for its reason: a suite that runs against a
 * transpiled copy is a suite about a copy.
 *
 *   node test/run.js
 *
 * What is tested is the meter, because the meter is the whole promise. The
 * shell's claim is that seven trainers can be counted without any of them
 * knowing this page exists; if the count is wrong the gate locks a machine over
 * a number nobody can defend.
 */

const assert = require("assert");
const path = require("path");

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

function precision(sessions) {
  store["nback-performance"] = JSON.stringify(sessions.map((s) => ({
    date: new Date(s.at).toISOString(),
    duration: s.minutes * 60 * 1000,
    settings: { nLevel: 2 },
    totalMatches: 10,
    hits: 8,
    falseAlarms: 1,
  })));
}

function rotation(sessions) {
  store["spatial-rotation.progress.v1"] = JSON.stringify({
    history: sessions.map((s) => ({
      ts: s.at,
      seconds: s.minutes * 60,
      attempts: 20,
      accuracy: 0.8,
      mode: "molecule",
    })),
  });
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
  precision([{ at: at(9), minutes: 12 }]);
  assert.strictEqual(Math.round(Today.minutesOn(DAY).precision), 12);
});

test("two trainers on one day add up", () => {
  reset();
  precision([{ at: at(9), minutes: 12 }]);
  rotation([{ at: at(18), minutes: 8 }]);
  assert.strictEqual(Math.round(Today.totalMinutes(DAY)), 20);
});

test("another day's sessions do not count toward this one", () => {
  reset();
  precision([{ at: at(9), minutes: 12 }, { at: at(9) - 86400000, minutes: 40 }]);
  assert.strictEqual(Math.round(Today.totalMinutes(DAY)), 12,
    "yesterday's training was counted toward today's quota");
});

test("a source with nothing today is absent rather than zero", () => {
  reset();
  precision([{ at: at(9), minutes: 12 }]);
  rotation([{ at: at(9) - 86400000, minutes: 40 }]);
  const by = Today.minutesOn(DAY);
  assert.ok(!("rotation" in by), "a source with no time today appeared in the day");
});

test("garbage under a trainer's key does not take the day down with it", () => {
  reset();
  store["nback-performance"] = "{ this is not json";
  store["spatial-rotation.progress.v1"] = JSON.stringify({ history: "not an array" });
  assert.doesNotThrow(() => Today.minutesOn(DAY));
  assert.strictEqual(Today.totalMinutes(DAY), 0);
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
  precision(days.map((t) => ({ at: t, minutes: 10 })));
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
  precision(days.map((t) => ({ at: t, minutes: 10 })));
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
    ["nback-performance", JSON.stringify([{ date: new Date(at(9)).toISOString(), duration: 60000, settings: {}, totalMatches: 5, hits: 4, falseAlarms: 0 }])],
    ["spatial-rotation.progress.v1", JSON.stringify({ history: [{ ts: at(9), seconds: 60, attempts: 20, accuracy: 0.8, mode: "m" }] })],
  ];
  for (const [key, value] of probes) {
    reset();
    store[key] = value;
    assert.ok(Today.totalMinutes(DAY) > 0, `${key} produced no minutes — its adapter stopped matching`);
  }
});

/* ------------------------------------------------------------------ *
 * The quota's caps                                                    *
 * ------------------------------------------------------------------ *
 *
 * A cap is a share of the *counted* day, not the raw one. Every case below
 * turns on that distinction, and getting it backwards is the difference
 * between "synth can never carry a quota" and "synth can carry one slowly".
 */

const Q = require("../shared/quota.js");
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.01, `${what}: ${a} ≠ ${b}`);

test("an uncapped day counts every minute of itself", () => {
  near(Q.apply({ rnb: 12, rotation: 8 }).total, 20, "uncapped total");
});

test("synth alone can never satisfy a quota, however long it runs", () => {
  near(Q.apply({ synth: 600 }).total, 0, "ten hours of synth");
});

test("cct alone can never satisfy a quota either", () => {
  near(Q.apply({ cct: 600 }).total, 0, "ten hours of cct");
});

test("a capped source under its ceiling is counted whole", () => {
  const r = Q.apply({ rnb: 20, synth: 1 });
  near(r.total, 21, "total");
  near(r.counted.synth, 1, "synth");
  assert.deepStrictEqual(r.capped, [], "an uncapped source was reported as capped");
});

test("both caps at their ceiling supply a quarter of the day", () => {
  /* 15 uncapped, both capped sources effectively unlimited: the fixed point is
     15 / (1 - 0.25) = 20, of which synth may be 5% and cct 20%. */
  const r = Q.apply({ rnb: 15, synth: 600, cct: 600 });
  near(r.total, 20, "total");
  near(r.counted.synth, 1, "synth at 5% of 20");
  near(r.counted.cct, 4, "cct at 20% of 20");
});

test("a capped source keeps its raw figure alongside the counted one", () => {
  const r = Q.apply({ rnb: 15, cct: 600 });
  near(r.raw.cct, 600, "raw cct");
  assert.ok(r.counted.cct < r.raw.cct, "counted was not below raw");
  assert.deepStrictEqual(r.capped, ["cct"]);
});

test("capping never invents time", () => {
  for (const day of [{ rnb: 3, cct: 99 }, { synth: 7, cct: 7 }, { rotation: 1, synth: 40 }]) {
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
  near(Q.apply({ synth: 50, cct: 50 }, {}).total, 100, "uncapped by configuration");
});

test("the archive cannot be rescued by a cap it is not in", () => {
  /* The archive never reaches the policy, but if it ever did it must not add
     minutes: it is not in the caps and would be treated as uncapped training. */
  const r = Q.apply({ rnb: 10 });
  assert.ok(!("archive" in r.counted), "the archive appeared in a counted day");
});

/* ------------------------------------------------------------------ */

for (const [name, fn] of cases) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}
console.log(`\n${passed}/${cases.length} passed`);

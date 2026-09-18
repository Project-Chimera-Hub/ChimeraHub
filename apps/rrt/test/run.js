"use strict";

/* node apps/rrt/test/run.js — the model, the glyphs, the controller, the score. */

const assert = require("assert");
const R = require("../model.js");

let failed = 0;
function test(name, fn) {
  try { fn(); console.log("  ok  " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + e.message); }
}

/* A seeded generator, so a failure can be replayed. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/* Ranks on every axis must stay a permutation of 0..n-1. */
function assertPermutations(model) {
  for (let a = 0; a < model.d; a++) {
    const rs = model.items.map(it => it.ranks[a]).sort((x, y) => x - y);
    rs.forEach((r, i) => assert.strictEqual(r, i, `axis ${a} ranks ${rs}`));
  }
}

function run(d, s, beats, rnd, setId) {
  const set = R.stimulusSet(setId);
  const m = R.createModel(d, s);
  R.seed(m, set.next([], rnd));
  const out = [];
  for (let i = 0; i < beats; i++) {
    const plan = R.planCard(m, rnd);
    const res = R.apply(m, plan, set.next(m.items.map(it => it.glyph), rnd));
    out.push({ plan, res, size: m.items.length });
    assertPermutations(m);
  }
  return { m, out };
}

test("the worked example: new above the 2nd of three answers 1", () => {
  const m = R.createModel(1, 3);
  const dot = R.seed(m, [0]);
  const tri = { id: 90, glyph: [1], ranks: [1], born: ++m.clock };
  const sq = { id: 91, glyph: [2], ranks: [2], born: ++m.clock };
  m.items.push(tri, sq);
  const res = R.apply(m, { ref: tri, dirs: [-1], axis: 0 }, [3]);
  assert.strictEqual(res.removed, dot);
  assert.strictEqual(res.answer, 1);
  assert.deepStrictEqual(m.items.map(it => it.ranks[0]), [1, 2, 0]);
});

test("placing below the bottom symbol puts it last", () => {
  const m = R.createModel(1, 5);
  const a = R.seed(m, [0]);
  const r = R.apply(m, { ref: a, dirs: [1], axis: 0 }, [1]);
  assert.strictEqual(r.answer, 2);
  assert.strictEqual(r.removed, null);
});

test("every axis stays a permutation, in every dimension, for long runs", () => {
  for (const d of [1, 2, 3]) for (const s of R.SIZES[d]) run(d, s, 300, lcg(d * 10 + s));
});

test("the model grows to s and then holds there", () => {
  const { out } = run(2, 4, 20, lcg(7));
  assert.deepStrictEqual(out.map(o => o.size).slice(0, 5), [2, 3, 4, 4, 4]);
  assert.ok(out.slice(3).every(o => o.res.removed), "no departure at full size");
});

test("the oldest symbol is the one that leaves", () => {
  const rnd = lcg(3);
  const m = R.createModel(1, 3);
  R.seed(m, R.newGlyph([], rnd));
  for (let i = 0; i < 50; i++) {
    const oldest = m.items.reduce((a, b) => (a.born < b.born ? a : b));
    const full = m.items.length === 3;
    const r = R.apply(m, R.planCard(m, rnd), R.newGlyph([], rnd));
    assert.strictEqual(r.removed, full ? oldest : null);
  }
});

test("answers are close to uniform over the ranks at full size", () => {
  for (const [d, s] of [[1, 3], [1, 7], [2, 4], [3, 5]]) {
    const { out } = run(d, s, 6000, lcg(d * 100 + s));
    const counts = new Array(s).fill(0);
    out.slice(s).forEach(o => counts[o.res.answer - 1]++);
    const n = counts.reduce((a, b) => a + b, 0);
    counts.forEach((c, i) =>
      assert.ok(Math.abs(c / n - 1 / s) < 0.035, `${d}D s${s}: rank ${i + 1} at ${(c / n).toFixed(3)}`));
  }
});

test("pressing one key always scores chance, corrected to zero", () => {
  const s = 5;
  const { out } = run(1, s, 5000, lcg(11));
  const oks = out.slice(s).map(o => o.res.answer === 3);
  assert.ok(Math.abs(R.correctedAccuracy(oks, s)) < 0.03, R.correctedAccuracy(oks, s));
});

test("the direction on the card alone does not give the answer", () => {
  /* After "above", every rank is still possible — even the last, when the
     reference was the oldest and leaves on the same beat. */
  const { out } = run(1, 5, 3000, lcg(5));
  const seen = new Set(out.slice(5).filter(o => o.plan.dirs[0] < 0).map(o => o.res.answer));
  assert.deepStrictEqual([...seen].sort(), [1, 2, 3, 4, 5]);
});

test("the asked axis is spread over all axes", () => {
  const { out } = run(3, 4, 3000, lcg(13));
  const counts = [0, 0, 0];
  out.forEach(o => counts[o.plan.axis]++);
  counts.forEach(c => assert.ok(c > 900, counts));
});

test("glyphs are connected figures of 3–4 strokes", () => {
  const rnd = lcg(17);
  for (let i = 0; i < 500; i++) {
    const g = R.makeGlyph(rnd);
    assert.ok(g.length >= 3 && g.length <= 4, g);
    assert.strictEqual(new Set(g).size, g.length);
  }
});

test("a new glyph is at least two strokes from anything held, turned or mirrored", () => {
  const rnd = lcg(19);
  const held = [];
  for (let i = 0; i < 12; i++) held.push(R.newGlyph(held, rnd));
  for (let i = 0; i < held.length; i++)
    for (let j = i + 1; j < held.length; j++)
      assert.ok(R.glyphDistance(held[i], held[j]) >= 2, `${held[i]} vs ${held[j]}`);
});

test("a glyph is zero from its own mirror image", () => {
  const g = [0, 3, 12];
  const mirrored = R.makeGlyph(lcg(1)); // any glyph
  assert.strictEqual(R.glyphDistance(g, g), 0);
  assert.strictEqual(R.glyphDistance(mirrored, mirrored), 0);
  /* Horizontal mirror of a stroke from point 0 to 1 is 1 to 2. */
  const a = [R.SEGMENTS.findIndex(s => s[0] === 0 && s[1] === 1)];
  const b = [R.SEGMENTS.findIndex(s => s[0] === 1 && s[1] === 2)];
  assert.strictEqual(R.glyphDistance(a, b), 0);
});

test("an animal is never one that is held or has only just left", () => {
  const rnd = lcg(29);
  const m = R.createModel(1, 5);
  R.seed(m, R.newAnimal([], rnd));
  const gone = [];
  for (let i = 0; i < 400; i++) {
    const avoid = m.items.map(it => it.glyph).concat(gone);
    const next = R.newAnimal(avoid, rnd);
    assert.ok(!avoid.some(a => a.name === next.name), next.name);
    const res = R.apply(m, R.planCard(m, rnd), next);
    if (res.removed) { gone.push(res.removed.glyph); if (gone.length > 3) gone.shift(); }
  }
});

test("every animal is drawn, and the pool is big enough to hold plus recent", () => {
  const rnd = lcg(31);
  const seen = new Set();
  for (let i = 0; i < 4000; i++) seen.add(R.newAnimal([], rnd).name);
  assert.strictEqual(seen.size, R.ANIMALS.length);
  assert.strictEqual(new Set(R.ANIMALS.map(a => a.char)).size, R.ANIMALS.length);
  /* The largest level holds 7 and three departures stay in mind after that. */
  assert.ok(R.ANIMALS.length > 10, R.ANIMALS.length);
});

test("the model does not care which set the stimuli come from", () => {
  for (const d of [1, 2, 3]) for (const s of R.SIZES[d]) run(d, s, 200, lcg(d * 20 + s), "animals");
  const { m } = run(3, 5, 50, lcg(37), "animals");
  m.items.forEach(it => assert.ok(it.glyph && typeof it.glyph.char === "string", JSON.stringify(it.glyph)));
});

test("an unknown set id falls back to the generated marks", () => {
  assert.strictEqual(R.stimulusSet("nonsense").id, "glyphs");
  assert.strictEqual(R.stimulusSet(undefined).id, "glyphs");
  assert.strictEqual(R.stimulusSet("animals").id, "animals");
  assert.ok(Array.isArray(R.stimulusSet("glyphs").next([], lcg(41))));
});

test("the ladder rises in carried bits", () => {
  const L = R.ladder(3);
  for (let i = 1; i < L.length; i++)
    assert.ok(R.carriedBits(L[i].d, L[i].s) > R.carriedBits(L[i - 1].d, L[i - 1].s), JSON.stringify(L[i]));
  assert.deepStrictEqual(R.ladder(1).map(l => l.d), [1, 1, 1, 1, 1]);
});

test("a saved level above the dimension cap lands on the cap's top", () => {
  const L = R.ladder(1);
  assert.strictEqual(R.levelIndex(L, { d: 2, s: 4 }), L.length - 1);
  assert.strictEqual(R.levelIndex(R.ladder(3), { d: 2, s: 4 }), 6);
});

const opts = { maxD: 3, start: 3000, floor: 800, ceil: 6000, target: 0.8 };

test("a perfect player speeds up, then climbs at the floor", () => {
  const c = R.createController(opts);
  let moves = [];
  for (let i = 0; i < 400; i++) { const m = R.update(c, true); if (m) moves.push(m); }
  assert.ok(moves.length >= 2 && moves.every(m => m === "up"), moves);
  assert.ok(c.level >= 2);
});

test("a player at chance slows down, then descends at the ceiling", () => {
  const c = R.createController(Object.assign({}, opts, { level: { d: 2, s: 3 } }));
  const rnd = lcg(23);
  const moves = [];
  for (let i = 0; i < 600; i++) { const m = R.update(c, rnd() < 1 / 3); if (m) moves.push(m); }
  assert.ok(moves.length >= 1 && moves.every(m => m === "down"), moves);
});

test("the level never moves while level adaptation is off", () => {
  const c = R.createController(Object.assign({}, opts, { adaptLevel: false }));
  for (let i = 0; i < 400; i++) assert.strictEqual(R.update(c, true), null);
  assert.strictEqual(c.interval, 800);
});

test("the interval stays inside its bounds", () => {
  const c = R.createController(opts);
  const rnd = lcg(29);
  for (let i = 0; i < 2000; i++) {
    R.update(c, rnd() < 0.6);
    assert.ok(c.interval >= 800 && c.interval <= 6000, c.interval);
  }
});

test("throughput: a perfect second at 1D·4 carries two bits", () => {
  const t = { k: 4, d: 1, ok: true, given: 2, interval: 1000 };
  assert.strictEqual(R.throughput([t, t]), 2);
});

test("throughput: wrong guesses cancel right ones, misses cost only time", () => {
  const right = { k: 3, d: 1, ok: true, given: 1, interval: 1000 };
  const wrong = { k: 3, d: 1, ok: false, given: 2, interval: 1000 };
  const miss = { k: 3, d: 1, ok: false, given: null, interval: 1000 };
  assert.ok(Math.abs(R.throughput([right, wrong, wrong])) < 1e-9);
  assert.ok(Math.abs(R.throughput([right, miss]) - Math.log2(3) / 2) < 1e-9);
});

test("peak throughput finds the best stretch", () => {
  const slow = { k: 3, d: 1, ok: true, given: 1, interval: 3000 };
  const fast = { k: 3, d: 1, ok: true, given: 1, interval: 1000 };
  const trials = Array(30).fill(slow).concat(Array(20).fill(fast));
  assert.ok(Math.abs(R.peakThroughput(trials, 20) - Math.log2(3)) < 1e-9);
});

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");

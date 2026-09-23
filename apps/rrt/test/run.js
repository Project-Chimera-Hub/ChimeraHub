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

function stims(set, n, rnd) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(set.next(out, rnd));
  return out;
}

function run(d, s, beats, rnd, setId) {
  const set = R.stimulusSet(setId);
  const m = R.createModel(d, s);
  R.fill(m, stims(set, s, rnd), rnd);
  assertPermutations(m);
  const out = [];
  for (let i = 0; i < beats; i++) {
    const before = new Map(m.items.map(it => [it.id, it.ranks.slice()]));
    const plan = R.planCard(m, rnd);
    const res = R.apply(m, plan, set.next(m.items.map(it => it.glyph), rnd));
    out.push({ plan, res, size: m.items.length, before });
    assertPermutations(m);
  }
  return { m, out };
}

test("the worked example: new two above the 3rd of three answers 1", () => {
  const m = R.createModel(1, 3);
  const [a, b, c] = R.fill(m, [[0], [1], [2]], lcg(1));
  a.ranks = [0]; b.ranks = [1]; c.ranks = [2];
  const res = R.apply(m, { ref: c, target: a, dist: [-2], axis: 0 }, [3]);
  assert.strictEqual(res.removed, a);
  assert.strictEqual(res.answer, 1);
  assert.deepStrictEqual(m.items.map(it => it.ranks[0]), [1, 2, 0]);
});

test("the board starts full, one symbol per slot on every axis", () => {
  for (const d of [1, 2, 3, 4]) for (const s of R.SIZES[d]) {
    const m = R.createModel(d, s);
    R.fill(m, stims(R.stimulusSet("glyphs"), s, lcg(d + s)), lcg(d * s));
    assert.strictEqual(m.items.length, s);
    assertPermutations(m);
  }
});

test("every axis stays a permutation, in every dimension, for long runs", () => {
  for (const d of [1, 2, 3, 4]) for (const s of R.SIZES[d]) run(d, s, 300, lcg(d * 10 + s));
});

test("nothing moves but the new symbol: every other slot is where it was", () => {
  const m = R.createModel(2, 4);
  R.fill(m, stims(R.stimulusSet("glyphs"), 4, lcg(2)), lcg(2));
  for (let i = 0; i < 200; i++) {
    const keep = m.items.map(it => [it, it.ranks.slice()]);
    const plan = R.planCard(m, lcg(i));
    R.apply(m, plan, [i]);
    keep.forEach(([it, r]) => { if (it !== plan.target) assert.deepStrictEqual(it.ranks, r); });
  }
});

test("the new symbol lands where the card says: reference plus steps", () => {
  const { out } = run(4, 4, 800, lcg(47));
  out.forEach(o => {
    const refRanks = o.before.get(o.plan.ref.id);
    o.res.item.ranks.forEach((r, a) => assert.strictEqual(r, refRanks[a] + o.plan.dist[a]));
    o.plan.dist.forEach(v => assert.ok(v !== 0, "a zero step"));
  });
});

test("the symbol in the landing slot is the one that leaves, and the board stays full", () => {
  const { out } = run(2, 5, 300, lcg(3));
  out.forEach(o => {
    assert.strictEqual(o.res.removed, o.plan.target);
    assert.notStrictEqual(o.plan.ref, o.plan.target);
    assert.strictEqual(o.size, 5);
  });
});

test("answers are close to uniform over the ranks", () => {
  for (const [d, s] of [[1, 3], [1, 7], [2, 4], [3, 5]]) {
    const { out } = run(d, s, 6000, lcg(d * 100 + s));
    const counts = new Array(s).fill(0);
    out.forEach(o => counts[o.res.answer - 1]++);
    const n = counts.reduce((a, b) => a + b, 0);
    counts.forEach((c, i) =>
      assert.ok(Math.abs(c / n - 1 / s) < 0.035, `${d}D s${s}: rank ${i + 1} at ${(c / n).toFixed(3)}`));
  }
});

test("pressing one key always scores chance, corrected to zero", () => {
  const s = 5;
  const { out } = run(1, s, 5000, lcg(11));
  const oks = out.map(o => o.res.answer === 3);
  assert.ok(Math.abs(R.correctedAccuracy(oks, s)) < 0.03, R.correctedAccuracy(oks, s));
});

test("the steps on the card alone never give the answer", () => {
  /* For every step count the card can show, at least two answers are possible:
     the rank still depends on where the reference is. */
  for (const s of [3, 5, 7]) {
    const { out } = run(1, s, 3000, lcg(s));
    const byDist = new Map();
    out.forEach(o => {
      const k = o.plan.dist[0];
      if (!byDist.has(k)) byDist.set(k, new Set());
      byDist.get(k).add(o.res.answer);
    });
    byDist.forEach((ans, k) => assert.ok(ans.size >= 2, `s${s} step ${k} always answers ${[...ans]}`));
  }
});

test("the landing slots do not fall into a rhythm", () => {
  /* The failure fixed slots invite: if the slot were chosen by age, the answers
     would repeat with period s. */
  const s = 4;
  const { out } = run(1, s, 400, lcg(53));
  const a = out.map(o => o.res.answer);
  const same = a.slice(s).filter((v, i) => v === a[i]).length / (a.length - s);
  assert.ok(same < 0.4, same);
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
  R.fill(m, stims(R.stimulusSet("animals"), 5, rnd), rnd);
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
  /* The largest level holds 7 and three departures stay in mind after that. */
  assert.ok(R.ANIMALS.length > 10, R.ANIMALS.length);
});

test("every animal is a named silhouette, and no two share either", () => {
  assert.strictEqual(new Set(R.ANIMALS.map(a => a.name)).size, R.ANIMALS.length);
  assert.strictEqual(new Set(R.ANIMALS.map(a => a.path)).size, R.ANIMALS.length);
  R.ANIMALS.forEach(a => {
    assert.ok(/^[a-z-]+$/.test(a.name), a.name);
    /* Path data on the grid the drawings were made on: starts with a move, and
       is long enough to be a figure rather than a stray stroke. */
    assert.ok(/^[Mm]/.test(a.path), a.name + ": " + a.path.slice(0, 20));
    assert.ok(a.path.length > 200, a.name + " is " + a.path.length + " chars");
    assert.ok(!/[<>"]/.test(a.path), a.name + " has markup in its path");
  });
});

test("every picture has a name and a photograph, none shared, and avoids what is held", () => {
  if (!R.PICTURES.length) { console.log("       (no pictures fetched yet)"); return; }
  const fs = require("fs"), path = require("path");
  assert.ok(R.PICTURES.length > 10, R.PICTURES.length);
  assert.strictEqual(new Set(R.PICTURES.map(p => p.name)).size, R.PICTURES.length);
  assert.strictEqual(new Set(R.PICTURES.map(p => p.image)).size, R.PICTURES.length);
  R.PICTURES.forEach(p => {
    assert.ok(fs.existsSync(path.join(__dirname, "..", p.image)), p.image + " is missing");
    assert.ok(p.author && p.licence && p.source, p.name + " has no credit");
  });
  const rnd = lcg(59);
  for (let i = 0; i < 300; i++) {
    const held = [];
    for (let k = 0; k < 10; k++) held.push(R.newPicture(held, rnd));
    assert.strictEqual(new Set(held.map(p => p.name)).size, held.length);
  }
  assert.strictEqual(R.stimulusSet("pictures").id, "pictures");
  assert.ok(R.stimulusSet("pictures").named && R.stimulusSet("animals").named);
  assert.ok(!R.stimulusSet("glyphs").named);
});

test("the model does not care which set the stimuli come from", () => {
  for (const d of [1, 2, 3, 4]) for (const s of R.SIZES[d]) run(d, s, 200, lcg(d * 20 + s), "animals");
  if (R.PICTURES.length) for (const d of [1, 2, 3, 4]) for (const s of R.SIZES[d]) run(d, s, 200, lcg(d * 30 + s), "pictures");
  const { m } = run(3, 5, 50, lcg(37), "animals");
  m.items.forEach(it => assert.ok(it.glyph && typeof it.glyph.path === "string", JSON.stringify(it.glyph)));
});

test("an unknown set id falls back to the generated marks", () => {
  assert.strictEqual(R.stimulusSet("nonsense").id, "glyphs");
  assert.strictEqual(R.stimulusSet(undefined).id, "glyphs");
  assert.strictEqual(R.stimulusSet("animals").id, "animals");
  assert.ok(Array.isArray(R.stimulusSet("glyphs").next([], lcg(41))));
});

test("an analogy probe is four distinct symbols and a claim about two steps", () => {
  for (const [d, span] of [[1, 4], [2, 5], [4, 5], [1, 7]]) {
    const rnd = lcg(d * 31 + span);
    const m = R.createModel(d, span);
    const glyphs = [];
    for (let i = 0; i < span; i++) glyphs.push(R.makeGlyph(rnd));
    R.fill(m, glyphs, rnd);
    let t = 0;
    for (let i = 0; i < 2000; i++) {
      const q = R.planAnalogy(m, rnd);
      assert.ok(q, `${d}D\u00b7${span} drew nothing`);
      const step = p => p[1].ranks[q.axis] - p[0].ranks[q.axis];
      assert.strictEqual(step(q.pair) === step(q.mate), q.truth,
        "the claim does not match the board");
      assert.strictEqual(new Set([q.pair[0], q.pair[1], q.mate[0], q.mate[1]]).size, 4,
        "a symbol appears in both pairs");
      assert.ok(q.axis >= 0 && q.axis < d, "axis outside the space");
      if (q.truth) t++;
    }
    /* Half true, or pressing one key would be a strategy. */
    assert.ok(Math.abs(t / 2000 - 0.5) < 0.05, `${d}\u00b7${span}: ${t / 2000} true`);
  }
});

test("a board of three is too small to state an analogy", () => {
  /* Two pairs with the same step must share a symbol on three, and "A is to B
     as B is to C" is a chain. The caller deals an ordinary card instead. */
  const rnd = lcg(7);
  const m = R.createModel(2, 3);
  const glyphs = [R.makeGlyph(rnd), R.makeGlyph(rnd), R.makeGlyph(rnd)];
  R.fill(m, glyphs, rnd);
  for (let i = 0; i < 200; i++) assert.strictEqual(R.planAnalogy(m, rnd), null);
});

test("a probe is credited for the board it interrogates, not its two options", () => {
  /* Its answer is one bit wide; the board behind it is not. A trial carrying
     an explicit `bits` is read by that, and older records by their `k`. */
  const probe = { k: 2, d: 3, s: 5, bits: R.carriedBits(3, 5), ok: true, interval: 1000 };
  const card = { k: 5, d: 3, s: 5, ok: true, interval: 1000 };
  assert.strictEqual(R.throughput([probe]), R.throughput([card]));
  const old = { k: 2, d: 3, ok: true, interval: 1000 };
  assert.strictEqual(R.throughput([old]), R.carriedBits(3, 2));
});

test("every axis has a name, a pair of words and a glyph", () => {
  assert.strictEqual(R.AXES.length, 4);
  assert.deepStrictEqual(R.AXES.map(a => a.id),
    ["height", "longitude", "latitude", "size"]);
  /* Longitude before latitude: two dimensions has to stay a flat plane, or the
     third has nothing left to turn into a box. */
  assert.ok(R.AXES.findIndex(a => a.id === "longitude")
          < R.AXES.findIndex(a => a.id === "latitude"));
});

test("the ladder rises in carried bits", () => {
  const L = R.ladder(4);
  for (let i = 1; i < L.length; i++) {
    assert.ok(R.carriedBits(L[i].d, L[i].s) > R.carriedBits(L[i - 1].d, L[i - 1].s),
      `${L[i].d}D·${L[i].s} does not carry more than ${L[i-1].d}D·${L[i-1].s}`);
  }
  /* 4D·3 carries 6.34 bits and 3D·5 carries 6.97, so a fourth dimension does
     not go on the end of the ladder — it interleaves. */
  const at = L.findIndex(l => l.d === 4 && l.s === 3);
  assert.deepStrictEqual([L[at - 1], L[at + 1]], [{ d: 3, s: 4 }, { d: 3, s: 5 }]);
});

test("the ladder rises in carried bits (3D cap)", () => {
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

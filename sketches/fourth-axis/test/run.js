"use strict";

/*
 * Tests for the probe's model, run under node over the very file the browser
 * loads — the archive's convention, and for its reason: a suite that runs
 * against a transpiled copy is a suite about a copy.
 *
 *   node sketches/fourth-axis/test/run.js
 *
 * What is tested is the instrument, not the drawing. The page exists to produce
 * a number — how often a lie about the fourth axis goes unnoticed — and that
 * number is worthless if the claims are not evenly false, if a lie can land on
 * two axes at once, or if a reader answering "false" every time can score well.
 * Those are the failures below.
 */

const assert = require("assert");
const M = require("../model.js");

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

/* Fixed seeds rather than Math.random: a suite that fails one run in twenty is
   a suite nobody reads the output of. */
const SEEDS = [1, 2, 3, 7, 11, 23, 101, 4096, 65537];

/** Every claim a seed produces, with the scene it was about. */
function trials(seed, count, n) {
  const rand = M.rng(seed);
  const out = [];
  for (let i = 0; i < (count || 40); i++) {
    const scene = M.makeScene(n || 6, rand);
    out.push({ scene, claim: M.makeClaim(scene, rand) });
  }
  return out;
}

function everyTrial(fn) {
  for (const seed of SEEDS) for (const t of trials(seed)) fn(t.claim, t.scene);
}

/* ------------------------------------------------------------------ *
 * The scene                                                          *
 * ------------------------------------------------------------------ */

test("every object has its own rank on every axis", () => {
  /* The property every decidable claim rests on. Two objects sharing a
     latitude would make "north of" unanswerable between them, and the trial
     would score as a miss for a reason that is the generator's fault. */
  for (const seed of SEEDS) {
    const rand = M.rng(seed);
    for (const n of [4, 6, 8]) {
      const scene = M.makeScene(n, rand);
      assert.strictEqual(scene.length, n);
      for (const axis of ["x", "y", "z", "w"]) {
        const seen = new Set(scene.map((o) => o[axis]));
        assert.strictEqual(seen.size, n, `two objects shared a ${axis}`);
      }
    }
  }
});

test("a scene is centred on the origin it is orbited around", () => {
  const scene = M.makeScene(6, M.rng(5));
  for (const axis of ["x", "y", "z"]) {
    const sum = scene.reduce((a, o) => a + o[axis], 0);
    assert.ok(Math.abs(sum) < 1e-9, `${axis} was off centre by ${sum}`);
    for (const o of scene) {
      assert.ok(Math.abs(o[axis]) <= M.extent(6) + 1e-9, "an object sat outside the cage");
    }
  }
});

test("ring positions stay on the ring", () => {
  for (const o of M.makeScene(8, M.rng(9))) {
    assert.ok(o.w >= 0 && o.w < M.MODULUS && Number.isInteger(o.w), `w was ${o.w}`);
  }
});

/* ------------------------------------------------------------------ *
 * Displacement round the ring                                        *
 * ------------------------------------------------------------------ */

test("displacement wraps and is never negative", () => {
  assert.strictEqual(M.stepsRound(0, 3), 3);
  assert.strictEqual(M.stepsRound(3, 0), 9, "going back was not read as going round");
  assert.strictEqual(M.stepsRound(11, 1), 2, "the ring did not close");
  assert.strictEqual(M.stepsRound(4, 4), 0);
  for (let a = 0; a < M.MODULUS; a++) {
    for (let b = 0; b < M.MODULUS; b++) {
      const there = M.stepsRound(a, b), back = M.stepsRound(b, a);
      assert.ok(there >= 0 && there < M.MODULUS);
      assert.strictEqual((there + back) % M.MODULUS, 0, "the two ways round did not sum to a turn");
    }
  }
});

/* ------------------------------------------------------------------ *
 * The claim                                                          *
 * ------------------------------------------------------------------ */

test("a claim's stated truth is the truth of the claim", () => {
  /* The page scores against `claim.truth` and never re-derives it. If that
     field and the scene ever disagree, every number the probe produces is
     about nothing. */
  everyTrial((claim, scene) => {
    assert.strictEqual(M.evaluate(claim, scene), claim.truth,
      `"${claim.text}" claims ${claim.truth} and evaluates ${!claim.truth}`);
  });
});

test("a claim covers all four axes, once each", () => {
  everyTrial((claim) => {
    assert.deepStrictEqual(claim.parts.map((p) => p.axis), ["x", "y", "z", "w"]);
  });
});

test("a false claim is false on exactly one axis", () => {
  /* Two lies at once and the tally is meaningless: a reader who spotted the
     easy one would be credited with reading the axis under test. */
  everyTrial((claim, scene) => {
    if (claim.truth) { assert.strictEqual(claim.lie, null); return; }
    let wrong = 0;
    for (const part of claim.parts) {
      const honest = { subject: claim.subject, reference: claim.reference, parts: [part] };
      if (!M.evaluate(honest, scene)) wrong++;
    }
    assert.strictEqual(wrong, 1, `"${claim.text}" was wrong on ${wrong} axes`);
    assert.ok(!M.evaluate({ subject: claim.subject, reference: claim.reference,
      parts: claim.parts.filter((p) => p.axis === claim.lie) }, scene),
      "the axis named as the lie was true");
  });
});

test("a lie about the ring is a different number of steps, not an impossible one", () => {
  everyTrial((claim) => {
    const part = claim.parts[3];
    assert.ok(part.steps >= 0 && part.steps < M.MODULUS, `${part.steps} is not on the ring`);
    if (claim.lie !== "w") { assert.strictEqual(part.steps, claim.trueSteps); return; }
    assert.notStrictEqual(part.steps, claim.trueSteps, "the lie was the truth");
    assert.ok(part.steps >= 1, "a lie of zero steps would read as 'coincides', a different claim");
  });
});

test("near and far ring lies are told apart by distance round the ring", () => {
  everyTrial((claim) => {
    if (claim.lie !== "w") { assert.strictEqual(claim.wNear, false); return; }
    const said = claim.parts[3].steps;
    const gap = Math.min(M.stepsRound(claim.trueSteps, said), M.stepsRound(said, claim.trueSteps));
    assert.strictEqual(claim.wNear, gap <= M.NEAR, `a gap of ${gap} was called ${claim.wNear ? "near" : "far"}`);
  });
});

test("half the claims are true and the lies are spread over the four axes", () => {
  /* Skew here is not cosmetic. If two thirds of claims were true, "answer true"
     scores 67% and the w row stops measuring whether anyone looked at a
     needle. */
  const count = { true: 0, x: 0, y: 0, z: 0, w: 0 };
  let total = 0;
  for (const seed of SEEDS) {
    for (const t of trials(seed, 250)) {
      count[t.claim.lie === null ? "true" : t.claim.lie]++;
      total++;
    }
  }
  const trueRate = count.true / total;
  assert.ok(Math.abs(trueRate - 0.5) < 0.04, `${(trueRate * 100).toFixed(1)}% of claims were true`);
  for (const axis of ["x", "y", "z", "w"]) {
    const share = count[axis] / (total - count.true);
    assert.ok(Math.abs(share - 0.25) < 0.04, `${axis} took ${(share * 100).toFixed(1)}% of the lies`);
  }
});

test("both objects in a claim are named, and they are not the same object", () => {
  everyTrial((claim, scene) => {
    assert.notStrictEqual(claim.subject, claim.reference);
    assert.ok(M.byName(scene, claim.subject) && M.byName(scene, claim.reference));
    assert.ok(claim.text.startsWith(claim.subject + " is "), claim.text);
    assert.ok(claim.text.endsWith(" " + claim.reference + "."), claim.text);
  });
});

test("the wording says one step, not one steps", () => {
  const one = M.claimText({
    subject: "A", reference: "B",
    parts: [{ axis: "x", dir: 1 }, { axis: "y", dir: -1 }, { axis: "z", dir: 1 }, { axis: "w", steps: 1 }]
  });
  assert.strictEqual(one, "A is east of, below, north of and 1 step clockwise from B.");
  const many = M.claimText({
    subject: "C", reference: "D",
    parts: [{ axis: "x", dir: -1 }, { axis: "y", dir: 1 }, { axis: "z", dir: -1 }, { axis: "w", steps: 7 }]
  });
  assert.strictEqual(many, "C is west of, above, south of and 7 steps clockwise from D.");
});

test("a claim about an object the scene does not hold is false, not a crash", () => {
  const scene = M.makeScene(4, M.rng(3));
  const claim = { subject: "Z", reference: scene[0].name,
    parts: [{ axis: "w", steps: 0 }] };
  assert.doesNotThrow(() => M.evaluate(claim, scene));
  assert.strictEqual(M.evaluate(claim, scene), false);
});

/* ------------------------------------------------------------------ *
 * Hue as a ring                                                      *
 * ------------------------------------------------------------------ */

test("the twelve hues are distinct, and each one is a colour a screen has", () => {
  /* A hue clipped back into the gamut is a step shorter than the eleven others,
     which breaks the one requirement the encoding was chosen for. */
  const seen = new Set();
  for (let w = 0; w < M.MODULUS; w++) {
    seen.add(M.hueFor(w));
    for (const channel of M.hueLinear(w)) {
      assert.ok(channel >= -1e-6 && channel <= 1 + 1e-6,
        `hue ${w} needs a channel at ${channel.toFixed(3)} and would be clipped`);
    }
    assert.ok(/^#[0-9a-f]{6}$/.test(M.hueFor(w)), M.hueFor(w));
  }
  assert.strictEqual(seen.size, M.MODULUS, "two ring positions are the same colour");
});

test("the hue ring closes where the ring does", () => {
  assert.strictEqual(M.hueFor(M.MODULUS), M.hueFor(0));
  assert.strictEqual(M.hueFor(M.MODULUS + 5), M.hueFor(5));
});

/* ------------------------------------------------------------------ *
 * The tally                                                          *
 * ------------------------------------------------------------------ */

const claimFor = (truth, lie, wNear) => ({ truth, lie: lie || null, wNear: !!wNear });

test("a bucket is the axis that was lied about, with the ring split by distance", () => {
  assert.strictEqual(M.bucketOf(claimFor(true)), "true");
  assert.strictEqual(M.bucketOf(claimFor(false, "y")), "y");
  assert.strictEqual(M.bucketOf(claimFor(false, "w", true)), "w-near");
  assert.strictEqual(M.bucketOf(claimFor(false, "w", false)), "w-far");
});

test("a hit is agreeing with the claim, not answering false", () => {
  const t = M.newTally();
  M.record(t, "needle", claimFor(false, "w", false), false, 1000);
  M.record(t, "needle", claimFor(true), false, 2000);
  const cells = t.needle;
  assert.strictEqual(cells["w-far"].hits, 1);
  assert.strictEqual(cells["true"].hits, 0, "rejecting a true claim was scored as a hit");
  assert.strictEqual(cells["true"].attempts, 1);
});

test("encodings are tallied apart", () => {
  const t = M.newTally();
  M.record(t, "needle", claimFor(false, "w", false), false, 500);
  M.record(t, "size", claimFor(false, "w", false), true, 500);
  assert.strictEqual(M.rows(t, "needle").find((r) => r.bucket === "w-far").hits, 1);
  assert.strictEqual(M.rows(t, "size").find((r) => r.bucket === "w-far").hits, 0,
    "one encoding's answers reached another's table");
});

test("a table has the same rows whether or not a bucket was reached", () => {
  const t = M.newTally();
  M.record(t, "hue", claimFor(false, "x"), true, 800);
  const rows = M.rows(t, "hue");
  assert.deepStrictEqual(rows.map((r) => r.bucket), M.BUCKETS.concat(["all"]));
  assert.deepStrictEqual(M.rows(M.newTally(), "never-shown").map((r) => r.bucket),
    M.BUCKETS.concat(["all"]));
  const empty = rows.find((r) => r.bucket === "z");
  assert.strictEqual(empty.attempts, 0);
  assert.strictEqual(empty.rate, null, "a bucket with no trials reported a rate");
  assert.strictEqual(empty.mean, null);
});

test("the last row is every trial of that encoding", () => {
  const t = M.newTally();
  M.record(t, "both", claimFor(false, "x"), false, 1000);
  M.record(t, "both", claimFor(false, "w", true), true, 3000);
  M.record(t, "both", claimFor(true), true, 2000);
  const all = M.rows(t, "both").find((r) => r.bucket === "all");
  assert.strictEqual(all.attempts, 3);
  assert.strictEqual(all.hits, 2);
  assert.strictEqual(all.mean, 2000, "the mean was not over the trials it counted");
});

test("answering false to everything scores half, whatever the encoding", () => {
  /* The reason the true claims are there, stated as a test: a strategy that
     never looks at the screen must not beat a coin. */
  const t = M.newTally();
  let n = 0;
  for (const seed of SEEDS) {
    for (const trial of trials(seed, 200)) { M.record(t, "blind", trial.claim, false, 1000); n++; }
  }
  const rate = M.rows(t, "blind").find((r) => r.bucket === "all").rate;
  assert.ok(Math.abs(rate - 0.5) < 0.04, `answering false always scored ${(rate * 100).toFixed(1)}% over ${n} trials`);
});

/* ------------------------------------------------------------------ */

for (const [name, fn] of cases) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
}
console.log(`\n${passed}/${cases.length} passed`);

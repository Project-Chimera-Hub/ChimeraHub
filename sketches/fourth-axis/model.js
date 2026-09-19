/* ============================================================
   FOURTH AXIS — does a fourth dimension stay separable?
   ============================================================

   Not a trainer. A probe, and it answers one question with a number: when
   three axes are real 3D position and a fourth one is some other channel, is
   that fourth axis actually being *read*, or is it decoration the eye skips?

   The design it tests comes from five requirements a visual channel has to
   meet before it functions as an axis rather than as a label:

     metric        equal steps read as equal
     separable     position on it survives the other three moving
     composable    two steps then three lands where five lands
     neighbourly   "adjacent" is visible locally, without counting from zero
     preserving    the same object displaced still reads as the same object

   The last one is what rules out size and quantity. Those are properties *of*
   the object, so moving along them changes what the thing is rather than where
   it is, and the scene stops being one object at four coordinates and becomes
   two unrelated objects.

   Needle angle against a drawn dial passes all five: the object is untouched,
   only its pointer turns. That is the candidate. Hue stepped round a ring is
   the second, size is kept as the control that ought to fail, and the claim
   generator below cannot tell which of them is on screen — which is the whole
   reason the comparison is worth anything.

   ── The fourth axis is circular ──

   Twelve positions on a loop, like the spatial axes in Syllogimous's composed
   spaces when `modulus` is set (apps/syllogimous/.../utils/ndspace.utils.ts).
   On a ring nothing is greater than anything else, because you can reach it
   going either way, so the only claim that distinguishes anything is
   displacement: how many steps round. A clock face is exactly that structure
   drawn, which is why the needle and the arithmetic fit without being made to.

   ── The measurement ──

   Every trial is a fresh scene and one conjunctive claim about two of its
   objects, covering all four axes at once:

     "D is east of, above, north of and 4 steps clockwise from B."

   Half the claims are true. Every false one is false on exactly one axis, and
   the tally is kept per lied-about axis. So x, y and z are the within-trial
   baseline — they say whether the reader was attending at all — and the w row
   across encodings is the result. A needle whose lies go unnoticed at the rate
   the size control's do is a needle nobody is reading.

   Lie sizes are not matched across axes: flipping "east" to "west" is the
   coarsest lie available, while a w lie can be a single step. So a w row is
   compared against the *same* row under another encoding, never against the x
   row printed beside it. Within w, near lies (one or two steps) are tallied
   apart from far ones, because a channel can carry a coarse reading and no fine
   one, and that shows up as the two rows coming apart.

   Pure — no canvas, no storage, no dates. index.html only draws what this
   decides, and test/run.js runs this very file rather than a copy of it.
*/

(function (root) {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Axes                                                                *
   * ------------------------------------------------------------------ */

  /* Three straight axes, worded as the spatial scales in the archive's other
     relational trainers word them. `y` takes no "of": "above B", not "above of
     B", and that irregularity is the only reason the wording lives in data. */
  var STRAIGHT = [
    { key: "x", positive: "east of",  negative: "west of" },
    { key: "y", positive: "above",    negative: "below" },
    { key: "z", positive: "north of", negative: "south of" }
  ];

  /* The loop size. Twelve because it is the largest ring a needle can be
     counted round at a glance — a clock face is twelve for the same reason —
     and because it factors, so "opposite" and "a quarter turn" both land on
     exact positions. */
  var MODULUS = 12;

  /* A w lie of one or two steps is near, anything further is far. Two because
     that is the width at which a needle is still plausibly misread rather than
     obviously wrong. */
  var NEAR = 2;

  /* ------------------------------------------------------------------ *
   * Randomness                                                          *
   * ------------------------------------------------------------------ */

  /* Seeded, so a scene can be reproduced from its number and the suite can
     assert over a thousand trials without ever asserting about Math.random. */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(list, rand) { return list[Math.floor(rand() * list.length)]; }

  function shuffled(list, rand) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function range(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(i);
    return out;
  }

  /* ------------------------------------------------------------------ *
   * The scene                                                           *
   * ------------------------------------------------------------------ */

  var NAMES = "ABCDEFGH".split("");

  /* Every object gets its own rank on every axis — three independent
     permutations rather than random lattice points.

     That is not decoration. It means any pair of objects differs on all four
     axes, so every claim the generator can form is decidable, and no trial is
     quietly easier because two objects happened to share a latitude. It is the
     same property ndspace.utils.ts guarantees by construction: a premise that
     left an axis undetermined would leave the reader unable to answer about it.

     Coordinates come back centred on the origin, because the drawing orbits
     around it. */
  function makeScene(n, rand) {
    var xs = shuffled(range(n), rand);
    var ys = shuffled(range(n), rand);
    var zs = shuffled(range(n), rand);
    /* Distinct w too, so no two objects coincide on the ring and every
       displacement claim has exactly one true answer between 1 and 11. */
    var ws = shuffled(range(MODULUS), rand).slice(0, n);
    var mid = (n - 1) / 2;

    var objects = [];
    for (var i = 0; i < n; i++) {
      objects.push({
        name: NAMES[i],
        x: xs[i] - mid,
        y: ys[i] - mid,
        z: zs[i] - mid,
        w: ws[i]
      });
    }
    return objects;
  }

  /** Half-width of the lattice the scene occupies, for drawing its cage. */
  function extent(n) { return (n - 1) / 2; }

  function byName(scene, name) {
    for (var i = 0; i < scene.length; i++) if (scene[i].name === name) return scene[i];
    return null;
  }

  /** Steps clockwise from one ring position to another. Never negative. */
  function stepsRound(from, to) {
    return ((to - from) % MODULUS + MODULUS) % MODULUS;
  }

  /* ------------------------------------------------------------------ *
   * The claim                                                           *
   * ------------------------------------------------------------------ */

  /* One claim per trial, about two objects, spanning all four axes. A claim
     that named only the fourth axis would let the reader ignore the other
     three, and then the question being asked is no longer whether four axes
     stay separable — it is whether one axis can be read on its own, which is
     not in doubt. */
  function makeClaim(scene, rand) {
    var two = shuffled(scene, rand);
    var subject = two[0];
    var reference = two[1];

    var parts = [];
    for (var i = 0; i < STRAIGHT.length; i++) {
      var key = STRAIGHT[i].key;
      parts.push({ axis: key, dir: subject[key] > reference[key] ? 1 : -1 });
    }
    var trueSteps = stepsRound(reference.w, subject.w);
    parts.push({ axis: "w", steps: trueSteps });

    /* Half true, and the lie — when there is one — falls on each of the four
       axes equally often. Both halves matter: the true claims are the only
       measure of how often a reader rejects a scene that was fine, and without
       them "answer false when unsure" would score well. */
    var lie = null;
    var wNear = false;
    if (rand() < 0.5) {
      lie = pick(["x", "y", "z", "w"], rand);
      for (var j = 0; j < parts.length; j++) {
        if (parts[j].axis !== lie) continue;
        if (lie === "w") {
          /* Any wrong step count, uniformly. Displacement is unique for a pair,
             so every value but the true one is false — including 12 - k, which
             reads as the same distance turned the other way. */
          var wrong = Math.floor(rand() * (MODULUS - 2)) + 1;      // 1 .. 10
          if (wrong >= trueSteps) wrong++;                          // skip the truth
          parts[j] = { axis: "w", steps: wrong };
          var gap = Math.min(stepsRound(trueSteps, wrong), stepsRound(wrong, trueSteps));
          wNear = gap <= NEAR;
        } else {
          parts[j] = { axis: lie, dir: -parts[j].dir };
        }
      }
    }

    var claim = {
      subject: subject.name,
      reference: reference.name,
      parts: parts,
      truth: lie === null,
      lie: lie,
      wNear: wNear,
      trueSteps: trueSteps
    };
    claim.text = claimText(claim);
    return claim;
  }

  function phrase(part) {
    if (part.axis === "w") {
      return part.steps + (part.steps === 1 ? " step" : " steps") + " clockwise from";
    }
    for (var i = 0; i < STRAIGHT.length; i++) {
      if (STRAIGHT[i].key === part.axis) {
        return part.dir > 0 ? STRAIGHT[i].positive : STRAIGHT[i].negative;
      }
    }
    return "";
  }

  /* "D is east of, above, north of and 4 steps clockwise from B." Every clause
     takes the same object, so the reference is named once at the end. */
  function claimText(claim) {
    var said = [];
    for (var i = 0; i < claim.parts.length; i++) said.push(phrase(claim.parts[i]));
    var last = said.pop();
    return claim.subject + " is " + said.join(", ") + " and " + last + " " + claim.reference + ".";
  }

  /** Decide a claim against the scene, part by part. */
  function evaluate(claim, scene) {
    var subject = byName(scene, claim.subject);
    var reference = byName(scene, claim.reference);
    if (!subject || !reference) return false;
    for (var i = 0; i < claim.parts.length; i++) {
      var part = claim.parts[i];
      if (part.axis === "w") {
        if (part.steps !== stepsRound(reference.w, subject.w)) return false;
      } else {
        var delta = subject[part.axis] - reference[part.axis];
        if (delta === 0 || (delta > 0 ? 1 : -1) !== part.dir) return false;
      }
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Hue as a ring                                                       *
   * ------------------------------------------------------------------ */

  /* Twelve hues at one lightness and one chroma, stepped in OKLCH and
     converted here rather than handed to the browser as `oklch()`.

     Two reasons for doing the arithmetic. HSL's hues are not evenly spaced
     perceptually — its yellows crowd and its greens sprawl — so an axis built
     on HSL fails the metric requirement before anything else gets a chance to,
     and the encoding under test would be losing for a reason that has nothing
     to do with hue. And a function returning numbers is a function the suite
     can hold to the gamut; a CSS string is not. */
  var HUE_L = 0.74;
  var HUE_C = 0.115;
  var HUE_START = 28;

  function oklchToRgb(L, C, hDeg) {
    var h = hDeg * Math.PI / 180;
    var a = C * Math.cos(h);
    var b = C * Math.sin(h);

    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;

    return [
       4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ];
  }

  function encodeChannel(c) {
    var v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, v)) * 255);
  }

  /** Linear-light sRGB for a ring position — unclamped, so the suite can see
      whether a hue left the gamut. */
  function hueLinear(w) {
    return oklchToRgb(HUE_L, HUE_C, HUE_START + (w % MODULUS) * (360 / MODULUS));
  }

  /** "#rrggbb" for a ring position. */
  function hueFor(w) {
    var rgb = hueLinear(w);
    var hex = "#";
    for (var i = 0; i < 3; i++) {
      var v = encodeChannel(rgb[i]).toString(16);
      hex += v.length < 2 ? "0" + v : v;
    }
    return hex;
  }

  /* ------------------------------------------------------------------ *
   * The tally                                                           *
   * ------------------------------------------------------------------ */

  /* Kept per encoding and per lied-about axis, because an aggregate score
     answers no question here. Two encodings can reach the same overall
     accuracy with one of them reading four axes and the other reading three
     and guessing; the rows are what tells them apart. */
  var BUCKETS = ["x", "y", "z", "w-near", "w-far", "true"];

  function bucketOf(claim) {
    if (claim.truth) return "true";
    if (claim.lie !== "w") return claim.lie;
    return claim.wNear ? "w-near" : "w-far";
  }

  function newTally() { return {}; }

  /* `answered` is what the reader said, not whether they were right. */
  function record(tally, encoding, claim, answered, ms) {
    var per = tally[encoding] || (tally[encoding] = {});
    var key = bucketOf(claim);
    var cell = per[key] || (per[key] = { attempts: 0, hits: 0, ms: 0 });
    cell.attempts++;
    if (answered === claim.truth) cell.hits++;
    cell.ms += ms;
    return tally;
  }

  /* Rows in a fixed order, absent buckets included as empty ones: a row that
     disappears when it has no data makes two encodings' tables different
     shapes, and then they cannot be read side by side. */
  function rows(tally, encoding) {
    var per = tally[encoding] || {};
    var out = [];
    var total = { attempts: 0, hits: 0, ms: 0 };
    for (var i = 0; i < BUCKETS.length; i++) {
      var cell = per[BUCKETS[i]] || { attempts: 0, hits: 0, ms: 0 };
      total.attempts += cell.attempts;
      total.hits += cell.hits;
      total.ms += cell.ms;
      out.push({
        bucket: BUCKETS[i],
        attempts: cell.attempts,
        hits: cell.hits,
        rate: cell.attempts ? cell.hits / cell.attempts : null,
        mean: cell.attempts ? cell.ms / cell.attempts : null
      });
    }
    out.push({
      bucket: "all",
      attempts: total.attempts,
      hits: total.hits,
      rate: total.attempts ? total.hits / total.attempts : null,
      mean: total.attempts ? total.ms / total.attempts : null
    });
    return out;
  }

  /* ------------------------------------------------------------------ */

  root.MODULUS = MODULUS;
  root.NEAR = NEAR;
  root.STRAIGHT = STRAIGHT;
  root.BUCKETS = BUCKETS;
  root.NAMES = NAMES;
  root.rng = rng;
  root.shuffled = shuffled;
  root.makeScene = makeScene;
  root.extent = extent;
  root.byName = byName;
  root.stepsRound = stepsRound;
  root.makeClaim = makeClaim;
  root.claimText = claimText;
  root.evaluate = evaluate;
  root.hueFor = hueFor;
  root.hueLinear = hueLinear;
  root.newTally = newTally;
  root.record = record;
  root.rows = rows;
  root.bucketOf = bucketOf;
})(typeof module !== "undefined" && module.exports
   ? module.exports
   : (window.FourthAxis = {}));

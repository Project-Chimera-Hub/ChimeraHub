/* ============================================================
   RUNNING ORDER — the model, the glyphs, the controller, the score
   ============================================================

   Everything here is pure, so node can test it without a browser; index.html
   only draws what this decides.

   THE TASK. A board of `s` slots on each of `d` axes (height, then width,
   then depth, then size) holds `s` symbols, one per slot on every axis. An
   episode opens by showing the whole board. Every beat after that shows one
   new symbol placed some number of steps from one symbol you hold — above or
   below it, left or right of it, and so on, one count per axis. The new
   symbol takes that slot, the symbol that was in it leaves, and nothing else
   moves. You answer the new symbol's rank on one axis.

   It used to be an insertion: the new symbol slotted in next to the
   reference, everything past it shifted a rank, and then the oldest left and
   everything closed up again. That moved symbols the card never mentioned,
   which made the bookkeeping the hard part rather than the relations. Fixed
   slots keep what mattered:

   - No card contains its answer. The rank is the reference's rank plus the
     steps on the card, and where the reference is depends on the cards before.
   - What leaves is decided by the card, not by age. Leaving by age in a board
     where nothing moves would put the new symbols into the slots in the same
     order every lap, and the answers would be a rhythm to learn instead of a
     board to hold.
   - The symbols are generated, not drawn from a set, so no symbol ever comes to
     mean anything. A task whose stimuli keep a fixed meaning automatises, and a
     task that has automatised has stopped loading what it was chosen to load.

   What goes on the cards is nonetheless a choice — see "Stimulus sets" below.
   Generated marks are the default and the honest one; a fixed pool of named
   animals encodes in a word, which spends the beat on the order instead of on
   the symbol, at the cost of the paragraph above. The model never looks inside
   a stimulus, so it does not care which.
*/

(function (root) {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Glyphs                                                              *
   * ------------------------------------------------------------------ */

  /* Strokes on a 3×3 lattice of points, numbered row by row. A stroke joins two
     neighbouring points, diagonals included — twenty possible strokes. */
  var SEGMENTS = [];
  (function () {
    for (var a = 0; a < 9; a++) {
      for (var b = a + 1; b < 9; b++) {
        var dx = Math.abs(a % 3 - b % 3), dy = Math.abs(((a / 3) | 0) - ((b / 3) | 0));
        if (Math.max(dx, dy) === 1) SEGMENTS.push([a, b]);
      }
    }
  })();

  var SEG_INDEX = {};
  SEGMENTS.forEach(function (s, i) { SEG_INDEX[s[0] + "-" + s[1]] = i; });

  /* The eight ways to turn or mirror the lattice. Two symbols that are the same
     shape turned over are the same symbol to a reader in a hurry — and in a
     task about where things are, a mirrored twin is the worst confusion there
     is — so distance is measured up to these. */
  var SYMMETRIES = [
    function (x, y) { return [x, y]; },
    function (x, y) { return [2 - x, y]; },
    function (x, y) { return [x, 2 - y]; },
    function (x, y) { return [2 - x, 2 - y]; },
    function (x, y) { return [y, x]; },
    function (x, y) { return [2 - y, x]; },
    function (x, y) { return [y, 2 - x]; },
    function (x, y) { return [2 - y, 2 - x]; },
  ];

  function transform(glyph, f) {
    return glyph.map(function (si) {
      var s = SEGMENTS[si];
      var p = f(s[0] % 3, (s[0] / 3) | 0), q = f(s[1] % 3, (s[1] / 3) | 0);
      var a = p[1] * 3 + p[0], b = q[1] * 3 + q[0];
      return SEG_INDEX[Math.min(a, b) + "-" + Math.max(a, b)];
    }).sort(function (x, y) { return x - y; });
  }

  function symDiff(a, b) {
    var n = 0, i = 0, j = 0;
    while (i < a.length || j < b.length) {
      if (j >= b.length || (i < a.length && a[i] < b[j])) { n++; i++; }
      else if (i >= a.length || b[j] < a[i]) { n++; j++; }
      else { i++; j++; }
    }
    return n;
  }

  /** Strokes that differ between two glyphs, at the most flattering turn. */
  function glyphDistance(a, b) {
    var best = Infinity;
    for (var i = 0; i < SYMMETRIES.length; i++) {
      best = Math.min(best, symDiff(transform(a, SYMMETRIES[i]), b));
    }
    return best;
  }

  /* One connected figure of three or four strokes that spans the lattice both
     ways — a mark, not a tick. */
  function makeGlyph(rnd) {
    for (var tries = 0; tries < 100; tries++) {
      var want = 3 + Math.floor(rnd() * 2);
      var set = [Math.floor(rnd() * SEGMENTS.length)];
      var points = {};
      SEGMENTS[set[0]].forEach(function (p) { points[p] = true; });
      while (set.length < want) {
        var touching = [];
        for (var i = 0; i < SEGMENTS.length; i++) {
          if (set.indexOf(i) >= 0) continue;
          if (points[SEGMENTS[i][0]] || points[SEGMENTS[i][1]]) touching.push(i);
        }
        var add = touching[Math.floor(rnd() * touching.length)];
        set.push(add);
        points[SEGMENTS[add][0]] = points[SEGMENTS[add][1]] = true;
      }
      var xs = {}, ys = {};
      Object.keys(points).forEach(function (p) { xs[p % 3] = 1; ys[(p / 3) | 0] = 1; });
      if (Object.keys(xs).length === 3 || Object.keys(ys).length === 3) {
        if (Object.keys(xs).length >= 2 && Object.keys(ys).length >= 2) {
          return set.sort(function (x, y) { return x - y; });
        }
      }
    }
    return [0, 2, 9];
  }

  /**
   * A glyph at least two strokes away from everything in `avoid`, under every
   * turn and mirror. `avoid` is what the player is holding plus what just left:
   * a symbol that has only just gone is still in the head.
   */
  function newGlyph(avoid, rnd) {
    rnd = rnd || Math.random;
    var g;
    for (var tries = 0; tries < 300; tries++) {
      g = makeGlyph(rnd);
      var ok = true;
      for (var i = 0; i < avoid.length && ok; i++) {
        if (glyphDistance(g, avoid[i]) < 2) ok = false;
      }
      if (ok) return g;
    }
    return g;
  }

  /** SVG path data in lattice units (0–2 on both axes). */
  function glyphPath(glyph) {
    return glyph.map(function (si) {
      var s = SEGMENTS[si];
      return "M" + (s[0] % 3) + " " + ((s[0] / 3) | 0) + "L" + (s[1] % 3) + " " + ((s[1] / 3) | 0);
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   * Stimulus sets                                                       *
   * ------------------------------------------------------------------ */

  /* What goes on the cards, and it is a real trade rather than a skin.

     GENERATED MARKS are the default and the reason the task was built this way:
     a mark that never repeats cannot come to mean anything, so nothing about it
     can be learned instead of the order, and encoding it costs what it costs.

     ANIMALS are the other end. A picture with a name is encoded in one word, so
     almost none of the beat is spent taking the symbol in and almost all of it
     is spent on the order — which is the point, and which is also why it is
     easier. The pool is fixed and small, so the stimuli DO recur, and a fixed
     set is exactly the consistent mapping that automatises: what it measures
     drifts away from relational load and toward how good a verbal chain you can
     build. Sessions are recorded with the set they used, because bits per
     second is not comparable across the two.

     A set is one function: the next stimulus, given what must not be confused
     with it (what is held, plus what has only just left — a symbol that has
     only just gone is still in the head). A generated mark is an array of
     stroke indices; an animal is `{name, path}`, a silhouette drawn on the
     same kind of grid and coloured the same way. Nothing in the model looks
     inside either. The drawings live in animals.js, with their credit. */
  var ANIMALS = (typeof module !== "undefined" && module.exports)
    ? require("./animals.js")
    : (root.RunningOrderAnimals || []);

  /** An animal that is not one of `avoid`, uniformly among those that are left. */
  function newAnimal(avoid, rnd) {
    rnd = rnd || Math.random;
    var taken = {};
    (avoid || []).forEach(function (a) { if (a && a.name) taken[a.name] = true; });
    var free = ANIMALS.filter(function (a) { return !taken[a.name]; });
    var pool = free.length ? free : ANIMALS;
    return pool[Math.floor(rnd() * pool.length)];
  }

  var SETS = {
    glyphs: { id: "glyphs", label: "Generated marks", next: newGlyph },
    animals: { id: "animals", label: "Animals", next: newAnimal },
  };

  /** The named set, or the generated marks for anything unrecognised — and for
      the animals when their drawings did not load, which beats a blank card. */
  function stimulusSet(id) {
    var set = SETS[id];
    if (!set || (set === SETS.animals && !ANIMALS.length)) return SETS.glyphs;
    return set;
  }

  /* ------------------------------------------------------------------ *
   * The model                                                           *
   * ------------------------------------------------------------------ */

  /*
   * Axis 0 is height, 1 is longitude, 2 is latitude, 3 is size. Rank 0 is top,
   * left, back, biggest — the end a reader meets first. A direction of -1 means
   * "toward rank 0".
   *
   * The first three are one box: height up the page, longitude across it,
   * latitude into it. Longitude comes before latitude so that two dimensions is
   * still a flat plane — height and across — and the third is what turns the
   * plane into a box, rather than 2D being a page seen edge-on.
   *
   * Size is last and deliberately outside the box. It is the one axis that is a
   * property of the symbol rather than a place, so it cannot be drawn as one
   * more direction; and once it is an axis of its own, nothing else may use
   * scale — which is why depth is carried by offset and the drawn frame alone.
   */
  var AXES = [
    { id: "height", before: "above", after: "below" },
    { id: "longitude", before: "left of", after: "right of" },
    { id: "latitude", before: "behind", after: "in front of" },
    { id: "size", before: "bigger than", after: "smaller than" },
  ];

  function createModel(d, s) {
    return { d: d, s: s, items: [], clock: 0, nextId: 1 };
  }

  /* A random order of 0..n-1. */
  function shuffled(n, rnd) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(i);
    for (var j = n - 1; j > 0; j--) {
      var k = Math.floor(rnd() * (j + 1)), t = out[j];
      out[j] = out[k]; out[k] = t;
    }
    return out;
  }

  /**
   * The board an episode opens with: `s` symbols, one in every slot on every
   * axis, shown all at once to be learnt before the first card. From here on
   * the board is always full and a slot is a slot — nothing ever renumbers.
   */
  function fill(model, stims, rnd) {
    rnd = rnd || Math.random;
    var perms = [];
    for (var a = 0; a < model.d; a++) perms.push(shuffled(model.s, rnd));
    model.items = [];
    for (var i = 0; i < model.s; i++) {
      var ranks = [];
      for (var b = 0; b < model.d; b++) ranks.push(perms[b][i]);
      model.items.push({ id: model.nextId++, glyph: stims[i], ranks: ranks, born: ++model.clock });
    }
    return model.items;
  }

  /**
   * The next card: the slot the new symbol lands in (the symbol there now is
   * the one it replaces), the held symbol it is placed against, how many steps
   * away that slot is on every axis, and which axis is asked about.
   *
   * The slot is picked first and uniformly, so the answers come out even over
   * the ranks and pressing one key forever scores exactly chance. The
   * reference is any other symbol, except one exactly the whole board away on
   * the asked axis: "all the way up" would say the answer without needing to
   * know where anything is.
   */
  function planCard(model, rnd) {
    rnd = rnd || Math.random;
    var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    var axis = model.d > 1 ? Math.floor(rnd() * model.d) : 0;
    var target = pick(model.items);
    var refs = model.items.filter(function (it) {
      return it !== target && Math.abs(target.ranks[axis] - it.ranks[axis]) < model.s - 1;
    });
    var ref = pick(refs);
    var dist = [];
    for (var a = 0; a < model.d; a++) dist.push(target.ranks[a] - ref.ranks[a]);
    return { ref: ref, target: target, dist: dist, axis: axis };
  }

  /** The card's symbol takes the target's slot; the target leaves. Nothing
      else moves. */
  function apply(model, plan, glyph) {
    var i = model.items.indexOf(plan.target);
    var x = { id: model.nextId++, glyph: glyph, ranks: plan.target.ranks.slice(), born: ++model.clock };
    model.items.splice(i, 1);
    model.items.push(x);
    return { item: x, removed: plan.target, answer: x.ranks[plan.axis] + 1 };
  }

  /* ------------------------------------------------------------------ *
   * Levels and the controller                                           *
   * ------------------------------------------------------------------ */

  /* Span first, then a dimension, and adding a dimension drops the span back:
     1D·7 holds 2.81 bits, 2D·3 holds 3.17. */
  var SIZES = { 1: [3, 4, 5, 6, 7], 2: [3, 4, 5], 3: [3, 4, 5], 4: [3, 4, 5] };

  /*
   * Ordered by what is carried, d·log2(s) bits — sorted rather than assumed.
   *
   * Nesting the loops happened to produce that order for three dimensions and
   * stops doing so at four: 4D·3 carries 6.34 bits and 3D·5 carries 6.97, so a
   * fourth dimension does not simply go on the end. Sorting states the rule the
   * comment always claimed, and leaves the first eleven rungs in exactly the
   * order they were in.
   */
  function ladder(maxD) {
    var out = [];
    for (var d = 1; d <= Math.max(1, Math.min(4, maxD || 4)); d++) {
      SIZES[d].forEach(function (s) { out.push({ d: d, s: s }); });
    }
    return out.sort(function (a, b) {
      return carriedBits(a.d, a.s) - carriedBits(b.d, b.s);
    });
  }

  function levelIndex(levels, level) {
    for (var i = 0; i < levels.length; i++) {
      if (levels[i].d === level.d && levels[i].s === level.s) return i;
    }
    /* A saved level the current dimension cap no longer allows: the highest
       one it does. */
    return level && level.d > levels[levels.length - 1].d ? levels.length - 1 : 0;
  }

  function carriedBits(d, k) { return k > 1 ? d * Math.log(k) / Math.LN2 : 0; }

  /** Accuracy with guessing taken out: 0 is chance, 1 is perfect. */
  function correctedAccuracy(oks, k) {
    if (!oks.length || k < 2) return 0;
    var p = oks.filter(Boolean).length / oks.length;
    return (p - 1 / k) / (1 - 1 / k);
  }

  /**
   * Keeps the task at the edge on two fronts. The interval moves toward the
   * target accuracy on every trial, as CCT's target-accuracy mode does, with
   * a nudge proportional to the miss and capped at a share of the interval
   * so a slow start and a fast finish feel equally gradual.
   *
   * When speed has nowhere left to go — at the floor and still above target,
   * or at the ceiling and still below — the level moves instead, the interval
   * relaxes to its start, and nothing moves again until a fresh window has been
   * filled at the new level.
   */
  function createController(opts) {
    var levels = ladder(opts.maxD);
    return {
      levels: levels,
      level: levelIndex(levels, opts.level || levels[0]),
      interval: opts.start,
      start: opts.start,
      floor: opts.floor,
      ceil: Math.max(opts.floor, opts.ceil),
      target: opts.target,
      adaptLevel: opts.adaptLevel !== false,
      window: [],
      win: opts.window || 20,
    };
  }

  var MAX_NUDGE_SHARE = 0.05;

  /** One scored trial at full size. Returns "up", "down" or null. */
  function update(c, ok) {
    var lvl = c.levels[c.level];
    c.window.push(!!ok);
    if (c.window.length > c.win) c.window.shift();
    if (c.window.length < 5) return null;

    var acc = correctedAccuracy(c.window, lvl.s);
    var cap = Math.max(20, c.interval * MAX_NUDGE_SHARE);
    var nudge = Math.max(-cap, Math.min(cap, (acc - c.target) * 2 * cap));
    c.interval = Math.round(Math.max(c.floor, Math.min(c.ceil, c.interval - nudge)));

    if (!c.adaptLevel || c.window.length < c.win) return null;
    var move = null;
    if (c.interval <= c.floor && acc >= c.target && c.level < c.levels.length - 1) move = "up";
    else if (c.interval >= c.ceil && acc < c.target && c.level > 0) move = "down";
    if (move) {
      c.level += move === "up" ? 1 : -1;
      c.interval = c.start;
      c.window = [];
    }
    return move;
  }

  /* ------------------------------------------------------------------ *
   * The score                                                           *
   * ------------------------------------------------------------------ */

  /* Credit for one trial: 1 if right, and the classical guessing correction if
     wrong — a wrong answer is evidence of a guess, and k−1 wrong guesses come
     with every right one. A miss is not a guess and costs nothing but the
     time it took. */
  function credit(t) {
    if (t.ok) return 1;
    return t.given == null ? 0 : -1 / (t.k - 1);
  }

  /**
   * Relational throughput in bits per second: what was carried, discounted
   * for guessing, over the time it took. It rises with speed, with size and
   * with dimensions alike, which is what lets one number follow a player up a
   * ladder whose levels are otherwise incomparable.
   */
  function throughput(trials) {
    var bits = 0, secs = 0;
    trials.forEach(function (t) {
      if (t.k < 2) return;
      bits += credit(t) * carriedBits(t.d, t.k);
      secs += t.interval / 1000;
    });
    return secs > 0 ? Math.max(0, bits / secs) : 0;
  }

  /** The best stretch of `span` consecutive trials. */
  function peakThroughput(trials, span) {
    span = span || 20;
    var scored = trials.filter(function (t) { return t.k >= 2; });
    if (scored.length < span) return throughput(scored);
    var best = 0;
    for (var i = 0; i + span <= scored.length; i++) {
      best = Math.max(best, throughput(scored.slice(i, i + span)));
    }
    return best;
  }

  var api = {
    SEGMENTS: SEGMENTS, AXES: AXES, SIZES: SIZES, ANIMALS: ANIMALS, SETS: SETS,
    makeGlyph: makeGlyph, newGlyph: newGlyph, glyphDistance: glyphDistance, glyphPath: glyphPath,
    newAnimal: newAnimal, stimulusSet: stimulusSet,
    createModel: createModel, fill: fill, planCard: planCard, apply: apply,
    ladder: ladder, levelIndex: levelIndex, carriedBits: carriedBits,
    correctedAccuracy: correctedAccuracy, createController: createController, update: update,
    credit: credit, throughput: throughput, peakThroughput: peakThroughput,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RunningOrder = api;
})(this);

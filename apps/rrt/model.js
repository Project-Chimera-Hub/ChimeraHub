/* ============================================================
   RUNNING ORDER — the model, the glyphs, the controller, the score
   ============================================================

   Everything here is pure, so node can test it without a browser; index.html
   only draws what this decides.

   THE TASK. You hold `s` symbols in your head, each with a rank on each of `d`
   axes (height, then width, then size). Every beat shows one new symbol
   placed relative to one symbol you already hold: above or below it, left or
   right of it, bigger or smaller than it — one relation per axis, all at once.
   The new symbol slots in right next to that one on every axis, and when that
   makes one too many, the OLDEST symbol leaves and everything closes up. You
   answer the new symbol's rank on one axis.

   Why this shape, rather than CCT's "combine with the previous one":

   - No card contains its answer. The rank depends on where the reference sits
     now, which depends on every insertion and departure before it.
   - Each symbol carries two bindings — where it is and how old it is — and both
     change every beat. Discarding the stale ones is part of the work.
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
     stroke indices; an animal is `{char, name}`. Nothing in the model looks
     inside either. */
  var ANIMALS = [
    { char: "\uD83D\uDC18", name: "elephant" }, { char: "\uD83E\uDD92", name: "giraffe" },
    { char: "\uD83E\uDD93", name: "zebra" },    { char: "\uD83D\uDC2A", name: "camel" },
    { char: "\uD83D\uDC0E", name: "horse" },    { char: "\uD83D\uDC04", name: "cow" },
    { char: "\uD83D\uDC16", name: "pig" },      { char: "\uD83D\uDC11", name: "sheep" },
    { char: "\uD83D\uDC15", name: "dog" },      { char: "\uD83D\uDC08", name: "cat" },
    { char: "\uD83D\uDC07", name: "rabbit" },   { char: "\uD83D\uDC01", name: "mouse" },
    { char: "\uD83D\uDC12", name: "monkey" },   { char: "\uD83E\uDD94", name: "hedgehog" },
    { char: "\uD83E\uDD8C", name: "deer" },     { char: "\uD83D\uDC3F", name: "squirrel" },
    { char: "\uD83D\uDC0A", name: "crocodile" },{ char: "\uD83D\uDC22", name: "turtle" },
    { char: "\uD83D\uDC0D", name: "snake" },    { char: "\uD83D\uDC38", name: "frog" },
    { char: "\uD83D\uDC1F", name: "fish" },     { char: "\uD83D\uDC19", name: "octopus" },
    { char: "\uD83E\uDD80", name: "crab" },     { char: "\uD83D\uDC33", name: "whale" },
    { char: "\uD83E\uDD85", name: "eagle" },    { char: "\uD83E\uDD89", name: "owl" },
    { char: "\uD83D\uDC27", name: "penguin" },  { char: "\uD83E\uDD86", name: "duck" },
    { char: "\uD83E\uDD8B", name: "butterfly" },{ char: "\uD83D\uDC1D", name: "bee" },
    { char: "\uD83D\uDC0C", name: "snail" },    { char: "\uD83E\uDD87", name: "bat" },
  ];

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

  /** The named set, or the generated marks for anything unrecognised. */
  function stimulusSet(id) { return SETS[id] || SETS.glyphs; }

  /* ------------------------------------------------------------------ *
   * The model                                                           *
   * ------------------------------------------------------------------ */

  /* Axis 0 is height, 1 is width, 2 is size. Rank 0 is top, left, biggest —
     the end a reader meets first. A direction of -1 means "toward rank 0". */
  var AXES = [
    { id: "height", before: "above", after: "below" },
    { id: "width", before: "left of", after: "right of" },
    { id: "size", before: "bigger than", after: "smaller than" },
  ];

  function createModel(d, s) {
    return { d: d, s: s, items: [], clock: 0, nextId: 1 };
  }

  /** The first symbol of an episode: it has nothing to be placed against. */
  function seed(model, glyph) {
    var ranks = [];
    for (var a = 0; a < model.d; a++) ranks.push(0);
    var item = { id: model.nextId++, glyph: glyph, ranks: ranks, born: ++model.clock };
    model.items.push(item);
    return item;
  }

  /* Where every rank ends up if a symbol goes in next to `ref`, in `dirs`, and
     the oldest then leaves when there is one too many. Returns the new symbol's
     ranks, and the item that left. Pure: works on copies. */
  function simulate(model, ref, dirs) {
    var ranks = model.items.map(function (it) { return it.ranks.slice(); });
    var refIdx = model.items.indexOf(ref);
    var x = [];
    for (var a = 0; a < model.d; a++) {
      var at = ranks[refIdx][a] + (dirs[a] < 0 ? 0 : 1);
      for (var i = 0; i < ranks.length; i++) if (ranks[i][a] >= at) ranks[i][a]++;
      x.push(at);
    }
    var removed = -1;
    if (model.items.length + 1 > model.s) {
      removed = 0;
      for (var j = 1; j < model.items.length; j++) {
        if (model.items[j].born < model.items[removed].born) removed = j;
      }
      for (var b = 0; b < model.d; b++) {
        var gone = ranks[removed][b];
        if (x[b] > gone) x[b]--;
        for (var k = 0; k < ranks.length; k++) if (ranks[k][b] > gone) ranks[k][b]--;
      }
    }
    return { x: x, ranks: ranks, removed: removed };
  }

  /**
   * The next card: which symbol it is placed against, in which directions, and
   * which axis is asked about.
   *
   * Picking all of that uniformly would pile the answers up in the middle
   * ranks, and a player who learned to press the middle key would score for it.
   * So the answer is picked first, uniformly among the ranks this model can
   * produce on the asked axis, and then a placement that produces it. The
   * other axes' directions are free.
   */
  function planCard(model, rnd) {
    rnd = rnd || Math.random;
    var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    var axis = model.d > 1 ? Math.floor(rnd() * model.d) : 0;
    var byAnswer = {};
    var answers = [];
    model.items.forEach(function (ref) {
      [-1, 1].forEach(function (dir) {
        var dirs = [];
        for (var a = 0; a < model.d; a++) dirs.push(a === axis ? dir : (rnd() < 0.5 ? -1 : 1));
        var r = simulate(model, ref, dirs).x[axis];
        if (!byAnswer[r]) { byAnswer[r] = []; answers.push(r); }
        byAnswer[r].push({ ref: ref, dirs: dirs });
      });
    });
    var chosen = pick(byAnswer[pick(answers)]);
    return { ref: chosen.ref, dirs: chosen.dirs, axis: axis };
  }

  /** Put the card's symbol in, drop the oldest if needed. */
  function apply(model, plan, glyph) {
    var sim = simulate(model, plan.ref, plan.dirs);
    var removed = sim.removed >= 0 ? model.items[sim.removed] : null;
    model.items.forEach(function (it, i) { it.ranks = sim.ranks[i]; });
    if (removed) model.items.splice(sim.removed, 1);
    var x = { id: model.nextId++, glyph: glyph, ranks: sim.x, born: ++model.clock };
    model.items.push(x);
    return { item: x, removed: removed, answer: sim.x[plan.axis] + 1 };
  }

  /* ------------------------------------------------------------------ *
   * Levels and the controller                                           *
   * ------------------------------------------------------------------ */

  /* Ordered by what is carried — d·log2(s) bits — and it happens to rise
     monotonically: 1D·7 holds 2.81 bits, 2D·3 holds 3.17. Size first, then a
     dimension, and adding a dimension drops the size back. */
  var SIZES = { 1: [3, 4, 5, 6, 7], 2: [3, 4, 5], 3: [3, 4, 5] };

  function ladder(maxD) {
    var out = [];
    for (var d = 1; d <= Math.max(1, Math.min(3, maxD || 3)); d++) {
      SIZES[d].forEach(function (s) { out.push({ d: d, s: s }); });
    }
    return out;
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
    createModel: createModel, seed: seed, planCard: planCard, apply: apply, simulate: simulate,
    ladder: ladder, levelIndex: levelIndex, carriedBits: carriedBits,
    correctedAccuracy: correctedAccuracy, createController: createController, update: update,
    credit: credit, throughput: throughput, peakThroughput: peakThroughput,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RunningOrder = api;
})(this);

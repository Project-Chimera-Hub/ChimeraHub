"use strict";
/*
 * Relation Algebra: the engine. No page code, so it runs (and is tested) in
 * Node as well as in the trainer.
 *
 * ── The idea ──
 *
 * Every material is a group: things that can be combined, undone and compared.
 * Objects (Red, Blue, …) each hold one element; a relation between two
 * objects is one more element, rel(X, Y) = X · Y⁻¹, so that X = rel · Y.
 * For the grid that is ordinary vector subtraction, X − Y.
 *
 *   space    ℤ²   a place on a grid           "Red is two steps north of Blue"
 *   numbers  ℤ    a whole number              "Red is 3 more than Blue"
 *   notes    ℤ₁₂  a note, wrapping at the octave
 *   days     ℤ₇   a day of the week, wrapping
 *   compass  ℤ₈   a heading, in 45° steps
 *   square   D₄   a tile's orientation; order matters ("turned, then mirrored"
 *                 is not "mirrored, then turned")
 *
 * ── Nested terms ──
 *
 * A term is an object, or an offset applied to a term: "the place north of
 * the place east of Red" is north · (east · Red). Points and vectors are kept
 * apart as an affine space keeps them: a term is a point, an offset is a
 * vector, and only point = vector · point is ever written, so every sentence
 * the generator makes is well-typed. Terms are read out right-branching only
 * ("the place … of the place … of Red"), never centre-embedded.
 *
 * A premise "L is r of R", with L = a·X and R = b·Y, says a·X = r·b·Y, so
 * rel(X, Y) = a⁻¹ · r · b. The generator works backwards: it picks the world
 * first, then offsets a and b, and solves for r, keeping only premises where
 * r is sayable and the nesting changes the answer.
 *
 * ── The tasks ──
 *
 *   question   Several premises, then "Is X r of Y?" Yes / No / Can't tell.
 *              The premises form a tree over the objects; the question's two
 *              objects are linked through a path of premises, whose relations
 *              must be combined (path length = integration depth). "Can't
 *              tell" when a premise on the path is left out (the system's rank
 *              is too low to decide).
 *   possible   Premises with a loop. Possible when every loop sums to the
 *              identity (as voltages round a circuit do); one altered premise
 *              makes it impossible.
 *   howfar     How many steps apart (Manhattan or king's moves). Space and
 *              numbers.
 *   nback      Each trial describes an arrangement of the same objects; match
 *              when it is the arrangement n back, exactly or up to rotation.
 *
 * ── Lures ──
 *
 * The wrong answers offered are the answers of particular mistakes:
 *   ignored     the nesting read as if it were not there (a, b dropped)
 *   dropLeft / dropRight  one side's offsets dropped
 *   sign        offsets applied with the wrong sign: a · r · b⁻¹
 *   order       (non-commutative groups) the right offsets composed backwards
 *   step        one step off
 *   mirror, rotate, flip …  the group's symmetries applied to the truth
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Algebra = factory();
})(typeof self !== "undefined" ? self : this, function () {

  /* ------------------------------------------------------------------ *
   * Randomness, injectable for tests                                     *
   * ------------------------------------------------------------------ */
  function Rng(seed) {
    if (seed == null) return { next: Math.random };
    var s = seed >>> 0;
    return { next: function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    } };
  }
  function int(rng, a, b) { return a + Math.floor(rng.next() * (b - a + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng.next() * arr.length)]; }
  function shuffle(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng.next() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  var mod = function (a, m) { return ((a % m) + m) % m; };
  var NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  var nw = function (k) { return NUMBER_WORDS[k] || String(k); };

  /* ------------------------------------------------------------------ *
   * The groups                                                           *
   * ------------------------------------------------------------------ */

  /* Every group gives: op(a, b) (b applied first, then a), inv, id, eq, key,
     random(rng, o) for an object's value, offsets(o) for the sayable
     elements, say(g, o) for a relation phrase (or null), the phrasing of
     terms and premises, and its symmetries. `o` is the difficulty: maxDist,
     compounds, twoPart. */

  var COMPASS = [
    { k: "north", v: [0, 1] }, { k: "north-east", v: [1, 1] }, { k: "east", v: [1, 0] }, { k: "south-east", v: [1, -1] },
    { k: "south", v: [0, -1] }, { k: "south-west", v: [-1, -1] }, { k: "west", v: [-1, 0] }, { k: "north-west", v: [-1, 1] }
  ];
  function steps(k) { return k === 1 ? "one step" : nw(k) + " steps"; }

  var space = {
    name: "space", label: "Space", abelian: true, leftNesting: true,
    op: function (a, b) { return [a[0] + b[0], a[1] + b[1]]; },
    inv: function (a) { return [-a[0], -a[1]]; },
    id: function () { return [0, 0]; },
    eq: function (a, b) { return a[0] === b[0] && a[1] === b[1]; },
    key: function (a) { return a[0] + "," + a[1]; },
    random: function (rng, o) { var r = 2 + o.maxDist; return [int(rng, -r, r), int(rng, -r, r)]; },
    /* Sayable single moves: a direction (4, or 8 with compounds) times 1..maxDist. */
    offsets: function (o) {
      var out = [];
      COMPASS.forEach(function (c, i) {
        if (i % 2 && !o.compounds) return;
        for (var k = 1; k <= o.maxDist; k++) out.push([c.v[0] * k, c.v[1] * k]);
      });
      return out;
    },
    say: function (g, o) {
      var x = g[0], y = g[1];
      if (!x && !y) return null;
      for (var i = 0; i < 8; i++) {
        if (i % 2 && !o.compounds) continue;
        var c = COMPASS[i], k = Math.max(Math.abs(x), Math.abs(y));
        if (c.v[0] * k === x && c.v[1] * k === y) return k <= o.maxDist ? steps(k) + " " + c.k : null;
      }
      if (!o.twoPart || Math.abs(x) > o.maxDist || Math.abs(y) > o.maxDist) return null;
      return steps(Math.abs(y)) + " " + (y > 0 ? "north" : "south") + " and " + steps(Math.abs(x)) + " " + (x > 0 ? "east" : "west");
    },
    /* Any vector at all, for answers and explanations. */
    sayAny: function (g) {
      var x = g[0], y = g[1], parts = [];
      if (y) parts.push(steps(Math.abs(y)) + " " + (y > 0 ? "north" : "south"));
      if (x) parts.push(steps(Math.abs(x)) + " " + (x > 0 ? "east" : "west"));
      return parts.length ? parts.join(" and ") : "the same place";
    },
    base: function (name) { return name; },
    wrap: function (off, inner) { return "the place " + off + " of " + inner; },
    premise: function (L, rel, R) { return L + " is " + rel + " of " + R; },
    same: function (L, R) { return L + " is the same place as " + R; },
    question: function (X, rel, Y) { return "Is " + X + " " + rel + " of " + Y + "?"; },
    markWord: "the place",
    unit: [0, 1],
    /* The square's eight symmetries, applied to a relation vector. */
    symmetries: [
      { id: "rotate90", label: "turned a quarter", f: function (v) { return [v[1], -v[0]]; }, rotation: true },
      { id: "rotate180", label: "turned half way round", f: function (v) { return [-v[0], -v[1]]; }, rotation: true },
      { id: "rotate270", label: "turned a quarter the other way", f: function (v) { return [-v[1], v[0]]; }, rotation: true },
      { id: "mirrorEW", label: "mirrored east to west", f: function (v) { return [-v[0], v[1]]; } },
      { id: "mirrorNS", label: "mirrored north to south", f: function (v) { return [v[0], -v[1]]; } },
      { id: "diagonal", label: "flipped along a diagonal", f: function (v) { return [v[1], v[0]]; } },
    ],
    metric: function (g, which) { return which === "king" ? Math.max(Math.abs(g[0]), Math.abs(g[1])) : Math.abs(g[0]) + Math.abs(g[1]); },
  };

  function cyclic(id, label, n, opts) {
    return {
      name: id, label: label, abelian: true, leftNesting: true, n: n,
      op: function (a, b) { return n ? mod(a + b, n) : a + b; },
      inv: function (a) { return n ? mod(-a, n) : -a; },
      id: function () { return 0; },
      eq: function (a, b) { return a === b; },
      key: function (a) { return String(a); },
      random: function (rng) { return n ? int(rng, 0, n - 1) : int(rng, 1, 30); },
      offsets: function (o) {
        var out = [], max = n ? Math.min(n - 1, opts.maxOffset(o)) : o.maxDist * 3;
        for (var k = 1; k <= max; k++) { out.push(n ? mod(k, n) : k); out.push(n ? mod(-k, n) : -k); }
        return out.filter(function (v, i, a) { return a.indexOf(v) === i && v !== 0; });
      },
      say: function (g, o) { return opts.say(g, o, false); },
      sayAny: function (g) { return opts.say(g, { maxDist: 99 }, true); },
      base: opts.base, wrap: opts.wrap, premise: opts.premise, same: opts.same, question: opts.question,
      markWord: opts.markWord,
      unit: 1,
      symmetries: [{ id: "reverse", label: opts.reverseLabel, f: function (v) { return n ? mod(-v, n) : -v; } }],
      metric: n ? null : function (g) { return Math.abs(g); },
    };
  }

  var numbers = cyclic("numbers", "Numbers", 0, {
    maxOffset: function (o) { return o.maxDist * 3; },
    say: function (g, o, any) {
      if (!g) return any ? "equal to" : null;
      if (!any && Math.abs(g) > o.maxDist * 3) return null;
      return Math.abs(g) + (g > 0 ? " more than" : " less than");
    },
    base: function (name) { return name; },
    wrap: function (off, inner) { return "the number " + off + " " + inner; },
    premise: function (L, rel, R) { return L + " is " + rel + " " + R; },
    same: function (L, R) { return L + " equals " + R; },
    question: function (X, rel, Y) { return "Is " + X + " " + rel + " " + Y + "?"; },
    markWord: "the number",
    reverseLabel: "every difference reversed",
  });

  /* For the wrapping groups a relation has two honest phrasings (4 above is
     8 below in the octave); `say` picks the shorter, and the generator may
     use the other as a paraphrase. */
  function wrapSay(n, up, down, unitWord, units) {
    return function (g, o, any) {
      g = mod(g, n);
      if (!g) return any ? "the same as" : null;
      var u = g, d = n - g;
      var w = function (k) { return k === 1 ? "one " + unitWord : nw(k) + " " + units; };
      if (u <= d) return w(u) + " " + up;
      return w(d) + " " + down;
    };
  }
  var notes = cyclic("notes", "Notes", 12, {
    maxOffset: function (o) { return Math.min(6, o.maxDist * 2); },
    say: wrapSay(12, "above", "below", "semitone", "semitones"),
    base: function (name) { return name + "'s note"; },
    wrap: function (off, inner) { return "the note " + off + " " + inner; },
    premise: function (L, rel, R) { return L + " is " + rel + " " + R; },
    same: function (L, R) { return L + " is the same note as " + R; },
    question: function (X, rel, Y) { return "Is " + X + " " + rel + " " + Y + "?"; },
    markWord: "the note",
    reverseLabel: "turned upside down (every interval inverted)",
  });
  var days = cyclic("days", "Days", 7, {
    maxOffset: function (o) { return Math.min(3, o.maxDist + 1); },
    say: wrapSay(7, "after", "before", "day", "days"),
    base: function (name) { return name + "'s day"; },
    wrap: function (off, inner) { return "the day " + off + " " + inner; },
    premise: function (L, rel, R) { return L + " is " + rel + " " + R; },
    same: function (L, R) { return L + " is the same day as " + R; },
    question: function (X, rel, Y) { return "Is " + X + " " + rel + " " + Y + "?"; },
    markWord: "the day",
    reverseLabel: "running backwards through the week",
  });
  var compassSay = function (g, o, any) {
    g = mod(g, 8);
    if (!g) return any ? "the same as" : null;
    if (g === 4) return "opposite to";
    var cw = g <= 4, k = cw ? g : 8 - g;
    return (k * 45) + "° " + (cw ? "clockwise from" : "anticlockwise from");
  };
  var compass = cyclic("compass", "Headings", 8, {
    maxOffset: function (o) { return o.compounds ? 4 : 2; },
    say: compassSay,
    base: function (name) { return name + "'s heading"; },
    wrap: function (off, inner) { return "the heading " + off + " " + inner; },
    premise: function (L, rel, R) { return L + " is " + rel + " " + R; },
    same: function (L, R) { return L + " is the same as " + R; },
    question: function (X, rel, Y) { return "Is " + X + " " + rel + " " + Y + "?"; },
    markWord: "the heading",
    reverseLabel: "mirrored (clockwise and anticlockwise swapped)",
  });
  /* compass offsets in 4-direction mode are quarter turns only */
  compass.offsets = function (o) { return o.compounds ? [1, 2, 3, 4, 5, 6, 7] : [2, 4, 6]; };
  compass.random = function (rng, o) { return o.compounds ? int(rng, 0, 7) : 2 * int(rng, 0, 3); };
  compass.say = function (g, o) { if (!o.compounds && g % 2) return null; return compassSay(g, o, false); };
  compass.headingName = function (g) { return COMPASS[mod(g, 8)].k; };

  /* D₄: (r, f) is "mirror left to right if f, then turn r quarters clockwise".
     Composition a∘b (b first): R^ra M^fa R^rb M^fb = R^(ra ± rb) M^(fa xor fb),
     with the sign flipping when a mirrors, since M R = R⁻¹ M. */
  var D4_NAMES = {
    "1,0": "turned a quarter right", "2,0": "turned half way round", "3,0": "turned a quarter left",
    "0,1": "mirrored left to right", "2,1": "mirrored top to bottom",
    "1,1": "flipped along the rising diagonal", "3,1": "flipped along the falling diagonal"
  };
  var square = {
    name: "square", label: "Orientations", abelian: false, leftNesting: false,
    op: function (a, b) { return [mod(a[0] + (a[1] ? -b[0] : b[0]), 4), a[1] ^ b[1]]; },
    inv: function (a) { return a[1] ? [a[0], 1] : [mod(-a[0], 4), 0]; },
    id: function () { return [0, 0]; },
    eq: function (a, b) { return a[0] === b[0] && a[1] === b[1]; },
    key: function (a) { return a[0] + "," + a[1]; },
    random: function (rng) { return [int(rng, 0, 3), int(rng, 0, 1)]; },
    offsets: function (o) {
      var all = [[1, 0], [2, 0], [3, 0], [0, 1], [2, 1], [1, 1], [3, 1]];
      return o.compounds ? all : all.slice(0, 5);
    },
    say: function (g, o) {
      var k = g[0] + "," + g[1];
      if (!o.compounds && (k === "1,1" || k === "3,1")) return null;
      return D4_NAMES[k] || null;
    },
    sayAny: function (g) { return D4_NAMES[g[0] + "," + g[1]] || "unchanged"; },
    base: function (name) { return name; },
    /* Postfix and chained in the order applied: "Blue mirrored left to right,
       then turned a quarter right". */
    wrap: function (off, inner, innerIsBase) { return inner + (innerIsBase ? " " : ", then ") + off; },
    premise: function (L, rel, R, rIsBase) { return L + " is " + square.wrap(rel, R, rIsBase); },
    same: function (L, R) { return L + " is exactly " + R; },
    question: function (X, rel, Y) { return "Is " + X + " " + Y + " " + rel + "?"; },
    markWord: "the tile",
    unit: [1, 0],
    symmetries: [
      { id: "conjugate", label: "seen in a mirror", f: function (g) { return square.op(square.op([0, 1], g), [0, 1]); } },
      { id: "inverse", label: "undone instead of done", f: function (g) { return square.inv(g); } },
    ],
    metric: null,
  };

  var GROUPS = { space: space, numbers: numbers, notes: notes, days: days, compass: compass, square: square };

  /* ------------------------------------------------------------------ *
   * Difficulty                                                           *
   * ------------------------------------------------------------------ */

  /** Level 1..20 → what a description may contain. */
  function difficulty(level, task) {
    var L = Math.max(1, Math.min(20, Math.round(level)));
    var d = {
      level: L,
      objects: Math.min(6, 3 + Math.floor((L - 1) / 5)),          /* 3 … 6 */
      depth: L <= 2 ? 0 : L <= 6 ? 1 : L <= 12 ? 2 : 3,            /* nesting per side */
      maxDist: L <= 3 ? 1 : L <= 9 ? 2 : 3,
      compounds: L >= 5,
      twoPart: L >= 10,
      bothSides: L >= 4,                                           /* offsets on both sides */
      nestShare: L <= 2 ? 0 : Math.min(0.9, 0.35 + L * 0.03),     /* share of premises nested */
      perspectiveShare: L >= 3 ? 0.35 : 0,
      n: 1 + Math.floor((L - 1) / 5),                              /* n-back depth 1 … 4 */
    };
    if (task === "nback") d.objects = L < 8 ? 3 : 4;
    return d;
  }

  /* ------------------------------------------------------------------ *
   * Terms and premises                                                    *
   * ------------------------------------------------------------------ */

  var NAMES = ["Red", "Blue", "Green", "Gold", "Violet", "White"];

  /** A chain of offsets, applied innermost first; value = cN · … · c1. */
  function chainValue(G, chain) {
    var v = G.id();
    chain.forEach(function (c) { v = G.op(c, v); });
    return v;
  }
  function randomChain(G, rng, o, len) {
    var offs = G.offsets(o), chain = [];
    for (var i = 0; i < len; i++) {
      var c, tries = 0;
      /* No offset may undo the one before it (north then south). */
      do { c = pick(rng, offs); } while (tries++ < 20 && chain.length && G.eq(G.op(c, chain[chain.length - 1]), G.id()));
      chain.push(c);
    }
    return chain;
  }

  /**
   * A premise asserting rel(X, Y) = v, possibly nested and possibly from a
   * perspective. Returns { X, Y, a, b, r, kind, ... } or null if this draw
   * could not be said; the caller retries.
   */
  function makePremise(G, rng, o, X, Y, v, wantNested, perspective, anyPhrase) {
    /* Either way round: "X is r of Y", or "Y is r' of X" with r' for v⁻¹. */
    if (rng.next() < 0.5) { var t = X; X = Y; Y = t; v = G.inv(v); }
    if (perspective && G === space) {
      var facing = pick(rng, [0, 2, 4, 6]);   /* N, E, S, W only: keeps the grid whole */
      var rel = toFrame(v, facing);
      if (Math.abs(rel[0]) > o.maxDist || Math.abs(rel[1]) > o.maxDist || (!rel[0] && !rel[1])) return null;
      if (rel[0] && rel[1] && !o.twoPart) return null;
      return { X: X, Y: Y, v: v, a: [], b: [], r: v, kind: "perspective", facing: facing, frame: rel };
    }
    if (!wantNested || o.depth === 0) {
      if (!G.say(v, o) && !(anyPhrase && G.sayAny && !G.eq(v, G.id()))) return null;
      return { X: X, Y: Y, v: v, a: [], b: [], r: v, kind: "plain" };
    }
    var depthB = int(rng, 1, o.depth);
    var depthA = G.leftNesting && o.bothSides ? int(rng, 0, o.depth) : 0;
    var a = randomChain(G, rng, o, depthA), b = randomChain(G, rng, o, depthB);
    var A = chainValue(G, a), B = chainValue(G, b);
    /* a·X = r·b·Y  ⇒  r = a · v · b⁻¹ */
    var r = G.op(G.op(A, v), G.inv(B));
    /* The nesting must matter: r must differ from v, else ignoring it is free. */
    if (G.eq(r, v)) return null;
    if (!G.eq(r, G.id()) && !G.say(r, o)) return null;
    return { X: X, Y: Y, v: v, a: a, b: b, r: r, kind: "nested" };
  }

  /* World vector → the frame of someone facing heading h (0 N, 2 E, 4 S, 6 W):
     [right, ahead]. */
  function toFrame(v, h) {
    var x = v[0], y = v[1];
    switch (h) {
      case 0: return [x, y];
      case 2: return [-y, x];
      case 4: return [-x, -y];
      default: return [y, -x];
    }
  }
  function fromFrame(rel, h) {
    var r = rel[0], f = rel[1];
    switch (h) {
      case 0: return [r, f];
      case 2: return [f, -r];
      case 4: return [-r, -f];
      default: return [-f, r];
    }
  }
  function sayFrame(rel) {
    var parts = [];
    if (rel[1]) parts.push(steps(Math.abs(rel[1])) + (rel[1] > 0 ? " ahead" : " behind"));
    if (rel[0]) parts.push(steps(Math.abs(rel[0])) + " to the " + (rel[0] > 0 ? "right" : "left"));
    return parts.join(" and ");
  }

  /* ------------------------------------------------------------------ *
   * Saying it                                                            *
   * ------------------------------------------------------------------ */

  /** Render a term (a chain applied to an object), inline. */
  function sayTerm(G, o, name, chain) {
    var s = G.base(name), isBase = true;
    chain.forEach(function (c) { s = G.wrap(G.say(c, o), s, isBase); isBase = false; });
    return s;
  }

  /**
   * The sentences for a list of premises. `style` is "inline", "marks" or
   * "mixed". Marks are let-bindings: "Let A be the place north of Red." and
   * the premise then names A.
   */
  function render(G, o, premises, style, rng) {
    var lines = [], markNo = 0;
    /* Never reused within a description, and never an object's initial. */
    var LETTERS = "PQSTUXYZACDEFHJKLMN";
    function nextMark() { var k = markNo++; return LETTERS[k % LETTERS.length] + (k >= LETTERS.length ? Math.floor(k / LETTERS.length) + 1 : ""); }
    function term(name, chain, useMarks) {
      if (!chain.length) return G.base(name);
      if (!useMarks) return sayTerm(G, o, name, chain);
      var cur = G.base(name), isBase = true;
      chain.forEach(function (c) {
        var m = nextMark();
        lines.push("Let " + m + " be " + G.wrap(G.say(c, o), cur, true) + ".");
        cur = m; isBase = false;
      });
      return cur;
    }
    premises.forEach(function (p) {
      var useMarks = style === "marks" || (style === "mixed" && rng.next() < 0.5);
      if (p.kind === "perspective") {
        lines.push("Standing at " + p.Y + " and facing " + COMPASS[p.facing].k + ", " + p.X + " is " + sayFrame(p.frame) + ".");
        return;
      }
      var L = term(p.X, p.a, useMarks), R = term(p.Y, p.b, useMarks);
      var sentence;
      if (G.eq(p.r, G.id())) sentence = G.same(L, R);
      else sentence = G.premise(L, G.say(p.r, o) || G.sayAny(p.r), R, !p.b.length || (useMarks && p.b.length));
      lines.push(sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".");
    });
    return lines;
  }

  /** What one premise means, plainly: for explanations. */
  function meaning(G, X, v, Y) {
    if (G.eq(v, G.id())) return G.same(G.base(X), G.base(Y));
    return G.premise(G.base(X), G.sayAny(v), G.base(Y), true);
  }

  /* ------------------------------------------------------------------ *
   * Worlds, trees and solving                                            *
   * ------------------------------------------------------------------ */

  function rel(G, w, X, Y) { return G.op(w.vals[X], G.inv(w.vals[Y])); }

  /**
   * A world built along a random spanning tree, each link a relation the
   * material can say at this level, so a description always exists. Values
   * are kept distinct where the material allows.
   */
  function treeWorld(G, rng, o, names) {
    var edges = tree(rng, names), vals = {}, used = {};
    var root = names.filter(function (n) { return !edges.some(function (e) { return e[0] === n; }); })[0];
    vals[root] = G.random(rng, o); used[G.key(vals[root])] = true;
    var pool = G.offsets(o);
    if (G === space && o.twoPart) {
      var straight = pool.filter(function (v) { return !v[0] || !v[1]; });
      straight.forEach(function (a) { straight.forEach(function (b) { if (!a[0] && b[0] && !b[1]) pool.push([b[0], a[1]]); }); });
    }
    edges.forEach(function (e) {
      var v, tries = 0;
      do { v = G.op(pick(rng, pool), vals[e[1]]); } while (tries++ < 40 && used[G.key(v)]);
      vals[e[0]] = v; used[G.key(v)] = true;
    });
    return { names: names, vals: vals, edges: edges };
  }

  /** A random spanning tree: each object after the first links to an earlier one. */
  function tree(rng, names) {
    var order = shuffle(rng, names), edges = [];
    for (var i = 1; i < order.length; i++) edges.push([order[i], order[int(rng, 0, i - 1)]]);
    return edges;
  }

  /** Premises for a set of edges, each saying the true relation. */
  function premisesFor(G, rng, o, w, edges, anyPhrase) {
    return edges.map(function (e) {
      for (var t = 0; t < 60; t++) {
        var nested = rng.next() < o.nestShare;
        var persp = G === space && rng.next() < o.perspectiveShare;
        var p = makePremise(G, rng, o, e[0], e[1], rel(G, w, e[0], e[1]), nested, persp, anyPhrase && t > 20);
        if (p) return p;
      }
      return null;
    });
  }

  /**
   * Solve: from premises alone, the relation between X and Y, or null when
   * they are not linked (can't tell). Breadth-first over the premise graph,
   * composing each premise's relation along the path.
   */
  function solve(G, premises, X, Y) {
    var adj = {};
    premises.forEach(function (p) {
      var v = p.kind === "perspective" ? fromFrame(p.frame, p.facing) : G.op(G.op(G.inv(chainValue(G, p.a)), p.r), chainValue(G, p.b));
      (adj[p.X] = adj[p.X] || []).push({ to: p.Y, v: v });           /* X = v · Y */
      (adj[p.Y] = adj[p.Y] || []).push({ to: p.X, v: G.inv(v) });
    });
    /* pos[N] = rel(N, Y) */
    var pos = {}; pos[Y] = G.id();
    var queue = [Y];
    while (queue.length) {
      var cur = queue.shift();
      (adj[cur] || []).forEach(function (e) {
        /* e: cur = e.v · e.to  ⇒  rel(e.to, Y) = e.v⁻¹ · rel(cur, Y) */
        if (pos[e.to] !== undefined) return;
        pos[e.to] = G.op(G.inv(e.v), pos[cur]);
        queue.push(e.to);
      });
    }
    return pos[X] !== undefined ? pos[X] : null;
  }

  /** Every loop consistent? Recompute each premise from a spanning solve. */
  function consistent(G, premises, names) {
    var first = names[0];
    for (var i = 0; i < premises.length; i++) {
      var p = premises[i];
      var v = p.kind === "perspective" ? fromFrame(p.frame, p.facing) : G.op(G.op(G.inv(chainValue(G, p.a)), p.r), chainValue(G, p.b));
      var a = solve(G, premises, p.X, first), b = solve(G, premises, p.Y, first);
      if (a === null || b === null) continue;
      if (!G.eq(G.op(a, G.inv(b)), v)) return false;
    }
    return true;
  }

  function pathLength(edges, X, Y) {
    var adj = {};
    edges.forEach(function (e) { (adj[e[0]] = adj[e[0]] || []).push(e[1]); (adj[e[1]] = adj[e[1]] || []).push(e[0]); });
    var dist = {}; dist[X] = 0; var q = [X];
    while (q.length) { var c = q.shift(); (adj[c] || []).forEach(function (n) { if (dist[n] === undefined) { dist[n] = dist[c] + 1; q.push(n); } }); }
    return dist[Y] === undefined ? null : dist[Y];
  }

  /* ------------------------------------------------------------------ *
   * Lures                                                                *
   * ------------------------------------------------------------------ */

  /** The answer each mistake would give, for the relation X→Y across the path. */
  function lures(G, o, w, premises, X, Y) {
    var truth = rel(G, w, X, Y), out = [];
    function add(kind, v) {
      if (!v || G.eq(v, truth) || G.eq(v, G.id()) || !(G.say(v, o) || G.sayAny)) return;
      if (!out.some(function (l) { return G.eq(l.v, v); })) out.push({ kind: kind, v: v });
    }
    /* Misreadings of the nested premises: solve again as if each premise
       had been misread, one mistake at a time across all of them. */
    var MISREAD = {
      ignored: function (p) { return p.r; },
      dropLeft: function (p) { return G.op(p.r, chainValue(G, p.b)); },
      dropRight: function (p) { return G.op(G.inv(chainValue(G, p.a)), p.r); },
      sign: function (p) { return G.op(G.op(chainValue(G, p.a), p.r), G.inv(chainValue(G, p.b))); },
      order: function (p) { return G.op(G.op(G.inv(chainValue(G, p.a)), p.r), chainValue(G, p.b.slice().reverse())); },
    };
    Object.keys(MISREAD).forEach(function (kind) {
      if (kind === "order" && G.abelian) return;
      var nested = premises.filter(function (p) { return p.kind === "nested"; });
      if (!nested.length) return;
      var misread = premises.map(function (p) {
        if (p.kind !== "nested") return p;
        return { X: p.X, Y: p.Y, a: [], b: [], r: MISREAD[kind](p), kind: "plain" };
      });
      add(kind, solve(G, misread, X, Y));
    });
    /* Perspective read as if facing north. */
    var persp = premises.filter(function (p) { return p.kind === "perspective" && p.facing !== 0; });
    if (persp.length) {
      add("frame", solve(G, premises.map(function (p) {
        return p.kind === "perspective" ? { X: p.X, Y: p.Y, a: [], b: [], r: p.frame, kind: "plain" } : p;
      }), X, Y));
    }
    /* One step off, and the group's symmetries. */
    if (G.unit) { add("step", G.op(G.unit, truth)); add("step", G.op(G.inv(G.unit), truth)); }
    (G.symmetries || []).forEach(function (s) { add(s.id, s.f(truth)); });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Tasks                                                                *
   * ------------------------------------------------------------------ */

  /** Retry a generator until it returns something. */
  function attempt(fn, n) { for (var i = 0; i < (n || 200); i++) { var x = fn(); if (x) return x; } return null; }

  /**
   * "Is X r of Y?" Answer "yes", "no" or "cant".
   * About 40% yes, 40% no (a lure where one exists), 20% can't tell.
   */
  function questionTrial(G, rng, o) {
    return attempt(function () {
      var cantTell = rng.next() < 0.2;
      var w = treeWorld(G, rng, o, shuffle(rng, NAMES).slice(0, cantTell ? Math.max(4, o.objects) : o.objects)), edges = w.edges;
      var premises = premisesFor(G, rng, o, w, edges);
      if (premises.some(function (p) { return !p; })) return null;
      /* The pair joined by the longest path: the most premises to combine. */
      var best = null;
      w.names.forEach(function (a) { w.names.forEach(function (b) {
        if (a === b) return;
        var d = pathLength(edges, a, b);
        if (!best || d > best.d || (d === best.d && rng.next() < 0.5)) best = { a: a, b: b, d: d };
      }); });
      var X = best.a, Y = best.b, truth = rel(G, w, X, Y);
      var roll = cantTell ? 0 : 0.2 + rng.next() * 0.8, answer, asked, lureKind = null, shown = premises;
      if (cantTell) {
        /* Drop one premise on the X–Y path, splitting the objects into two
           groups of at least two, so X and Y both still appear somewhere. */
        var onPath = edges.map(function (e, i) { return i; }).filter(function (i) {
          var rest = edges.filter(function (_, j) { return j !== i; });
          if (pathLength(rest, X, Y) !== null) return false;
          var sideX = w.names.filter(function (n) { return pathLength(rest, X, n) !== null; }).length;
          return sideX >= 2 && w.names.length - sideX >= 2;
        });
        if (!onPath.length) return null;
        var drop = pick(rng, onPath);
        shown = premises.filter(function (_, j) { return j !== drop; });
        answer = "cant";
        var ls = lures(G, o, w, premises, X, Y);
        asked = rng.next() < 0.5 || !ls.length ? truth : pick(rng, ls).v;
      } else if (roll < 0.6) {
        answer = "yes"; asked = truth;
      } else {
        var lsN = lures(G, o, w, premises, X, Y);
        if (!lsN.length) return null;
        var misreads = lsN.filter(function (l) { return ["ignored", "dropLeft", "dropRight", "sign", "order", "frame"].indexOf(l.kind) >= 0; });
        var l = misreads.length && rng.next() < 0.7 ? pick(rng, misreads) : pick(rng, lsN);
        answer = "no"; asked = l.v; lureKind = l.kind;
      }
      var phrase = G.say(asked, o) || (G.sayAny && G.sayAny(asked));
      if (!phrase) return null;
      return {
        task: "question", material: G.name, world: w, premises: shuffle(rng, shown), X: X, Y: Y,
        truth: truth, asked: asked, answer: answer, lure: lureKind,
        pathLength: best.d, question: G.question(G.base(X), phrase, G.base(Y)),
      };
    });
  }

  /** "Is this description possible?" One or two loops; impossible when one premise is altered. */
  function possibleTrial(G, rng, o) {
    return attempt(function () {
      var w = treeWorld(G, rng, o, shuffle(rng, NAMES).slice(0, Math.max(3, o.objects))), edges = w.edges;
      /* One or two extra links close loops: pairs whose relation can be said. */
      var extra = [], loops = o.level >= 10 ? 2 : 1;
      var linked = function (a, b) { return edges.concat(extra).some(function (e) { return (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a); }); };
      for (var k = 0; k < loops; k++) {
        var pairs = [];
        w.names.forEach(function (a) { w.names.forEach(function (b) {
          if (a < b && !linked(a, b)) pairs.push([a, b]);
        }); });
        if (!pairs.length) return null;
        extra.push(pick(rng, pairs));
      }
      var all = edges.concat(extra), premises = premisesFor(G, rng, o, w, edges).concat(premisesFor(G, rng, o, w, extra, true));
      if (premises.some(function (p) { return !p; })) return null;
      var possible = rng.next() < 0.5, altered = null;
      if (!possible) {
        /* Alter a premise inside a loop: re-say it with a slightly wrong relation. */
        var i = edges.length + int(rng, 0, extra.length - 1);
        if (rng.next() < 0.5) i = int(rng, 0, edges.length - 1);
        var p = premises[i];
        var wrong = attempt(function () {
          var bad = G.unit && rng.next() < 0.6 ? G.op(rng.next() < 0.5 ? G.unit : G.inv(G.unit), p.v) : pick(rng, G.symmetries).f(p.v);
          if (G.eq(bad, p.v)) return null;
          /* A premise asserting `bad` between the same two objects. */
          var q = makePremise(G, rng, o, p.X, p.Y, bad, p.kind === "nested", p.kind === "perspective", true);
          return q;
        }, 60);
        if (!wrong) return null;
        premises[i] = wrong; altered = i;
        if (consistent(G, premises, w.names)) return null;   /* the change must break a loop */
      } else if (!consistent(G, premises, w.names)) return null;
      return { task: "possible", material: G.name, world: w, premises: shuffle(rng, premises), answer: possible ? "possible" : "impossible", altered: altered };
    });
  }

  /** How many steps apart? Space (Manhattan or king's moves) and numbers. */
  function howfarTrial(G, rng, o, metric) {
    if (!G.metric) return null;
    return attempt(function () {
      var q = questionTrial(G, rng, o);
      if (!q || q.answer === "cant") return null;
      var d = G.metric(q.truth, metric);
      if (!d) return null;
      var ls = lures(G, o, q.world, q.premises, q.X, q.Y).map(function (l) { return G.metric(l.v, metric); });
      var options = [d];
      ls.concat([d + 1, d - 1, d + 2]).forEach(function (x) { if (x > 0 && options.indexOf(x) < 0 && options.length < 4) options.push(x); });
      if (options.length < 3) return null;
      return { task: "howfar", material: G.name, world: q.world, premises: q.premises, X: q.X, Y: q.Y, truth: q.truth,
        answer: String(d), options: shuffle(rng, options).map(String), metric: metric,
        question: G === space
          ? "How many " + (metric === "king" ? "king's moves (diagonal steps count as one)" : "steps along the grid (no diagonals)") + " apart are " + q.X + " and " + q.Y + "?"
          : "How far apart are " + q.X + " and " + q.Y + "?" };
    });
  }

  /**
   * Structure n-back: a stream of arrangements of the same objects. Builds the
   * whole round: each item has an arrangement, a description and, from n on,
   * whether it matches the one n back (exactly, or up to rotation).
   */
  function nbackRound(G, rng, o, n, count, upToRotation) {
    var names = shuffle(rng, NAMES).slice(0, o.objects), items = [];
    var ROT = (G.symmetries || []).filter(function (s) { return s.rotation; });
    function same(w1, w2) {
      var base = names[0];
      function rels(w, f) { return names.map(function (nm) { return f(rel(G, w, nm, base)); }); }
      var fs = [function (v) { return v; }];
      if (upToRotation) ROT.forEach(function (s) { fs.push(s.f); });
      var target = rels(w2, function (v) { return v; });
      return fs.some(function (f) { var mine = rels(w1, f); return mine.every(function (v, i) { return G.eq(v, target[i]); }); });
    }
    function describe(w) {
      return attempt(function () {
        var ps = premisesFor(G, rng, o, w, w.edges && rng.next() < 0.5 ? w.edges : tree(rng, w.names));
        return ps.some(function (p) { return !p; }) ? null : ps;
      }, 40);
    }
    var guard = 0;
    for (var i = 0; i < count; i++) {
      if (guard++ > count * 60) throw new Error("n-back: could not build a round at this level");
      var w, kind = "plain", back = i >= n ? items[i - n].world : null;
      var roll = rng.next();
      if (back && roll < 0.4) {
        kind = "match";
        /* The same arrangement, slid (and turned, if rotation counts). */
        var shift = G.random(rng, o), turn = upToRotation && ROT.length && rng.next() < 0.6 ? pick(rng, ROT) : null;
        w = { names: names, vals: {} };
        names.forEach(function (nm) { var v = back.vals[nm]; if (turn) v = turn.f(v); w.vals[nm] = G.op(v, shift); });
      } else if (back && roll < 0.75) {
        var kinds = [];
        (G.symmetries || []).forEach(function (s) { if (!(upToRotation && s.rotation)) kinds.push(s); });
        kinds.push({ id: "swap" }); if (G.unit) kinds.push({ id: "step" });
        var k = pick(rng, kinds);
        w = { names: names, vals: {} };
        names.forEach(function (nm) { w.vals[nm] = back.vals[nm]; });
        if (k.id === "swap") {
          var s2 = shuffle(rng, names).slice(0, 2), t = w.vals[s2[0]]; w.vals[s2[0]] = w.vals[s2[1]]; w.vals[s2[1]] = t;
        } else if (k.id === "step") {
          var one = pick(rng, names); w.vals[one] = G.op(rng.next() < 0.5 ? G.unit : G.inv(G.unit), w.vals[one]);
        } else names.forEach(function (nm) { w.vals[nm] = k.f(w.vals[nm]); });
        kind = k.id;
      } else {
        w = treeWorld(G, rng, o, names);
      }
      var target = back ? same(w, back) : null;
      if (back && kind !== "match" && target) { i--; continue; }    /* a lure that happens to match: redraw */
      if (back && kind === "plain" && target) { i--; continue; }
      var ps = describe(w);
      if (!ps) { i--; continue; }
      items.push({ world: w, premises: shuffle(rng, ps), target: target, kind: back ? kind : null });
    }
    return { task: "nback", material: G.name, n: n, names: names, items: items, upToRotation: !!upToRotation };
  }

  /* ------------------------------------------------------------------ *
   * Compact notation                                                     *
   * ------------------------------------------------------------------ */
  /*
   * The shortest form of every sentence, learned from the guide rather than
   * read off: objects are letters (Gold is O, for "or"), a premise is the
   * equation a·X = r·b·Y written as "Xa=Ybr", and every element is written
   * in its group's shortest code:
   *
   *   space    keypad digits, one per step: 8 N, 9 NE, 6 E, 3 SE, 2 S, 1 SW,
   *            4 W, 7 NW. "R6=B4488": one east of Red is two west and two
   *            north of Blue. Diagonals first, then straight steps.
   *            Perspective: "R=B@2<<" from B facing 2 (south), R is two to the
   *            left; ^ ahead, v behind, < left, > right.
   *   numbers  signed steps: "R+2=B-7+5".
   *   notes, days, headings  the same, mod 12, 7 or 8 (a heading step is
   *            45°, clockwise positive); each wraps to its shortest value.
   *   square   one letter per operation, applied left to right: q a quarter
   *            right, Q a quarter left, h half way, m mirror left-right,
   *            M mirror top-bottom, d the rising diagonal, D the falling one.
   *            "R=Bmq": Red is Blue mirrored, then turned a quarter right.
   */
  var LETTER = { Red: "R", Blue: "B", Green: "G", Gold: "O", Violet: "V", White: "W" };
  var KEYPAD = { "0,1": "8", "1,1": "9", "1,0": "6", "1,-1": "3", "0,-1": "2", "-1,-1": "1", "-1,0": "4", "-1,1": "7" };
  var D4_LETTER = { "1,0": "q", "2,0": "h", "3,0": "Q", "0,1": "m", "2,1": "M", "1,1": "d", "3,1": "D", "0,0": "" };
  var MODS = { notes: 12, days: 7, compass: 8 };
  var DIGIT = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  var D4_SPOKEN = { q: "quarter", Q: "quarter back", h: "half", m: "mirror", M: "flip", d: "diagonal", D: "other diagonal" };
  /* Code and its spoken form, built together from the same pieces. */
  function code(G, g) { return codeTok(G, g).t; }
  function codeTok(G, g) {
    if (G === space) {
      var x = g[0], y = g[1], sx = Math.sign(x), sy = Math.sign(y), d = Math.min(Math.abs(x), Math.abs(y)), out = "";
      for (var i = 0; i < d; i++) out += KEYPAD[sx + "," + sy];
      for (i = 0; i < Math.abs(x) - d; i++) out += KEYPAD[sx + ",0"];
      for (i = 0; i < Math.abs(y) - d; i++) out += KEYPAD["0," + sy];
      return { t: out, s: out.split("").map(function (c) { return DIGIT[c]; }).join(" ") };
    }
    if (G === square) { var l = D4_LETTER[g[0] + "," + g[1]]; return { t: l, s: l ? D4_SPOKEN[l] : "" }; }
    var n = MODS[G.name], v = g;
    if (n) { v = mod(v, n); if (v > n / 2) v -= n; }
    if (!v) return { t: "", s: "" };
    return { t: (v > 0 ? "+" : "−") + Math.abs(v), s: (v > 0 ? "plus " : "minus ") + Math.abs(v) };
  }
  function obj(name) { return { t: LETTER[name] || name, s: name }; }
  function join(parts) {
    return { t: parts.map(function (p) { return p.t; }).join(""), s: parts.map(function (p) { return p.s; }).filter(Boolean).join(" ") };
  }
  function cTermTok(G, name, chain) { return join([obj(name)].concat(chain.map(function (c) { return codeTok(G, c); }))); }
  function cHeader(G) { return MODS[G.name] ? "mod " + MODS[G.name] : null; }
  /* ------------------------------------------------------------------ *
   * The ear code: compact notation as it is spoken                      *
   * ------------------------------------------------------------------ */
  /*
   * Made to be held by ear with the eyes closed: every word one or two
   * syllables, and no word with two meanings. It is a word-for-word reading
   * of the compact code, so each spoken line stands for exactly one written
   * one (test/algebra.test.js reads every spoken line back).
   *
   *   objects    Red Blue Green Gold Violet White
   *   =          is
   *   marks      Fox Jar Key Lamp Moon Nest Oak Pond Rope Sun Tent Cup Drum
   *              Hat Kite, for P S T U X Y Z A C E F J K L N; "big" in front
   *              for each doubling (PP is "big Fox")
   *   space      keypad digits as words; a run of two is "double", three
   *              "triple", four "quad", more "<n> times": "666944" is
   *              "triple six nine double four"
   *   @k         face <digit>; then front, back, left, right, with runs as
   *              above: "@4vvv>>>" is "face four triple back triple right"
   *   +n −n      up n, down n
   *   q Q h      right, left, half (quarter turns and a half turn)
   *   m M d D    mirror, flip, rise, fall
   *   questions  "R=B6?" is "Is Red Blue six?"; "∃?" "Possible?";
   *              "|R−B|₁?" "Red to Blue, grid?" (∞ king; numbers none);
   *              "≡3?" "Same as 3 back?"; "≅3?" "Same as 3 back, any turn?";
   *              "⊢1/3" "Hold, 1 of 3"
   */
  var EAR_OBJ = { R: "Red", B: "Blue", G: "Green", O: "Gold", V: "Violet", W: "White" };
  var EAR_MARK = ["Fox", "Jar", "Key", "Lamp", "Moon", "Nest", "Oak", "Pond", "Rope", "Sun", "Tent", "Cup", "Drum", "Hat", "Kite"];
  var EAR_OP = { q: "right", Q: "left", h: "half", m: "mirror", M: "flip", d: "rise", D: "fall" };
  var EAR_DIR = { "^": "front", v: "back", "<": "left", ">": "right" };
  var EAR_RUN = ["", "", "double", "triple", "quad"];
  function earRuns(words) {
    var out = [];
    for (var i = 0; i < words.length;) {
      var j = i; while (j < words.length && words[j] === words[i]) j++;
      var n = j - i;
      out.push(n === 1 ? words[i] : (EAR_RUN[n] || DIGIT[n] || String(n)) + (n > 4 ? " times " : " ") + words[i]);
      i = j;
    }
    return out.join(" ");
  }
  /** One side of a premise, "W1166" or "PP99" or "O+1−5", as spoken. */
  function earTerm(t) {
    var m = t.match(/^([RBGOVW]|([PSTUXYZACEFJKLN])\2*)(.*)$/);
    if (!m) throw new Error("not a term: " + t);
    var head = EAR_OBJ[m[1]] || (new Array(m[1].length).join("big ") + EAR_MARK[MARKS.indexOf(m[1][0])]);
    var rest = m[3], words = [];
    var pm = rest.match(/^@(\d)(.*)$/);
    if (pm) return head + " face " + DIGIT[pm[1]] + (pm[2] ? " " + earRuns(pm[2].split("").map(function (c) { return EAR_DIR[c]; })) : "");
    if (/^[+−]/.test(rest)) return head + " " + rest.match(/[+−]\d+/g).map(function (x) { return (x[0] === "+" ? "up " : "down ") + x.slice(1); }).join(" ");
    if (/^\d/.test(rest)) words = rest.split("").map(function (c) { return DIGIT[c]; });
    else if (rest) words = rest.split("").map(function (c) { return EAR_OP[c]; });
    return words.length ? head + " " + earRuns(words) : head;
  }
  /** A line of compact code, spoken. */
  function ear(line) {
    line = String(line);
    var m;
    if ((m = line.match(/^mod (\d+)$/))) return "mod " + m[1];
    if (line === "∃?") return "Possible?";
    if ((m = line.match(/^\|([RBGOVW])−([RBGOVW])\|([₁∞]?)\?$/))) return EAR_OBJ[m[1]] + " to " + EAR_OBJ[m[2]] + (m[3] === "₁" ? ", grid" : m[3] === "∞" ? ", king" : "") + "?";
    if ((m = line.match(/^([≡≅])(\d+)\?$/))) return "Same as " + m[2] + " back" + (m[1] === "≅" ? ", any turn" : "") + "?";
    if ((m = line.match(/^⊢(\d+)\/(\d+)$/))) return "Hold, " + m[1] + " of " + m[2];
    var q = /\?$/.test(line), sides = line.replace(/\?$/, "").split("=");
    if (sides.length !== 2) throw new Error("not a line: " + line);
    if (q) { var r = earTerm(sides[1]); return "Is " + earTerm(sides[0]) + " " + r + "?"; }
    return earTerm(sides[0]) + " is " + earTerm(sides[1]);
  }
  /* Mark letters: none an object's letter, none an operation's. */
  var MARKS = "PSTUXYZACEFJKLN";
  /**
   * The description in code. Returns the lines; `.spoken` holds the same
   * lines as they are read aloud.
   */
  function renderCompact(G, o, premises, style, rng) {
    var out = [], markNo = 0;
    var h = cHeader(G); if (h) out.push({ t: h, s: "mod " + MODS[G.name] });
    /* After the fifteenth, letters double (PP, SS, …): never a digit, which
       would read as a step. */
    function nextMark() { var k = markNo++; return new Array(Math.floor(k / MARKS.length) + 2).join(MARKS[k % MARKS.length]); }
    function term(name, chain, useMarks) {
      if (!useMarks || chain.length < 2) return cTermTok(G, name, chain);
      var cur = obj(name);
      chain.forEach(function (c) {
        var m = nextMark();
        out.push(join([{ t: m, s: m }, { t: "=", s: "is" }, cur, codeTok(G, c)]));
        cur = { t: m, s: m };
      });
      return cur;
    }
    premises.forEach(function (p) {
      var useMarks = style === "marks" || (style === "mixed" && rng.next() < 0.5);
      if (p.kind === "perspective") {
        var f = p.frame, t = "", sp = [];
        for (var i = 0; i < Math.abs(f[1]); i++) { t += f[1] > 0 ? "^" : "v"; sp.push(f[1] > 0 ? "ahead" : "back"); }
        for (i = 0; i < Math.abs(f[0]); i++) { t += f[0] > 0 ? ">" : "<"; sp.push(f[0] > 0 ? "right" : "left"); }
        var k = KEYPAD[COMPASS[p.facing].v[0] + "," + COMPASS[p.facing].v[1]];
        out.push(join([obj(p.X), { t: "=", s: "is" }, obj(p.Y), { t: "@" + k, s: "facing " + DIGIT[k] }, { t: t, s: sp.join(" ") }]));
        return;
      }
      var L = term(p.X, p.a, useMarks), R = term(p.Y, p.b, useMarks);
      out.push(join([L, { t: "=", s: "is" }, R, codeTok(G, p.r)]));
    });
    var lines = out.map(function (x) { return x.t; });
    lines.spoken = lines.map(ear);
    return lines;
  }
  /** The meaning of a relation, X = v·Y, in code. */
  function cMeaning(G, X, v, Y) { return (LETTER[X] || X) + "=" + (LETTER[Y] || Y) + code(G, v); }
  /** The question in code, with `.spoken`. */
  function cQuestion(t, G, metric) {
    var q, sp;
    if (t.task === "question") { var j = join([obj(t.X), { t: "=", s: "is" }, obj(t.Y), codeTok(G, t.asked)]); q = j.t + "?"; sp = j.s + "?"; }
    else if (t.task === "possible") { q = "∃?"; sp = "possible?"; }
    else if (t.task === "howfar") {
      var mk = G === space ? (metric === "king" ? "∞" : "₁") : "";
      q = "|" + LETTER[t.X] + "−" + LETTER[t.Y] + "|" + mk + "?";
      sp = "distance " + t.X + " " + t.Y + (G === space ? (metric === "king" ? ", king" : ", grid") : "") + "?";
    }
    var r = new String(q); r.spoken = ear(q); return r;
  }

  return {
    GROUPS: GROUPS, NAMES: NAMES, Rng: Rng, difficulty: difficulty,
    render: render, meaning: meaning, solve: solve, consistent: consistent, lures: lures, rel: rel,
    chainValue: chainValue, toFrame: toFrame, fromFrame: fromFrame,
    questionTrial: questionTrial, possibleTrial: possibleTrial, howfarTrial: howfarTrial, nbackRound: nbackRound,
    code: code, ear: ear, EAR_MARK: EAR_MARK, renderCompact: renderCompact, cMeaning: cMeaning, cQuestion: cQuestion, LETTER: LETTER, MARKS: MARKS,
  };
});

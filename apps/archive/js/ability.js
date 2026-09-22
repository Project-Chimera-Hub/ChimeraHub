"use strict";

/* ============================================================
   THE ABILITY ESTIMATE
   ============================================================

   One position on one ladder, out of every trainer at once.

   **This is the one thing in the archive that crosses units, and it is built to
   be honest about it.** Everywhere else the rule is absolute: a difficulty
   never leaves the scale it was measured on, because an RNB load of 63 and a
   Syllogimous level of 13 sit on no shared axis and a schema that implied one
   would manufacture findings. Nothing here repeals that. What it adds is an
   *external* ladder — six tiers, α to ζ, from the Guanxinandu S11 benchmark —
   and a per-source table saying what each trainer's own number has to be to
   stand on each rung of it.

   The distinction is the whole argument for this file existing:

     - Comparing two trainers' numbers directly is inventing an axis.
     - Reading each trainer's number against a *third party's* published
       requirement for that same trainer is not. The benchmark already did the
       comparing, in public, for people to disagree with. This only looks up
       what it said.

   So there is exactly one place in this project where the cross-source mapping
   lives — `LADDERS`, below — every entry of it is a citation or a stated
   extrapolation, and every number on the screen can be traced back to one row
   of it. That is a very different thing from a mean of eight difficulties.

   ------------------------------------------------------------------

   The benchmark, as published (discord.gg/brain, season 11):

     tier   relational reasoning        quad n-back    relational n-back
     α      Space 2D,  6 premises       Quad 3-back    character+position 2-back
     β      Space 3D,  6 premises       Quad 4-back    character+position 3-back
     γ      Space 5D,  6 premises       Quad 5-back    character+position 4-back
     δ      Space 6D,  6 premises       Quad 6-back    character+position 5-back
     ε      Space 7D,  6 premises       Quad 7-back    character+position 6-back
     ζ      (unset)                     Quad 8-back    character+position 7-back

   with three rules: every mode has to be held at **75%** to count, the
   reasoning column is measured over 55 questions, and the n-back columns over
   10 rounds. All three are implemented rather than paraphrased — see
   `TIER_ACCURACY`, `MIN_ITEMS` and `MIN_BLOCKS`.

   ------------------------------------------------------------------

   **Two numbers come out, and they answer different questions.**

   `level` is the estimate: a weighted position across every trainer with a
   ladder, which is what "roughly where am I" means when eight programs disagree
   and some of them have not been opened in a month.

   `badge` is the benchmark's own verdict, which is conjunctive — *all* modes at
   75%, so the tier is the weakest of its three columns and nothing else. It is
   kept separate rather than folded in, because a mean and a minimum are not
   approximations of each other: the mean says what you can mostly do, the
   minimum says what you have earned. Reporting either alone would be answering
   the other question quietly.
*/

/* global addDays, daysBetween */
var INS = (typeof module !== "undefined" && typeof require === "function")
  ? require("./insight.js") : null;
var _addDays = INS ? INS.addDays : function (d, n) { return addDays(d, n); };
var _daysBetween = INS ? INS.daysBetween : function (a, b) { return daysBetween(a, b); };

/** The benchmark's rungs, in order. Index 0 is α. */
var TIERS = ["α", "β", "γ", "δ", "ε", "ζ"];

/** Rule 1: nothing counts below this. The benchmark's own bar, not ours. */
var TIER_ACCURACY = 0.75;

/*
 * Rules 2 and 3: how much of a thing has to be behind a claim.
 *
 * 55 questions and 10 rounds are what the benchmark measures over, so they are
 * what a claim against it needs. Halved for the reasoning column and slightly
 * loosened for the rounds, because the benchmark counts one sitting and this
 * counts a window of them — a run of short evenings is more evidence than a
 * single 55, not less, and demanding 55 in one file would refuse most real
 * records for the wrong reason.
 */
var MIN_ITEMS = 30;      // per-item sources: Syllogimous
var MIN_BLOCKS = 8;      // per-block sources: every n-back here

/* ------------------------------------------------------------------ *
 * The ladders                                                         *
 * ------------------------------------------------------------------ */

/**
 * What each trainer's own difficulty has to read at each tier.
 *
 * Keyed by **unit**, not by source, for the reason every other reader here is:
 * a source can change what it measures, and a number under the old unit must
 * never be looked up in the new unit's table. Syllogimous is the live case —
 * `syllogimous-premises` deliberately has no entry, so pre-level records
 * contribute nothing rather than being read against a ladder built for levels.
 *
 * Three of these are the benchmark's own rows, priced through the app's own
 * difficulty function. The rest are not in the benchmark at all, and say so.
 */
var LADDERS = {

  /*
   * ---- Syllogimous: the benchmark's reasoning column, priced by the app ----
   *
   * `syllogimous-level` is `levelOf`, which is what the app charges an item
   * and what its ability model is stated in — so the benchmark's requirement
   * can be priced rather than guessed at. Each row is "6 premises of this
   * mode, no rungs claimed, no clock", which is `MODE_SCALE[mode].weight * 6`:
   *
   *     α  Space 2D = Direction  1.15 x 6 =  6.9
   *     β  Space 3D              1.35 x 6 =  8.1
   *     γ  Space 5D              1.90 x 6 = 11.4
   *     δ  Space 6D              2.20 x 6 = 13.2
   *     ε  Space 7D              2.40 x 6 = 14.4
   *
   * The α row names Linear and Distinction alongside Space 2D, and those price
   * at 1.0 x 6 = 6.0. The rule is conjunctive — every mode at 75% — so the row
   * is worth its *hardest* member and the easier two are not what gates it.
   *
   * ζ is the benchmark's own `???`: the other two columns step by one n-back,
   * and Syllogimous has no eighth axis to step to, so the last gap is repeated.
   * Marked as the extrapolation it is.
   *
   * Scramble is not priced. The benchmark asks for 80% of it and `levelOf` has
   * no term for premise order — the app treats it as presentation. Rather than
   * invent a coefficient for one lookup table, it is left out and said so here.
   */
  "syllogimous-level": {
    anchors: [6.9, 8.1, 11.4, 13.2, 14.4, 15.6],
    from: "benchmark",
    note: "6 premises of Space 2D/3D/5D/6D/7D, priced by the app's own levelOf",
  },

  /*
   * ---- Relational N-back: the benchmark's third column, priced by the app ----
   *
   * `computeLoad` for character + position at N, in the cube frame at the
   * default interval: 10N for the lag, +9 for position judged relationally,
   * +4 for the glyph stream as an identity judgement. Nothing else applies —
   * the 3D grid is the default rather than the +12 fourth dimension, the cube
   * frame is the one charged nothing, and 2500ms is where the interval term
   * is zero.
   *
   *     load = 10N + 13,  N = 2..7  ->  33, 43, 53, 63, 73, 83
   */
  "rnb-load": {
    anchors: [33, 43, 53, 63, 73, 83],
    from: "benchmark",
    note: "character+position at 2..7-back, priced by the app's own computeLoad",
  },

  /*
   * ---- Quad N-back: the benchmark's middle column, read as N ----
   *
   * Quad 3-back through Quad 8-back, and both of these trainers record the N
   * they reached. Precision N-back is the quad proper — position, tone, colour
   * and shape — and eWMT is the same axis with its own channels.
   *
   * What neither ladder carries is the rest of each app's difficulty. Precision
   * holds N and tightens its per-modality thresholds instead, and a threshold
   * that has halved is a real gain sitting at the same N; eWMT's channel count
   * moves too. Both are in `raw` and neither is read here, so this ladder
   * understates a player who got better without moving N. It is the benchmark's
   * own axis, and the benchmark only ever asked about N.
   */
  "precision-n": {
    anchors: [3, 4, 5, 6, 7, 8],
    from: "benchmark",
    note: "the quad n-back column, read as N — thresholds are not on this axis",
  },
  "ewmt-n": {
    anchors: [3, 4, 5, 6, 7, 8],
    from: "benchmark",
    note: "the quad n-back column, read as N",
  },

  /*
   * ---- Everything below here is NOT in the benchmark ----
   *
   * Four trainers the benchmark never ranked. Leaving them out would be the
   * tidier choice and the wrong one: they are training, they are in the record,
   * and an estimate that ignored half the archive would drift from it every
   * time the week's work went somewhere unranked.
   *
   * So each one is aligned **ordinally** onto the same six steps, from the
   * app's own starting point to the app's own floor or cap — the numbers its
   * settings already name, not numbers chosen here. That is a real statement
   * (α is where this trainer starts you, ζ is where it runs out) and it is not
   * a claim that ζ on this ladder is as hard as ζ on a benchmarked one. Nobody
   * measured that, which is exactly why these carry less weight below.
   */

  /*
   * CCT adapts speed at a fixed N, so its ladder is its own interval range:
   * the default start of 1500ms down to the default floor of 500ms, in five
   * equal ratio steps, carried as the items-per-minute the adapter stores.
   */
  "cct-peak-items-per-min": {
    anchors: [40, 50, 62, 77, 96, 120],
    from: "stretched",
    note: "the app's own 1500ms start to its 500ms floor, in equal ratio steps",
  },

  /*
   * Running Order's own ladder is eleven rungs of d x log2(s) carried bits.
   * Every other rung is taken, and each is priced at the 800ms floor a player
   * has to reach before the rung moves at all — so a tier here is "cleared that
   * rung", in the throughput the adapter records.
   */
  "rrt-peak-bits-per-s": {
    anchors: [2.0, 2.9, 3.5, 5.0, 5.9, 8.7],
    from: "stretched",
    note: "every other rung of the app's own 11-rung ladder, at its 800ms floor",
  },

  /*
   * The rotation trainer's level is its own, and it saturates: past level 10
   * the only thing that grows is how many blocks a shape has, and that is
   * capped. So the six tiers span the part of the ladder that still moves.
   */
  "rotation-level": {
    anchors: [1, 2, 4, 6, 8, 10],
    from: "stretched",
    note: "the app's own level, which stops discriminating past 10",
  },

  /*
   * Synth pins accuracy and moves the window, so its ladder is the window's own
   * range: the core modes' 3400ms starting unit down to their 250ms floor, in
   * five equal ratio steps, as the symbols per minute the adapter inverts it to.
   */
  "synth-symbols-per-min": {
    anchors: [18, 30, 50, 84, 141, 237],
    from: "stretched",
    note: "the app's own 3400ms starting window to its 250ms floor",
  },
};

/**
 * How much each source moves the estimate, before evidence and staleness.
 *
 * **Syllogimous and Relational N-back carry it**, at three times anything else
 * and six times the narrowest. Three reasons, and they agree:
 *
 *   - They are two of the benchmark's three columns, so their ladders are
 *     citations rather than alignments.
 *   - They are the only two trainers here that estimate ability themselves —
 *     Syllogimous keeps a posterior per mode on the scale `levelOf` prices, RNB
 *     runs a QUEST-style posterior over its threshold — so their difficulty
 *     numbers are already a measurement rather than a session's high-water mark.
 *   - They are the two broadest tasks in the archive. Relational reasoning and
 *     relational n-back are what the benchmark is about; the rest of this list
 *     is narrower, and a narrow task can be trained to a high rung without
 *     moving anything the benchmark ranks.
 *
 * Precision and eWMT follow because they are on the benchmark's own quad axis.
 * Running Order and CCT are real throughput measures the benchmark never
 * priced. Rotation and Synth are single-faculty trainers — genuine skills, and
 * the furthest from what this ladder ranks.
 *
 * A source with a ladder and no entry here gets `DEFAULT_WEIGHT`, so adding an
 * adapter does not silently add a heavyweight.
 */
var SOURCE_WEIGHT = {
  syllogimous: 3,
  rnb: 3,
  precision: 1.25,
  ewmt: 1,
  rrt: 0.9,
  cct: 0.75,
  rotation: 0.6,
  synth: 0.4,
};

var DEFAULT_WEIGHT = 0.5;

/** How far back a claim about what you can do *now* may reach. */
var WINDOW_DAYS = 180;

/**
 * How fast a source stops speaking for you.
 *
 * Halving every three months, on days since it was last trained. Not a cliff:
 * a trainer left alone for a month is still evidence, and one left alone for a
 * year is nearly none. The window above is the hard stop; this is the slope
 * inside it.
 */
var HALF_LIFE_DAYS = 90;

/**
 * Sample size at which a source is trusted half as much as it ever will be.
 *
 * `n / (n + 20)`: twenty scored sittings is half, a hundred is 0.83, and it
 * never reaches 1. A source cannot buy its way to certainty by volume, which
 * matters because the cheapest trainer here to rack up sessions in is not the
 * one that says most about ability.
 */
var EVIDENCE_HALF = 20;

/**
 * The benchmark's three columns, and which sources speak for each.
 *
 * Only used by `badge` — the strict conjunctive verdict. A column with two
 * sources takes the better of them: either one demonstrates the column's skill,
 * and the benchmark asks for the skill rather than for a particular website.
 */
var COLUMNS = [
  { name: "Relational reasoning", sources: ["syllogimous"] },
  { name: "Quad N-back", sources: ["precision", "ewmt"] },
  { name: "Relational N-back", sources: ["rnb"] },
];

/* ------------------------------------------------------------------ *
 * The ladder lookup                                                   *
 * ------------------------------------------------------------------ */

/**
 * Where a difficulty sits on the tier axis: 0 is α, 5 is ζ, and the gaps are
 * linear in between.
 *
 * Continuous rather than a rung, because a rung thrown away is a month of work
 * made invisible — the whole climb from β to γ would report as β until the day
 * it reported as γ. The page rounds for the badge and shows the fraction.
 *
 * Off both ends it extrapolates on the nearest gap, bounded one tier either
 * side: below α is a real place to be and so is past ζ, but an estimate four
 * tiers past the top of a published ladder is not a measurement, it is a
 * straight line run out of evidence.
 */
function tierOf(unit, difficulty) {
  var ladder = LADDERS[unit];
  if (!ladder || difficulty == null || !isFinite(difficulty)) return null;
  var a = ladder.anchors;
  var top = a.length - 1;

  if (difficulty <= a[0]) {
    return Math.max(-1, (difficulty - a[0]) / (a[1] - a[0]));
  }
  for (var i = 1; i <= top; i++) {
    if (difficulty <= a[i]) {
      return (i - 1) + (difficulty - a[i - 1]) / (a[i] - a[i - 1]);
    }
  }
  return Math.min(top + 1, top + (difficulty - a[top]) / (a[top] - a[top - 1]));
}

/** The tier a position stands on, as a name — "β", "below α", "past ζ". */
function tierLabel(level) {
  if (level == null) return null;
  if (level < 0) return "below " + TIERS[0];
  var i = Math.floor(level);
  if (i >= TIERS.length) return "past " + TIERS[TIERS.length - 1];
  return TIERS[i];
}

/* ------------------------------------------------------------------ *
 * What a source has actually demonstrated                             *
 * ------------------------------------------------------------------ */

/**
 * The hardest difficulty a source was held at 75% across, in its own unit.
 *
 * **This is the benchmark's rule implemented rather than approximated**, and it
 * is why the estimate is not simply a peak or a mean:
 *
 *   - A *peak* is the one lucky block. Every trainer here adapts upward until
 *     it fails, so every record contains a peak nobody could repeat, and an
 *     estimate built on one is an estimate of somebody's best evening in six
 *     months.
 *   - A *mean* is dragged down by warm-ups, by the easy end of a staircase, and
 *     by whatever the controller served while it was re-finding you after a
 *     break. It answers "what were you mostly given", not "what can you hold".
 *
 * So: sort the window's scored sittings hardest first, and walk down until the
 * run from the top clears 75%. The difficulty where that first happens is the
 * answer — everything at or above it was held at the benchmark's bar, which is
 * exactly what the benchmark asks. A prefix is only considered where it ends on
 * a change of difficulty, so a tie is never cut through the middle.
 *
 * Null when no prefix long enough ever clears it. That is not a gap to paper
 * over with the best available number: it means this trainer has not recently
 * shown 75% anywhere, and the page says so by name.
 */
function demonstrated(rows, minRows) {
  var scored = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].difficulty != null && rows[i].correct != null) scored.push(rows[i]);
  }
  if (scored.length < minRows) {
    return { difficulty: null, n: 0, of: scored.length, short: true };
  }

  scored.sort(function (a, b) { return b.difficulty - a.difficulty; });

  var sum = 0;
  for (var j = 0; j < scored.length; j++) {
    sum += scored[j].correct;
    if (j + 1 < minRows) continue;
    // Only at a difficulty boundary, so the threshold means what it says.
    if (j + 1 < scored.length && scored[j + 1].difficulty === scored[j].difficulty) continue;
    if (sum / (j + 1) >= TIER_ACCURACY) {
      return {
        difficulty: scored[j].difficulty,
        accuracy: sum / (j + 1),
        n: j + 1,
        of: scored.length,
        short: false,
      };
    }
  }
  return { difficulty: null, n: 0, of: scored.length, short: false };
}

/* ------------------------------------------------------------------ *
 * The estimate                                                        *
 * ------------------------------------------------------------------ */

/** Records of one source inside the window, grouped by the unit they use. */
function windowRows(archive, source, from, to) {
  var byUnit = {};
  for (var i = 0; i < archive.records.length; i++) {
    var r = archive.records[i];
    if (r.source !== source) continue;
    if (r.day < from || r.day > to) continue;
    (byUnit[r.unit || ""] || (byUnit[r.unit || ""] = [])).push(r);
  }
  return byUnit;
}

/**
 * Which of a source's units to read it on: the one with a ladder and the most
 * records behind it.
 *
 * A source mid-changeover has two, and only one of them can be looked up. Where
 * both could be, the larger sample wins — the same call `sourceSummary` makes
 * about which unit a source is "in".
 */
function bestUnit(byUnit) {
  var best = null;
  for (var unit in byUnit) {
    if (!Object.prototype.hasOwnProperty.call(byUnit, unit)) continue;
    if (!LADDERS[unit]) continue;
    if (!best || byUnit[unit].length > byUnit[best].length) best = unit;
  }
  return best;
}

/**
 * Why a source's windowed records fit no ladder, in its own terms.
 *
 * Two different silences and the page should not blur them. A source with
 * units nobody has a ladder for is a gap in this table — Syllogimous's premise
 * counts are the live case, and a ladder for them is a decision somebody could
 * make. A source with no unit at all records no difficulty **on purpose**, as
 * Anki does, and there is nothing to build a ladder out of.
 */
function noLadderReason(byUnit) {
  var units = Object.keys(byUnit).filter(function (u) { return u; });
  if (!units.length) return "records no difficulty, so there is nothing to place";
  return "no tier ladder for " + units.join(", ");
}

/** The last day a source has any record on, ladder or no ladder. */
function lastDayOf(archive, source) {
  var last = null;
  for (var i = 0; i < archive.records.length; i++) {
    var r = archive.records[i];
    if (r.source !== source) continue;
    if (last == null || r.day > last) last = r.day;
  }
  return last;
}

/**
 * Every source in the archive, and what it contributes.
 *
 * Sources that cannot contribute are returned too, with the reason — a screen
 * that silently drops half the archive is a screen nobody can check. There are
 * four reasons and they are different things: no ladder for the unit (Anki
 * records no difficulty at all, and pre-level Syllogimous records a quantity
 * this ladder was not built for), nothing inside the window, too few sittings,
 * or nothing held at 75%.
 */
function contributions(archive, opts) {
  opts = opts || {};
  var to = opts.asOf || new Date().toISOString().slice(0, 10);
  var from = _addDays(to, -(opts.windowDays || WINDOW_DAYS));
  var halfLife = opts.halfLifeDays || HALF_LIFE_DAYS;

  var sources = {};
  for (var i = 0; i < archive.records.length; i++) sources[archive.records[i].source] = true;

  var used = [];
  var unused = [];

  Object.keys(sources).sort().forEach(function (source) {
    var byUnit = windowRows(archive, source, from, to);
    var unit = bestUnit(byUnit);

    if (!unit) {
      var anyUnit = Object.keys(byUnit).length > 0;
      unused.push({
        source: source,
        why: anyUnit
          ? noLadderReason(byUnit)
          : "nothing in the last " + (opts.windowDays || WINDOW_DAYS) + " days",
      });
      return;
    }

    var rows = byUnit[unit];
    var minRows = rows[0].kind === "item" ? MIN_ITEMS : MIN_BLOCKS;
    var shown = demonstrated(rows, minRows);

    if (shown.difficulty == null) {
      unused.push({
        source: source,
        unit: unit,
        why: shown.short
          ? shown.of + " of " + minRows + " scored sittings in the window"
          : "nothing held at " + Math.round(TIER_ACCURACY * 100) + "% across "
            + shown.of + " sittings",
      });
      return;
    }

    var last = lastDayOf(archive, source);
    var stale = Math.max(0, _daysBetween(last, to));
    var freshness = Math.pow(0.5, stale / halfLife);
    var confidence = shown.of / (shown.of + EVIDENCE_HALF);
    var base = SOURCE_WEIGHT[source] == null ? DEFAULT_WEIGHT : SOURCE_WEIGHT[source];

    used.push({
      source: source,
      unit: unit,
      from: LADDERS[unit].from,
      note: LADDERS[unit].note,
      difficulty: shown.difficulty,
      accuracy: shown.accuracy,
      n: shown.n,
      of: shown.of,
      lastDay: last,
      daysSince: stale,
      level: tierOf(unit, shown.difficulty),
      baseWeight: base,
      freshness: freshness,
      confidence: confidence,
      weight: base * freshness * confidence,
    });
  });

  return { used: used, unused: unused, from: from, to: to };
}

/**
 * The benchmark's own verdict: the weakest of its three columns, and nothing
 * else.
 *
 * Conjunctive, because that is the published rule — "all modes must meet at
 * least 75% to advance". A column nobody has evidence for does not lower the
 * badge, it withholds it: there is no tier you can be said to have earned on a
 * benchmark two thirds of which you have not attempted, and guessing the third
 * from the other two is precisely the cross-app inference this project refuses
 * to make anywhere else.
 */
function badge(used) {
  var columns = COLUMNS.map(function (col) {
    var best = null;
    for (var i = 0; i < used.length; i++) {
      if (col.sources.indexOf(used[i].source) < 0) continue;
      if (!best || used[i].level > best.level) best = used[i];
    }
    return {
      name: col.name,
      source: best ? best.source : null,
      level: best ? best.level : null,
    };
  });

  var missing = columns.filter(function (c) { return c.level == null; });
  if (missing.length) {
    return { tier: null, level: null, columns: columns, missing: missing };
  }

  var lowest = columns[0];
  columns.forEach(function (c) { if (c.level < lowest.level) lowest = c; });

  return {
    tier: Math.floor(lowest.level) < 0 ? null : tierLabel(lowest.level),
    level: lowest.level,
    columns: columns,
    missing: [],
    blocking: lowest.name,
  };
}

/**
 * Where the whole record puts you, on the benchmark's ladder.
 *
 * A weighted mean of the per-source positions — not a minimum, which is what
 * `badge` is for, and not a maximum, which would make the estimate a report on
 * whichever trainer you happened to be best at.
 *
 * `confidence` is the share of the weight that could exist which actually
 * turned up: every listed source at full freshness and full evidence. It is
 * deliberately hard to max out, and it is the number to read before the tier —
 * an α on 12% confidence is a sentence about the archive, not about anybody's
 * reasoning.
 */
function estimate(archive, opts) {
  var parts = contributions(archive, opts);
  var used = parts.used;

  if (!used.length) {
    return {
      level: null, tier: null, progress: null, confidence: 0,
      used: [], unused: parts.unused, badge: badge([]),
      from: parts.from, to: parts.to,
    };
  }

  var total = 0;
  var sum = 0;
  used.forEach(function (u) { total += u.weight; sum += u.weight * u.level; });
  var level = total > 0 ? sum / total : null;

  used.forEach(function (u) { u.share = total > 0 ? u.weight / total : 0; });
  used.sort(function (a, b) { return b.share - a.share; });

  /* What the same sources would be worth trained today with unlimited evidence.
     The ceiling is never reached — `confidence` above says why — so this is a
     ratio to read, not a percentage to complete. */
  var possible = 0;
  used.forEach(function (u) { possible += u.baseWeight; });
  parts.unused.forEach(function (u) {
    possible += SOURCE_WEIGHT[u.source] == null ? DEFAULT_WEIGHT : SOURCE_WEIGHT[u.source];
  });

  return {
    level: level,
    tier: tierLabel(level),
    /* How far into the tier, for a bar. Negative positions are below α and
       have no tier to be a fraction of. */
    progress: level == null || level < 0 ? null : level - Math.floor(level),
    confidence: possible > 0 ? total / possible : 0,
    used: used,
    unused: parts.unused,
    badge: badge(used),
    from: parts.from,
    to: parts.to,
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    estimate: estimate, contributions: contributions, demonstrated: demonstrated,
    tierOf: tierOf, tierLabel: tierLabel, badge: badge,
    TIERS: TIERS, LADDERS: LADDERS, SOURCE_WEIGHT: SOURCE_WEIGHT,
    COLUMNS: COLUMNS, TIER_ACCURACY: TIER_ACCURACY,
    MIN_ITEMS: MIN_ITEMS, MIN_BLOCKS: MIN_BLOCKS,
    WINDOW_DAYS: WINDOW_DAYS, HALF_LIFE_DAYS: HALF_LIFE_DAYS,
    EVIDENCE_HALF: EVIDENCE_HALF, DEFAULT_WEIGHT: DEFAULT_WEIGHT,
  };
}

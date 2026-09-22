"use strict";

/* ============================================================
   THE ABILITY ESTIMATE
   ============================================================

   One position on one ladder, out of every trainer at once — and it is always
   shown. There is no bar to clear and no column that can withhold it. A reading
   can be thin, and then it says so and weighs little; it is never absent
   because of a setting.

   **The first version of this file got three things wrong and they were the
   same mistake**: it re-derived, from the archive, things the trainers had
   already worked out and written down.

   1. It required 75% accuracy before it would report anything. That number is
      the benchmark's, and the benchmark measures a fixed test. An adaptive
      trainer does the opposite — it moves difficulty until accuracy sits at
      *its own* target — so its logged accuracy is pinned somewhere that has
      nothing to do with 75%. On a real archive this refused every source.
   2. It read those figures as raw accuracy. Most of them are not. RNB's block
      score maps "never pressed" to 0 and perfect to 1, so about 0.50 there is
      roughly 80% of judgements right; Running Order compares its target
      against a guessing-corrected figure; eWMT's is hits over hits plus false
      alarms plus misses. Three scales, one comparison, no meaning.
   3. The fix that suggests itself — a table of each app's target accuracy and
      which scale it is on — is worse than the bug. That is eight apps'
      internals copied into a ninth, and `tune.targetAccuracy` in a real RNB
      export reads 0.7 where the shipped default is 0.4. The copy is stale the
      first time anybody moves a slider.

   **So accuracy is not interpreted here at all.** Every trainer has already
   applied its own target and its own chance correction; what it produces as a
   result is a difficulty it has settled you at, and *that* is the reading. The
   archive's job is to look it up, not to second-guess it.

   ------------------------------------------------------------------

   **Where an app states its own ability, that is what is used.** Most of them
   do, and it is in the archive already — `archive.state` keeps every non-history
   key an export carried, which is where the trainers write exactly this:

     RNB           `bestLoad`      the hardest load a block cleared at the
                                   player's own target, whatever they set it to
     Syllogimous   `syllogimous-ability:scale`   the aggregate ability posterior,
                                   in the levels `levelOf` prices
     eWMT          `bestN`
     Running Order `bestPeakBits`
     Rotation      the established level of its best mode

   Reading those rather than recomputing them is the same rule the adapter
   already follows for Syllogimous difficulty: a second copy of a formula is a
   second source of truth, and the two drift in the direction nobody notices.
   It is also the robust choice — a trainer that changes its target, its scoring
   or its chance correction changes its own number, and this keeps reporting it
   correctly with nothing here to update.

   **Every layer is optional and falls through.** A state key that disappears,
   a shape that changes, a source that never had one: the reading falls back to
   the difficulty the trainer's own controller settled on in the records, which
   needs no knowledge of any app. Only a source with no difficulty anywhere goes
   silent, and then it is listed by name.

   ------------------------------------------------------------------

   The tiers are the Guanxinandu S11 benchmark's, used as what they are — six
   bands of roughly similar proficiency, with a published anchor per trainer:

     tier   relational reasoning        quad n-back    relational n-back
     α      Space 2D,  6 premises       Quad 3-back    character+position 2-back
     β      Space 3D,  6 premises       Quad 4-back    character+position 3-back
     γ      Space 5D,  6 premises       Quad 5-back    character+position 4-back
     δ      Space 6D,  6 premises       Quad 6-back    character+position 5-back
     ε      Space 7D,  6 premises       Quad 7-back    character+position 6-back
     ζ      (unset)                     Quad 8-back    character+position 7-back

   Their value is the calibration, not the rules printed beside them: they say
   what "about this good" looks like in five different trainers' own units, and
   that is the one thing no amount of staring at a load and a level can supply.
   The rules are the benchmark's own test protocol and are not reimplemented
   here, because the trainers are not that test.
*/

/* global addDays, daysBetween */
var INS = (typeof module !== "undefined" && typeof require === "function")
  ? require("./insight.js") : null;
var _addDays = INS ? INS.addDays : function (d, n) { return addDays(d, n); };
var _daysBetween = INS ? INS.daysBetween : function (a, b) { return daysBetween(a, b); };

/** The benchmark's bands, in order. Index 0 is α. */
var TIERS = ["α", "β", "γ", "δ", "ε", "ζ"];

/* ------------------------------------------------------------------ *
 * The ladders                                                         *
 * ------------------------------------------------------------------ */

/**
 * What each trainer's own difficulty reads at each band.
 *
 * Keyed by **unit**, not by source, for the reason every other reader here is:
 * a source can change what it measures, and a number under the old unit must
 * never be looked up in the new unit's table. If a trainer renames or replaces
 * its unit this table stops matching, the source falls out, and — because that
 * would otherwise be a silent change to everybody's estimate — the page lists
 * it by name and `test/run.js` fails on it.
 *
 * Three of these are the benchmark's own rows, priced through the app's own
 * difficulty function. The rest are not in the benchmark, and say so.
 */
var LADDERS = {

  /*
   * ---- Syllogimous: the benchmark's reasoning column, priced by the app ----
   *
   * `syllogimous-level` is `levelOf`, which is what the app charges an item and
   * what its ability posterior is stated in — so the benchmark's requirement
   * can be priced rather than guessed at, and the app's own estimate lands on
   * this ladder with no conversion. Each row is "6 premises of this mode, no
   * rungs claimed, no clock", which is `MODE_SCALE[mode].weight * 6`:
   *
   *     α  Space 2D = Direction  1.15 x 6 =  6.9
   *     β  Space 3D              1.35 x 6 =  8.1
   *     γ  Space 5D              1.90 x 6 = 11.4
   *     δ  Space 6D              2.20 x 6 = 13.2
   *     ε  Space 7D              2.40 x 6 = 14.4
   *
   * The α row names Linear and Distinction alongside Space 2D, and those price
   * at 1.0 x 6 = 6.0. The row is worth its hardest member.
   *
   * ζ is the benchmark's own `???`: the other two columns step by one n-back,
   * and Syllogimous has no eighth axis to step to, so the last gap repeats.
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
   * +4 for the glyph stream as an identity judgement.
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
   * Quad 3-back through Quad 8-back. Precision N-back is the quad proper —
   * position, tone, colour and shape — and eWMT is the same axis with its own
   * channels. What neither ladder carries is the rest of each app's difficulty:
   * Precision holds n and tightens its per-modality thresholds instead, so a
   * threshold that has halved is a real gain sitting at the same n. The
   * benchmark only ever asked about n.
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
   * ---- Not in the benchmark ----
   *
   * Four trainers it never ranked. Leaving them out would be tidier and wrong:
   * they are training, they are in the record, and an estimate that ignored
   * half the archive would drift from it every week the work went somewhere
   * unranked. Each is aligned onto the same six steps from the app's own
   * starting point to its own floor or cap — numbers its settings already name.
   * That is a real statement (α is where this trainer starts you, ζ is where it
   * runs out) and not a claim that ζ here is as hard as ζ on a benchmarked one.
   * Nobody measured that, which is why they carry less weight.
   */

  "cct-peak-items-per-min": {
    anchors: [40, 50, 62, 77, 96, 120],
    from: "aligned",
    note: "the app's own 1500ms start to its 500ms floor, in equal ratio steps",
  },
  "rrt-peak-bits-per-s": {
    anchors: [2.0, 2.9, 3.5, 5.0, 5.9, 8.7],
    from: "aligned",
    note: "every other rung of the app's own 11-rung ladder, at its 800ms floor",
  },
  "rotation-level": {
    anchors: [1, 2, 4, 6, 8, 10],
    from: "aligned",
    note: "the app's own level, which stops discriminating past 10",
  },
  "synth-symbols-per-min": {
    anchors: [18, 30, 50, 84, 141, 237],
    from: "aligned",
    note: "the app's own 3400ms starting window to its 250ms floor",
  },
};

/**
 * How much each source moves the estimate, before evidence and staleness.
 *
 * Syllogimous and Relational N-back carry it, at three times anything else.
 * They are two of the benchmark's three columns; they are the two trainers here
 * with the most developed ability models of their own, so their readings are a
 * measurement rather than a high-water mark; and they are the two broadest
 * tasks in the archive, where the rest of the list is narrow enough to be
 * climbed without moving much else.
 *
 * A source with no entry gets `DEFAULT_WEIGHT`, so adding an adapter never
 * silently adds a heavyweight.
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
 * How fast a source stops speaking for you: halving every three months since it
 * was last trained. Not a cliff — a trainer left alone for a month is still
 * evidence, one left alone for a year is nearly none.
 */
var HALF_LIFE_DAYS = 90;

/**
 * Days of training at which a source is trusted half as much as it ever will be.
 *
 * Days rather than sessions, because sessions can be racked up in one evening
 * and days cannot. What the weight is asking is whether this trainer is an
 * established part of the practice or something opened on Tuesday, and a
 * fortnight is a fair halfway point. It never reaches 1: no amount of volume
 * buys certainty.
 */
var EVIDENCE_DAYS = 14;

/**
 * Half-life of a sitting's say in the fallback reading, in days.
 *
 * Only used where an app states no ability of its own and the difficulty its
 * controller settled on has to stand in. Three weeks: long enough that one bad
 * evening does not move it, short enough that a month of climbing shows.
 */
var RECENCY_HALF_LIFE = 21;

/**
 * Tiers of disagreement between an app's own estimate and the difficulty it is
 * actually serving, past which the page says so.
 *
 * Both numbers come from the same trainer, so they should agree. When they do
 * not, either the app's estimate is stale or the reader below has fallen behind
 * a change in the app — and both are things to be told about rather than
 * averaged away. The app's own number is still what is used.
 */
var DISAGREEMENT_TIERS = 2;

/* ------------------------------------------------------------------ *
 * What the apps say about themselves                                  *
 * ------------------------------------------------------------------ */

/** JSON that may already be parsed, or may be a localStorage string. */
function parseMaybe(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try { return JSON.parse(value); } catch (e) { return null; }
}

/*
 * Syllogimous's ability posterior, decoded.
 *
 * `syllogimous-ability:scale` is the aggregate across every mode — the one
 * number the app itself calls the player's ability, on the same level scale
 * `levelOf` prices items in and this ladder is built from.
 *
 * It is stored as a grid of log-posterior densities and nothing else, because
 * the grid's floor and spacing are fixed by the app and *growing it only ever
 * appends points* — an old posterior is a prefix of a longer one, which the app
 * documents and relies on. So the array's own length is how far it runs, and
 * reading it needs only the floor and the step. Those two are the one thing
 * here that a Syllogimous change could invalidate, and `checkDisagreement`
 * below is what notices when it has.
 */
var SYL_MIN_LEVEL = 1;
var SYL_MAX_LEVEL = 26;
var SYL_BINS = 80;

function syllogimousAbility(state) {
  var obj = parseMaybe(state["syllogimous-ability:scale"]);
  if (!obj || !Array.isArray(obj.logPost) || obj.logPost.length < 2) return null;

  var lp = obj.logPost;
  var step = (SYL_MAX_LEVEL - SYL_MIN_LEVEL) / (SYL_BINS - 1);

  // Subtract the peak before exponentiating, or a posterior this sharp underflows.
  var top = -Infinity;
  for (var i = 0; i < lp.length; i++) if (lp[i] > top) top = lp[i];
  if (!isFinite(top)) return null;

  var sum = 0, mu = 0;
  for (var j = 0; j < lp.length; j++) {
    var w = Math.exp(lp[j] - top);
    sum += w;
    mu += w * (SYL_MIN_LEVEL + step * j);
  }
  if (!(sum > 0)) return null;

  var level = mu / sum;
  return isFinite(level) && level >= SYL_MIN_LEVEL ? level : null;
}

/**
 * Where each trainer writes down what it thinks of you.
 *
 * One small guarded function per source, and every one of them may return null
 * — a key that moved, a shape that changed, a version that never had it. The
 * reading then falls through to the records, which know nothing about any app.
 * That fall-through is the whole robustness story: a trainer can change
 * anything about how it scores, targets or stores, and the worst case is that
 * this layer goes quiet for that one source.
 *
 * None of these recompute anything. Each app has already applied its own target
 * accuracy and its own chance correction; the number it kept is the conclusion.
 */
var STATE_READERS = {

  /*
   * The hardest load a block actually cleared — RNB only raises this when a
   * block scores at or above its *own* advance threshold, which is derived from
   * whatever target the player has set. A real export reads 0.7 where the
   * shipped default is 0.4, which is exactly why this is read and not rebuilt.
   */
  rnb: function (s) {
    var v = Number(s.bestLoad);
    return isFinite(v) && v > 0
      ? { difficulty: v, unit: "rnb-load", note: "its own best cleared load" }
      : null;
  },

  syllogimous: function (s) {
    var v = syllogimousAbility(s);
    return v == null
      ? null
      : { difficulty: v, unit: "syllogimous-level", note: "its own ability posterior" };
  },

  ewmt: function (s) {
    var v = Number(s.bestN);
    return isFinite(v) && v > 0
      ? { difficulty: v, unit: "ewmt-n", note: "its own best n" }
      : null;
  },

  rrt: function (s) {
    var v = Number(s.bestPeakBits);
    return isFinite(v) && v > 0
      ? { difficulty: v, unit: "rrt-peak-bits-per-s", note: "its own best throughput" }
      : null;
  },

  /*
   * Three modes under one source, each with its own ladder. The best
   * established level across them, since they are the same faculty asked three
   * ways and being deep in one of them is the thing to report.
   */
  rotation: function (s) {
    var best = null;
    for (var mode in s) {
      if (!Object.prototype.hasOwnProperty.call(s, mode)) continue;
      var e = s[mode];
      if (!e || typeof e !== "object") continue;
      var v = Number(e.best != null ? e.best : e.level);
      if (isFinite(v) && (best == null || v > best)) best = v;
    }
    return best == null
      ? null
      : { difficulty: best, unit: "rotation-level", note: "its own best established level" };
  },
};

/** The most recent state snapshot a source has, or null. */
function latestState(archive, source) {
  var bySource = (archive.state || {})[source];
  if (!bySource) return null;
  var days = Object.keys(bySource).sort();
  return days.length ? bySource[days[days.length - 1]] : null;
}

/** What the app says about itself, if it says anything this reader understands. */
function statedAbility(archive, source) {
  var reader = STATE_READERS[source];
  if (!reader) return null;
  var state = latestState(archive, source);
  if (!state || typeof state !== "object") return null;
  try {
    var out = reader(state);
    return out && LADDERS[out.unit] ? out : null;
  } catch (e) {
    // A shape nobody anticipated is a quiet fall-through, never a dead page.
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * The ladder lookup                                                   *
 * ------------------------------------------------------------------ */

/**
 * Where a difficulty sits on the tier axis: 0 is α, 5 is ζ, linear in between.
 *
 * Continuous rather than a rung, because a rung thrown away is a month of work
 * made invisible — the whole climb from β to γ would read as β until the day it
 * read as γ.
 *
 * Off both ends it extrapolates on the nearest gap, bounded one tier either
 * side: below α is a real place to be and so is past ζ, but an estimate four
 * tiers past the top of a published ladder is a straight line run out of
 * evidence, not a measurement.
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

/** The band a position stands in, as a name — "β", "below α", "past ζ". */
function tierLabel(level) {
  if (level == null) return null;
  if (level < 0) return "below " + TIERS[0];
  var i = Math.floor(level);
  if (i >= TIERS.length) return "past " + TIERS[TIERS.length - 1];
  return TIERS[i];
}

/* ------------------------------------------------------------------ *
 * What the records say                                                *
 * ------------------------------------------------------------------ */

/**
 * The difficulty a trainer's own controller has settled on lately.
 *
 * **Accuracy is not read.** Every adaptive trainer here moves difficulty until
 * accuracy sits where it wants it, so the figure it logs is a statement about
 * the controller and the difficulty is the statement about the player. Looking
 * at both would be counting the same evidence twice, on a scale this file
 * cannot interpret anyway.
 *
 * Recency-weighted rather than a window mean, because what is wanted is where
 * the controller has arrived, not where it started. Every sitting still counts;
 * a sitting three weeks ago counts half.
 */
function settledDifficulty(rows, to) {
  var sum = 0, weight = 0;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].difficulty == null || !isFinite(rows[i].difficulty)) continue;
    var age = Math.max(0, _daysBetween(rows[i].day, to));
    var w = Math.pow(0.5, age / RECENCY_HALF_LIFE);
    sum += w * rows[i].difficulty;
    weight += w;
  }
  return weight > 0 ? sum / weight : null;
}

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
 * Which unit to read a source on: the one with a ladder and the most records.
 *
 * A source mid-changeover has two and only one of them can be looked up —
 * Syllogimous is the live case, where a premise count is not a level and there
 * is no converting between them.
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

/** Distinct days a source was trained, and the last of them. */
function trainingDays(archive, source) {
  var seen = {};
  var last = null;
  for (var i = 0; i < archive.records.length; i++) {
    var r = archive.records[i];
    if (r.source !== source) continue;
    seen[r.day] = true;
    if (last == null || r.day > last) last = r.day;
  }
  return { days: Object.keys(seen).length, last: last };
}

/**
 * Why a source's records fit no ladder, in its own terms.
 *
 * Two different silences. A source with units nobody has a ladder for is a gap
 * in `LADDERS` somebody could close — and, if a trainer has *renamed* its unit,
 * the thing that would otherwise change everybody's estimate without a word. A
 * source with no unit at all records no difficulty on purpose, as Anki does.
 */
function noLadderReason(byUnit) {
  var units = Object.keys(byUnit).filter(function (u) { return u; });
  if (!units.length) return "records no difficulty, so there is nothing to place";
  return "no tier ladder for " + units.join(", ") + " — add one, or it stays out";
}

/* ------------------------------------------------------------------ *
 * The estimate                                                        *
 * ------------------------------------------------------------------ */

/**
 * Every source in the archive, and what it contributes.
 *
 * Each one is read in two ways where both are available: what the app says
 * about itself, and what its controller has settled on. The app's own number
 * wins — it applied a target and a chance correction this file deliberately
 * knows nothing about — and the second is kept as the cross-check, because two
 * readings of the same trainer that disagree by two tiers mean something is
 * stale and nobody would otherwise find out.
 *
 * Sources that cannot contribute are returned too, with the reason. A screen
 * that silently drops part of the archive is a screen nobody can check.
 */
function contributions(archive, opts) {
  opts = opts || {};
  var to = opts.asOf || new Date().toISOString().slice(0, 10);
  var windowDays = opts.windowDays || WINDOW_DAYS;
  var from = _addDays(to, -windowDays);
  var halfLife = opts.halfLifeDays || HALF_LIFE_DAYS;

  var sources = {};
  for (var i = 0; i < archive.records.length; i++) sources[archive.records[i].source] = true;
  for (var s in archive.state || {}) sources[s] = true;

  var used = [];
  var unused = [];

  Object.keys(sources).sort().forEach(function (source) {
    var byUnit = windowRows(archive, source, from, to);
    var unit = bestUnit(byUnit);
    var settled = unit ? settledDifficulty(byUnit[unit], to) : null;
    var stated = statedAbility(archive, source);

    var reading = stated || (settled == null ? null : {
      difficulty: settled,
      unit: unit,
      note: "the difficulty its own controller settled on",
    });

    if (!reading) {
      var anyRows = Object.keys(byUnit).length > 0;
      unused.push({
        source: source,
        why: anyRows
          ? noLadderReason(byUnit)
          : "nothing in the last " + windowDays + " days",
      });
      return;
    }

    var level = tierOf(reading.unit, reading.difficulty);
    var alt = (unit && settled != null && stated) ? tierOf(unit, settled) : null;

    var seen = trainingDays(archive, source);
    var stale = seen.last == null ? 0 : Math.max(0, _daysBetween(seen.last, to));
    var freshness = Math.pow(0.5, stale / halfLife);
    var confidence = seen.days / (seen.days + EVIDENCE_DAYS);
    var base = SOURCE_WEIGHT[source] == null ? DEFAULT_WEIGHT : SOURCE_WEIGHT[source];

    used.push({
      source: source,
      unit: reading.unit,
      basis: stated ? "stated" : "settled",
      note: reading.note,
      from: LADDERS[reading.unit].from,
      ladderNote: LADDERS[reading.unit].note,
      difficulty: reading.difficulty,
      level: level,
      /* The other reading of the same trainer, where there is one. Not averaged
         in — shown, so a disagreement is visible rather than split. */
      crossCheck: alt,
      disagrees: alt != null && Math.abs(alt - level) > DISAGREEMENT_TIERS,
      days: seen.days,
      lastDay: seen.last,
      daysSince: stale,
      baseWeight: base,
      freshness: freshness,
      confidence: confidence,
      weight: base * freshness * confidence,
    });
  });

  return { used: used, unused: unused, from: from, to: to };
}

/**
 * Where the whole record puts you.
 *
 * A weighted mean of the per-source positions. Not a minimum — the benchmark's
 * own rule is conjunctive and that is the right rule for awarding *its* badge,
 * but it is the wrong answer to "roughly how good am I", where one trainer
 * opened last Tuesday would decide everything. Not a maximum either, which
 * would report whichever trainer you happened to be best at.
 *
 * It is always produced when anything at all can be read. `confidence` is the
 * share of the weight that could speak for you which actually did, and it is
 * the number to read beside the letter rather than a bar to clear.
 */
function estimate(archive, opts) {
  var parts = contributions(archive, opts);
  var used = parts.used;

  if (!used.length) {
    return {
      level: null, tier: null, progress: null, confidence: 0,
      used: [], unused: parts.unused, spread: null,
      from: parts.from, to: parts.to,
    };
  }

  var total = 0;
  var sum = 0;
  used.forEach(function (u) { total += u.weight; sum += u.weight * u.level; });
  var level = total > 0 ? sum / total : null;

  used.forEach(function (u) { u.share = total > 0 ? u.weight / total : 0; });
  used.sort(function (a, b) { return b.share - a.share; });

  var possible = 0;
  used.forEach(function (u) { possible += u.baseWeight; });
  parts.unused.forEach(function (u) {
    possible += SOURCE_WEIGHT[u.source] == null ? DEFAULT_WEIGHT : SOURCE_WEIGHT[u.source];
  });

  /*
   * How far apart the trainers are, which is the honest replacement for the
   * conjunctive badge the first version withheld.
   *
   * A single letter over eight trainers hides whether they agree. Being γ
   * everywhere and being ε in two things and α in six are different situations
   * with the same mean, and the second is the more useful thing to know — it is
   * where the next hour is worth spending. Reported rather than used to refuse
   * anything.
   */
  var lowest = used[0], highest = used[0];
  used.forEach(function (u) {
    if (u.level < lowest.level) lowest = u;
    if (u.level > highest.level) highest = u;
  });

  return {
    level: level,
    tier: tierLabel(level),
    /* How far into the band, for a bar. Below α there is no band to be a
       fraction of. */
    progress: level == null || level < 0 ? null : level - Math.floor(level),
    confidence: possible > 0 ? total / possible : 0,
    used: used,
    unused: parts.unused,
    spread: {
      low: lowest, high: highest,
      tiers: highest.level - lowest.level,
    },
    from: parts.from,
    to: parts.to,
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    estimate: estimate, contributions: contributions, settledDifficulty: settledDifficulty,
    tierOf: tierOf, tierLabel: tierLabel, statedAbility: statedAbility,
    latestState: latestState, syllogimousAbility: syllogimousAbility,
    TIERS: TIERS, LADDERS: LADDERS, SOURCE_WEIGHT: SOURCE_WEIGHT,
    STATE_READERS: STATE_READERS, DEFAULT_WEIGHT: DEFAULT_WEIGHT,
    WINDOW_DAYS: WINDOW_DAYS, HALF_LIFE_DAYS: HALF_LIFE_DAYS,
    EVIDENCE_DAYS: EVIDENCE_DAYS, RECENCY_HALF_LIFE: RECENCY_HALF_LIFE,
    DISAGREEMENT_TIERS: DISAGREEMENT_TIERS,
  };
}

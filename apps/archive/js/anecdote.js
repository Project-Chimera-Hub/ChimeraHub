"use strict";

/* ============================================================
   THE ANECDOTE
   ============================================================

   What the community posts to say whether training worked: a test taken
   before, the same test taken after, and what was done in between.

   Everything in that post is already in this file. The two scores are measured
   notes, the training is the records and the minutes, and the progress is each
   trainer's own difficulty series. So this compiles the post rather than asking
   anyone to retype it — and compiles it the way the rest of the archive reads
   the record:

   - **Each trainer in its own unit.** A start and an end per trainer, never a
     sum of difficulties across trainers, for the reason `record.js` gives.
   - **A different test is not a change.** Two scores from two tests are shown
     side by side with no difference between them, because there is none to
     compute.
   - **Unknown is not zero.** Days inside the span that no export vouches for
     are counted and said, since "trained 30 hours" over a stretch whose files
     are half gone is a smaller number than the truth and has to look like one.

   Pure functions: the page draws the result, and node tests it.
*/

var ANEC_INSIGHT = typeof require === "function" ? require("./insight.js") : null;
var ANEC_NOTES = typeof require === "function" ? require("./notes.js") : null;
var ANEC_ARCHIVE = typeof require === "function" ? require("./archive.js") : null;

var _aSeries = ANEC_INSIGHT ? ANEC_INSIGHT.series : function (a, s, m) { return series(a, s, m); };
var _aAddDays = ANEC_INSIGHT ? ANEC_INSIGHT.addDays : function (d, n) { return addDays(d, n); };
var _aDaysBetween = ANEC_INSIGHT ? ANEC_INSIGHT.daysBetween : function (a, b) { return daysBetween(a, b); };
var _aMeasureSeries = ANEC_NOTES ? ANEC_NOTES.measureSeries : function (a) { return measureSeries(a); };
var _aCovered = ANEC_ARCHIVE ? ANEC_ARCHIVE.covered : function (a, s, d) { return covered(a, s, d); };

/** How many days at each end of a span its start and end difficulty average over. */
var ANECDOTE_EDGE_DAYS = 5;

/** Every test score in the archive, oldest first, each with its note's id. */
function anecdoteScores(archive) {
  var out = [];
  _aMeasureSeries(archive).forEach(function (s) {
    s.points.forEach(function (p) {
      out.push({ id: p.id, name: s.name, value: p.value, unit: p.unit || "", day: p.day });
    });
  });
  return out.sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; });
}

/**
 * The pair a person most likely means: the first and the latest score of the
 * test they took most recently, if they took it twice. Failing that, the
 * earliest and the latest score of anything.
 */
function anecdoteDefaultPair(archive) {
  var scores = anecdoteScores(archive);
  if (scores.length < 2) return null;

  var best = null;
  _aMeasureSeries(archive).forEach(function (s) {
    if (s.points.length < 2) return;
    var last = s.points[s.points.length - 1];
    if (!best || last.day >= best.last.day) best = { first: s.points[0], last: last };
  });
  if (best && best.first.day !== best.last.day) return { before: best.first.id, after: best.last.id };
  return { before: scores[0].id, after: scores[scores.length - 1].id };
}

function meanOf(xs) {
  return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : null;
}

/** Decimal places a number was written with, so a difference is not printed more precisely than its parts. */
function decimalsOf(x) {
  var s = String(x);
  var i = s.indexOf(".");
  return i < 0 ? 0 : Math.min(3, s.length - i - 1);
}

/**
 * Everything the post says, as numbers.
 *
 * `beforeId` and `afterId` are note ids; given in either order, the earlier
 * one is "before". Returns null when either is not a score in this archive.
 */
function compileAnecdote(archive, beforeId, afterId) {
  var scores = anecdoteScores(archive);
  var a = scores.filter(function (s) { return s.id === beforeId; })[0];
  var b = scores.filter(function (s) { return s.id === afterId; })[0];
  if (!a || !b) return null;
  if (b.day < a.day) { var t = a; a = b; b = t; }

  var from = a.day, to = b.day;
  var spanDays = _aDaysBetween(from, to) + 1;
  var sameTest = a.name === b.name && a.unit === b.unit;
  var places = Math.max(decimalsOf(a.value), decimalsOf(b.value));
  var delta = sameTest ? Number((b.value - a.value).toFixed(places)) : null;

  var sources = Object.keys(archive.minutes || {}).sort();
  var perDay = {};
  var perSource = [];
  var unknownDays = 0;

  for (var i = 0; i < spanDays; i++) {
    var day = _aAddDays(from, i);
    var total = 0, vouched = false;
    sources.forEach(function (s) {
      total += (archive.minutes[s] || {})[day] || 0;
      if (_aCovered(archive, s, day)) vouched = true;
    });
    perDay[day] = total;
    if (total < 1 && !vouched) unknownDays++;
  }

  sources.forEach(function (s) {
    var byDay = archive.minutes[s] || {};
    var minutes = 0, days = 0;
    Object.keys(byDay).forEach(function (d) {
      if (d < from || d > to) return;
      minutes += byDay[d];
      if (byDay[d] >= 1) days++;
    });
    if (minutes < 1) return;

    /* The progress line: the span's commonest unit only, one mean per day. */
    var pts = _aSeries(archive, s).filter(function (p) { return p.day >= from && p.day <= to; });
    var counts = {};
    pts.forEach(function (p) {
      Object.keys(p.units || {}).forEach(function (u) { counts[u] = (counts[u] || 0) + 1; });
    });
    var unit = Object.keys(counts).sort(function (x, y) { return counts[y] - counts[x]; })[0];
    var line = unit == null ? [] : pts
      .filter(function (p) { return p.units && p.units[unit] != null; })
      .map(function (p) { return { day: p.day, value: p.units[unit] }; });

    var edge = Math.min(ANECDOTE_EDGE_DAYS, Math.floor(line.length / 2));
    var start = edge ? meanOf(line.slice(0, edge).map(function (p) { return p.value; })) : null;
    var end = edge ? meanOf(line.slice(-edge).map(function (p) { return p.value; })) : null;

    perSource.push({
      source: s,
      minutes: minutes,
      days: days,
      unit: unit || null,
      line: line,
      start: start,
      end: end,
      change: start != null && end != null && start !== 0 ? (end - start) / Math.abs(start) : null,
    });
  });
  perSource.sort(function (x, y) { return y.minutes - x.minutes; });

  var totalMinutes = 0, trainedDays = 0;
  Object.keys(perDay).forEach(function (d) {
    totalMinutes += perDay[d];
    if (perDay[d] >= 1) trainedDays++;
  });

  /* Daily bars over a month or less; past that, weeks counted from the first test. */
  var binDays = spanDays <= 31 ? 1 : 7;
  var bins = [];
  for (var k = 0; k < spanDays; k += binDays) {
    var bin = { from: _aAddDays(from, k), days: Math.min(binDays, spanDays - k), minutes: 0 };
    for (var j = 0; j < bin.days; j++) bin.minutes += perDay[_aAddDays(from, k + j)] || 0;
    bin.to = _aAddDays(bin.from, bin.days - 1);
    bins.push(bin);
  }

  return {
    before: a,
    after: b,
    from: from,
    to: to,
    spanDays: spanDays,
    sameTest: sameTest,
    delta: delta,
    places: places,
    totalMinutes: totalMinutes,
    trainedDays: trainedDays,
    unknownDays: unknownDays,
    perSource: perSource,
    binDays: binDays,
    bins: bins,
    /* The same test's whole history, so a reader sees whether "after" is a
       trend or one lucky sitting. */
    history: sameTest
      ? scores.filter(function (s) { return s.name === a.name && s.unit === a.unit; })
      : [],
    /* Other tests taken inside the span: part of the story, and the first
       thing a sceptical reader asks for. */
    between: scores.filter(function (s) {
      return s.day >= from && s.day <= to && s.id !== a.id && s.id !== b.id
        && !(sameTest && s.name === a.name && s.unit === a.unit);
    }),
  };
}

/* ------------------------------------------------------------------ *
 * Words                                                              *
 * ------------------------------------------------------------------ */

function anecFmt(x, places) {
  if (x == null || !isFinite(x)) return "—";
  return Number(x).toFixed(places == null ? 0 : places);
}

function anecScore(s) {
  return s.value + (s.unit ? " " + s.unit : "");
}

function anecHours(minutes) {
  return minutes >= 600 ? anecFmt(minutes / 60, 0) : anecFmt(minutes / 60, 1);
}

function anecSigned(x, places) {
  if (x == null || !isFinite(x)) return "—";
  var s = anecFmt(Math.abs(x), places);
  return (x > 0 ? "+" : x < 0 ? "−" : "±") + s;
}

/** The headline, as one line. */
function anecdoteHeadline(a) {
  if (a.sameTest) {
    return a.before.name + ": " + anecScore(a.before) + " → " + anecScore(a.after)
      + " (" + anecSigned(a.delta, a.places) + ")";
  }
  return a.before.name + " " + anecScore(a.before) + " → " + a.after.name + " " + anecScore(a.after);
}

var ANECDOTE_CAVEAT = "One test before and one after is an anecdote, not a study: "
  + "retaking a test raises the score by itself, two different tests are not one scale, "
  + "and a good or bad day moves a single sitting.";

/**
 * The post as Markdown, which Reddit and Discord both render.
 * `nameOf` turns a source id into what a person calls it.
 */
function anecdoteMarkdown(a, nameOf, extra) {
  var name = nameOf || function (s) { return s; };
  var L = [];
  L.push("## Training anecdote");
  L.push("");
  L.push("**" + anecdoteHeadline(a) + "** — " + a.from + " to " + a.to + ", " + a.spanDays + " days apart");
  if (!a.sameTest) L.push("", "_Two different tests, so there is no difference to report — only the two scores._");
  L.push("");
  L.push("- **Training:** " + anecHours(a.totalMinutes) + " h over " + a.trainedDays + " of "
    + a.spanDays + " days");
  L.push("- **Per training day:** " + anecFmt(a.trainedDays ? a.totalMinutes / a.trainedDays : 0) + " min"
    + " · **per calendar day:** " + anecFmt(a.totalMinutes / a.spanDays) + " min");
  if (a.unknownDays) {
    L.push("- **Missing record:** " + a.unknownDays + " day" + (a.unknownDays === 1 ? "" : "s")
      + " in the span have no export behind them, so any training then is not counted");
  }

  if (a.perSource.length) {
    L.push("", "| Trainer | Hours | Days | Difficulty, start → end | Change |", "|---|---:|---:|---|---:|");
    a.perSource.forEach(function (p) {
      L.push("| " + name(p.source) + " | " + anecHours(p.minutes) + " | " + p.days + " | "
        + (p.start == null ? "—" : anecFmt(p.start, 2) + " → " + anecFmt(p.end, 2) + " " + (p.unit || ""))
        + " | " + (p.change == null ? "—" : anecSigned(100 * p.change, 0) + "%") + " |");
    });
    L.push("", "_Difficulty is each trainer's own, in its own unit, averaged over the first and last "
      + ANECDOTE_EDGE_DAYS + " days it was played in the span._");
  } else {
    L.push("", "_No training recorded between the two tests._");
  }

  if (a.history.length > 2) {
    L.push("", "**Every " + a.before.name + " score:** " + a.history.map(function (s) {
      return anecScore(s) + " (" + s.day + ")";
    }).join(", "));
  }
  if (a.between.length) {
    L.push("", "**Other tests in between:** " + a.between.map(function (s) {
      return s.name + " " + anecScore(s) + " (" + s.day + ")";
    }).join(", "));
  }
  if (extra && String(extra).trim()) L.push("", String(extra).trim());
  L.push("", "_" + ANECDOTE_CAVEAT + "_", "", "_Compiled by the Chimera Hub training archive._");
  return L.join("\n");
}

/* ------------------------------------------------------------------ *
 * The picture                                                        *
 * ------------------------------------------------------------------ */

function anecEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Monospace makes a line's width a character count, so text wraps without measuring. */
function anecWrap(text, chars) {
  var out = [];
  String(text || "").split(/\n/).forEach(function (para) {
    var line = "";
    para.split(/\s+/).forEach(function (w) {
      if (!w) return;
      while (w.length > chars) { if (line) { out.push(line); line = ""; } out.push(w.slice(0, chars)); w = w.slice(chars); }
      if (!line) line = w;
      else if ((line + " " + w).length <= chars) line += " " + w;
      else { out.push(line); line = w; }
    });
    out.push(line);
  });
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

function anecTrim(s, chars) {
  s = String(s);
  return s.length > chars ? s.slice(0, chars - 1) + "…" : s;
}

/**
 * The anecdote as one SVG, so what is on screen and the image that gets
 * posted are the same drawing. Single-hue throughout: every trainer is named
 * where it is drawn, so nothing depends on telling two colours apart.
 *
 * `opt.width` is the drawing's width in px; `opt.nameOf` names a source.
 */
function anecdoteSvg(a, opt) {
  opt = opt || {};
  var name = opt.nameOf || function (s) { return s; };
  var W = Math.max(560, opt.width || 1000);
  var P = 32;                         // outer padding
  var inner = W - P * 2;
  var C = {
    bg: "#14110a", panel: "#1c180e", line: "#3a321b", grid: "#2a2414",
    text: "#f8f0da", soft: "#eadfc2", muted: "#a48f60", mark: "#d4af37", wash: "rgba(212,175,55,.12)",
  };
  var FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
  var CW = 0.6;                       // a monospace character, in ems
  var parts = [];
  var y = P;

  function text(x, yy, s, size, fill, extra) {
    parts.push("<text x='" + x.toFixed(1) + "' y='" + yy.toFixed(1) + "' font-size='" + size
      + "' fill='" + fill + "'" + (extra || "") + ">" + anecEsc(s) + "</text>");
  }
  function caps(x, yy, s, extra) {
    text(x, yy, String(s).toUpperCase(), 11, C.muted, " letter-spacing='2'" + (extra || ""));
  }
  function charsFor(px, size) { return Math.max(8, Math.floor(px / (size * CW))); }

  /* Head */
  caps(P, y + 10, "Training anecdote · " + a.from + " → " + a.to);
  y += 30;
  if (a.sameTest) {
    var big = a.before.value + " → " + a.after.value;
    var bigSize = Math.min(54, Math.floor(inner * 0.55 / ((big.length + 1) * CW)));
    text(P, y + bigSize * 0.85, big, bigSize, C.text, " font-weight='600'");
    var right = anecSigned(a.delta, a.places) + (a.before.unit ? " " + a.before.unit : "");
    text(W - P, y + bigSize * 0.85, right, bigSize, C.mark, " text-anchor='end' font-weight='600'");
    y += bigSize + 12;
    text(P, y + 14, anecTrim(a.before.name + (a.before.unit ? " · " + a.before.unit : "")
      + " · " + a.spanDays + " days apart", charsFor(inner, 15)), 15, C.soft);
    y += 26;
  } else {
    var lines = [a.before.name + ": " + anecScore(a.before) + "  (" + a.before.day + ")",
                 a.after.name + ": " + anecScore(a.after) + "  (" + a.after.day + ")"];
    lines.forEach(function (l, i) {
      text(P, y + 26, anecTrim((i ? "after   " : "before  ") + l, charsFor(inner, 24)), 24, C.text, " font-weight='600'");
      y += 34;
    });
    text(P, y + 14, "Two different tests: shown side by side, with no difference computed.", 13, C.muted);
    y += 26;
  }
  y += 10;

  /* Tiles */
  var tiles = [
    ["Training", anecHours(a.totalMinutes) + " h", "between the two tests"],
    ["Days trained", a.trainedDays + " / " + a.spanDays, Math.round(100 * a.trainedDays / a.spanDays) + "% of days"],
    ["Per training day", anecFmt(a.trainedDays ? a.totalMinutes / a.trainedDays : 0) + " min", "on days trained"],
    ["Per day", anecFmt(a.totalMinutes / a.spanDays) + " min", "averaged over the span"],
  ];
  var cols = W >= 800 ? 4 : 2;
  var gap = 12;
  var tw = (inner - gap * (cols - 1)) / cols, th = 78;
  tiles.forEach(function (t, i) {
    var cx = P + (i % cols) * (tw + gap), cy = y + Math.floor(i / cols) * (th + gap);
    parts.push("<rect x='" + cx.toFixed(1) + "' y='" + cy.toFixed(1) + "' width='" + tw.toFixed(1)
      + "' height='" + th + "' fill='" + C.panel + "' stroke='" + C.line + "'/>");
    caps(cx + 14, cy + 22, t[0]);
    text(cx + 14, cy + 50, t[1], 24, C.text, " font-weight='600'");
    text(cx + 14, cy + 68, anecTrim(t[2], charsFor(tw - 28, 11)), 11, C.muted);
  });
  y += Math.ceil(tiles.length / cols) * (th + gap) + 8;

  if (a.unknownDays) {
    anecWrap(a.unknownDays + " day" + (a.unknownDays === 1 ? "" : "s")
      + " in this span have no export behind them; training on those days, if any, is not counted.",
      charsFor(inner, 12)).forEach(function (l) { text(P, y + 12, l, 12, C.muted); y += 17; });
    y += 6;
  }

  /* Volume */
  caps(P, y + 12, "Minutes " + (a.binDays === 1 ? "per day" : "per week"));
  y += 22;
  var chartH = 150, axisW = 44;
  var peak = 1;
  a.bins.forEach(function (b) { if (b.minutes > peak) peak = b.minutes; });
  var niceStep = [1, 2, 5, 10, 15, 30, 60, 120, 240, 600].filter(function (s) { return peak / s <= 4; })[0] || 1200;
  var top = Math.ceil(peak / niceStep) * niceStep;
  var plotX = P + axisW, plotW = inner - axisW;
  for (var g = 0; g <= top; g += niceStep) {
    var gy = y + chartH - chartH * g / top;
    parts.push("<line x1='" + plotX + "' x2='" + (P + inner) + "' y1='" + gy.toFixed(1) + "' y2='"
      + gy.toFixed(1) + "' stroke='" + C.grid + "' stroke-width='1'/>");
    text(plotX - 8, gy + 4, String(g), 11, C.muted, " text-anchor='end'");
  }
  var slot = plotW / Math.max(1, a.bins.length);
  var bw = Math.max(1, Math.min(24, slot - 2));
  a.bins.forEach(function (b, i) {
    var h = chartH * b.minutes / top;
    var bx = plotX + i * slot + (slot - bw) / 2;
    parts.push("<g><rect x='" + (plotX + i * slot).toFixed(1) + "' y='" + y + "' width='" + slot.toFixed(1)
      + "' height='" + chartH + "' fill='transparent'/><rect x='" + bx.toFixed(1) + "' y='"
      + (y + chartH - h).toFixed(1) + "' width='" + bw.toFixed(1) + "' height='" + h.toFixed(1)
      + "' fill='" + C.mark + "'/><title>" + anecEsc((b.days > 1 ? b.from + " – " + b.to : b.from)
      + ": " + anecFmt(b.minutes) + " min") + "</title></g>");
  });
  text(plotX, y + chartH + 16, a.from, 11, C.muted);
  text(P + inner, y + chartH + 16, a.to, 11, C.muted, " text-anchor='end'");
  y += chartH + 34;

  /* Per trainer */
  if (a.perSource.length) {
    caps(P, y + 12, "By trainer");
    y += 24;
    var wide = W >= 800;
    var cName = P, cHours = P + (wide ? 300 : 210), cBar = cHours + 70;
    var cDiff = wide ? P + inner - 300 : null;
    var barW = (wide ? cDiff - 24 : P + inner) - cBar;
    var maxMin = a.perSource[0].minutes;
    parts.push("<line x1='" + P + "' x2='" + (P + inner) + "' y1='" + y + "' y2='" + y + "' stroke='" + C.line + "'/>");
    a.perSource.forEach(function (p) {
      var rowH = wide ? 30 : 44;
      var ty = y + 20;
      text(cName, ty, anecTrim(name(p.source), charsFor(cHours - cName - 10, 13)), 13, C.text);
      text(cHours + 50, ty, anecHours(p.minutes) + " h", 13, C.soft, " text-anchor='end'");
      parts.push("<rect x='" + cBar + "' y='" + (ty - 9) + "' width='" + Math.max(1, barW * p.minutes / maxMin).toFixed(1)
        + "' height='10' fill='" + C.mark + "'><title>" + anecEsc(name(p.source) + ": "
        + anecHours(p.minutes) + " h over " + p.days + " days") + "</title></rect>");
      var diff = p.start == null ? "no difficulty recorded"
        : anecFmt(p.start, 2) + " → " + anecFmt(p.end, 2) + " " + (p.unit || "")
          + (p.change == null ? "" : "  " + anecSigned(100 * p.change, 0) + "%");
      if (wide) text(cDiff, ty, anecTrim(diff, charsFor(P + inner - cDiff, 12)), 12, C.soft);
      else text(cName, ty + 18, anecTrim(diff, charsFor(inner, 11)), 11, C.muted);
      y += rowH;
      parts.push("<line x1='" + P + "' x2='" + (P + inner) + "' y1='" + y + "' y2='" + y + "' stroke='" + C.grid + "'/>");
    });
    y += 22;

    /* Progress, one small chart per trainer with a line to draw. */
    var drawn = a.perSource.filter(function (p) { return p.line.length >= 2; });
    if (drawn.length) {
      caps(P, y + 12, "Difficulty over the span, each trainer in its own unit");
      y += 24;
      var mc = W >= 800 ? 3 : 2;
      var mw = (inner - gap * (mc - 1)) / mc, mh = 120;
      drawn.forEach(function (p, i) {
        var mx = P + (i % mc) * (mw + gap), my = y + Math.floor(i / mc) * (mh + gap);
        parts.push("<rect x='" + mx.toFixed(1) + "' y='" + my.toFixed(1) + "' width='" + mw.toFixed(1)
          + "' height='" + mh + "' fill='" + C.panel + "' stroke='" + C.line + "'/>");
        text(mx + 10, my + 18, anecTrim(name(p.source), charsFor(mw - 20, 12)), 12, C.text);
        /* The same start and end the table gives, so the two never disagree. */
        var ends = anecFmt(p.start, 2) + " → " + anecFmt(p.end, 2);
        text(mx + mw - 10, my + 33, ends, 10, C.soft, " text-anchor='end'");
        text(mx + 10, my + 33, anecTrim(p.unit || "difficulty", Math.max(4, charsFor(mw - 30, 10) - ends.length)), 10, C.muted);
        var lo = Infinity, hi = -Infinity;
        p.line.forEach(function (q) { lo = Math.min(lo, q.value); hi = Math.max(hi, q.value); });
        if (hi === lo) { hi += 1; lo -= 1; }
        var px0 = mx + 14, pw = mw - 28, py0 = my + 48, ph = mh - 62;
        var t0 = 0, t1 = Math.max(1, _aDaysBetween(a.from, a.to));
        function X(day) { return px0 + pw * (_aDaysBetween(a.from, day) - t0) / (t1 - t0); }
        function Y(v) { return py0 + ph * (1 - (v - lo) / (hi - lo)); }
        var d = p.line.map(function (q, k) {
          return (k ? "L" : "M") + X(q.day).toFixed(1) + " " + Y(q.value).toFixed(1);
        }).join(" ");
        parts.push("<path d='" + d + "' fill='none' stroke='" + C.mark + "' stroke-width='2'"
          + " stroke-linejoin='round' stroke-linecap='round'/>");
        var first = p.line[0], last = p.line[p.line.length - 1];
        [first, last].forEach(function (q) {
          parts.push("<circle cx='" + X(q.day).toFixed(1) + "' cy='" + Y(q.value).toFixed(1) + "' r='4' fill='"
            + C.mark + "' stroke='" + C.panel + "' stroke-width='2'><title>" + anecEsc(q.day + ": "
            + anecFmt(q.value, 2) + " " + (p.unit || "")) + "</title></circle>");
        });
        p.line.forEach(function (q) {
          parts.push("<circle cx='" + X(q.day).toFixed(1) + "' cy='" + Y(q.value).toFixed(1)
            + "' r='6' fill='transparent'><title>" + anecEsc(q.day + ": " + anecFmt(q.value, 2) + " "
            + (p.unit || "")) + "</title></circle>");
        });
      });
      y += Math.ceil(drawn.length / mc) * (mh + gap) + 10;
    }
  } else {
    text(P, y + 14, "No training recorded between the two tests.", 13, C.soft);
    y += 32;
  }

  /* The test's own history, when there is more of it than the two ends. */
  if (a.history.length > 2) {
    caps(P, y + 12, "Every " + a.before.name + " score");
    y += 24;
    var hh = 110, hx = P + axisW, hw = inner - axisW - 12;
    var hlo = Infinity, hhi = -Infinity;
    a.history.forEach(function (s) { hlo = Math.min(hlo, s.value); hhi = Math.max(hhi, s.value); });
    if (hhi === hlo) { hhi += 1; hlo -= 1; }
    var h0 = a.history[0].day, h1 = a.history[a.history.length - 1].day;
    var hs = Math.max(1, _aDaysBetween(h0, h1));
    var HX = function (day) { return hx + hw * _aDaysBetween(h0, day) / hs; };
    var HY = function (v) { return y + 8 + (hh - 16) * (1 - (v - hlo) / (hhi - hlo)); };
    [hlo, hhi].forEach(function (v) {
      parts.push("<line x1='" + hx + "' x2='" + (hx + hw) + "' y1='" + HY(v).toFixed(1) + "' y2='"
        + HY(v).toFixed(1) + "' stroke='" + C.grid + "'/>");
      text(hx - 8, HY(v) + 4, String(Number(v.toFixed(a.places))), 11, C.muted, " text-anchor='end'");
    });
    parts.push("<rect x='" + HX(a.from).toFixed(1) + "' y='" + y + "' width='"
      + Math.max(1, HX(a.to) - HX(a.from)).toFixed(1) + "' height='" + hh + "' fill='" + C.wash + "'/>");
    parts.push("<path d='" + a.history.map(function (s, k) {
      return (k ? "L" : "M") + HX(s.day).toFixed(1) + " " + HY(s.value).toFixed(1);
    }).join(" ") + "' fill='none' stroke='" + C.mark + "' stroke-width='2' stroke-linejoin='round'/>");
    a.history.forEach(function (s) {
      var key = s.id === a.before.id || s.id === a.after.id;
      parts.push("<circle cx='" + HX(s.day).toFixed(1) + "' cy='" + HY(s.value).toFixed(1) + "' r='" + (key ? 5 : 4)
        + "' fill='" + (key ? C.text : C.mark) + "' stroke='" + C.bg + "' stroke-width='2'><title>"
        + anecEsc(s.day + ": " + anecScore(s)) + "</title></circle>");
    });
    text(hx, y + hh + 14, h0, 11, C.muted);
    text(hx + hw, y + hh + 14, h1, 11, C.muted, " text-anchor='end'");
    y += hh + 30;
  }

  if (a.between.length) {
    caps(P, y + 12, "Other tests in between");
    y += 22;
    anecWrap(a.between.map(function (s) { return s.name + " " + anecScore(s) + " (" + s.day + ")"; }).join(" · "),
      charsFor(inner, 12)).forEach(function (l) { text(P, y + 12, l, 12, C.soft); y += 17; });
    y += 12;
  }

  if (opt.extra && String(opt.extra).trim()) {
    caps(P, y + 12, "Notes");
    y += 22;
    anecWrap(opt.extra, charsFor(inner, 13)).slice(0, 30).forEach(function (l) {
      text(P, y + 13, l, 13, C.soft); y += 19;
    });
    y += 12;
  }

  parts.push("<line x1='" + P + "' x2='" + (P + inner) + "' y1='" + y + "' y2='" + y + "' stroke='" + C.line + "'/>");
  y += 8;
  anecWrap(ANECDOTE_CAVEAT, charsFor(inner, 11)).forEach(function (l) { text(P, y + 12, l, 11, C.muted); y += 16; });
  text(P, y + 14, "Compiled by the Chimera Hub training archive", 11, C.muted);
  y += 20 + P;

  return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 " + W + " " + Math.ceil(y) + "' width='" + W
    + "' height='" + Math.ceil(y) + "' font-family=\"" + FONT + "\" role='img' aria-label='"
    + anecEsc(anecdoteHeadline(a)) + "'><rect width='100%' height='100%' fill='" + C.bg + "'/>"
    + parts.join("") + "</svg>";
}

if (typeof module !== "undefined") {
  module.exports = {
    anecdoteScores: anecdoteScores,
    anecdoteDefaultPair: anecdoteDefaultPair,
    compileAnecdote: compileAnecdote,
    anecdoteHeadline: anecdoteHeadline,
    anecdoteMarkdown: anecdoteMarkdown,
    anecdoteSvg: anecdoteSvg,
    ANECDOTE_EDGE_DAYS: ANECDOTE_EDGE_DAYS,
  };
}

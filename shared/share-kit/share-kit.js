/*!
 * share-kit — let players share their training answers, on purpose.
 *
 * One file, no dependencies, MIT. Works in a browser (as `window.ShareKit`)
 * and in Node (`require`). See README.md beside this file for why and how.
 *
 * The shape of the idea: the tool turns its own answer history into a small,
 * fixed-shape file — numbers about each answer, nothing a player wrote, read
 * or configured — the player saves it, looks at it, and uploads it wherever
 * the researcher collects files. The tool itself sends nothing.
 *
 * The same `validate` runs on both ends: the tool will not write a file the
 * collector would reject, and the collector rejects anything the tool would
 * not have written.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ShareKit = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var FORMAT = "mindbuild-share";
  var VERSION = 1;
  var ID_KEY = "mindbuild.share.id";
  var MAX_ROWS = 200000;

  /* ---------------------------------------------------------------- *
   * What a row may hold. Nothing else is written, and nothing else is  *
   * accepted: an unknown field in an uploaded file is a reason to      *
   * reject it, because it is exactly where something personal would    *
   * be smuggled in.                                                    *
   * ---------------------------------------------------------------- */

  var APP = /^[a-z0-9][a-z0-9-]{0,39}$/;
  // A mode is a name a person reads; letters first, so a CSV cell can never
  // start with =, +, - or @ and be taken for a formula.
  var MODE = /^[\p{L}\p{N}][\p{L}\p{N} '()\/&.,+-]{0,79}$/u;
  var RUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,39}$/;
  var TOKEN = /^[a-z0-9-]{1,20}$/;
  var DAY = /^\d{4}-\d{2}-\d{2}$/;
  var PARTICIPANT = /^[0-9a-f]{16}$/;

  function num(lo, hi) {
    return function (v) { return v === null || (typeof v === "number" && isFinite(v) && v >= lo && v <= hi); };
  }
  function int(lo, hi) {
    return function (v) { return v === null || (Number.isInteger(v) && v >= lo && v <= hi); };
  }
  function str(re) {
    return function (v) { return v === null || (typeof v === "string" && re.test(v)); };
  }
  function required(check) {
    return function (v) { return v !== null && v !== undefined && check(v); };
  }

  var ROW = {
    app: required(str(APP)),
    mode: required(str(MODE)),
    /* 1 right, 0 wrong, a fraction for an item scored in parts, null unscored. */
    correct: num(0, 1),
    seconds: num(0, 3600),
    day: required(str(DAY)),
    seq: required(int(1, MAX_ROWS)),
    level: num(-100, 1000),
    premises: int(0, 1000),
    rungs: function (v) {
      return Array.isArray(v) && v.length <= 40 && v.every(function (r) { return typeof r === "string" && RUNG.test(r); });
    },
    clock: num(0, 3600),
    presentation: str(TOKEN),
    timer: str(TOKEN),
    answerMode: str(TOKEN),
  };
  var FIELDS = Object.keys(ROW);

  /* Own keys only. `allowed["constructor"]` and `ROW["__proto__"]` are truthy
     on any plain object, and JSON.parse makes both into ordinary keys — so a
     bare lookup would wave exactly those names through. */
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function isDay(s) {
    if (!DAY.test(s)) return false;
    var d = new Date(s + "T00:00:00Z");
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }

  /**
   * `{ ok, errors }`. Every problem is listed, not just the first, so a
   * collector can see why a file was turned away.
   */
  function validate(file) {
    var errors = [];
    function bad(msg) { if (errors.length < 50) errors.push(msg); }

    if (!file || typeof file !== "object" || Array.isArray(file)) return { ok: false, errors: ["not a JSON object"] };
    var allowed = { format: 1, version: 1, tool: 1, participant: 1, made: 1, answers: 1, modes: 1, apps: 1, rows: 1 };
    Object.keys(file).forEach(function (k) { if (!own(allowed, k)) bad("unknown top-level field " + JSON.stringify(k).slice(0, 40)); });

    if (file.format !== FORMAT) bad("format is not " + FORMAT);
    if (file.version !== VERSION) bad("version is not " + VERSION);
    if (file.tool !== undefined && !(typeof file.tool === "string" && APP.test(file.tool))) bad("tool is not a short lowercase name");
    if (typeof file.participant !== "string" || !PARTICIPANT.test(file.participant)) bad("participant is not 16 hex digits");
    if (typeof file.made !== "string" || !isDay(file.made)) bad("made is not a date");
    if (!Array.isArray(file.rows)) return { ok: false, errors: errors.concat("rows is not a list") };
    if (file.rows.length > MAX_ROWS) bad("more than " + MAX_ROWS + " rows");
    if (file.answers !== file.rows.length) bad("answers does not match the number of rows");

    var counts = {}, modes = {};
    for (var i = 0; i < file.rows.length && errors.length < 50; i++) {
      var r = file.rows[i];
      if (!r || typeof r !== "object" || Array.isArray(r)) { bad("row " + i + " is not an object"); continue; }
      for (var k in r) {
        if (!Object.prototype.hasOwnProperty.call(r, k)) continue;
        if (!own(ROW, k)) bad("row " + i + " has unknown field " + JSON.stringify(k).slice(0, 40));
      }
      for (var f = 0; f < FIELDS.length; f++) {
        var name = FIELDS[f];
        var v = r[name];
        if (v === undefined) {
          if (name === "rungs") continue;
          v = null;
        }
        if (!ROW[name](v)) bad("row " + i + ": bad " + name);
      }
      if (typeof r.day === "string" && !isDay(r.day)) bad("row " + i + ": day is not a date");
      if (typeof r.day === "string" && typeof file.made === "string" && r.day > file.made) bad("row " + i + ": day is after the file was made");
      if (typeof r.app === "string") counts[r.app] = (counts[r.app] || 0) + 1;
      modes[r.app + "/" + r.mode] = true;
    }

    if (!file.apps || typeof file.apps !== "object" || Array.isArray(file.apps)) bad("apps is not an object");
    else {
      var a = Object.keys(file.apps), c = Object.keys(counts);
      if (a.length !== c.length || a.some(function (k) { return file.apps[k] !== counts[k]; })) bad("apps does not match the rows");
    }
    if (errors.length === 0 && file.modes !== Object.keys(modes).length) bad("modes does not match the rows");

    return { ok: errors.length === 0, errors: errors };
  }

  /* ---------------------------------------------------------------- */

  function randomHex(bytes) {
    var b = new Uint8Array(bytes);
    var c = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto : require("crypto").webcrypto;
    c.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
  }

  /**
   * A random id, made once per device and kept. It joins one player's files
   * and is what they quote to have them deleted; it says nothing about them.
   * `storage` is anything shaped like localStorage.
   */
  function participantId(storage) {
    if (storage === undefined && typeof localStorage !== "undefined") storage = localStorage;
    var id = null;
    try { id = storage && storage.getItem(ID_KEY); } catch (e) { /* storage off */ }
    if (typeof id === "string" && PARTICIPANT.test(id)) return id;
    id = randomHex(8);
    try { if (storage) storage.setItem(ID_KEY, id); } catch (e) { /* a new id per file, then */ }
    return id;
  }

  function round(v, places) {
    if (typeof v !== "number" || !isFinite(v)) return null;
    var p = Math.pow(10, places);
    return Math.round(v * p) / p;
  }

  /**
   * One answer as the tool knows it → one row, or null if it would not pass.
   *
   * `at` (ms since epoch) is required and is used only to put the answers in
   * order and to find their day; it is never written.
   */
  function toRow(a) {
    var rungs = Array.isArray(a.rungs) ? a.rungs.filter(function (r) { return typeof r === "string" && RUNG.test(r); }).slice(0, 40) : [];
    var row = {
      app: a.app,
      mode: typeof a.mode === "string" ? a.mode.trim().slice(0, 80) : a.mode,
      correct: typeof a.correct === "boolean" ? (a.correct ? 1 : 0) : (a.correct == null ? null : round(a.correct, 3)),
      seconds: a.seconds == null ? null : round(a.seconds, 1),
      day: new Date(a.at).toISOString().slice(0, 10),
      seq: 1,
      level: a.level == null ? null : round(a.level, 2),
      premises: a.premises == null ? null : a.premises,
      rungs: rungs,
      clock: a.clock == null ? null : a.clock,
      presentation: a.presentation == null ? null : String(a.presentation),
      timer: a.timer == null ? null : String(a.timer),
      answerMode: a.answerMode == null ? null : String(a.answerMode),
    };
    for (var i = 0; i < FIELDS.length; i++) {
      var k = FIELDS[i];
      if (!ROW[k](row[k])) return null;
    }
    return row;
  }

  /**
   * The file. `answers` is a list of `{ app, mode, at, correct, seconds,
   * level?, premises?, rungs?, clock?, presentation?, timer?, answerMode? }`.
   * Answers that would not pass validation are left out and counted in the
   * second return value, so a tool never produces a file a collector turns
   * away.
   */
  function makeFile(answers, opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var skipped = 0;
    var dated = [];
    (answers || []).forEach(function (a) {
      if (!a || typeof a.at !== "number" || !isFinite(a.at) || a.at > now + 86400000) { skipped++; return; }
      var row = toRow(a);
      if (!row) { skipped++; return; }
      dated.push({ at: a.at, row: row });
    });
    dated.sort(function (x, y) { return x.at - y.at; });

    var seq = {}, apps = {}, modes = {};
    var rows = dated.map(function (d) {
      var r = d.row;
      seq[r.day] = (seq[r.day] || 0) + 1;
      r.seq = seq[r.day];
      apps[r.app] = (apps[r.app] || 0) + 1;
      modes[r.app + "/" + r.mode] = true;
      return r;
    });

    var file = {
      format: FORMAT,
      version: VERSION,
      tool: opts.tool && APP.test(opts.tool) ? opts.tool : undefined,
      participant: opts.participant || participantId(opts.storage),
      made: new Date(Math.max(now, dated.length ? dated[dated.length - 1].at : 0)).toISOString().slice(0, 10),
      answers: rows.length,
      modes: Object.keys(modes).length,
      apps: apps,
      rows: rows,
    };
    if (file.tool === undefined) delete file.tool;
    return { file: file, skipped: skipped };
  }

  /**
   * Several accepted files → one list of rows, each tagged with its
   * participant. A player who uploads twice sends their older answers twice,
   * and a file made mid-day holds part of that day; so for each participant,
   * app and day the rows kept are those of the file holding the most answers
   * for that day (the later file on a tie). Days only grow, so that one is
   * complete.
   */
  function merge(files) {
    var best = Object.create(null);
    files.forEach(function (f) {
      var byDay = Object.create(null);
      f.rows.forEach(function (r) {
        var k = f.participant + "|" + r.app + "|" + r.day;
        (byDay[k] = byDay[k] || []).push(r);
      });
      Object.keys(byDay).forEach(function (k) {
        var rows = byDay[k], cur = best[k];
        if (!cur || rows.length > cur.rows.length || (rows.length === cur.rows.length && f.made >= cur.made)) {
          best[k] = { made: f.made, participant: f.participant, rows: rows };
        }
      });
    });
    var out = [];
    Object.keys(best).forEach(function (k) {
      best[k].rows.forEach(function (r) {
        var row = { participant: best[k].participant };
        for (var f in r) if (own(r, f)) row[f] = r[f];
        out.push(row);
      });
    });
    function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
    out.sort(function (a, b) {
      return cmp(a.participant, b.participant) || cmp(a.day, b.day) || a.seq - b.seq || cmp(a.app, b.app);
    });
    return out;
  }

  function summary(file) {
    if (!file.answers) return "No answers to share yet.";
    var days = {};
    file.rows.forEach(function (r) { days[r.day] = true; });
    return file.answers + " answers, " + file.modes + " modes, "
      + Object.keys(days).length + " days. Participant " + file.participant + ".";
  }

  function fileName(file) {
    return (file.tool || "share") + "-data_" + file.participant + "_" + file.made + ".json";
  }

  /** Browser only: hands the file to the browser's save dialog. */
  function download(file, name) {
    var blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name || fileName(file);
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  return {
    FORMAT: FORMAT,
    VERSION: VERSION,
    FIELDS: FIELDS.slice(),
    validate: validate,
    makeFile: makeFile,
    merge: merge,
    participantId: participantId,
    summary: summary,
    fileName: fileName,
    download: download,
  };
});

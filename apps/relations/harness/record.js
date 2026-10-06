"use strict";

/* ============================================================
   THE CHIMERA RECORD FORMAT, version 1
   ============================================================

   What every trainer on the hub writes, so that the archive, the meter, the
   gate and Share your data can read it without anyone writing an adapter.
   FORMAT.md beside this file is the specification for people; this is the
   same thing for programs: the columns, a validator, the storage key, and a
   flattening into two tables.

   One file per trainer, under one localStorage key:

       chimera.<app>.record.v1   →   { format, version, app, units, sessions, state }

   Sessions are rows, and so are trials. Every column has a fixed meaning
   and a fixed type, and **every column but a handful may be empty** (absent or
   null): a trainer fills in what it knows and leaves the rest. An empty column
   says "this trainer does not measure that", never "zero".

   The archive cannot load this file — it is published as its own repository
   with no build step — so its reader (`readChimeraRecord` in
   apps/archive/js/adapters.js) is written out again there, and the hub's
   test suite holds the two to the same answers.

   Plain ES5, no dependencies, works in a page (as `ChimeraRecord`) and in
   node (`require`).
*/

var ChimeraRecord = (function () {

  var FORMAT = "chimera-record";
  var VERSION = 1;

  /** The localStorage key a trainer keeps its record under. */
  function key(app) { return "chimera." + app + ".record.v1"; }
  var KEY_PATTERN = /^chimera\.([a-z][a-z0-9-]*)\.record\.v1$/;

  /* Types: "string", "number", "integer", "boolean", "fraction" (0..1),
     "time" (epoch milliseconds, UTC), "object", "array", "any". */

  /** Top-level fields. */
  var FILE = [
    { name: "format", type: "string", required: true, about: 'Always "chimera-record".' },
    { name: "version", type: "integer", required: true, about: "Always 1 for this version." },
    { name: "app", type: "string", required: true,
      about: "The trainer's id: its catalog id, its archive source and the <app> in the key." },
    { name: "appVersion", type: "string", about: "The trainer's own version, if it has one." },
    { name: "units", type: "object", required: true,
      about: "units.level names what `level` is measured in (\"n\", \"premises\", \"ms\"…). "
        + "units.score, if the trainer reports a score." },
    { name: "sessions", type: "array", required: true, about: "One entry per session, oldest first." },
    { name: "state", type: "object",
      about: "The trainer's current standing (ability estimate, level it will start at next…)." },
  ];

  /** One session: a sitting, a block or a game — whatever the trainer calls one run. */
  var SESSION = [
    { name: "id", type: "string", required: true,
      about: "Unique and stable within the app. Re-exporting must give the same id." },
    { name: "start", type: "time", required: true, about: "When it started, epoch ms UTC." },
    { name: "end", type: "time", about: "When it ended, epoch ms UTC." },
    { name: "activeSeconds", type: "number", required: true,
      about: "Seconds actually spent training, pauses excluded. This is what the meter counts." },
    { name: "completed", type: "boolean", about: "Finished, rather than abandoned part-way." },
    { name: "mode", type: "string", about: "Mode, variant or game type, as the player sees it named." },
    { name: "modalities", type: "array", about: 'Streams in play, e.g. ["position","audio"].' },
    { name: "level", type: "number", about: "Difficulty at the start, in units.level." },
    { name: "levelEnd", type: "number", about: "Difficulty at the end, in units.level." },
    { name: "levelUnit", type: "string", about: "Overrides units.level for this session only." },
    { name: "trials", type: "integer", about: "Trials, items or questions presented." },
    { name: "correct", type: "integer", about: "How many of them were answered correctly." },
    { name: "accuracy", type: "fraction", about: "0..1. Computed from correct/trials when absent." },
    { name: "hits", type: "integer", about: "Signal detection: targets responded to." },
    { name: "misses", type: "integer", about: "Signal detection: targets missed." },
    { name: "falseAlarms", type: "integer", about: "Signal detection: responses to non-targets." },
    { name: "correctRejections", type: "integer", about: "Signal detection: non-targets let pass." },
    { name: "dPrime", type: "number", about: "Sensitivity, if the trainer computes it." },
    { name: "rtMeanMs", type: "number", about: "Mean response time, ms." },
    { name: "rtMedianMs", type: "number", about: "Median response time, ms." },
    { name: "rtSdMs", type: "number", about: "Standard deviation of response time, ms." },
    { name: "score", type: "number", about: "Any other headline number, in units.score." },
    { name: "input", type: "string", about: '"keyboard", "touch", "mouse" or "voice".' },
    { name: "settings", type: "object", about: "The settings in force, as the trainer stores them." },
    { name: "extra", type: "object", about: "Anything else this trainer measures. Its own vocabulary." },
    { name: "trialLog", type: "array", about: "The trials, one row each (see TRIAL)." },
  ];

  /** One trial: a stimulus and what the player did about it. */
  var TRIAL = [
    { name: "i", type: "integer", required: true, about: "Position in the session, from 0." },
    { name: "t", type: "number", about: "Milliseconds from the session's start to the stimulus." },
    { name: "block", type: "integer", about: "Block within the session, from 0." },
    { name: "level", type: "number", about: "Difficulty on this trial." },
    { name: "modality", type: "string", about: "Which stream this row is about." },
    { name: "stimulus", type: "any", about: "What was shown or played." },
    { name: "target", type: "boolean", about: "Whether a response was called for (a match, a go)." },
    { name: "response", type: "any", about: "What the player did. Empty for no response." },
    { name: "correct", type: "boolean", about: "Whether that was right." },
    { name: "rtMs", type: "number", about: "Response time, ms. Empty for no response." },
    { name: "extra", type: "object", about: "Anything else about this trial." },
  ];

  function typeOk(type, v) {
    switch (type) {
      case "string": return typeof v === "string";
      case "number": return typeof v === "number" && isFinite(v);
      case "integer": return typeof v === "number" && isFinite(v) && Math.floor(v) === v;
      case "boolean": return typeof v === "boolean";
      case "fraction": return typeof v === "number" && v >= 0 && v <= 1;
      case "time": return typeof v === "number" && v > 946684800000 && v < 4102444800000;
      case "object": return !!v && typeof v === "object" && !Array.isArray(v);
      case "array": return Array.isArray(v);
      default: return true;
    }
  }

  function empty(v) { return v === undefined || v === null; }

  function checkRow(columns, row, where, errors, warnings) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      errors.push(where + " is not an object");
      return;
    }
    var known = {};
    for (var c = 0; c < columns.length; c++) {
      var col = columns[c];
      known[col.name] = true;
      var v = row[col.name];
      if (empty(v)) {
        if (col.required) errors.push(where + "." + col.name + " is required");
        continue;
      }
      if (!typeOk(col.type, v)) errors.push(where + "." + col.name + " should be " + col.type);
    }
    for (var k in row) {
      if (Object.prototype.hasOwnProperty.call(row, k) && !known[k]) {
        warnings.push(where + "." + k + " is not a column; put it in `extra`");
      }
    }
  }

  /**
   * Everything wrong with a record, and everything merely odd.
   * `ok` is false only for errors: a record with warnings still reads.
   */
  function validate(file) {
    var errors = [], warnings = [];
    if (!file || typeof file !== "object") return { ok: false, errors: ["not an object"], warnings: [] };

    checkRow(FILE, file, "record", errors, warnings);
    if (file.format !== undefined && file.format !== FORMAT) errors.push('record.format should be "' + FORMAT + '"');
    if (file.version !== undefined && file.version !== VERSION) errors.push("record.version should be " + VERSION);
    if (typeof file.app === "string" && !/^[a-z][a-z0-9-]*$/.test(file.app)) {
      errors.push("record.app should be lower-case letters, digits and dashes");
    }
    if (file.units && typeof file.units === "object" && file.units.level !== undefined
        && typeof file.units.level !== "string") {
      errors.push("record.units.level should be a string");
    }

    var ids = {};
    var sessions = Array.isArray(file.sessions) ? file.sessions : [];
    for (var s = 0; s < sessions.length; s++) {
      var row = sessions[s], where = "sessions[" + s + "]";
      checkRow(SESSION, row, where, errors, warnings);
      if (!row || typeof row !== "object") continue;
      if (typeof row.id === "string") {
        if (ids[row.id]) errors.push(where + ".id repeats " + JSON.stringify(row.id));
        ids[row.id] = true;
      }
      if (typeof row.activeSeconds === "number" && row.activeSeconds < 0) errors.push(where + ".activeSeconds is negative");
      if (typeof row.activeSeconds === "number" && row.activeSeconds > 6 * 3600) {
        warnings.push(where + ".activeSeconds is over six hours — is it milliseconds?");
      }
      if (typeof row.end === "number" && typeof row.start === "number" && row.end < row.start) {
        errors.push(where + ".end is before its start");
      }
      if (typeof row.correct === "number" && typeof row.trials === "number" && row.correct > row.trials) {
        errors.push(where + ".correct is more than its trials");
      }
      if (!empty(row.level) || !empty(row.levelEnd)) {
        var unit = row.levelUnit || (file.units && file.units.level);
        if (!unit) errors.push(where + " has a level and no unit for it (units.level or levelUnit)");
      }
      if (Array.isArray(row.trialLog)) {
        for (var t = 0; t < row.trialLog.length; t++) {
          checkRow(TRIAL, row.trialLog[t], where + ".trialLog[" + t + "]", errors, warnings);
        }
      }
    }
    if (!sessions.length) warnings.push("record.sessions is empty");

    /* A thousand identical warnings say one thing. */
    var seen = {}, unique = [];
    for (var w = 0; w < warnings.length; w++) {
      var shape = warnings[w].replace(/\[\d+\]/g, "[]");
      if (!seen[shape]) { seen[shape] = true; unique.push(warnings[w]); }
    }
    return { ok: errors.length === 0, errors: errors, warnings: unique };
  }

  /* ---------------------------------------------------------------- *
   * Tables                                                           *
   * ---------------------------------------------------------------- */

  function cell(v) {
    if (empty(v)) return "";
    if (typeof v === "object") v = JSON.stringify(v);
    var s = String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /**
   * The record as two CSV tables, every column present in a fixed order and
   * empty where the trainer said nothing — the shape a spreadsheet or R wants.
   * Trials carry `app` and `session` so the two tables join.
   */
  function toTables(file) {
    var sCols = ["app"].concat(SESSION.filter(function (c) { return c.name !== "trialLog"; })
      .map(function (c) { return c.name; }));
    var tCols = ["app", "session"].concat(TRIAL.map(function (c) { return c.name; }));
    var sRows = [sCols.join(",")], tRows = [tCols.join(",")];
    var sessions = (file && Array.isArray(file.sessions)) ? file.sessions : [];
    for (var s = 0; s < sessions.length; s++) {
      var row = sessions[s] || {};
      sRows.push(sCols.map(function (c) { return cell(c === "app" ? file.app : row[c]); }).join(","));
      var log = Array.isArray(row.trialLog) ? row.trialLog : [];
      for (var t = 0; t < log.length; t++) {
        var tr = log[t] || {};
        tRows.push(tCols.map(function (c) {
          return cell(c === "app" ? file.app : c === "session" ? row.id : tr[c]);
        }).join(","));
      }
    }
    return { sessions: sRows.join("\n") + "\n", trials: tRows.join("\n") + "\n" };
  }

  /** An empty record for `app`, ready to have sessions pushed onto it. */
  function create(app, levelUnit, appVersion) {
    var f = { format: FORMAT, version: VERSION, app: app, units: { level: levelUnit || null }, sessions: [] };
    if (appVersion) f.appVersion = appVersion;
    return f;
  }

  return {
    FORMAT: FORMAT, VERSION: VERSION,
    FILE: FILE, SESSION: SESSION, TRIAL: TRIAL,
    key: key, KEY_PATTERN: KEY_PATTERN,
    validate: validate, toTables: toTables, create: create,
  };
})();

if (typeof module !== "undefined") module.exports = ChimeraRecord;

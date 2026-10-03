"use strict";

/* ============================================================
   SHARING YOUR RESULTS, ON PURPOSE
   ============================================================

   The hub's use of share-kit (shared/share-kit/), which does the part any
   tool could use: the fixed row shape, the participant id, the file, and the
   validation a collector runs on it. What is here is the part only this hub
   knows — where each trainer keeps its results.

   Every trainer that keeps a history is in the file:

   - The counted trainers (Syllogimous, Relational N-back - Loosh, CCT,
     Chimera, Relation Streams), and any retired one still in this browser, are read
     through the archive's own adapters by way of `Today.readings()`, the same
     readings the meter counts from, so the file agrees with the record about
     what a session is and whether it went well.
   - Earshot and Quad Box have no adapter, because the meter does not count
     them. Their histories are read here, and only here.
   - eWMT keeps running totals and no sessions, and Attention Training keeps
     nothing, so neither has anything to put in a file.

   One row is one answer for Syllogimous and Isomorph, which store every
   question, and one session for everything else, which is all those apps
   keep. `app` says which.

   Nothing is sent: the browser saves the file and the player uploads it
   through a link, so the hub still makes no request of anyone.
*/

var Share = (function () {

  var Kit = typeof ShareKit !== "undefined" ? ShareKit : require("../../shared/share-kit/share-kit.js");
  var Readings = typeof Today !== "undefined" ? Today : require("./today.js");

  var TOKEN = /^[a-z0-9-]{1,20}$/;

  function inRange(v, lo, hi) {
    return typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : null;
  }
  function token(v) {
    return v != null && TOKEN.test(String(v)) ? String(v) : null;
  }
  /* A name a person reads, cut down to what the kit accepts, so a label with
     a × or a · in it loses the character and not the whole session. */
  function mode(v) {
    var s = String(v == null ? "" : v)
      .replace(/[^\p{L}\p{N} '()\/&.,+-]/gu, " ")
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .replace(/\s+/g, " ")
      .trim();
    return s || "unnamed";
  }

  /** One archive record → one answer for the kit. */
  function fromRecord(r) {
    var raw = r.raw || {};
    var answer = {
      app: r.source,
      mode: mode(r.label),
      at: r.at,
      correct: inRange(r.correct, 0, 1),
      /* An hour is the kit's ceiling. A longer session keeps its row and
         loses only the figure it could not hold. */
      seconds: inRange(r.seconds, 0, 3600),
      level: inRange(r.difficulty, -100, 1000),
    };

    /* Syllogimous and Isomorph: an answer, and the old card's fields with it.
       Their difficulty comes in two units, and only the level is a level. */
    if (raw.item) {
      var q = raw.item, d = q.difficulty || {};
      var isLevel = typeof r.unit === "string" && /-level$/.test(r.unit);
      if (!isLevel) answer.level = null;
      answer.premises = Array.isArray(q.premises) ? q.premises.length : null;
      answer.rungs = d.rungs;
      answer.clock = inRange(d.seconds, 0, 3600);
      /* "0" one card, "1"/"2" the carousels, null when the app did not record it. */
      answer.presentation = token(raw.presentation);
      answer.timer = token(raw.timer);
      answer.answerMode = token(raw.answerMode);
    }
    return answer;
  }

  /**
   * Earshot: `earshot.sessions.v1`, the last three hundred sessions. Level is
   * the speed threshold the staircase settled on, in degrees per second.
   */
  function fromEarshot(text) {
    var list;
    try { list = JSON.parse(text); } catch (e) { return []; }
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (s) {
      if (!s || typeof s.endedAt !== "number") return;
      var c = s.config || {};
      out.push({
        app: "earshot",
        mode: mode([c.mode, c.n + "/" + c.t, c.frontOnly ? "front" : "all", c.duration + "s"].join(" ")),
        at: s.endedAt,
        correct: inRange(s.accuracy, 0, 1),
        seconds: typeof s.startedAt === "number" ? inRange((s.endedAt - s.startedAt) / 1000, 0, 3600) : null,
        level: inRange(s.threshold, -100, 1000),
        rungs: s.partial ? ["ended-early"] : [],
      });
    });
    return out;
  }

  /**
   * Quad Box: its IndexedDB games, as `readQuadBox` hands them over. Level is
   * n; the clock is the time each trial allows. Tombstones are the app's own
   * markers for auto-progression and are not games.
   */
  function fromQuadBox(games) {
    var out = [];
    (games || []).forEach(function (g) {
      if (!g || g.status === "tombstone" || typeof g.timestamp !== "number") return;
      var scores = g.scores || {};
      var hits = 0, possible = 0;
      if (scores.tally) {
        hits = Number(scores.tally.hits) || 0;
        possible = Number(scores.tally.possible) || 0;
      } else {
        (g.tags || []).forEach(function (t) {
          var s = scores[t] || {};
          hits += Number(s.hits) || 0;
          possible += (Number(s.hits) || 0) + (Number(s.misses) || 0);
        });
      }
      var seconds = typeof g.start === "number" ? (g.timestamp - g.start) / 1000
        : (Number(g.trialTime) || 0) * (Number(g.completedTrials) || 0) / 1000;
      var rungs = (g.tags || []).slice();
      if (g.status !== "completed") rungs.push("ended-early");
      out.push({
        app: "quadbox",
        mode: mode((g.title || "custom") + (g.rules === "variable" ? " variable" : "")),
        at: g.timestamp,
        correct: possible ? hits / possible : null,
        seconds: inRange(seconds, 0, 3600),
        level: inRange(Number(g.nBack), -100, 1000),
        rungs: rungs,
        clock: inRange(Number(g.trialTime) / 1000, 0, 3600),
      });
    });
    return out;
  }

  /**
   * Quad Box's games, or none. Opened with no version, so a later Quad Box
   * schema does not lock this out, and **never created**: opening a database
   * that does not exist would make an empty one, and Quad Box, finding its
   * version already there, would never build its store and could not save a
   * game again. So a database that would have to be made is aborted instead.
   */
  function readQuadBox() {
    return new Promise(function (resolve) {
      if (typeof indexedDB === "undefined") return resolve([]);
      var req;
      try { req = indexedDB.open("QuadBoxNBack"); } catch (e) { return resolve([]); }
      req.onupgradeneeded = function () { req.transaction.abort(); };
      req.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); resolve([]); };
      req.onblocked = function () { resolve([]); };
      req.onsuccess = function () {
        var db = req.result;
        try {
          if (!db.objectStoreNames.contains("games")) { db.close(); return resolve([]); }
          var all = db.transaction("games", "readonly").objectStore("games").getAll();
          all.onsuccess = function () { db.close(); resolve(all.result || []); };
          all.onerror = function () { db.close(); resolve([]); };
        } catch (e) { db.close(); resolve([]); }
      };
    });
  }

  /** The file, as an object, from this page's localStorage. `quadbox` is Quad
      Box's games, read beforehand because that read is async. */
  function build(now, quadbox) {
    var answers = [];
    Readings.readings().forEach(function (reading) {
      (reading.records || []).forEach(function (r) { answers.push(fromRecord(r)); });
    });
    var earshot = null;
    try { earshot = localStorage.getItem("earshot.sessions.v1"); } catch (e) { /* storage off */ }
    if (earshot) answers = answers.concat(fromEarshot(earshot));
    answers = answers.concat(fromQuadBox(quadbox));
    return Kit.makeFile(answers, { tool: "chimerahub", now: now }).file;
  }

  var NAMES = {
    syllogimous: "Syllogimous", rnb: "Relational N-back - Loosh",
    cct: "CCT", chimera: "Chimera", relational: "Relation Streams",
    earshot: "Earshot", quadbox: "Quad Box",
    isomorph: "Isomorph", rrt: "Running Order",
    synth: "Synth", precision: "Precision N-back", rotation: "3D Rotation", ewmt: "eWMT",
  };

  function summary(file) {
    if (!file.answers) return "No results on this device yet.";
    var parts = Object.keys(file.apps).map(function (a) {
      return (NAMES[a] || a) + " " + file.apps[a];
    });
    return file.answers + " rows: " + parts.join(", ") + ". Participant " + file.participant + ".";
  }

  function wire() {
    var ok = document.getElementById("share-ok");
    var make = document.getElementById("share-make");
    var note = document.getElementById("share-note");
    if (!ok || !make) return;

    ok.addEventListener("change", function () { make.disabled = !ok.checked; });
    make.addEventListener("click", function () {
      make.disabled = true;
      readQuadBox().then(function (games) {
        var file;
        try { file = build(undefined, games); }
        catch (e) { note.textContent = "Could not read this device's results."; return; }
        note.textContent = summary(file);
        if (file.answers) Kit.download(file);
      }).then(function () { make.disabled = !ok.checked; });
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
    else wire();
  }

  return { build: build, summary: summary, participantId: Kit.participantId };
})();

if (typeof module !== "undefined") module.exports = Share;

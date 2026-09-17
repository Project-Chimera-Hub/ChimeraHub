"use strict";

/* ============================================================
   WHAT YOU HAVE DONE TODAY
   ============================================================

   The archive already knows how to turn any trainer's storage into minutes per
   day — that is `adapters.js`, and it is the only code in this project that
   understands eight different formats. So the shell does not count anything
   itself. It hands the same snapshots to the same adapters the archive uses on
   a dropped file, and reads `minutes[today]` back out.

   That is the point of putting the trainers on one origin. Not a shared menu —
   a shared meter, running off code that was already written and already has to
   be right for the archive to be worth anything.

   Two consequences worth stating:

   - The day is UTC, because the record is UTC. A shell that split the day at
     local midnight would disagree with the archive about what "today" holds,
     and then there would be two answers to the only question this page asks.
   - Reading is all this does. The shell never writes to a trainer's keys. The
     trainers own their storage; if this file has a bug the worst case is a
     wrong number on a dashboard, not a damaged record.
*/

var Today = (function () {

  /* The same list `importNeighbours` walks in the archive, in the same order,
     for the same reason: these are the trainers that keep their whole state
     under one key. Kept in sync by hand — there are eight of them and they
     change about once a year. */
  var SINGLE_KEY = [
    { key: "mp_prog", source: "cct" },
    { key: "rrt_prog", source: "rrt" },
    { key: "attentional_shield_v2", source: "ewmt" },
    { key: "synth5_en", source: "synth" },
    { key: "nback-performance", source: "precision" },
    { key: "spatial-rotation.progress.v1", source: "rotation" },
  ];

  function utcDay(d) { return new Date(d || Date.now()).toISOString().slice(0, 10); }

  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  /** One adapter run, guarded: a trainer with a half-written key must not take
      the whole dashboard down with it. */
  function readOne(text) {
    try {
      var out = readFile(text);
      return out && !out.error ? out : null;
    } catch (e) { return null; }
  }

  /**
   * Every trainer's minutes for one day, keyed by source.
   * Sources with nothing today are absent rather than zero — "has not trained"
   * and "trained for no time" are the same fact here, and the caller decides
   * how to show it.
   */
  function minutesOn(day) {
    day = day || utcDay();
    var out = {};

    function take(reading) {
      if (!reading || !reading.minutes) return;
      var m = Number(reading.minutes[day]) || 0;
      if (m > 0) out[reading.source] = (out[reading.source] || 0) + m;
    }

    /* Syllogimous spreads itself over many keys and is recognised by the shape
       of the whole bag, so it is gathered before it is read. */
    try {
      var syl = {}, found = false;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k.indexOf("SYL_") === 0 || k.indexOf("syllogimous-") === 0)) {
          syl[k] = localStorage.getItem(k);
          found = true;
        }
      }
      if (found && (syl.SYL_HISTORY || syl.SYL_HISTORY_IDX)) take(readOne(JSON.stringify(syl)));
    } catch (e) { /* storage off */ }

    for (var s = 0; s < SINGLE_KEY.length; s++) {
      var val = get(SINGLE_KEY[s].key);
      if (!val) continue;
      var wrap = {};
      wrap[SINGLE_KEY[s].key] = val;
      take(readOne(JSON.stringify(wrap)));
    }

    /* RNB keeps one record per profile, and a day's training may be spread
       across several of them. */
    try {
      var profiles = JSON.parse(get("rnb.profiles.v1") || "null");
      var list = (profiles && profiles.list) || [];
      for (var j = 0; j < list.length; j++) {
        var raw = get("rnb.progress.v2." + list[j].id);
        if (raw) take(readOne(raw));
      }
    } catch (e) { /* no rnb here */ }

    return out;
  }

  /**
   * The number the gate cares about: today's training in minutes.
   *
   * The archive is not in it and cannot be — it is not a trainer and has no
   * adapter pointed at its own storage. Stated here anyway, because the gate
   * is a rule about time and the first thing anyone asks of a rule is what it
   * does not cover: sorting your record is not a session, and must never be a
   * way to buy one back.
   */
  function totalMinutes(day) {
    var by = minutesOn(day), sum = 0;
    for (var s in by) if (Object.prototype.hasOwnProperty.call(by, s)) sum += by[s];
    return sum;
  }

  /** Consecutive days ending today — or ending yesterday, if today is still
      empty, so the streak does not read as broken before you have started. */
  function streak() {
    var day = new Date(), n = 0;
    if (totalMinutes(utcDay(day)) <= 0) day.setUTCDate(day.getUTCDate() - 1);
    for (var guard = 0; guard < 400; guard++) {
      if (totalMinutes(utcDay(day)) <= 0) break;
      n++;
      day.setUTCDate(day.getUTCDate() - 1);
    }
    return n;
  }

  return {
    utcDay: utcDay,
    minutesOn: minutesOn,
    totalMinutes: totalMinutes,
    streak: streak,
  };
})();

if (typeof module !== "undefined") module.exports = Today;

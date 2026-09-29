"use strict";

/* ============================================================
   SHARING YOUR ANSWERS, ON PURPOSE
   ============================================================

   A file the player makes, looks at, and uploads themselves. Nothing here
   sends anything: the hub builds the file in the page, the browser saves it,
   and the upload is a link the player follows. So the rule every other file in
   this directory keeps — the hub makes no request of anyone — still holds.

   What goes in is the smallest record that answers the questions the file is
   for (what a carousel costs, how a mode's difficulty grows): per answer, the
   mode, how hard it was priced, how it was shown, whether it was right and how
   long it took. What stays out is everything else a Syllogimous backup
   carries — the premises and explanations as written, theme, keybinds, goals,
   and the exact time of day. The day is kept, because learning happens over
   days; the order within a day is kept as a sequence number and not a clock.

   The two apps are read through the archive's own adapters, the same way the
   meter reads them, so this file agrees with the record about what an answer
   is and whether it was right.

   The participant id is random and made on this device. It links one
   player's files together and is what they quote to have them deleted; it
   says nothing about who they are.
*/

var Share = (function () {

  var ID_KEY = "mindbuild.share.id";
  var FORMAT = "mindbuild-share";
  var VERSION = 1;

  function participantId(storage) {
    storage = storage || localStorage;
    var id = null;
    try { id = storage.getItem(ID_KEY); } catch (e) { /* storage off */ }
    if (id && /^[0-9a-f]{16}$/.test(id)) return id;

    var bytes = new Uint8Array(8);
    (typeof crypto !== "undefined" ? crypto : require("crypto").webcrypto).getRandomValues(bytes);
    id = Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    try { storage.setItem(ID_KEY, id); } catch (e) { /* a new id each time, then */ }
    return id;
  }

  /** The two Syllogimous-shaped bags, gathered as `Today` gathers them. */
  function bags(storage) {
    var syl = {}, iso = {}, any = false, anyIso = false;
    for (var i = 0; i < storage.length; i++) {
      var k = storage.key(i);
      if (!k) continue;
      if (k.indexOf("ISO/") === 0) { iso[k] = storage.getItem(k); anyIso = true; }
      else if (k.indexOf("SYL_") === 0 || k.indexOf("syllogimous-") === 0) {
        syl[k] = storage.getItem(k); any = true;
      }
    }
    var out = [];
    if (any) out.push(syl);
    if (anyIso) out.push(iso);
    return out;
  }

  function row(r) {
    var raw = r.raw || {};
    var q = raw.item || {};
    var d = q.difficulty || {};
    var isLevel = typeof r.unit === "string" && /-level$/.test(r.unit);
    return {
      app: r.source,
      mode: r.label,
      level: isLevel && typeof r.difficulty === "number" ? Math.round(r.difficulty * 100) / 100 : null,
      premises: Array.isArray(q.premises) ? q.premises.length : null,
      rungs: Array.isArray(d.rungs) ? d.rungs.slice() : [],
      clock: typeof d.seconds === "number" ? d.seconds : null,
      /* "0" one card, "1"/"2" the carousels, null when the app did not record it. */
      presentation: raw.presentation == null ? null : String(raw.presentation),
      timer: raw.timer == null ? null : String(raw.timer),
      answerMode: raw.answerMode || null,
      correct: r.correct,
      seconds: typeof r.seconds === "number" ? Math.round(r.seconds * 10) / 10 : null,
      day: new Date(r.at).toISOString().slice(0, 10),
      at: r.at,
    };
  }

  /**
   * The file, as an object. `storage` is anything shaped like localStorage;
   * `now` fixes the date on it.
   */
  function build(storage, now) {
    storage = storage || localStorage;
    var rows = [];
    bags(storage).forEach(function (bag) {
      var reading;
      try { reading = readFile(JSON.stringify(bag)); } catch (e) { reading = null; }
      if (!reading || reading.error || !reading.records) return;
      reading.records.forEach(function (r) { rows.push(row(r)); });
    });

    rows.sort(function (a, b) { return a.at - b.at; });
    var seq = {};
    rows.forEach(function (r) {
      seq[r.day] = (seq[r.day] || 0) + 1;
      r.seq = seq[r.day];
      delete r.at;
    });

    var apps = {}, modes = {};
    rows.forEach(function (r) {
      apps[r.app] = (apps[r.app] || 0) + 1;
      modes[r.app + "/" + r.mode] = true;
    });

    return {
      format: FORMAT,
      version: VERSION,
      participant: participantId(storage),
      made: new Date(now || Date.now()).toISOString().slice(0, 10),
      answers: rows.length,
      modes: Object.keys(modes).length,
      apps: apps,
      rows: rows,
    };
  }

  function summary(file) {
    if (!file.answers) return "No Syllogimous or Isomorph answers on this device yet.";
    var days = {};
    file.rows.forEach(function (r) { days[r.day] = true; });
    return file.answers + " answers, " + file.modes + " modes, "
      + Object.keys(days).length + " days. Participant " + file.participant + ".";
  }

  function download(file) {
    var blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mindbuild-data_" + file.participant + "_" + file.made + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function wire() {
    var ok = document.getElementById("share-ok");
    var make = document.getElementById("share-make");
    var note = document.getElementById("share-note");
    if (!ok || !make) return;

    ok.addEventListener("change", function () { make.disabled = !ok.checked; });
    make.addEventListener("click", function () {
      var file;
      try { file = build(); } catch (e) { note.textContent = "Could not read this device's answers."; return; }
      note.textContent = summary(file);
      if (file.answers) download(file);
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
    else wire();
  }

  return { build: build, summary: summary, participantId: participantId };
})();

if (typeof module !== "undefined") module.exports = Share;

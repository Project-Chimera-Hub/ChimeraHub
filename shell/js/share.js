"use strict";

/* ============================================================
   SHARING YOUR ANSWERS, ON PURPOSE
   ============================================================

   The hub's use of share-kit (shared/share-kit/), which does the part any
   tool could use: the fixed row shape, the participant id, the file, and the
   validation a collector runs on it. What is here is the part only this hub
   knows — where Syllogimous and Isomorph keep their answers.

   They are read through the archive's own adapters, the same way the meter
   reads them, so the file agrees with the record about what an answer is and
   whether it was right. Nothing is sent: the browser saves the file and the
   player uploads it through a link, so the hub still makes no request of
   anyone.
*/

var Share = (function () {

  var Kit = typeof ShareKit !== "undefined" ? ShareKit : require("../../shared/share-kit/share-kit.js");

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

  function answer(r) {
    var raw = r.raw || {};
    var q = raw.item || {};
    var d = q.difficulty || {};
    var isLevel = typeof r.unit === "string" && /-level$/.test(r.unit);
    return {
      app: r.source,
      mode: r.label,
      at: r.at,
      correct: r.correct,
      seconds: r.seconds,
      level: isLevel && typeof r.difficulty === "number" ? r.difficulty : null,
      premises: Array.isArray(q.premises) ? q.premises.length : null,
      rungs: d.rungs,
      clock: typeof d.seconds === "number" ? d.seconds : null,
      /* "0" one card, "1"/"2" the carousels, null when the app did not record it. */
      presentation: raw.presentation,
      timer: raw.timer,
      answerMode: raw.answerMode,
    };
  }

  /** The file, as an object. `storage` is anything shaped like localStorage. */
  function build(storage, now) {
    storage = storage || localStorage;
    var answers = [];
    bags(storage).forEach(function (bag) {
      var reading;
      try { reading = readFile(JSON.stringify(bag)); } catch (e) { reading = null; }
      if (!reading || reading.error || !reading.records) return;
      reading.records.forEach(function (r) { answers.push(answer(r)); });
    });
    return Kit.makeFile(answers, { tool: "mindbuild", storage: storage, now: now }).file;
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
      note.textContent = file.answers ? Kit.summary(file) : "No Syllogimous or Isomorph answers on this device yet.";
      if (file.answers) Kit.download(file);
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
    else wire();
  }

  return { build: build, participantId: Kit.participantId };
})();

if (typeof module !== "undefined") module.exports = Share;

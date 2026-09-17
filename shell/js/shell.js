"use strict";

/* ============================================================
   THE SHELL
   ============================================================

   A hub, a frame to run a trainer in, and a meter. That is all it is, and the
   restraint is the design: seven working trainers were merged here by moving
   them, not by rewriting them, and every line this file adds to their runtime
   is a line that can break one of them.

   So the shell never touches a trainer's storage, never injects script into a
   frame, and never asks a trainer to report anything. It reads the same keys
   the archive reads, through the same adapters, from outside. A trainer that
   knows nothing about this page works here exactly as well as one that does —
   which is the only reason eight repositories could be merged in an afternoon.
*/

(function () {

  var BASE = document.body.dataset.base || "/";

  /* Colour is per source and used twice: the segment in the day's bar and the
     dot on the card. Chosen to stay apart on a dark ground and to survive the
     common colour-blindness — the trainers include a grapheme-colour synaesthesia
     trainer, and a dashboard that miscodes colour in front of that would be a
     poor joke. */
  var TRAINERS = [
    { id: "syllogimous", name: "Syllogimous", path: "syllogimous/", colour: "#6cb6ff",
      what: "Relational and syllogistic reasoning" },
    { id: "rnb", name: "Relational N-back", path: "rnb/", colour: "#3fb950",
      what: "N-back over relations, with a ladder" },
    { id: "precision", name: "Precision N-back", path: "precision/", colour: "#d29922",
      what: "N-back with a tighter response window" },
    { id: "rotation", name: "3D Rotation", path: "rotation/", colour: "#db6d9d",
      what: "Mental rotation of molecules" },
    { id: "cct", name: "CCT", path: "cct/", colour: "#a371f7",
      what: "Spoken arithmetic against the clock" },
    { id: "ewmt", name: "eWMT", path: "ewmt/", colour: "#ff7b72",
      what: "Attentional shield n-back" },
    { id: "rrt", name: "Running Order", path: "rrt/", colour: "#ffa657",
      what: "A running order of symbols, against the clock" },
    { id: "synth", name: "Synaesthesia colours", path: "synth/", colour: "#56d4dd",
      what: "Grapheme–colour association" },
  ];

  /* Stageable, but never a trainer.
   *
   * The archive was in neither list to begin with, so `#/archive` matched the
   * route and then found nothing to open, fell through to the hub, and the only
   * way in was the sidebar link — which is a full page navigation out of the
   * shell, to a page with no way back. That is the whole of "you cannot get
   * back to the menu": not a missing button, a missing entry.
   *
   * It stays out of TRAINERS because TRAINERS is what the meter sums. Being
   * openable and being training are different things, and this is the one app
   * where they come apart. */
  var ARCHIVE = { id: "archive", name: "Training archive", path: "archive/",
                  colour: "var(--dim)", what: "The record. Not training." };

  var byId = {};
  TRAINERS.concat([ARCHIVE]).forEach(function (t) { byId[t.id] = t; });

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------------------------------------------------------- *
   * The quota                                                        *
   * ---------------------------------------------------------------- */

  /* The shell's own setting, and the only key it writes. Namespaced like every
     other app on this origin so it cannot collide with one of theirs. */
  var QUOTA_KEY = "mindbuild.quota.minutes";

  function quota() {
    var n = Number(localStorage.getItem(QUOTA_KEY));
    return isFinite(n) && n > 0 ? n : 20;
  }

  var CAPS_KEY = "mindbuild.quota.caps";

  /** Per-source ceilings as a share of the counted day. See shared/quota.js. */
  function caps() {
    try {
      var c = JSON.parse(localStorage.getItem(CAPS_KEY) || "null");
      if (c && typeof c === "object") return c;
    } catch (e) { /* fall through to the defaults */ }
    return QuotaPolicy.DEFAULT_CAPS;
  }

  /* ---------------------------------------------------------------- *
   * Counting, at most once per change                                *
   * ---------------------------------------------------------------- */

  /*
   * `Today.minutesOn()` runs every adapter over the whole of localStorage.
   * On a real account that is ~30ms of synchronous main-thread work — one
   * Syllogimous history of a thousand items is half of it on its own.
   *
   * Thirty milliseconds is nothing on a hub that is sitting still. It is not
   * nothing inside a frame presenting stimuli on a fixed interval, and this
   * shell was doing it every thirty seconds *while a trainer was playing*,
   * because the heartbeat recounted on a timer and the timer did not care what
   * was on screen. The two trainers that suffer are exactly the two that are
   * timing-critical — an n-back with millisecond pacing and an arithmetic task
   * that adapts to your response time — and a stall lands as a mistimed
   * stimulus or a dropped response rather than as anything that looks like a
   * bug in the shell.
   *
   * So: count when the answer can have changed, and never on a clock. A
   * trainer writing its progress raises a storage event in every other frame
   * on this origin, which is precisely the moment the number is stale and no
   * other moment is.
   */
  var counted = null;

  function currentCount() {
    if (counted) return counted;
    var raw = Today.minutesOn(), by = {};
    /* Only trainers reach the policy. The archive cannot appear in `raw` — it
       has no adapter pointed at its own storage — but the filter keeps that
       true of anything added later without someone having to remember. */
    TRAINERS.forEach(function (t) { if (raw[t.id]) by[t.id] = raw[t.id]; });
    counted = QuotaPolicy.apply(by, caps());
    return counted;
  }

  /** The next read recounts. Cheap, and the only way the count goes stale. */
  function invalidate() { counted = null; }

  /* ---------------------------------------------------------------- *
   * Rendering                                                        *
   * ---------------------------------------------------------------- */

  function fmt(mins) {
    if (mins < 1) return mins > 0 ? "<1" : "0";
    return String(Math.round(mins));
  }

  function renderToday() {
    var q = currentCount();
    var total = q.total;

    $("fig").innerHTML = fmt(total) + "<small> min today</small>";

    var n = Today.streak();
    $("streak").textContent = n > 1 ? n + " day streak" : n === 1 ? "1 day" : "";

    /* Segments are drawn against the quota, not against the day's total, so the
       bar fills up rather than just redistributing. Past the quota it is full
       and the proportions stop mattering. */
    var scale = Math.max(total, quota());
    var bar = $("bar");
    bar.textContent = "";
    TRAINERS.forEach(function (t) {
      var m = q.counted[t.id] || 0;
      if (m <= 0) return;
      var seg = document.createElement("div");
      seg.className = "bar__seg";
      seg.style.width = (m / scale * 100) + "%";
      seg.style.background = t.colour;
      seg.title = t.name + ": " + fmt(m) + " min";
      bar.appendChild(seg);
    });

    var need = quota() - total;
    var el = $("quota");
    el.className = "quota" + (need <= 0 ? " met" : "");
    el.innerHTML = need <= 0
      ? "<b>Quota met.</b> " + fmt(quota()) + " min was the ask."
      : "<b>" + fmt(need) + " min</b> to go of " + fmt(quota()) + ".";

    /* Said out loud, because a capped day is otherwise a day where the number
       is smaller than the time and nothing on the page explains why. */
    var why = QuotaPolicy.explain(q, caps());
    if (why) {
      var span = document.createElement("span");
      span.className = "dim";
      span.textContent = why;
      el.appendChild(span);
    }

    /* Cards carry their own share, so the grid answers "what have I neglected"
       without a second pass over the page. */
    TRAINERS.forEach(function (t) {
      var el = document.getElementById("today-" + t.id);
      if (!el) return;
      var m = q.counted[t.id] || 0, was = q.raw[t.id] || 0;
      el.innerHTML = was <= 0 ? "—"
        : m < was - 0.5
          ? "<b>" + fmt(m) + " min</b> counted of " + fmt(was)
          : "<b>" + fmt(m) + " min</b> today";
    });
  }

  function renderGrid() {
    var grid = $("grid");
    grid.textContent = "";
    TRAINERS.forEach(function (t) {
      var a = document.createElement("a");
      a.className = "card";
      a.href = "#/" + t.id;
      a.innerHTML =
        '<span class="card__name"><span class="card__dot"></span>' + t.name + "</span>" +
        '<div class="card__what"></div>' +
        '<div class="card__today" id="today-' + t.id + '">—</div>';
      a.querySelector(".card__dot").style.background = t.colour;
      a.querySelector(".card__what").textContent = t.what;
      grid.appendChild(a);
    });
  }

  /* ---------------------------------------------------------------- *
   * The stage                                                        *
   * ---------------------------------------------------------------- */

  var openedAt = 0;
  var current = null;

  function show(id) {
    var t = byId[id];
    if (!t) return home();

    /* Only reload when the trainer actually changes. Re-assigning src to the
       page already in the frame restarts it, and a restart mid-block loses the
       block. */
    if (current !== id) {
      $("frame").src = BASE + t.path;
      current = id;
      openedAt = Date.now();
    }
    $("stage-name").textContent = t.name;
    $("standalone").href = BASE + t.path;
    $("stage").hidden = false;
    $("hub").hidden = true;
    document.title = t.name + " — mindbuild";
  }

  function home() {
    $("stage").hidden = true;
    $("hub").hidden = false;
    document.title = "mindbuild";
    /* Recount here rather than on a timer: returning to the hub is both the
       moment the number is worth having and a moment when nothing is being
       timed, so this is the one place the sweep is free. */
    invalidate();
    renderToday();
  }

  function route() {
    var m = /^#\/([a-z0-9-]+)$/.exec(location.hash || "");
    if (m && byId[m[1]]) show(m[1]);
    else home();
  }

  function tick() {
    if ($("stage").hidden || !openedAt) return;
    var s = Math.floor((Date.now() - openedAt) / 1000);
    $("clock").textContent =
      Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + " in this session";
  }

  /* ---------------------------------------------------------------- *
   * Files dropped on the shell                                       *
   * ---------------------------------------------------------------- */

  /**
   * Open the archive and give it the files.
   *
   * Same origin, so the archive's own `takeFiles` is callable directly — no
   * postMessage protocol, and nothing added to the archive for the shell's
   * benefit. If it is not ready yet the drop waits for its load rather than
   * being dropped on the floor, because a file the user has already let go of
   * cannot be asked for again.
   */
  function handOffToArchive(files) {
    var wasOpen = current === "archive";
    location.hash = "#/archive";

    var tries = 0;
    (function give() {
      var frame = $("frame");
      var win = null;
      try { win = frame.contentWindow; } catch (e) { /* not ready */ }

      if (win && typeof win.takeFiles === "function") {
        win.takeFiles(files);
        if (!wasOpen) win.focus();
        return;
      }
      /* Twenty seconds at 250ms. The archive is a local page; if it has not
         come up by then something is wrong that retrying will not fix. */
      if (++tries < 80) setTimeout(give, 250);
    })();
  }

  /* ---------------------------------------------------------------- *
   * The gate                                                         *
   * ---------------------------------------------------------------- */

  /* The daemon runs on this machine and the page may be served from anywhere,
     so this is a cross-origin request to localhost that will simply fail when
     no gate is installed — which is the common case and not an error worth
     showing as one. */
  var GATE = "http://127.0.0.1:8787";

  /* No gate on most machines, so the common case is a request that fails. Two
     things follow: it must not recount to build a body nobody reads, and it
     must stop asking so often — an unreachable localhost POST every thirty
     seconds is a console full of network errors and a wakeup for nothing. */
  var beatMisses = 0;
  var beatTimer = null;

  function scheduleHeartbeat() {
    clearTimeout(beatTimer);
    /* 30s while a gate is answering; backing off to five minutes once it is
       clear there is not one. Any success resets it. */
    var delay = beatMisses >= 3 ? 300000 : 30000;
    beatTimer = setTimeout(function () { heartbeat(); scheduleHeartbeat(); }, delay);
  }

  /* The gate's config is the quota. The page kept a default of its own, so
     setting 120 minutes in gate.json locked the machine for 120 while the hub
     went on saying 20 — two answers to the one question this page exists to
     answer. Whatever the gate reports wins, and is remembered, so the hub still
     shows it on a visit when the gate cannot be reached. */
  function adoptGateSettings(state) {
    if (!state) return;
    var changed = false;
    try {
      var req = Number(state.required);
      if (isFinite(req) && req > 0 && String(req) !== localStorage.getItem(QUOTA_KEY)) {
        localStorage.setItem(QUOTA_KEY, String(req));
        changed = true;
      }
      if (state.caps && typeof state.caps === "object") {
        var c = JSON.stringify(state.caps);
        if (c !== localStorage.getItem(CAPS_KEY)) {
          localStorage.setItem(CAPS_KEY, c);
          changed = true;
        }
      }
    } catch (e) { /* storage off: the page just keeps its defaults */ }
    if (changed) {
      invalidate();
      if (!$("hub").hidden) renderToday();
    }
  }

  function heartbeat() {
    var applied = currentCount();

    fetch(GATE + "/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ day: Today.utcDay(), minutes: applied.total, bySource: applied.counted }),
    }).then(function (r) { return r.json(); }).then(function (state) {
      beatMisses = 0;
      adoptGateSettings(state);
      $("gate-state").textContent = state.armed
        ? "Armed. " + fmt(state.required) + " min required; the lock lifts when the day's total reaches it."
        : "Installed, not armed.";
    }).catch(function () {
      beatMisses++;
      $("gate-state").textContent =
        "Not running on this machine. The quota above is advice only until the gate is installed.";
    });
  }

  /* ---------------------------------------------------------------- *
   * Wiring                                                           *
   * ---------------------------------------------------------------- */

  renderGrid();
  route();
  $("archive-link").href = "#/archive";
  $("back").addEventListener("click", function () { location.hash = ""; });
  window.addEventListener("hashchange", route);

  /* A trainer writing its progress is a storage event in every other frame on
     this origin but its own — so the meter follows a session as it happens,
     without the shell having to ask the trainer anything. The interval is the
     fallback for the apps that batch their writes. */
  /* A file dropped on any page the browser has not been told to expect one on
     is a navigation: the window leaves for the JSON and the shell is gone,
     which reads exactly like "it would not take the file". The archive guards
     its own drop zone, but the hub, the stage bar and every trainer are all
     fair game, and the target is small on a page this size.
     
     So the shell catches the whole window, and rather than merely refusing the
     drop it does the obvious thing with it — opens the archive and hands the
     file over. Dropping an export anywhere in the app now imports it. */
  window.addEventListener("dragover", function (e) {
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  });

  window.addEventListener("drop", function (e) {
    var files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    e.preventDefault();
    handOffToArchive(files);
  });

  /* The one signal that the day's total has moved. It fires in this document
     because the write happened in the frame, which is a different browsing
     context on the same origin — so the meter follows a session without the
     shell polling for it and without the trainer reporting anything. */
  window.addEventListener("storage", function () {
    invalidate();
    if (!$("hub").hidden) renderToday();
  });

  /* Coming back to the hub is the other moment the number is worth having, and
     it is a moment when nothing is being timed. */
  setInterval(tick, 1000);
  scheduleHeartbeat();
  heartbeat();
})();

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
    { id: "synth", name: "Synaesthesia colours", path: "synth/", colour: "#56d4dd",
      what: "Grapheme–colour association" },
  ];

  var byId = {};
  TRAINERS.forEach(function (t) { byId[t.id] = t; });

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

  /* ---------------------------------------------------------------- *
   * Rendering                                                        *
   * ---------------------------------------------------------------- */

  function fmt(mins) {
    if (mins < 1) return mins > 0 ? "<1" : "0";
    return String(Math.round(mins));
  }

  function renderToday() {
    var by = Today.minutesOn();
    var total = 0;
    TRAINERS.forEach(function (t) { total += by[t.id] || 0; });

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
      var m = by[t.id] || 0;
      if (m <= 0) return;
      var seg = document.createElement("div");
      seg.className = "bar__seg";
      seg.style.width = (m / scale * 100) + "%";
      seg.style.background = t.colour;
      seg.title = t.name + ": " + fmt(m) + " min";
      bar.appendChild(seg);
    });

    var need = quota() - total;
    var q = $("quota");
    q.className = "quota" + (need <= 0 ? " met" : "");
    q.innerHTML = need <= 0
      ? "<b>Quota met.</b> " + fmt(quota()) + " min was the ask."
      : "<b>" + fmt(need) + " min</b> to go of " + fmt(quota()) + ".";

    /* Cards carry their own share, so the grid answers "what have I neglected"
       without a second pass over the page. */
    TRAINERS.forEach(function (t) {
      var el = document.getElementById("today-" + t.id);
      if (!el) return;
      var m = by[t.id] || 0;
      el.innerHTML = m > 0 ? "<b>" + fmt(m) + " min</b> today" : "—";
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
   * The gate                                                         *
   * ---------------------------------------------------------------- */

  /* The daemon runs on this machine and the page may be served from anywhere,
     so this is a cross-origin request to localhost that will simply fail when
     no gate is installed — which is the common case and not an error worth
     showing as one. */
  var GATE = "http://127.0.0.1:8787";

  function heartbeat() {
    var by = Today.minutesOn(), total = 0;
    TRAINERS.forEach(function (t) { total += by[t.id] || 0; });

    fetch(GATE + "/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ day: Today.utcDay(), minutes: total, bySource: by }),
    }).then(function (r) { return r.json(); }).then(function (state) {
      $("gate-state").textContent = state.armed
        ? "Armed. " + fmt(state.required) + " min required; the lock lifts when the day's total reaches it."
        : "Installed, not armed.";
    }).catch(function () {
      $("gate-state").textContent =
        "Not running on this machine. The quota above is advice only until the gate is installed.";
    });
  }

  /* ---------------------------------------------------------------- *
   * Wiring                                                           *
   * ---------------------------------------------------------------- */

  renderGrid();
  route();
  $("archive-link").href = BASE + "archive/";
  $("back").addEventListener("click", function () { location.hash = ""; });
  window.addEventListener("hashchange", route);

  /* A trainer writing its progress is a storage event in every other frame on
     this origin but its own — so the meter follows a session as it happens,
     without the shell having to ask the trainer anything. The interval is the
     fallback for the apps that batch their writes. */
  window.addEventListener("storage", function () { if (!$("hub").hidden) renderToday(); });
  setInterval(function () { if (!$("hub").hidden) renderToday(); }, 15000);
  setInterval(tick, 1000);
  setInterval(heartbeat, 30000);
  heartbeat();
})();

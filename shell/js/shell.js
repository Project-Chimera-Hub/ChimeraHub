"use strict";

/* ============================================================
   THE SHELL
   ============================================================

   A hub, a frame to run a trainer in, and a meter. That is all it is, and the
   restraint is the design: the trainers were merged here by moving them, not
   by rewriting them, and every line this file adds to their runtime is a line
   that can break one of them.

   So the shell never touches a trainer's storage, never injects script into a
   frame, and never asks a trainer to report anything. It reads the same keys
   the archive reads, through the same adapters, from outside. A trainer that
   knows nothing about this page works here exactly as well as one that does —
   which is the only reason a hub of separate repositories works at all.
*/

(function () {

  var BASE = document.body.dataset.base || "/";

  /* Every trainer and every category is in catalog.js. TRAINERS is the counted
     ones — what the meter sums, the bar draws and the quota is applied to —
     and the rest are openable from the menu but kept off the day, because no
     adapter reads their storage. Colour is per source and used twice: the
     segment in the day's bar and the dot on the card. */
  var ALL = CATALOG.trainers;
  var TRAINERS = ALL.filter(function (t) { return t.counted; });

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
  ALL.concat([ARCHIVE]).forEach(function (t) { byId[t.id] = t; });

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------------------------------------------------------- *
   * The quota                                                        *
   * ---------------------------------------------------------------- */

  /* The shell's own setting. Namespaced like every other app on this origin so
     it cannot collide with one of theirs. */
  var QUOTA_KEY = "mindbuild.quota.minutes";

  /* What the bar is drawn against when nobody has said otherwise. It is not a
     demand in that case — see renderToday — only a floor, so that four minutes
     does not fill the bar. */
  var DEFAULT_QUOTA = 20;

  function quota() {
    return goal() || DEFAULT_QUOTA;
  }

  /** The number somebody actually chose, or 0 if nobody has. */
  function goal() {
    try {
      var n = Number(localStorage.getItem(QUOTA_KEY));
      return isFinite(n) && n > 0 ? Math.min(1440, n) : 0;
    } catch (e) { return 0; }
  }

  function setGoal(mins) {
    try {
      if (mins > 0) localStorage.setItem(QUOTA_KEY, String(mins));
      else localStorage.removeItem(QUOTA_KEY);
    } catch (e) { /* storage off: the goal lasts as long as the page does */ }
    invalidate();
    renderToday();
    renderGoal();
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
    renderWall();

    var n = Today.streak();
    $("streak").textContent = n > 1 ? n + " day streak" : n === 1 ? "1 day" : "";

    /* Segments are drawn against the quota, not against the day's total, so the
       bar fills up rather than just redistributing. Past the quota it is full
       and the proportions stop mattering. With no goal set the default is still
       the floor the bar is drawn against — unnamed, and only so that four
       minutes does not fill it. */
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

    /* A line only where there is a number somebody stands behind: a goal the
       person set themselves. Without one, "12 min to go" would be a demand
       invented by the page making it. What happened is true either way, so the
       figure, the bar and the caps below stay regardless. */
    var el = $("quota");
    el.className = "quota";
    el.innerHTML = "";
    if (goal()) {
      var need = quota() - total;
      var word = "Goal";
      el.className = "quota" + (need <= 0 ? " met" : "");
      el.innerHTML = need <= 0
        ? "<b>" + word + " met.</b> " + fmt(quota()) + " min was the ask."
        : "<b>" + fmt(need) + " min</b> to go of " + fmt(quota()) + ".";
    }

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
      var m = q.counted[t.id] || 0, was = q.raw[t.id] || 0;
      var html = was <= 0 ? "—"
        : m < was - 0.5
          ? "<b>" + fmt(m) + " min</b> counted of " + fmt(was)
          : "<b>" + fmt(m) + " min</b> today";
      /* By attribute, not id: a trainer in two categories has two cards. */
      var els = document.querySelectorAll('[data-today="' + t.id + '"]');
      for (var i = 0; i < els.length; i++) els[i].innerHTML = html;
    });
  }

  /* The field, its buttons and the sentence under them. Rendered rather than
     written once, because two things move it: the person, and a storage event
     from another tab of the hub — same origin, same key. */
  function renderGoal() {
    var input = $("goal");
    if (!input) return;
    var n = goal();

    if (document.activeElement !== input) input.value = n || "";
    input.placeholder = String(DEFAULT_QUOTA);
    $("goal-clear").disabled = !n;

    $("goal-note").textContent = n
      ? "Aiming at " + fmt(n) + " min a day. Kept in this browser, on this device."
      : "No goal set. The day is counted either way — a goal only gives it "
        + "something to be measured against.";
  }

  /* Read out of the field and applied. Anything that is not a number above zero
     is not a goal, and the field goes back to saying what is actually stored
     rather than leaving a rejected value sitting in it. */
  function commitGoal() {
    var n = Math.round(Number($("goal").value));
    if (!isFinite(n) || n <= 0) { renderGoal(); return; }
    setGoal(Math.min(1440, n));
  }

  function card(t) {
    var a = document.createElement("a");
    a.className = "card" + (t.counted ? "" : " card--uncounted");
    a.href = "#/" + t.id;
    a.innerHTML =
      '<span class="card__name"><span class="card__dot"></span>' + t.name + "</span>" +
      '<div class="card__what"></div>' +
      (t.counted
        ? '<div class="card__today" data-today="' + t.id + '">—</div>'
        : '<div class="card__today" title="No adapter reads this trainer\'s records, '
          + 'so its time is not counted toward today or the quota.">Not counted</div>') +
      '<span class="card__enter">Enter →</span>';
    a.querySelector(".card__dot").style.background = t.colour;
    a.querySelector(".card__what").textContent = t.what;
    return a;
  }

  /* One box per category, in the catalog's order, each holding every trainer
     that lists it. Empty ones stay on the page, closed, with a way to submit
     a trainer for them — an empty shelf says what the hub is looking for.

     Counting is no longer told apart by which box a card sits in but by the
     card itself: "Not counted" where the minutes would be, and a dashed edge,
     the same dash the uncounted box used to have. */
  function renderGrid() {
    var root = $("cats");
    root.textContent = "";
    CATALOG.categories.forEach(function (c) {
      var members = ALL.filter(function (t) { return t.categories.indexOf(c.id) >= 0; });

      var box = document.createElement("details");
      box.className = "cat" + (members.length ? "" : " cat--empty");
      box.id = "cat-" + c.id;
      box.open = members.length > 0;

      var head = document.createElement("summary");
      head.className = "cat__head";
      head.innerHTML = '<span class="cat__name"></span><span class="cat__full"></span>'
        + '<span class="cat__count"></span>';
      head.querySelector(".cat__name").textContent = c.name;
      head.querySelector(".cat__full").textContent = c.full !== c.name ? c.full : "";
      head.querySelector(".cat__count").textContent = members.length ? String(members.length) : "empty";
      box.appendChild(head);

      var about = document.createElement("p");
      about.className = "cat__about";
      about.textContent = c.about + " ";
      if (!members.length) {
        var link = document.createElement("a");
        link.href = CATALOG.submit;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "No trainer here yet — submit one ↗";
        about.appendChild(link);
      }
      box.appendChild(about);

      if (members.length) {
        var grid = document.createElement("div");
        grid.className = "grid";
        members.forEach(function (t) { grid.appendChild(card(t)); });
        box.appendChild(grid);
      }
      root.appendChild(box);
    });
  }

  /* ---------------------------------------------------------------- *
   * The stage                                                        *
   * ---------------------------------------------------------------- */

  /*
   * The frame asks for `cct/index.html`, not `cct/`.
   *
   * A web server resolves a directory to its index and the two are the same
   * request. The Android build's server does not: Capacitor answers any path
   * whose last segment has no dot with the application's own root index, which
   * is the usual way a single-page app keeps its routes working. Here it meant
   * every trainer's frame was served the hub again — nine cards that opened
   * onto a copy of the page they were on.
   *
   * Naming the file is the whole fix, and it is the same request everywhere
   * else, so there is nothing conditional about it.
   */
  var openedAt = 0;
  var current = null;

  function show(id) {
    var t = byId[id];
    if (!t) return home();

    /* Only reload when the trainer actually changes. Re-assigning src to the
       page already in the frame restarts it, and a restart mid-block loses the
       block. */
    if (current !== id) {
      $("frame").src = BASE + t.path + "index.html";
      current = id;
      openedAt = Date.now();
    }
    $("stage-name").textContent = t.name;
    $("standalone").href = BASE + t.path;
    $("stage").hidden = false;
    $("hub").hidden = true;
    document.title = t.name + " — Chimera Hub";
    /* Hand the frame back to the browser. Unconditional rather than only on the
       re-open path: a trainer opened fresh has a visible document already, and
       stating it twice costs nothing next to the one case where it is missed. */
    Pause.setFrameHidden($("frame"), false);
  }

  function home() {
    /*
     * Before the recount, not after. `invalidate()` and `renderToday()` read
     * the trainers' own storage, and a trainer still running is a trainer still
     * writing to it — so pausing first is what makes the number the hub prints
     * the number that was true when you left the trainer.
     */
    Pause.setFrameHidden($("frame"), true);
    wallTick();
    wallSave();
    $("stage").hidden = true;
    $("hub").hidden = false;
    document.title = "Chimera Hub";
    /* Recount here rather than on a timer: returning to the hub is both the
       moment the number is worth having and a moment when nothing is being
       timed, so this is the one place the sweep is free. */
    invalidate();
    renderToday();
  }

  /* ---- the bar over a running trainer ---- *
   *
   * Minimizing it hands the trainer the whole window. Several of these draw a
   * scene sized to the viewport and a couple are played close to the screen,
   * and 38 pixels of someone else's chrome above them is the shell asserting
   * itself over the thing it is supposed to be getting out of the way of.
   *
   * What is left behind is a tab, not nothing. The frame takes the keyboard as
   * soon as it is clicked into, so a key to bring the bar back would stop
   * working at the exact moment it was needed — the way out of a minimized bar
   * has to be visible and clickable, and it is the same corner the Hub button
   * was in.
   *
   * The choice is remembered, under the shell's own key. Someone who wants the
   * bar gone wants it gone every evening, not once per visit. */
  var BAR_KEY = "mindbuild.stagebar.hidden";

  function setBar(hidden) {
    $("stage").classList.toggle("bar-hidden", hidden);
    $("stage-show").hidden = !hidden;
    try { localStorage.setItem(BAR_KEY, hidden ? "1" : "0"); }
    catch (e) { /* storage off: the bar simply does not remember */ }
  }

  function barHidden() {
    try { return localStorage.getItem(BAR_KEY) === "1"; } catch (e) { return false; }
  }

  function route() {
    var m = /^#\/([a-z0-9-]+)$/.exec(location.hash || "");
    if (m && byId[m[1]]) show(m[1]);
    else home();
  }

  /* ---------------------------------------------------------------- *
   * The plain clock                                                  *
   * ---------------------------------------------------------------- *
   *
   * Every minute with any page open in the frame — a trainer, one of the
   * uncounted ones, the archive — added up for the UTC day, with nothing
   * taken off: no caps, no pauses, no adapter's idea of what a session was.
   * It is shown beside the real figure, greyed, and nothing reads it. The
   * quota and the bar stay on the adapters' count; this is only there so the
   * time you actually sat here is a number you can see.
   *
   * Counted by the shell's own one-second tick rather than by the trainers,
   * so it needs nothing from them. Only while the window is visible, and a
   * gap between ticks is capped — a laptop closed with a trainer open is not
   * an hour of training. Saved every few seconds rather than every tick: the
   * write is a storage event in the frame, and a timing-critical trainer is
   * running in it. */
  var WALL_KEY = "mindbuild.wallclock.v1";
  var WALL_GAP_MS = 5000, WALL_SAVE_MS = 15000;
  var wall = (function () {
    try { return JSON.parse(localStorage.getItem(WALL_KEY)) || {}; } catch (e) { return {}; }
  })();
  var wallTickAt = 0, wallSavedAt = 0;

  function wallToday() {
    var day = new Date().toISOString().slice(0, 10);
    if (wall.day !== day) wall = { day: day, ms: 0 };
    return wall;
  }

  function wallSave() {
    wallSavedAt = Date.now();
    try { localStorage.setItem(WALL_KEY, JSON.stringify(wallToday())); } catch (e) { /* storage off */ }
  }

  function wallTick() {
    var now = Date.now();
    var running = !$("stage").hidden && current && document.visibilityState === "visible";
    if (running && wallTickAt) {
      wallToday().ms += Math.min(now - wallTickAt, WALL_GAP_MS);
      if (now - wallSavedAt >= WALL_SAVE_MS) wallSave();
    }
    wallTickAt = running ? now : 0;
  }

  function renderWall() {
    var el = $("wall");
    if (!el) return;
    var mins = wallToday().ms / 60000;
    el.textContent = fmt(mins) + " min total";
  }

  function tick() {
    wallTick();
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
   * The background                                                   *
   * ---------------------------------------------------------------- */

  /* Kept in IndexedDB rather than in localStorage, and the reason is the whole
     point of this origin: every trainer's history is in localStorage and the
     quota there is shared between all of them. A background photograph is the
     least important thing on this page, and a couple of megabytes of it is
     exactly what would push a Syllogimous history of a thousand items over the
     edge. IndexedDB has its own, far larger budget. Nothing decorative gets to
     compete with a record. */

  var BG_DB = "mindbuild.shell", BG_STORE = "bg", BG_KEY = "background";

  /* Revoked before it is replaced: an object URL holds its blob in memory until
     it is let go, and choosing four pictures in a row should not keep four. */
  var bgUrl = null;

  function bgNote(msg) {
    var el = $("bg-note");
    if (el) el.textContent = msg || "";
  }

  function withStore(mode, fn) {
    var rq;
    try {
      rq = indexedDB.open(BG_DB, 1);
    } catch (e) {
      bgNote("This browser will not keep a background.");
      return;
    }
    rq.onupgradeneeded = function () { rq.result.createObjectStore(BG_STORE); };
    rq.onerror = function () { bgNote("This browser will not keep a background."); };
    rq.onsuccess = function () {
      var db = rq.result;
      try {
        var tx = db.transaction(BG_STORE, mode);
        fn(tx.objectStore(BG_STORE));
        tx.oncomplete = function () { db.close(); };
        tx.onerror = function () { db.close(); bgNote("That could not be saved."); };
      } catch (e) {
        db.close();
        bgNote("That could not be saved.");
      }
    };
  }

  /* The picture rides on <html> and the darkening on <body>, so setting this
     one property swaps the background without taking the overlay that keeps
     text readable on it with it. Removing the property falls back to the drawn
     forest in the stylesheet. */
  function applyBg(blob) {
    if (bgUrl) { URL.revokeObjectURL(bgUrl); bgUrl = null; }
    if (!blob) {
      document.documentElement.style.removeProperty("--bg-image");
      return;
    }
    bgUrl = URL.createObjectURL(blob);
    document.documentElement.style.setProperty("--bg-image", 'url("' + bgUrl + '")');
  }

  /* Downscaled before it is stored. A phone photograph is 4000px across and
     several megabytes; behind text, at cover size, it is indistinguishable from
     the same picture at 2560 — and the smaller one is what gets written to disk
     and decoded on every visit from now on. */
  var BG_MAX = 2560;

  function bgChoose(file) {
    if (!file) return;
    bgNote("Reading…");
    var src = URL.createObjectURL(file);
    var img = new Image();
    img.onerror = function () {
      URL.revokeObjectURL(src);
      bgNote("That is not an image this browser can read.");
    };
    img.onload = function () {
      URL.revokeObjectURL(src);
      var scale = Math.min(1, BG_MAX / Math.max(img.width, img.height));
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (blob) {
        if (!blob) { bgNote("That image could not be converted."); return; }
        applyBg(blob);
        withStore("readwrite", function (st) { st.put(blob, BG_KEY); });
        bgNote("Set. It stays in this browser, on this machine.");
      }, "image/jpeg", 0.86);
    };
    img.src = src;
  }

  function bgClear() {
    applyBg(null);
    withStore("readwrite", function (st) { st["delete"](BG_KEY); });
    bgNote("Back to the default.");
  }

  function bgLoad() {
    withStore("readonly", function (st) {
      var g = st.get(BG_KEY);
      g.onsuccess = function () { if (g.result) applyBg(g.result); };
    });
  }

  /* ---------------------------------------------------------------- *
   * Wiring                                                           *
   * ---------------------------------------------------------------- */

  renderGrid();
  route();
  $("archive-link").href = "#/archive";
  $("back").addEventListener("click", function () { location.hash = ""; });
  $("stage-hide").addEventListener("click", function () { setBar(true); });
  $("stage-show").addEventListener("click", function () {
    setBar(false);
    /* Focus the control that replaced the one just clicked, so the bar can be
       put away again without reaching for the mouse a second time. */
    $("stage-hide").focus();
  });
  setBar(barHidden());
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
  window.addEventListener("storage", function (e) {
    /* Another hub tab saved its clock. Take the larger, so two tabs open on
       one day do not keep writing each other's minutes away. */
    if (e && e.key === WALL_KEY) {
      try {
        var theirs = JSON.parse(e.newValue) || {};
        var ours = wallToday();
        if (theirs.day === ours.day && theirs.ms > ours.ms) ours.ms = theirs.ms;
      } catch (err) { /* not ours to read */ }
      if (!$("hub").hidden) renderWall();
      return;
    }
    invalidate();
    if (!$("hub").hidden) renderToday();
    /* Every tab of the hub shares the key, so a goal set in one is news in
       the others. */
    if (!e || !e.key || e.key === QUOTA_KEY) renderGoal();
  });

  /* Coming back to the hub is the other moment the number is worth having, and
     it is a moment when nothing is being timed. */
  setInterval(tick, 1000);
  /* The last few seconds before the window goes, which the periodic save
     would otherwise lose. */
  window.addEventListener("pagehide", function () { wallTick(); wallSave(); });
  document.addEventListener("visibilitychange", function () { wallTick(); wallSave(); });

  renderGoal();
  $("goal-set").addEventListener("click", commitGoal);
  /* `change` as well as the button: a number field is stepped and typed in as
     often as it is submitted, and on a phone the keyboard is dismissed rather
     than the button pressed. */
  $("goal").addEventListener("change", commitGoal);
  $("goal").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); commitGoal(); }
  });
  $("goal-clear").addEventListener("click", function () { setGoal(0); });

  $("bg-pick").addEventListener("click", function () { $("bg-file").click(); });
  $("bg-file").addEventListener("change", function (e) {
    bgChoose(e.target.files && e.target.files[0]);
    /* Cleared so that picking the same file twice still fires a change. */
    e.target.value = "";
  });
  $("bg-clear").addEventListener("click", bgClear);
  bgLoad();

})();

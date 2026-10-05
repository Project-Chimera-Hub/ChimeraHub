"use strict";

/* ============================================================
   THE TRAINER HARNESS
   ============================================================

   Everything a Chimera Hub trainer has in common, so that a new one is only
   the part that is actually new: what is shown on a trial and what counts as
   a right answer.

   What it does for you:

   - the screens: home, instructions, settings, the session, results;
   - the hub's look (harness.css), on a phone and at a desk;
   - response buttons that are also keys, with response times measured from
     the stimulus and never from a click on something else;
   - **pausing**: the clock stops when the page is hidden (the hub hides a
     trainer's frame when the player goes back to the menu), when Escape or
     the pause button is pressed, and every `wait` and every response window
     stops with it;
   - **the record**: every session saved in the Chimera record format
     (FORMAT.md) under `chimera.<id>.record.v1`, with trials, accuracy,
     signal-detection counts and response times filled in from the trial log,
     so the archive, the meter, the gate and Share your data read it as it
     stands;
   - the level: kept between sessions and moved by `adapt` after each one;
   - settings, kept per trainer, from a list you write once.

   What it does not do is reach outside the page: no network, no shared
   storage, nothing injected anywhere. Copy the harness/ directory into your
   trainer (tools/new-trainer.mjs does) and it runs on its own, from a file,
   on the hub, or in the APK.

   ── The smallest trainer ──

     Harness.start({
       id: "my-trainer", name: "My Trainer", unit: "n",
       level: { start: 1, min: 1, max: 9 },
       buttons: [{ id: "yes", label: "Match", key: "f" }],
       async session(s) {
         for (let i = 0; i < 20; i++) {
           s.show("<div class='h-stim'>" + i + "</div>");
           const r = await s.respond({ timeoutMs: 2000 });
           s.log({ target: i % 3 === 0, response: r && r.id, correct: (i % 3 === 0) === !!r,
                   rtMs: r && r.rtMs });
         }
       },
     });

   templates/trainer/ in Chimera Hub is a whole one, Posner cueing, built on
   exactly this.
*/

var Harness = (function () {

  var R = typeof ChimeraRecord !== "undefined" ? ChimeraRecord
    : (typeof require === "function" ? require("./record.js") : null);

  /* ---------------------------------------------------------------- *
   * Storage, guarded: a private window or a full quota must not take   *
   * the trainer down, only its memory.                                 *
   * ---------------------------------------------------------------- */

  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  /* ---------------------------------------------------------------- *
   * The clock: active time only                                        *
   * ---------------------------------------------------------------- */

  /**
   * Milliseconds of *training*, which stop while paused. Everything timed in
   * a session is timed on this — waits, response windows, response times —
   * so a pause in the middle of a trial costs the trial nothing.
   */
  function Clock() {
    this.total = 0;
    this.since = null;
  }
  Clock.prototype.run = function () { if (this.since === null) this.since = performance.now(); };
  Clock.prototype.stop = function () {
    if (this.since !== null) { this.total += performance.now() - this.since; this.since = null; }
  };
  Clock.prototype.now = function () {
    return this.total + (this.since === null ? 0 : performance.now() - this.since);
  };

  /* ---------------------------------------------------------------- *
   * Statistics, from the trial log                                     *
   * ---------------------------------------------------------------- */

  function summarize(log) {
    var out = {};
    if (!log.length) return out;
    var scored = log.filter(function (t) { return typeof t.correct === "boolean"; });
    if (scored.length) {
      out.trials = scored.length;
      out.correct = scored.filter(function (t) { return t.correct; }).length;
      out.accuracy = out.correct / out.trials;
    }
    var sd = log.filter(function (t) { return typeof t.target === "boolean"; });
    if (sd.length) {
      var answered = function (t) { return t.response !== undefined && t.response !== null; };
      out.hits = sd.filter(function (t) { return t.target && answered(t); }).length;
      out.misses = sd.filter(function (t) { return t.target && !answered(t); }).length;
      out.falseAlarms = sd.filter(function (t) { return !t.target && answered(t); }).length;
      out.correctRejections = sd.filter(function (t) { return !t.target && !answered(t); }).length;
      var targets = out.hits + out.misses, foils = out.falseAlarms + out.correctRejections;
      if (targets && foils) {
        /* The log-linear correction, so a perfect block has a finite d'. */
        var h = (out.hits + 0.5) / (targets + 1), f = (out.falseAlarms + 0.5) / (foils + 1);
        out.dPrime = Math.round((probit(h) - probit(f)) * 1000) / 1000;
      }
    }
    var rts = log.map(function (t) { return t.rtMs; })
      .filter(function (v) { return typeof v === "number" && isFinite(v); }).sort(function (a, b) { return a - b; });
    if (rts.length) {
      var mean = rts.reduce(function (a, b) { return a + b; }, 0) / rts.length;
      var mid = rts.length >> 1;
      out.rtMeanMs = Math.round(mean);
      out.rtMedianMs = Math.round(rts.length % 2 ? rts[mid] : (rts[mid - 1] + rts[mid]) / 2);
      if (rts.length > 1) {
        var v = rts.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (rts.length - 1);
        out.rtSdMs = Math.round(Math.sqrt(v));
      }
    }
    return out;
  }

  /** The inverse normal CDF (Acklam's rational approximation). */
  function probit(p) {
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    var b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155922447];
    var c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    var d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    var q, r;
    if (p < 0.02425) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - 0.02425) return -probit(1 - p);
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /**
   * The default level rule: up a step at 80% or better, down a step under
   * 60%, otherwise stay. Pass `adapt` to `start` to replace it.
   */
  function staircase(stats, level, cfg) {
    var lv = cfg.level || {};
    var step = lv.step || 1, up = lv.up == null ? 0.8 : lv.up, down = lv.down == null ? 0.6 : lv.down;
    if (typeof stats.accuracy !== "number") return level;
    var next = stats.accuracy >= up ? level + step : stats.accuracy < down ? level - step : level;
    return clamp(next, lv.min, lv.max);
  }
  function clamp(v, lo, hi) {
    if (typeof lo === "number" && v < lo) v = lo;
    if (typeof hi === "number" && v > hi) v = hi;
    return v;
  }

  /* ---------------------------------------------------------------- *
   * Sound                                                              *
   * ---------------------------------------------------------------- */

  /** One AudioContext, made on the first gesture, as browsers require. */
  var audio = {
    ctx: null,
    unlock: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    /** A sine tone. `ms` long, at `hz`, `gain` 0..1. */
    tone: function (hz, ms, gain) {
      var ctx = this.unlock();
      if (!ctx) return;
      var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime, d = (ms || 150) / 1000;
      o.frequency.value = hz || 440;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain == null ? 0.2 : gain, t + 0.005);
      g.gain.setValueAtTime(gain == null ? 0.2 : gain, t + d - 0.01);
      g.gain.linearRampToValueAtTime(0, t + d);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + d + 0.02);
    },
  };

  /* ---------------------------------------------------------------- *
   * The page                                                           *
   * ---------------------------------------------------------------- */

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function text(tag, cls, s) { var e = el(tag, cls); e.textContent = s; return e; }

  function fmtLevel(v) { return typeof v === "number" ? String(Math.round(v * 100) / 100) : "—"; }

  /** Thrown into a running session when the player quits it. */
  function Quit() { this.name = "Quit"; }

  /* ---------------------------------------------------------------- *
   * start                                                              *
   * ---------------------------------------------------------------- */

  function start(cfg) {
    if (!R) throw new Error("Harness needs record.js loaded before it");
    if (!cfg || !/^[a-z][a-z0-9-]*$/.test(cfg.id || "")) throw new Error("Harness.start: id must be lower-case and dashed");
    if (typeof cfg.session !== "function") throw new Error("Harness.start: session(s) is required");

    var KEY = R.key(cfg.id);
    var SETTINGS_KEY = "chimera." + cfg.id + ".settings.v1";
    var lv = cfg.level || null;

    var record = load(KEY, null);
    if (!record || record.format !== R.FORMAT) record = R.create(cfg.id, cfg.unit || null, cfg.version);
    if (cfg.version) record.appVersion = cfg.version;
    if (cfg.unit) record.units.level = cfg.unit;
    record.state = record.state || {};

    var settings = {};
    (cfg.settings || []).forEach(function (d) { settings[d.key] = d.default; });
    var stored = load(SETTINGS_KEY, {});
    for (var k in stored) if (Object.prototype.hasOwnProperty.call(settings, k)) settings[k] = stored[k];

    function level() {
      return lv ? (typeof record.state.level === "number" ? record.state.level : lv.start) : null;
    }

    document.title = cfg.name;
    var root = document.getElementById("app") || document.body.appendChild(el("div"));
    root.classList.add("h-root");

    /* ---- screens ---- */

    function screen() { root.textContent = ""; var s = el("main", "h-screen"); root.appendChild(s); return s; }

    function home() {
      var s = screen();
      s.appendChild(text("h1", "h-title", cfg.name));
      if (cfg.what) s.appendChild(text("p", "h-dim", cfg.what));
      var facts = el("div", "h-facts");
      if (lv) facts.appendChild(el("div", "h-fact", "<b>" + fmtLevel(level()) + "</b><span>" + (cfg.unit || "level") + "</span>"));
      facts.appendChild(el("div", "h-fact", "<b>" + record.sessions.length + "</b><span>sessions</span>"));
      var mins = record.sessions.reduce(function (a, r) { return a + (r.activeSeconds || 0); }, 0) / 60;
      facts.appendChild(el("div", "h-fact", "<b>" + Math.round(mins) + "</b><span>minutes</span>"));
      s.appendChild(facts);
      var row = el("div", "h-row");
      var go = text("button", "h-btn", "Start");
      go.onclick = function () { audio.unlock(); run(); };
      row.appendChild(go);
      if (cfg.instructions) { var how = text("button", "h-btn ghost", "How it works"); how.onclick = instructions; row.appendChild(how); }
      if ((cfg.settings || []).length) { var set = text("button", "h-btn ghost", "Settings"); set.onclick = settingsScreen; row.appendChild(set); }
      if (record.sessions.length) { var hist = text("button", "h-btn ghost", "History"); hist.onclick = history; row.appendChild(hist); }
      s.appendChild(row);
      go.focus();
    }

    function instructions() {
      var s = screen();
      s.appendChild(text("h2", "h-h2", "How it works"));
      s.appendChild(el("div", "h-prose", cfg.instructions));
      var back = text("button", "h-btn", "Back"); back.onclick = home;
      s.appendChild(back);
    }

    function settingsScreen() {
      var s = screen();
      s.appendChild(text("h2", "h-h2", "Settings"));
      var form = el("div", "h-form");
      (cfg.settings || []).forEach(function (d) {
        var label = el("label", "h-field");
        label.appendChild(text("span", "", d.label));
        var input;
        if (d.type === "select") {
          input = el("select");
          d.options.forEach(function (o) {
            var opt = text("option", "", o.label || String(o.value));
            opt.value = JSON.stringify(o.value);
            if (JSON.stringify(o.value) === JSON.stringify(settings[d.key])) opt.selected = true;
            input.appendChild(opt);
          });
          input.onchange = function () { settings[d.key] = JSON.parse(input.value); };
        } else if (d.type === "boolean") {
          input = el("input"); input.type = "checkbox"; input.checked = !!settings[d.key];
          input.onchange = function () { settings[d.key] = input.checked; };
        } else {
          input = el("input"); input.type = "number";
          ["min", "max", "step"].forEach(function (a) { if (d[a] != null) input[a] = d[a]; });
          input.value = settings[d.key];
          input.onchange = function () {
            var v = Number(input.value);
            if (isFinite(v)) settings[d.key] = clamp(v, d.min, d.max);
            input.value = settings[d.key];
          };
        }
        label.appendChild(input);
        if (d.about) label.appendChild(text("small", "h-dim", d.about));
        form.appendChild(label);
      });
      s.appendChild(form);
      var row = el("div", "h-row");
      var ok = text("button", "h-btn", "Save");
      ok.onclick = function () { save(SETTINGS_KEY, settings); home(); };
      var reset = text("button", "h-btn ghost", "Defaults");
      reset.onclick = function () { (cfg.settings || []).forEach(function (d) { settings[d.key] = d.default; }); settingsScreen(); };
      row.appendChild(ok); row.appendChild(reset);
      s.appendChild(row);
    }

    function history() {
      var s = screen();
      s.appendChild(text("h2", "h-h2", "History"));
      var table = el("table", "h-table");
      table.innerHTML = "<thead><tr><th>Day</th><th>Min</th><th>" + (cfg.unit || "Level")
        + "</th><th>Accuracy</th><th>RT</th></tr></thead>";
      var body = el("tbody");
      record.sessions.slice(-50).reverse().forEach(function (r) {
        var tr = el("tr");
        [new Date(r.start).toISOString().slice(0, 10),
         String(Math.round((r.activeSeconds || 0) / 6) / 10),
         fmtLevel(r.levelEnd != null ? r.levelEnd : r.level),
         typeof r.accuracy === "number" ? Math.round(r.accuracy * 100) + "%" : "—",
         r.rtMedianMs ? r.rtMedianMs + " ms" : "—"].forEach(function (v) { tr.appendChild(text("td", "", v)); });
        body.appendChild(tr);
      });
      table.appendChild(body);
      s.appendChild(table);
      var row = el("div", "h-row");
      var back = text("button", "h-btn", "Back"); back.onclick = home;
      /* The whole record as a file: what the archive takes when it is dropped
         in, and what a submission attaches as its sample record. */
      var exp = text("button", "h-btn ghost", "Export record");
      exp.onclick = function () {
        var blob = new Blob([JSON.stringify(record, null, 1)], { type: "application/json" });
        var a = el("a");
        a.href = URL.createObjectURL(blob);
        a.download = cfg.id + "-record-" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      };
      row.appendChild(back); row.appendChild(exp);
      s.appendChild(row);
    }

    /* ---- the session ---- */

    function run() {
      var clock = new Clock();
      var startedAt = Date.now();
      var log = [];
      var paused = false, over = false;
      var waiters = [];
      var startLevel = level();

      var s = screen();
      s.classList.add("h-session");
      var bar = el("div", "h-bar");
      var lvLabel = text("span", "h-dim", lv ? (cfg.unit || "level") + " " + fmtLevel(startLevel) : "");
      var pauseBtn = text("button", "h-btn ghost small", "Pause");
      bar.appendChild(lvLabel); bar.appendChild(pauseBtn);
      var stage = el("div", "h-stage");
      var pad = el("div", "h-pad");
      s.appendChild(bar); s.appendChild(stage); s.appendChild(pad);
      var veil = el("div", "h-veil");
      veil.hidden = true;
      s.appendChild(veil);

      function pause(why) {
        if (paused || over) return;
        paused = true;
        clock.stop();
        waiters.forEach(function (w) { w.pause(); });
        veil.innerHTML = "";
        veil.appendChild(text("h2", "h-h2", "Paused"));
        if (why) veil.appendChild(text("p", "h-dim", why));
        var row = el("div", "h-row");
        var cont = text("button", "h-btn", "Resume");
        cont.onclick = resume;
        var quit = text("button", "h-btn ghost", "End session");
        quit.onclick = function () { abort(); };
        row.appendChild(cont); row.appendChild(quit);
        veil.appendChild(row);
        veil.hidden = false;
        if (document.visibilityState !== "hidden") cont.focus();
      }
      function resume() {
        if (!paused || over) return;
        paused = false;
        veil.hidden = true;
        clock.run();
        waiters.forEach(function (w) { w.resume(); });
      }
      function abort() {
        over = true;
        clock.stop();
        waiters.slice().forEach(function (w) { w.abort(); });
      }

      /* The hub reports its frame hidden when the player goes back to the
         menu, and a phone does when the screen locks: either way, nothing is
         being trained, so nothing is timed. */
      function onVisibility() { if (document.visibilityState === "hidden") pause("The page was hidden."); }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); paused ? resume() : pause(); }
      }
      document.addEventListener("visibilitychange", onVisibility);
      document.addEventListener("keydown", onKey);
      pauseBtn.onclick = function () { pause(); };

      /** A pausable timer: `ms` of active time, then `done`. */
      function waiter(ms, done) {
        var left = ms, t0 = 0, timer = null;
        var w = {
          pause: function () { if (timer) { clearTimeout(timer); timer = null; left -= performance.now() - t0; } },
          resume: function () { if (!timer && left !== Infinity) { t0 = performance.now(); timer = setTimeout(fire, Math.max(0, left)); } },
          abort: function () { w.pause(); remove(); w.onAbort && w.onAbort(); },
        };
        function remove() { var i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); }
        function fire() { timer = null; remove(); done(); }
        waiters.push(w);
        if (!paused) w.resume();
        return w;
      }

      var buttons = [];
      function setButtons(defs) {
        pad.textContent = "";
        buttons = (defs || []).map(function (d) {
          var b = el("button", "h-key");
          b.innerHTML = "<span></span>" + (d.key ? "<kbd></kbd>" : "");
          b.firstChild.textContent = d.label;
          if (d.key) b.lastChild.textContent = d.key.length === 1 ? d.key.toUpperCase() : d.key;
          b.dataset.id = d.id;
          pad.appendChild(b);
          return { id: d.id, key: d.key, el: b };
        });
      }
      setButtons(cfg.buttons);

      var api = {
        settings: Object.freeze(JSON.parse(JSON.stringify(settings))),
        level: startLevel,
        stage: stage,
        audio: audio,
        /** Replace what is on the stage. A string is HTML; a node is appended. */
        show: function (content) {
          stage.textContent = "";
          if (typeof content === "string") stage.innerHTML = content;
          else if (content) stage.appendChild(content);
        },
        /** Active milliseconds since the session began. */
        now: function () { return clock.now(); },
        /** Wait `ms` of active time. Rejects if the session is ended. */
        wait: function (ms) {
          return new Promise(function (resolve, reject) {
            if (over) return reject(new Quit());
            var w = waiter(ms, resolve);
            w.onAbort = function () { reject(new Quit()); };
          });
        },
        /** Change the response buttons for what follows. */
        buttons: setButtons,
        /**
         * Wait for a response: a button press or its key, or a tap anywhere on
         * the stage if `stage: true`. Resolves to `{ id, rtMs }`, or null when
         * `timeoutMs` of active time passes with none. `rtMs` is measured from
         * this call, so call it the moment the stimulus is shown.
         */
        respond: function (opts) {
          opts = opts || {};
          return new Promise(function (resolve, reject) {
            if (over) return reject(new Quit());
            var onset = clock.now(), settled = false, w = null;
            var accept = opts.accept || null;
            function finish(v) {
              if (settled) return;
              settled = true;
              document.removeEventListener("keydown", key, true);
              pad.removeEventListener("pointerdown", tap);
              stage.removeEventListener("pointerdown", stageTap);
              if (w) { w.onAbort = null; w.abort(); }
              resolve(v);
            }
            function hit(id) {
              if (paused || (accept && accept.indexOf(id) < 0)) return;
              var b = buttons.filter(function (x) { return x.id === id; })[0];
              if (b) { b.el.classList.add("on"); setTimeout(function () { b.el.classList.remove("on"); }, 120); }
              finish({ id: id, rtMs: Math.round(clock.now() - onset) });
            }
            function key(e) {
              if (e.repeat || e.key === "Escape") return;
              var b = buttons.filter(function (x) { return x.key && x.key.toLowerCase() === e.key.toLowerCase(); })[0];
              if (b) { e.preventDefault(); hit(b.id); }
            }
            function tap(e) {
              var t = e.target.closest && e.target.closest(".h-key");
              if (t) { e.preventDefault(); hit(t.dataset.id); }
            }
            function stageTap(e) { if (opts.stage) { e.preventDefault(); hit("stage"); } }
            document.addEventListener("keydown", key, true);
            pad.addEventListener("pointerdown", tap);
            stage.addEventListener("pointerdown", stageTap);
            if (opts.timeoutMs != null) {
              w = waiter(opts.timeoutMs, function () { finish(null); });
              w.onAbort = function () { if (!settled) { settled = true; reject(new Quit()); } };
            } else {
              /* No timeout: still has to end when the session does. */
              w = waiter(Infinity, function () {});
              w.onAbort = function () { if (!settled) { settled = true; reject(new Quit()); } };
            }
          });
        },
        /** Add a trial to the log. `i` and `t` are filled in if absent. */
        log: function (row) {
          var r = {};
          for (var k in row) if (row[k] !== undefined) r[k] = row[k];
          if (r.i == null) r.i = log.length;
          if (r.t == null) r.t = Math.round(clock.now());
          log.push(r);
          return r;
        },
        /** A brief right/wrong flash on the stage. */
        feedback: function (ok) {
          stage.classList.remove("h-ok", "h-bad");
          void stage.offsetWidth;
          stage.classList.add(ok ? "h-ok" : "h-bad");
        },
        Quit: Quit,
      };

      clock.run();
      Promise.resolve().then(function () { return cfg.session(api); }).then(function (result) {
        finish(result || {}, true);
      }, function (err) {
        if (err instanceof Quit) finish({}, false);
        else { console.error(err); finish({ extra: { error: String(err && err.message || err) } }, false); }
      });

      function finish(result, completed) {
        over = true;
        clock.stop();
        document.removeEventListener("visibilitychange", onVisibility);
        document.removeEventListener("keydown", onKey);
        waiters.slice().forEach(function (w) { w.abort(); });

        var activeSeconds = Math.round(clock.total / 100) / 10;
        /* Under ten seconds is a mis-click, not a session. */
        if (activeSeconds < 10 && !log.length) return home();

        var stats = summarize(log);
        var session = {
          id: startedAt + "-" + Math.random().toString(36).slice(2, 8),
          start: startedAt,
          end: Date.now(),
          activeSeconds: activeSeconds,
          completed: !!completed && result.completed !== false,
          input: lastInput,
        };
        if (result.mode || cfg.mode) session.mode = result.mode || cfg.mode;
        if (result.modalities || cfg.modalities) session.modalities = result.modalities || cfg.modalities;
        if (lv) session.level = startLevel;
        for (var k in stats) session[k] = stats[k];
        if (typeof result.score === "number") session.score = result.score;
        session.settings = JSON.parse(JSON.stringify(settings));
        if (result.extra) session.extra = result.extra;
        if (log.length) session.trialLog = log;

        var next = startLevel;
        if (lv && session.completed) {
          next = typeof result.levelEnd === "number" ? clamp(result.levelEnd, lv.min, lv.max)
            : cfg.adapt ? clamp(cfg.adapt(stats, startLevel, settings), lv.min, lv.max)
            : staircase(stats, startLevel, cfg);
          record.state.level = next;
        }
        if (lv) session.levelEnd = next;

        record.sessions.push(session);
        var saved = save(KEY, record);
        results(session, saved);
      }
    }

    function results(session, saved) {
      var s = screen();
      s.appendChild(text("h2", "h-h2", session.completed ? "Session done" : "Session ended early"));
      var facts = el("div", "h-facts");
      function fact(v, label) { facts.appendChild(el("div", "h-fact", "<b>" + v + "</b><span>" + label + "</span>")); }
      if (typeof session.accuracy === "number") fact(Math.round(session.accuracy * 100) + "%", "accuracy");
      if (session.rtMedianMs) fact(session.rtMedianMs, "median ms");
      if (typeof session.dPrime === "number") fact(session.dPrime.toFixed(2), "d′");
      fact(Math.round(session.activeSeconds / 6) / 10, "minutes");
      if (lv) {
        var moved = session.levelEnd > session.level ? " ↑" : session.levelEnd < session.level ? " ↓" : "";
        fact(fmtLevel(session.levelEnd) + moved, "next " + (cfg.unit || "level"));
      }
      s.appendChild(facts);
      if (!saved) s.appendChild(text("p", "h-warn", "This browser would not save the session: storage is full or switched off."));
      var row = el("div", "h-row");
      var again = text("button", "h-btn", "Again"); again.onclick = run;
      var back = text("button", "h-btn ghost", "Home"); back.onclick = home;
      row.appendChild(again); row.appendChild(back);
      s.appendChild(row);
      again.focus();
    }

    /* What the player is answering with, for the record's `input` column. */
    var lastInput = null;
    document.addEventListener("keydown", function () { lastInput = "keyboard"; }, true);
    document.addEventListener("pointerdown", function (e) {
      lastInput = e.pointerType === "touch" || e.pointerType === "pen" ? "touch" : "mouse";
    }, true);

    home();
    return { record: function () { return record; }, home: home };
  }

  return { start: start, summarize: summarize, staircase: staircase, probit: probit, audio: audio, Clock: Clock };
})();

if (typeof module !== "undefined") module.exports = Harness;

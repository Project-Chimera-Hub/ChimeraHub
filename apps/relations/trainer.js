"use strict";
/* Relation Algebra: nested relations in six materials, on the hub's harness.
 * The logic is all in algebra.js (tested in test/algebra.test.js); this file
 * shows it, takes the answers, explains them, and logs them.
 *
 * A session is a run of rounds, 10 minutes to 5 hours long. Each round is a
 * set number of trials of one task in one material, and both can change from
 * round to round. The level moves after every round. Long sessions are
 * checkpointed after every trial, so a crash or a closed tab loses nothing:
 * the next time the page opens, the unfinished session is filed in the
 * record, marked as not completed. */

(function () {
  var A = window.Algebra;
  var G_ORDER = ["space", "numbers", "notes", "days", "compass", "square"];
  var T_ORDER = ["question", "possible", "howfar", "nback"];
  var COLOURS = { Red: "#e5534b", Blue: "#539bf5", Green: "#57ab5a", Gold: "#d4af37", Violet: "#b083f0", White: "#e6edf3" };
  var LETTER_COLOURS = { R: "Red", B: "Blue", G: "Green", O: "Gold", V: "Violet", W: "White" };
  var TRAP = {
    ignored: ["nesting ignored", "∅n"], dropLeft: ["left offsets dropped", "−L"], dropRight: ["right offsets dropped", "−R"],
    sign: ["wrong sign", "±"], order: ["wrong order", "⇄"], frame: ["perspective read facing north", "@8"],
    step: ["one step off", "±1"], rotate90: ["turned a quarter", "↻"], rotate180: ["turned half way", "↻↻"],
    rotate270: ["turned a quarter back", "↺"], mirrorEW: ["mirrored east-west", "⇋"], mirrorNS: ["mirrored north-south", "⇅"],
    diagonal: ["flipped on a diagonal", "⤡"], reverse: ["reversed", "−"], conjugate: ["seen in a mirror", "m·m"],
    inverse: ["undone instead of done", "⁻¹"], swap: ["two objects swapped", "⇆"], plain: ["a new arrangement", "≠"],
  };
  var LEVEL_KEY = "chimera.relations.level.v1";
  var CHECKPOINT_KEY = "chimera.relations.checkpoint.v1";
  var RECORD_KEY = "chimera.relations.record.v1";
  var ROTATION_KEY = "chimera.relations.rotation";
  var VERSION = "1.1.0";

  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /* ---- a session that never finished (crash, closed tab): file it now ---- */
  /* The level moves after every round and is kept under LEVEL_KEY, so it
   * survives a session that is ended early. The harness reads its starting
   * level from the record, so the record is brought up to date here too. */
  (function recover() {
    var cp = load(CHECKPOINT_KEY), lvl = load(LEVEL_KEY);
    if (cp && typeof cp.level === "number") lvl = cp.level;
    if (!(cp && cp.session) && typeof lvl !== "number") return;
    var rec = load(RECORD_KEY);
    if (!rec || rec.format !== "chimera-record") rec = ChimeraRecord.create("relations", "level", VERSION);
    if (cp && cp.session && !rec.sessions.some(function (s) { return s.id === cp.session.id; })) rec.sessions.push(cp.session);
    rec.state = rec.state || {};
    if (typeof lvl === "number") { rec.state.level = lvl; save(LEVEL_KEY, lvl); }
    save(RECORD_KEY, rec);
    drop(CHECKPOINT_KEY);
  })();

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function paint(s) {
    return esc(s).replace(/\b(Red|Blue|Green|Gold|Violet|White)\b/g, function (n) { return '<b style="color:' + COLOURS[n] + '">' + n + "</b>"; });
  }
  /* In code, colour the object letters (a letter at the start of a term). */
  function paintCode(s) {
    return esc(s).replace(/(^|=|\||−)([RBGOVW])(?![a-z\d]*=?[a-z])/g, function (m, pre, l) {
      return pre + '<b style="color:' + COLOURS[LETTER_COLOURS[l]] + '">' + l + "</b>";
    });
  }

  /* ---- reading aloud: the best voice the device has ---- */
  var speech = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
  var bestVoice = null;
  function pickVoice() {
    if (!speech) return;
    var vs = speech.getVoices().filter(function (v) { return /^en(-|_|$)/i.test(v.lang); });
    if (!vs.length) return;
    var score = function (v) {
      var n = v.name;
      return (/natural|neural/i.test(n) ? 50 : 0) + (/premium|enhanced/i.test(n) ? 40 : 0) + (/google/i.test(n) ? 25 : 0)
        + (/online/i.test(n) ? 10 : 0) + (v.localService ? 0 : 5) + (/en-(US|GB)/i.test(v.lang) ? 3 : 0);
    };
    bestVoice = vs.sort(function (a, b) { return score(b) - score(a); })[0];
  }
  if (speech) { pickVoice(); speech.onvoiceschanged = pickVoice; }
  function speak(text, which) {
    return new Promise(function (resolve) {
      if (!speech) return resolve();
      speech.cancel();
      var u = new SpeechSynthesisUtterance(text.replace(/°/g, " degrees"));
      if (which === "best" && bestVoice) u.voice = bestVoice;
      u.rate = 0.9;
      var done = false, finish = function () { if (!done) { done = true; resolve(); } };
      u.onend = finish; u.onerror = finish;
      setTimeout(finish, 4000 + text.length * 120);
      speech.speak(u);
    });
  }
  document.addEventListener("visibilitychange", function () {
    if (!speech) return;
    if (document.hidden) speech.pause(); else speech.resume();
  });

  /* ---- drawings for explanations ---- */
  var useLetters = false;
  function tag(n) { return useLetters ? A.LETTER[n] : n.slice(0, 2); }
  function drawing(G, world) {
    var names = world.names, v = world.vals;
    if (G.name === "space") {
      var xs = names.map(function (n) { return v[n][0]; }), ys = names.map(function (n) { return v[n][1]; });
      var x0 = Math.min.apply(null, xs) - 1, x1 = Math.max.apply(null, xs) + 1, y0 = Math.min.apply(null, ys) - 1, y1 = Math.max.apply(null, ys) + 1;
      var c = 28, W = (x1 - x0) * c, H = (y1 - y0) * c, out = '<svg class="ra-draw" viewBox="0 0 ' + W + " " + H + '" width="' + Math.min(W, 300) + '">';
      for (var x = x0; x <= x1; x++) out += '<line x1="' + (x - x0) * c + '" y1="0" x2="' + (x - x0) * c + '" y2="' + H + '" class="ra-grid"/>';
      for (var y = y0; y <= y1; y++) out += '<line x1="0" y1="' + (y1 - y) * c + '" x2="' + W + '" y2="' + (y1 - y) * c + '" class="ra-grid"/>';
      names.forEach(function (n) {
        var cx = (v[n][0] - x0) * c, cy = (y1 - v[n][1]) * c;
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="' + COLOURS[n] + '"/><text x="' + cx + '" y="' + (cy + 4) + '" class="ra-lbl">' + tag(n) + "</text>";
      });
      return out + '<text x="4" y="12" class="ra-n">N↑</text></svg>';
    }
    if (G.name === "numbers") {
      var vals = names.map(function (n) { return v[n]; }), lo = Math.min.apply(null, vals) - 1, hi = Math.max.apply(null, vals) + 1;
      var step = Math.max(10, Math.min(28, 300 / (hi - lo))), W2 = (hi - lo) * step, s2 = '<svg class="ra-draw" viewBox="0 -4 ' + W2 + ' 46" width="' + Math.min(W2, 320) + '"><line x1="0" y1="22" x2="' + W2 + '" y2="22" class="ra-grid"/>';
      names.forEach(function (n) { var cx = (v[n] - lo) * step; s2 += '<circle cx="' + cx + '" cy="22" r="7" fill="' + COLOURS[n] + '"/><text x="' + cx + '" y="10" class="ra-lbl2">' + tag(n) + '</text><text x="' + cx + '" y="40" class="ra-lbl2">' + v[n] + "</text>"; });
      return s2 + "</svg>";
    }
    if (G.name === "notes" || G.name === "days" || G.name === "compass") {
      var n = G.n, r = 52, s3 = '<svg class="ra-draw" viewBox="-70 -70 140 140" width="150"><circle r="' + r + '" class="ra-ring"/>';
      for (var k = 0; k < n; k++) { var a = k / n * 2 * Math.PI; s3 += '<circle cx="' + (r * Math.sin(a)) + '" cy="' + (-r * Math.cos(a)) + '" r="2" class="ra-tick"/>'; }
      names.forEach(function (nm, i) {
        var a = v[nm] / n * 2 * Math.PI, rr = G.name === "compass" ? 20 + i * 6 : r;
        if (G.name === "compass") s3 += '<line x1="0" y1="0" x2="' + (rr * Math.sin(a)) + '" y2="' + (-rr * Math.cos(a)) + '" stroke="' + COLOURS[nm] + '" stroke-width="3"/>';
        s3 += '<circle cx="' + (rr * Math.sin(a)) + '" cy="' + (-rr * Math.cos(a)) + '" r="7" fill="' + COLOURS[nm] + '"/><text x="' + (rr * Math.sin(a)) + '" y="' + (-rr * Math.cos(a) + 3.5) + '" class="ra-lbl">' + tag(nm) + "</text>";
      });
      return s3 + "</svg>";
    }
    /* Orientations: a tile with an F on it, turned and mirrored. */
    return '<div class="ra-tiles">' + names.map(function (nm) {
      var t = v[nm];
      return '<div class="ra-tile" style="border-color:' + COLOURS[nm] + '"><span style="transform: rotate(' + (t[0] * 90) + "deg) scaleX(" + (t[1] ? -1 : 1) + ");color:" + COLOURS[nm] + '">F</span><small>' + (useLetters ? A.LETTER[nm] : nm) + "</small></div>";
    }).join("") + "</div>";
  }

  var NOTATION_GUIDE =
    "<h3>Compact notation</h3>"
    + "<p>Every premise is an equation. <b>Objects</b> are letters: R Red, B Blue, G Green, <b>O Gold</b>, V Violet, W White. "
    + "A <b>term</b> is an object followed by moves: <code>R6</code> is “the place one step east of Red”. "
    + "<code>R6=B4488</code>: one east of Red is two west and two north of Blue.</p>"
    + "<p><b>Space</b>: one keypad digit per step. <code>7 8 9 / 4 · 6 / 1 2 3</code>: 8 north, 9 north-east, 6 east, 3 south-east, 2 south, 1 south-west, 4 west, 7 north-west. "
    + "<b>Perspective</b>: <code>R=B@2&lt;&lt;</code>: standing at B facing 2 (south), R is two to the left. ^ ahead, v behind, &lt; left, &gt; right.</p>"
    + "<p><b>Numbers</b>: signed steps, <code>R+2=B−7+5</code>. <b>Notes, days, headings</b>: the same, wrapping at the modulus in the first line (mod 12, 7, 8); a heading step is 45°, clockwise positive.</p>"
    + "<p><b>Orientations</b>: one letter per operation, applied left to right. q a quarter right, Q a quarter left, h half way, m mirror left-right, M mirror top-bottom, d the rising diagonal, D the falling one. <code>R=Bmq</code>: Red is Blue mirrored, then turned a quarter right.</p>"
    + "<p><b>Marks</b> are names for places: <code>P=R6</code> then <code>B=P88</code>. Mark letters are P S T U X Y Z A C E F J K L N, doubled after the fifteenth (PP…).</p>"
    + "<p><b>Questions</b>: <code>R=B6?</code> (true? answer <b>=</b>, <b>≠</b>, or <b>?</b> when nothing links them); <code>∃?</code> (can all of it be true?: ∃ yes, ∅ no); "
    + "<code>|R−B|₁?</code> steps along the grid, <code>|R−B|∞?</code> king's moves; <code>≡3?</code> the same arrangement as 3 back (≡ same, ≢ different), <code>≅3?</code> the same up to rotation. "
    + "While building the first n of an n-back round: <code>⊢k/n</code>, go on with ».</p>"
    + "<p><b>Traps</b> in explanations: ∅n nesting ignored, −L / −R one side's offsets dropped, ± wrong sign, ⇄ wrong order, @8 perspective read facing north, ±1 one step off, ↻ ↺ turned, ⇋ ⇅ mirrored, ⤡ diagonal, ⁻¹ undone, ⇆ two swapped.</p>";

  Harness.start({
    id: "relations",
    name: "Relation Algebra",
    version: VERSION,
    what: "Nested relations in space, numbers, notes, days, headings and orientations",
    unit: "level",
    level: { start: 1, min: 1, max: 20 },

    instructions:
      "<p>Each trial describes some objects by how they relate: places on a grid, numbers, notes, days, headings, or a tile’s orientation. Combine the relations to answer.</p>"
      + "<p>A session is a run of <b>rounds</b>. A round is a set number of trials of one task in one material; the task and the material can change from round to round, and the level moves after every round. A session runs for the length you choose, 10 minutes to 5 hours; a long one is saved as it goes.</p>"
      + "<p><b>Tasks</b>: questions (true, false, or can’t tell when nothing links the two), possible (can every premise be true at once?), how far (steps apart), and structure n-back (the same arrangement as n back, however it is written).</p>"
      + "<p><b>Traps</b>: the wrong answers on offer are the answers of particular mistakes, and the explanation after a mistake names which.</p>"
      + NOTATION_GUIDE
      + "<h3>Words</h3><p>With the notation set to Words, the same premises are written out: “The place one step east of Red is two steps west and two steps north of Blue.”</p>"
      + "<p>Keys: <b>F</b> yes / same / possible, <b>J</b> no / different / impossible, <b>K</b> can’t tell, <b>1–4</b> distances, <b>Space</b> go on, <b>Escape</b> pause.</p>",

    settings: [
      { key: "notation", label: "Text", type: "select", default: "compact", options: [
        { value: "compact", label: "Compact notation (see How it works)" }, { value: "words", label: "Words" }] },
      { key: "minutes", label: "Session length", type: "select", default: 20, options: [
        { value: 10, label: "10 minutes" }, { value: 15, label: "15 minutes" }, { value: 20, label: "20 minutes" }, { value: 30, label: "30 minutes" },
        { value: 45, label: "45 minutes" }, { value: 60, label: "1 hour" }, { value: 90, label: "1½ hours" }, { value: 120, label: "2 hours" },
        { value: 180, label: "3 hours" }, { value: 240, label: "4 hours" }, { value: 300, label: "5 hours" }] },
      { key: "perRound", label: "Trials per round", type: "number", min: 4, max: 100, step: 1, default: 12 },
      { key: "task", label: "Task", type: "select", default: "rotate", options: [
        { value: "rotate", label: "A different task each round" }, { value: "question", label: "Questions" }, { value: "possible", label: "Possible?" },
        { value: "howfar", label: "How far? (space and numbers)" }, { value: "nback", label: "Structure n-back" },
        { value: "mixed", label: "Questions, possible and how far, mixed in each round" }] },
      { key: "material", label: "Material", type: "select", default: "rotate", options: [
        { value: "rotate", label: "A different material each round" }, { value: "space", label: "Space (grid)" }, { value: "numbers", label: "Numbers" },
        { value: "notes", label: "Notes (mod 12)" }, { value: "days", label: "Days (mod 7)" }, { value: "compass", label: "Headings (mod 8)" },
        { value: "square", label: "Orientations (order matters)" }] },
      { key: "phrasing", label: "Nested places", type: "select", default: "mixed", options: [
        { value: "inline", label: "Inline" }, { value: "marks", label: "Marks" }, { value: "mixed", label: "Both, mixed" }] },
      { key: "perspective", label: "Perspective premises (space)", type: "boolean", default: true },
      { key: "matchRule", label: "N-back: what counts as the same", type: "select", default: "exact", options: [
        { value: "exact", label: "Exactly (north stays north)" }, { value: "rotation", label: "Up to rotation (space)" }] },
      { key: "metric", label: "How far: steps", type: "select", default: "manhattan", options: [
        { value: "manhattan", label: "Along the grid" }, { value: "king", label: "King's moves" }] },
      { key: "timeLimit", label: "Time per trial", type: "select", default: 0, options: [
        { value: 0, label: "No limit" }, { value: 120, label: "2 minutes" }, { value: 60, label: "1 minute" }, { value: 30, label: "30 s" }, { value: 15, label: "15 s" }] },
      { key: "explain", label: "Explain the answer", type: "select", default: "errors", options: [
        { value: "errors", label: "After mistakes" }, { value: "always", label: "Always" }, { value: "never", label: "Never" }] },
      { key: "sound", label: "Feedback sound", type: "boolean", default: true },
      { key: "aloud", label: "Read aloud", type: "boolean", default: false },
      { key: "voice", label: "Voice", type: "select", default: "best", options: [
        { value: "best", label: "The best this device has (natural / neural first)" }, { value: "default", label: "The device's default" }] },
      { key: "hideText", label: "Hide the text while reading aloud", type: "boolean", default: false },
    ],

    buttons: [],

    async session(s) {
      var set = s.settings, compact = set.notation === "compact";
      useLetters = compact;
      var level = typeof load(LEVEL_KEY) === "number" ? load(LEVEL_KEY) : s.level;
      var startedAt = Date.now(), endMs = set.minutes * 60000, limit = set.timeLimit ? set.timeLimit * 1000 : null;
      var rows = [], lureStats = {}, roundsDone = [];
      var rot = 0;
      try { rot = parseInt(localStorage.getItem(ROTATION_KEY), 10) || 0; } catch (e) {}

      function hud() { var e = document.querySelector(".h-session .h-bar .h-dim"); if (e) e.textContent = "level " + level; }
      hud();
      function tone(ok) { if (set.sound) s.audio.tone(ok ? 880 : 196, ok ? 90 : 220, ok ? 0.12 : 0.16); }
      function log(row) { var r = s.log(row); rows.push(r); checkpoint(); }
      function checkpoint(final) {
        if (final) return drop(CHECKPOINT_KEY);
        var scored = rows.filter(function (r) { return typeof r.correct === "boolean"; });
        var correct = scored.filter(function (r) { return r.correct; }).length;
        save(CHECKPOINT_KEY, { level: level, session: {
          id: startedAt + "-cp", start: startedAt, end: Date.now(), activeSeconds: Math.round(s.now() / 1000), completed: false,
          mode: "rounds", level: s.level, levelEnd: level, trials: scored.length, correct: correct,
          accuracy: scored.length ? correct / scored.length : null, settings: set,
          extra: { rounds: roundsDone, lures: lureStats, recovered: true }, trialLog: rows } });
      }
      function present(lines, question) {
        var isCode = compact;
        var html = '<div class="ra-card' + (isCode ? " ra-code" : "") + '"><div class="ra-premises">'
          + lines.map(function (l) { return "<p>" + (isCode ? paintCode(l) : paint(l)) + "</p>"; }).join("") + "</div>"
          + (question ? '<p class="ra-q">' + (isCode ? paintCode(String(question)) : paint(String(question))) + "</p>" : "") + "</div>";
        if (set.aloud && speech) {
          var said = (lines.spoken || lines).concat(question ? [question.spoken || String(question)] : []).join(". ");
          s.show(set.hideText ? '<div class="ra-card"><p class="ra-listen">…</p></div>' : html);
          return speak(said, set.voice).then(function () {
            if (set.hideText) s.show('<div class="ra-card' + (isCode ? " ra-code" : "") + '">' + (question ? '<p class="ra-q">' + (isCode ? paintCode(String(question)) : paint(String(question))) + "</p>" : "") + "</div>");
          });
        }
        s.show(html);
        return Promise.resolve();
      }
      async function explain(ok, parts) {
        var show = set.explain === "always" || (set.explain === "errors" && !ok);
        if (!show) { await s.wait(ok ? 400 : 800); return; }
        s.buttons([{ id: "next", label: compact ? "»" : "Go on", key: " " }]);
        s.show('<div class="ra-card ra-explain' + (compact ? " ra-code" : "") + '"><p class="ra-verdict ' + (ok ? "ok" : "bad") + '">' + (ok ? "✓" : "✗") + "</p>" + parts + "</div>");
        await s.respond({ accept: ["next"] });
      }
      function meaning(G, X, v, Y) { return compact ? paintCode(A.cMeaning(G, X, v, Y)) : paint(A.meaning(G, X, v, Y)); }
      function trapText(kind) { var t = TRAP[kind] || [kind, kind]; return compact ? t[1] : t[0]; }
      function decode(G, premises) {
        return '<details class="ra-decode"><summary>' + (compact ? "⇒" : "What each premise says") + "</summary><ul>" + premises.map(function (p) {
          return "<li>" + meaning(G, p.X, p.v, p.Y) + "</li>";
        }).join("") + "</ul></details>";
      }
      function render(G, o, premises, rng) { return compact ? A.renderCompact(G, o, premises, set.phrasing, rng) : A.render(G, o, premises, set.phrasing, rng); }

      /* ---- one round ---- */
      async function round(task, G) {
        var o = A.difficulty(level, task);
        if (!set.perspective) o.perspectiveShare = 0;
        var done = 0, right = 0, n = set.perRound;

        if (task === "nback") {
          var nb = o.n, items = A.nbackRound(G, A.Rng(), o, nb, n + nb, set.matchRule === "rotation" && G.name === "space").items;
          for (var i = 0; i < items.length && s.now() < endMs; i++) {
            var it = items[i], lines = render(G, o, it.premises, A.Rng()), scored = i >= nb;
            var sym = set.matchRule === "rotation" && G.name === "space" ? "≅" : "≡";
            s.buttons(scored ? [{ id: "match", label: compact ? "≡" : "Same", key: "f" }, { id: "diff", label: compact ? "≢" : "Different", key: "j" }]
                             : [{ id: "next", label: compact ? "»" : "Got it", key: " " }]);
            await present(lines, scored ? (compact ? sym + nb + "?" : "Same arrangement as " + nb + " back?") : (compact ? "⊢" + (i + 1) + "/" + nb : "Hold this (" + (i + 1) + " of " + nb + ")"));
            var r = await s.respond({ timeoutMs: scored ? limit : null });
            if (!scored) continue;
            var said = r ? r.id : null, ok = said === (it.target ? "match" : "diff");
            done++; if (ok) right++;
            tone(ok);
            if (!it.target) { lureStats[it.kind] = lureStats[it.kind] || { shown: 0, caught: 0 }; lureStats[it.kind].shown++; if (ok) lureStats[it.kind].caught++; }
            log({ target: it.target, response: said === "match" ? "match" : null, correct: ok, rtMs: r ? r.rtMs : null,
              extra: { task: "nback", material: G.name, kind: it.target ? "match" : it.kind, said: said, n: nb, level: level } });
            s.feedback(ok);
            await explain(ok, "<p>" + (it.target ? (compact ? sym : "The same arrangement") : (compact ? "≢ " : "Different: ") + esc(trapText(it.kind))) + "</p>"
              + '<div class="ra-pair"><div><small>−' + nb + "</small>" + drawing(G, items[i - nb].world) + "</div><div><small>0</small>" + drawing(G, it.world) + "</div></div>");
          }
          return { done: done, right: right };
        }

        var kinds = task === "mixed" ? ["question", "possible"].concat(G.metric ? ["howfar"] : []) : [task];
        for (var t = 0; t < n && s.now() < endMs; t++) {
          var kind = kinds[t % kinds.length], rng = A.Rng();
          var trial = kind === "question" ? A.questionTrial(G, rng, o) : kind === "possible" ? A.possibleTrial(G, rng, o) : A.howfarTrial(G, rng, o, set.metric);
          if (!trial) continue;
          var plines = render(G, o, trial.premises, rng), buttons, question;
          if (compact) question = A.cQuestion(trial, G, set.metric);
          if (kind === "question") {
            buttons = [{ id: "yes", label: compact ? "=" : "Yes", key: "f" }, { id: "no", label: compact ? "≠" : "No", key: "j" }, { id: "cant", label: compact ? "?" : "Can't tell", key: "k" }];
            if (!compact) question = trial.question;
          } else if (kind === "possible") {
            buttons = [{ id: "possible", label: compact ? "∃" : "Possible", key: "f" }, { id: "impossible", label: compact ? "∅" : "Impossible", key: "j" }];
            if (!compact) question = "Can all of this be true at once?";
          } else {
            buttons = trial.options.map(function (v, j) { return { id: v, label: v, key: String(j + 1) }; });
            if (!compact) question = trial.question;
          }
          s.buttons(buttons);
          await present(plines, question);
          var resp = await s.respond({ timeoutMs: limit });
          var given = resp ? resp.id : null, good = given === trial.answer;
          var signal = kind === "question" ? "yes" : kind === "possible" ? "possible" : null;
          done++; if (good) right++;
          tone(good);
          if (trial.lure) { lureStats[trial.lure] = lureStats[trial.lure] || { shown: 0, caught: 0 }; lureStats[trial.lure].shown++; if (good) lureStats[trial.lure].caught++; }
          log({
            target: signal ? trial.answer === signal : undefined,
            response: signal ? (given === signal ? signal : null) : given,
            correct: good, rtMs: resp ? resp.rtMs : null,
            extra: { task: kind, material: G.name, answer: trial.answer, said: given, lure: trial.lure || null, level: level,
              path: trial.pathLength || null, premises: trial.premises.length, nested: trial.premises.filter(function (p) { return p.kind === "nested"; }).length },
          });
          s.feedback(good);
          var why = "";
          if (kind === "question") {
            var ans = { yes: compact ? "=" : "Yes", no: compact ? "≠" : "No", cant: compact ? "?" : "Can't tell" }[trial.answer];
            why += "<p><b>" + ans + "</b>" + (trial.answer !== "cant" ? " · " + meaning(G, trial.X, trial.truth, trial.Y) : "") + "</p>";
            if (trial.answer === "cant") why += "<p>" + (compact ? "∅ " + esc(A.LETTER[trial.X]) + "…" + esc(A.LETTER[trial.Y]) : "Nothing links " + paint(trial.X) + "’s group to " + paint(trial.Y) + "’s.") + "</p>";
            if (trial.lure) why += "<p>" + (compact ? "" : "Trap: ") + esc(trapText(trial.lure)) + "</p>";
          } else if (kind === "possible") {
            why += "<p><b>" + (trial.answer === "possible" ? (compact ? "∃" : "Possible") : (compact ? "∅" : "Impossible: one premise breaks a loop")) + "</b></p>";
          } else {
            why += "<p>" + meaning(G, trial.X, trial.truth, trial.Y) + " · <b>" + trial.answer + "</b></p>";
          }
          await explain(good, why + decode(G, trial.premises) + (kind !== "possible" || trial.answer === "possible" ? drawing(G, trial.world) : ""));
        }
        return { done: done, right: right };
      }

      /* ---- the rounds ---- */
      /* Round r's task and material. The material steps every round; the task
       * steps every round too, and once more after each pass through the
       * materials, so all 24 pairings come up within 24 rounds (stepping both
       * by one would only ever pair even with even). How far needs a distance,
       * so in a material without one it becomes questions. */
      function plan(r) {
        var i = rot + r;
        var material = set.material === "rotate" ? G_ORDER[i % G_ORDER.length] : set.material;
        var task = set.task === "rotate" ? T_ORDER[(i + (set.material === "rotate" ? Math.floor(i / G_ORDER.length) : 0)) % T_ORDER.length] : set.task;
        if (task === "howfar" && !A.GROUPS[material].metric) task = "question";
        return { task: task, material: material };
      }
      try {
        var r = 0, empty = 0;
        while (s.now() < endMs) {
          var p = plan(r), task = p.task, material = p.material, G = A.GROUPS[material];
          var from = level, res = await round(task, G);
          r++;
          if (!res.done) { if (++empty >= 3) break; continue; }
          empty = 0;
          var acc = res.right / res.done;
          if (res.done >= Math.min(4, set.perRound)) level = acc >= 0.8 ? Math.min(20, level + 1) : acc < 0.6 ? Math.max(1, level - 1) : level;
          save(LEVEL_KEY, level);
          hud();
          roundsDone.push({ task: task, material: material, trials: res.done, correct: res.right, from: from, to: level });
          checkpoint();
          if (s.now() >= endMs) break;
          var nx = plan(r), nextTask = nx.task, nextMaterial = nx.material;
          var left = Math.max(0, Math.round((endMs - s.now()) / 60000));
          s.buttons([{ id: "next", label: compact ? "»" : "Next round", key: " " }]);
          s.show('<div class="ra-card ra-round' + (compact ? " ra-code" : "") + '"><p class="ra-q">' + (compact
            ? "#" + r + " · " + Math.round(acc * 100) + "% · L" + from + "→" + level + " · → " + nextTask + "/" + nextMaterial + " · " + left + "m"
            : "Round " + r + ": " + Math.round(acc * 100) + "% · level " + from + " → " + level + ". Next: " + nextTask + ", " + A.GROUPS[nextMaterial].label + ". " + left + " min left.") + "</p></div>");
          await s.respond({ accept: ["next"], timeoutMs: 8000 });
        }
      } finally {
        try { localStorage.setItem(ROTATION_KEY, String(rot + Math.max(1, roundsDone.length))); } catch (e) {}
        checkpoint(true);
      }
      return { mode: "rounds", modalities: ["visual"].concat(set.aloud ? ["audio"] : []), levelEnd: level,
        extra: { rounds: roundsDone, lures: lureStats, notation: set.notation } };
    },
  });
})();

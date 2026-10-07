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
  var G_ORDER = ["space", "numbers", "notes", "days", "compass", "square", "pose"];
  var T_ORDER = ["question", "possible", "howfar", "nback"];
  var COLOURS = { Red: "#e5534b", Blue: "#539bf5", Green: "#57ab5a", Gold: "#d4af37", Violet: "#b083f0", White: "#e6edf3" };
  var LETTER_COLOURS = { R: "Red", B: "Blue", G: "Green", O: "Gold", V: "Violet", W: "White" };
  var TRAP = {
    ignored: ["nesting ignored", "∅n"], dropLeft: ["left offsets dropped", "−L"], dropRight: ["right offsets dropped", "−R"],
    sign: ["wrong sign", "±"], order: ["wrong order", "⇄"], frame: ["perspective read facing north", "@8"],
    step: ["one step off", "±1"], rotate90: ["turned a quarter", "↻"], rotate180: ["turned half way", "↻↻"],
    rotate270: ["turned a quarter back", "↺"], mirrorEW: ["mirrored east-west", "⇋"], mirrorNS: ["mirrored north-south", "⇅"],
    diagonal: ["flipped on a diagonal", "⤡"], reverse: ["reversed", "−"], conjugate: ["seen in a mirror", "m·m"],
    noTurn: ["the turn left out", "∅q"], turnFirst: ["turned before stepping", "q→"],
    inverse: ["undone instead of done", "⁻¹"], swap: ["two objects swapped", "⇆"], plain: ["a new arrangement", "≠"],
  };
  var LEVEL_KEY = "chimera.relations.level.v1";
  var CHECKPOINT_KEY = "chimera.relations.checkpoint.v1";
  var RECORD_KEY = "chimera.relations.record.v1";
  var ROTATION_KEY = "chimera.relations.rotation";
  var VERSION = "1.3.0";

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
  /* One line at a time, so lines can be spaced and a pause can stop a line
   * and start it again on resume (speechSynthesis.pause is unreliable on
   * phones). A line that never reports its end is let go after a while. */
  var Voice = { rate: 1, which: "best", held: false, cur: null };
  function sayLine(text) {
    return new Promise(function (resolve) {
      if (!speech) return resolve();
      Voice.cur = { text: String(text).replace(/°/g, " degrees"), resolve: resolve, u: null, timer: null };
      if (!Voice.held) startLine(Voice.cur);
    });
  }
  function startLine(job) {
    speech.cancel();
    var u = new SpeechSynthesisUtterance(job.text);
    if (Voice.which === "best" && bestVoice) u.voice = bestVoice;
    u.rate = Voice.rate;
    job.u = u;
    var fin = function () {
      if (job.u !== u) return;
      job.u = null; clearTimeout(job.timer);
      if (Voice.cur === job) Voice.cur = null;
      job.resolve();
    };
    u.onend = fin; u.onerror = fin;
    job.timer = setTimeout(fin, (2500 + job.text.length * 110) / Voice.rate);
    speech.speak(u);
  }
  function stopLine() {
    if (Voice.cur) { Voice.cur.u = null; clearTimeout(Voice.cur.timer); }
    if (speech) speech.cancel();
  }
  function hold() { Voice.held = true; stopLine(); }
  function unhold() { Voice.held = false; if (Voice.cur) startLine(Voice.cur); }
  function hush() { var c = Voice.cur; stopLine(); Voice.cur = null; Voice.held = false; if (c) c.resolve(); }

  /* ---- drawings for explanations ---- */
  var useLetters = false;
  function tag(n) { return useLetters ? A.LETTER[n] : n.slice(0, 2); }
  function drawing(G, world) {
    var names = world.names, v = world.vals;
    if (G.name === "pose") {
      /* Each object at its place, with a pointer for its facing; a dashed
         ring when it is mirrored (its left and right swapped). */
      var px = names.map(function (n) { return v[n][0]; }), py = names.map(function (n) { return v[n][1]; });
      var a0 = Math.min.apply(null, px) - 1, a1 = Math.max.apply(null, px) + 1, b0 = Math.min.apply(null, py) - 1, b1 = Math.max.apply(null, py) + 1;
      var cp = 30, PW = (a1 - a0) * cp, PH = (b1 - b0) * cp, o2 = '<svg class="ra-draw" viewBox="0 0 ' + PW + " " + PH + '" width="' + Math.min(PW, 320) + '">';
      for (var gx = a0; gx <= a1; gx++) o2 += '<line x1="' + (gx - a0) * cp + '" y1="0" x2="' + (gx - a0) * cp + '" y2="' + PH + '" class="ra-grid"/>';
      for (var gy = b0; gy <= b1; gy++) o2 += '<line x1="0" y1="' + (b1 - gy) * cp + '" x2="' + PW + '" y2="' + (b1 - gy) * cp + '" class="ra-grid"/>';
      var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];        /* screen: north is up */
      var at = {};                                          /* objects sharing a square sit side by side */
      names.forEach(function (n) {
        var k = v[n][0] + "," + v[n][1], i = at[k] = (at[k] || 0) + 1, shift = (i - 1) * 9 - (names.filter(function (m) { return v[m][0] + "," + v[m][1] === k; }).length - 1) * 4.5;
        var cx = (v[n][0] - a0) * cp + shift, cy = (b1 - v[n][1]) * cp + shift, d = DIRS[v[n][2]];
        o2 += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + d[0] * 15) + '" y2="' + (cy + d[1] * 15) + '" stroke="' + COLOURS[n] + '" stroke-width="3"/>'
          + '<circle cx="' + (cx + d[0] * 15) + '" cy="' + (cy + d[1] * 15) + '" r="2.5" fill="' + COLOURS[n] + '"/>';
        if (v[n][3]) o2 += '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="none" stroke="' + COLOURS[n] + '" stroke-dasharray="3 2"/>';
        o2 += '<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="' + COLOURS[n] + '"/><text x="' + cx + '" y="' + (cy + 4) + '" class="ra-lbl">' + tag(n) + "</text>";
      });
      return o2 + '<text x="4" y="12" class="ra-n">N↑</text></svg>';
    }
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
    + "<p><b>Poses</b>: each object stands somewhere, faces some way, and may be mirrored (its left and right swapped). A relation is a walk from the other object, read left to right in the walker’s own frame: ^ a step ahead, v back, &lt; left, &gt; right, and the orientation letters to turn or mirror the walker. "
    + "<code>R=B^^&lt;q</code>: start at Blue, two steps ahead, one left, turn a quarter right: that is Red. Every turn changes what “ahead” means for the steps after it.</p>"
    + "<p><b>Either/or</b> (levels 21 to 30): <code>R=B(6|9)</code>: Red is one east or one north-east of Blue, and only one of them is true. Another route through the premises can settle which.</p>"
    + "<p><b>Marks</b> are names for places: <code>P=R6</code> then <code>B=P88</code>. Mark letters are P S T U X Y Z A C E F J K L N, doubled after the fifteenth (PP…).</p>"
    + "<p><b>Questions</b>: <code>R=B6?</code> (answer <b>=</b> it must be, <b>≠</b> it can’t be, or <b>?</b> not settled: nothing links them, or it depends on how an either/or is read); <code>∃?</code> (can all of it be true?: ∃ yes, ∅ no); "
    + "<code>|R−B|₁?</code> steps along the grid, <code>|R−B|∞?</code> king's moves; <code>≡3?</code> the same arrangement as 3 back (≡ same, ≢ different), <code>≅3?</code> the same up to rotation. "
    + "While building the first n of an n-back round: <code>⊢k/n</code>, go on with ».</p>"
    + "<p><b>Traps</b> in explanations: ∅n nesting ignored, −L / −R one side's offsets dropped, ± wrong sign, ⇄ wrong order, @8 perspective read facing north, ±1 one step off, ↻ ↺ turned, ⇋ ⇅ mirrored, ⤡ diagonal, ⁻¹ undone (in poses: seen from the other side), ∅q the turn left out, q→ turned before stepping, ⇆ two swapped.</p>";

  var EAR_GUIDE =
    "<h3>Eyes closed</h3>"
    + "<p>Set <b>Play</b> to <i>Eyes closed</i>. Every premise and question is spoken, and the whole screen below the bar becomes the answer pad, so the phone can be held without looking. "
    + "Two answers: the left and right halves. Three: left, middle, right (yes, can’t tell, no). Four: the quarters, 1 2 above 3 4. One (go on): anywhere. "
    + "A key works too: F, K, J, 1–4, Space. The phone buzzes on every touch, and the screen is kept on. Two soft rising notes mean the question comes next.</p>"
    + "<p>Each round starts with its number, task and material. Mistakes are explained in a few words (or every answer, if you set it), and each round ends with the score and the level. "
    + "Escape or the Pause button pauses, and the voice stops with it.</p>"
    + "<h3>The spoken code</h3>"
    + "<p>The compact code, said word for word, in words picked to be told apart by ear:</p><ul>"
    + "<li><b>=</b> is · objects by colour: Red, Blue, Green, Gold, Violet, White.</li>"
    + "<li><b>Space</b>: the keypad digit as a word; two in a row are <i>double</i>, three <i>triple</i>, four <i>quad</i>. <code>R666944</code>: “Red triple six nine double four”.</li>"
    + "<li><b>Perspective</b>: <i>face</i> and a digit, then <i>front, back, left, right</i>. <code>R=B@4vvv&gt;&gt;&gt;</code>: “Red is Blue face four triple back triple right”.</li>"
    + "<li><b>Numbers, notes, days, headings</b>: <i>up</i> and <i>down</i>. <code>W+5=O+1−5</code>: “White up 5 is Gold up 1 down 5”. The modulus is said first: “mod 12”.</li>"
    + "<li><b>Orientations</b>: q <i>clock</i>, Q <i>counter</i>, h <i>half</i>, m <i>mirror</i>, M <i>flip</i>, d <i>rise</i>, D <i>fall</i>.</li>"
    + "<li><b>Poses</b>: the walk word for word: <i>front, back, left, right</i> for steps, the orientation words for turns. <code>R=B^^&lt;q</code>: “Red is Blue double front left clock”.</li>"
    + "<li><b>Either/or</b>: <code>R=B(6|9)</code>: “Red is Blue either six or nine”.</li>"
    + "<li><b>Marks</b> P S T U X Y Z A C E F J K L N are Fox, Jar, Key, Lamp, Moon, Nest, Oak, Pond, Rope, Sun, Tent, Cup, Drum, Hat, Kite; a doubled letter is “big”: PP is “big Fox”.</li>"
    + "<li><b>Questions</b>: “Is Red Blue six?”; “Possible?”; “Red to Blue, grid?” or “king?”, then the choices, smallest first; “Same as 2 back?” (“, any turn” up to rotation); “Hold, 1 of 2”.</li></ul>"
    + "<p><b>Speech rate</b> and <b>Silence between premises</b> set the pace. The voice is the most natural one the device has.</p>";

  Harness.start({
    id: "relations",
    name: "Relation Algebra",
    version: VERSION,
    what: "Nested relations in space, numbers, notes, days, headings and orientations",
    unit: "level",
    level: { start: 1, min: 1, max: 30 },

    instructions:
      "<p>Each trial describes some objects by how they relate: places on a grid, numbers, notes, days, headings, or a tile’s orientation. Combine the relations to answer.</p>"
      + "<p>A session is a run of <b>rounds</b>. A round is a set number of trials of one task in one material; the task and the material can change from round to round, and the level moves after every round. A session runs for the length you choose, 10 minutes to 5 hours; a long one is saved as it goes.</p>"
      + "<p><b>Tasks</b>: questions (true, false, or can’t tell when nothing links the two), possible (can every premise be true at once?), how far (steps apart), and structure n-back (the same arrangement as n back, however it is written).</p>"
      + "<p><b>Traps</b>: the wrong answers on offer are the answers of particular mistakes, and the explanation after a mistake names which.</p>"
      + NOTATION_GUIDE
      + EAR_GUIDE
      + "<h3>Words</h3><p>With the notation set to Words, the same premises are written out: “The place one step east of Red is two steps west and two steps north of Blue.”</p>"
      + "<p>Keys: <b>F</b> yes / same / possible, <b>J</b> no / different / impossible, <b>K</b> can’t tell, <b>1–4</b> distances, <b>Space</b> go on, <b>Escape</b> pause.</p>",

    settings: [
      { key: "notation", label: "Text", type: "select", default: "compact", options: [
        { value: "compact", label: "Compact notation (see How it works)" }, { value: "words", label: "Words" }] },
      { key: "play", label: "Play", type: "select", default: "screen", options: [
        { value: "screen", label: "On screen" }, { value: "aloud", label: "On screen, read aloud" },
        { value: "ears", label: "Eyes closed (audio only)" }] },
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
        { value: "square", label: "Orientations (order matters)" }, { value: "pose", label: "Poses (place, facing and side together)" }] },
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
      { key: "voice", label: "Voice", type: "select", default: "best", options: [
        { value: "best", label: "The best this device has (natural / neural first)" }, { value: "default", label: "The device's default" }] },
      { key: "rate", label: "Speech rate", type: "select", default: 1, options: [
        { value: 0.8, label: "0.8×" }, { value: 0.9, label: "0.9×" }, { value: 1, label: "1×" }, { value: 1.15, label: "1.15×" },
        { value: 1.3, label: "1.3×" }, { value: 1.5, label: "1.5×" }, { value: 1.75, label: "1.75×" }] },
      { key: "gap", label: "Silence between premises", type: "select", default: 400, options: [
        { value: 0, label: "None" }, { value: 200, label: "0.2 s" }, { value: 400, label: "0.4 s" }, { value: 800, label: "0.8 s" }, { value: 1500, label: "1.5 s" }] },
    ],

    buttons: [],

    async session(s) {
      var set = s.settings, compact = set.notation === "compact";
      /* Eyes closed: everything is heard, and the whole screen is the answer
         pad. Read aloud: the screen as usual, and the voice too. */
      var ears = set.play === "ears" && !!speech, aloud = ears || (set.play === "aloud" && !!speech);
      useLetters = compact;
      Voice.rate = +set.rate || 1; Voice.which = set.voice; Voice.held = false;
      var level = typeof load(LEVEL_KEY) === "number" ? load(LEVEL_KEY) : s.level;
      var startedAt = Date.now(), endMs = set.minutes * 60000, limit = set.timeLimit ? set.timeLimit * 1000 : null;
      var rows = [], lureStats = {}, roundsDone = [];
      var rot = 0;
      try { rot = parseInt(localStorage.getItem(ROTATION_KEY), 10) || 0; } catch (e) {}

      /* Speech must stop when the session does: every line races a wait that
         never ends but is rejected when the session is ended. */
      var ended = s.wait(Infinity); ended.catch(function () {});
      function say(text) { return Promise.race([sayLine(text), ended]); }
      async function sayAll(lines, gap) {
        for (var i = 0; i < lines.length; i++) { await say(lines[i]); if (gap && i < lines.length - 1) await s.wait(gap); }
      }
      /* Two soft rising notes: the question comes next. */
      async function cue() { s.audio.tone(660, 55, 0.05); await s.wait(80); s.audio.tone(990, 70, 0.05); await s.wait(160); }

      /* The harness's pause veil stops the voice; resuming starts the line again. */
      var veil = document.querySelector(".h-session .h-veil"), watch = null;
      if (aloud && veil && typeof MutationObserver !== "undefined") {
        watch = new MutationObserver(function () { if (veil.hidden) unhold(); else hold(); });
        watch.observe(veil, { attributes: true, attributeFilter: ["hidden"] });
      }
      /* Eyes closed: keep the screen on, and buzz on every touch. */
      var lock = null, pad = document.querySelector(".h-session .h-pad"), bar = document.querySelector(".h-session .h-bar");
      function wake() {
        if (!ears || document.visibilityState !== "visible" || !navigator.wakeLock) return;
        navigator.wakeLock.request("screen").then(function (l) { lock = l; }, function () {});
      }
      function buzz() { if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {} }
      if (ears) {
        document.body.classList.add("ra-ears");
        if (bar) document.body.style.setProperty("--ra-top", Math.ceil(bar.getBoundingClientRect().bottom + 8) + "px");
        if (pad) pad.addEventListener("pointerdown", buzz);
        document.addEventListener("visibilitychange", wake);
        wake();
      }
      function buttons(defs) { s.buttons(defs); if (pad) pad.dataset.n = defs.length; }

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
          extra: { rounds: roundsDone, lures: lureStats, play: set.play, recovered: true }, trialLog: rows } });
      }
      function card(lines, question) {
        var f = compact ? paintCode : paint;
        return '<div class="ra-card' + (compact ? " ra-code" : "") + '"><div class="ra-premises">'
          + lines.map(function (l) { return "<p>" + f(l) + "</p>"; }).join("") + "</div>"
          + (question ? '<p class="ra-q">' + f(String(question)) + "</p>" : "") + "</div>";
      }
      /* Show and/or say a description and its question. Resolves when the
         question has been said, which is when the answer is timed from. */
      async function present(lines, question) {
        s.show(ears ? '<div class="ra-card"><p class="ra-listen">' + (compact ? "◦" : "listening") + "</p></div>" : card(lines, question));
        if (!aloud) return;
        await sayAll(lines.spoken || lines, set.gap);
        if (question) { await cue(); await say(question.spoken || String(question)); }
      }
      /* Explanations. On screen: a card to read and a button. By ear: a few
         words, then straight on. */
      async function explain(ok, parts, spoken) {
        var show = set.explain === "always" || (set.explain === "errors" && !ok);
        if (ears) {
          if (show) { await s.wait(250); await sayAll([ok ? "Correct." : "Wrong."].concat(spoken), 150); await s.wait(500); }
          else await s.wait(ok ? 400 : 700);
          return;
        }
        if (!show) { await s.wait(ok ? 400 : 800); return; }
        buttons([{ id: "next", label: compact ? "»" : "Go on", key: " " }]);
        s.show('<div class="ra-card ra-explain' + (compact ? " ra-code" : "") + '"><p class="ra-verdict ' + (ok ? "ok" : "bad") + '">' + (ok ? "✓" : "✗") + "</p>" + parts + "</div>");
        await s.respond({ accept: ["next"] });
      }
      function meaning(G, X, v, Y) { return compact ? paintCode(A.cMeaning(G, X, v, Y)) : paint(A.meaning(G, X, v, Y)); }
      function heardMeaning(G, X, v, Y) { return compact ? A.ear(A.cMeaning(G, X, v, Y)) : A.meaning(G, X, v, Y); }
      function trapText(kind) { var t = TRAP[kind] || [kind, kind]; return compact ? t[1] : t[0]; }
      function trapWords(kind) { return (TRAP[kind] || [kind])[0]; }
      function decode(G, premises) {
        return '<details class="ra-decode"><summary>' + (compact ? "⇒" : "What each premise says") + "</summary><ul>" + premises.map(function (p) {
          if (p.r2) return "<li>" + meaning(G, p.X, p.v, p.Y) + " ✓ " + (compact ? "| " : "or ") + meaning(G, p.X, p.v2, p.Y) + " ✗</li>";
          return "<li>" + meaning(G, p.X, p.v, p.Y) + "</li>";
        }).join("") + "</ul></details>";
      }
      function render(G, o, premises, rng) { return compact ? A.renderCompact(G, o, premises, set.phrasing, rng) : A.render(G, o, premises, set.phrasing, rng); }
      /* Labels: symbols in code, words otherwise, and always words by ear (for
         whoever sets the phone up). */
      function lbl(sym, word) { return compact && !ears ? sym : word; }

      /* ---- one round ---- */
      async function round(task, G) {
        var o = A.difficulty(level, task);
        if (!set.perspective) o.perspectiveShare = 0;
        var done = 0, right = 0, n = set.perRound;

        if (task === "nback") {
          var nb = o.n, rotOK = set.matchRule === "rotation" && G.name === "space";
          var items = A.nbackRound(G, A.Rng(), o, nb, n + nb, rotOK).items;
          for (var i = 0; i < items.length && s.now() < endMs; i++) {
            var it = items[i], lines = render(G, o, it.premises, A.Rng()), scored = i >= nb;
            var sym = rotOK ? "≅" : "≡";
            buttons(scored ? [{ id: "match", label: lbl("≡", "Same"), key: "f" }, { id: "diff", label: lbl("≢", "Different"), key: "j" }]
                           : [{ id: "next", label: lbl("»", ears ? "Go on" : "Got it"), key: " " }]);
            var q;
            if (compact) { q = new String(scored ? sym + nb + "?" : "⊢" + (i + 1) + "/" + nb); q.spoken = A.ear(String(q)); }
            else q = scored ? "Same arrangement as " + nb + " back" + (rotOK ? ", up to rotation" : "") + "?" : "Hold this (" + (i + 1) + " of " + nb + ")";
            await present(lines, q);
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
              + '<div class="ra-pair"><div><small>−' + nb + "</small>" + drawing(G, items[i - nb].world) + "</div><div><small>0</small>" + drawing(G, it.world) + "</div></div>",
              [it.target ? "Same." : "Different: " + trapWords(it.kind) + "."]);
          }
          return { done: done, right: right };
        }

        var kinds = task === "mixed" ? ["question", "possible"].concat(G.metric ? ["howfar"] : []) : [task];
        for (var t = 0; t < n && s.now() < endMs; t++) {
          var kind = kinds[t % kinds.length], rng = A.Rng();
          var trial = kind === "question" ? A.questionTrial(G, rng, o) : kind === "possible" ? A.possibleTrial(G, rng, o) : A.howfarTrial(G, rng, o, set.metric);
          if (!trial) continue;
          var plines = render(G, o, trial.premises, rng), bs, question;
          if (compact) question = A.cQuestion(trial, G, set.metric);
          if (kind === "question") {
            /* By ear the pad is left, middle, right: yes, can't tell, no. */
            var yes = { id: "yes", label: lbl("=", "Yes"), key: "f" }, no = { id: "no", label: lbl("≠", "No"), key: "j" }, cant = { id: "cant", label: lbl("?", "Can't tell"), key: "k" };
            bs = ears ? [yes, cant, no] : [yes, no, cant];
            if (!compact) question = trial.question;
          } else if (kind === "possible") {
            bs = [{ id: "possible", label: lbl("∃", "Possible"), key: "f" }, { id: "impossible", label: lbl("∅", "Impossible"), key: "j" }];
            if (!compact) question = "Can all of this be true at once?";
          } else {
            /* By ear the options are said after the question, smallest first,
               in pad order, so where an answer is never has to be remembered. */
            var opts = ears ? trial.options.slice().sort(function (a, b) { return a - b; }) : trial.options;
            bs = opts.map(function (v, j) { return { id: v, label: v, key: String(j + 1) }; });
            if (!compact) question = trial.question;
            if (aloud) { var qs = new String(String(question)); qs.spoken = (question.spoken || String(question)).replace(/\?$/, "") + ": " + opts.join(", ") + "?"; question = qs; }
          }
          buttons(bs);
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
          var why = "", heard = [];
          if (kind === "question" && trial.either && !trial.unlinked) {
            /* Either/or: what the premises allow, over every reading that fits. */
            var ansE = { yes: compact ? "=" : "Must be", no: compact ? "≠" : "Can't be", cant: compact ? "?" : "Not settled" }[trial.answer];
            var allowed = trial.possible.map(function (v) { return meaning(G, trial.X, v, trial.Y); });
            why += "<p><b>" + ansE + "</b> · " + allowed.join(compact ? " | " : " or ") + "</p>";
            if (trial.lure) why += "<p>" + (compact ? "" : "Trap: ") + esc(trapText(trial.lure)) + "</p>";
            heard = [{ yes: "Must be.", no: "Can't be.", cant: "Not settled." }[trial.answer],
              (trial.possible.length > 1 ? "It could be " : "It is ") + trial.possible.map(function (v) { return heardMeaning(G, trial.X, v, trial.Y); }).join(", or ") + "."]
              .concat(trial.lure ? ["Trap: " + trapWords(trial.lure) + "."] : []);
          } else if (kind === "question") {
            var ans = { yes: compact ? "=" : "Yes", no: compact ? "≠" : "No", cant: compact ? "?" : "Can't tell" }[trial.answer];
            why += "<p><b>" + ans + "</b>" + (trial.answer !== "cant" ? " · " + meaning(G, trial.X, trial.truth, trial.Y) : "") + "</p>";
            if (trial.answer === "cant") why += "<p>" + (compact ? "∅ " + esc(A.LETTER[trial.X]) + "…" + esc(A.LETTER[trial.Y]) : "Nothing links " + paint(trial.X) + "’s group to " + paint(trial.Y) + "’s.") + "</p>";
            if (trial.lure) why += "<p>" + (compact ? "" : "Trap: ") + esc(trapText(trial.lure)) + "</p>";
            heard = trial.answer === "cant" ? ["Can't tell: nothing links " + trial.X + " and " + trial.Y + "."]
              : [{ yes: "Yes.", no: "No." }[trial.answer], heardMeaning(G, trial.X, trial.truth, trial.Y) + "."].concat(trial.lure ? ["Trap: " + trapWords(trial.lure) + "."] : []);
          } else if (kind === "possible") {
            var eo = trial.premises.some(function (p) { return p.r2; });
            var no = eo ? "Impossible: no choice of readings closes every loop" : "Impossible: one premise breaks a loop";
            why += "<p><b>" + (trial.answer === "possible" ? (compact ? "∃" : "Possible") : (compact ? "∅" : no)) + "</b></p>";
            heard = [trial.answer === "possible" ? "Possible." : no + "."];
          } else {
            why += "<p>" + meaning(G, trial.X, trial.truth, trial.Y) + " · <b>" + trial.answer + "</b></p>";
            heard = [heardMeaning(G, trial.X, trial.truth, trial.Y) + ".", trial.answer + " apart."];
          }
          await explain(good, why + decode(G, trial.premises) + (kind !== "possible" || trial.answer === "possible" ? drawing(G, trial.world) : ""), heard);
        }
        return { done: done, right: right };
      }

      /* ---- the rounds ---- */
      /* Round r's task and material. The material steps every round; the task
       * is the material's place in the order plus the number of passes made
       * through the materials, so all 28 pairings come up within 28 rounds.
       * How far needs a distance, so in a material without one it becomes
       * questions. */
      function plan(r) {
        var i = rot + r, len = G_ORDER.length;
        var material = set.material === "rotate" ? G_ORDER[i % len] : set.material;
        var task = set.task === "rotate" ? T_ORDER[(set.material === "rotate" ? i % len + Math.floor(i / len) : i) % T_ORDER.length] : set.task;
        if (task === "howfar" && !A.GROUPS[material].metric) task = "question";
        return { task: task, material: material };
      }
      var TASK_WORDS = { question: "questions", possible: "possible", howfar: "how far", nback: "n-back", mixed: "mixed" };
      var MATERIAL_WORDS = { space: "space", numbers: "numbers", notes: "notes", days: "days", compass: "headings", square: "tiles", pose: "poses" };
      try {
        var r = 0, empty = 0;
        while (s.now() < endMs) {
          var p = plan(r), task = p.task, material = p.material, G = A.GROUPS[material];
          if (ears) {
            s.show('<div class="ra-card"><p class="ra-listen">' + (r + 1) + " · " + TASK_WORDS[task] + " · " + MATERIAL_WORDS[material] + "</p></div>");
            await say("Round " + (r + 1) + ". " + TASK_WORDS[task] + ", " + MATERIAL_WORDS[material] + (task === "nback" ? ", " + A.difficulty(level, task).n + " back" : "") + ".");
            await s.wait(700);
          }
          var from = level, res = await round(task, G);
          r++;
          if (!res.done) { if (++empty >= 3) break; continue; }
          empty = 0;
          var acc = res.right / res.done;
          if (res.done >= Math.min(4, set.perRound)) level = acc >= 0.8 ? Math.min(30, level + 1) : acc < 0.6 ? Math.max(1, level - 1) : level;
          save(LEVEL_KEY, level);
          hud();
          roundsDone.push({ task: task, material: material, trials: res.done, correct: res.right, from: from, to: level });
          checkpoint();
          if (s.now() >= endMs) break;
          var nx = plan(r), nextTask = nx.task, nextMaterial = nx.material;
          var left = Math.max(0, Math.round((endMs - s.now()) / 60000));
          if (ears) {
            buttons([]);
            await say(Math.round(acc * 100) + " percent. Level " + level + ". " + left + " minutes left.");
            await s.wait(1200);
            continue;
          }
          buttons([{ id: "next", label: compact ? "»" : "Next round", key: " " }]);
          s.show('<div class="ra-card ra-round' + (compact ? " ra-code" : "") + '"><p class="ra-q">' + (compact
            ? "#" + r + " · " + Math.round(acc * 100) + "% · L" + from + "→" + level + " · → " + nextTask + "/" + nextMaterial + " · " + left + "m"
            : "Round " + r + ": " + Math.round(acc * 100) + "% · level " + from + " → " + level + ". Next: " + nextTask + ", " + A.GROUPS[nextMaterial].label + ". " + left + " min left.") + "</p></div>");
          await s.respond({ accept: ["next"], timeoutMs: 8000 });
        }
        if (ears) await say("Session over. Level " + level + ".");
      } finally {
        try { localStorage.setItem(ROTATION_KEY, String(rot + Math.max(1, roundsDone.length))); } catch (e) {}
        checkpoint(true);
        hush();
        if (watch) watch.disconnect();
        document.body.classList.remove("ra-ears");
        if (pad) { pad.removeEventListener("pointerdown", buzz); delete pad.dataset.n; }
        document.removeEventListener("visibilitychange", wake);
        if (lock) lock.release().catch(function () {});
      }
      return { mode: "rounds", modalities: ears ? ["audio"] : ["visual"].concat(aloud ? ["audio"] : []), levelEnd: level,
        extra: { rounds: roundsDone, lures: lureStats, notation: set.notation, play: aloud ? set.play : "screen" } };
    },
  });
})();

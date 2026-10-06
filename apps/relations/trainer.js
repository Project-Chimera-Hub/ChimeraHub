"use strict";
/* Relation Algebra: nested relations in six materials, on the hub's harness.
 * The logic is all in algebra.js (tested in test/algebra.test.js); this file
 * shows it, takes the answers, explains them, and logs them. */

(function () {
  var A = window.Algebra;
  var G_ORDER = ["space", "numbers", "notes", "days", "compass", "square"];
  var COLOURS = { Red: "#e5534b", Blue: "#539bf5", Green: "#57ab5a", Gold: "#d4af37", Violet: "#b083f0", White: "#e6edf3" };
  var LURE_TEXT = {
    ignored: "what you get if the nesting is read as if it weren't there",
    dropLeft: "what you get if the offsets on the left of a premise are dropped",
    dropRight: "what you get if the offsets on the right of a premise are dropped",
    sign: "what you get if offsets are applied with the wrong sign (added where they should be taken away)",
    order: "what you get if the steps of a chain are done in the wrong order",
    frame: "what you get if “left” and “ahead” are read as if facing north",
    step: "one step off the true answer",
    rotate90: "the true answer turned a quarter", rotate180: "the true answer turned half way round",
    rotate270: "the true answer turned a quarter the other way",
    mirrorEW: "the true answer mirrored east to west", mirrorNS: "the true answer mirrored north to south",
    diagonal: "the true answer flipped along a diagonal", reverse: "the true answer reversed",
    conjugate: "the true answer seen in a mirror", inverse: "the true answer undone instead of done",
  };
  var ROTATION_KEY = "chimera.relations.rotation";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function paint(s) {
    return esc(s).replace(/\b(Red|Blue|Green|Gold|Violet|White)\b/g, function (n) { return '<b style="color:' + COLOURS[n] + '">' + n + "</b>"; });
  }

  /* ---- reading aloud: the device's own speech, if it has one ---- */
  var speech = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
  function speak(lines) {
    return new Promise(function (resolve) {
      if (!speech) return resolve();
      speech.cancel();
      var u = new SpeechSynthesisUtterance(lines.join(" ").replace(/°/g, " degrees"));
      u.rate = 0.9;
      var done = false, finish = function () { if (!done) { done = true; resolve(); } };
      u.onend = finish; u.onerror = finish;
      setTimeout(finish, 4000 + lines.join(" ").length * 120);
      speech.speak(u);
    });
  }
  document.addEventListener("visibilitychange", function () {
    if (!speech) return;
    if (document.hidden) speech.pause(); else speech.resume();
  });

  /* ---- drawings for explanations ---- */
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
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="' + COLOURS[n] + '"/><text x="' + cx + '" y="' + (cy + 4) + '" class="ra-lbl">' + n.slice(0, 2) + "</text>";
      });
      return out + '<text x="4" y="12" class="ra-n">N↑</text></svg>';
    }
    if (G.name === "numbers") {
      var vals = names.map(function (n) { return v[n]; }), lo = Math.min.apply(null, vals) - 1, hi = Math.max.apply(null, vals) + 1;
      var step = Math.max(10, Math.min(28, 300 / (hi - lo))), W2 = (hi - lo) * step, s2 = '<svg class="ra-draw" viewBox="0 -4 ' + W2 + ' 46" width="' + Math.min(W2, 320) + '"><line x1="0" y1="22" x2="' + W2 + '" y2="22" class="ra-grid"/>';
      names.forEach(function (n) { var cx = (v[n] - lo) * step; s2 += '<circle cx="' + cx + '" cy="22" r="7" fill="' + COLOURS[n] + '"/><text x="' + cx + '" y="10" class="ra-lbl2">' + n.slice(0, 2) + '</text><text x="' + cx + '" y="40" class="ra-lbl2">' + v[n] + "</text>"; });
      return s2 + "</svg>";
    }
    if (G.name === "notes" || G.name === "days" || G.name === "compass") {
      var n = G.n, r = 52, s3 = '<svg class="ra-draw" viewBox="-70 -70 140 140" width="150"><circle r="' + r + '" class="ra-ring"/>';
      for (var k = 0; k < n; k++) { var a = k / n * 2 * Math.PI; s3 += '<circle cx="' + (r * Math.sin(a)) + '" cy="' + (-r * Math.cos(a)) + '" r="2" class="ra-tick"/>'; }
      names.forEach(function (nm, i) {
        var a = v[nm] / n * 2 * Math.PI, rr = G.name === "compass" ? 20 + i * 6 : r;
        if (G.name === "compass") s3 += '<line x1="0" y1="0" x2="' + (rr * Math.sin(a)) + '" y2="' + (-rr * Math.cos(a)) + '" stroke="' + COLOURS[nm] + '" stroke-width="3"/>';
        s3 += '<circle cx="' + (rr * Math.sin(a)) + '" cy="' + (-rr * Math.cos(a)) + '" r="7" fill="' + COLOURS[nm] + '"/><text x="' + (rr * Math.sin(a)) + '" y="' + (-rr * Math.cos(a) + 3.5) + '" class="ra-lbl">' + nm.slice(0, 2) + "</text>";
      });
      return s3 + "</svg>";
    }
    /* Orientations: a tile with an F on it, turned and mirrored. */
    return '<div class="ra-tiles">' + names.map(function (nm) {
      var t = v[nm];
      return '<div class="ra-tile" style="border-color:' + COLOURS[nm] + '"><span style="transform: rotate(' + (t[0] * 90) + "deg) scaleX(" + (t[1] ? -1 : 1) + ");color:" + COLOURS[nm] + '">F</span><small>' + nm + "</small></div>";
    }).join("") + "</div>";
  }

  Harness.start({
    id: "relations",
    name: "Relation Algebra",
    version: "1.0.0",
    what: "Nested relations in space, numbers, notes, days, headings and orientations",
    unit: "level",
    level: { start: 1, min: 1, max: 20 },

    instructions:
      "<p>Each trial describes some objects (Red, Blue, Green…) by how they relate: places on a grid, numbers, notes, days of the week, headings, or a tile’s orientation. Combine the relations to answer.</p>"
      + "<p><b>Nested places.</b> “The place two steps north of the place east of Red” is a position built from Red. A premise between two such places says something about the objects underneath: work out what.</p>"
      + "<p><b>Marks</b> say the same thing in steps: “Let P be the place north of Red. Gold is east of P.”</p>"
      + "<p><b>Perspective.</b> “Standing at Blue and facing west, Red is two steps ahead”: turn the description into compass directions first.</p>"
      + "<p><b>Tasks.</b> <i>Questions</i>: Yes, No, or Can’t tell when nothing links the two objects. <i>Possible?</i>: do all the premises fit together? <i>How far</i>: count the steps. <i>N-back</i>: is this the same arrangement as the one n descriptions back (same relations, possibly worded quite differently)?</p>"
      + "<p><b>Traps.</b> Wrong answers on offer are the answers of particular mistakes: ignoring the nesting, a sign the wrong way, steps in the wrong order, a mirror image. After a mistake the trainer shows which one.</p>"
      + "<p>Keys: <b>F</b> yes / match / possible, <b>J</b> no / different / impossible, <b>K</b> can’t tell, <b>1–4</b> for distances, <b>Space</b> to go on.</p>",

    settings: [
      { key: "task", label: "Task", type: "select", default: "question", options: [
        { value: "question", label: "Questions (yes / no / can't tell)" }, { value: "possible", label: "Possible or impossible?" },
        { value: "howfar", label: "How far? (space and numbers)" }, { value: "nback", label: "Structure n-back" },
        { value: "mixed", label: "Mixed (questions, possible, how far)" }] },
      { key: "material", label: "Material", type: "select", default: "space", options: [
        { value: "space", label: "Space (grid)" }, { value: "numbers", label: "Numbers" }, { value: "notes", label: "Notes (wrap at the octave)" },
        { value: "days", label: "Days (wrap at the week)" }, { value: "compass", label: "Headings (compass)" },
        { value: "square", label: "Orientations (turn and mirror; order matters)" }, { value: "rotate", label: "A different one each session" }] },
      { key: "phrasing", label: "Nested places", type: "select", default: "mixed", options: [
        { value: "inline", label: "Inline (the place … of the place …)" }, { value: "marks", label: "Marks (Let P be …)" }, { value: "mixed", label: "Both, mixed" }] },
      { key: "perspective", label: "Perspective premises (space)", type: "boolean", default: true },
      { key: "matchRule", label: "N-back: what counts as the same", type: "select", default: "exact", options: [
        { value: "exact", label: "Exactly the same (north stays north)" }, { value: "rotation", label: "The same up to rotation (space)" }] },
      { key: "metric", label: "How far: steps", type: "select", default: "manhattan", options: [
        { value: "manhattan", label: "Along the grid (no diagonals)" }, { value: "king", label: "King's moves (diagonal is one)" }] },
      { key: "trials", label: "Trials per session", type: "number", min: 6, max: 80, step: 2, default: 16 },
      { key: "timeLimit", label: "Time per trial", type: "select", default: 0, options: [
        { value: 0, label: "No limit" }, { value: 120, label: "2 minutes" }, { value: 60, label: "1 minute" }, { value: 30, label: "30 s" }, { value: 15, label: "15 s" }] },
      { key: "explain", label: "Explain the answer", type: "select", default: "errors", options: [
        { value: "errors", label: "After mistakes" }, { value: "always", label: "Always" }, { value: "never", label: "Never" }] },
      { key: "aloud", label: "Read aloud (the device's voice)", type: "boolean", default: false },
      { key: "hideText", label: "Hide the premises while reading aloud", type: "boolean", default: false },
    ],

    buttons: [],

    async session(s) {
      var set = s.settings;
      var material = set.material;
      if (material === "rotate") {
        var k = 0;
        try { k = parseInt(localStorage.getItem(ROTATION_KEY), 10) || 0; localStorage.setItem(ROTATION_KEY, String(k + 1)); } catch (e) {}
        material = G_ORDER[k % G_ORDER.length];
      }
      var G = A.GROUPS[material];
      var task = set.task;
      if (task === "howfar" && !G.metric) task = "question";
      var o = A.difficulty(s.level, task);
      if (!set.perspective) o.perspectiveShare = 0;
      var limit = set.timeLimit ? set.timeLimit * 1000 : null;
      var lureStats = {};

      function present(lines, question, onShow) {
        var html = '<div class="ra-card"><div class="ra-premises">' + lines.map(function (l) { return "<p>" + paint(l) + "</p>"; }).join("") + "</div>"
          + (question ? '<p class="ra-q">' + paint(question) + "</p>" : "") + "</div>";
        if (set.aloud && speech) {
          s.show(set.hideText ? '<div class="ra-card"><p class="ra-listen">Listening…</p></div>' : html);
          return speak(lines.concat(question ? [question] : [])).then(function () {
            if (set.hideText) s.show('<div class="ra-card">' + (question ? '<p class="ra-q">' + paint(question) + "</p>" : '<p class="ra-listen">Answer now.</p>') + "</div>");
          });
        }
        s.show(html);
        return Promise.resolve();
      }

      async function explain(ok, parts) {
        var show = set.explain === "always" || (set.explain === "errors" && !ok);
        if (!show) { await s.wait(ok ? 500 : 900); return; }
        s.buttons([{ id: "next", label: "Go on", key: " " }]);
        s.show('<div class="ra-card ra-explain"><p class="ra-verdict ' + (ok ? "ok" : "bad") + '">' + (ok ? "Right." : "Not quite.") + "</p>" + parts + "</div>");
        await s.respond({ accept: ["next"] });
      }
      function decode(premises, lines) {
        return '<details class="ra-decode"><summary>What each premise says</summary><ul>' + premises.map(function (p) {
          return "<li>" + paint(A.meaning(G, p.X, p.v, p.Y)) + (p.kind === "nested" ? ' <span class="ra-tag">nested</span>' : p.kind === "perspective" ? ' <span class="ra-tag">perspective</span>' : "") + "</li>";
        }).join("") + "</ul></details>";
      }

      /* ---- structure n-back: a round built up front ---- */
      if (task === "nback") {
        var n = o.n, round = A.nbackRound(G, A.Rng(), o, n, set.trials + n, set.matchRule === "rotation" && G.name === "space");
        for (var i = 0; i < round.items.length; i++) {
          var it = round.items[i], lines = A.render(G, o, it.premises, set.phrasing, A.Rng());
          var scored = i >= n;
          s.buttons(scored ? [{ id: "match", label: "Same as " + n + " back", key: "f" }, { id: "diff", label: "Different", key: "j" }]
                           : [{ id: "next", label: "Got it (" + (i + 1) + " of " + n + ")", key: " " }]);
          await present(lines, scored ? "Same arrangement as " + n + " back?" : "Build this arrangement; it comes up " + n + " back.");
          var r = await s.respond({ timeoutMs: scored ? limit : null });
          if (!scored) continue;
          var said = r ? r.id : null, ok = said === (it.target ? "match" : "diff");
          if (!it.target) { lureStats[it.kind] = lureStats[it.kind] || { shown: 0, caught: 0 }; lureStats[it.kind].shown++; if (said === "diff") lureStats[it.kind].caught++; }
          s.log({ target: it.target, response: said === "match" ? "match" : null, correct: ok, rtMs: r ? r.rtMs : null,
            extra: { task: task, material: G.name, kind: it.target ? "match" : it.kind, said: said, n: n } });
          s.feedback(ok);
          await explain(ok, "<p>" + (it.target ? "It was the same arrangement as " + n + " back" + (round.upToRotation ? " (perhaps turned)" : "") + ", described differently."
            : "It was different: " + esc(it.kind === "swap" ? "two objects had swapped places" : it.kind === "step" ? "one object had moved one step" : it.kind === "plain" ? "a new arrangement" : (LURE_TEXT[it.kind] || it.kind).replace("the true answer", "the arrangement " + n + " back")) + ".")
            + '</p><div class="ra-pair"><div><small>' + n + " back</small>" + drawing(G, round.items[i - n].world) + "</div><div><small>This one</small>" + drawing(G, it.world) + "</div></div>");
        }
        return { mode: "nback " + G.name, modalities: ["visual"].concat(set.aloud ? ["audio"] : []), extra: { material: G.name, task: task, n: n, lures: lureStats } };
      }

      /* ---- one-off trials ---- */
      var kinds = task === "mixed" ? ["question", "possible"].concat(G.metric ? ["howfar"] : []) : [task];
      for (var t = 0; t < set.trials; t++) {
        var kind = kinds[t % kinds.length], rng = A.Rng();
        var trial = kind === "question" ? A.questionTrial(G, rng, o) : kind === "possible" ? A.possibleTrial(G, rng, o) : A.howfarTrial(G, rng, o, set.metric);
        if (!trial) continue;
        var plines = A.render(G, o, trial.premises, set.phrasing, rng);
        var buttons, question;
        if (kind === "question") {
          buttons = [{ id: "yes", label: "Yes", key: "f" }, { id: "no", label: "No", key: "j" }, { id: "cant", label: "Can't tell", key: "k" }];
          question = trial.question;
        } else if (kind === "possible") {
          buttons = [{ id: "possible", label: "Possible", key: "f" }, { id: "impossible", label: "Impossible", key: "j" }];
          question = "Can all of this be true at once?";
        } else {
          buttons = trial.options.map(function (v, j) { return { id: v, label: v, key: String(j + 1) }; });
          question = trial.question;
        }
        s.buttons(buttons);
        await present(plines, question);
        var resp = await s.respond({ timeoutMs: limit });
        var given = resp ? resp.id : null, right = given === trial.answer;
        var signal = kind === "question" ? "yes" : kind === "possible" ? "possible" : null;
        if (trial.lure) { lureStats[trial.lure] = lureStats[trial.lure] || { shown: 0, caught: 0 }; lureStats[trial.lure].shown++; if (right) lureStats[trial.lure].caught++; }
        s.log({
          target: signal ? trial.answer === signal : undefined,
          response: signal ? (given === signal ? signal : null) : given,
          correct: right, rtMs: resp ? resp.rtMs : null,
          extra: { task: kind, material: G.name, answer: trial.answer, said: given, lure: trial.lure || null,
            path: trial.pathLength || null, premises: trial.premises.length, nested: trial.premises.filter(function (p) { return p.kind === "nested"; }).length },
        });
        s.feedback(right);

        var why = "";
        if (kind === "question") {
          why += "<p>The answer is <b>" + (trial.answer === "cant" ? "Can't tell" : trial.answer === "yes" ? "Yes" : "No") + "</b>.</p>";
          if (trial.answer === "cant") why += "<p>Nothing links " + paint(trial.X) + "’s group to " + paint(trial.Y) + "’s: the premise that would have was left out.</p>";
          else why += "<p>In fact, " + paint(A.meaning(G, trial.X, trial.truth, trial.Y)) + ".</p>";
          if (trial.lure) why += "<p>The relation asked about is " + esc(LURE_TEXT[trial.lure] || trial.lure) + ".</p>";
        } else if (kind === "possible") {
          why += "<p>It is <b>" + trial.answer + "</b>.</p>";
          if (trial.answer === "impossible") why += "<p>One premise contradicts the rest: going round the loop it’s on doesn’t bring you back to where you started.</p>";
        } else {
          why += "<p>" + paint(A.meaning(G, trial.X, trial.truth, trial.Y)) + ": <b>" + trial.answer + "</b>.</p>";
        }
        await explain(right, why + decode(trial.premises) + (kind !== "possible" || trial.answer === "possible" ? drawing(G, trial.world) : ""));
      }
      return { mode: task + " " + G.name, modalities: ["visual"].concat(set.aloud ? ["audio"] : []), extra: { material: G.name, task: task, lures: lureStats } };
    },
  });
})();

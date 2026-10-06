"use strict";
/*
 * Listening Integration: relational integration by ear, with no input.
 *
 * Each sound is a spoken number at a place (left to right) and a pitch. From
 * the (n+2)th sound on, the listener compares two relations: the one between
 * the previous sound and the sound n+1 back (the "earlier pair") and the one
 * between the current sound and the sound n back (the "later pair"), each in
 * a chosen quality (number, place or pitch). Same relation: a match. The two
 * pairs can be in different qualities ("did the place move as far as the
 * number stepped?"), which is relational integration across dimensions.
 *
 * There is no input, so there is no scoring and nothing to adapt to: the
 * listener sets the difficulty. Each trial is "think, then hear": a silence
 * to decide, then a tone with the answer.
 *
 * The whole round is rendered ahead of time (OfflineAudioContext) into one
 * WAV and played by an <audio> element, which phones keep playing with the
 * screen locked. That is deliberate, and an agreed exception to the hub's rule
 * that a trainer stops when its page is hidden: this one stops when the hub
 * says the player has left ("chimera:leave", posted by shell/js/shell.js),
 * when the page is closed, or at "End round". Training time is the time the
 * audio actually played.
 *
 * The voices are Dark's recordings for Relational Integration Training, the
 * numbers 1 to 19 copied into audio/ by tools/voices.mjs
 * (window.RIT_AUDIO[voice][number - 1]).
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var APP = "listening";
  var RECORD_KEY = "chimera.listening.record.v1";
  var SETTINGS_KEY = "chimera.listening.settings.v1";
  var SAMPLE_RATE = 22050;
  var FIELDS = ["n", "trials", "dimB", "dimA", "rel", "range", "gap", "window", "places", "pitches", "semis", "voice"];
  var DIM_LABEL = { number: "number", space: "place", pitch: "pitch" };
  var REL = {
    step: { label: "Step", of: function (a, b) { return a - b; } },
    distance: { label: "Distance", of: function (a, b) { return Math.abs(a - b); } },
    sum: { label: "Sum", of: function (a, b) { return a + b; } }
  };

  /* ---- settings ---- */

  function readForm() {
    var s = {};
    FIELDS.forEach(function (f) { s[f] = $(f).value; });
    return {
      n: +s.n, trials: +s.trials, dimA: s.dimA, dimB: s.dimB, rel: s.rel,
      max: +s.range, gap: +s.gap, answer: s.window === "off" ? null : +s.window,
      places: +s.places, pitches: +s.pitches, semis: +s.semis, voice: s.voice
    };
  }
  function loadForm() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch (e) {}
    if (!saved) return;
    FIELDS.forEach(function (f) {
      if (saved[f] != null && [].some.call($(f).options, function (o) { return o.value === String(saved[f]); })) $(f).value = String(saved[f]);
    });
  }
  function saveForm() {
    var s = {};
    FIELDS.forEach(function (f) { s[f] = $(f).value; });
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  }
  /* Sum only makes sense between numbers; the note says what a choice means. */
  function checkForm() {
    var c = readForm();
    var sumOk = c.dimA === "number" && c.dimB === "number";
    $("rel").querySelector('option[value="sum"]').disabled = !sumOk;
    if (!sumOk && c.rel === "sum") $("rel").value = "step";
    c = readForm();
    var note = c.dimA === c.dimB
      ? "Same quality in both pairs: does the " + DIM_LABEL[c.dimA] + " relation repeat?"
      : "Across qualities: does the later pair's " + DIM_LABEL[c.dimA] + " relation equal the earlier pair's " + DIM_LABEL[c.dimB] + " relation?";
    if (c.dimA !== c.dimB && (c.dimA === "number" || c.dimB === "number") && c.max > 5) {
      note += " Places and pitches only run " + (Math.max(c.places, c.pitches) - 1) + " steps, so numbers 1 to 5 suit this best.";
    }
    $("note").textContent = note;
    saveForm();
  }

  /* ---- the round ---- */

  function values(dim, c) {
    var out = [], k;
    if (dim === "number") { for (k = 1; k <= c.max; k++) out.push(k); return out; }
    var half = ((dim === "space" ? c.places : c.pitches) - 1) / 2;
    for (k = -half; k <= half; k++) out.push(k);
    return out;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /*
   * As in Relational Integration's Integration program: 40% matches, 35% lures
   * (near miss, wrong partner, and for Step at depth 2+ wrong direction), 25%
   * plain non-matches; a shortfall is made up later; values that keep the next
   * match possible are preferred. A quality never repeats its value in the
   * same slot twice running, so no relation is ever zero.
   */
  function buildRound(c) {
    var rel = REL[c.rel].of, n = c.n;
    var V = { number: values("number", c), space: values("space", c), pitch: values("pitch", c) };
    var dims = ["number", "space", "pitch"];
    var seq = [], types = [];
    var made = { match: 0, lure: 0 };
    var owed = function (rate, have, done) { return Math.min(0.95, Math.max(0.05, rate + (rate * (done + 1) - have) * 0.5)); };
    var fresh = function (dim, i) {
      var back = i >= n ? seq[i - n][dim] : null;
      var opts = V[dim].filter(function (v) { return v !== back; });
      return pick(opts.length ? opts : V[dim]);
    };
    for (var i = 0; i < n + 1 + c.trials; i++) {
      var s = {};
      if (i <= n) {
        dims.forEach(function (d) { s[d] = fresh(d, i); });
        seq.push(s); types.push(null); continue;
      }
      var done = i - n - 1;
      var nBack = seq[i - n][c.dimA];
      var target = rel(seq[i - 1][c.dimB], seq[i - n - 1][c.dimB]);
      var allowed = V[c.dimA].filter(function (v) { return v !== nBack; });
      var matches = allowed.filter(function (v) { return rel(v, nBack) === target; });
      var others = allowed.filter(function (v) { return rel(v, nBack) !== target; });
      var partners = [i - n - 1].concat(n >= 2 ? [i - n + 1] : []);
      var lures = {
        near: others.filter(function (v) { return Math.abs(rel(v, nBack) - target) === 1; }),
        partner: others.filter(function (v) { return partners.some(function (j) { return rel(v, seq[j][c.dimA]) === target; }); }),
        direction: c.rel === "step" && n >= 2 ? others.filter(function (v) { return rel(v, nBack) === -target; }) : []
      };
      var kinds = Object.keys(lures).filter(function (k) { return lures[k].length; });
      var pM = owed(0.4, made.match, done), pL = owed(0.35, made.lure, done);
      var roll = Math.random(), pool;
      if (roll < pM && matches.length) pool = matches;
      else if (roll < pM + pL && kinds.length) pool = lures[pick(kinds)];
      else {
        var plain = others.filter(function (v) { return !kinds.some(function (k) { return lures[k].indexOf(v) >= 0; }); });
        pool = plain.length ? plain : others.length ? others : allowed;
      }
      /* The other qualities are drawn fresh; the earlier-pair quality, when it
         differs, is chosen to keep the next trial's match possible. */
      dims.forEach(function (d) { if (d !== c.dimA) s[d] = fresh(d, i); });
      var open = function (v) {
        var probe = {}; for (var d in s) probe[d] = s[d]; probe[c.dimA] = v;
        var nextBack = n === 1 ? v : seq[i + 1 - n][c.dimA];
        var nextTarget = rel(probe[c.dimB], seq[i - n][c.dimB]);
        return V[c.dimA].some(function (x) { return x !== nextBack && rel(x, nextBack) === nextTarget; });
      };
      var openPool = pool.filter(open);
      s[c.dimA] = pick(openPool.length ? openPool : pool);
      var type = rel(s[c.dimA], nBack) === target ? "match"
        : kinds.filter(function (k) { return lures[k].indexOf(s[c.dimA]) >= 0; })[0] || "plain";
      if (type === "match") made.match++; else if (type !== "plain") made.lure++;
      seq.push(s); types.push(type);
    }
    return { seq: seq, types: types };
  }

  /* ---- audio ---- */

  function b64ToBuffer(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function decodeClips(ctx, voices, max) {
    var jobs = [], clips = {};
    voices.forEach(function (v) {
      clips[v] = [];
      for (var k = 1; k <= max; k++) (function (v, k) {
        jobs.push(ctx.decodeAudioData(b64ToBuffer(window.RIT_AUDIO[v][k - 1])).then(function (b) { clips[v][k] = b; }));
      })(v, k);
    });
    return Promise.all(jobs).then(function () { return clips; });
  }
  function tone(ctx, freq, at, dur, gain) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.01);
    g.gain.setValueAtTime(gain, at + dur - 0.03);
    g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(at); o.stop(at + dur + 0.01);
  }
  function render(c, round) {
    var lead = 1.6;                               /* three soft ticks to begin */
    var length = lead + round.seq.length * c.gap + 1.5;
    var ctx = new OfflineAudioContext(2, Math.ceil(length * SAMPLE_RATE), SAMPLE_RATE);
    var voices = c.voice === "alt" ? ["en", "en_bryce"] : [c.voice];
    var placeHalf = (c.places - 1) / 2;
    return decodeClips(ctx, voices, c.max).then(function (clips) {
      [0, 0.45, 0.9].forEach(function (t) { tone(ctx, 440, t, 0.06, 0.12); });
      var onsets = [];
      round.seq.forEach(function (s, i) {
        var at = lead + i * c.gap;
        onsets.push(Math.round(at * 1000));
        var src = ctx.createBufferSource();
        src.buffer = clips[voices[i % voices.length]][s.number];
        src.playbackRate.value = Math.pow(2, s.pitch * c.semis / 12);
        var pan = ctx.createStereoPanner();
        pan.pan.value = placeHalf ? s.space / placeHalf : 0;
        src.connect(pan); pan.connect(ctx.destination);
        src.start(at);
        var type = round.types[i];
        if (type && c.answer != null) {
          var t = at + c.answer;
          if (type === "match") { tone(ctx, 660, t, 0.09, 0.16); tone(ctx, 880, t + 0.11, 0.12, 0.16); }
          else tone(ctx, 247, t, 0.16, 0.12);
        }
      });
      return ctx.startRendering().then(function (buf) { return { buffer: buf, onsets: onsets, lead: lead }; });
    });
  }
  function toWav(buf) {
    var ch = buf.numberOfChannels, len = buf.length, rate = buf.sampleRate;
    var data = new DataView(new ArrayBuffer(44 + len * ch * 2));
    var str = function (o, s) { for (var i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); data.setUint32(4, 36 + len * ch * 2, true); str(8, "WAVE");
    str(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
    str(36, "data"); data.setUint32(40, len * ch * 2, true);
    var chans = []; for (var k = 0; k < ch; k++) chans.push(buf.getChannelData(k));
    var off = 44;
    for (var i = 0; i < len; i++) for (k = 0; k < ch; k++) {
      var v = Math.max(-1, Math.min(1, chans[k][i]));
      data.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true); off += 2;
    }
    return new Blob([data], { type: "audio/wav" });
  }

  /* ---- playing, and the record ---- */

  var audio = $("audio");
  var state = null;   /* { c, round, onsets, lead, start, played, saved, url } */

  function describe(c) {
    var relLabel = REL[c.rel].label.toLowerCase();
    return c.n + "-back · " + (c.dimA === c.dimB
      ? DIM_LABEL[c.dimA] + " " + relLabel
      : DIM_LABEL[c.dimB] + " " + relLabel + " (earlier pair) against " + DIM_LABEL[c.dimA] + " " + relLabel + " (later pair)");
  }
  function trialAt(t) {
    if (!state) return 0;
    var i = Math.floor((t - state.lead) / state.c.gap);
    return Math.max(0, Math.min(state.round.seq.length, i + 1) - state.c.n - 1);
  }
  function progress() {
    if (!state) return;
    state.played = Math.max(state.played, audio.currentTime || 0);
    var total = audio.duration || 1;
    $("fill").style.width = Math.min(100, (audio.currentTime / total) * 100) + "%";
    var k = trialAt(audio.currentTime);
    $("status").textContent = audio.ended ? "Round finished." : (k > 0 ? "Trial " + k + " of " + state.c.trials : "Listen to the first " + (state.c.n + 1) + " sounds.");
  }

  function save(completed) {
    if (!state || state.saved) return;
    progress();
    var played = Math.round(state.played);
    if (played < 5) return;
    state.saved = true;
    var c = state.c, round = state.round;
    var heardUntil = state.played * 1000;
    var log = [], counts = {};
    round.seq.forEach(function (s, i) {
      var type = round.types[i];
      if (!type || state.onsets[i] > heardUntil) return;
      counts[type] = (counts[type] || 0) + 1;
      log.push({ i: i, t: state.onsets[i], stimulus: { number: s.number, place: s.space, pitch: s.pitch },
        target: type === "match", response: null, correct: null, extra: { type: type } });
    });
    var session = {
      id: state.start + "-" + Math.random().toString(36).slice(2, 6),
      start: state.start,
      end: Date.now(),
      activeSeconds: played,
      completed: completed,
      mode: c.dimA === c.dimB ? c.dimA + " " + c.rel : c.dimB + "/" + c.dimA + " " + c.rel,
      modalities: ["audio"],
      level: c.n,
      levelEnd: c.n,
      trials: log.length,
      input: null,
      settings: { gapMs: c.gap * 1000, answerToneMs: c.answer == null ? null : c.answer * 1000, numbers: [1, c.max],
        places: c.places, pitchSteps: c.pitches, semitonesPerStep: c.semis, voice: c.voice,
        earlierPair: c.dimB, laterPair: c.dimA, relation: c.rel },
      extra: { types: counts, note: "no responses: the listener answers silently and hears the answer tone" },
      trialLog: log
    };
    var rec = null;
    try { rec = JSON.parse(localStorage.getItem(RECORD_KEY)); } catch (e) {}
    if (!rec || rec.format !== "chimera-record" || !Array.isArray(rec.sessions)) {
      rec = { format: "chimera-record", version: 1, app: APP, units: { level: "n" }, sessions: [] };
    }
    rec.appVersion = "1.0.0";
    rec.sessions.push(session);
    try { localStorage.setItem(RECORD_KEY, JSON.stringify(rec)); } catch (e) { console.warn("Could not save the session:", e); }
  }

  function setToggle() {
    $("toggle").textContent = audio.paused ? (audio.currentTime > 0 && !audio.ended ? "Resume" : "Play") : "Pause";
  }
  function stopRound(completed) {
    audio.pause();
    save(completed && audio.ended);
    if (state && state.url) URL.revokeObjectURL(state.url);
    state = null;
    audio.removeAttribute("src");
    $("player").hidden = true;
    $("setup").hidden = false;
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  }

  $("start").addEventListener("click", function () {
    var c = readForm();
    if (!window.RIT_AUDIO || !window.RIT_AUDIO.en) { $("note").textContent = "The voices didn\u2019t load (audio/)."; return; }
    var round = buildRound(c);
    $("setup").hidden = true;
    $("player").hidden = false;
    $("round-desc").textContent = describe(c);
    $("status").textContent = "Preparing the round…";
    $("toggle").disabled = true;
    $("fill").style.width = "0";
    render(c, round).then(function (r) {
      var url = URL.createObjectURL(toWav(r.buffer));
      state = { c: c, round: round, onsets: r.onsets, lead: r.lead, start: Date.now(), played: 0, saved: false, url: url };
      audio.src = url;
      $("toggle").disabled = false;
      $("status").textContent = "Ready: " + Math.round(r.buffer.duration / 60 * 10) / 10 + " min. Put your headphones on.";
      setToggle();
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: "Listening Integration", artist: describe(c), album: "Chimera Hub" });
        navigator.mediaSession.setActionHandler("play", function () { audio.play(); });
        navigator.mediaSession.setActionHandler("pause", function () { audio.pause(); });
      }
    }).catch(function (e) {
      console.error(e);
      $("status").textContent = "This browser couldn't prepare the audio.";
    });
  });
  $("toggle").addEventListener("click", function () {
    if (!state) return;
    if (audio.paused) {
      if (audio.ended || state.saved) {     /* the same round again is a new session */
        audio.currentTime = 0;
        state.saved = false;
        state.played = 0;
      }
      if (!state.played) state.start = Date.now();
      audio.play();
    } else audio.pause();
  });
  $("stop").addEventListener("click", function () { stopRound(false); });
  audio.addEventListener("play", setToggle);
  audio.addEventListener("pause", setToggle);
  audio.addEventListener("timeupdate", progress);
  audio.addEventListener("ended", function () { progress(); save(true); setToggle(); });

  /* The exception to the hub's pause rule: a locked screen keeps playing; the
     hub's "leave" (the player went back to the menu) and closing the page stop. */
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "chimera:leave" && state) stopRound(false);
  });
  window.addEventListener("pagehide", function () { if (state) stopRound(false); });

  FIELDS.forEach(function (f) { $(f).addEventListener("change", checkForm); });
  loadForm();
  checkForm();
})();

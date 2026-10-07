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
  var FIELDS = ["session", "n", "trials", "dimB", "dimA", "rel", "range", "gap", "window", "places", "pitches", "semis", "voice"];
  var DIM_LABEL = { number: "number", space: "place", pitch: "pitch", any: "any quality" };
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
      session: +s.session || 0, n: +s.n, trials: +s.trials, dimA: s.dimA, dimB: s.dimB, rel: s.rel,
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
    var note = c.dimA === "any" && c.dimB === "any"
      ? "Any quality: does the number, place or pitch relation repeat? Watch all three at once."
      : c.dimA === "any" ? "Any quality in the later pair: does its number, place or pitch relation equal the earlier pair's " + DIM_LABEL[c.dimB] + " relation?"
      : c.dimB === "any" ? "Any quality in the earlier pair: does the later pair's " + DIM_LABEL[c.dimA] + " relation equal its number, place or pitch relation?"
      : c.dimA === c.dimB
      ? "Same quality in both pairs: does the " + DIM_LABEL[c.dimA] + " relation repeat?"
      : "Across qualities: does the later pair's " + DIM_LABEL[c.dimA] + " relation equal the earlier pair's " + DIM_LABEL[c.dimB] + " relation?";
    var crosses = pairings(c).some(function (p) { return p.A !== p.B && (p.A === "number" || p.B === "number"); });
    if (crosses && c.max > 5) {
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
   * Which comparisons count. Each is [earlier-pair quality, later-pair
   * quality]. "Any" on one side compares the other side's quality with each
   * of the three; "Any" on both compares each quality with itself, so a match
   * is any quality whose relation repeats.
   */
  var DIMS = ["number", "space", "pitch"];
  function pairings(c) {
    if (c.dimA === "any" && c.dimB === "any") return DIMS.map(function (q) { return { B: q, A: q }; });
    if (c.dimB === "any") return DIMS.map(function (q) { return { B: q, A: c.dimA }; });
    if (c.dimA === "any") return DIMS.map(function (q) { return { B: c.dimB, A: q }; });
    return [{ B: c.dimB, A: c.dimA }];
  }

  /*
   * As in Relational Integration's Integration program: 40% matches, 35% lures
   * (near miss, wrong partner, and for Step at depth 2+ wrong direction), 25%
   * plain non-matches; a shortfall is made up later; values that keep the next
   * match possible are preferred. A quality never repeats its value in the
   * same slot twice running, so no relation is ever zero.
   *
   * With "Any", a trial is a match when any of its comparisons matches, so a
   * lure or a plain non-match has to miss in every one of them: each trial is
   * built for its type and redrawn until nothing else matches by accident.
   */
  function buildRound(c) {
    var rel = REL[c.rel].of, n = c.n, P = pairings(c);
    var V = { number: values("number", c), space: values("space", c), pitch: values("pitch", c) };
    var seq = [], types = [], which = [];
    var made = { match: 0, lure: 0 };
    var owed = function (rate, have, done) { return Math.min(0.95, Math.max(0.05, rate + (rate * (done + 1) - have) * 0.5)); };
    var fresh = function (dim, i) {
      var back = i >= n ? seq[i - n][dim] : null;
      var opts = V[dim].filter(function (v) { return v !== back; });
      return pick(opts.length ? opts : V[dim]);
    };
    var freshAll = function (i) { var s = {}; DIMS.forEach(function (d) { s[d] = fresh(d, i); }); return s; };
    for (var i = 0; i < n + 1 + c.trials; i++) {
      if (i <= n) { seq.push(freshAll(i)); types.push(null); which.push(null); continue; }
      var done = i - n - 1;
      var partners = [i - n - 1].concat(n >= 2 ? [i - n + 1] : []);
      /* Each comparison's target, and the later-pair values that would match it or lure. */
      var cmp = P.map(function (p) {
        var nBack = seq[i - n][p.A], target = rel(seq[i - 1][p.B], seq[i - n - 1][p.B]);
        var allowed = V[p.A].filter(function (v) { return v !== nBack; });
        var others = allowed.filter(function (v) { return rel(v, nBack) !== target; });
        return {
          p: p, nBack: nBack, target: target,
          matches: allowed.filter(function (v) { return rel(v, nBack) === target; }),
          lures: {
            near: others.filter(function (v) { return Math.abs(rel(v, nBack) - target) === 1; }),
            partner: others.filter(function (v) { return partners.some(function (j) { return rel(v, seq[j][p.A]) === target; }); }),
            direction: c.rel === "step" && n >= 2 ? others.filter(function (v) { return rel(v, nBack) === -target; }) : []
          }
        };
      });
      var classify = function (s) {
        for (var k = 0; k < cmp.length; k++) if (rel(s[cmp[k].p.A], cmp[k].nBack) === cmp[k].target) return { type: "match", at: k };
        for (k = 0; k < cmp.length; k++) for (var kind in cmp[k].lures) if (cmp[k].lures[kind].indexOf(s[cmp[k].p.A]) >= 0) return { type: kind, at: k };
        return { type: "plain", at: -1 };
      };
      /* After this sound, can the next trial still match? */
      var open = function (s) {
        return P.some(function (p) {
          var nextBack = n === 1 ? s[p.A] : seq[i + 1 - n][p.A];
          var nextTarget = rel(s[p.B], seq[i - n][p.B]);
          return V[p.A].some(function (x) { return x !== nextBack && rel(x, nextBack) === nextTarget; });
        });
      };
      var pM = owed(0.4, made.match, done), pL = owed(0.35, made.lure, done);
      var roll = Math.random();
      var want = roll < pM ? "match" : roll < pM + pL ? "lure" : "plain";
      var best = null, bestScore = -1;
      for (var tries = 0; tries < 80 && bestScore < 3; tries++) {
        var s = freshAll(i);
        if (want === "match") {
          var canMatch = cmp.filter(function (x) { return x.matches.length; });
          if (canMatch.length) { var m = pick(canMatch); s[m.p.A] = pick(m.matches); }
        } else if (want === "lure") {
          var lureOpts = [];
          cmp.forEach(function (x) { for (var kind in x.lures) if (x.lures[kind].length) lureOpts.push(x.lures[kind].map(function (v) { return [x.p.A, v]; })); });
          if (lureOpts.length) { var l = pick(pick(lureOpts)); s[l[0]] = l[1]; }
        }
        var cl = classify(s);
        var ok = want === "match" ? cl.type === "match" : want === "lure" ? cl.type !== "match" && cl.type !== "plain" : cl.type === "plain";
        var score = (ok ? 2 : cl.type !== "match" || want === "match" ? 1 : 0) + (open(s) ? 1 : 0);
        if (score > bestScore) { best = { s: s, cl: cl }; bestScore = score; }
      }
      var type = best.cl.type;
      if (type === "match") made.match++; else if (type !== "plain") made.lure++;
      /* The quality the "Any" side was judged in, when it was. */
      var at = best.cl.at >= 0 ? cmp[best.cl.at].p : null;
      seq.push(best.s); types.push(type);
      which.push(at && P.length > 1 ? (c.dimA === "any" ? at.A : at.B) : null);
    }
    return { seq: seq, types: types, which: which };
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
  function tone(ctx, freq, at, dur, gain, pan) {
    var o = ctx.createOscillator(), g = ctx.createGain(), out = ctx.destination;
    if (pan) { var sp = ctx.createStereoPanner(); sp.pan.value = pan; sp.connect(out); out = sp; }
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.01);
    g.gain.setValueAtTime(gain, at + dur - 0.03);
    g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(g); g.connect(out);
    o.start(at); o.stop(at + dur + 0.01);
  }
  /* For the tests: the generator, without the page. */
  window.ListeningRound = { build: buildRound, pairings: pairings };

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
          /* A match is two rising notes. With "Any" they also say which
             quality matched: in the middle for number, from left to right for
             place, an octave higher for pitch. */
          var w = round.which[i];
          if (type === "match") {
            var up = w === "pitch" ? 2 : 1, l = w === "space" ? -0.8 : 0, r = w === "space" ? 0.8 : 0;
            tone(ctx, 660 * up, t, 0.09, 0.16, l); tone(ctx, 880 * up, t + 0.11, 0.12, 0.16, r);
          }
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

  /*
   * A session is one round, or rounds back to back until the session length
   * is used up. Each round is its own sound file (two hours in one file would
   * be over 600 MB): the next is prepared while the current one plays, and
   * swapped in when it ends, so the screen can stay locked throughout. The
   * last round is shortened to end on time. The whole session is one entry in
   * the record.
   */
  var audio = $("audio");
  var state = null;   /* { c, start, cur, next, done, offset, saved } */
  var MIN_TRIALS = 5;

  function describe(c) {
    var relLabel = REL[c.rel].label.toLowerCase();
    return c.n + "-back · " + (c.dimA === "any" && c.dimB === "any" ? "any quality " + relLabel : c.dimA === c.dimB
      ? DIM_LABEL[c.dimA] + " " + relLabel
      : DIM_LABEL[c.dimB] + " " + relLabel + " (earlier pair) against " + DIM_LABEL[c.dimA] + " " + relLabel + " (later pair)");
  }
  function roundSeconds(c, trials) { return 1.6 + (c.n + 1 + trials) * c.gap + 1.5; }
  /* How many trials the next round gets in `left` seconds; 0 when too few. */
  function trialsFor(c, left) {
    if (!c.session) return c.trials;
    var fit = Math.floor((left - 3.1) / c.gap) - c.n - 1;
    var t = Math.min(c.trials, fit);
    return t >= MIN_TRIALS ? t : 0;
  }
  function prepare(c, trials) {
    var cc = {}; for (var k in c) cc[k] = c[k];
    cc.trials = trials;
    var round = buildRound(cc);
    return render(cc, round).then(function (r) {
      return { c: cc, round: round, onsets: r.onsets, lead: r.lead, duration: r.buffer.duration, played: 0,
        url: URL.createObjectURL(toWav(r.buffer)) };
    });
  }
  /* Start preparing the round after the current one, if the session has room. */
  function queueNext() {
    var c = state.c;
    if (!c.session) { state.next = null; return; }
    var t = trialsFor(c, c.session * 60 - state.offset - state.cur.duration);
    state.next = t ? prepare(c, t) : null;
    if (state.next) state.next.catch(function (e) { console.error(e); });
  }
  function elapsed() { return state ? state.offset + state.cur.played : 0; }
  function clock(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ":" + ("0" + sec % 60).slice(-2); }

  function trialAt(cur, t) {
    var i = Math.floor((t - cur.lead) / cur.c.gap);
    return Math.max(0, Math.min(cur.round.seq.length, i + 1) - cur.c.n - 1);
  }
  function progress() {
    if (!state || !state.cur) return;
    var cur = state.cur, c = state.c;
    cur.played = Math.max(cur.played, audio.currentTime || 0);
    var finished = audio.ended && !state.next;
    if (c.session) $("fill").style.width = Math.min(100, elapsed() / (c.session * 60) * 100) + "%";
    else $("fill").style.width = Math.min(100, (audio.currentTime / (audio.duration || 1)) * 100) + "%";
    var k = trialAt(cur, audio.currentTime);
    var where = k > 0 ? "Trial " + k + " of " + cur.c.trials : "Listen to the first " + (c.n + 1) + " sounds.";
    $("status").textContent = finished ? (c.session ? "Session finished: " + (state.done.length) + " rounds." : "Round finished.")
      : c.session ? "Round " + (state.done.length + 1) + " · " + where + " · " + clock(c.session * 60 - elapsed()) + " left" : where;
  }

  function save(completed) {
    if (!state || state.saved || !state.cur) return;
    progress();
    var rounds = state.done.indexOf(state.cur) >= 0 ? state.done : state.done.concat([state.cur]);
    var played = Math.round(rounds.reduce(function (a, r) { return a + r.played; }, 0));
    if (played < 5) return;
    state.saved = true;
    var c = state.c, log = [], counts = {}, offset = 0, summary = [];
    rounds.forEach(function (cur, k) {
      var heardUntil = cur.played * 1000, n = 0;
      cur.round.seq.forEach(function (s, i) {
        var type = cur.round.types[i];
        if (!type || cur.onsets[i] > heardUntil) return;
        counts[type] = (counts[type] || 0) + 1; n++;
        var extra = { type: type };
        if (cur.round.which[i]) extra.quality = cur.round.which[i];
        if (c.session) extra.round = k + 1;
        log.push({ i: log.length, t: Math.round(offset * 1000) + cur.onsets[i], stimulus: { number: s.number, place: s.space, pitch: s.pitch },
          target: type === "match", response: null, correct: null, extra: extra });
      });
      summary.push({ trials: n, seconds: Math.round(cur.played) });
      offset += cur.duration;
    });
    var extra = { types: counts, note: "no responses: the listener answers silently and hears the answer tone" };
    if (c.session) { extra.sessionMinutes = c.session; extra.rounds = summary; }
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
        earlierPair: c.dimB, laterPair: c.dimA, relation: c.rel, trialsPerRound: c.trials, sessionMinutes: c.session || null },
      extra: extra,
      trialLog: log
    };
    var rec = null;
    try { rec = JSON.parse(localStorage.getItem(RECORD_KEY)); } catch (e) {}
    if (!rec || rec.format !== "chimera-record" || !Array.isArray(rec.sessions)) {
      rec = { format: "chimera-record", version: 1, app: APP, units: { level: "n" }, sessions: [] };
    }
    rec.appVersion = "1.1.0";
    rec.sessions.push(session);
    try { localStorage.setItem(RECORD_KEY, JSON.stringify(rec)); } catch (e) { console.warn("Could not save the session:", e); }
  }

  function setToggle() {
    $("toggle").textContent = audio.paused ? (audio.currentTime > 0 && !audio.ended ? "Resume" : "Play") : "Pause";
  }
  function release() {
    if (!state) return;
    if (state.cur) URL.revokeObjectURL(state.cur.url);
    if (state.next) state.next.then(function (nx) { URL.revokeObjectURL(nx.url); }, function () {});
  }
  function stopRound(completed) {
    audio.pause();
    save(completed && audio.ended);
    release();
    state = null;
    audio.removeAttribute("src");
    $("player").hidden = true;
    $("setup").hidden = false;
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  }

  function begin() {
    var c = readForm();
    if (!window.RIT_AUDIO || !window.RIT_AUDIO.en) { $("note").textContent = "The voices didn’t load (audio/)."; return; }
    var first = trialsFor(c, c.session * 60);
    if (!first) { $("note").textContent = "The session is too short for a round at this pace."; return; }
    $("setup").hidden = true;
    $("player").hidden = false;
    $("round-desc").textContent = describe(c) + (c.session ? " · " + c.session + " min" : "");
    $("stop").textContent = c.session ? "End session" : "End round";
    $("status").textContent = "Preparing the round…";
    $("toggle").disabled = true;
    $("fill").style.width = "0";
    prepare(c, first).then(function (cur) {
      state = { c: c, start: Date.now(), cur: cur, next: null, done: [], offset: 0, saved: false };
      audio.src = cur.url;
      queueNext();
      $("toggle").disabled = false;
      $("status").textContent = "Ready: " + (c.session ? c.session + " min, in rounds of " + Math.round(cur.duration / 60 * 10) / 10 + " min."
        : Math.round(cur.duration / 60 * 10) / 10 + " min.") + " Put your headphones on.";
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
  }
  /* A round ended: on to the next one if the session has one, else done. */
  function onEnded() {
    progress();
    if (!state) return;
    state.cur.played = state.cur.duration;
    if (state.done.indexOf(state.cur) < 0) state.done.push(state.cur);
    if (!state.next) { save(true); setToggle(); progress(); return; }
    var was = state, prev = state.cur;
    state.next.then(function (nx) {
      if (state !== was) { URL.revokeObjectURL(nx.url); return; }
      state.offset += prev.duration;
      state.cur = nx;
      audio.src = nx.url;
      audio.play();
      URL.revokeObjectURL(prev.url);
      queueNext();
    }, function () { save(true); setToggle(); });
  }

  $("start").addEventListener("click", begin);
  $("toggle").addEventListener("click", function () {
    if (!state) return;
    if (audio.paused) {
      if (state.saved) {
        /* After the end, Play starts again: the same round, or a new session. */
        if (state.c.session) { release(); state = null; begin(); return; }
        audio.currentTime = 0;
        state.saved = false;
        state.cur.played = 0;
        state.done = [];
        state.start = Date.now();
      }
      audio.play();
    } else audio.pause();
  });
  $("stop").addEventListener("click", function () { stopRound(false); });
  audio.addEventListener("play", setToggle);
  audio.addEventListener("pause", setToggle);
  audio.addEventListener("timeupdate", progress);
  audio.addEventListener("ended", onEnded);

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

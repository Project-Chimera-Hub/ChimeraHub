/*
 * Earshot: audio engine.
 *
 * Nothing is loaded from disk or the network: every sound is synthesized
 * when the engine starts, so the app runs from a file:// address.
 *
 * Each sound source gets its own HRTF PannerNode. The precomputed trajectory
 * is applied to the panner's position with setValueCurveAtTime, and the short
 * clicks are scheduled against the audio clock with a small look-ahead timer.
 *
 * Keeping the task about location rather than sound quality:
 *  - all sources use the same click recipe; every click is a fresh noise token
 *  - sources take turns in a freshly shuffled order each round, so no source
 *    owns a rhythm, and clicks never overlap
 *  - each token carries a small random level change (±1.5 dB)
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});
  const U = ES.U;

  const SOUNDS = {
    tick: { label: 'Noise ticks', note: 'Broadband clicks. The easiest sound to locate.' },
    knock: { label: 'Wood knocks', note: 'Softer and woody. Still easy to locate.' },
    pluck: { label: 'Plucked string', note: 'Tonal, which makes it harder to locate.' },
  };
  const AMBIENCE_WET = [0, 0.12, 0.26];

  /* ---------- offline synthesis ---------- */

  function noise(len) {
    const d = new Float32Array(len);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return d;
  }

  function lowpass(d, sr, fc) {
    const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
    let y = 0;
    for (let i = 0; i < d.length; i++) {
      y += a * (d[i] - y);
      d[i] = y;
    }
  }

  function highpass(d, sr, fc) {
    const rc = 1 / (2 * Math.PI * fc);
    const a = rc / (rc + 1 / sr);
    let y = 0;
    let xPrev = 0;
    for (let i = 0; i < d.length; i++) {
      const x = d[i];
      y = a * (y + x - xPrev);
      xPrev = x;
      d[i] = y;
    }
  }

  function bandpass(d, sr, f0, q) {
    const w0 = (2 * Math.PI * f0) / sr;
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w0)) / a0;
    const a2 = (1 - alpha) / a0;
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < d.length; i++) {
      const x = d[i];
      const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      d[i] = y;
    }
  }

  function fadeOut(d, sr, ms) {
    const n = Math.min(d.length, Math.max(1, Math.floor((ms / 1000) * sr)));
    for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n;
  }

  function fadeIn(d, sr, ms) {
    const n = Math.min(d.length, Math.max(1, Math.floor((ms / 1000) * sr)));
    for (let i = 0; i < n; i++) d[i] *= i / n;
  }

  /** Scale so the token carries the energy of a 20 ms burst at the given RMS. */
  function normalizeEnergy(d, sr, rms) {
    let e = 0;
    for (let i = 0; i < d.length; i++) e += d[i] * d[i];
    if (e <= 0) return;
    const g = Math.sqrt((rms * rms * 0.02 * sr) / e);
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }

  function normalizePeak(d, peak) {
    let m = 0;
    for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
    if (m <= 0) return;
    const g = peak / m;
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }

  function genTick(sr) {
    const len = Math.ceil(U.rand(0.024, 0.03) * sr);
    const d = noise(len);
    lowpass(d, sr, 9500);
    highpass(d, sr, 180);
    const att = Math.max(1, Math.floor(0.0015 * sr));
    const tau = 0.007 * sr;
    for (let i = 0; i < len; i++) d[i] *= i < att ? i / att : Math.exp(-(i - att) / tau);
    fadeOut(d, sr, 3);
    return d;
  }

  function genKnock(sr) {
    const len = Math.ceil(0.07 * sr);
    const body = noise(len);
    const bright = noise(len);
    const air = noise(len);
    bandpass(body, sr, 1650 * U.rand(0.97, 1.03), 7);
    bandpass(bright, sr, 3900 * U.rand(0.97, 1.03), 8);
    lowpass(air, sr, 8000);
    const d = new Float32Array(len);
    const tau = 0.011 * sr;
    const tauAir = 0.003 * sr;
    for (let i = 0; i < len; i++) {
      d[i] = (body[i] * 3.2 + bright[i] * 1.6) * Math.exp(-i / tau) + air[i] * 0.35 * Math.exp(-i / tauAir);
    }
    fadeIn(d, sr, 0.6);
    fadeOut(d, sr, 6);
    return d;
  }

  function genPluck(sr) {
    // Karplus–Strong string with a short noise transient for the attack.
    const f0 = 523.25 * Math.pow(2, U.rand(-0.08, 0.08) / 12);
    const len = Math.ceil(0.18 * sr);
    const period = Math.max(2, Math.round(sr / f0));
    const line = noise(period);
    const d = new Float32Array(len);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % period;
      d[i] = line[idx];
      line[idx] = 0.5 * (line[idx] + line[next]) * 0.996;
      idx = next;
    }
    const clickLen = Math.floor(0.003 * sr);
    for (let i = 0; i < clickLen; i++) d[i] += (Math.random() * 2 - 1) * 0.6 * (1 - i / clickLen);
    const tau = 0.06 * sr;
    for (let i = 0; i < len; i++) d[i] *= Math.exp(-i / tau);
    highpass(d, sr, 120);
    fadeIn(d, sr, 0.5);
    fadeOut(d, sr, 12);
    return d;
  }

  function genBell(sr) {
    const len = Math.ceil(0.45 * sr);
    const d = new Float32Array(len);
    const f = 1046.5;
    const partials = [
      [1.0, 1.0, 0.32],
      [2.0, 0.42, 0.2],
      [2.76, 0.5, 0.15],
      [5.4, 0.28, 0.08],
      [8.93, 0.16, 0.05],
    ];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let s = 0;
      for (let p = 0; p < partials.length; p++) {
        s += partials[p][1] * Math.sin(2 * Math.PI * f * partials[p][0] * t) * Math.exp(-t / partials[p][2]);
      }
      d[i] = s;
    }
    // A broadband strike at the start makes the bell easy to locate.
    const clickLen = Math.floor(0.004 * sr);
    const click = noise(clickLen);
    lowpass(click, sr, 11000);
    for (let i = 0; i < clickLen; i++) d[i] += click[i] * 0.9 * (1 - i / clickLen);
    fadeIn(d, sr, 0.8);
    fadeOut(d, sr, 25);
    return d;
  }

  /** Simple sine earcons: notes play one after another, optionally gliding. */
  function genTones(sr, notes) {
    const total = notes.reduce((s, n) => s + n.dur + (n.gap || 0), 0);
    const d = new Float32Array(Math.ceil(total * sr) + 1);
    let offset = 0;
    for (const n of notes) {
      const nLen = Math.floor(n.dur * sr);
      const att = Math.floor(0.004 * sr);
      let phase = 0;
      for (let i = 0; i < nLen; i++) {
        const t = i / nLen;
        const f = n.f2 ? n.f * Math.pow(n.f2 / n.f, t) : n.f;
        phase += (2 * Math.PI * f) / sr;
        const env = (i < att ? i / att : 1) * Math.pow(1 - t, 1.6);
        d[offset + i] += (Math.sin(phase) + 0.18 * Math.sin(2 * phase)) * env;
      }
      offset += nLen + Math.floor((n.gap || 0) * sr);
    }
    return d;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* ---------- engine ---------- */

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.banks = {};
      this.earcons = {};
      this.volume = 0.8;
      this.ambience = 1;
      this.trial = null;
      this.pulseLog = [];
      this.supportsParamPosition = false;
    }

    get supported() {
      return !!(root.AudioContext || root.webkitAudioContext);
    }

    /** Create or resume the context. Call from a click or key handler. */
    async unlock() {
      if (!this.ctx) this._create();
      if (this.ctx.state !== 'running') {
        try {
          await this.ctx.resume();
        } catch (e) {
          /* the caller reports the problem */
        }
      }
      return this.ctx.state === 'running';
    }

    _create() {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) throw new Error('This browser can’t play spatial audio. Use a current version of Chrome, Edge, Firefox or Safari.');
      let ctx;
      try {
        ctx = new AC({ latencyHint: 'interactive' });
      } catch (e) {
        ctx = new AC();
      }
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3;
      this.limiter.knee.value = 2;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.15;
      this.master.connect(this.limiter);
      this.limiter.connect(ctx.destination);

      this.spatialBus = ctx.createGain();
      this.spatialBus.connect(this.master);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._impulse(1.3, 2.8);
      this.wet = ctx.createGain();
      this.wet.gain.value = 0;
      this.spatialBus.connect(this.reverb);
      this.reverb.connect(this.wet);
      this.wet.connect(this.master);

      this.uiBus = ctx.createGain();
      this.uiBus.gain.value = 0.5;
      this.uiBus.connect(this.master);

      // Chrome loads its HRTF data when the first HRTF panner is created and outputs
      // silence until it is ready, so warm it up now rather than on the first trial.
      this._warm = this._makePanner(2);
      this._mute = ctx.createGain();
      this._mute.gain.value = 0;
      this._warm.connect(this._mute);
      this._mute.connect(ctx.destination);

      const probe = ctx.createPanner();
      this.supportsParamPosition = !!(probe.positionX && typeof probe.positionX.setValueCurveAtTime === 'function');

      this._buildSounds();
      this.setVolume(this.volume);
      this.setAmbience(this.ambience);
    }

    _impulse(seconds, decay) {
      const ctx = this.ctx;
      const sr = ctx.sampleRate;
      const len = Math.floor(seconds * sr);
      const pre = Math.floor(0.012 * sr);
      const buf = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = pre; i < len; i++) {
          const t = (i - pre) / (len - pre);
          const a = 0.9 - 0.75 * t; // the tail gets darker as it decays
          lp += a * (Math.random() * 2 - 1 - lp);
          d[i] = lp * Math.pow(1 - t, decay);
        }
      }
      return buf;
    }

    _buildSounds() {
      const ctx = this.ctx;
      const sr = ctx.sampleRate;
      const toBuffer = (data) => {
        const b = ctx.createBuffer(1, data.length, sr);
        b.getChannelData(0).set(data);
        return b;
      };
      const bank = (gen, count, rms, roveDb) =>
        U.range(count).map(() => {
          const d = gen(sr);
          normalizeEnergy(d, sr, rms);
          if (roveDb) {
            const g = U.dbToGain(U.rand(-roveDb, roveDb));
            for (let i = 0; i < d.length; i++) d[i] *= g;
          }
          return toBuffer(d);
        });
      this.banks.tick = bank(genTick, 24, 0.15, 1.5);
      this.banks.knock = bank(genKnock, 24, 0.15, 1.5);
      this.banks.pluck = bank(genPluck, 16, 0.13, 1.5);
      this.banks.bell = bank(genBell, 4, 0.2, 0);

      const earcon = (notes, peak) => {
        const d = genTones(sr, notes);
        normalizePeak(d, peak || 0.55);
        return toBuffer(d);
      };
      this.earcons.stop = earcon([{ f: 740, f2: 494, dur: 0.2 }]);
      this.earcons.success = earcon([{ f: 784, dur: 0.1, gap: 0.02 }, { f: 1175, dur: 0.22 }]);
      this.earcons.fail = earcon([{ f: 440, f2: 311, dur: 0.3 }], 0.45);
      this.earcons.select = earcon([{ f: 1320, dur: 0.05 }], 0.4);
      this.earcons.deselect = earcon([{ f: 880, dur: 0.05 }], 0.4);
      this.earcons.deny = earcon([{ f: 220, dur: 0.09 }], 0.5);
    }

    setVolume(v) {
      this.volume = U.clamp(Number(v), 0, 1);
      if (this.master) this.master.gain.setTargetAtTime(this.volume * 0.9, this.ctx.currentTime, 0.02);
    }

    setAmbience(level) {
      this.ambience = U.clamp(Math.round(Number(level)) || 0, 0, 2);
      if (this.wet) this.wet.gain.setTargetAtTime(AMBIENCE_WET[this.ambience], this.ctx.currentTime, 0.05);
    }

    /** Seconds between scheduling a sound and hearing it (for syncing visuals). */
    outputDelay() {
      const c = this.ctx;
      return c ? (c.outputLatency || 0) + (c.baseLatency || 0) : 0;
    }

    _makePanner(refDistance) {
      const p = this.ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = refDistance || 2;
      p.maxDistance = 100;
      p.rolloffFactor = 1;
      p.coneInnerAngle = 360;
      p.coneOuterAngle = 360;
      p.coneOuterGain = 1;
      return p;
    }

    _setPosition(p, pos, t) {
      if (p.positionX) {
        p.positionX.setValueAtTime(pos.x, t);
        p.positionY.setValueAtTime(pos.y, t);
        p.positionZ.setValueAtTime(pos.z, t);
      } else {
        p.setPosition(pos.x, pos.y, pos.z);
      }
    }

    /**
     * Start a trial.
     * plan.events: [{ t, src, kind }] with t in seconds from the trial start;
     * kind is 'pulse', 'bell' or 'ui:<earcon>'.
     */
    startTrial(plan) {
      this.releaseTrial();
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const t0 = now + 0.06;
      const bus = ctx.createGain();
      bus.gain.value = plan.busGain || 1;
      bus.connect(this.spatialBus);

      const traj = plan.traj;
      const panners = U.range(traj.n).map((i) => {
        const p = this._makePanner(plan.refDistance);
        this._setPosition(p, traj.initial[i], now);
        p.connect(bus);
        return p;
      });

      const tMove = t0 + plan.tMove;
      let automated = this.supportsParamPosition;
      if (automated) {
        try {
          for (let i = 0; i < traj.n; i++) {
            panners[i].positionX.setValueCurveAtTime(traj.xs[i], tMove, traj.duration);
            panners[i].positionY.setValueCurveAtTime(traj.ys[i], tMove, traj.duration);
            panners[i].positionZ.setValueCurveAtTime(traj.zs[i], tMove, traj.duration);
          }
        } catch (e) {
          automated = false;
          this.supportsParamPosition = false;
          panners.forEach((p) => ['positionX', 'positionY', 'positionZ'].forEach((k) => p[k].cancelScheduledValues(0)));
        }
      }

      const trial = { plan, t0, bus, panners, idx: 0, sources: new Set(), timer: 0, raf: 0 };
      this.trial = trial;
      this.pulseLog = U.range(traj.n).map(() => []);
      if (!automated) this._followManually(trial);
      this._pump();
      trial.timer = setInterval(() => this._pump(), 25);
      return { t0, tMove, tEnd: t0 + plan.tEnd };
    }

    /** Fallback for browsers without automatable panner positions. */
    _followManually(trial) {
      const step = () => {
        if (this.trial !== trial) return;
        const t = this.ctx.currentTime - (trial.t0 + trial.plan.tMove);
        trial.panners.forEach((pn, i) => {
          const p = ES.Motion.positionAt(trial.plan.traj, i, t);
          if (pn.setPosition) pn.setPosition(p.x, p.y, p.z);
          else {
            pn.positionX.value = p.x;
            pn.positionY.value = p.y;
            pn.positionZ.value = p.z;
          }
        });
        trial.raf = root.requestAnimationFrame(step);
      };
      trial.raf = root.requestAnimationFrame(step);
    }

    _pump() {
      const trial = this.trial;
      if (!trial) return;
      const ctx = this.ctx;
      const horizon = ctx.currentTime + 0.3;
      const ev = trial.plan.events;
      while (trial.idx < ev.length) {
        const e = ev[trial.idx];
        const when = trial.t0 + e.t;
        if (when > horizon) break;
        trial.idx++;
        if (when < ctx.currentTime - 0.03) continue; // missed while the page was busy
        this._emit(trial, e, when);
      }
      if (trial.idx >= ev.length && trial.timer) {
        clearInterval(trial.timer);
        trial.timer = 0;
      }
    }

    _emit(trial, e, when) {
      const ctx = this.ctx;
      let buffer = null;
      let dest = null;
      if (e.kind === 'pulse' || e.kind === 'bell') {
        const bank = e.kind === 'bell' ? this.banks.bell : this.banks[trial.plan.soundType] || this.banks.tick;
        buffer = pick(bank);
        dest = trial.panners[e.src];
        const log = this.pulseLog[e.src];
        if (log) {
          log.push(when);
          if (log.length > 6) log.shift();
        }
      } else if (e.kind.indexOf('ui:') === 0) {
        buffer = this.earcons[e.kind.slice(3)];
        dest = this.uiBus;
      }
      if (!buffer || !dest) return;
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.connect(dest);
      s.start(Math.max(when, ctx.currentTime));
      trial.sources.add(s);
      s.onended = () => {
        trial.sources.delete(s);
        try {
          s.disconnect();
        } catch (err) {
          /* already disconnected */
        }
      };
    }

    /** 0–1 brightness for a visual flash when source src was just heard. */
    flashLevel(src, now) {
      const log = this.pulseLog[src];
      if (!log) return 0;
      let level = 0;
      for (let i = 0; i < log.length; i++) {
        const dt = now - log[i];
        if (dt >= 0 && dt < 0.14) level = Math.max(level, 1 - dt / 0.14);
      }
      return level;
    }

    /** Replay a source where it currently is (used while choosing). */
    audition(src, opts) {
      const trial = this.trial;
      if (!trial || !trial.panners[src]) return;
      const o = Object.assign({ count: 2, gap: 0.12, delay: 0, kind: 'pulse' }, opts);
      const t = this.ctx.currentTime + 0.02 + o.delay;
      for (let k = 0; k < o.count; k++) this._emit(trial, { kind: o.kind, src }, t + k * o.gap);
    }

    bellAt(src, delay) {
      this.audition(src, { kind: 'bell', count: 1, delay: delay || 0 });
    }

    playEarcon(name, delay) {
      if (!this.ctx || !this.earcons[name]) return;
      const s = this.ctx.createBufferSource();
      s.buffer = this.earcons[name];
      s.connect(this.uiBus);
      s.start(this.ctx.currentTime + (delay || 0));
      s.onended = () => {
        try {
          s.disconnect();
        } catch (e) {
          /* already disconnected */
        }
      };
    }

    /** Stop the current trial's sounds and free its nodes. */
    releaseTrial() {
      const trial = this.trial;
      if (!trial) return;
      this.trial = null;
      if (trial.timer) clearInterval(trial.timer);
      if (trial.raf) root.cancelAnimationFrame(trial.raf);
      const now = this.ctx.currentTime;
      trial.sources.forEach((s) => {
        try {
          s.stop();
        } catch (e) {
          /* not started */
        }
      });
      try {
        trial.bus.gain.cancelScheduledValues(now);
        trial.bus.gain.setValueAtTime(trial.bus.gain.value, now);
        trial.bus.gain.linearRampToValueAtTime(0, now + 0.04);
      } catch (e) {
        /* ignore */
      }
      setTimeout(() => {
        try {
          trial.bus.disconnect();
        } catch (e) {
          /* ignore */
        }
        trial.panners.forEach((p) => {
          try {
            p.disconnect();
          } catch (e) {
            /* ignore */
          }
        });
      }, 150);
    }

    /** One-off burst from a fixed direction (headphone check). */
    playAt(pos, opts) {
      if (!this.ctx) return null;
      const o = Object.assign({ count: 5, gap: 0.14, soundType: 'tick' }, opts);
      const ctx = this.ctx;
      const p = this._makePanner(2);
      this._setPosition(p, pos, ctx.currentTime);
      p.connect(this.spatialBus);
      const t0 = ctx.currentTime + 0.05;
      const bank = this.banks[o.soundType] || this.banks.tick;
      for (let k = 0; k < o.count; k++) {
        const s = ctx.createBufferSource();
        s.buffer = pick(bank);
        s.connect(p);
        s.start(t0 + k * o.gap);
      }
      setTimeout(() => {
        try {
          p.disconnect();
        } catch (e) {
          /* ignore */
        }
      }, (o.count * o.gap + 1.2) * 1000);
      return { t0, t1: t0 + o.count * o.gap };
    }

    /** A single sound circling the listener once, for the home screen demo. */
    demoOrbit(seconds, soundType) {
      if (!this.ctx) return null;
      const ctx = this.ctx;
      const p = this._makePanner(2);
      p.connect(this.spatialBus);
      const now = ctx.currentTime;
      const t0 = now + 0.08;
      const count = Math.round(seconds * 100) + 1;
      const xs = new Float32Array(count);
      const ys = new Float32Array(count);
      const zs = new Float32Array(count);
      for (let k = 0; k < count; k++) {
        const a = (k / (count - 1)) * U.TAU;
        xs[k] = 2 * Math.sin(a);
        zs[k] = -2 * Math.cos(a);
      }
      this._setPosition(p, { x: 0, y: 0, z: -2 }, now);
      let raf = 0;
      if (this.supportsParamPosition) {
        p.positionX.setValueCurveAtTime(xs, t0, seconds);
        p.positionY.setValueCurveAtTime(ys, t0, seconds);
        p.positionZ.setValueCurveAtTime(zs, t0, seconds);
      } else {
        const step = () => {
          const f = U.clamp((ctx.currentTime - t0) / seconds, 0, 1) * U.TAU;
          p.setPosition(2 * Math.sin(f), 0, -2 * Math.cos(f));
          if (ctx.currentTime < t0 + seconds) raf = root.requestAnimationFrame(step);
        };
        raf = root.requestAnimationFrame(step);
      }
      const bank = this.banks[soundType] || this.banks.tick;
      for (let t = 0; t < seconds; t += 0.11) {
        const s = ctx.createBufferSource();
        s.buffer = pick(bank);
        s.connect(p);
        s.start(t0 + t + U.rand(0, 0.02));
      }
      setTimeout(() => {
        if (raf) root.cancelAnimationFrame(raf);
        try {
          p.disconnect();
        } catch (e) {
          /* ignore */
        }
      }, (seconds + 1) * 1000);
      return { t0, seconds };
    }
  }

  ES.SOUNDS = SOUNDS;
  ES.AudioEngine = AudioEngine;
})(typeof window !== 'undefined' ? window : globalThis);

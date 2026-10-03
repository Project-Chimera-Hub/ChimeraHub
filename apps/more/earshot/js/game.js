/*
 * Earshot: sessions and trials.
 *
 * Trial timeline (seconds from the trial start)
 *   listen    every sound clicks from its starting point
 *   targets   a bell rings from each target; the other sounds are silent
 *   remember  every sound clicks again, identical, still
 *   track     the sounds move and bounce
 *   choose    motion stops, a stop tone plays, the player picks the targets
 *   result    feedback, bells from the true targets, speed steps up or down
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});
  const U = ES.U;

  const TIMING = {
    lead: 0.25,
    voiceLead: 1.1,
    presentation: 1.4,
    afterPresentation: 0.35,
    cueGap: 0.32,
    afterCue: 0.3,
    hold: 1.0,
    stopDelay: 0.12,
    responseDelay: 0.3,
  };
  // Shortened timings for automated testing (index.html?fast).
  const FAST = { presentation: 0.4, afterPresentation: 0.1, cueGap: 0.14, afterCue: 0.1, hold: 0.3, maxTrack: 1.2 };

  const PHASES = {
    listen: { name: 'Listen', hint: () => 'These are all the sounds.' },
    cue: { name: 'Targets', hint: (t) => (t === 1 ? 'The bell marks your target.' : `The bells mark your ${t} targets.`) },
    hold: { name: 'Remember them', hint: () => 'From here on every sound is identical.' },
    track: { name: 'Track', hint: (t) => (t === 1 ? 'Follow the target as it moves.' : 'Follow the targets as they move.') },
    respond: { name: 'Choose', hint: () => (isTouch() ? 'Tap a dot or a number to hear where that sound stopped.' : 'Hover a dot or use the arrow keys to hear where each sound stopped.') },
    result: { name: 'Result', hint: () => (isTouch() ? 'Tap a dot or a number to hear it again.' : 'Hover a dot or use the arrow keys to hear it again.') },
  };

  const STEP_ORDER = ['listen', 'cue', 'hold', 'track', 'respond'];

  function isTouch() {
    return !!(root.matchMedia && root.matchMedia('(hover: none)').matches);
  }

  /**
   * Clicks from every source in shuffled rounds: each source clicks once per
   * round, in a new random order, so no source keeps a rhythm of its own.
   */
  function pulseTrain(sources, t0, t1, slot) {
    const events = [];
    const n = sources.length;
    let roundStart = t0;
    let last = -1;
    while (roundStart < t1) {
      const order = U.shuffle(sources.slice());
      if (n > 1 && order[0] === last) {
        const j = 1 + Math.floor(Math.random() * (n - 1));
        const tmp = order[0];
        order[0] = order[j];
        order[j] = tmp;
      }
      for (let k = 0; k < n; k++) {
        const t = roundStart + (k + 0.5) * slot + U.rand(-0.12, 0.12) * slot;
        if (t >= t1) return events;
        events.push({ t, src: order[k], kind: 'pulse' });
        last = order[k];
      }
      roundStart += n * slot;
    }
    return events;
  }

  function buildPlan(cfg, speed, fast) {
    const tm = fast ? Object.assign({}, TIMING, FAST) : TIMING;
    const duration = fast ? Math.min(cfg.duration, FAST.maxTrack) : cfg.duration;
    const traj = ES.Motion.simulate({ mode: cfg.mode, n: cfg.n, speed, duration, frontOnly: cfg.frontOnly });
    const all = U.range(cfg.n);
    const targets = U.sample(all, cfg.t).sort((a, b) => a - b);
    // About 8 clicks per source per second, but never closer than 26 ms overall.
    const slot = Math.max(0.026, 1 / (cfg.n * 8));

    const T = {};
    T.presStart = cfg.voice ? tm.voiceLead : tm.lead;
    T.cueStart = T.presStart + tm.presentation + tm.afterPresentation;
    const rounds = cfg.t >= 3 ? 2 : 3;
    const cue = [];
    let ct = T.cueStart;
    for (let r = 0; r < rounds; r++) {
      for (const src of U.shuffle(targets.slice())) {
        cue.push({ t: ct, src, kind: 'bell' });
        ct += tm.cueGap;
      }
    }
    T.holdStart = ct + tm.afterCue;
    T.moveStart = T.holdStart + tm.hold;
    T.moveEnd = T.moveStart + duration;
    T.respond = T.moveEnd + tm.responseDelay;

    const events = pulseTrain(all, T.presStart, T.presStart + tm.presentation, slot)
      .concat(cue, pulseTrain(all, T.holdStart, T.moveEnd, slot), [{ t: T.moveEnd + tm.stopDelay, src: -1, kind: 'ui:stop' }])
      .sort((a, b) => a.t - b.t);

    const disc = cfg.mode === 'disc';
    return {
      traj,
      targets,
      events,
      timeline: T,
      tMove: T.moveStart,
      tEnd: T.moveEnd,
      soundType: cfg.sound,
      refDistance: disc ? ES.Motion.ARENAS.disc.rMin : ES.Motion.ARENAS.ring.radius,
      busGain: disc ? 1.6 : 1,
      speed,
    };
  }

  class Game {
    constructor(app) {
      this.app = app;
      const $ = (id) => document.getElementById(id);
      this.el = {
        screen: $('screen-game'),
        heading: $('game-heading'),
        trial: $('ro-trial'),
        speed: $('ro-speed'),
        targets: $('ro-targets'),
        correct: $('ro-correct'),
        pause: $('btn-pause'),
        phaseName: $('phase-name'),
        phaseHint: $('phase-hint'),
        practiceTools: $('practice-tools'),
        prShow: $('pr-show'),
        prTargets: $('pr-targets'),
        respond: $('respond'),
        respondHead: $('respond-head'),
        respondTitle: $('respond-title'),
        respondHint: $('respond-hint'),
        list: $('sound-list'),
        respondActions: $('respond-actions'),
        replay: $('btn-replay'),
        confirm: $('btn-confirm'),
        result: $('result'),
        resultTitle: $('result-title'),
        resultDetail: $('result-detail'),
        next: $('btn-next'),
        overlay: $('pause-overlay'),
        pauseNote: $('pause-note'),
        resume: $('btn-resume'),
        end: $('btn-end'),
        steps: $('phase-steps'),
        keys: $('key-help'),
      };

      this.field = new ES.PolarField($('game-field'));
      this.field.onFrame = () => this._frame();
      this.field.onHover = (src) => this._hover(src);
      this.field.onPick = (src, pointerType) => {
        if (pointerType !== 'mouse') this._audition(src, true);
        if (this.state === 'respond') this._toggle(src);
        this._focusButton(src, false);
      };

      this.state = 'idle';
      this.timers = [];
      this.rollTimers = [];
      this.plan = null;
      this.order = null;
      this.selected = new Set();
      this.labelOf = new Map();
      this.focusSrc = -1;
      this.hoverSrc = -1;

      this.el.pause.addEventListener('click', () => this.pause());
      this.el.resume.addEventListener('click', () => this.resume());
      this.el.end.addEventListener('click', () => this.end());
      this.el.confirm.addEventListener('click', () => this._confirm());
      this.el.replay.addEventListener('click', () => this._rollCall());
      this.el.next.addEventListener('click', () => {
        if (this.state === 'result') this._nextTrial();
      });
    }

    get active() {
      return this.state !== 'idle';
    }

    async start(cfg, opts) {
      const eng = this.app.engine;
      let ok = false;
      try {
        ok = await eng.unlock();
      } catch (e) {
        this.app.toast(e.message);
        return;
      }
      if (!ok) {
        this.app.toast('The browser blocked sound. Click anywhere on the page, then press Start again.');
        return;
      }
      this.app.hideToast();
      this.cfg = ES.Settings.normalize(cfg);
      this.practice = !!(opts && opts.practice);
      eng.setVolume(this.cfg.volume);
      eng.setAmbience(this.cfg.ambience);
      this.startedAt = Date.now();
      this.trials = [];
      this.trialIndex = 0;
      this.correctCount = 0;
      this.stairs = new ES.Staircase({ start: this.app.history.startSpeed(this.cfg) });

      this.el.heading.textContent = this.practice ? 'Practice' : 'Session';
      this.el.practiceTools.hidden = !this.practice;
      this.el.end.textContent = this.practice ? 'End practice' : 'End session';
      this.el.overlay.hidden = true;
      this.field.setArena(this.cfg.mode, this.cfg.frontOnly);
      this.field.interactive = true;
      this.app.show('game');
      this.field.refresh();
      this.field.start();
      this.state = 'starting';
      this._nextTrial();
    }

    /* ---------- trial flow ---------- */

    _nextTrial() {
      if (this.state === 'paused' || this.state === 'idle') return;
      this._clearTimers();
      if (!this.practice && this.trialIndex >= this.cfg.trials) {
        this._finish(false);
        return;
      }
      const eng = this.app.engine;
      eng.releaseTrial();
      if (this.el.screen.contains(document.activeElement)) document.activeElement.blur();

      this.plan = buildPlan(this.cfg, this.stairs.speed, ES.dev && ES.dev.fast);
      this.order = null;
      this.selected = new Set();
      this.labelOf = new Map();
      this.focusSrc = -1;
      this.hoverSrc = -1;
      this.field.dots = [];
      this.field.focusId = -1;
      this.field.hoverId = -1;
      this.field.progress = null;
      this.el.respond.hidden = true;
      this.el.result.hidden = true;
      this.el.list.textContent = '';

      this.state = 'running';
      this.phase = null;
      this._readouts();
      this.times = eng.startTrial(this.plan);
      if (this.cfg.voice) this.app.say(`Trial ${this.trialIndex + 1}`);
      this._setPhase('listen');
    }

    _frame() {
      const eng = this.app.engine;
      if (!this.plan || !eng.ctx) return;
      const T = this.plan.timeline;
      const rel = eng.ctx.currentTime - this.times.t0;
      if (this.state === 'running') {
        const phase = rel < T.cueStart ? 'listen' : rel < T.holdStart ? 'cue' : rel < T.moveStart ? 'hold' : 'track';
        if (phase !== this.phase) this._setPhase(phase);
        this.field.progress = rel >= T.moveStart ? U.clamp((rel - T.moveStart) / this.plan.traj.duration, 0, 1) : null;
        if (rel >= T.respond) {
          this._beginResponse();
          return;
        }
        if (this.practice && this.el.prShow.checked) this._practiceDots(rel - eng.outputDelay());
        else this.field.dots = [];
      } else if (this.state === 'respond' || this.state === 'result') {
        const now = eng.ctx.currentTime - eng.outputDelay();
        for (const d of this.field.dots) d.flash = eng.flashLevel(d.id, now);
      }
    }

    _practiceDots(heard) {
      const eng = this.app.engine;
      const T = this.plan.timeline;
      const traj = this.plan.traj;
      const targets = new Set(this.plan.targets);
      const inCue = heard >= T.cueStart - 0.05 && heard < T.holdStart;
      const keep = this.el.prTargets.checked && heard >= T.cueStart;
      const now = eng.ctx.currentTime - eng.outputDelay();
      this.field.dots = U.range(traj.n).map((i) => ({
        id: i,
        pos: ES.Motion.positionAt(traj, i, heard - T.moveStart),
        label: '',
        state: targets.has(i) && (inCue || keep) ? 'cue' : 'idle',
        flash: eng.flashLevel(i, now),
      }));
    }

    _setPhase(phase) {
      this.phase = phase;
      const p = PHASES[phase];
      this.el.phaseName.textContent = p.name;
      this.el.phaseHint.textContent = p.hint(this.cfg.t);
      this.el.screen.dataset.phase = phase;
      const running = STEP_ORDER.indexOf(phase) > -1 && phase !== 'respond';
      const at = STEP_ORDER.indexOf(phase);
      this.el.steps.hidden = !running;
      this.el.keys.hidden = running;
      U.$$('li', this.el.steps).forEach((li, i) => {
        li.classList.toggle('is-current', i === at);
        li.classList.toggle('is-done', i < at);
      });
      if (phase === 'listen') this.app.announce(`Trial ${this.trialIndex + 1}. Listen.`);
    }

    _beginResponse() {
      this.state = 'respond';
      this._setPhase('respond');
      this.field.progress = null;
      this.responseStartedAt = performance.now();
      const traj = this.plan.traj;
      this.order = ES.Motion.labelOrder(traj.final, this.cfg.frontOnly);
      this.labelOf = new Map(this.order.map((src, k) => [src, k + 1]));
      this.selected = new Set();
      this.focusSrc = this.order[0];
      this._renderList();
      this._renderDots(false);
      const t = this.cfg.t;
      this.el.respondTitle.textContent = t === 1 ? 'Which one was the target?' : `Which ${t} were targets?`;
      this.el.respondHead.hidden = false;
      this.el.respondActions.hidden = false;
      this.el.respond.hidden = false;
      this.el.result.hidden = true;
      this._syncSelection();
      this._focusButton(this.focusSrc, false);
      const what = t === 1 ? 'the target' : `the ${t} targets`;
      this.app.announce(`Stopped. Choose ${what}. Use the arrow keys to hear each sound, Space to pick, Enter to confirm.`);
      this.app.say(`Choose ${what}`);
    }

    _renderList() {
      const list = this.el.list;
      list.textContent = '';
      const showWhere = this.cfg.showPositions;
      for (const src of this.order) {
        const label = this.labelOf.get(src);
        const sph = U.toSpherical(this.plan.traj.final[src]);
        let where = '';
        if (showWhere) {
          where = U.clockLabel(sph.az);
          if (this.cfg.mode === 'dome') where += sph.el > 25 ? ', high' : sph.el < -5 ? ', low' : '';
          if (this.cfg.mode === 'disc') where += sph.r < 1.9 ? ', near' : sph.r > 2.6 ? ', far' : '';
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sound-btn';
        btn.dataset.src = String(src);
        btn.setAttribute('aria-pressed', 'false');
        btn.tabIndex = src === this.focusSrc ? 0 : -1;
        btn.dataset.name = `Sound ${label}${where ? ', ' + where : ''}`;
        btn.setAttribute('aria-label', btn.dataset.name);
        btn.innerHTML = `<span class="sound-num">${label}</span><span class="sound-where">${where || 'Listen'}</span>`;
        btn.addEventListener('click', () => {
          this._audition(src);
          if (this.state === 'respond') this._toggle(src);
        });
        btn.addEventListener('focus', () => this._onFocus(src));
        btn.addEventListener('mouseenter', () => {
          this.field.hoverId = src;
        });
        btn.addEventListener('mouseleave', () => {
          this.field.hoverId = -1;
        });
        list.appendChild(btn);
      }
    }

    _renderDots(result) {
      if (!this.cfg.showPositions && !result) {
        this.field.dots = [];
        return;
      }
      const targets = new Set(this.plan.targets);
      this.field.dots = this.order.map((src) => {
        const isTarget = targets.has(src);
        const picked = this.selected.has(src);
        let state = picked ? 'selected' : 'idle';
        if (result) state = isTarget && picked ? 'hit' : isTarget ? 'miss' : picked ? 'false' : 'other';
        return { id: src, pos: this.plan.traj.final[src], label: String(this.labelOf.get(src)), state, flash: 0 };
      });
    }

    _syncSelection() {
      const T = this.cfg.t;
      U.$$('.sound-btn', this.el.list).forEach((b) => b.setAttribute('aria-pressed', String(this.selected.has(Number(b.dataset.src)))));
      for (const d of this.field.dots) d.state = this.selected.has(d.id) ? 'selected' : 'idle';
      const n = this.selected.size;
      this.el.confirm.disabled = n !== T;
      this.el.respondHint.textContent = n === T ? 'Ready. Confirm your choice.' : `Picked ${n} of ${T}.`;
    }

    _toggle(src) {
      if (this.state !== 'respond' || src == null || src < 0) return;
      const eng = this.app.engine;
      const label = this.labelOf.get(src);
      if (this.selected.has(src)) {
        this.selected.delete(src);
        eng.playEarcon('deselect');
        this.app.say(`${label} removed`);
      } else {
        if (this.selected.size >= this.cfg.t) {
          eng.playEarcon('deny');
          const msg = `You already picked ${this.cfg.t}. Remove one first.`;
          this.el.respondHint.textContent = msg;
          this.app.announce(msg);
          return;
        }
        this.selected.add(src);
        eng.playEarcon('select');
        this.app.say(`${label} picked`);
      }
      this._syncSelection();
      if (this.selected.size === this.cfg.t) this.app.announce(`Sound ${label} picked. Press Enter to confirm.`);
    }

    _confirm() {
      if (this.state !== 'respond' || this.selected.size !== this.cfg.t) return;
      const eng = this.app.engine;
      const T = this.cfg.t;
      const targets = new Set(this.plan.targets);
      const hits = Array.from(this.selected).filter((s) => targets.has(s)).length;
      const correct = hits === T;
      const speed = this.stairs.speed;
      const step = this.stairs.update(correct);
      const byLabel = (a, b) => a - b;
      this.trials.push({
        n: this.trialIndex + 1,
        speed: Math.round(speed * 100) / 100,
        correct,
        hits,
        targets: this.plan.targets.map((s) => this.labelOf.get(s)).sort(byLabel),
        picked: Array.from(this.selected).map((s) => this.labelOf.get(s)).sort(byLabel),
        rtMs: Math.round(performance.now() - this.responseStartedAt),
        reversal: step.reversal,
        bounces: this.plan.traj.bounces,
      });
      this.trialIndex++;
      if (correct) this.correctCount++;
      this.state = 'result';
      this._setPhase('result');

      this._renderDots(true);
      U.$$('.sound-btn', this.el.list).forEach((b) => {
        const src = Number(b.dataset.src);
        const isTarget = targets.has(src);
        const picked = this.selected.has(src);
        b.dataset.result = isTarget && picked ? 'hit' : isTarget ? 'miss' : picked ? 'false' : 'other';
        const verdict = isTarget ? (picked ? 'target, you picked it' : 'target, missed') : picked ? 'not a target, you picked it' : 'not a target';
        b.setAttribute('aria-label', `${b.dataset.name}: ${verdict}`);
      });

      const nextSpeed = this.stairs.speed;
      const change = nextSpeed > speed + 1e-9 ? 'The next trial is faster.' : nextSpeed < speed - 1e-9 ? 'The next trial is slower.' : 'The next trial stays at this speed.';
      const found = correct ? (T === 1 ? 'You found the target.' : `You found all ${T} targets.`) : `You found ${hits} of ${T}.`;
      this.el.respondHead.hidden = true;
      this.el.respondActions.hidden = true;
      this.el.result.hidden = false;
      this.el.result.dataset.correct = String(correct);
      this.el.resultTitle.textContent = correct ? 'Correct' : 'Not this time';
      this.el.resultDetail.textContent = `${found} ${change} Bells ring from where the targets ended up.`;
      const lastTrial = !this.practice && this.trialIndex >= this.cfg.trials;
      this.el.next.textContent = lastTrial ? 'See results' : 'Next trial';
      this._readouts();

      eng.playEarcon(correct ? 'success' : 'fail');
      const reveal = this.plan.targets.slice().sort((a, b) => this.labelOf.get(a) - this.labelOf.get(b));
      reveal.forEach((src, k) => {
        const delay = 0.55 + k * 0.5;
        eng.bellAt(src, delay);
      });
      this.app.announce(`${correct ? 'Correct.' : 'Not this time.'} ${found} ${change}`);
      this.app.say(correct ? 'Correct' : `${hits} of ${T}`);
      this.el.next.focus({ preventScroll: true });
      if (this.cfg.autoAdvance) {
        const wait = Math.max(2800, (0.55 + reveal.length * 0.5) * 1000 + 1500);
        this.autoTimer = this._later(() => {
          if (this.state === 'result') this._nextTrial();
        }, ES.dev && ES.dev.fast ? 600 : wait);
      }
    }

    /* ---------- listening while choosing ---------- */

    _audition(src, force) {
      if (src == null || src < 0 || !this.plan) return;
      const now = performance.now();
      if (!force && this.lastAudition && this.lastAudition.src === src && now - this.lastAudition.at < 300) return;
      this.lastAudition = { src, at: now };
      let delay = 0;
      if (this.cfg.voice) {
        this.app.say(String(this.labelOf.get(src)));
        delay = 0.45;
      }
      this.app.engine.audition(src, { count: 2, gap: 0.12, delay });
    }

    _hover(src) {
      if (this.state !== 'respond' && this.state !== 'result') return;
      if (src === this.hoverSrc) return;
      this.hoverSrc = src;
      if (src >= 0) {
        this._cancelAuto();
        this._audition(src);
      }
    }

    _onFocus(src) {
      if (!this.order) return;
      this.focusSrc = src;
      U.$$('.sound-btn', this.el.list).forEach((b) => (b.tabIndex = Number(b.dataset.src) === src ? 0 : -1));
      this.field.focusId = src;
      if (this.suppressAudition) {
        this.suppressAudition = false;
        return;
      }
      this._audition(src);
    }

    _focusButton(src, audition) {
      const btn = this.el.list.querySelector(`.sound-btn[data-src="${src}"]`);
      if (!btn) return;
      if (document.activeElement === btn) {
        this.focusSrc = src;
        this.field.focusId = src;
        if (audition) this._audition(src, true);
        return;
      }
      this.suppressAudition = !audition;
      btn.focus({ preventScroll: true });
      if (document.activeElement !== btn) this.suppressAudition = false;
    }

    _moveFocus(dir) {
      if (!this.order || !this.order.length) return;
      this._cancelAuto();
      let k = this.order.indexOf(this.focusSrc);
      if (k < 0) k = dir > 0 ? -1 : 0;
      k = (k + dir + this.order.length) % this.order.length;
      this._focusButton(this.order[k], true);
    }

    _rollCall() {
      if (!this.order || (this.state !== 'respond' && this.state !== 'result')) return;
      this._cancelAuto();
      this.rollTimers.forEach(clearTimeout);
      this.rollTimers = [];
      const gap = this.cfg.voice ? 950 : 520;
      this.order.forEach((src, k) => {
        this.rollTimers.push(
          setTimeout(() => {
            if (this.state !== 'respond' && this.state !== 'result') return;
            this.field.focusId = src;
            this._audition(src, true);
          }, k * gap)
        );
      });
      this.rollTimers.push(
        setTimeout(() => {
          this.field.focusId = this.focusSrc;
        }, this.order.length * gap)
      );
    }

    /* ---------- keyboard ---------- */

    onKey(e) {
      if (this.state === 'idle') return;
      const k = e.key;
      if (this.state === 'paused') {
        if (k === 'Escape') {
          e.preventDefault();
          this.resume();
        } else if (k === 'Tab') {
          const items = [this.el.resume, this.el.end];
          const i = items.indexOf(document.activeElement);
          e.preventDefault();
          items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
        }
        return;
      }
      if (k === 'Escape' || k === 'p' || k === 'P') {
        e.preventDefault();
        this.pause();
        return;
      }
      const target = e.target;
      const tag = target && target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const onButton = tag === 'BUTTON';
      const onSound = onButton && target.classList.contains('sound-btn');

      if (this.state === 'respond' || this.state === 'result') {
        if (k === 'ArrowRight' || k === 'ArrowDown') {
          e.preventDefault();
          this._moveFocus(1);
          return;
        }
        if (k === 'ArrowLeft' || k === 'ArrowUp') {
          e.preventDefault();
          this._moveFocus(-1);
          return;
        }
        if (k === 'r' || k === 'R') {
          e.preventDefault();
          this._rollCall();
          return;
        }
      }

      if (this.state === 'respond') {
        if (/^[1-9]$/.test(k)) {
          const src = this.order[Number(k) - 1];
          if (src != null) {
            e.preventDefault();
            this._toggle(src);
            this._focusButton(src, false);
          }
          return;
        }
        if (k === ' ' || k === 'Spacebar') {
          if (onButton) return; // the button's own click handles it
          e.preventDefault();
          this._toggle(this.focusSrc);
          return;
        }
        if (k === 'Enter') {
          if (onButton && !onSound) return;
          e.preventDefault();
          this._confirm();
        }
        return;
      }

      if (this.state === 'result' && (k === ' ' || k === 'Spacebar' || k === 'Enter')) {
        if (onButton && !onSound && target !== this.el.next) return;
        e.preventDefault();
        this._nextTrial();
      }
    }

    /* ---------- pause and end ---------- */

    pause() {
      if (!['running', 'respond', 'result'].includes(this.state)) return;
      this._clearTimers();
      this.resumeState = this.state;
      if (this.state === 'running') {
        this.app.engine.releaseTrial();
        this.el.pauseNote.textContent = 'The trial you were on will start again from the beginning.';
      } else {
        this.el.pauseNote.textContent = 'Nothing is lost. You’ll pick up where you left off.';
      }
      this.state = 'paused';
      this.el.overlay.hidden = false;
      this.el.resume.focus();
      this.app.announce('Paused.');
    }

    resume() {
      if (this.state !== 'paused') return;
      this.el.overlay.hidden = true;
      const s = this.resumeState;
      if (s === 'running') {
        this.state = 'starting';
        this._nextTrial();
        return;
      }
      this.state = s;
      if (s === 'respond') this._focusButton(this.focusSrc, false);
      else this.el.next.focus({ preventScroll: true });
    }

    end() {
      this.el.overlay.hidden = true;
      if (!this.practice && this.trials.length >= 6) {
        this._finish(true);
        return;
      }
      const discarded = !this.practice && this.trials.length > 0;
      this._stop();
      this.app.show('home');
      if (discarded) this.app.toast('Session ended. Sessions shorter than 6 trials aren’t saved.');
    }

    /** Called when the page is hidden: timers slow down, so pause a running trial. */
    onHidden() {
      if (this.state === 'running') this.pause();
    }

    _stop() {
      this._clearTimers();
      this.app.engine.releaseTrial();
      this.state = 'idle';
      this.plan = null;
      this.field.stop();
    }

    _finish(partial) {
      const cfg = this.cfg;
      this._stop();
      if (this.practice) {
        this.app.show('home');
        return;
      }
      const record = {
        id: U.uid(),
        startedAt: this.startedAt,
        endedAt: Date.now(),
        partial: !!partial,
        key: ES.Settings.key(cfg),
        setup: ES.Settings.describe(cfg),
        config: ES.Settings.difficulty(cfg),
        threshold: this.stairs.threshold(),
        accuracy: this.trials.length ? this.correctCount / this.trials.length : 0,
        reversals: this.stairs.reversals.length,
        trials: this.trials,
      };
      const previous = this.app.history.last(record.key);
      this.app.history.add(record);
      this.app.summary.show(record, previous);
    }

    /* ---------- helpers ---------- */

    _readouts() {
      const cfg = this.cfg;
      const current = this.state === 'result' ? this.trialIndex : this.trialIndex + 1;
      this.el.trial.textContent = this.practice ? String(current) : `${Math.min(current, cfg.trials)} of ${cfg.trials}`;
      this.el.speed.textContent = U.fmtSpeed(this.stairs.speed);
      this.el.targets.textContent = `${cfg.t} of ${cfg.n}`;
      this.el.correct.textContent = String(this.correctCount);
    }

    _later(fn, ms) {
      const id = setTimeout(() => {
        this.timers = this.timers.filter((t) => t !== id);
        fn();
      }, ms);
      this.timers.push(id);
      return id;
    }

    _cancelAuto() {
      if (this.autoTimer) {
        clearTimeout(this.autoTimer);
        this.timers = this.timers.filter((t) => t !== this.autoTimer);
        this.autoTimer = 0;
      }
    }

    _clearTimers() {
      this.timers.forEach(clearTimeout);
      this.timers = [];
      this.rollTimers.forEach(clearTimeout);
      this.rollTimers = [];
      this.autoTimer = 0;
    }
  }

  ES.Game = Game;
  ES.buildPlan = buildPlan;
})(typeof window !== 'undefined' ? window : globalThis);

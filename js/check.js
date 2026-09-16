/*
 * Earshot: headphone check.
 * 1. Left or right: catches swapped or dead earpieces.
 * 2. Point to the sound: eight directions at ear level; reports average error
 *    and front–back mix-ups, the most common problem with generic HRTFs.
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});
  const U = ES.U;

  const LR_ROUNDS = 4;
  const DIRECTIONS = [0, 45, 90, 135, 180, 225, 270, 315];

  class Check {
    constructor(app) {
      this.app = app;
      const $ = (id) => document.getElementById(id);
      this.el = {
        lrPlay: $('lr-play'),
        lrLeft: $('lr-left'),
        lrRight: $('lr-right'),
        lrStatus: $('lr-status'),
        locStart: $('loc-start'),
        locReplay: $('loc-replay'),
        locStatus: $('loc-status'),
        saved: $('check-saved'),
      };
      this.field = new ES.PolarField($('check-field'));
      this.field.setArena('ring', false);
      this.field.onPoint = (az) => this._locAnswer(az);
      this.lr = { round: 0, correct: 0, side: null, waiting: false };
      this.loc = { active: false, waiting: false, rounds: [], idx: 0, results: [] };

      this.el.lrPlay.addEventListener('click', () => this._lrPlay());
      this.el.lrLeft.addEventListener('click', () => this._lrAnswer('left'));
      this.el.lrRight.addEventListener('click', () => this._lrAnswer('right'));
      this.el.locStart.addEventListener('click', () => this._locStart());
      this.el.locReplay.addEventListener('click', () => this._locPlay());
    }

    enter() {
      this.field.refresh();
      this._renderSaved();
    }

    leave() {
      clearTimeout(this.locTimer);
      if (this.loc.active) {
        this.loc = { active: false, waiting: false, rounds: [], idx: 0, results: [] };
        this.field.pointerMode = false;
        this.field.pointerAz = null;
        this.field.markers = [];
        this.el.locReplay.disabled = true;
        this.el.locStart.textContent = 'Start';
        this.el.locStatus.textContent = '';
      }
    }

    async _unlock() {
      const eng = this.app.engine;
      let ok = false;
      try {
        ok = await eng.unlock();
      } catch (e) {
        this.app.toast(e.message);
        return false;
      }
      if (!ok) {
        this.app.toast('The browser blocked sound. Click the page once, then try again.');
        return false;
      }
      eng.setVolume(this.app.settings.volume);
      eng.setAmbience(this.app.settings.ambience);
      return true;
    }

    _renderSaved() {
      const saved = this.app.history.getCheck();
      const parts = [];
      if (saved.lr) parts.push(`left or right ${saved.lr.correct} of ${saved.lr.rounds}`);
      if (saved.loc) parts.push(`average error ${saved.loc.meanError}°, ${saved.loc.swaps} front–back mix-ups`);
      this.el.saved.hidden = !parts.length;
      if (parts.length) this.el.saved.textContent = `Your last check: ${parts.join('; ')}.`;
    }

    /* ---------- left or right ---------- */

    async _lrPlay() {
      if (!(await this._unlock())) return;
      if (this.loc.active) this.leave();
      if (this.lr.round >= LR_ROUNDS) this.lr = { round: 0, correct: 0, side: null, waiting: false };
      if (!this.lr.waiting) this.lr.side = Math.random() < 0.5 ? 'left' : 'right';
      this.lr.waiting = true;
      this.app.engine.playAt(U.toCartesian(this.lr.side === 'left' ? -90 : 90, 0, 2), { count: 5, gap: 0.13 });
      this.el.lrLeft.disabled = false;
      this.el.lrRight.disabled = false;
      this.el.lrPlay.textContent = 'Play it again';
      this.el.lrStatus.textContent = `Round ${this.lr.round + 1} of ${LR_ROUNDS}. Which side was it on? You can also press ← or →.`;
    }

    _lrAnswer(side) {
      if (!this.lr.waiting) return;
      const ok = side === this.lr.side;
      this.lr.waiting = false;
      this.lr.round++;
      if (ok) this.lr.correct++;
      this.el.lrLeft.disabled = true;
      this.el.lrRight.disabled = true;
      this.app.engine.playEarcon(ok ? 'select' : 'deny');
      if (this.lr.round < LR_ROUNDS) {
        this.el.lrPlay.textContent = 'Play the next sound';
        this.el.lrStatus.textContent = ok ? `Correct. ${this.lr.round} of ${LR_ROUNDS} done.` : `That one was on the ${this.lr.side}. ${this.lr.round} of ${LR_ROUNDS} done.`;
        this.el.lrPlay.focus();
        return;
      }
      this.el.lrPlay.textContent = 'Test again';
      const c = this.lr.correct;
      if (c === LR_ROUNDS) this.el.lrStatus.textContent = `${c} of ${LR_ROUNDS} correct. Left and right are the right way round.`;
      else if (c === 0) this.el.lrStatus.textContent = 'Every answer was reversed, so your headphones are probably on backwards. Swap the earpieces and test again.';
      else this.el.lrStatus.textContent = `${c} of ${LR_ROUNDS} correct. Check that both earpieces play sound, then test again.`;
      this.app.history.saveCheck({ lr: { correct: c, rounds: LR_ROUNDS, at: Date.now() } });
      this._renderSaved();
      this.el.lrPlay.focus();
    }

    /* ---------- point to the sound ---------- */

    async _locStart() {
      if (!(await this._unlock())) return;
      clearTimeout(this.locTimer);
      this.lr.waiting = false;
      this.el.lrLeft.disabled = true;
      this.el.lrRight.disabled = true;
      this.loc = { active: true, waiting: false, rounds: U.shuffle(DIRECTIONS.slice()), idx: 0, results: [] };
      this.el.locStart.textContent = 'Start over';
      this.el.locReplay.disabled = false;
      this._locNext();
    }

    _locNext() {
      const L = this.loc;
      if (!L.active) return;
      if (L.idx >= L.rounds.length) {
        this._locFinish();
        return;
      }
      this.field.markers = [];
      this.field.pointerAz = 0;
      this.field.pointerMode = true;
      L.waiting = true;
      this._locPlay();
      this.el.locStatus.textContent = `Round ${L.idx + 1} of ${L.rounds.length}. Where did the sound come from?`;
      this._syncSlider();
      this.field.canvas.focus({ preventScroll: true });
      this.field.requestDraw();
    }

    /** The field doubles as a slider for keyboard and screen reader users. */
    _syncSlider() {
      const az = Math.round(U.wrapDeg(this.field.pointerAz || 0));
      const c = this.field.canvas;
      c.setAttribute('aria-valuenow', String(az));
      c.setAttribute('aria-valuetext', `${U.clockLabel(az)}, ${az === 0 ? 'straight ahead' : az === -180 ? 'behind' : Math.abs(az) + '° to the ' + (az > 0 ? 'right' : 'left')}`);
    }

    _locPlay() {
      const L = this.loc;
      if (!L.active || !L.waiting) return;
      this.app.engine.playAt(U.toCartesian(L.rounds[L.idx], 0, 2), { count: 6, gap: 0.15 });
    }

    _locAnswer(az) {
      const L = this.loc;
      if (!L.active || !L.waiting) return;
      L.waiting = false;
      const truth = L.rounds[L.idx];
      const err = Math.abs(U.wrapDeg(az - truth));
      const lateral = truth === 90 || truth === 270;
      const mirrorErr = Math.abs(U.wrapDeg(az - (180 - truth)));
      const swapped = !lateral && err > 60 && mirrorErr < err - 30;
      L.results.push({ truth, answer: Math.round(U.wrapDeg(az)), err, swapped, lateral });
      this.field.pointerMode = false;
      this.field.pointerAz = null;
      this.field.markers = [
        { az: truth, kind: 'truth' },
        { az, kind: 'answer' },
      ];
      this.field.requestDraw();
      this.el.locStatus.textContent = `Off by ${Math.round(err)}°.${swapped ? ' Front and back were mixed up.' : ''} The filled dot is where the sound was; the ring is your answer.`;
      L.idx++;
      this.locTimer = setTimeout(() => this._locNext(), ES.dev && ES.dev.fast ? 200 : 2000);
    }

    _locFinish() {
      const L = this.loc;
      L.active = false;
      this.field.pointerMode = false;
      this.el.locReplay.disabled = true;
      this.el.locStart.textContent = 'Test again';
      const mean = Math.round(U.mean(L.results.map((r) => r.err)));
      const eligible = L.results.filter((r) => !r.lateral).length;
      const swaps = L.results.filter((r) => r.swapped).length;
      let advice;
      if (swaps >= 2) advice = 'Front and back often get confused on headphones. Turn on Front only in the settings to keep every sound in front of you.';
      else if (mean > 40) advice = 'Direction is hard to judge on these headphones. Start with First steps and keep the sound set to noise ticks.';
      else advice = 'You can hear direction clearly. Every setup is open to you.';
      this.el.locStatus.textContent = `Average error ${mean}°. Front–back mix-ups: ${swaps} of ${eligible}. ${advice}`;
      this.app.history.saveCheck({ loc: { meanError: mean, swaps, eligible, at: Date.now(), results: L.results } });
      this._renderSaved();
      this.el.locStart.focus();
    }

    onKey(e) {
      const k = e.key;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (this.lr.waiting && (k === 'ArrowLeft' || k === 'ArrowRight')) {
        e.preventDefault();
        this._lrAnswer(k === 'ArrowLeft' ? 'left' : 'right');
        return;
      }
      if (this.loc.active && this.loc.waiting) {
        if (k === 'ArrowLeft' || k === 'ArrowRight') {
          e.preventDefault();
          this.field.pointerAz = U.wrapDeg((this.field.pointerAz || 0) + (k === 'ArrowLeft' ? -15 : 15));
          this.field.requestDraw();
          this._syncSlider();
        } else if (k === 'Enter' && tag !== 'BUTTON') {
          e.preventDefault();
          this._locAnswer(this.field.pointerAz || 0);
        } else if (k === 'r' || k === 'R') {
          e.preventDefault();
          this._locPlay();
        }
      }
    }
  }

  ES.Check = Check;
})(typeof window !== 'undefined' ? window : globalThis);

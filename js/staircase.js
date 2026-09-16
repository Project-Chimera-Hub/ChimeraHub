/*
 * Earshot: adaptive speed staircase (1-up / 1-down), as in visual 3D-MOT.
 * A correct trial makes the next one faster, a mistake makes it slower.
 * Steps are in log10 units: 0.10 (about ×1.26) until the second reversal,
 * then 0.05 (about ×1.12). The procedure converges on the speed that is
 * answered correctly about half the time.
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});
  const U = ES.U;

  class Staircase {
    constructor(opts) {
      const o = Object.assign({ start: 20, min: 3, max: 240, bigStep: 0.1, smallStep: 0.05, switchAfter: 2 }, opts);
      this.min = o.min;
      this.max = o.max;
      this.bigStep = o.bigStep;
      this.smallStep = o.smallStep;
      this.switchAfter = o.switchAfter;
      this.speed = U.clamp(o.start, o.min, o.max);
      this.history = []; // { speed, correct, reversal }
      this.reversals = []; // speeds at which the direction changed
      this.lastDir = 0;
    }

    get step() {
      return this.reversals.length < this.switchAfter ? this.bigStep : this.smallStep;
    }

    update(correct) {
      const dir = correct ? 1 : -1;
      const entry = { speed: this.speed, correct: !!correct, reversal: false };
      if (this.lastDir !== 0 && dir !== this.lastDir) {
        entry.reversal = true;
        this.reversals.push(this.speed);
      }
      this.history.push(entry);
      this.lastDir = dir;
      this.speed = U.clamp(this.speed * Math.pow(10, dir * this.step), this.min, this.max);
      return entry;
    }

    /** Geometric mean of the reversal speeds after the first two (an even number of them). */
    threshold() {
      const usable = this.reversals.slice(this.switchAfter);
      if (usable.length >= 4) return U.geoMean(usable.length % 2 ? usable.slice(1) : usable);
      const n = this.history.length;
      if (!n) return this.speed;
      return U.geoMean(this.history.slice(Math.floor(n / 2)).map((h) => h.speed));
    }
  }

  ES.Staircase = Staircase;
})(typeof window !== 'undefined' ? window : globalThis);

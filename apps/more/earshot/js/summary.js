/*
 * Earshot: end-of-session summary.
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});
  const U = ES.U;

  function adviceFor(rec) {
    if (rec.threshold < 7) {
      return 'The speed stayed near the slowest setting. Try one target, fewer sounds or Front only, and run the headphone check if you haven’t yet.';
    }
    if (rec.threshold >= 90) {
      return 'You kept up with fast movement. To make it harder, add a target or a sound instead of pushing the speed further.';
    }
    return 'Thresholds usually rise over the first few sessions. Keep the same setup for a while so your results stay comparable.';
  }

  class Summary {
    constructor(app) {
      this.app = app;
      const $ = (id) => document.getElementById(id);
      this.el = {
        heading: $('summary-heading'),
        setup: $('sum-setup'),
        threshold: $('sum-threshold'),
        lap: $('sum-lap'),
        correct: $('sum-correct'),
        fastest: $('sum-fastest'),
        previous: $('sum-previous'),
        chart: $('sum-chart'),
        advice: $('sum-advice'),
        storage: $('sum-storage'),
        again: $('btn-again'),
      };
      this.el.again.addEventListener('click', () => this.app.game.start(this.app.settings));
      root.addEventListener('resize', () => {
        if (this.app.screen === 'summary' && this.record) this._drawChart();
      });
    }

    show(record, previous) {
      this.record = record;
      const trials = record.trials;
      const correct = trials.filter((t) => t.correct);
      const fastest = correct.length ? Math.max(...correct.map((t) => t.speed)) : NaN;
      this.el.heading.textContent = record.partial ? 'Session ended early' : 'Session complete';
      this.el.setup.textContent = record.setup;
      this.el.threshold.textContent = U.fmtSpeed(record.threshold);
      this.el.lap.textContent = `At this speed a sound travels all the way around your head in ${(360 / record.threshold).toFixed(1)} seconds.`;
      this.el.correct.textContent = `${correct.length} of ${trials.length}`;
      this.el.fastest.textContent = isFinite(fastest) ? `${U.fmtSpeed(fastest)} °/s` : 'None';
      this.el.previous.textContent = previous ? `${U.fmtSpeed(previous.threshold)} °/s` : 'First session';
      this.el.advice.textContent = adviceFor(record);
      this.el.storage.hidden = this.app.history.persisted;
      this.app.show('summary');
      requestAnimationFrame(() => this._drawChart());
      this.app.announce(`${this.el.heading.textContent}. Speed threshold ${U.fmtSpeed(record.threshold)} degrees per second. ${correct.length} of ${trials.length} trials correct.`);
      this.app.say(`Session complete. Threshold ${Math.round(record.threshold)} degrees per second.`);
    }

    _drawChart() {
      const rec = this.record;
      ES.Charts.speedChart(this.el.chart, {
        points: rec.trials.map((t, i) => ({ x: i + 1, y: t.speed, filled: t.correct })),
        xMin: 1,
        xMax: Math.max(2, rec.trials.length),
        threshold: rec.threshold,
      });
      const speeds = rec.trials.map((t) => t.speed);
      this.el.chart.setAttribute(
        'aria-label',
        `Speed on each of ${rec.trials.length} trials, from ${U.fmtSpeed(speeds[0])} to ${U.fmtSpeed(speeds[speeds.length - 1])} degrees per second. Threshold ${U.fmtSpeed(rec.threshold)}.`
      );
    }
  }

  ES.Summary = Summary;
})(typeof window !== 'undefined' ? window : globalThis);

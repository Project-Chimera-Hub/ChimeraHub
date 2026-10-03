/*
 * Earshot: saved results and the Progress screen.
 * Results live in this browser's local storage. They can be downloaded as CSV or JSON.
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});
  const U = ES.U;

  const KEY = 'earshot.sessions.v1';
  const CAL_KEY = 'earshot.check.v1';
  const MAX_SESSIONS = 300;

  function csvCell(v) {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  class History {
    constructor() {
      const saved = U.store.get(KEY, []);
      this.sessions = Array.isArray(saved) ? saved : [];
      this.persisted = true;
    }

    add(record) {
      this.sessions.push(record);
      if (this.sessions.length > MAX_SESSIONS) this.sessions = this.sessions.slice(-MAX_SESSIONS);
      this.persisted = U.store.set(KEY, this.sessions);
    }

    forKey(key) {
      return this.sessions.filter((s) => s.key === key);
    }

    last(key) {
      const list = this.forKey(key);
      return list.length ? list[list.length - 1] : null;
    }

    setups() {
      const map = new Map();
      for (const s of this.sessions) map.set(s.key, { key: s.key, setup: s.setup, count: (map.get(s.key) || { count: 0 }).count + 1, lastAt: s.endedAt });
      return Array.from(map.values()).sort((a, b) => b.lastAt - a.lastAt);
    }

    /** Start a little below the last threshold for this setup so the staircase settles quickly. */
    startSpeed(cfg) {
      const last = this.last(ES.Settings.key(cfg));
      if (last && isFinite(last.threshold)) return U.clamp(last.threshold * 0.8, 5, 150);
      return cfg.mode === 'ring' ? 20 : 15;
    }

    clear() {
      this.sessions = [];
      U.store.remove(KEY);
    }

    getCheck() {
      return U.store.get(CAL_KEY, {});
    }

    saveCheck(part) {
      U.store.set(CAL_KEY, Object.assign(this.getCheck(), part));
    }

    toCSV() {
      const rows = [
        ['session_id', 'started', 'setup', 'arena', 'sounds', 'targets', 'front_only', 'tracking_s', 'sound', 'session_threshold_deg_s', 'session_accuracy', 'partial', 'trial', 'speed_deg_s', 'correct', 'targets_found', 'target_numbers', 'picked_numbers', 'response_ms', 'reversal', 'bounces'],
      ];
      for (const s of this.sessions) {
        for (const t of s.trials) {
          rows.push([
            s.id,
            new Date(s.startedAt).toISOString(),
            s.setup,
            s.config.mode,
            s.config.n,
            s.config.t,
            s.config.frontOnly,
            s.config.duration,
            s.config.sound,
            s.threshold.toFixed(2),
            s.accuracy.toFixed(3),
            s.partial ? 1 : 0,
            t.n,
            t.speed,
            t.correct ? 1 : 0,
            t.hits,
            t.targets.join(' '),
            t.picked.join(' '),
            t.rtMs,
            t.reversal ? 1 : 0,
            t.bounces,
          ]);
        }
      }
      return rows.map((r) => r.map(csvCell).join(',')).join('\n');
    }

    toJSON() {
      return JSON.stringify({ app: 'Earshot', exportedAt: new Date().toISOString(), sessions: this.sessions, headphoneCheck: this.getCheck() }, null, 2);
    }
  }

  class HistoryView {
    constructor(app) {
      this.app = app;
      const $ = (id) => document.getElementById(id);
      this.el = {
        select: $('hist-setup'),
        controls: $('hist-controls'),
        chart: $('hist-chart'),
        figure: $('hist-figure'),
        tableWrap: $('hist-table-wrap'),
        tbody: $('hist-rows'),
        empty: $('hist-empty'),
        actions: $('hist-actions'),
        csv: $('btn-export-csv'),
        json: $('btn-export-json'),
        clear: $('btn-clear'),
        single: $('hist-single'),
      };
      this.el.select.addEventListener('change', () => this._draw(this.el.select.value));
      this.el.csv.addEventListener('click', () => this._export('csv'));
      this.el.json.addEventListener('click', () => this._export('json'));
      this.el.clear.addEventListener('click', () => {
        if (!root.confirm('Delete every saved session from this browser? This can’t be undone.')) return;
        this.app.history.clear();
        this.render();
        this.app.toast('All saved sessions deleted.');
      });
      root.addEventListener('resize', () => {
        if (this.app.screen === 'history' && this.current) this._draw(this.current);
      });
    }

    render(preferKey) {
      const setups = this.app.history.setups();
      const has = setups.length > 0;
      this.el.empty.hidden = has;
      this.el.controls.hidden = !has;
      this.el.figure.hidden = !has;
      this.el.single.hidden = true;
      this.el.tableWrap.hidden = !has;
      this.el.csv.disabled = !has;
      this.el.json.disabled = !has;
      this.el.clear.disabled = !has;
      if (!has) {
        this.current = null;
        return;
      }
      this.el.select.innerHTML = setups
        .map((s) => `<option value="${U.escapeHtml(s.key)}">${U.escapeHtml(s.setup)} (${U.plural(s.count, 'session')})</option>`)
        .join('');
      const chosen = setups.some((s) => s.key === preferKey) ? preferKey : setups[0].key;
      this.el.select.value = chosen;
      requestAnimationFrame(() => this._draw(chosen));
    }

    _draw(key) {
      this.current = key;
      const list = this.app.history.forKey(key);
      this.el.figure.hidden = list.length < 2;
      this.el.single.hidden = list.length !== 1;
      ES.Charts.speedChart(this.el.chart, {
        points: list.map((s, i) => ({ x: i + 1, y: s.threshold, filled: !s.partial })),
        xMin: 1,
        xMax: Math.max(2, list.length),
        empty: 'No sessions with this setup yet.',
      });
      const first = list[0];
      const last = list[list.length - 1];
      this.el.chart.setAttribute(
        'aria-label',
        list.length > 1
          ? `Speed threshold across ${list.length} sessions, from ${U.fmtSpeed(first.threshold)} to ${U.fmtSpeed(last.threshold)} degrees per second.`
          : `One session, threshold ${U.fmtSpeed(last.threshold)} degrees per second.`
      );
      this.el.tbody.innerHTML = list
        .slice()
        .reverse()
        .map((s) => {
          const correct = s.trials.filter((t) => t.correct).length;
          return `<tr>
            <td>${U.fmtDate(s.endedAt)} <span class="muted">${U.fmtTime(s.endedAt)}</span></td>
            <td class="num">${U.fmtSpeed(s.threshold)}</td>
            <td class="num">${correct} of ${s.trials.length}</td>
            <td>${s.partial ? 'Ended early' : 'Complete'}</td>
          </tr>`;
        })
        .join('');
    }

    _export(kind) {
      const stamp = new Date().toISOString().slice(0, 10);
      const ok =
        kind === 'csv'
          ? U.download(`earshot-results-${stamp}.csv`, this.app.history.toCSV(), 'text/csv')
          : U.download(`earshot-results-${stamp}.json`, this.app.history.toJSON(), 'application/json');
      if (!ok) this.app.toast('The download could not start in this browser.');
    }
  }

  ES.History = History;
  ES.HistoryView = HistoryView;
})(typeof window !== 'undefined' ? window : globalThis);

/*
 * Earshot: home screen (setup, settings, demo).
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});
  const U = ES.U;

  const GLYPHS = {
    ring:
      '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="20" r="2.5" fill="currentColor"/></svg>',
    disc:
      '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 3"/><circle cx="20" cy="20" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="20" r="2" fill="currentColor"/></svg>',
    dome:
      '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M4 27a16 16 0 0 1 32 0" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="20" cy="27" rx="16" ry="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.5 19.5a10 10 0 0 1 19 0" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 3"/><circle cx="20" cy="27" r="2" fill="currentColor"/></svg>',
  };

  function notesFor(s) {
    const notes = [];
    if (s.mode === 'ring') notes.push('On the ring, sounds stay at ear level and only their direction changes.');
    if (s.mode === 'disc') notes.push('On the floor, nearer sounds are louder and farther ones quieter.');
    if (s.mode === 'dome') notes.push('Height is hard to hear on headphones, so the dome is the toughest arena.');
    if (s.frontOnly) notes.push('Front only avoids front–back mix-ups, a common problem on headphones.');
    if (s.sound === 'pluck') notes.push('Plucked strings are tonal, which makes them harder to place.');
    return notes.slice(0, 2).join(' ');
  }

  class Home {
    constructor(app) {
      this.app = app;
      const $ = (id) => document.getElementById(id);
      this.el = {
        presets: $('preset-list'),
        custom: $('custom-note'),
        form: $('adjust'),
        note: $('setting-note'),
        last: $('last-result'),
        demo: $('btn-demo'),
        start: $('btn-start'),
        practice: $('btn-practice'),
        outN: $('out-n'),
        outT: $('out-t'),
        sound: $('set-sound'),
      };
      this.field = new ES.PolarField($('home-field'));
      this.previewKey = '';
      this.previewDots = [];
      this.demoing = false;
      this._renderPresets();
      this.el.sound.innerHTML = Object.keys(ES.SOUNDS)
        .map((k) => `<option value="${k}">${ES.SOUNDS[k].label}</option>`)
        .join('');
      this._bind();
    }

    _renderPresets() {
      this.el.presets.innerHTML = ES.Settings.PRESETS.map(
        (p) => `
        <label class="preset" data-preset="${p.id}">
          <input type="radio" name="preset" value="${p.id}">
          <span class="preset-glyph">${GLYPHS[p.mode]}</span>
          <span class="preset-text">
            <span class="preset-name">${p.name}</span>
            <span class="preset-note">${p.note}</span>
          </span>
          <span class="preset-count" aria-hidden="true">${p.t} in ${p.n}</span>
        </label>`
      ).join('');
    }

    _update(patch) {
      this.app.saveSettings(Object.assign({}, this.app.settings, patch));
      this.render();
    }

    _bind() {
      this.el.presets.addEventListener('change', (e) => {
        if (e.target.name !== 'preset') return;
        const p = ES.Settings.PRESETS.find((x) => x.id === e.target.value);
        if (p) this._update({ mode: p.mode, n: p.n, t: p.t, frontOnly: p.frontOnly });
      });

      U.$$('[data-setting]', this.el.form).forEach((input) => {
        const handler = () => {
          const name = input.dataset.setting;
          let value;
          if (input.type === 'checkbox') value = input.checked;
          else if (input.type === 'radio') {
            if (!input.checked) return;
            value = input.value === 'true';
          } else if (input.type === 'range' || ['duration', 'trials', 'ambience'].includes(name)) value = Number(input.value);
          else value = input.value;
          this._update({ [name]: value });
        };
        input.addEventListener(input.type === 'range' ? 'input' : 'change', handler);
      });

      U.$$('[data-stepper]', this.el.form).forEach((group) => {
        group.addEventListener('click', (e) => {
          const b = e.target.closest('button[data-step]');
          if (!b || b.disabled) return;
          const name = group.dataset.stepper;
          this._update({ [name]: this.app.settings[name] + Number(b.dataset.step) });
        });
      });

      this.el.start.addEventListener('click', () => this.app.game.start(this.app.settings));
      this.el.practice.addEventListener('click', () => this.app.game.start(this.app.settings, { practice: true }));
      this.el.demo.addEventListener('click', () => this.demo());
    }

    render() {
      const s = this.app.settings;
      const preset = ES.Settings.presetFor(s);
      U.$$('.preset', this.el.presets).forEach((label) => {
        const on = !!preset && label.dataset.preset === preset.id;
        label.classList.toggle('is-selected', on);
        label.querySelector('input').checked = on;
      });
      this.el.custom.hidden = !!preset;
      if (!preset) this.el.custom.textContent = `Custom setup: ${ES.Settings.describe(s)}.`;

      const form = this.el.form;
      const setValue = (id, v) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'SELECT' && !Array.from(el.options).some((o) => o.value === String(v))) {
          el.add(new Option(id === 'set-trials' ? `${v}` : String(v), String(v)));
        }
        el.value = String(v);
      };
      setValue('set-mode', s.mode);
      setValue('set-duration', s.duration);
      setValue('set-trials', s.trials);
      setValue('set-sound', s.sound);
      setValue('set-ambience', s.ambience);
      setValue('set-volume', s.volume);
      U.$$('input[name="frontOnly"]', form).forEach((r) => {
        r.checked = String(s.frontOnly) === r.value;
        r.closest('label').classList.toggle('is-on', r.checked);
      });
      U.$$('input[type="checkbox"][data-setting]', form).forEach((c) => {
        c.checked = !!s[c.dataset.setting];
      });
      this.el.outN.textContent = String(s.n);
      this.el.outT.textContent = String(s.t);
      const maxN = s.frontOnly ? 6 : 8;
      const maxT = Math.min(4, s.n - 1);
      U.$('[data-stepper="n"] [data-step="-1"]', form).disabled = s.n <= 3;
      U.$('[data-stepper="n"] [data-step="1"]', form).disabled = s.n >= maxN;
      U.$('[data-stepper="t"] [data-step="-1"]', form).disabled = s.t <= 1;
      U.$('[data-stepper="t"] [data-step="1"]', form).disabled = s.t >= maxT;
      this.el.note.textContent = notesFor(s);

      const last = this.app.history.last(ES.Settings.key(s));
      this.el.last.innerHTML = last
        ? `Last session with this setup <strong>${U.fmtSpeed(last.threshold)} °/s</strong> <span>${U.fmtDate(last.endedAt)}</span>`
        : 'No saved sessions with this setup yet.';
      this._preview();
    }

    _preview() {
      const s = this.app.settings;
      const key = [s.mode, s.n, s.t, s.frontOnly].join('/');
      if (key !== this.previewKey) {
        this.previewKey = key;
        const traj = ES.Motion.simulate({ mode: s.mode, n: s.n, speed: 1, duration: 0.02, frontOnly: s.frontOnly });
        const targets = new Set(U.sample(U.range(s.n), s.t));
        this.previewDots = traj.initial.map((pos, i) => ({ id: i, pos, label: '', state: targets.has(i) ? 'cue' : 'idle', flash: 0 }));
      }
      if (this.demoing) return;
      this.field.setArena(s.mode, s.frontOnly);
      this.field.dots = this.previewDots;
      this.field.refresh();
    }

    async demo() {
      const eng = this.app.engine;
      let ok = false;
      try {
        ok = await eng.unlock();
      } catch (e) {
        this.app.toast(e.message);
        return;
      }
      if (!ok) {
        this.app.toast('The browser blocked sound. Click the page once, then try again.');
        return;
      }
      eng.setVolume(this.app.settings.volume);
      eng.setAmbience(this.app.settings.ambience);
      const seconds = 5;
      const info = eng.demoOrbit(seconds, this.app.settings.sound);
      this.demoing = true;
      this.el.demo.disabled = true;
      this.field.setArena('ring', false);
      this.field.onFrame = () => {
        const t = eng.ctx.currentTime - eng.outputDelay() - info.t0;
        if (t > seconds + 0.15 || this.app.screen !== 'home') {
          this.field.onFrame = null;
          this.field.stop();
          this.demoing = false;
          this.el.demo.disabled = false;
          this._preview();
          return;
        }
        const az = U.clamp(t / seconds, 0, 1) * 360;
        this.field.dots = [{ id: 0, pos: U.toCartesian(az, 0, 2), label: '', state: 'idle', flash: 0.35 }];
      };
      this.field.start();
      this.app.announce('Playing a sound that circles your head once, starting in front.');
    }
  }

  ES.Home = Home;
})(typeof window !== 'undefined' ? window : globalThis);

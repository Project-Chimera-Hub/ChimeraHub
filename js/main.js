/*
 * Earshot: start-up, navigation, announcements and global keyboard routing.
 */
(function (root) {
  'use strict';
  const ES = root.ES;
  const U = ES.U;

  ES.dev = { fast: /[?&]fast\b/.test(root.location.search || '') };

  const app = {
    engine: new ES.AudioEngine(),
    history: new ES.History(),
    settings: ES.Settings.load(),
    screen: null,

    saveSettings(next) {
      this.settings = ES.Settings.normalize(next);
      ES.Settings.save(this.settings);
      if (this.engine.ctx) {
        this.engine.setVolume(this.settings.volume);
        this.engine.setAmbience(this.settings.ambience);
      }
    },

    show(name) {
      const previous = this.screen;
      this.screen = name;
      U.$$('.screen').forEach((s) => {
        s.hidden = s.id !== 'screen-' + name;
      });
      U.$$('.nav-link').forEach((b) => {
        if (b.dataset.nav === name) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      document.body.classList.toggle('in-session', name === 'game');
      if (previous === 'check' && name !== 'check') this.check.leave();
      if (name === 'home') this.home.render();
      if (name === 'check') this.check.enter();
      if (name === 'history') this.historyView.render(ES.Settings.key(this.settings));
      root.scrollTo(0, 0);
      if (name !== 'game' && previous !== null) {
        const heading = U.$(`#screen-${name} h1`);
        if (heading) {
          heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        }
      }
    },

    announce(text) {
      const el = document.getElementById('live');
      if (!el) return;
      el.textContent = '';
      setTimeout(() => {
        el.textContent = text;
      }, 60);
    },

    say(text) {
      if (!this.settings.voice || !('speechSynthesis' in root)) return;
      try {
        root.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.08;
        root.speechSynthesis.speak(u);
      } catch (e) {
        /* speech unavailable */
      }
    },

    hideToast() {
      clearTimeout(this.toastTimer);
      document.getElementById('toast').hidden = true;
    },

    toast(text) {
      const el = document.getElementById('toast');
      el.textContent = text;
      el.hidden = false;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        el.hidden = true;
      }, 5000);
    },
  };

  ES.app = app;
  app.home = new ES.Home(app);
  app.game = new ES.Game(app);
  app.summary = new ES.Summary(app);
  app.historyView = new ES.HistoryView(app);
  app.check = new ES.Check(app);

  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (!nav) return;
    e.preventDefault();
    if (app.game.active) {
      app.game.pause();
      return;
    }
    app.show(nav.dataset.nav);
  });

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (app.screen === 'game') app.game.onKey(e);
    else if (app.screen === 'check') app.check.onKey(e);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) app.game.onHidden();
  });

  const refreshFields = () => [app.home.field, app.game.field, app.check.field].forEach((f) => f.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshFields);
  if (root.matchMedia) {
    const mq = root.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', refreshFields);
  }

  if (!app.engine.supported) {
    const warn = document.getElementById('env-warning');
    warn.textContent = 'This browser can’t play spatial audio. Open Earshot in a current version of Chrome, Edge, Firefox or Safari.';
    warn.hidden = false;
    U.$$('#btn-start, #btn-practice, #btn-demo').forEach((b) => (b.disabled = true));
  }

  app.show('home');
})(window);

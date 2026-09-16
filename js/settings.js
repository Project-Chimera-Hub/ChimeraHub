/*
 * Earshot: settings, presets and persistence.
 */
(function (root) {
  'use strict';
  const ES = (root.ES = root.ES || {});
  const U = ES.U;

  const KEY = 'earshot.settings.v1';

  const ARENA_NAMES = { ring: 'Ring', disc: 'Floor', dome: 'Dome' };

  const PRESETS = [
    { id: 'first', name: 'First steps', mode: 'ring', n: 4, t: 1, frontOnly: false, note: 'Four sounds on a ring at ear level. Follow one.' },
    { id: 'pair', name: 'Two at once', mode: 'ring', n: 5, t: 2, frontOnly: false, note: 'Five sounds on the ring. Follow two.' },
    { id: 'floor', name: 'Near and far', mode: 'disc', n: 6, t: 2, frontOnly: false, note: 'Sounds also move closer to you and farther away.' },
    { id: 'dome', name: 'Overhead', mode: 'dome', n: 6, t: 2, frontOnly: false, note: 'Sounds travel over a dome. Height is the hardest cue to hear.' },
    { id: 'classic', name: 'Eight and four', mode: 'dome', n: 8, t: 4, frontOnly: false, note: 'The counts used in visual 3D-MOT. Very hard by ear.' },
  ];

  const DEFAULTS = {
    mode: 'ring',
    n: 4,
    t: 1,
    frontOnly: false,
    duration: 8,
    trials: 20,
    sound: 'tick',
    ambience: 1,
    volume: 0.8,
    showPositions: true,
    voice: false,
    autoAdvance: true,
  };

  const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : fallback);

  function normalize(input) {
    const c = Object.assign({}, DEFAULTS, input);
    if (!ARENA_NAMES[c.mode]) c.mode = DEFAULTS.mode;
    c.frontOnly = c.frontOnly === true || c.frontOnly === 'true';
    c.n = U.clamp(Math.round(num(c.n, DEFAULTS.n)), 3, c.frontOnly ? 6 : 8);
    c.t = U.clamp(Math.round(num(c.t, DEFAULTS.t)), 1, Math.min(4, c.n - 1));
    c.duration = U.clamp(num(c.duration, DEFAULTS.duration), 4, 12);
    c.trials = U.clamp(Math.round(num(c.trials, DEFAULTS.trials)), 6, 60);
    if (!ES.SOUNDS || !ES.SOUNDS[c.sound]) c.sound = DEFAULTS.sound;
    c.ambience = U.clamp(Math.round(num(c.ambience, DEFAULTS.ambience)), 0, 2);
    c.volume = U.clamp(num(c.volume, DEFAULTS.volume), 0, 1);
    c.showPositions = !!c.showPositions;
    c.voice = !!c.voice;
    c.autoAdvance = !!c.autoAdvance;
    return c;
  }

  function presetFor(c) {
    return PRESETS.find((p) => p.mode === c.mode && p.n === c.n && p.t === c.t && p.frontOnly === c.frontOnly) || null;
  }

  /** Results are only comparable between sessions that share these settings. */
  function key(c) {
    return [c.mode, c.n, c.t, c.frontOnly ? 'front' : 'all', c.duration].join('/');
  }

  function describe(c) {
    return `${ARENA_NAMES[c.mode]}, ${U.plural(c.n, 'sound')}, ${U.plural(c.t, 'target')}, ${c.frontOnly ? 'front only' : 'all around'}, ${c.duration} s tracking`;
  }

  function difficulty(c) {
    return { mode: c.mode, n: c.n, t: c.t, frontOnly: c.frontOnly, duration: c.duration, sound: c.sound };
  }

  function load() {
    return normalize(U.store.get(KEY, {}));
  }

  function save(c) {
    return U.store.set(KEY, c);
  }

  ES.Settings = { PRESETS, DEFAULTS, ARENA_NAMES, normalize, presetFor, key, describe, difficulty, load, save };
})(typeof window !== 'undefined' ? window : globalThis);

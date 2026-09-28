let audioCtx = null;
let masterBus = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Master output bus with a gentle limiter. Every tone routes through this
// instead of connecting straight to ctx.destination, so when multiple sounds
// (e.g. two sound-relation streams, or a scored + decoy stream) overlap on a
// single trial their summed gains no longer clip/distort. Created lazily and
// reused for the lifetime of the context.
function getMasterBus(ctx) {
  if (!ctx) return null;
  if (masterBus && masterBus.context === ctx) return masterBus;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, ctx.currentTime);
  compressor.knee.setValueAtTime(24, ctx.currentTime);
  compressor.ratio.setValueAtTime(4, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.15, ctx.currentTime);
  compressor.connect(ctx.destination);
  masterBus = compressor;
  return masterBus;
}

function tokenFrequency(token) {
  const text = String(token || 'A');
  let total = 0;
  for (let i = 0; i < text.length; i++) total += text.charCodeAt(i);
  return 240 + (total % 28) * 22;
}

// Single-tone player. `peakGain` lets callers vary loudness independently
// from frequency / duration — used by the new VOLUME_* sound relations.
function playTone(ctx, frequency, duration, pan, startTime, type = 'sine', peakGain = 0.18) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0005, peakGain), startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  const out = getMasterBus(ctx) || ctx.destination;
  if (panner) {
    panner.pan.setValueAtTime(pan, startTime);
    oscillator.connect(gain).connect(panner).connect(out);
  } else {
    oscillator.connect(gain).connect(out);
  }

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function playTokenCue(ctx, token, pan, startTime) {
  const chars = String(token || 'A').slice(0, 4).split('');
  chars.forEach((char, index) => {
    playTone(ctx, tokenFrequency(char), 0.1, pan, startTime + index * 0.13, 'triangle');
  });
}

// Cross-modal cues for the NRINT audio-modality flags. Each fires in its
// own time slot so multiple cues on the same trial layer without colliding.
// All reuse the shared AudioContext + playTone so they inherit
// autoplay-policy handling.
//
//   Flag           Slot offset   Synthesis
//   audio          +0.03 s       480 Hz sine, normal gain, 0.18 s
//   pitch_high     +0.03 s       980 Hz sine, normal gain, 0.18 s
//   audio_loud     +0.25 s       480 Hz sine, HIGH gain (0.40), 0.18 s
//   audio_long     +0.45 s       480 Hz sine, normal gain, LONG 0.45 s
//   audio_rhythmic +0.75 s       720 Hz sine, three quick pulses (0.05 s × 3)
//   audio_warm     +1.05 s       320 Hz sawtooth, normal gain, 0.22 s
//
// Slot offsets keep them clearly separable when 4+ fire on the same trial.
export function playNRINTAudioCue(pan = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 480, 0.18, pan, ctx.currentTime + 0.03, 'sine');
}
export function playNRINTPitchHighCue(pan = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 980, 0.18, pan, ctx.currentTime + 0.03, 'sine');
}
export function playNRINTLoudCue(pan = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 480, 0.18, pan, ctx.currentTime + 0.25, 'sine', 0.40);
}
export function playNRINTLongCue(pan = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 480, 0.45, pan, ctx.currentTime + 0.45, 'sine');
}
export function playNRINTRhythmicCue(pan = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.75;
  [0, 0.08, 0.16].forEach(off => playTone(ctx, 720, 0.05, pan, t0 + off, 'sine'));
}
export function playNRINTWarmCue(pan = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 320, 0.22, pan, ctx.currentTime + 1.05, 'sawtooth', 0.14);
}

export function playSoundStimulus(stimulus, pan = 0, delaySeconds = 0) {
  if (!stimulus?.rel) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + 0.03 + delaySeconds;
  const rel = stimulus.rel;
  const a = stimulus.soundA || stimulus.wordA || 'A';
  const b = stimulus.soundB || stimulus.wordB || 'B';

  if (rel === 'PITCH_HIGHER') {
    playTone(ctx, 660, 0.18, pan, now);
    playTone(ctx, 360, 0.18, pan, now + 0.24);
    return;
  }
  if (rel === 'PITCH_LOWER') {
    playTone(ctx, 360, 0.18, pan, now);
    playTone(ctx, 660, 0.18, pan, now + 0.24);
    return;
  }
  if (rel === 'RHYTHM_FASTER') {
    [0, 0.12, 0.24, 0.36].forEach(offset => playTone(ctx, 520, 0.055, pan, now + offset, 'square'));
    return;
  }
  if (rel === 'RHYTHM_SLOWER') {
    [0, 0.24, 0.48].forEach(offset => playTone(ctx, 420, 0.09, pan, now + offset, 'sine'));
    return;
  }
  // VOLUME — same pitch, different peak gains (loud vs quiet pair)
  if (rel === 'VOLUME_LOUDER') {
    playTone(ctx, 480, 0.20, pan, now,         'sine', 0.30);
    playTone(ctx, 480, 0.20, pan, now + 0.30, 'sine', 0.06);
    return;
  }
  if (rel === 'VOLUME_QUIETER') {
    playTone(ctx, 480, 0.20, pan, now,         'sine', 0.06);
    playTone(ctx, 480, 0.20, pan, now + 0.30, 'sine', 0.30);
    return;
  }
  // DURATION — same pitch + volume, different sustain lengths
  if (rel === 'DURATION_LONGER') {
    playTone(ctx, 460, 0.45, pan, now,         'sine');
    playTone(ctx, 460, 0.10, pan, now + 0.55, 'sine');
    return;
  }
  if (rel === 'DURATION_SHORTER') {
    playTone(ctx, 460, 0.10, pan, now,         'sine');
    playTone(ctx, 460, 0.45, pan, now + 0.20, 'sine');
    return;
  }
  // TIMBRE — same pitch + volume + duration, different waveforms.
  // Sawtooth is the "bright" (rich-harmonic) one; sine is "warm" (pure).
  if (rel === 'TIMBRE_BRIGHT') {
    playTone(ctx, 500, 0.22, pan, now,         'sawtooth', 0.14);
    playTone(ctx, 500, 0.22, pan, now + 0.32, 'sine',     0.18);
    return;
  }
  if (rel === 'TIMBRE_WARM') {
    playTone(ctx, 500, 0.22, pan, now,         'sine',     0.18);
    playTone(ctx, 500, 0.22, pan, now + 0.32, 'sawtooth', 0.14);
    return;
  }

  playTokenCue(ctx, a, pan, now);
  playTokenCue(ctx, b, pan, now + 0.58);
}
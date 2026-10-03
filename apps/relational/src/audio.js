const EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a'];
const sourceCache = new Map();
const playerCache = new Map();
let lastPlayed = null;

export async function preloadDigitAudio() {
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => resolveAudioSource(index + 1)));
  return results.filter(Boolean).length;
}

/** How many of the eight digit clips actually resolved. Used for the setup warning. */
export function availableDigitCount() {
  return [...sourceCache.values()].filter(Boolean).length;
}

export async function playDigit(number, enabled = true) {
  if (!enabled) return false;
  const digit = Number(number);
  if (!Number.isInteger(digit) || digit < 1 || digit > 8) return false;
  const src = await resolveAudioSource(digit);
  if (!src) return false;
  try {
    if (lastPlayed && !lastPlayed.paused) {
      lastPlayed.pause();
      lastPlayed.currentTime = 0;
    }
    const player = playerFor(digit, src);
    player.currentTime = 0;
    lastPlayed = player;
    await player.play();
    return true;
  } catch {
    return false;
  }
}

export function stopDigitAudio() {
  if (!lastPlayed) return;
  try {
    lastPlayed.pause();
    lastPlayed.currentTime = 0;
  } catch { /* nothing to stop */ }
}

function playerFor(digit, src) {
  if (!playerCache.has(digit)) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    playerCache.set(digit, audio);
  }
  return playerCache.get(digit);
}

async function resolveAudioSource(digit) {
  if (sourceCache.has(digit)) return sourceCache.get(digit);
  for (const ext of EXTENSIONS) {
    const src = `./assets/audio/${digit}.${ext}`;
    if (await canLoad(src)) {
      sourceCache.set(digit, src);
      return src;
    }
  }
  sourceCache.set(digit, null);
  return null;
}

function canLoad(src) {
  return new Promise((resolve) => {
    const audio = new Audio();
    const clean = () => {
      audio.removeEventListener('canplaythrough', onReady);
      audio.removeEventListener('error', onError);
    };
    const onReady = () => { clean(); resolve(true); };
    const onError = () => { clean(); resolve(false); };
    audio.addEventListener('canplaythrough', onReady, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.src = src;
    audio.load();
  });
}

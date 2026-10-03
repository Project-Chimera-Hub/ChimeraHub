const SETTINGS_KEY = 'rel4_nback_settings_v2';
const HISTORY_KEY = 'rel4_nback_history_v2';

export function loadSettings(storage = globalThis.localStorage) {
  return readJson(storage, SETTINGS_KEY, null);
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  writeJson(storage, SETTINGS_KEY, settings);
}

export function loadHistory(storage = globalThis.localStorage) {
  return readJson(storage, HISTORY_KEY, []);
}

export function appendHistory(session, storage = globalThis.localStorage, limit = 50) {
  const history = loadHistory(storage);
  history.unshift(session);
  writeJson(storage, HISTORY_KEY, history.slice(0, limit));
}

export function clearHistory(storage = globalThis.localStorage) {
  writeJson(storage, HISTORY_KEY, []);
}

function readJson(storage, key, fallback) {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  if (!storage) return;
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ }
}

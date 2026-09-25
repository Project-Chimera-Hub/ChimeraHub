// LocalStorage manager for sessions, trials, and settings

const STORAGE_KEYS = {
  SESSIONS: 'nback_sessions',
  SETTINGS: 'nback_settings',
  ASSESSMENTS: 'nback_assessments',
};

export function getSessions() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
}

export function addSession(session) {
  const sessions = getSessions();
  const newSession = { id: Date.now().toString(), ...session, created_date: new Date().toISOString() };
  sessions.push(newSession);
  saveSessions(sessions);
  return newSession;
}

export function getSession(sessionId) {
  const sessions = getSessions();
  return sessions.find(s => s.id === sessionId);
}

export function updateSession(sessionId, updates) {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx !== -1) {
    sessions[idx] = { ...sessions[idx], ...updates };
    saveSessions(sessions);
  }
}

export function deleteSession(sessionId) {
  const sessions = getSessions().filter(s => s.id !== sessionId);
  saveSessions(sessions);
}

// ── Reasoning Snapshot assessments ──────────────────────────────────────────
export function getAssessments() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveAssessments(list) {
  localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(list));
}

export function addAssessment(record) {
  const list = getAssessments();
  const entry = { id: Date.now().toString(), ...record, created_date: new Date().toISOString() };
  list.push(entry);
  saveAssessments(list);
  return entry;
}

export function getSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function exportData() {
  const sessions = getSessions();
  const settings = getSettings();
  const assessments = getAssessments();
  return { sessions, settings, assessments, exportDate: new Date().toISOString() };
}

export function importData(data) {
  if (!data || !data.sessions || !Array.isArray(data.sessions)) {
    throw new Error('Invalid import data format');
  }
  saveSessions(data.sessions);
  if (data.settings) saveSettings(data.settings);
  if (Array.isArray(data.assessments)) saveAssessments(data.assessments);
}
import { createTrialSequence, normalizeConfig, shapeIdsFromConfig } from './trialGenerator.js';
import { createScoreboard, scoreTrial, summarizeScoreboard, STREAMS } from './session.js';
import { render2DGrid, renderSoloStage, draw3DStimulus, hasVisualStream } from './renderers.js';
import { playDigit, preloadDigitAudio, stopDigitAudio, availableDigitCount } from './audio.js';
import { renderWiki, renderRelationSheet } from './wiki.js';
import { loadSettings, saveSettings, loadHistory, appendHistory, clearHistory } from './storage.js';
import {
  DEFAULT_SHAPE_POOL,
  DEFAULT_STREAMS,
  LIMITS,
  RELATION_PROMPT_LABELS,
} from './constants.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const views = Object.fromEntries($$('.view').map((view) => [view.dataset.view, view]));
const grid2d = $('#grid-2d');
const cube = $('#cube-3d');
const soloStage = $('#solo-stage');
const relationSheet = $('#relation-sheet');

let state = null;
let lastConfig = null;
let advanceTimer = null;
let hideTimer = null;
let verdictTimer = null;
let animationFrame = null;
let rotationClock = 0;
let rotationTick = 0;

const defaults = normalizeConfig({
  n: 2, trials: 30, mode: '2d', intervalMs: 2500, visibleMs: 900, targetRate: 0.35,
  maxOffset: 4, feedback: true, streams: DEFAULT_STREAMS, variableN: false,
  variableFloor: 1, enabledShapes: DEFAULT_SHAPE_POOL,
});
lastConfig = normalizeConfig({ ...defaults, ...(loadSettings() || {}) });
applySettings(lastConfig);
renderWiki($('#wiki-content'));
renderRelationSheet($('#relation-sheet-body'));
renderHistory();
refreshVariableFloorUI();
wireShapePoolGuards();
preloadDigitAudio().then(reportAudioAvailability).catch(() => {});

$$('[data-nav]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.nav)));
$('#setup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  startSession(readSettings());
});
$('#quit-session').addEventListener('click', () => finishSession(true));
$('#pause-session').addEventListener('click', () => togglePause());
$('#relation-help').addEventListener('click', () => openRelationSheet());
$('#close-relation-sheet').addEventListener('click', () => closeRelationSheet());
relationSheet.addEventListener('click', (event) => { if (event.target === relationSheet) closeRelationSheet(); });
$('#again-btn').addEventListener('click', () => startSession(state?.config || lastConfig));
$('#clear-history').addEventListener('click', () => { clearHistory(); renderHistory(); });
$$('.response-btn').forEach((button) => button.addEventListener('click', () => toggleResponse(button.dataset.stream)));
$('#variable-n').addEventListener('change', refreshVariableFloorUI);
$('#n-level').addEventListener('input', syncVariableFloorBounds);

window.addEventListener('keydown', (event) => {
  if (!relationSheet.hidden) {
    if (event.key === 'Escape' || event.key.toLowerCase() === 'h') { event.preventDefault(); closeRelationSheet(); }
    return;
  }
  if (!views.game.classList.contains('active') || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (event.key === ' ' || key === 'spacebar') { event.preventDefault(); togglePause(); return; }
  if (key === 'h') { event.preventDefault(); openRelationSheet(); return; }
  if (state?.paused) return;
  const stream = { a: 'position', s: 'sound', d: 'shape', f: 'relation' }[key];
  if (stream && state?.config.streams?.[stream]) { event.preventDefault(); toggleResponse(stream); }
});
window.addEventListener('resize', () => renderStimulus(state?.visible ?? false));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state?.running && !state.paused) togglePause(true);
});

function navigate(name) {
  if (name !== 'game' && state?.running) { stopTimers(); state.running = false; }
  Object.entries(views).forEach(([key, view]) => view.classList.toggle('active', key === name));
  $$('.nav-btn').forEach((button) => button.classList.toggle('active', button.dataset.nav === name));
  document.body.classList.toggle('in-game', name === 'game');
  if (name !== 'game') closeRelationSheet();
  window.scrollTo(0, 0);
  if (name === 'history') renderHistory();
}

function readSettings() {
  const base = normalizeConfig({
    mode: $('input[name="mode"]:checked').value,
    n: clampInt($('#n-level').value, LIMITS.n.min, LIMITS.n.max),
    trials: clampInt($('#trial-count').value, LIMITS.trials.min, LIMITS.trials.max),
    intervalMs: clampInt($('#trial-interval').value, LIMITS.intervalMs.min, LIMITS.intervalMs.max),
    visibleMs: clampInt($('#visible-duration').value, LIMITS.visibleMs.min, LIMITS.visibleMs.max),
    targetRate: clampInt($('#target-rate').value, LIMITS.targetRatePct.min, LIMITS.targetRatePct.max) / 100,
    maxOffset: clampInt($('#max-offset').value, LIMITS.maxOffset.min, LIMITS.maxOffset.max),
    feedback: $('#feedback-enabled').checked,
    variableN: $('#variable-n').checked,
    variableFloor: clampInt($('#variable-floor').value, 1, clampInt($('#n-level').value, LIMITS.n.min, LIMITS.n.max)),
    streams: {
      position: $('#stream-position').checked,
      sound: $('#stream-sound').checked,
      shape: $('#stream-shape').checked,
      relation: $('#stream-relation').checked,
    },
    enabledShapes: {
      CIRCLE: $('#shape-circle').checked,
      TRIANGLE: $('#shape-triangle').checked,
      SQUARE: $('#shape-square').checked,
      PENTAGON: $('#shape-pentagon').checked,
      HEXAGON: $('#shape-hexagon').checked,
    },
  });
  if (!Object.values(base.streams).some(Boolean)) base.streams.position = true;
  if (shapeIdsFromConfig(base.enabledShapes).length < 2) {
    base.enabledShapes = { ...DEFAULT_SHAPE_POOL };
    applyShapePool(base.enabledShapes);
  }
  return base;
}

function applySettings(config) {
  const normalized = normalizeConfig(config);
  $(`input[name="mode"][value="${normalized.mode}"]`).checked = true;
  $('#n-level').value = normalized.n;
  $('#trial-count').value = normalized.trials;
  $('#trial-interval').value = normalized.intervalMs;
  $('#visible-duration').value = normalized.visibleMs;
  $('#target-rate').value = Math.round(normalized.targetRate * 100);
  $('#max-offset').value = normalized.maxOffset;
  $('#feedback-enabled').checked = normalized.feedback;
  $('#variable-n').checked = normalized.variableN;
  $('#variable-floor').value = normalized.variableFloor;
  $('#variable-floor').max = normalized.n;
  $('#stream-position').checked = normalized.streams.position;
  $('#stream-sound').checked = normalized.streams.sound;
  $('#stream-shape').checked = normalized.streams.shape;
  $('#stream-relation').checked = normalized.streams.relation;
  applyShapePool(normalized.enabledShapes);
  refreshVariableFloorUI();
}

function startSession(config) {
  stopTimers();
  const normalized = normalizeConfig(config);
  lastConfig = normalized;
  saveSettings(normalized);
  const activeStreams = STREAMS.filter((stream) => normalized.streams[stream]);
  state = {
    config: normalized,
    sequence: createTrialSequence(normalized),
    index: 0,
    responses: emptyResponses(),
    scoreboard: createScoreboard(activeStreams),
    activeStreams,
    running: true,
    paused: false,
    visible: true,
    trialStartedAt: 0,
    remainingMs: null,
    startedAt: Date.now(),
  };
  navigate('game');
  $('#mode-label').textContent = modeName(normalized.mode);
  $('#pause-overlay').hidden = true;
  $('#pause-session').textContent = 'PAUSE';
  clearVerdicts();
  syncStageVisibility();
  syncVisibleResponseCards();
  rotationClock = 0;
  rotationTick = performance.now();
  presentTrial();
  animateCube();
}

/** Only ever shows the surface that the enabled streams actually need. */
function syncStageVisibility() {
  const { mode, streams } = state.config;
  const use3d = streams.position && mode !== '2d';
  const use2d = streams.position && mode === '2d';
  cube.style.display = use3d ? 'block' : 'none';
  grid2d.style.display = use2d ? 'grid' : 'none';
  soloStage.style.display = streams.position ? 'none' : 'grid';
  if (!streams.position) grid2d.innerHTML = '';
}

function presentTrial() {
  if (!state?.running || state.paused) return;
  state.responses = emptyResponses();
  state.visible = true;
  state.trialStartedAt = performance.now();
  state.remainingMs = null;
  updateButtons();
  updateTrialHeader();
  renderPrompts();
  renderStimulus(true);
  if (state.config.streams.sound) playDigit(currentTrial().number, true);
  scheduleTrialTimers(state.config.intervalMs, state.config.visibleMs);
}

function scheduleTrialTimers(remainingMs, visibleRemainingMs) {
  clearTimeout(hideTimer);
  clearTimeout(advanceTimer);
  const hideAfter = Math.max(0, Math.min(visibleRemainingMs, remainingMs - 100));
  if (state.visible) {
    hideTimer = setTimeout(() => {
      if (state?.running && !state.paused) {
        state.visible = false;
        renderStimulus(false);
      }
    }, hideAfter);
  }
  advanceTimer = setTimeout(advanceTrial, remainingMs);
}

function advanceTrial() {
  if (!state?.running || state.paused) return;
  finalizeCurrent();
  if (state.index >= state.sequence.length - 1) { finishSession(false); return; }
  state.index += 1;
  presentTrial();
}

function finalizeCurrent() {
  const trial = currentTrial();
  if (!trial.scored) return;
  const verdicts = scoreTrial(state.scoreboard, trial.targets, state.responses, trial.lures, state.activeStreams);
  if (state.config.feedback) showVerdicts(verdicts);
}

function toggleResponse(stream) {
  if (!state?.running || state.paused || !currentTrial().scored || !state.config.streams[stream]) return;
  state.responses[stream] = !state.responses[stream];
  updateResponseButton(stream);
}

/**
 * Only touches the pressed state. Verdict colours are owned by showVerdicts and
 * its own timer, so per-trial feedback stays on screen into the next trial
 * instead of being wiped the instant the next stimulus is drawn.
 */
function updateResponseButton(stream) {
  const button = $(`.response-btn[data-stream="${stream}"]`);
  if (button) button.classList.toggle('pressed', Boolean(state?.responses[stream]));
}

function updateButtons() {
  STREAMS.forEach(updateResponseButton);
}

function renderPrompts() {
  const trial = currentTrial();
  const { streams } = state.config;
  if (streams.position) $('#prompt-position').textContent = formatPosition(trial.prompts.position);
  if (streams.sound) $('#prompt-sound').textContent = formatNumericPrompt(trial.prompts.sound);
  if (streams.shape) $('#prompt-shape').textContent = formatShapePrompt(trial.prompts.shape);
  if (streams.relation) $('#prompt-relation').textContent = RELATION_PROMPT_LABELS[trial.prompts.relation] || trial.prompts.relation;
}

function renderStimulus(visible) {
  if (!state?.running) return;
  const trial = currentTrial();
  const { streams, mode } = state.config;
  if (!streams.position) { renderSoloStage(soloStage, trial, visible, streams); return; }
  if (mode === '2d') render2DGrid(grid2d, trial, visible, streams);
  else draw3DStimulus(cube, trial, { yaw: mode === '3d-static' ? 0.72 : getRotation(), pitch: -0.43, visible, streams });
}

function animateCube() {
  cancelAnimationFrame(animationFrame);
  const loop = () => {
    if (state?.running) {
      const now = performance.now();
      if (!state.paused) rotationClock += now - rotationTick;
      rotationTick = now;
      if (!state.paused && state.config.mode === '3d-rotating' && state.config.streams.position) {
        draw3DStimulus(cube, currentTrial(), { yaw: getRotation(), pitch: -0.43, visible: state.visible, streams: state.config.streams });
      }
      animationFrame = requestAnimationFrame(loop);
    }
  };
  animationFrame = requestAnimationFrame(loop);
}
function getRotation() { return 0.45 + rotationClock / 4200; }

function updateTrialHeader() {
  const trial = currentTrial();
  const scoredNumber = Math.max(0, state.index - state.config.n + 1);
  $('#trial-label').textContent = trial.scored
    ? `TRIAL ${scoredNumber} / ${state.config.trials}`
    : `WARM-UP ${state.index + 1} / ${state.config.n}`;
  $('#n-label').textContent = state.config.variableN ? `${trial.nBack}-BACK · VAR` : `${state.config.n}-BACK`;
  $('#trial-n-display').textContent = trial.scored ? `N = ${trial.nBack}` : `WARM-UP · N = ${trial.nBack}`;
  $('#hud-rule').textContent = trial.scored
    ? `Does the stimulus ${trial.nBack} back match prompt(current)?`
    : `Memorise only — scoring starts at trial 1`;
  $('.game-hud').classList.toggle('warmup', !trial.scored);
  $('#response-deck').classList.toggle('warmup', !trial.scored);
  $('#progress-fill').style.width = `${Math.min(100, (scoredNumber / state.config.trials) * 100)}%`;
  $('#game-status').textContent = `${$('#trial-label').textContent}, N ${trial.nBack}`;
}

function showVerdicts(verdicts) {
  clearTimeout(verdictTimer);
  STREAMS.forEach((stream) => {
    const el = $(`#verdict-${stream}`);
    const button = $(`.response-btn[data-stream="${stream}"]`);
    if (!el || !button) return;
    const verdict = verdicts[stream];
    if (verdict === 'INACTIVE') { el.textContent = ''; el.className = 'verdict'; return; }
    el.textContent = verdict.replaceAll('_', ' ');
    const good = verdict === 'HIT' || verdict === 'CORRECT_REJECTION';
    const warn = verdict === 'MISS';
    el.className = `verdict ${good ? 'good' : warn ? 'warn' : 'bad'}`;
    button.classList.remove('pressed');
    button.classList.toggle('hit', verdict === 'HIT');
    button.classList.toggle('miss', verdict === 'MISS');
    button.classList.toggle('false-alarm', verdict === 'FALSE_ALARM');
    button.classList.toggle('correct-rejection', verdict === 'CORRECT_REJECTION');
  });
  const hold = Math.max(320, Math.min(750, (state?.config.intervalMs ?? 2500) * 0.35));
  verdictTimer = setTimeout(() => { clearVerdicts(); updateButtons(); }, hold);
}

function clearVerdicts() {
  clearTimeout(verdictTimer);
  STREAMS.forEach((stream) => {
    const el = $(`#verdict-${stream}`);
    const button = $(`.response-btn[data-stream="${stream}"]`);
    if (el) { el.textContent = ''; el.className = 'verdict'; }
    if (button) button.classList.remove('hit', 'miss', 'false-alarm', 'correct-rejection');
  });
}

function togglePause(forcePause = false) {
  if (!state?.running) return;
  const shouldPause = forcePause ? true : !state.paused;
  if (shouldPause === state.paused) return;
  state.paused = shouldPause;
  $('#pause-overlay').hidden = !state.paused;
  $('#pause-session').textContent = state.paused ? 'RESUME' : 'PAUSE';
  if (state.paused) {
    clearTimeout(advanceTimer);
    clearTimeout(hideTimer);
    stopDigitAudio();
    const elapsed = performance.now() - state.trialStartedAt;
    state.remainingMs = Math.max(150, state.config.intervalMs - elapsed);
    state.visibleRemainingMs = Math.max(0, state.config.visibleMs - elapsed);
  } else {
    // Resume the same trial where it left off; no free re-run of the stimulus.
    state.trialStartedAt = performance.now() - (state.config.intervalMs - (state.remainingMs ?? state.config.intervalMs));
    rotationTick = performance.now();
    scheduleTrialTimers(state.remainingMs ?? state.config.intervalMs, state.visibleRemainingMs ?? 0);
  }
}

function finishSession(aborted) {
  if (!state) { navigate('setup'); return; }
  stopTimers();
  state.running = false;
  if (aborted) { navigate('setup'); return; }
  const summary = summarizeScoreboard(state.scoreboard, state.activeStreams);
  appendHistory({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    mode: state.config.mode,
    n: state.config.n,
    variableN: state.config.variableN,
    variableFloor: state.config.variableFloor,
    trials: state.config.trials,
    durationSec: Math.round((Date.now() - state.startedAt) / 1000),
    combinedAccuracy: summary.combinedAccuracy,
    streams: Object.fromEntries(state.activeStreams.map((s) => [s, summary.streams[s].accuracy])),
  });
  renderResults(summary);
  renderHistory();
  navigate('results');
}

function stopTimers() {
  clearTimeout(advanceTimer);
  clearTimeout(hideTimer);
  clearTimeout(verdictTimer);
  cancelAnimationFrame(animationFrame);
  stopDigitAudio();
}

function renderResults(summary) {
  $('#combined-score').textContent = `${summary.combinedAccuracy}%`;
  $('#result-streams').innerHTML = state.activeStreams.map((stream) => {
    const s = summary.streams[stream];
    return `<div class="result-card"><span>${stream.toUpperCase()}</span><strong>${s.accuracy}%</strong><small>${s.hit}/${s.hit + s.miss} hits · ${s.falseAlarm} false alarms</small></div>`;
  }).join('');
}

function renderHistory() {
  const history = loadHistory();
  $('#history-content').innerHTML = history.length
    ? `<div class="history-list">${history.map((item) => `<article class="history-item"><div><b>${modeName(item.mode)} · ${item.variableN ? `VAR ${item.variableFloor}-${item.n}` : `${item.n}-BACK`}</b><br><small>${new Date(item.date).toLocaleString()} · ${item.trials} trials</small></div><strong>${item.combinedAccuracy}%</strong><div class="history-streams">${Object.entries(item.streams).map(([s, accuracy]) => `<span>${s[0].toUpperCase()} ${accuracy}%</span>`).join('')}</div></article>`).join('')}</div>`
    : '<div class="empty-state">No completed sessions yet.</div>';
}

function openRelationSheet() {
  if (state?.running && !state.paused) togglePause(true);
  relationSheet.hidden = false;
  $('#close-relation-sheet').focus();
}

function closeRelationSheet() {
  relationSheet.hidden = true;
}

function reportAudioAvailability() {
  const available = availableDigitCount();
  const warning = $('#audio-warning');
  if (available === 8) { warning.hidden = true; return; }
  warning.hidden = false;
  warning.textContent = available === 0
    ? 'No digit audio found in assets/audio. The Sound stream will be silent until 1–8 clips are added.'
    : `Only ${available} of 8 digit clips were found in assets/audio. The Sound stream will be incomplete.`;
}

function currentTrial() { return state.sequence[state.index]; }
function emptyResponses() { return { position: false, sound: false, shape: false, relation: false }; }
function clampInt(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : min));
}
function modeName(mode) { return mode === '2d' ? '2D' : mode === '3d-static' ? '3D STATIC' : '3D ROTATING'; }
function formatPosition(prompt) { return ({ NORTH: 'NORTH ↑', SOUTH: 'SOUTH ↓', EAST: 'EAST →', WEST: 'WEST ←', ROW: 'ROW', COLUMN: 'COLUMN', ABOVE: 'ABOVE', BELOW: 'BELOW' })[prompt] || prompt; }
function formatNumericPrompt(prompt) { if (prompt.type === 'BEFORE') return 'BEFORE'; if (prompt.type === 'AFTER') return 'AFTER'; return `${prompt.delta >= 0 ? '+' : ''}${prompt.delta}`; }
function formatShapePrompt(prompt) { if (prompt.type === 'FEWER') return 'FEWER SIDES'; if (prompt.type === 'MORE') return 'MORE SIDES'; return `${prompt.delta >= 0 ? '+' : ''}${prompt.delta} SIDES`; }

function syncVisibleResponseCards() {
  STREAMS.forEach((stream) => {
    const card = $(`.response-card[data-card="${stream}"]`);
    card?.classList.toggle('hidden', !state.config.streams[stream]);
  });
  const active = state.activeStreams.length;
  $('#response-deck').style.gridTemplateColumns = `repeat(${Math.max(1, active)}, minmax(0, 1fr))`;
}

function syncVariableFloorBounds() {
  const n = clampInt($('#n-level').value, LIMITS.n.min, LIMITS.n.max);
  $('#variable-floor').max = n;
  if (clampInt($('#variable-floor').value, 1, LIMITS.n.max) > n) $('#variable-floor').value = n;
}

function refreshVariableFloorUI() {
  $('#variable-floor-row').hidden = !$('#variable-n').checked;
  syncVariableFloorBounds();
}

function applyShapePool(pool) {
  $('#shape-circle').checked = pool.CIRCLE !== false;
  $('#shape-triangle').checked = pool.TRIANGLE !== false;
  $('#shape-square').checked = pool.SQUARE !== false;
  $('#shape-pentagon').checked = pool.PENTAGON !== false;
  $('#shape-hexagon').checked = pool.HEXAGON !== false;
}

function wireShapePoolGuards() {
  $$('.shape-toggle input').forEach((input) => input.addEventListener('change', () => {
    if (currentShapeSelectionCount() >= 2) return;
    input.checked = true;
  }));
  $$('.stream-toggle input').forEach((input) => input.addEventListener('change', () => {
    if (currentStreamSelectionCount() >= 1) return;
    input.checked = true;
  }));
}

function currentShapeSelectionCount() {
  return ['#shape-circle', '#shape-triangle', '#shape-square', '#shape-pentagon', '#shape-hexagon'].filter((selector) => $(selector).checked).length;
}

function currentStreamSelectionCount() {
  return ['#stream-position', '#stream-sound', '#stream-shape', '#stream-relation'].filter((selector) => $(selector).checked).length;
}

export { hasVisualStream };

import {
  createGameState,
  generateNextStimulus,
  advanceRound,
  processResponses,
  calculateResults,
} from '@/lib/gameEngine';
import {
  RELATIONSHIP_CATEGORIES,
  filterTransitiveRelationships,
  setTokenWeights,
  getTokenWeights,
} from '@/lib/gameConstants';

const ALL_RELATIONSHIPS = Object.values(RELATIONSHIP_CATEGORIES).flat();
const RINT_POOL = filterTransitiveRelationships(ALL_RELATIONSHIPS, true, false);

const MODE_CASES = [
  { label: 'Normal', modes: [] },
  { label: 'Alien Cube', modes: ['alien_cube'] },
  { label: 'Alien Cube + Type', modes: ['alien_cube', 'type_nback'] },
  { label: 'Alien Cube + Binary', modes: ['alien_cube', 'binary_logic'], minN: 2, needsRintPool: true },
  { label: 'Alien Square', modes: ['alien_square'] },
  { label: 'Alien Square + Type', modes: ['alien_square', 'type_nback'] },
  { label: 'Alien Tesseract', modes: ['alien_tesseract'] },
  { label: 'Alien Tesseract + Type', modes: ['alien_tesseract', 'type_nback'] },
  { label: 'Type N-Back', modes: ['type_nback'] },
  { label: 'RINT', modes: ['rint'], minN: 2, needsRintPool: true },
  { label: 'Mixed N-Back', modes: ['mixed_nback'] },
  { label: 'Mixed RINT', modes: ['mixed_rint'], minN: 2, needsRintPool: true },
  { label: 'Impossible', modes: ['impossible'], minN: 2, minStreams: 2, needsRintPool: true },
  { label: 'Binary Logic', modes: ['binary_logic'], minN: 2, needsRintPool: true },
  { label: 'Variable N', modes: ['variable_n'] },
  { label: 'Adaptive', modes: ['adaptive'] },
  { label: 'Distractors', modes: ['distractors'] },
  { label: 'Type + Adaptive + Distractors', modes: ['type_nback', 'adaptive', 'distractors'] },
  { label: 'Variable + Adaptive + Distractors', modes: ['variable_n', 'adaptive', 'distractors'] },
  { label: 'Binary + Adaptive + Distractors', modes: ['binary_logic', 'adaptive', 'distractors'], minN: 2, needsRintPool: true },
];

const CATEGORY_POOL_CASES = Object.entries(RELATIONSHIP_CATEGORIES).map(([category, pool]) => ({
  label: category.replace(/_/g, ' '),
  pool,
  rintPool: filterTransitiveRelationships(pool, true, false),
}));

const STIMULUS_MIX_CASES = [
  { label: 'All equal', pool: ALL_RELATIONSHIPS },
  { label: 'Spatial heavy', pool: buildWeightedPool({ SPATIAL: 70, SPATIAL_3D: 20, TRAIT: 5, QUANT: 5, VERBAL: 0 }) },
  { label: 'Visual heavy', pool: buildWeightedPool({ SPATIAL: 30, SPATIAL_3D: 30, TRAIT: 30, QUANT: 10, VERBAL: 0 }) },
  { label: 'Verbal heavy', pool: buildWeightedPool({ SPATIAL: 5, SPATIAL_3D: 5, TRAIT: 5, QUANT: 5, VERBAL: 80 }) },
  { label: 'RINT-safe', pool: RINT_POOL.length ? RINT_POOL : ALL_RELATIONSHIPS, rintPool: RINT_POOL.length ? RINT_POOL : ALL_RELATIONSHIPS },
];

const TOKEN_STYLE_CASES = [
  { label: 'Default tokens', weights: null },
  { label: 'Words only', weights: { meaningful: 100, nonsense: 0, garbage: 0, emoji: 0, voronoi_emoji: 0, random_string: 0, voronoi: 0 } },
  { label: 'Nonsense only', weights: { meaningful: 0, nonsense: 100, garbage: 0, emoji: 0, voronoi_emoji: 0, random_string: 0, voronoi: 0 } },
  { label: 'Garbage only', weights: { meaningful: 0, nonsense: 0, garbage: 100, emoji: 0, voronoi_emoji: 0, random_string: 0, voronoi: 0 } },
  { label: 'Emoji only', weights: { meaningful: 0, nonsense: 0, garbage: 0, emoji: 100, voronoi_emoji: 0, random_string: 0, voronoi: 0 } },
  { label: 'Abstract only', weights: { meaningful: 0, nonsense: 0, garbage: 0, emoji: 0, voronoi_emoji: 100, random_string: 0, voronoi: 0 } },
  { label: 'Random strings only', weights: { meaningful: 0, nonsense: 0, garbage: 0, emoji: 0, voronoi_emoji: 0, random_string: 100, voronoi: 0 } },
  { label: 'Voronoi only', weights: { meaningful: 0, nonsense: 0, garbage: 0, emoji: 0, voronoi_emoji: 0, random_string: 0, voronoi: 100 } },
  { label: 'Balanced token mix', weights: { meaningful: 15, nonsense: 15, garbage: 15, emoji: 15, voronoi_emoji: 15, random_string: 15, voronoi: 10 } },
];

const N_LEVELS = [1, 2, 3, 5, 8];
const ROUND_COUNTS = [1, 2, 5, 20, 50];
const STREAM_COUNTS = [1, 2, 3, 5, 9];
const NOOB_MODE_CASES = [false, true];

function buildWeightedPool(weights) {
  const pool = [];
  Object.entries(weights).forEach(([category, weight]) => {
    const rels = RELATIONSHIP_CATEGORIES[category] || [];
    for (let i = 0; i < Math.max(0, weight); i += 1) pool.push(...rels);
  });
  return pool.length ? pool : ALL_RELATIONSHIPS;
}

function makeExtraStreams(streamCount) {
  return Array.from({ length: Math.max(0, streamCount - 1) }, (_, i) => ({
    key: `Key${String.fromCharCode(65 + i)}`,
    keyDisplay: String.fromCharCode(66 + i),
    label: String.fromCharCode(66 + i),
  }));
}

function cloneState(state) {
  return structuredClone(state);
}

function makeHistoricalSnapshot(state) {
  return {
    ...cloneState(state),
    respondedA: false,
    extraResponded: Array(state.numExtraStreams || 0).fill(false),
    hitsA: 0,
    missesA: 0,
    falseAlarmsA: 0,
    correctRejectionsA: 0,
    extraHits: Array(state.numExtraStreams || 0).fill(0),
    extraMisses: Array(state.numExtraStreams || 0).fill(0),
    extraFalseAlarms: Array(state.numExtraStreams || 0).fill(0),
    extraCorrectRejections: Array(state.numExtraStreams || 0).fill(0),
    scoredTrialKeys: [],
    allTrials: [],
  };
}

function applyTokenStyle(tokenCase) {
  const defaults = getTokenWeights();
  setTokenWeights(tokenCase.weights ? { ...defaults, ...tokenCase.weights } : defaults);
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function assertFiniteNumber(value, label) {
  assertCondition(Number.isFinite(value), `${label} must be a finite number`);
}

function assertStateInvariants(state, expectedStreams, expectedRound) {
  assertCondition(state.round === expectedRound, `round mismatch: expected ${expectedRound}, got ${state.round}`);
  assertCondition(!!state.currentStimulusA, 'Stream A stimulus missing');
  assertCondition(typeof state.currentRelationship === 'string', 'Stream A relationship missing');
  assertCondition((state.extraCurrentStimuli || []).length === expectedStreams - 1, 'extra stimuli length mismatch');
  assertCondition((state.extraIsTargets || []).length === expectedStreams - 1, 'extra target flags length mismatch');
  assertCondition((state.extraResponded || []).length === expectedStreams - 1, 'extra response length mismatch');
  assertCondition((state.trialBinaryConfigs || []).length === expectedStreams, 'binary config length mismatch');
}

function assertCubePosition(position, label) {
  assertCondition(!!position, `${label} cube position missing`);
  ['x', 'y', 'z'].forEach(axis => {
    assertCondition(Number.isInteger(position[axis]), `${label} cube ${axis} coordinate must be an integer`);
    assertCondition(position[axis] >= -1 && position[axis] <= 1, `${label} cube ${axis} coordinate out of range`);
  });
}

function assertSquarePosition(position, label) {
  assertCondition(!!position, `${label} square position missing`);
  ['x', 'y'].forEach(axis => {
    assertCondition(Number.isInteger(position[axis]), `${label} square ${axis} coordinate must be an integer`);
    assertCondition(position[axis] >= -1 && position[axis] <= 1, `${label} square ${axis} coordinate out of range`);
  });
}

function assertTesseractPosition(position, label) {
  assertCondition(!!position, `${label} tesseract position missing`);
  ['x', 'y', 'z', 'w'].forEach(axis => {
    assertCondition(Number.isInteger(position[axis]), `${label} tesseract ${axis} coordinate must be an integer`);
    assertCondition(position[axis] >= -1 && position[axis] <= 1, `${label} tesseract ${axis} coordinate out of range`);
  });
}

function assertAlienState(state) {
  const isSquare = state.modes?.includes('alien_square');
  const isTesseract = state.modes?.includes('alien_tesseract');
  if (isSquare) assertSquarePosition(state.currentStimulusA?.squarePosition, 'Stream A');
  else if (isTesseract) assertTesseractPosition(state.currentStimulusA?.tesseractPosition, 'Stream A');
  else assertCubePosition(state.currentStimulusA?.cubePosition, 'Stream A');
  (state.extraCurrentStimuli || []).forEach((stimulus, index) => {
    if (isSquare) assertSquarePosition(stimulus?.squarePosition, `Stream ${String.fromCharCode(66 + index)}`);
    else if (isTesseract) assertTesseractPosition(stimulus?.tesseractPosition, `Stream ${String.fromCharCode(66 + index)}`);
    else assertCubePosition(stimulus?.cubePosition, `Stream ${String.fromCharCode(66 + index)}`);
  });
}

function assertTrialShape(trial) {
  assertCondition(Number.isFinite(trial.trialNumber), 'trial number missing');
  assertCondition(typeof trial.streamLabel === 'string', 'stream label missing');
  assertCondition(typeof trial.relationship === 'string', 'trial relationship missing');
  assertCondition(typeof trial.isTarget === 'boolean', 'trial target flag missing');
  assertCondition(typeof trial.userResponded === 'boolean', 'trial response flag missing');
  assertCondition(typeof trial.correct === 'boolean', 'trial correctness flag missing');
  assertCondition(Number.isFinite(trial.nBackValue), 'trial N value missing');
}

function assertScoredInvariants(state, expectedStreams, expectedRound) {
  const recordMultiplier = state.modes?.includes('alien_cube') || state.modes?.includes('alien_square') || state.modes?.includes('alien_tesseract') ? 2 : 1;
  const expectedTrialRecords = expectedRound * expectedStreams * recordMultiplier;
  const scoredKeys = state.scoredTrialKeys || [];
  const uniqueKeys = new Set(scoredKeys);
  const results = calculateResults(state);

  assertCondition(scoredKeys.length === uniqueKeys.size, 'duplicate scored trial key detected');
  assertCondition((state.allTrials || []).length === expectedTrialRecords, `trial record count mismatch: expected ${expectedTrialRecords}, got ${(state.allTrials || []).length}`);
  state.allTrials.forEach(assertTrialShape);
  assertCondition(results.overall.total === expectedTrialRecords, `overall total mismatch: expected ${expectedTrialRecords}, got ${results.overall.total}`);
  assertFiniteNumber(results.overall.accuracy, 'overall accuracy');
  assertFiniteNumber(results.overall.hitRate, 'overall hit rate');
  assertFiniteNumber(results.overall.falseAlarmRate, 'overall false alarm rate');
}

function makeResponses(roundIndex, streamCount) {
  return {
    pressedA: roundIndex % 3 === 0,
    pressedExtra: Array.from({ length: streamCount - 1 }, (_, idx) => (roundIndex + idx) % 4 === 0),
    pressedPositionA: roundIndex % 4 === 0,
    pressedPositionExtra: Array.from({ length: streamCount - 1 }, (_, idx) => (roundIndex + idx) % 5 === 0),
  };
}

function assertDoubleScoringBlocked(state, streamCount, responses) {
  const beforeRecords = state.allTrials.length;
  const beforeKeys = state.scoredTrialKeys.length;
  const beforeTotal = calculateResults(state).overall.total;
  const rescored = processResponses(state, {
    pressedA: !responses.pressedA,
    pressedExtra: responses.pressedExtra.map(v => !v),
    pressedPositionA: !responses.pressedPositionA,
    pressedPositionExtra: (responses.pressedPositionExtra || []).map(v => !v),
  });
  assertCondition(rescored.allTrials.length === beforeRecords, 'double scoring changed trial records');
  assertCondition(rescored.scoredTrialKeys.length === beforeKeys, 'double scoring changed scored keys');
  assertCondition(calculateResults(rescored).overall.total === beforeTotal, 'double scoring changed totals');
  assertCondition((rescored.extraResponded || []).length === streamCount - 1, 'double scoring changed response shape');
  return rescored;
}

function simulateTimedCase(testCase) {
  const { nLevel, modes, pool, totalRounds, streamCount } = testCase;
  let state = createGameState({
    nLevel,
    modes,
    relationshipPool: pool,
    totalRounds,
    extraStreams: makeExtraStreams(streamCount),
  });

  for (let i = 0; i < totalRounds; i += 1) {
    const stimulus = generateNextStimulus(state);
    assertCondition(!!stimulus?.stimA, 'generated stimulus missing Stream A');
    assertCondition((stimulus.extraStimuli || []).length === streamCount - 1, 'generated extra stimulus length mismatch');

    state = advanceRound(state, stimulus);
    assertStateInvariants(state, streamCount, i + 1);
    if (modes.includes('alien_cube') || modes.includes('alien_square') || modes.includes('alien_tesseract')) assertAlienState(state);

    const responses = makeResponses(i, streamCount);
    state = processResponses(state, responses);
    assertScoredInvariants(state, streamCount, i + 1);
    state = assertDoubleScoringBlocked(state, streamCount, responses);
  }

  const results = calculateResults(state);
  const multiplier = modes.includes('alien_cube') || modes.includes('alien_square') || modes.includes('alien_tesseract') ? 2 : 1;
  assertCondition(results.overall.total === totalRounds * streamCount * multiplier, 'final result total mismatch');
  return results;
}

function simulateNoobCase(testCase) {
  const { nLevel, modes, pool, totalRounds, streamCount } = testCase;
  let progressState = createGameState({
    nLevel,
    modes,
    relationshipPool: pool,
    totalRounds,
    extraStreams: makeExtraStreams(streamCount),
  });
  const trialStates = [];

  for (let i = 0; i < totalRounds; i += 1) {
    const stimulus = generateNextStimulus(progressState);
    const activeState = advanceRound(progressState, stimulus);
    trialStates[activeState.round] = makeHistoricalSnapshot(activeState);
    assertStateInvariants(activeState, streamCount, i + 1);

    const responses = makeResponses(i, streamCount);
    progressState = processResponses(activeState, responses);
    assertScoredInvariants(progressState, streamCount, i + 1);
    progressState = assertDoubleScoringBlocked(progressState, streamCount, responses);

    if (i >= 1) {
      const historical = cloneState(trialStates[i]);
      assertStateInvariants(historical, streamCount, i);
      if (modes.includes('alien_cube') || modes.includes('alien_square') || modes.includes('alien_tesseract')) assertAlienState(historical);
      const editedHistorical = processResponses(historical, {
        pressedA: !responses.pressedA,
        pressedExtra: responses.pressedExtra.map(v => !v),
    pressedPositionA: !responses.pressedPositionA,
    pressedPositionExtra: (responses.pressedPositionExtra || []).map(v => !v),
      });
      assertCondition((editedHistorical.scoredTrialKeys || []).length === 1, 'historical replay should only score the replayed trial locally');
      assertScoredInvariants(progressState, streamCount, i + 1);
    }
  }

  const results = calculateResults(progressState);
  const multiplier = modes.includes('alien_cube') || modes.includes('alien_square') || modes.includes('alien_tesseract') ? 2 : 1;
  assertCondition(results.overall.total === totalRounds * streamCount * multiplier, 'Noob final result total mismatch');
  return results;
}

function getPoolForMode(poolCase, needsRintPool) {
  if (!needsRintPool) return poolCase.pool;
  const safePool = poolCase.rintPool || filterTransitiveRelationships(poolCase.pool, true, false);
  return safePool.length ? safePool : null;
}

function buildDiagnosticCases(maxCases) {
  const cases = [];
  const poolCases = [...CATEGORY_POOL_CASES, ...STIMULUS_MIX_CASES];
  const dimensions = [MODE_CASES, TOKEN_STYLE_CASES, NOOB_MODE_CASES, N_LEVELS, ROUND_COUNTS, STREAM_COUNTS, poolCases];
  const totalPossible = dimensions.reduce((total, values) => total * values.length, 1);
  const step = Math.max(1, Math.floor(totalPossible / maxCases));

  for (let flatIndex = 0; flatIndex < totalPossible && cases.length < maxCases; flatIndex += step) {
    let cursor = flatIndex;
    const modeCase = MODE_CASES[cursor % MODE_CASES.length]; cursor = Math.floor(cursor / MODE_CASES.length);
    const tokenCase = TOKEN_STYLE_CASES[cursor % TOKEN_STYLE_CASES.length]; cursor = Math.floor(cursor / TOKEN_STYLE_CASES.length);
    const noobMode = NOOB_MODE_CASES[cursor % NOOB_MODE_CASES.length]; cursor = Math.floor(cursor / NOOB_MODE_CASES.length);
    const nLevel = N_LEVELS[cursor % N_LEVELS.length]; cursor = Math.floor(cursor / N_LEVELS.length);
    const totalRounds = ROUND_COUNTS[cursor % ROUND_COUNTS.length]; cursor = Math.floor(cursor / ROUND_COUNTS.length);
    const streamCount = STREAM_COUNTS[cursor % STREAM_COUNTS.length]; cursor = Math.floor(cursor / STREAM_COUNTS.length);
    const poolCase = poolCases[cursor % poolCases.length];

    cases.push({ modeCase, tokenCase, noobMode, nLevel, totalRounds, streamCount, poolCase });
  }

  return cases;
}

export function runGameDiagnostics({ maxCases = 600 } = {}) {
  const startedAt = performance.now();
  const originalTokenWeights = getTokenWeights();
  const failures = [];
  const samples = [];
  const coverage = {
    relationTypes: new Set(),
    stimulusMixes: new Set(),
    tokenStyles: new Set(),
    streamCounts: new Set(),
    enhancementModes: new Set(),
    noobModes: new Set(),
  };
  let passed = 0;
  let skipped = 0;

  try {
    buildDiagnosticCases(maxCases).forEach(({ modeCase, tokenCase, noobMode, nLevel, totalRounds, streamCount, poolCase }) => {
      if (modeCase.minN && nLevel < modeCase.minN) { skipped += 1; return; }
      if (modeCase.minStreams && streamCount < modeCase.minStreams) { skipped += 1; return; }
      const pool = getPoolForMode(poolCase, modeCase.needsRintPool);
      if (!pool || pool.length === 0) { skipped += 1; return; }

      applyTokenStyle(tokenCase);
      const testCase = {
        label: `${noobMode ? 'Noob' : 'Timed'} · ${modeCase.label} · ${tokenCase.label} · N=${nLevel} · ${streamCount} stream(s) · ${totalRounds} rounds · ${poolCase.label}`,
        nLevel,
        modes: modeCase.modes,
        pool,
        totalRounds,
        streamCount,
      };

      try {
        const results = noobMode ? simulateNoobCase(testCase) : simulateTimedCase(testCase);
        passed += 1;
        coverage.relationTypes.add(poolCase.label);
        coverage.stimulusMixes.add(poolCase.label);
        coverage.tokenStyles.add(tokenCase.label);
        coverage.streamCounts.add(String(streamCount));
        coverage.enhancementModes.add(modeCase.label);
        coverage.noobModes.add(noobMode ? 'Noob Mode' : 'Timed Mode');
        if (samples.length < 8) {
          samples.push({ label: testCase.label, accuracy: results.overall.accuracy, total: results.overall.total });
        }
      } catch (error) {
        failures.push({ label: testCase.label, message: error.message });
      }
    });
  } finally {
    setTokenWeights(originalTokenWeights);
  }

  const durationMs = Math.round(performance.now() - startedAt);
  return {
    status: failures.length === 0 ? 'passed' : 'failed',
    passed,
    failed: failures.length,
    skipped,
    totalRun: passed + failures.length,
    durationMs,
    failures,
    samples,
    coverage: {
      relationTypes: [...coverage.relationTypes],
      stimulusMixes: [...coverage.stimulusMixes],
      tokenStyles: [...coverage.tokenStyles],
      streamCounts: [...coverage.streamCounts],
      enhancementModes: [...coverage.enhancementModes],
      noobModes: [...coverage.noobModes],
    },
  };
}
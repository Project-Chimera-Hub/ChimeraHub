import {
  RELATIONSHIPS as ALL_RELATIONSHIPS,
  RELATIONSHIP_CATEGORIES,
  SHAPES,
  COLORS,
  MATCH_CHANCE,
  DUAL_MATCH_CHANCE,
  HIER_MATCH_CHANCE,
  DISTRACTOR_CHANCE,
  LURE_RATE,
  NEGATION_RATE,
  RST_OVERLAY_RATE,
  TOTAL_ROUNDS,
  getCategory,
  pickRandom,
  pickRandomExcluding,
  isVerbal,
  isSound,
  getVerbalPair,
  getSoundPair,
  pickTokenType,
  pickTokenWord,
  makeInverseStimulus,
  INVERSE_RELATIONSHIP,
  filterTransitiveRelationships,
  AVAILABLE_THEMES,
  getTokenWeights,
  LANDSCAPE_PATHS,
  getRelationFormClass,
  relationsAreAnalogous,
  TJN_NODE_REL,
  TJN_LEARN_TRIALS,
  TJN_DEFAULT_NODES,
  TJN_DEFAULT_TOPOLOGY,
  TJN_DEFAULT_TIER,
  TJN_HARD_K,
} from './gameConstants';
import { createRSTChain, nextRSTTurn, pickRSTFamily, isHeavyFamily } from './syllogimousAdapter.js';
import { buildTopology, planRandomWalk, evalTJNTarget, shortestPath } from './graphTopologies.js';

import { createRINTState, createRINTStates, generateRINTStimulus, isRINTConclusion, RINT_MIN_N } from './relationalIntegration.js';
export { calculateResults, computeNextNLevel } from './gameStats.js';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStimulusEntry(rel, modes = []) {
  const isBlending = (modes || []).includes('token_blending');
  const shapeA = isBlending ? pickTokenWord(pickTokenType()) : pickRandom(SHAPES);
  const shapeB = isBlending ? pickTokenWord(pickTokenType()) : pickRandomExcluding(SHAPES, shapeA);
  const colorA = pickRandom(COLORS);
  const colorB = pickRandomExcluding(COLORS, colorA);
  const renderMode = Math.floor(Math.random() * 3);
  const shape3DA = isBlending ? pickTokenWord(pickTokenType()) : pickRandom(['cube', 'sphere', 'pyramid', 'cone', 'torus', 'octahedron']);
  const shape3DB = isBlending ? pickTokenWord(pickTokenType()) : pickRandomExcluding(['cube', 'sphere', 'pyramid', 'cone', 'torus', 'octahedron'], shape3DA);
  const size3DA = 2 + Math.random() * 1.5;
  const size3DB = 2 + Math.random() * 1.5;
  const relationSymbolMode = Math.random() < 0.5 ? 'minimal' : 'normal';
  if (isSound(rel)) {
    const [soundA, soundB] = getSoundPair(rel);
    return { rel, soundA, soundB, wordA: soundA, wordB: soundB, shapeA, shapeB, colorA, colorB, renderMode, relationSymbolMode, shape3DA, shape3DB, size3DA, size3DB };
  }
  if (isVerbal(rel)) {
    let wordA, wordB;
    const weights = getTokenWeights();
    const canUseMeaningful = (weights.meaningful > 0);
    if (canUseMeaningful && Math.random() < 0.40) {
      [wordA, wordB] = getVerbalPair(rel);
    } else {
      wordA = pickTokenWord(pickTokenType());
      wordB = pickTokenWord(pickTokenType());
    }
    return { rel, wordA, wordB, shapeA, shapeB, colorA, colorB, renderMode, relationSymbolMode, shape3DA, shape3DB, size3DA, size3DB };
  }
  return { rel, shapeA, shapeB, colorA, colorB, renderMode, shape3DA, shape3DB, size3DA, size3DB };
}

function maybeInvertVisual(entry) {
  if (!entry || Math.random() >= 0.25) return entry;
  return { ...entry, shapeA: entry.shapeB, shapeB: entry.shapeA, colorA: entry.colorB, colorB: entry.colorA };
}

function getTypeHistory(typeHistoryMap, rel) {
  const inv = INVERSE_RELATIONSHIP[rel];
  const own = typeHistoryMap.get(rel) || [];
  const invEntries = (inv && inv !== rel) ? (typeHistoryMap.get(inv) || []) : [];
  return [...own, ...invEntries].sort((a, b) => a.trialIndex - b.trialIndex);
}

function pushTypeHistory(typeHistoryMap, rel, entry) {
  const next = new Map(typeHistoryMap);
  const existing = next.get(rel) || [];
  next.set(rel, [...existing, entry]);
  return next;
}

function pickTypeNbackTargetRel(typeHistoryMap, pool, effectiveN) {
  const candidates = pool.filter(rel => getTypeHistory(typeHistoryMap, rel).length >= effectiveN);
  if (candidates.length === 0) return null;
  return pickRandom(candidates);
}

function isTypeNbackMatch(typeHistoryMap, rel, effectiveN) {
  return getTypeHistory(typeHistoryMap, rel).length >= effectiveN;
}

function relationshipMatches(rel, targetRel) {
  return rel === targetRel || INVERSE_RELATIONSHIP[targetRel] === rel || INVERSE_RELATIONSHIP[rel] === targetRel;
}

// Negation-aware logical match: two stims encode the same fact iff their
// relations match AND their negation flags are equal. ("A inside B" ≠
// "NOT A inside B".) When negation mode is off, _negated is always false on
// both sides, so this reduces to plain relationshipMatches.
function logicalFactsMatch(currStim, pastEntry) {
  if (!currStim || !pastEntry) return false;
  if (!relationshipMatches(currStim.rel, pastEntry.rel)) return false;
  return !!currStim._negated === !!pastEntry._negated;
}

// When negation mode is on, each trial is flipped to "¬" with NEGATION_RATE
// probability. Off → always false.
function pickNegationFlag(negationMode, rate = NEGATION_RATE) {
  return negationMode ? Math.random() < rate : false;
}

function evaluateStimulusForMode({ stim, mode, history, typeHistory, rintState, effectiveN, hierHistory }) {
  if (!stim) return false;
  if (mode === 'tjn') {
    if (history.length < effectiveN) return false;
    const tjn = stim?._tjn;
    if (!tjn || !tjn.graph) return false;
    const past = history[history.length - effectiveN];
    const pastTJN = past?._tjn;
    if (!pastTJN) return false;
    // Schema transfer (TEM): if the N-back was on a different block, the
    // surface graph differs and the test would be ill-defined. Targets fire
    // only when N-back and current are in the same block. The first N
    // trials after a block change naturally fall through this branch.
    if (tjn.schemaMode && pastTJN.blockIndex !== tjn.blockIndex) return false;
    return evalTJNTarget({
      tier: tjn.tier,
      currentNode: tjn.node,
      nBackNode: pastTJN.node,
      graph: tjn.graph,
      K: tjn.K,
      goalNode: tjn.goal,
    });
  }
  if (mode === 'rint') return isRINTConclusion(rintState, stim, effectiveN);
  if (mode === 'cct') return isCCTTarget(history, stim, effectiveN);
  if (mode === 'nrint') {
    if (history.length < effectiveN) return false;
    const tail = history.slice(-effectiveN).filter(s => s?.rel === 'NRINT_COMPOSITE');
    if (tail.length < effectiveN) return false;
    const enabledFlags = stim?._nrintEnabledFlags || NRINT_DEFAULT_FLAGS;
    const rule = stim?._nrintMatchRule || 'union';
    return nrintRuleSatisfied(rule, tail, stim.attrs || emptyAttrs(), enabledFlags);
  }
  if (mode === 'type') {
    if (!isTypeNbackMatch(typeHistory, stim.rel, effectiveN)) return false;
    // With negation on, the rel-history-match must also agree on _negated.
    const entries = getTypeHistory(typeHistory, stim.rel);
    const past = entries[entries.length - effectiveN];
    return !!stim._negated === !!past?._negated;
  }
  if (mode === 'analogy') {
    // 4-place analogy: current is a target iff its relation shares a form
    // CLASS with the N-back relation, AND they are not the same exact
    // relation token (same-token would be ordinary 1-place identity match).
    const nBackEntry = history.length >= effectiveN ? history[history.length - effectiveN] : null;
    return !!nBackEntry && relationsAreAnalogous(stim.rel, nBackEntry.rel);
  }
  if (mode === 'hierarchical') {
    const canHier = (hierHistory || []).length >= effectiveN;
    const nBackCat = canHier ? hierHistory[hierHistory.length - effectiveN] : null;
    return canHier && getCategory(stim.rel) === nBackCat;
  }
  const nBackEntry = history.length >= effectiveN ? history[history.length - effectiveN] : null;
  return logicalFactsMatch(stim, nBackEntry);
}

function makeNonTargetRelationship(pool, isAccidentalTarget) {
  const candidates = pool.filter(rel => !isAccidentalTarget(rel));
  return pickRandom(candidates.length > 0 ? candidates : pool);
}

function makeDistractor(targetRelationship, pool) {
  const cat = getCategory(targetRelationship);
  const sameCategory = (RELATIONSHIP_CATEGORIES[cat] || ALL_RELATIONSHIPS).filter(r => pool.includes(r));
  const candidates = sameCategory.length > 1 ? sameCategory : pool;
  return pickRandomExcluding(candidates, targetRelationship);
}

function pickSoundStreamIndexes(candidates) {
  // Accepts either a count (legacy) or a list of candidate stream indexes
  // (current; relation-only streams) and returns up to 2 of them.
  const indexes = Array.isArray(candidates)
    ? [...candidates]
    : Array.from({ length: candidates }, (_, i) => i);
  indexes.sort(() => Math.random() - 0.5);
  return indexes.slice(0, Math.min(2, indexes.length));
}

function pickCubePosition(excludePosition = null) {
  const positions = [];
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) positions.push({ x, y, z });
    }
  }
  const candidates = excludePosition ? positions.filter(p => !sameCubePosition(p, excludePosition)) : positions;
  return pickRandom(candidates.length ? candidates : positions);
}

function pickSquarePosition(excludePosition = null) {
  const positions = [];
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) positions.push({ x, y });
  }
  const candidates = excludePosition ? positions.filter(p => !sameSquarePosition(p, excludePosition)) : positions;
  return pickRandom(candidates.length ? candidates : positions);
}

function pickTesseractPosition(excludePosition = null) {
  const positions = [];
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        for (let w = -1; w <= 1; w += 1) positions.push({ x, y, z, w });
      }
    }
  }
  const candidates = excludePosition ? positions.filter(p => !sameTesseractPosition(p, excludePosition)) : positions;
  return pickRandom(candidates.length ? candidates : positions);
}

function sameCubePosition(a, b) {
  return !!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z;
}

function sameTesseractPosition(a, b) {
  return !!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z && a.w === b.w;
}

function sameSquarePosition(a, b) {
  return !!a && !!b && a.x === b.x && a.y === b.y;
}

function resolveAlienSettings(alienSettings = {}) {
  const pickDirection = (direction) => direction === 'random' ? (Math.random() < 0.5 ? 'cw' : 'ccw') : direction;
  const pickSpeed = (speed, mode) => mode === 'random' ? 0.25 + Math.random() * 2.75 : Number(speed || 1);
  return {
    ...alienSettings,
    cubeDirection: pickDirection(alienSettings.cubeDirection || 'cw'),
    cubeSpeed: pickSpeed(alienSettings.cubeSpeed, alienSettings.cubeSpeedMode),
    squareDirection: pickDirection(alienSettings.squareDirection || 'cw'),
    squareSpeed: pickSpeed(alienSettings.squareSpeed, alienSettings.squareSpeedMode),
    tesseractDirection: pickDirection(alienSettings.tesseractDirection || 'cw'),
    tesseractSpeed: pickSpeed(alienSettings.tesseractSpeed, alienSettings.tesseractSpeedMode),
  };
}

function withAlienPosition(stim, { cubePosition, squarePosition, tesseractPosition, alienMode, alienSettings }) {
  if (!stim) return stim;
  const position = alienMode === 'square'
    ? { squarePosition: squarePosition || pickSquarePosition() }
    : alienMode === 'tesseract'
      ? { tesseractPosition: tesseractPosition || pickTesseractPosition() }
      : { cubePosition: cubePosition || pickCubePosition() };
  return {
    ...stim,
    ...position,
    alienMode,
    alienSettings: resolveAlienSettings(alienSettings),
  };
}

// Evaluate binary logic between two boolean signals
// op: 'AND' | 'OR' | 'XOR' | 'AND_NOT'
export function evalBinaryOp(a, b, op) {
  switch (op) {
    case 'AND':     return a && b;
    case 'OR':      return a || b;
    case 'XOR':     return a !== b;
    case 'AND_NOT': return a && !b;
    default:        return a;
  }
}

// Roll a random trial mode for a single stream given the global modes config
// Returns 'normal' | 'type' | 'rint' | 'nrint' | 'cct'
function rollTrialMode(modes, effectiveN) {
  const isImpossible = modes.includes('impossible');
  const isMixedRINT = modes.includes('mixed_rint');
  const isMixed = modes.includes('mixed_nback');
  const isTypeNback = modes.includes('type_nback');
  const isRINT = modes.includes('rint');
  const isNRINT = modes.includes('nonverbal_rint');
  const isCCT = modes.includes('cct');

  if (isImpossible) {
    // Three-way random, RINT only if N>=2
    const r = Math.random();
    if (r < 0.33) return 'normal';
    if (r < 0.66) return 'type';
    return effectiveN >= RINT_MIN_N ? 'rint' : 'type';
  }
  if (isMixedRINT) {
    const r = Math.random();
    if (r < 0.33) return 'normal';
    if (r < 0.66) return 'type';
    return effectiveN >= RINT_MIN_N ? 'rint' : 'normal';
  }
  if (isMixed) {
    return Math.random() < 0.5 ? 'type' : 'normal';
  }
  if (isCCT) return 'cct';
  if (modes.includes('analogy_nback')) return 'analogy';
  // NRINT always uses the nrint branch (it gracefully emits non-target stims
  // until enough history accumulates). Without this, N<2 falls into 'normal'
  // and tries to copy a non-existent stim, producing blank panels.
  if (isNRINT) return 'nrint';
  if (isRINT && effectiveN >= RINT_MIN_N) return 'rint';
  if (isTypeNback) return 'type';
  return 'normal';
}

// ─── Cognitive Control Training (arithmetic n-back) ──────────────────────────
// Each trial shows a digit (1–9). From trial N onwards a candidate result is
// also shown. Target fires iff result === current_digit + digit_from_N_back.
// Pure arithmetic working-memory — no relations, no shapes, no positions.
function makeCCTStim(number, result) {
  return {
    rel: 'CCT_NUMERIC',
    cctNumber: number,
    cctResult: result, // null until N-back history exists
    renderMode: 0,
    shapeA: 'circle',
    shapeB: 'square',
    colorA: '#22d3ee',
    colorB: '#fbbf24',
    isCCTStim: true,
  };
}

function generateCCTStimulus(history, effectiveN, matchChance) {
  const num = 1 + Math.floor(Math.random() * 9);
  const canShowResult = history.length >= effectiveN;
  if (!canShowResult) {
    return { stim: makeCCTStim(num, null), isTarget: false };
  }
  const past = history[history.length - effectiveN];
  const pastNum = past?.cctNumber ?? 0;
  const correctSum = num + pastNum;
  if (Math.random() < matchChance) {
    return { stim: makeCCTStim(num, correctSum), isTarget: true };
  }
  // Non-target: pick a near-but-not-equal sum so the player can't just
  // pattern-match on "ridiculously off" numbers.
  let candidate;
  do {
    const delta = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 3));
    candidate = Math.max(0, correctSum + delta);
  } while (candidate === correctSum);
  return { stim: makeCCTStim(num, candidate), isTarget: false };
}

function isCCTTarget(history, stim, effectiveN) {
  if (!stim?.isCCTStim || stim.cctResult == null) return false;
  if (history.length < effectiveN) return false;
  const past = history[history.length - effectiveN];
  if (!past?.isCCTStim) return false;
  return stim.cctResult === stim.cctNumber + past.cctNumber;
}

// CCT *side-task* layer: attaches a digit + candidate-result to any
// relation stim. Used when modes.includes('cct_overlay') so the player can
// dual-task — relation n-back on one axis, arithmetic n-back on the other.
function generateCCTLayer(history, effectiveN, matchChance) {
  const num = 1 + Math.floor(Math.random() * 9);
  // Only count past stims that carry a CCT layer; the result must be
  // current + the digit from N CCT-bearing trials ago.
  const cctHistory = (history || []).filter(s => s?.cctNumber != null);
  if (cctHistory.length < effectiveN) {
    return { number: num, result: null, isTarget: false };
  }
  const past = cctHistory[cctHistory.length - effectiveN];
  const correctSum = num + past.cctNumber;
  if (Math.random() < matchChance) {
    return { number: num, result: correctSum, isTarget: true };
  }
  let candidate;
  do {
    const delta = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 3));
    candidate = Math.max(0, correctSum + delta);
  } while (candidate === correctSum);
  return { number: num, result: candidate, isTarget: false };
}

// ─── Nonverbal cross-attribute RINT helpers ─────────────────────────────────
// Stimulus carries an `attrs` object with independent boolean flags spanning
// visual and auditory modalities. Updated match rule (per Grapist's revised
// feedback): a current stim is a target when its attribute set can be
// expressed as the union of some non-empty subset of the last N stims —
// equivalently, when the union of all "compatible" stims (those whose
// attrs are a subset of current.attrs) in the last N equals current.attrs.
// All-zero current is never a target (would be trivially reachable by the
// empty subset).
//
// Each flag may be enabled or disabled by the player (per-session), letting
// them use 2/3/etc. of the available modalities instead of all of them.
export const NRINT_FLAGS = [
  // visual (8) — Grapist asked for more visual diversity beyond the original 4
  'touching', 'hollow', 'size_mismatch', 'rotated',
  'dashed_border', 'glow', 'mirrored', 'striped',
  // audio (6) — extended to balance the visual count
  'audio', 'pitch_high', 'audio_loud', 'audio_long', 'audio_rhythmic', 'audio_warm',
];
export const NRINT_FLAG_META = {
  touching:       { group: 'visual', label: 'Touching',     desc: 'shapes adjacent vs. apart' },
  hollow:         { group: 'visual', label: 'Hollow',       desc: 'left shape outline vs. filled' },
  size_mismatch:  { group: 'visual', label: 'Size != ',     desc: 'right shape smaller vs. equal' },
  rotated:        { group: 'visual', label: 'Rotated',      desc: 'one shape rotated ~30°' },
  dashed_border:  { group: 'visual', label: 'Dashed',       desc: 'shapes have dashed outline vs solid' },
  glow:           { group: 'visual', label: 'Glow',         desc: 'neon halo around the shapes' },
  mirrored:       { group: 'visual', label: 'Mirrored',     desc: 'left shape horizontally flipped' },
  striped:        { group: 'visual', label: 'Striped',      desc: 'right shape carries diagonal stripes' },
  audio:          { group: 'audio',  label: 'Tone',         desc: 'brief 480 Hz sine tone' },
  pitch_high:     { group: 'audio',  label: 'High pitch',   desc: 'higher-pitched chime (980 Hz)' },
  audio_loud:     { group: 'audio',  label: 'Loud',         desc: 'tone at high gain (same pitch)' },
  audio_long:     { group: 'audio',  label: 'Long',         desc: 'sustained tone (~0.45 s)' },
  audio_rhythmic: { group: 'audio',  label: 'Rhythmic',     desc: 'three quick staccato pulses' },
  audio_warm:     { group: 'audio',  label: 'Warm',         desc: 'low sawtooth (warm timbre)' },
};
const NRINT_DEFAULT_FLAGS = ['touching', 'hollow', 'size_mismatch', 'rotated', 'audio'];

function emptyAttrs() {
  const o = {};
  NRINT_FLAGS.forEach(f => { o[f] = false; });
  return o;
}

// Count how many enabled flags are ON.
function attrsCount(attrs, enabledFlags = NRINT_FLAGS) {
  return enabledFlags.reduce((n, f) => n + (attrs[f] ? 1 : 0), 0);
}

// Cap the number of simultaneously-ON flags to `max` by randomly turning
// off the excess. max <= 0 (or null) means "no cap". Mutates a copy.
function capAttrs(attrs, max, enabledFlags = NRINT_FLAGS) {
  if (!max || max <= 0) return attrs;
  const on = enabledFlags.filter(f => attrs[f]);
  if (on.length <= max) return attrs;
  // Shuffle the ON flags and keep only the first `max`.
  const shuffled = [...on].sort(() => Math.random() - 0.5);
  const keep = new Set(shuffled.slice(0, max));
  const out = { ...attrs };
  on.forEach(f => { if (!keep.has(f)) out[f] = false; });
  return out;
}

function randomAttrs(enabledFlags = NRINT_FLAGS, maxPerTrial = 0) {
  const out = emptyAttrs();
  enabledFlags.forEach(f => { out[f] = Math.random() < 0.5; });
  return capAttrs(out, maxPerTrial, enabledFlags);
}

function attrsUnion(stimsTail, enabledFlags = NRINT_FLAGS) {
  const out = emptyAttrs();
  stimsTail.forEach(s => {
    const a = s?.attrs || emptyAttrs();
    enabledFlags.forEach(f => { out[f] = out[f] || !!a[f]; });
  });
  return out;
}

function attrsEqual(a, b, enabledFlags = NRINT_FLAGS) {
  return enabledFlags.every(f => !!a[f] === !!b[f]);
}

// Subset-union match: current is reachable iff every flag ON in current
// appears in at least one "compatible" stim (one whose enabled-flag set is
// a subset of current's), AND current isn't trivially empty.
function attrsReachableFromSubset(tail, currentAttrs, enabledFlags = NRINT_FLAGS) {
  if (enabledFlags.every(f => !currentAttrs[f])) return false; // trivial-empty
  const compatible = tail.filter(s => {
    const a = s?.attrs || emptyAttrs();
    return enabledFlags.every(f => !a[f] || currentAttrs[f]);
  });
  if (compatible.length === 0) return false;
  const union = attrsUnion(compatible, enabledFlags);
  return attrsEqual(union, currentAttrs, enabledFlags);
}

// Pick attrs that ARE reachable as a subset-union of the tail. Strategy:
// take a random non-empty subset of tail and use its union as current.attrs.
// When maxPerTrial is set, the union must respect the cap — a single-member
// subset always qualifies because tail stims are themselves capped, so a
// valid reachable target always exists.
function pickReachableAttrs(tail, enabledFlags = NRINT_FLAGS, maxPerTrial = 0) {
  const usable = (tail || []).filter(s => s?.attrs);
  if (usable.length === 0) return null;
  const withinCap = (attrs) => !maxPerTrial || maxPerTrial <= 0 || attrsCount(attrs, enabledFlags) <= maxPerTrial;
  for (let attempt = 0; attempt < 10; attempt++) {
    // Bias toward smaller subsets when a cap is active so unions stay small.
    const includeP = maxPerTrial && maxPerTrial > 0 ? 0.35 : 0.55;
    let subset = usable.filter(() => Math.random() < includeP);
    if (subset.length === 0) subset = [usable[Math.floor(Math.random() * usable.length)]];
    const candidate = attrsUnion(subset, enabledFlags);
    if (enabledFlags.some(f => candidate[f]) && withinCap(candidate)) return candidate;
  }
  // Fallback: a single tail stim whose attrs are non-empty. Because tail
  // stims were generated under the same cap, this always respects it.
  const shuffled = [...usable].sort(() => Math.random() - 0.5);
  for (const s of shuffled) {
    const a = s.attrs;
    if (enabledFlags.some(f => a[f])) {
      const out = emptyAttrs();
      enabledFlags.forEach(f => { out[f] = !!a[f]; });
      return out; // already within cap by construction
    }
  }
  return null;
}

// ── Additional NRINT match rules (Grapist request) ─────────────────────────
// Beyond subset-union, the engine supports three more logical aggregations
// over the last-N tail. Each has the same shape: a reachability check and a
// target picker that produces an attrs set satisfying the rule.
export const NRINT_MATCH_RULES = ['union', 'intersection', 'xor', 'implication', 'biconditional'];
export const NRINT_MATCH_RULE_META = {
  union:         { label: 'Union',         desc: 'current = ∪ of some non-empty subset of last N (default)' },
  intersection:  { label: 'Intersection',  desc: 'current = ∩ of some non-empty subset of last N (must be non-empty)' },
  xor:           { label: 'XOR',           desc: 'current = symmetric difference of some non-empty subset (parity: flag ON iff odd count of subset members have it)' },
  implication:   { label: 'Implication',   desc: '∃ a non-empty stim s in last N with s ⊆ current (s logically implies current)' },
  biconditional: { label: 'Biconditional', desc: 'current = the flags where ALL members of some subset (size ≥ 2) agree — i.e. the agreement / equivalence set' },
};

// Default weights: only union is enabled (preserves legacy behavior).
export const NRINT_DEFAULT_RULE_WEIGHTS = { union: 1, intersection: 0, xor: 0, implication: 0, biconditional: 0 };

// Normalize a "rule spec" to a weights object. Accepts either:
//   - a legacy string (one of NRINT_MATCH_RULES) → { [rule]: 1, others: 0 }
//   - an object map { rule: weight, ... }
// Returns a clean object with all 5 keys, integer-coerced non-negative
// weights. If the result has every weight = 0, falls back to union=1 so the
// engine never sees an empty distribution.
export function normalizeNrintRuleWeights(spec) {
  const out = { union: 0, intersection: 0, xor: 0, implication: 0, biconditional: 0 };
  if (typeof spec === 'string' && NRINT_MATCH_RULES.includes(spec)) {
    out[spec] = 1;
    return out;
  }
  if (spec && typeof spec === 'object') {
    for (const r of NRINT_MATCH_RULES) {
      const w = Number(spec[r]);
      out[r] = Number.isFinite(w) && w > 0 ? w : 0;
    }
  }
  const total = NRINT_MATCH_RULES.reduce((s, r) => s + out[r], 0);
  if (total <= 0) out.union = 1;
  return out;
}

// Pick a single rule for the current trial by weight. Multi-rule + weights
// support (Grapist request) — when multiple rules have weight > 0, each trial
// independently samples one according to the weights' relative frequency.
export function pickNrintRuleByWeights(weights) {
  const w = normalizeNrintRuleWeights(weights);
  const total = NRINT_MATCH_RULES.reduce((s, r) => s + w[r], 0);
  let r = Math.random() * total;
  for (const rule of NRINT_MATCH_RULES) {
    r -= w[rule];
    if (r <= 0) return rule;
  }
  return 'union';
}

// Intersection: ∃ non-empty subset S of tail with ∩_{s∈S} s.attrs == current.
// Equivalently: there's at least one tail stim whose attrs ⊇ current, AND for
// every flag NOT in current at least one such superset stim has that flag off.
function attrsReachableByIntersection(tail, currentAttrs, enabledFlags = NRINT_FLAGS) {
  if (enabledFlags.every(f => !currentAttrs[f])) return false; // disallow empty
  const supersets = (tail || []).filter(s => s?.attrs && enabledFlags.every(f => !currentAttrs[f] || s.attrs[f]));
  if (!supersets.length) return false;
  for (const f of enabledFlags) {
    if (currentAttrs[f]) continue;
    if (!supersets.some(s => !s.attrs[f])) return false;
  }
  return true;
}

// XOR: ∃ non-empty subset S of tail with the GF(2) sum (symmetric difference)
// of {s.attrs} equal to current. Equivalent to: current ∈ linear span of tail
// vectors over GF(2). Standard Gauss-Jordan rank check.
function attrsReachableByXor(tail, currentAttrs, enabledFlags = NRINT_FLAGS) {
  if (enabledFlags.every(f => !currentAttrs[f])) return false;
  const usable = (tail || []).filter(s => s?.attrs);
  if (!usable.length) return false;
  const N = enabledFlags.length;
  const vecs = usable.map(s => enabledFlags.map(f => s.attrs[f] ? 1 : 0));
  const target = enabledFlags.map(f => currentAttrs[f] ? 1 : 0);
  const basis = [];
  for (let v of vecs) {
    v = [...v];
    for (const b of basis) {
      const pivot = b.indexOf(1);
      if (pivot >= 0 && v[pivot] === 1) {
        for (let i = 0; i < N; i++) v[i] ^= b[i];
      }
    }
    if (v.some(x => x === 1)) basis.push(v);
  }
  const t = [...target];
  for (const b of basis) {
    const pivot = b.indexOf(1);
    if (pivot >= 0 && t[pivot] === 1) {
      for (let i = 0; i < N; i++) t[i] ^= b[i];
    }
  }
  return t.every(x => x === 0);
}

// Biconditional / equivalence: ∃ a subset S of tail with |S| ≥ 2 such that
// current = { f : every member of S has the same value at f } = (∩ s.attrs) ∪
// (∩ ¬s.attrs). For two stims this is exactly A ↔ B (flags where they agree).
// Tail size is bounded by N, so brute-force over 2^N subsets is cheap.
function attrsReachableByBiconditional(tail, currentAttrs, enabledFlags = NRINT_FLAGS) {
  if (enabledFlags.every(f => !currentAttrs[f])) return false;
  const usable = (tail || []).filter(s => s?.attrs);
  const n = usable.length;
  if (n < 2) return false;
  for (let mask = 0; mask < (1 << n); mask++) {
    // bit-count ≥ 2
    let count = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) count++;
    if (count < 2) continue;
    let allMatch = true;
    for (const f of enabledFlags) {
      let v = null;
      let agrees = true;
      for (let i = 0; i < n; i++) {
        if (!(mask & (1 << i))) continue;
        const x = !!usable[i].attrs[f];
        if (v === null) v = x;
        else if (x !== v) { agrees = false; break; }
      }
      // bic[f] = agrees ? 1 : 0
      if ((agrees ? 1 : 0) !== (currentAttrs[f] ? 1 : 0)) { allMatch = false; break; }
    }
    if (allMatch) return true;
  }
  return false;
}

// Implication: ∃ a non-empty stim s in tail with s ⊆ current (s "implies" current).
function attrsReachableByImplication(tail, currentAttrs, enabledFlags = NRINT_FLAGS) {
  if (enabledFlags.every(f => !currentAttrs[f])) return false;
  return (tail || []).some(s => {
    const a = s?.attrs;
    if (!a) return false;
    const nonempty = enabledFlags.some(f => a[f]);
    if (!nonempty) return false;
    return enabledFlags.every(f => !a[f] || currentAttrs[f]);
  });
}

export function nrintRuleSatisfied(rule, tail, currentAttrs, enabledFlags = NRINT_FLAGS) {
  switch (rule) {
    case 'intersection':  return attrsReachableByIntersection(tail, currentAttrs, enabledFlags);
    case 'xor':           return attrsReachableByXor(tail, currentAttrs, enabledFlags);
    case 'implication':   return attrsReachableByImplication(tail, currentAttrs, enabledFlags);
    case 'biconditional': return attrsReachableByBiconditional(tail, currentAttrs, enabledFlags);
    case 'union':
    default:              return attrsReachableFromSubset(tail, currentAttrs, enabledFlags);
  }
}

function pickIntersectionAttrs(tail, enabledFlags, maxPerTrial) {
  const usable = (tail || []).filter(s => s?.attrs && enabledFlags.some(f => s.attrs[f]));
  if (!usable.length) return null;
  for (let attempt = 0; attempt < 14; attempt++) {
    const k = 1 + Math.floor(Math.random() * Math.min(usable.length, 3));
    const subset = [...usable].sort(() => Math.random() - 0.5).slice(0, k);
    const cand = emptyAttrs();
    enabledFlags.forEach(f => { cand[f] = subset.every(s => !!s.attrs[f]); });
    if (enabledFlags.some(f => cand[f])) return cand; // intersection ≤ each ≤ cap
  }
  const a = usable[Math.floor(Math.random() * usable.length)].attrs;
  const out = emptyAttrs();
  enabledFlags.forEach(f => { out[f] = !!a[f]; });
  return out;
}

function pickXorAttrs(tail, enabledFlags, maxPerTrial) {
  const usable = (tail || []).filter(s => s?.attrs);
  if (usable.length < 1) return null;
  const withinCap = (a) => !maxPerTrial || maxPerTrial <= 0 || attrsCount(a, enabledFlags) <= maxPerTrial;
  for (let attempt = 0; attempt < 16; attempt++) {
    const maxK = Math.max(2, Math.min(usable.length, 4));
    const k = 2 + Math.floor(Math.random() * (maxK - 1));
    const subset = [...usable].sort(() => Math.random() - 0.5).slice(0, Math.min(k, usable.length));
    if (subset.length < 2) continue;
    const cand = emptyAttrs();
    enabledFlags.forEach(f => {
      let n = 0;
      for (const s of subset) if (s.attrs[f]) n++;
      cand[f] = (n % 2) === 1;
    });
    if (enabledFlags.some(f => cand[f]) && withinCap(cand)) return cand;
  }
  // Fallback: a single tail stim's attrs (XOR of one = itself; still in span).
  for (const s of [...usable].sort(() => Math.random() - 0.5)) {
    if (enabledFlags.some(f => s.attrs[f])) {
      const out = emptyAttrs();
      enabledFlags.forEach(f => { out[f] = !!s.attrs[f]; });
      return out;
    }
  }
  return null;
}

function pickImplicationAttrs(tail, enabledFlags, maxPerTrial) {
  const usable = (tail || []).filter(s => s?.attrs && enabledFlags.some(f => s.attrs[f]));
  if (!usable.length) return null;
  const base = usable[Math.floor(Math.random() * usable.length)].attrs;
  const cand = emptyAttrs();
  enabledFlags.forEach(f => { cand[f] = !!base[f]; });
  const offFlags = enabledFlags.filter(f => !cand[f]);
  const cap = maxPerTrial && maxPerTrial > 0 ? maxPerTrial : enabledFlags.length;
  const room = Math.max(0, cap - attrsCount(cand, enabledFlags));
  const extras = Math.min(offFlags.length, room, Math.floor(Math.random() * 3));
  const shuffled = offFlags.sort(() => Math.random() - 0.5);
  for (let i = 0; i < extras; i++) cand[shuffled[i]] = true;
  return cand;
}

function pickBiconditionalAttrs(tail, enabledFlags, maxPerTrial) {
  const usable = (tail || []).filter(s => s?.attrs);
  if (usable.length < 2) return null;
  const withinCap = (a) => !maxPerTrial || maxPerTrial <= 0 || attrsCount(a, enabledFlags) <= maxPerTrial;
  for (let attempt = 0; attempt < 16; attempt++) {
    const maxK = Math.min(usable.length, 4);
    const k = 2 + Math.floor(Math.random() * (maxK - 1));
    const subset = [...usable].sort(() => Math.random() - 0.5).slice(0, k);
    const cand = emptyAttrs();
    enabledFlags.forEach(f => {
      const v0 = !!subset[0].attrs[f];
      cand[f] = subset.every(s => !!s.attrs[f] === v0);
    });
    if (enabledFlags.some(f => cand[f]) && withinCap(cand)) return cand;
  }
  return null;
}

function pickReachableAttrsByRule(rule, tail, enabledFlags, maxPerTrial) {
  switch (rule) {
    case 'intersection':  return pickIntersectionAttrs(tail, enabledFlags, maxPerTrial);
    case 'xor':           return pickXorAttrs(tail, enabledFlags, maxPerTrial);
    case 'implication':   return pickImplicationAttrs(tail, enabledFlags, maxPerTrial);
    case 'biconditional': return pickBiconditionalAttrs(tail, enabledFlags, maxPerTrial);
    case 'union':
    default:              return pickReachableAttrs(tail, enabledFlags, maxPerTrial);
  }
}

// Pick attrs that are NOT reachable as a subset-union of the tail. The
// engine uses this for non-target trials; we keep candidates within the
// enabled-flag set so disabling a flag really means it's silenced.
function pickNonMatchingAttrs(tail, enabledFlags = NRINT_FLAGS, maxPerTrial = 0, rule = 'union') {
  for (let i = 0; i < 24; i++) {
    const cand = randomAttrs(enabledFlags, maxPerTrial);
    if (!nrintRuleSatisfied(rule, tail, cand, enabledFlags)) return cand;
  }
  // Force a non-empty unreachable attrs by adding a flag that no tail stim has.
  const out = randomAttrs(enabledFlags, maxPerTrial);
  for (const f of enabledFlags) {
    const haveAny = (tail || []).some(s => s?.attrs?.[f]);
    if (!haveAny) {
      // Respect the cap: if already at cap, free a slot before adding.
      const capped = capAttrs(out, maxPerTrial && maxPerTrial > 0 ? maxPerTrial - 1 : 0, enabledFlags);
      capped[f] = true;
      if (!nrintRuleSatisfied(rule, tail, capped, enabledFlags)) return capped;
    }
  }
  // Last resort: empty attrs (rules disallow empty current → guaranteed non-target).
  return emptyAttrs();
}

function makeNRINTStim(attrs) {
  const shapeA = pickRandom(SHAPES);
  const colorA = pickRandom(COLORS);
  return {
    rel: 'NRINT_COMPOSITE',
    attrs,
    shapeA,
    shapeB: pickRandomExcluding(SHAPES, shapeA),
    colorA,
    colorB: pickRandomExcluding(COLORS, colorA),
    renderMode: 0,
    isNRINTStim: true,
  };
}

// Generate stimulus for a single stream, given its own history/typeHistory/rintState
// streamConfig: { trialMode, binaryMode, binaryOp, hierHistory } for Hierarchical and Binary Logic
const DECOY_FILTER_TRIAL_RATE = 0.35; // fraction of trials drawn from decoy categories

function generateOneStreamStimulus({ history, typeHistory, rintState, pool, effectiveN, trialMode, matchChance, hasDistractors, hasLures = false, negationMode = false, trialIndex, hierHistory, binaryMode, binaryOp, signalOnly = false, baseStim = null, alienCube = false, alienSquare = false, alienTesseract = false, alienSettings = {}, nrintEnabledFlags = NRINT_DEFAULT_FLAGS, nrintHideLegend = false, nrintMaxPerTrial = 0, nrintMatchRule = 'union', nrintMatchRuleWeights = null, decoyCats = [], decoyFilterRule = 'never_target', customLureRate = null, customNegationRate = null, modes = [] }) {
   let stim, isPrimaryTarget = false, isPositionTarget = false, nextRINTState = rintState;
   const canTarget = history.length >= effectiveN;

   // RINT requires transitive relationships; Type N-Back can use all relationship types
   const isRINTMode = trialMode === 'rint';
   const effectivePool = isRINTMode
     ? filterTransitiveRelationships(pool, true, false)
     : pool;
   const finalPool = effectivePool.length > 0 ? effectivePool : pool;

  if (signalOnly && baseStim) {
    const isSignalTarget = evaluateStimulusForMode({
      stim: baseStim, mode: trialMode, history, typeHistory, rintState, effectiveN, hierHistory,
    });
    return { stim: baseStim, isTarget: isSignalTarget, isPrimaryTarget: isSignalTarget, isHierTarget: isSignalTarget, nextRINTState };
  }

  const nBackEntry = canTarget ? history[history.length - effectiveN] : null;

  if (trialMode === 'rint') {
    const rintResult = generateRINTStimulus(rintState, finalPool, effectiveN, matchChance);
    stim = rintResult.stim;
    isPrimaryTarget = rintResult.isTarget;
    nextRINTState = rintResult.rintState;
  } else if (trialMode === 'cct') {
    // Cognitive Control Training: arithmetic n-back on single digits.
    const cctResult = generateCCTStimulus(history, effectiveN, matchChance);
    stim = cctResult.stim;
    isPrimaryTarget = cctResult.isTarget;
  } else if (trialMode === 'nrint') {
    // Nonverbal cross-attribute RINT. Multi-rule + weights support (Grapist
    // request, follow-up to the original single-rule selector): the engine
    // accepts a weights object; each trial independently samples one rule by
    // weight. Single-rule mode is the special case of one rule with weight ≥ 1
    // and all others zero — same behavior as before, no migration churn.
    // Per-session enabledFlags controls which attribute dimensions are active;
    // the per-trial cap bounds tracking load.
    const flags = (nrintEnabledFlags && nrintEnabledFlags.length) ? nrintEnabledFlags : NRINT_DEFAULT_FLAGS;
    const cap = (nrintMaxPerTrial && nrintMaxPerTrial > 0) ? Math.min(nrintMaxPerTrial, flags.length) : 0;
    const ruleSpec = nrintMatchRuleWeights || nrintMatchRule || 'union';
    const rule = pickNrintRuleByWeights(ruleSpec);
    const tail = history.slice(-effectiveN).filter(s => s?.rel === 'NRINT_COMPOSITE');
    const haveChain = tail.length >= effectiveN;
    let attrs;
    if (haveChain && Math.random() < matchChance) {
      attrs = pickReachableAttrsByRule(rule, tail, flags, cap) || randomAttrs(flags, cap);
      isPrimaryTarget = nrintRuleSatisfied(rule, tail, attrs, flags);
    } else if (haveChain) {
      attrs = pickNonMatchingAttrs(tail, flags, cap, rule);
      isPrimaryTarget = false;
    } else {
      attrs = randomAttrs(flags, cap);
      isPrimaryTarget = false;
    }
    stim = makeNRINTStim(attrs);
    // Carry per-session config on the stim so the evaluator / renderer can
    // honour enabled-flag, hide-legend and the active match rule.
    stim._nrintEnabledFlags = flags;
    stim._nrintMatchRule = rule;
    if (nrintHideLegend) stim._nrintHideLegend = true;
  } else if (trialMode === 'type') {
    const forcedRel = Math.random() < matchChance ? pickTypeNbackTargetRel(typeHistory, finalPool, effectiveN) : null;
    if (forcedRel) {
      const entries = getTypeHistory(typeHistory, forcedRel);
      const targetEntry = entries[entries.length - effectiveN];
      stim = isVerbal(forcedRel)
        ? (Math.random() < 0.35 ? makeInverseStimulus(targetEntry) : null) || makeStimulusEntry(forcedRel, modes)
        : maybeInvertVisual(makeStimulusEntry(forcedRel, modes));
      // When negation mode is on, match the past entry's _negated to keep
      // the target intact (since type-match now requires both rel & negation).
      stim._negated = !!targetEntry?._negated;
    } else {
      stim = makeStimulusEntry(makeNonTargetRelationship(finalPool, rel => isTypeNbackMatch(typeHistory, rel, effectiveN)), modes);
      stim._negated = pickNegationFlag(negationMode);
    }
    // Negation lure: if we made a rel-match but flipped negation, it becomes a
    // non-target. Roll this on a fraction of the "target" path under negation
    // mode to keep negation differentiating from rel-matches.
    if (negationMode && forcedRel && Math.random() < NEGATION_RATE) {
      stim._negated = !stim._negated;
    }
    isPrimaryTarget = evaluateStimulusForMode({
      stim, mode: 'type', history, typeHistory, rintState, effectiveN, hierHistory,
    });
  } else if (trialMode === 'hierarchical') {
    const canHier = (hierHistory || []).length >= effectiveN;
    const nBackCat = canHier ? hierHistory[hierHistory.length - effectiveN] : null;
    const rel = canHier && Math.random() < matchChance
      ? pickRandom(finalPool.filter(r => getCategory(r) === nBackCat))
      : makeNonTargetRelationship(finalPool, r => canHier && getCategory(r) === nBackCat);
    stim = makeStimulusEntry(rel, modes);
    isPrimaryTarget = canHier && getCategory(stim.rel) === nBackCat;
  } else if (trialMode === 'analogy') {
    // 4-place analogy: pick a relation that shares the form class with the
    // N-back entry's relation (target) or a different form class (non-target).
    // Same-token is always rejected as a "trivial" match (that's just 1-place
    // identity), forcing the player to abstract the structural form.
    let chosenRel = null;
    if (canTarget && nBackEntry) {
      const nbClass = getRelationFormClass(nBackEntry.rel);
      const sameClass = finalPool.filter(r => r !== nBackEntry.rel && getRelationFormClass(r) === nbClass);
      const diffClass = finalPool.filter(r => getRelationFormClass(r) !== nbClass);
      if (Math.random() < matchChance && sameClass.length > 0) {
        chosenRel = pickRandom(sameClass);
      } else if (diffClass.length > 0) {
        chosenRel = pickRandom(diffClass);
      } else {
        // Pool too narrow — fallback to any non-same-token relation
        chosenRel = pickRandomExcluding(finalPool, nBackEntry.rel);
      }
    } else {
      chosenRel = pickRandom(finalPool);
    }
    stim = isVerbal(chosenRel)
      ? makeStimulusEntry(chosenRel, modes)
      : maybeInvertVisual(makeStimulusEntry(chosenRel, modes));
    isPrimaryTarget = canTarget && relationsAreAnalogous(stim.rel, nBackEntry?.rel);
  } else if (decoyCats && decoyCats.length > 0) {
    // ── Decoy Filter: type-based selective attention ──
    // Some relation CATEGORIES are decoys to ignore. Each trial is either a
    // decoy-category stim (never a target — withhold) or a relevant-category
    // stim that follows the normal n-back rule. Under 'removed_from_chain',
    // decoy trials don't count toward the N-back position (the reference is
    // the subsequence of relevant trials); under 'never_target' the chain is
    // positional over all trials.
    const isDecoyCat = (rel) => decoyCats.includes(getCategory(rel));
    const relevantPool = finalPool.filter(r => !isDecoyCat(r));
    const decoyPool = finalPool.filter(isDecoyCat);
    const usePool = relevantPool.length > 0 ? relevantPool : finalPool;
    const relevantHistory = decoyFilterRule === 'removed_from_chain'
      ? history.filter(h => !h._isDecoyType)
      : history;
    const dnBack = relevantHistory.length >= effectiveN ? relevantHistory[relevantHistory.length - effectiveN] : null;
    const canDTarget = relevantHistory.length >= effectiveN;
    // Boost the match chance on relevant trials to offset the dilution from
    // decoy trials (which are never targets), keeping the overall target rate
    // near the normal MATCH_CHANCE rather than collapsing to ~10%.
    const relMatchChance = Math.min(0.6, matchChance / (1 - DECOY_FILTER_TRIAL_RATE));
    const wantDecoyTrial = decoyPool.length > 0 && relevantPool.length > 0 && Math.random() < DECOY_FILTER_TRIAL_RATE;
    if (wantDecoyTrial) {
      stim = maybeInvertVisual(makeStimulusEntry(pickRandom(decoyPool), modes));
      stim._isDecoyType = true;
      stim._negated = pickNegationFlag(negationMode, customNegationRate !== null ? customNegationRate : NEGATION_RATE);
      isPrimaryTarget = false; // decoy-category trials are NEVER targets
    } else if (canDTarget && dnBack && usePool.includes(dnBack.rel) && Math.random() < relMatchChance) {
      stim = isVerbal(dnBack.rel)
        ? (Math.random() < 0.35 ? makeInverseStimulus(dnBack) : null) || { ...dnBack }
        : maybeInvertVisual(makeStimulusEntry(dnBack.rel, modes));
      stim._negated = !!dnBack?._negated;
      stim._isDecoyType = false;
      isPrimaryTarget = canDTarget && logicalFactsMatch(stim, dnBack);
    } else {
      stim = makeStimulusEntry(makeNonTargetRelationship(usePool, rel => canDTarget && relationshipMatches(rel, dnBack?.rel)), modes);
      stim._negated = pickNegationFlag(negationMode, customNegationRate !== null ? customNegationRate : NEGATION_RATE);
      stim._isDecoyType = false;
      isPrimaryTarget = false;
    }
  } else {
    let isLure = false;
    let lureOffset = 0;
    if (canTarget && nBackEntry && finalPool.includes(nBackEntry.rel) && Math.random() < matchChance) {
      stim = isVerbal(nBackEntry.rel)
        ? (Math.random() < 0.35 ? makeInverseStimulus(nBackEntry) : null) || { ...nBackEntry }
        : maybeInvertVisual(makeStimulusEntry(nBackEntry.rel, modes));
      // Keep _negated consistent with the past so the rel-match becomes a real
      // target under negation mode. Negation lures are rolled below.
      stim._negated = !!nBackEntry?._negated;
    } else if (hasLures && canTarget && history.length >= effectiveN + 1 && Math.random() < (customLureRate !== null ? customLureRate : LURE_RATE)) {
      // Near-miss lure: pick a stim that would be a target at N-1 or N+1
      // instead of N. The careful counter rejects; the loose counter FAs.
      const candidates = [];
      if (effectiveN >= 2 && history.length >= effectiveN - 1) candidates.push(effectiveN - 1);
      if (history.length >= effectiveN + 1) candidates.push(effectiveN + 1);
      const lureN = candidates.length ? pickRandom(candidates) : effectiveN;
      const lureEntry = history[history.length - lureN];
      if (lureEntry && finalPool.includes(lureEntry.rel) && !relationshipMatches(lureEntry.rel, nBackEntry?.rel)) {
        stim = isVerbal(lureEntry.rel)
          ? (Math.random() < 0.35 ? makeInverseStimulus(lureEntry) : null) || { ...lureEntry }
          : maybeInvertVisual(makeStimulusEntry(lureEntry.rel, modes));
        stim._negated = !!lureEntry._negated;
        isLure = true;
        lureOffset = lureN - effectiveN;
      } else {
        stim = makeStimulusEntry(makeNonTargetRelationship(finalPool, rel => canTarget && relationshipMatches(rel, nBackEntry?.rel)), modes);
        stim._negated = pickNegationFlag(negationMode, customNegationRate !== null ? customNegationRate : NEGATION_RATE);
      }
    } else if (hasDistractors && canTarget && nBackEntry && Math.random() < DISTRACTOR_CHANCE) {
      stim = makeStimulusEntry(makeDistractor(nBackEntry.rel, pool), modes);
      stim._negated = pickNegationFlag(negationMode, customNegationRate !== null ? customNegationRate : NEGATION_RATE);
    } else {
      stim = makeStimulusEntry(makeNonTargetRelationship(finalPool, rel => canTarget && relationshipMatches(rel, nBackEntry?.rel)), modes);
      stim._negated = pickNegationFlag(negationMode, customNegationRate !== null ? customNegationRate : NEGATION_RATE);
    }
    // Negation lure on a would-be target: flip negation so the rel matches but
    // the logical fact doesn't. Player who ignores the ¬ badge FAs.
    if (negationMode && nBackEntry && relationshipMatches(stim.rel, nBackEntry.rel) && Math.random() < (customNegationRate !== null ? customNegationRate : NEGATION_RATE)) {
      stim._negated = !stim._negated;
    }
    if (isLure) {
      stim._isLure = true;
      stim._lureOffset = lureOffset;
    }
    isPrimaryTarget = logicalFactsMatch(stim, nBackEntry);
  }

  if (alienCube || alienSquare || alienTesseract) {
    const alienMode = alienSquare ? 'square' : alienTesseract ? 'tesseract' : 'cube';
    const targetPosition = alienSquare ? nBackEntry?.squarePosition : alienTesseract ? nBackEntry?.tesseractPosition : nBackEntry?.cubePosition;
    const shouldMatchPosition = canTarget && targetPosition && Math.random() < matchChance;
    stim = withAlienPosition(stim, {
      alienMode,
      alienSettings,
      cubePosition: alienCube ? (shouldMatchPosition ? targetPosition : pickCubePosition(targetPosition)) : null,
      squarePosition: alienSquare ? (shouldMatchPosition ? targetPosition : pickSquarePosition(targetPosition)) : null,
      tesseractPosition: alienTesseract ? (shouldMatchPosition ? targetPosition : pickTesseractPosition(targetPosition)) : null,
    });
    isPositionTarget = canTarget && (alienSquare
      ? sameSquarePosition(stim.squarePosition, targetPosition)
      : alienTesseract
        ? sameTesseractPosition(stim.tesseractPosition, targetPosition)
        : sameCubePosition(stim.cubePosition, targetPosition));
  }

  // Hierarchical signal: is the category of this stim the same as N back?
  let isHierTarget = false;
  const hierH = hierHistory || [];
  if (binaryMode === 'hierarchical' || trialMode === 'hierarchical') {
    const canHier = hierH.length >= effectiveN;
    if (canHier) {
      const nBackCat = hierH[hierH.length - effectiveN];
      isHierTarget = getCategory(stim.rel) === nBackCat;
    }
  }

  // Binary Logic: secondary mode generates its own independent signal
  let isSecondaryTarget = false;
  if (binaryMode && binaryMode !== 'hierarchical' && binaryMode !== 'none') {
    // Generate secondary signal using the same history but different mode
    const secResult = generateOneStreamStimulus({
      history, typeHistory, rintState, pool, effectiveN,
      trialMode: binaryMode, matchChance, hasDistractors, trialIndex,
      hierHistory, signalOnly: true, baseStim: stim,
    });
    isSecondaryTarget = secResult.isPrimaryTarget;
  }

  // Compute final isTarget
  let isTarget;
  if (binaryMode === 'hierarchical') {
    isTarget = evalBinaryOp(isPrimaryTarget, isHierTarget, binaryOp || 'AND');
  } else if (binaryMode && binaryMode !== 'none') {
    isTarget = evalBinaryOp(isPrimaryTarget, isSecondaryTarget, binaryOp || 'AND');
  } else {
    isTarget = isPrimaryTarget;
  }

  return { stim, isTarget, isPrimaryTarget, isPositionTarget, isHierTarget, nextRINTState };
}

// Random binary config for a single stream
const BINARY_MODES = ['normal', 'type', 'rint', 'hierarchical'];
const BINARY_OPS = ['AND', 'OR', 'XOR', 'AND_NOT'];

function randomBinaryConfig(effectiveN) {
  const modes = effectiveN >= RINT_MIN_N ? BINARY_MODES : BINARY_MODES.filter(m => m !== 'rint');
  const primary = pickRandom(modes);
  // secondary must differ from primary
  const secondaryPool = modes.filter(m => m !== primary);
  const secondary = pickRandom(secondaryPool);
  const op = pickRandom(BINARY_OPS);
  return { primaryMode: primary, binaryMode: secondary, binaryOp: op };
}

// ─── State Creation ──────────────────────────────────────────────────────────

export function createGameState({ nLevel, modes, relationshipPool, totalRounds, extraStreams = [], alienSettings = {}, streamA = null, nrintEnabledFlags = null, nrintHideLegend = false, nrintMaxPerTrial = 0, nrintMatchRule = 'union', nrintMatchRuleWeights = null, decoyFilterRule = 'never_target', decoyFilterRandom = true, decoyFilterCategories = [], initialSpeedMs = 2800, wrapperMorphStyle = 'shift', rstDifficulty = 'easy', tjnTier = TJN_DEFAULT_TIER, tjnTopology = TJN_DEFAULT_TOPOLOGY, tjnNodes = TJN_DEFAULT_NODES, tjnK = TJN_HARD_K, tjnSchemaMode = false, tjnSchemaBlocks = 3 } = {}) {
  const opts = { tjnSchemaMode, tjnSchemaBlocks };
  const numExtra = extraStreams.length;
  const totalStreams = 1 + numExtra;
  // Per-stream type: 'relation' (default) or 'cct'. Falls back to global 'cct'
  // mode for backward compat.
  const defaultType = (modes || []).includes('cct') ? 'cct' : 'relation';
  // Normalize to the only two live stream types. A stale 'decoy' value can
  // linger in saved settings from the removed whole-stream-decoy feature;
  // coerce it (and anything unknown) to 'relation' so it can't silently
  // disable a stream's decoy-filter assignment.
  const normalizeStreamType = (t) => (t === 'cct' ? 'cct' : 'relation');
  const streamTypes = [
    normalizeStreamType(streamA?.streamType || defaultType),
    ...extraStreams.map(s => normalizeStreamType(s?.streamType || defaultType)),
  ];

  // ── Decoy Filter (type-based selective attention) ────────────────────────
  // Certain relation CATEGORIES are "decoys" the player must ignore in real
  // time. Each relation stream gets its own decoy category set. Categories are
  // drawn ONLY from the categories actually present in the active pool, and at
  // least one category is always left as a relevant (responded) target.
  const decoyFilterActive = (modes || []).includes('decoy_filter');
  let streamDecoyCats = Array.from({ length: totalStreams }, () => []);
  if (decoyFilterActive) {
    const dpool = (relationshipPool && relationshipPool.length) ? relationshipPool : ALL_RELATIONSHIPS;
    const activeCats = [...new Set(dpool.map(getCategory))].filter(Boolean);
    if (activeCats.length >= 2) {
      const maxDecoy = activeCats.length - 1; // always leave ≥1 relevant category
      const manualChosen = (decoyFilterCategories || []).filter(c => activeCats.includes(c));
      streamDecoyCats = streamTypes.map(t => {
        if (t !== 'relation') return []; // decoy filter only applies to relation streams
        if (decoyFilterRandom) {
          const k = 1 + Math.floor(Math.random() * maxDecoy);
          const shuffled = [...activeCats].sort(() => Math.random() - 0.5);
          return shuffled.slice(0, k);
        }
        // Manual: cap to maxDecoy so something always remains relevant.
        return manualChosen.slice(0, maxDecoy);
      });
    }
  }

  // ── TJN / TEM setup: pre-build "blocks". Each block has its own graph +
  // walk. For plain TJN there is exactly 1 block covering the whole
  // session. For Schema Transfer (TEM), 2-4 blocks share the same topology
  // family but use FRESH graphs and themes — testing whether the player
  // encoded the abstract schema and can apply it to a new surface instance.
  const tjnActive = (modes || []).includes('trajectory_nback');
  const tjnSchemaModeEffective = !!opts.tjnSchemaMode;
  const tjnSchemaBlocksEffective = Math.max(2, Math.min(5, opts.tjnSchemaBlocks || 3));
  let tjnState = null;
  if (tjnActive) {
    const rounds = (totalRounds || TOTAL_ROUNDS) + 4;
    const blockCount = tjnSchemaModeEffective ? tjnSchemaBlocksEffective : 1;
    const baseLen = Math.ceil(rounds / blockCount);
    const blocks = [];
    const BLOCK_THEMES = [
      { label: 'Map α', color: '#22d3ee' },   // cyan
      { label: 'Map β', color: '#22c55e' },   // emerald
      { label: 'Map γ', color: '#a855f7' },   // violet
      { label: 'Map δ', color: '#f59e0b' },   // amber
      { label: 'Map ε', color: '#ec4899' },   // pink
    ];
    for (let b = 0; b < blockCount; b++) {
      const graph = buildTopology(tjnTopology, { nodes: tjnNodes });
      const walk = planRandomWalk(graph, baseLen + 2);
      const goals = walk.map(node => {
        if (graph.nodes.length < 3) return null;
        let g = node;
        for (let i = 0; i < 12 && g === node; i++) {
          g = graph.nodes[Math.floor(Math.random() * graph.nodes.length)];
        }
        return g;
      });
      blocks.push({
        graph, walk, goals,
        startTrial: b * baseLen,
        endTrial: b * baseLen + baseLen,
        blockIndex: b,
        label: BLOCK_THEMES[b]?.label || `Map ${b + 1}`,
        color: BLOCK_THEMES[b]?.color || '#94a3b8',
      });
    }
    tjnState = {
      blocks,
      tier: tjnTier,
      K: tjnK,
      topology: tjnTopology,
      nodes: tjnNodes,
      schemaMode: tjnSchemaModeEffective,
      schemaBlocks: tjnSchemaBlocksEffective,
    };
  }

  return {
    nLevel,
    modes,
    tjnActive,
    tjnState,
    tjnTier,
    tjnTopology,
    tjnNodes,
    tjnK,
    tjnSchemaMode,
    tjnSchemaBlocks,
    alienSettings,
    wrapperMorphStyle,
    relationshipPool: relationshipPool || ALL_RELATIONSHIPS,
    round: 0,
    totalRounds: totalRounds || TOTAL_ROUNDS,
    numExtraStreams: numExtra,
    streamTypes,
    streamDecoyCats,
    decoyFilterRule,
    nrintEnabledFlags: (nrintEnabledFlags && nrintEnabledFlags.length) ? nrintEnabledFlags : NRINT_DEFAULT_FLAGS,
    nrintHideLegend: !!nrintHideLegend,
    nrintMaxPerTrial: Number(nrintMaxPerTrial) || 0,
    nrintMatchRule: NRINT_MATCH_RULES.includes(nrintMatchRule) ? nrintMatchRule : 'union',
    nrintMatchRuleWeights: normalizeNrintRuleWeights(nrintMatchRuleWeights || nrintMatchRule),
    initialSpeedMs,
    adaptiveSpeedMs: initialSpeedMs,
    adaptiveLureRate: 0.20,
    adaptiveNegationRate: 0.30,
    adaptiveMessage: '',
    // Per-trial randomized binary configs (only used when binary_logic mode is active)
    trialBinaryConfigs: Array(totalStreams).fill(null).map(() => ({ primaryMode: 'normal', binaryMode: null, binaryOp: 'AND' })),
    audioStreamIndexes: [],

    // Per-stream RINT states (index 0 = stream A, 1..N = extra streams)
    rintStates: createRINTStates(Math.max(1, totalStreams)),

    // Per-stream hierarchical category histories
    hierHistories: Array.from({ length: totalStreams }, () => []),

    // Stream A
    historyA: [],
    typeHistoryA: new Map(),
    currentRelationship: null,
    currentStimulusA: null,
    isTargetA: false,
    isPositionTargetA: false,

    // Extra streams
    extraHistories: Array.from({ length: numExtra }, () => []),
    extraTypeHistories: Array.from({ length: numExtra }, () => new Map()),
    extraCurrentRels: Array(numExtra).fill(null),
    extraCurrentStimuli: Array(numExtra).fill(null),
    extraIsTargets: Array(numExtra).fill(false),
    extraPositionTargets: Array(numExtra).fill(false),
    extraResponded: Array(numExtra).fill(false),
    extraPositionResponded: Array(numExtra).fill(false),
    extraHits: Array(numExtra).fill(0),
    extraMisses: Array(numExtra).fill(0),
    extraFalseAlarms: Array(numExtra).fill(0),
    extraCorrectRejections: Array(numExtra).fill(0),
    extraLureFalseAlarms: Array(numExtra).fill(0),
    extraLureCorrectRejections: Array(numExtra).fill(0),

    isDistractor: false,
    respondedA: false,

    hitsA: 0,
    missesA: 0,
    falseAlarmsA: 0,
    correctRejectionsA: 0,
    // Lure-trial sub-counts (subset of FA/CR — lures are always non-targets).
    lureFalseAlarmsA: 0,
    lureCorrectRejectionsA: 0,
    positionHitsA: 0,
    positionMissesA: 0,
    positionFalseAlarmsA: 0,
    positionCorrectRejectionsA: 0,
    extraPositionHits: Array(numExtra).fill(0),
    extraPositionMisses: Array(numExtra).fill(0),
    extraPositionFalseAlarms: Array(numExtra).fill(0),
    extraPositionCorrectRejections: Array(numExtra).fill(0),
    // CCT side-task axis (separate scoring axis when cct_overlay is on)
    isCCTTargetA: false,
    extraCCTTargets: Array(numExtra).fill(false),
    cctRespondedA: false,
    extraCCTResponded: Array(numExtra).fill(false),
    cctHitsA: 0,
    cctMissesA: 0,
    cctFalseAlarmsA: 0,
    cctCorrectRejectionsA: 0,
    // RST (Reasoning Side-Task) axis — single stream A. Each trial shows one
    // premise (current entity vs prev). From trial N onwards a candidate
    // conclusion (current vs N-back) is also shown; target fires when the
    // conclusion is logically valid given the chain. Mirrors CCT's "digit +
    // candidate result" structure but with Syllogimous-style deductive items.
    isRSTTargetA: false,
    extraRSTTargets: Array(numExtra).fill(false),
    rstRespondedA: false,
    extraRSTResponded: Array(numExtra).fill(false),
    rstHitsA: 0,
    rstMissesA: 0,
    rstFalseAlarmsA: 0,
    rstCorrectRejectionsA: 0,
    // RST family is picked per-session per-stream from the difficulty pool.
    // Easy → distinction only; Medium → +comparison; Hard → +analogy.
    rstDifficulty,
    rstChainA: createRSTChain(pickRSTFamily(rstDifficulty)),
    extraRSTChains: Array.from({ length: numExtra }, () => createRSTChain(pickRSTFamily(rstDifficulty))),
    extraCCTHits: Array(numExtra).fill(0),
    extraCCTMisses: Array(numExtra).fill(0),
    extraCCTFalseAlarms: Array(numExtra).fill(0),
    extraCCTCorrectRejections: Array(numExtra).fill(0),
    extraRSTHits: Array(numExtra).fill(0),
    extraRSTMisses: Array(numExtra).fill(0),
    extraRSTFalseAlarms: Array(numExtra).fill(0),
    extraRSTCorrectRejections: Array(numExtra).fill(0),

    trialMode: 'normal',
    extraTrialModes: Array(numExtra).fill('normal'),
    allTrials: [],
    scoredTrialKeys: [],
    finished: false,
  };
}

// ─── Stimulus Generation ──────────────────────────────────────────────────────

export function generateNextStimulus(state) {
  const {
    nLevel, round, historyA, typeHistoryA, modes, relationshipPool,
    extraHistories, extraTypeHistories, rintStates, hierHistories, alienSettings,
    streamTypes, extraRSTChains, wrapperMorphStyle
  } = state;

  const isNRINT = modes.includes('nonverbal_rint');
  const isTJN = modes.includes('trajectory_nback');
  const hasDistractors = modes.includes('distractors');
  const hasLures = modes.includes('lures');
  const negationMode = modes.includes('negation');
  const isImpossible = modes.includes('impossible');
  const relationModes = (modes || []).filter(m => m !== 'cct');
  const stypeOf = (idx) => (streamTypes && streamTypes[idx]) || 'relation';

  // ── Trajectory N-Back / Schema Transfer: full short-circuit. Look up
  // which block this trial belongs to. Once the N-back history is filled
  // and we're in the same block, balance the node selection to roughly
  // MATCH_CHANCE target rate — otherwise the natural random walk plus
  // tier rules either floods targets (Hard / small graphs) or starves
  // them (Easy / large graphs). Before history fills we just consume
  // the pre-planned walk so the player sees a natural-looking sequence.
  if (isTJN && state.tjnState) {
    const { blocks, tier, K, schemaMode } = state.tjnState;
    // Find the block this trial belongs to.
    const block = blocks.find(b => round >= b.startTrial && round < b.endTrial) || blocks[blocks.length - 1];
    const localIndex = round - block.startTrial;
    let goal = block.goals?.[localIndex] ?? null;
    const learnPhase = localIndex < TJN_LEARN_TRIALS;

    // Decide the current node.
    let node;
    const past = historyA.length >= nLevel ? historyA[historyA.length - nLevel] : null;
    const pastInSameBlock = !!past?._tjn && past._tjn.blockIndex === block.blockIndex;
    // Extreme tier: re-pick the goal so the shortest path nBackNode → goal
    // has at least 1 intermediate node (path length ≥ 3). Otherwise on
    // small / dense graphs most goals would yield empty path-intermediate
    // sets and target rate would collapse to ~5%.
    if (pastInSameBlock && tier === 'extreme') {
      const nBackNode = past._tjn.node;
      const farEnough = block.graph.nodes.filter(n => {
        if (n === nBackNode) return false;
        const p = shortestPath(block.graph, nBackNode, n);
        return p && p.length >= 3;
      });
      if (farEnough.length > 0) {
        goal = farEnough[Math.floor(Math.random() * farEnough.length)];
      }
    }
    if (pastInSameBlock) {
      // Compute the set of nodes that WOULD be targets per the tier rule,
      // then pick from the target set with probability MATCH_CHANCE and
      // from its complement otherwise. Keeps target rate near ~25-33%
      // regardless of topology and tier.
      const allNodes = block.graph.nodes;
      const nBackNode = past._tjn.node;
      let targetSet = new Set();
      if (tier === 'easy') {
        targetSet.add(nBackNode);
      } else if (tier === 'medium') {
        (block.graph.adjacency[nBackNode] || []).forEach(n => targetSet.add(n));
      } else if (tier === 'hard') {
        targetSet = new Set([...allNodes].filter(n => evalTJNTarget({ tier, currentNode: n, nBackNode, graph: block.graph, K })));
      } else if (tier === 'extreme') {
        if (goal != null && goal !== nBackNode) {
          const path = shortestPath(block.graph, nBackNode, goal);
          if (path && path.length >= 3) path.slice(1, -1).forEach(n => targetSet.add(n));
        }
      }
      const nonTargetNodes = allNodes.filter(n => !targetSet.has(n));
      const wantTarget = Math.random() < MATCH_CHANCE;
      // Fall back to the other set if the desired one is empty (e.g. tier=easy
      // when N-back uniquely targets one node and we want a non-target we
      // pick anything else; if want a target the set is {nBackNode}).
      let pool;
      if (wantTarget && targetSet.size > 0) pool = [...targetSet];
      else if (!wantTarget && nonTargetNodes.length > 0) pool = nonTargetNodes;
      else if (targetSet.size > 0) pool = [...targetSet];
      else pool = allNodes;
      node = pool[Math.floor(Math.random() * pool.length)];
    } else {
      // Pre-target trials: consume the pre-planned walk so the player gets
      // a natural-looking traversal during the learn-phase warm-up.
      node = block.walk[localIndex] != null ? block.walk[localIndex] : block.graph.nodes[0];
    }

    const stim = {
      rel: TJN_NODE_REL,
      _tjn: {
        node, tier, K, goal, learnPhase,
        graph: block.graph,
        blockIndex: block.blockIndex,
        blockLabel: block.label,
        blockColor: block.color,
        schemaMode: !!schemaMode,
      },
      // dummy visual props so any generic renderer doesn't crash
      shapeA: 'circle', shapeB: 'circle',
      colorA: COLORS[0], colorB: COLORS[1],
      renderMode: 0,
    };
    const effectiveNTJN = nLevel;
    const isTarget = evaluateStimulusForMode({
      stim, mode: 'tjn', history: historyA, typeHistory: typeHistoryA, rintState: null,
      effectiveN: effectiveNTJN, hierHistory: [],
    });
    return {
      stimA: stim,
      relA: TJN_NODE_REL,
      isTargetA: isTarget,
      isPositionTargetA: false,
      isCCTTargetA: false,
      isRSTTargetA: false,
      extraCCTTargets: [],
      extraRSTTargets: [],
      categoryA: 'TJN',
      isDistractor: false,
      effectiveN: effectiveNTJN,
      trialMode: 'tjn',
      extraTrialModes: [],
      extraStimuli: [],
      extraIsTargets: [],
      extraPositionTargets: [],
      nextRINTStates: rintStates || [],
      nextRSTChainA: state.rstChainA,
      nextExtraRSTChains: state.extraRSTChains || [],
      trialBinaryConfigs: state.trialBinaryConfigs,
      audioStreamIndexes: [],
      allCategories: ['TJN'],
    };
  }

  // ── Wrapper Morphing Integration ──
  const isMorph = modes.includes('wrapper_morph');
  const morphStyle = wrapperMorphStyle || state.wrapperMorphStyle || 'shift';
  let morphActiveCategory = null;

  // Baseline pool
  const basePool = isNRINT
    ? ['NRINT_COMPOSITE']
    : ((relationshipPool && relationshipPool.length > 0) ? relationshipPool : ALL_RELATIONSHIPS);

  let morphedPool = basePool;
  if (isMorph && !isNRINT) {
    // Dynamically identify which categories are actually enabled in the current active pool
    const activeCategories = Object.keys(RELATIONSHIP_CATEGORIES).filter(cat => 
      basePool.some(rel => RELATIONSHIP_CATEGORIES[cat].includes(rel))
    );
    if (activeCategories.length > 0) {
      const catIdx = morphStyle === 'shift' ? Math.floor(round / 5) % activeCategories.length : round % activeCategories.length;
      morphActiveCategory = activeCategories[catIdx];
      const categoryRels = RELATIONSHIP_CATEGORIES[morphActiveCategory] || [];
      // Restrict morphing to the user's chosen relations inside this active category
      const intersection = basePool.filter(rel => categoryRels.includes(rel));
      morphedPool = intersection.length > 0 ? intersection : basePool;
    }
  }

  // Visual theme matching
  const themeIndex = isMorph
    ? (morphStyle === 'shift' ? Math.floor(round / 5) % AVAILABLE_THEMES.length : round % AVAILABLE_THEMES.length)
    : 0;
  const activeTheme = isMorph ? AVAILABLE_THEMES[themeIndex] : null;

  const pool = morphedPool;

  // Variable N
  const isVariableN = modes.includes('variable_n');
  let effectiveN = nLevel;
  if (isVariableN && round >= nLevel) {
    const delta = Math.random() < 0.5 ? 1 : -1;
    const candidate = nLevel + delta;
    if (candidate >= 1 && historyA.length >= candidate) effectiveN = candidate;
  }

  const trialIndex = round;
  const isBinaryLogic = modes.includes('binary_logic');
  const alienCube = modes.includes('alien_cube');
  const alienSquare = modes.includes('alien_square');
  const alienTesseract = modes.includes('alien_tesseract');
  const totalStreams = 1 + (extraHistories || []).length;
  const soundPool = pool.filter(isSound);
  const nonSoundPool = pool.filter(rel => !isSound(rel));
  const allNonSoundPool = ALL_RELATIONSHIPS.filter(rel => !isSound(rel));
  const relationStreamIndexes = Array.from({ length: totalStreams }, (_, i) => i).filter(i => stypeOf(i) === 'relation');
  // The dual-audio (L/R sound) auto-assignment restricts each relation stream
  // to a sound-only or non-sound pool. That conflicts with the Decoy Filter,
  // whose per-stream decoy categories are drawn from the FULL pool — on a
  // sound-restricted stream the decoy category would never appear and the
  // filter would silently do nothing. So when decoy_filter is active, every
  // stream keeps the full pool (no sound auto-restriction).
  const decoyFilterOn = (modes || []).includes('decoy_filter');
  const audioStreamIndexes = (!decoyFilterOn && relationStreamIndexes.length >= 2 && soundPool.length > 0) ? pickSoundStreamIndexes(relationStreamIndexes) : [];
  const streamPoolFor = (index) => {
    if (stypeOf(index) === 'cct') return ['CCT_NUMERIC'];
    if (audioStreamIndexes.includes(index)) return soundPool;
    if (audioStreamIndexes.length > 0) return nonSoundPool.length > 0 ? nonSoundPool : allNonSoundPool;
    return pool;
  };
  // Per-stream decoy categories (decoy_filter mode); [] when inactive.
  const decoyFilterRule = state.decoyFilterRule || 'never_target';
  const decoyCatsFor = (index) => (state.streamDecoyCats && state.streamDecoyCats[index]) || [];

  // Generate per-trial binary configs if binary_logic mode is active
  const trialBinaryConfigs = isBinaryLogic
    ? Array.from({ length: totalStreams }, () => randomBinaryConfig(effectiveN))
    : Array(totalStreams).fill({ primaryMode: 'normal', binaryMode: null, binaryOp: 'AND' });

  // ── Stream A ──
  const baseTrialModeA = isBinaryLogic
    ? (trialBinaryConfigs[0].primaryMode === 'rint' && effectiveN >= RINT_MIN_N ? 'rint'
        : trialBinaryConfigs[0].primaryMode === 'type' ? 'type'
        : trialBinaryConfigs[0].primaryMode === 'hierarchical' ? 'hierarchical'
        : 'normal')
    : rollTrialMode(relationModes, effectiveN);
  const trialModeA = stypeOf(0) === 'cct' ? 'cct' : baseTrialModeA;

  const rintStateA = (rintStates && rintStates[0]) ? rintStates[0] : createRINTState();
  const cfgA = trialBinaryConfigs[0];

  const nrintEnabledFlags = state.nrintEnabledFlags || NRINT_DEFAULT_FLAGS;
  const nrintHideLegend = !!state.nrintHideLegend;
  const nrintMaxPerTrial = Number(state.nrintMaxPerTrial) || 0;
  const nrintMatchRule = NRINT_MATCH_RULES.includes(state.nrintMatchRule) ? state.nrintMatchRule : 'union';
  const nrintMatchRuleWeights = state.nrintMatchRuleWeights || normalizeNrintRuleWeights(nrintMatchRule);
  const customLureRate = state.adaptiveLureRate !== undefined ? state.adaptiveLureRate : null;
  const customNegationRate = state.adaptiveNegationRate !== undefined ? state.adaptiveNegationRate : null;

  const resultA = generateOneStreamStimulus({
    history: historyA,
    typeHistory: typeHistoryA,
    rintState: rintStateA,
    pool: streamPoolFor(0), effectiveN,
    trialMode: trialModeA,
    matchChance: MATCH_CHANCE,
    hasDistractors, hasLures, negationMode, trialIndex,
    hierHistory: (hierHistories || [])[0] || [],
    binaryMode: isBinaryLogic ? cfgA.binaryMode : null,
    binaryOp: cfgA.binaryOp,
    alienCube,
    alienSquare,
    alienTesseract,
    alienSettings,
    nrintEnabledFlags,
    nrintHideLegend,
    nrintMaxPerTrial,
    nrintMatchRule,
    nrintMatchRuleWeights,
    decoyCats: decoyCatsFor(0),
    decoyFilterRule,
    customLureRate,
    customNegationRate,
    modes,
  });

  const stimA = resultA.stim;
  if (activeTheme) {
    stimA._activeTheme = activeTheme;
  }
  if (isMorph && LANDSCAPE_PATHS.length > 0) {
    const imgIdx = (0 + (morphStyle === 'shift' ? Math.floor(round / 5) : round)) % LANDSCAPE_PATHS.length;
    stimA._backgroundImage = LANDSCAPE_PATHS[imgIdx];
  }
  const categoryA = getCategory(stimA.rel);

  // ── Extra streams ──
  const extraStreamModes = (extraHistories || []).map((_, i) => {
    const idx = 1 + i;
    if (stypeOf(idx) === 'cct') return 'cct';
    if (isBinaryLogic) {
      const pm = trialBinaryConfigs[idx]?.primaryMode;
      return pm === 'rint' && effectiveN >= RINT_MIN_N ? 'rint' : pm === 'type' ? 'type' : pm === 'hierarchical' ? 'hierarchical' : 'normal';
    }
    return isImpossible ? rollTrialMode(relationModes, effectiveN) : baseTrialModeA;
  });

  const extraResults = (extraHistories || []).map((hist, i) => {
    const streamRINTState = (rintStates && rintStates[1 + i]) ? rintStates[1 + i] : createRINTState();
    const cfg = trialBinaryConfigs[1 + i] || { primaryMode: 'normal', binaryMode: null, binaryOp: 'AND' };
    const res = generateOneStreamStimulus({
      history: hist,
      typeHistory: extraTypeHistories[i] || new Map(),
      rintState: streamRINTState,
      pool: streamPoolFor(1 + i), effectiveN,
      trialMode: extraStreamModes[i],
      matchChance: DUAL_MATCH_CHANCE,
      hasDistractors, hasLures, negationMode, trialIndex,
      hierHistory: (hierHistories || [])[1 + i] || [],
      binaryMode: isBinaryLogic ? cfg.binaryMode : null,
      binaryOp: cfg.binaryOp,
      alienCube,
      alienSquare,
      alienTesseract,
      alienSettings,
      nrintEnabledFlags,
      nrintHideLegend,
      nrintMaxPerTrial,
      nrintMatchRule,
      nrintMatchRuleWeights,
      decoyCats: decoyCatsFor(1 + i),
      decoyFilterRule,
      customLureRate,
      customNegationRate,
      modes,
    });
    if (activeTheme && res.stim) {
      res.stim._activeTheme = activeTheme;
    }
    if (isMorph && res.stim && LANDSCAPE_PATHS.length > 0) {
      const imgIdx = ((1 + i) + (morphStyle === 'shift' ? Math.floor(round / 5) : round)) % LANDSCAPE_PATHS.length;
      res.stim._backgroundImage = LANDSCAPE_PATHS[imgIdx];
    }
    return res;
  });

  // ── CCT side-task layer ──
  // When the global 'cct_overlay' mode is on, every relation-typed stream
  // gets a (digit + candidate-result) layer painted onto its stim. Pure
  // CCT-typed streams already produce that data natively. The player gets a
  // second response axis per stream (cctKey) — parallel to the position
  // axis used by alien modes.
  const cctOverlay = modes.includes('cct_overlay');
  let isCCTTargetA = false;
  const extraCCTTargets = [];
  if (cctOverlay) {
    if (resultA.stim.rel === 'CCT_NUMERIC') {
      // Pure CCT stream: the relation match IS the CCT match. Mirror.
      isCCTTargetA = resultA.isTarget;
    } else {
      const layer = generateCCTLayer(historyA, effectiveN, MATCH_CHANCE);
      resultA.stim = { ...resultA.stim, cctNumber: layer.number, cctResult: layer.result };
      isCCTTargetA = layer.isTarget;
    }
    extraResults.forEach((r, i) => {
      if (r.stim.rel === 'CCT_NUMERIC') {
        extraCCTTargets.push(r.isTarget);
      } else {
        const layer = generateCCTLayer(extraHistories[i], effectiveN, DUAL_MATCH_CHANCE);
        r.stim = { ...r.stim, cctNumber: layer.number, cctResult: layer.result };
        extraCCTTargets.push(layer.isTarget);
      }
    });
  } else {
    // Pure CCT streams still have isCCTTarget = isTarget for trial records.
    isCCTTargetA = resultA.stim?.rel === 'CCT_NUMERIC' ? resultA.isTarget : false;
    extraResults.forEach((r) => {
      extraCCTTargets.push(r.stim?.rel === 'CCT_NUMERIC' ? r.isTarget : false);
    });
  }

  // ── RST side-task layer (Reasoning Side-Task) ──
  // CCT-shaped n-back over Distinction premises. Every trial advances the
  // RST chain by one entity and emits a premise. From trial N onwards a
  // candidate conclusion is shown for the player to evaluate. Scoring only
  // fires on trials where hasConclusion is true.
  let isRSTTargetA = false;
  let nextRSTChainA = state.rstChainA;
  const extraRSTTargets = [];
  const nextExtraRSTChains = [...(extraRSTChains || [])];

  if (modes.includes('rst_overlay')) {
    const difficultyA = state.rstDifficulty || 'easy';
    const turnA = nextRSTTurn(state.rstChainA || createRSTChain(pickRSTFamily(difficultyA)), effectiveN, MATCH_CHANCE);
    nextRSTChainA = turnA.chain;
    resultA.stim = {
      ...resultA.stim,
      _rst: {
        premise: turnA.premise,
        conclusion: turnA.conclusion,
        hasConclusion: turnA.hasConclusion,
        family: turnA.family,
        // SOA hint — engine consumer (GameScreen) extends stimulus duration
        // when a heavy-family trial fires so the reading load is sustainable.
        heavy: isHeavyFamily(turnA.family),
      },
    };
    isRSTTargetA = !!turnA.isValid;

    (extraHistories || []).forEach((hist, i) => {
      const currentChain = nextExtraRSTChains[i] || createRSTChain(pickRSTFamily(difficultyA));
      const turn = nextRSTTurn(currentChain, effectiveN, DUAL_MATCH_CHANCE);
      nextExtraRSTChains[i] = turn.chain;
      if (extraResults[i]) {
        extraResults[i].stim = {
          ...extraResults[i].stim,
          _rst: {
            premise: turn.premise,
            conclusion: turn.conclusion,
            hasConclusion: turn.hasConclusion,
            family: turn.family,
            heavy: isHeavyFamily(turn.family),
          },
        };
      }
      extraRSTTargets.push(!!turn.isValid);
    });
  } else {
    (extraHistories || []).forEach(() => {
      extraRSTTargets.push(false);
    });
  }

  // Compute next RINT states array
  const nextRINTStates = (rintStates || []).map((rs, i) => {
    if (i === 0) return resultA.nextRINTState;
    const res = extraResults[i - 1];
    return res ? res.nextRINTState : rs;
  });

  return {
    stimA: resultA.stim,
    relA: resultA.stim.rel,
    isTargetA: resultA.isTarget,
    isPositionTargetA: resultA.isPositionTarget,
    isCCTTargetA,
    isRSTTargetA,
    extraCCTTargets,
    extraRSTTargets,
    categoryA,
    isDistractor: false,
    effectiveN,
    trialMode: trialModeA,
    extraTrialModes: extraStreamModes,
    extraStimuli: extraResults.map(r => r.stim),
    extraIsTargets: extraResults.map(r => r.isTarget),
    extraPositionTargets: extraResults.map(r => r.isPositionTarget),
    nextRINTStates,
    nextRSTChainA,
    nextExtraRSTChains,
    trialBinaryConfigs,
    audioStreamIndexes,
    // Per-stream categories for hierarchical history update
    allCategories: [categoryA, ...extraResults.map(r => getCategory(r.stim.rel))],
  };
}

// ─── Advance Round ────────────────────────────────────────────────────────────

export function advanceRound(state, stimulus) {
  const {
    stimA, relA, extraStimuli, extraIsTargets, extraPositionTargets,
    isTargetA, isPositionTargetA, isCCTTargetA, isRSTTargetA, extraCCTTargets, categoryA, isDistractor,
    effectiveN, trialMode, extraTrialModes, nextRINTStates, allCategories, trialBinaryConfigs, audioStreamIndexes,
    nextRSTChainA, extraRSTTargets, nextExtraRSTChains,
  } = stimulus;
  const trialIndex = state.round;

  const nextTypeHistoryA = pushTypeHistory(state.typeHistoryA, relA, { ...stimA, trialIndex });

  const nextExtraHistories = (state.extraHistories || []).map((hist, i) =>
    extraStimuli[i] ? [...hist, extraStimuli[i]] : hist
  );
  const nextExtraTypeHistories = (state.extraTypeHistories || []).map((th, i) =>
    extraStimuli[i] ? pushTypeHistory(th, extraStimuli[i].rel, { ...extraStimuli[i], trialIndex }) : th
  );

  // Update per-stream hier histories
  const nextHierHistories = (state.hierHistories || []).map((hh, i) => {
    const cat = (allCategories || [])[i];
    return cat ? [...hh, cat] : hh;
  });

  return {
    ...state,
    round: state.round + 1,
    currentEffectiveN: effectiveN ?? state.nLevel,
    historyA: [...state.historyA, stimA],
    typeHistoryA: nextTypeHistoryA,
    extraHistories: nextExtraHistories,
    extraTypeHistories: nextExtraTypeHistories,
    hierHistories: nextHierHistories,
    extraCurrentRels: (extraStimuli || []).map(s => s?.rel ?? null),
    extraCurrentStimuli: extraStimuli || [],
    extraIsTargets: extraIsTargets || [],
    extraPositionTargets: extraPositionTargets || [],
    extraCCTTargets: extraCCTTargets || [],
    extraRSTTargets: extraRSTTargets || [],
    extraResponded: Array(state.numExtraStreams).fill(false),
    extraPositionResponded: Array(state.numExtraStreams).fill(false),
    extraCCTResponded: Array(state.numExtraStreams).fill(false),
    extraRSTResponded: Array(state.numExtraStreams).fill(false),
    extraTrialModes: extraTrialModes || Array(state.numExtraStreams).fill('normal'),
    currentRelationship: relA,
    currentStimulusA: stimA,
    currentCategory: categoryA,
    isTargetA,
    isPositionTargetA,
    isCCTTargetA: !!isCCTTargetA,
    isRSTTargetA: !!isRSTTargetA,
    isDistractor,
    trialMode: trialMode ?? 'normal',
    rintStates: nextRINTStates ?? state.rintStates,
    trialBinaryConfigs: trialBinaryConfigs ?? state.trialBinaryConfigs,
    audioStreamIndexes: audioStreamIndexes ?? [],
    rstChainA: nextRSTChainA ?? state.rstChainA,
    extraRSTChains: nextExtraRSTChains || state.extraRSTChains || [],
    respondedA: false,
    positionRespondedA: false,
    cctRespondedA: false,
    rstRespondedA: false,
    finished: state.round + 1 >= state.totalRounds,
  };
}

// ─── Process Responses ────────────────────────────────────────────────────────

export function processResponses(state, { pressedA, pressedExtra = [], pressedPositionA = false, pressedPositionExtra = [], pressedCCTA = false, pressedCCTExtra = [], pressedRSTA = false, pressedRSTExtra = [] }) {
  const trialKey = state.round;
  if ((state.scoredTrialKeys || []).includes(trialKey)) return state;

  const hasAlienPosition = state.modes?.includes('alien_cube') || state.modes?.includes('alien_tesseract') || state.modes?.includes('alien_square');
  const hasCCTOverlay = state.modes?.includes('cct_overlay');
  const hasRSTOverlay = state.modes?.includes('rst_overlay');
  let next = { ...state, scoredTrialKeys: [...(state.scoredTrialKeys || []), trialKey] };
  const trialRecords = [];

  // Stream A relation
  if (state.isTargetA && pressedA) next.hitsA++;
  else if (state.isTargetA && !pressedA) next.missesA++;
  else if (!state.isTargetA && pressedA) next.falseAlarmsA++;
  else next.correctRejectionsA++;
  // Lure-trial sub-tally (lures are never targets, so they only show up in
  // the FA / CR branches). Track them separately so the results screen can
  // surface "lure resistance" — a key Capacity-Gym-style construct.
  if (state.currentStimulusA?._isLure) {
    if (pressedA) next.lureFalseAlarmsA = (next.lureFalseAlarmsA || 0) + 1;
    else next.lureCorrectRejectionsA = (next.lureCorrectRejectionsA || 0) + 1;
  }

  if (hasAlienPosition) {
    if (state.isPositionTargetA && pressedPositionA) next.positionHitsA++;
    else if (state.isPositionTargetA && !pressedPositionA) next.positionMissesA++;
    else if (!state.isPositionTargetA && pressedPositionA) next.positionFalseAlarmsA++;
    else next.positionCorrectRejectionsA++;
  }

  if (hasCCTOverlay) {
    // Only score when the CCT layer was actually shown for this trial
    // (cctResult != null means we had enough history to display one).
    const hasLayer = state.currentStimulusA?.cctResult != null;
    if (hasLayer) {
      if (state.isCCTTargetA && pressedCCTA) next.cctHitsA = (next.cctHitsA || 0) + 1;
      else if (state.isCCTTargetA && !pressedCCTA) next.cctMissesA = (next.cctMissesA || 0) + 1;
      else if (!state.isCCTTargetA && pressedCCTA) next.cctFalseAlarmsA = (next.cctFalseAlarmsA || 0) + 1;
      else next.cctCorrectRejectionsA = (next.cctCorrectRejectionsA || 0) + 1;
    }
  }

  if (hasRSTOverlay && state.currentStimulusA?._rst?.hasConclusion) {
    // Score only when a conclusion was shown. Pre-N trials have a premise
    // only — no target to evaluate, no scoring.
    if (state.isRSTTargetA && pressedRSTA) next.rstHitsA = (next.rstHitsA || 0) + 1;
    else if (state.isRSTTargetA && !pressedRSTA) next.rstMissesA = (next.rstMissesA || 0) + 1;
    else if (!state.isRSTTargetA && pressedRSTA) next.rstFalseAlarmsA = (next.rstFalseAlarmsA || 0) + 1;
    else next.rstCorrectRejectionsA = (next.rstCorrectRejectionsA || 0) + 1;
  }

  trialRecords.push({
    trialNumber: state.round,
    streamLabel: 'A',
    relationship: state.currentRelationship,
    stimulus: state.currentStimulusA,
    trialMode: state.trialMode,
    isTarget: state.isTargetA,
    userResponded: !!pressedA,
    correct: state.isTargetA === !!pressedA,
    responseType: 'relation',
    nBackValue: state.currentEffectiveN ?? state.nLevel,
    isLure: !!state.currentStimulusA?._isLure,
    lureOffset: state.currentStimulusA?._lureOffset || 0,
    negated: !!state.currentStimulusA?._negated,
    binaryLogicPrimary: state.trialBinaryConfigs?.[0]?.primaryMode,
    binaryLogicSecondary: state.trialBinaryConfigs?.[0]?.binaryMode,
    binaryLogicOp: state.trialBinaryConfigs?.[0]?.binaryOp,
  });

  if (hasAlienPosition) {
    trialRecords.push({
      trialNumber: state.round,
      streamLabel: 'A',
      relationship: state.currentRelationship,
      stimulus: state.currentStimulusA,
      trialMode: state.trialMode,
      isTarget: state.isPositionTargetA,
      userResponded: !!pressedPositionA,
      correct: state.isPositionTargetA === !!pressedPositionA,
      responseType: 'position',
      nBackValue: state.currentEffectiveN ?? state.nLevel,
      binaryLogicPrimary: state.trialBinaryConfigs?.[0]?.primaryMode,
      binaryLogicSecondary: state.trialBinaryConfigs?.[0]?.binaryMode,
      binaryLogicOp: state.trialBinaryConfigs?.[0]?.binaryOp,
    });
  }

  if (hasCCTOverlay && state.currentStimulusA?.cctResult != null) {
    trialRecords.push({
      trialNumber: state.round,
      streamLabel: 'A',
      relationship: state.currentRelationship,
      stimulus: state.currentStimulusA,
      trialMode: state.trialMode,
      isTarget: state.isCCTTargetA,
      userResponded: !!pressedCCTA,
      correct: state.isCCTTargetA === !!pressedCCTA,
      responseType: 'cct',
      nBackValue: state.currentEffectiveN ?? state.nLevel,
    });
  }

  if (hasRSTOverlay && state.currentStimulusA?._rst?.hasConclusion) {
    trialRecords.push({
      trialNumber: state.round,
      streamLabel: 'A',
      relationship: state.currentRelationship,
      stimulus: state.currentStimulusA,
      trialMode: state.trialMode,
      isTarget: state.isRSTTargetA,
      userResponded: !!pressedRSTA,
      correct: state.isRSTTargetA === !!pressedRSTA,
      responseType: 'rst',
      rst: state.currentStimulusA._rst,
      nBackValue: state.currentEffectiveN ?? state.nLevel,
    });
  }

  // Extra streams
  const nextExtraHits = [...(state.extraHits || [])];
  const nextExtraMisses = [...(state.extraMisses || [])];
  const nextExtraFA = [...(state.extraFalseAlarms || [])];
  const nextExtraCR = [...(state.extraCorrectRejections || [])];
  const nextExtraPositionHits = [...(state.extraPositionHits || [])];
  const nextExtraPositionMisses = [...(state.extraPositionMisses || [])];
  const nextExtraPositionFA = [...(state.extraPositionFalseAlarms || [])];
  const nextExtraPositionCR = [...(state.extraPositionCorrectRejections || [])];
  const nextExtraCCTHits = [...(state.extraCCTHits || [])];
  const nextExtraCCTMisses = [...(state.extraCCTMisses || [])];
  const nextExtraCCTFA = [...(state.extraCCTFalseAlarms || [])];
  const nextExtraCCTCR = [...(state.extraCCTCorrectRejections || [])];
  const nextExtraLureFA = [...(state.extraLureFalseAlarms || [])];
  const nextExtraLureCR = [...(state.extraLureCorrectRejections || [])];
  const nextExtraRSTHits = [...(state.extraRSTHits || [])];
  const nextExtraRSTMisses = [...(state.extraRSTMisses || [])];
  const nextExtraRSTFA = [...(state.extraRSTFalseAlarms || [])];
  const nextExtraRSTCR = [...(state.extraRSTCorrectRejections || [])];
  (state.extraIsTargets || []).forEach((isTarget, i) => {
    const pressed = pressedExtra[i] || false;
    if (isTarget && pressed) nextExtraHits[i] = (nextExtraHits[i] || 0) + 1;
    else if (isTarget && !pressed) nextExtraMisses[i] = (nextExtraMisses[i] || 0) + 1;
    else if (!isTarget && pressed) nextExtraFA[i] = (nextExtraFA[i] || 0) + 1;
    else nextExtraCR[i] = (nextExtraCR[i] || 0) + 1;
    if (state.extraCurrentStimuli?.[i]?._isLure) {
      if (pressed) nextExtraLureFA[i] = (nextExtraLureFA[i] || 0) + 1;
      else nextExtraLureCR[i] = (nextExtraLureCR[i] || 0) + 1;
    }

    trialRecords.push({
      trialNumber: state.round,
      streamLabel: String.fromCharCode(66 + i),
      relationship: state.extraCurrentRels?.[i],
      stimulus: state.extraCurrentStimuli?.[i],
      trialMode: state.extraTrialModes?.[i] || 'normal',
      isTarget,
      userResponded: pressed,
      correct: isTarget === pressed,
      responseType: 'relation',
      nBackValue: state.currentEffectiveN ?? state.nLevel,
      isLure: !!state.extraCurrentStimuli?.[i]?._isLure,
      lureOffset: state.extraCurrentStimuli?.[i]?._lureOffset || 0,
      negated: !!state.extraCurrentStimuli?.[i]?._negated,
      binaryLogicPrimary: state.trialBinaryConfigs?.[i + 1]?.primaryMode,
      binaryLogicSecondary: state.trialBinaryConfigs?.[i + 1]?.binaryMode,
      binaryLogicOp: state.trialBinaryConfigs?.[i + 1]?.binaryOp,
    });

    if (hasAlienPosition) {
      const positionTarget = (state.extraPositionTargets || [])[i] || false;
      const positionPressed = pressedPositionExtra[i] || false;
      if (positionTarget && positionPressed) nextExtraPositionHits[i] = (nextExtraPositionHits[i] || 0) + 1;
      else if (positionTarget && !positionPressed) nextExtraPositionMisses[i] = (nextExtraPositionMisses[i] || 0) + 1;
      else if (!positionTarget && positionPressed) nextExtraPositionFA[i] = (nextExtraPositionFA[i] || 0) + 1;
      else nextExtraPositionCR[i] = (nextExtraPositionCR[i] || 0) + 1;

      trialRecords.push({
        trialNumber: state.round,
        streamLabel: String.fromCharCode(66 + i),
        relationship: state.extraCurrentRels?.[i],
        stimulus: state.extraCurrentStimuli?.[i],
        trialMode: state.extraTrialModes?.[i] || 'normal',
        isTarget: positionTarget,
        userResponded: positionPressed,
        correct: positionTarget === positionPressed,
        responseType: 'position',
        nBackValue: state.currentEffectiveN ?? state.nLevel,
        binaryLogicPrimary: state.trialBinaryConfigs?.[i + 1]?.primaryMode,
        binaryLogicSecondary: state.trialBinaryConfigs?.[i + 1]?.binaryMode,
        binaryLogicOp: state.trialBinaryConfigs?.[i + 1]?.binaryOp,
      });
    }

    if (hasCCTOverlay && state.extraCurrentStimuli?.[i]?.cctResult != null) {
      const cctTarget = (state.extraCCTTargets || [])[i] || false;
      const cctPressed = pressedCCTExtra[i] || false;
      if (cctTarget && cctPressed) nextExtraCCTHits[i] = (nextExtraCCTHits[i] || 0) + 1;
      else if (cctTarget && !cctPressed) nextExtraCCTMisses[i] = (nextExtraCCTMisses[i] || 0) + 1;
      else if (!cctTarget && cctPressed) nextExtraCCTFA[i] = (nextExtraCCTFA[i] || 0) + 1;
      else nextExtraCCTCR[i] = (nextExtraCCTCR[i] || 0) + 1;

      trialRecords.push({
        trialNumber: state.round,
        streamLabel: String.fromCharCode(66 + i),
        relationship: state.extraCurrentRels?.[i],
        stimulus: state.extraCurrentStimuli?.[i],
        trialMode: state.extraTrialModes?.[i] || 'normal',
        isTarget: cctTarget,
        userResponded: cctPressed,
        correct: cctTarget === cctPressed,
        responseType: 'cct',
        nBackValue: state.currentEffectiveN ?? state.nLevel,
      });
    }

    if (hasRSTOverlay && state.extraCurrentStimuli?.[i]?._rst?.hasConclusion) {
      const rstTarget = (state.extraRSTTargets || [])[i] || false;
      const rstPressed = pressedRSTExtra[i] || false;
      if (rstTarget && rstPressed) nextExtraRSTHits[i] = (nextExtraRSTHits[i] || 0) + 1;
      else if (rstTarget && !rstPressed) nextExtraRSTMisses[i] = (nextExtraRSTMisses[i] || 0) + 1;
      else if (!rstTarget && rstPressed) nextExtraRSTFA[i] = (nextExtraRSTFA[i] || 0) + 1;
      else nextExtraRSTCR[i] = (nextExtraRSTCR[i] || 0) + 1;

      trialRecords.push({
        trialNumber: state.round,
        streamLabel: String.fromCharCode(66 + i),
        relationship: state.extraCurrentRels?.[i],
        stimulus: state.extraCurrentStimuli?.[i],
        trialMode: state.extraTrialModes?.[i] || 'normal',
        isTarget: rstTarget,
        userResponded: rstPressed,
        correct: rstTarget === rstPressed,
        responseType: 'rst',
        rst: state.extraCurrentStimuli?.[i]?._rst,
        nBackValue: state.currentEffectiveN ?? state.nLevel,
      });
    }
  });
  next.extraHits = nextExtraHits;
  next.extraMisses = nextExtraMisses;
  next.extraFalseAlarms = nextExtraFA;
  next.extraCorrectRejections = nextExtraCR;
  next.extraLureFalseAlarms = nextExtraLureFA;
  next.extraLureCorrectRejections = nextExtraLureCR;
  next.extraPositionHits = nextExtraPositionHits;
  next.extraPositionMisses = nextExtraPositionMisses;
  next.extraPositionFalseAlarms = nextExtraPositionFA;
  next.extraPositionCorrectRejections = nextExtraPositionCR;
  next.extraCCTHits = nextExtraCCTHits;
  next.extraCCTMisses = nextExtraCCTMisses;
  next.extraCCTFalseAlarms = nextExtraCCTFA;
  next.extraCCTCorrectRejections = nextExtraCCTCR;
  next.extraRSTHits = nextExtraRSTHits;
  next.extraRSTMisses = nextExtraRSTMisses;
  next.extraRSTFalseAlarms = nextExtraRSTFA;
  next.extraRSTCorrectRejections = nextExtraRSTCR;
  next.allTrials = [...(state.allTrials || []), ...trialRecords];

  // Closed-loop dynamic adaptivity adjustment
  if (next.modes?.includes('adaptive_closed_loop')) {
    const relationTrials = next.allTrials.filter(t => t.responseType === 'relation');
    const uniqueTrialNums = [...new Set(relationTrials.map(t => t.trialNumber))];
    if (uniqueTrialNums.length >= 4) {
      const recentTrialNums = uniqueTrialNums.slice(-4);
      const recentTrials = relationTrials.filter(t => recentTrialNums.includes(t.trialNumber));
      if (recentTrials.length > 0) {
        const correctCount = recentTrials.filter(t => t.correct).length;
        const accuracy = correctCount / recentTrials.length;
        
        let speedFactor = next.adaptiveSpeedMs || next.initialSpeedMs || 2800;
        let lureRate = next.adaptiveLureRate !== undefined ? next.adaptiveLureRate : 0.20;
        let negationRate = next.adaptiveNegationRate !== undefined ? next.adaptiveNegationRate : 0.30;
        let msg = '';

        if (accuracy >= 0.80) {
          speedFactor = Math.max(1000, Math.round(speedFactor * 0.92));
          lureRate = Math.min(0.50, lureRate + 0.05);
          negationRate = Math.min(0.60, negationRate + 0.05);
          if (speedFactor < (state.adaptiveSpeedMs || state.initialSpeedMs || 2800)) {
            msg = 'SPEED UP ↑ Lures & Negations Enhanced';
          } else {
            msg = 'Complexity Enhanced';
          }
        } else if (accuracy < 0.60) {
          speedFactor = Math.min(4500, Math.round(speedFactor * 1.08));
          lureRate = Math.max(0.10, lureRate - 0.05);
          negationRate = Math.max(0.15, negationRate - 0.05);
          msg = 'SPEED DOWN ↓ Complexity Eased';
        } else {
          msg = 'FLOW ZONE (In Band)';
        }

        next.adaptiveSpeedMs = speedFactor;
        next.adaptiveLureRate = lureRate;
        next.adaptiveNegationRate = negationRate;
        next.adaptiveMessage = msg;
      }
    }
  }

  return next;
}
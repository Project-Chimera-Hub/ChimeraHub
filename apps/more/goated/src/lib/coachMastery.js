// ─── Coach Mastery + Spaced-Repetition Scheduler ────────────────────────────
//
// Per-phase mastery tracking + Leitner-style spaced repetition. Phases are now
// progressed by their `difficulty` field, not by build/chronological order, so
// a newer easier phase (e.g. Phase 26 TJN Easy at D=3.0) is unlocked before a
// build-order earlier but harder one (e.g. Phase 18 Stress Inoculation at
// D=7.0).
//
// Per-phase tracking shape:
//   phaseMastery[buildIndex] = {
//     attempts, successes, masteryLevel (0..5), lastSessionN, nextReviewN
//   }
// `buildIndex` is the COACH_PHASES array index — the phase's identity. The
// dict is keyed by build index so per-phase history is stable across any
// future re-ordering.
//
// state.phaseIndex remains a BUILD INDEX (compat with every consumer that does
// `COACH_PHASES[coachState.phaseIndex]`). Its meaning shifts slightly: it now
// stores the build index of the *current frontier phase in difficulty order*
// — i.e. the lowest-difficulty phase that isn't yet level-2 mastered. The
// scheduler translates between build index and difficulty rank internally.

import { COACH_PHASES } from './gameConstants';

export const MASTERY_INTERVALS = [1, 2, 5, 11, 25, 60];
export const MASTERY_LEVELS = MASTERY_INTERVALS.length; // = 6 (0..5)
export const MASTERY_PASS_THRESHOLD = 75;
export const MASTERY_FAIL_THRESHOLD = 55;
export const REVIEW_PICK_CHANCE = 0.40;

export function blankMastery() {
  return { attempts: 0, successes: 0, masteryLevel: 0, lastSessionN: 0, nextReviewN: 0 };
}

// Returns [{ phaseIndex, difficulty }] sorted by (difficulty, phaseIndex).
// `phaseIndex` is the build-order index into COACH_PHASES (the phase identity).
// This array order is the new "frontier sequence".
export function difficultyOrder() {
  return COACH_PHASES.map((p, i) => ({ phaseIndex: i, difficulty: p.difficulty ?? 5 }))
    .sort((a, b) => (a.difficulty - b.difficulty) || (a.phaseIndex - b.phaseIndex));
}

// Position in the difficulty sequence for a given build-order phaseIndex.
export function rankOf(phaseIndex) {
  return difficultyOrder().findIndex(o => o.phaseIndex === phaseIndex);
}

// Migrate a legacy / pre-difficulty-ordered coachState to the new shape.
// Idempotent: always (re)derives `phaseIndex` as the build index of the
// lowest-difficulty not-yet-mastered phase, so the frontier is always honest.
export function migrateCoachState(state) {
  if (!state || typeof state !== 'object') {
    return { phaseIndex: 0, sessionCount: 0, phaseMastery: {}, rankName: 'Initiate (Rank I)' };
  }
  const out = { ...state };
  if (typeof out.sessionCount !== 'number') out.sessionCount = 0;
  if (!out.phaseMastery || typeof out.phaseMastery !== 'object') out.phaseMastery = {};
  const order = difficultyOrder();
  const N = order.length;

  // Fresh-from-legacy seeding: a user with no phaseMastery but a positive
  // legacy build-order phaseIndex had passed (and mastered) phases 0..p-1 in
  // build order. Mark those as level-2 mastered so they don't get reset.
  if (Object.keys(out.phaseMastery).length === 0 && typeof out.phaseIndex === 'number' && out.phaseIndex > 0) {
    for (let i = 0; i < out.phaseIndex && i < N; i++) {
      out.phaseMastery[i] = { ...blankMastery(), masteryLevel: 2, successes: 2, attempts: 2 };
    }
  }

  // (Re)derive frontier: walk difficulty order, find the first phase whose
  // mastery isn't ≥ level 2; that phase's build index is the new frontier.
  let frontierBuildIdx = order[N - 1].phaseIndex; // default: last if everything mastered
  for (let r = 0; r < N; r++) {
    const idx = order[r].phaseIndex;
    const m = out.phaseMastery[idx];
    if (!m || m.masteryLevel < 2) { frontierBuildIdx = idx; break; }
  }
  out.phaseIndex = frontierBuildIdx;

  delete out.consecutiveSuccesses;
  delete out.consecutiveFailures;
  return out;
}

// Decide which phase the next Coach Autopilot session should play.
// Returns { phaseIndex, reason } where reason ∈ 'frontier' | 'review' |
// 'advance' | 'maintenance', and `phaseIndex` is always a BUILD-ORDER index
// (the phase identity).
//
// `totalPhases` is COACH_PHASES.length (passed in for backwards compat).
export function pickNextPhase(state, totalPhases) {
  const sessionN = state.sessionCount || 0;
  const mastery = state.phaseMastery || {};
  const frontierBuildIdx = state.phaseIndex || 0;
  const order = difficultyOrder();
  const N = Math.min(order.length, totalPhases || order.length);
  const frontierRank = Math.max(0, order.findIndex(o => o.phaseIndex === frontierBuildIdx));

  // 1. Any mastered phase (level ≥ 2) due for review?
  const dueReviews = [];
  for (let i = 0; i < N; i++) {
    const m = mastery[i];
    if (m && m.masteryLevel >= 2 && (m.nextReviewN || 0) <= sessionN) dueReviews.push(i);
  }
  if (dueReviews.length > 0 && Math.random() < REVIEW_PICK_CHANCE) {
    return { phaseIndex: dueReviews[Math.floor(Math.random() * dueReviews.length)], reason: 'review' };
  }

  // 2. Frontier pick: walk difficulty order up to the frontier rank, return
  // the build index of the first phase that isn't yet level-2 mastered.
  const maxRank = Math.min(frontierRank, N - 1);
  for (let r = 0; r <= maxRank; r++) {
    const idx = order[r].phaseIndex;
    const m = mastery[idx];
    if (!m || m.masteryLevel < 2) return { phaseIndex: idx, reason: 'frontier' };
  }

  // 3. All up-to-frontier mastered → bump frontier rank by one and play that
  // phase (which becomes the new frontier).
  if (frontierRank < N - 1) {
    const idx = order[frontierRank + 1].phaseIndex;
    return { phaseIndex: idx, reason: 'advance' };
  }

  // 4. Max frontier + everything mastered → maintenance review.
  const candidates = [];
  for (let i = 0; i < N; i++) if ((mastery[i]?.masteryLevel || 0) >= 2) candidates.push(i);
  return {
    phaseIndex: candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : (order[0]?.phaseIndex ?? 0),
    reason: 'maintenance',
  };
}

// Apply a session result to the mastery record for the played phase and
// advance the global session counter. Returns the new state.
export function updateMastery(state, playedPhaseIndex, accuracy, totalPhases) {
  const next = { ...state, phaseMastery: { ...(state.phaseMastery || {}) }, sessionCount: (state.sessionCount || 0) + 1 };
  const cur = next.phaseMastery[playedPhaseIndex] || blankMastery();
  const m = { ...cur, attempts: cur.attempts + 1, lastSessionN: next.sessionCount };
  if (accuracy >= MASTERY_PASS_THRESHOLD) {
    m.successes = cur.successes + 1;
    m.masteryLevel = Math.min(MASTERY_LEVELS - 1, cur.masteryLevel + 1);
  } else if (accuracy < MASTERY_FAIL_THRESHOLD) {
    m.masteryLevel = Math.max(0, cur.masteryLevel - 1);
  }
  m.nextReviewN = next.sessionCount + MASTERY_INTERVALS[m.masteryLevel];
  next.phaseMastery[playedPhaseIndex] = m;

  // Advance the frontier (in difficulty order) when the played phase is the
  // current frontier AND it just hit L ≥ 2. The new frontier is the build
  // index of the next phase in the difficulty sequence.
  const order = difficultyOrder();
  const cap = Math.min(order.length, totalPhases || order.length);
  const frontierBuildIdx = state.phaseIndex || 0;
  const frontierRank = order.findIndex(o => o.phaseIndex === frontierBuildIdx);
  if (playedPhaseIndex === frontierBuildIdx && m.masteryLevel >= 2 && frontierRank >= 0 && frontierRank < cap - 1) {
    next.phaseIndex = order[frontierRank + 1].phaseIndex;
  }
  return next;
}

// Display title for a phase: "Phase {rank+1}: {descriptive title}" where
// rank is the position in difficulty order (1-indexed). Titles in
// gameConstants no longer hard-code "Phase NN:" prefixes since build-order
// numbering diverged from difficulty-rank ordering and looked scrambled in
// the dropdown. This helper restores a stable, monotonic numbering that
// matches the order the Coach actually walks the ladder.
export function phaseDisplayTitle(buildIdx) {
  const phase = COACH_PHASES[buildIdx];
  if (!phase) return '';
  const rank = rankOf(buildIdx);
  return rank >= 0 ? `Phase ${rank + 1}: ${phase.title}` : phase.title;
}

// Compact summary string for UI ("Lvl 3 · review in 7" or "Not attempted").
export function masteryLabel(masteryEntry, currentSessionN) {
  if (!masteryEntry || masteryEntry.attempts === 0) return 'Not attempted';
  const lvl = masteryEntry.masteryLevel;
  const due = (masteryEntry.nextReviewN || 0) - (currentSessionN || 0);
  const dueStr = due <= 0 ? 'due now' : `in ${due}`;
  return `Lvl ${lvl} · review ${dueStr}`;
}

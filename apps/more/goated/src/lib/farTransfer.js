// Capacity Credits — probe-based far-transfer + training IQ trajectory + g.
//
// Pure, deterministic computation module. Given the user's session history,
// Coach mastery state, and Reasoning Index assessments, returns:
//   - `g`            : cumulative training credit (engagement only)
//   - `iqCreditTotal`: training-estimated Δ-IQ trajectory (probe-gated)
//   - `farTransferPct`: rolling probe-win % converted to a Far Transfer Score
//   - `ground`       : Sandia ground-truth comparison + calibration verdict
//
// Methodology family: probe-based capacity-training. When a session's config
// differs from the user's recent baseline it's tagged as a SWITCH PROBE; when
// a previously-attempted phase is replayed after a gap it's tagged as a
// RECHECK. Both produce categorical outcomes (Hold / Partial / Drop) that
// accumulate into Far Transfer evidence. The training Δ-IQ trajectory only
// updates on probe outcomes — playing the same condition repeatedly grows g
// but not iqCredit. Negative Δ-IQ is real on Drop probes; the trajectory can
// move down.
//
// Coefficients here are engineered for OUR app's session shape and Coach
// difficulty range; they are not copied from any specific external product.

import { reliableChange } from './psychometrics';

export const CREDITS_DEFAULTS = {
  gTotal: 0,
  iqCreditTotal: 0,
  farTransferPct: null,
  tier: 'no_evidence',
  probesNeeded: 3,
};

// Tier thresholds for the Far Transfer Score percentage.
export const FAR_TRANSFER_TIERS = [
  { max: 30,  label: 'Early',                code: 'early' },
  { max: 60,  label: 'Consolidating',        code: 'consolidating' },
  { max: 85,  label: 'Transferring',         code: 'transferring' },
  { max: 101, label: 'Broadly transferred',  code: 'broad' },
];

const NRINT_MATCH_RULES = ['union', 'intersection', 'xor', 'implication', 'biconditional'];

// Project a session record into a stable config "fingerprint" — a bag of
// categorical features. Two sessions are considered SAME-CONFIG when their
// Hamming distance across these features is ≤ 1, and SWITCHED when it's ≥ 2.
export function configFingerprint(session) {
  if (!session) return null;
  const modes = Array.isArray(session.modes) ? session.modes : [];
  const nLevel = Number(session.nLevel) || 0;
  const streamCount = 1 + ((session.extraStreams?.length) || (session.extraStreamStats?.length) || 0);
  // Dominant NRINT rule: argmax of nrintMatchRuleWeights, falling back to the
  // legacy nrintMatchRule string when no weights present.
  let dominantRule = null;
  const w = session.nrintMatchRuleWeights;
  if (w && typeof w === 'object') {
    let best = null, bestW = 0;
    for (const r of NRINT_MATCH_RULES) {
      const wr = Number(w[r]) || 0;
      if (wr > bestW) { bestW = wr; best = r; }
    }
    dominantRule = best;
  } else if (session.nrintMatchRule) {
    dominantRule = session.nrintMatchRule;
  }
  return {
    modeSet: [...modes].sort().join(','),
    nLevelBand: Math.floor(nLevel / 2),
    dominantRule: dominantRule || null,
    streamCount,
    hasCCT: modes.includes('cct'),
    hasRST: modes.includes('rst_overlay'),
    hasTJN: modes.includes('trajectory_nback'),
    hasDecoy: !!session.decoyFilterActive,
    hasNRINT: modes.includes('nonverbal_rint'),
  };
}

// Number of feature differences between two fingerprints.
export function hammingDistance(a, b) {
  if (!a || !b) return Infinity;
  let d = 0;
  for (const k of Object.keys(a)) if (a[k] !== b[k]) d++;
  return d;
}

// Look up the player's recent baseline accuracy for a given fingerprint.
// Walks history newest-first, picks up to 5 same-config sessions (Hamming ≤ 1),
// and averages their accuracy. Falls back to the global mean over the most
// recent 10 sessions when no similar config has been played yet.
function lookupBaselineAccuracy(targetFp, history) {
  const similar = [];
  for (let i = history.length - 1; i >= 0 && similar.length < 5; i--) {
    const fp = configFingerprint(history[i]);
    if (hammingDistance(fp, targetFp) <= 1) similar.push(history[i]);
  }
  if (similar.length > 0) {
    const mean = similar.reduce((s, x) => s + (Number(x.accuracy) || 0), 0) / similar.length;
    return { acc: mean, source: `${similar.length} similar-config session${similar.length === 1 ? '' : 's'}` };
  }
  const recent = history.slice(-10);
  if (recent.length === 0) return { acc: null, source: 'no history' };
  const mean = recent.reduce((s, x) => s + (Number(x.accuracy) || 0), 0) / recent.length;
  return { acc: mean, source: `global mean (last ${recent.length})` };
}

function classifyOutcome(delta) {
  if (delta >= -5) return 'Hold';
  if (delta >= -15) return 'Partial';
  return 'Drop';
}

function probeScore(outcome) {
  return outcome === 'Hold' ? 1.0 : outcome === 'Partial' ? 0.5 : outcome === 'Drop' ? 0.0 : 0.0;
}

// Inspect this session against the player's prior history + coach state and
// decide whether it counts as a switch probe, a recheck, or neither.
//
// Switch probe: this session's fingerprint differs from the immediately prior
// session's fingerprint by ≥ 2 features AND at least one similar-config
// baseline exists earlier in history (else there's nothing to compare).
//
// Recheck: this session played a phase whose mastery record's lastSessionN is
// at least 5 sessions ago — the user is re-testing an older capability.
export function classifyProbe(thisSession, history, coachState) {
  const fp = configFingerprint(thisSession);
  if (!fp) return { kind: null, outcome: null, delta: 0, baselineAcc: null, baselineSource: null };

  // Recheck takes precedence — it's a stronger transfer signal than a switch.
  const playedPhaseIdx = thisSession.coachPickedPhaseIndex;
  const phaseMastery = coachState?.phaseMastery?.[playedPhaseIdx];
  const sessionN = coachState?.sessionCount || 0;
  if (
    playedPhaseIdx != null &&
    phaseMastery &&
    phaseMastery.attempts > 0 &&
    sessionN - (phaseMastery.lastSessionN || 0) >= 5
  ) {
    // Compare to the player's last accuracy on this same phase (if recorded
    // — best signal is the phase's previous attempt accuracy).
    let priorAcc = null;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].coachPickedPhaseIndex === playedPhaseIdx) {
        priorAcc = Number(history[i].accuracy) || null;
        break;
      }
    }
    const baseline = priorAcc != null ? priorAcc : (lookupBaselineAccuracy(fp, history).acc);
    if (baseline != null) {
      const delta = Number(thisSession.accuracy) - baseline;
      return {
        kind: 'recheck',
        outcome: classifyOutcome(delta),
        delta: Math.round(delta * 10) / 10,
        baselineAcc: Math.round(baseline * 10) / 10,
        baselineSource: priorAcc != null ? 'prior phase attempt' : 'similar-config baseline',
      };
    }
  }

  // Switch probe
  const prev = history.length > 0 ? history[history.length - 1] : null;
  const prevFp = configFingerprint(prev);
  if (prevFp && hammingDistance(fp, prevFp) >= 2) {
    const { acc, source } = lookupBaselineAccuracy(fp, history);
    if (acc != null) {
      const delta = Number(thisSession.accuracy) - acc;
      return {
        kind: 'switch',
        outcome: classifyOutcome(delta),
        delta: Math.round(delta * 10) / 10,
        baselineAcc: Math.round(acc * 10) / 10,
        baselineSource: source,
      };
    }
  }

  return { kind: null, outcome: null, delta: 0, baselineAcc: null, baselineSource: null };
}

// Compute g for a single session.
function gForSession(session, difficulty) {
  const modesCount = (session.modes?.length) || 0;
  const diversityBonus = Math.min(1.5, 1 + 0.1 * Math.max(0, modesCount - 1));
  const durationFactor = Math.min(1, (Number(session.totalTrials) || 0) / 30);
  const acc = Math.max(0, Math.min(100, Number(session.accuracy) || 0));
  const d = Number(difficulty) || 5;
  return Math.round(d * 10 * (acc / 100) * durationFactor * diversityBonus);
}

// Resolve a difficulty for a session: prefer the coach-picked phase's
// `.difficulty`; fall back to 5 (mid-band).
function difficultyForSession(session, coachPhases) {
  const idx = session.coachPickedPhaseIndex;
  if (idx != null && coachPhases && coachPhases[idx]) {
    return Number(coachPhases[idx].difficulty) || 5;
  }
  return 5;
}

// Compute per-session credits for a single new session. Pure: no IO. Called at
// session-finish to derive fields persisted onto the session record.
export function computeSessionCredits(thisSession, history, coachState, coachPhases) {
  const difficulty = difficultyForSession(thisSession, coachPhases);
  const g = gForSession(thisSession, difficulty);
  const probe = classifyProbe(thisSession, history, coachState);
  // Coefficient tuned so a typical Coach session at mid difficulty (D≈5)
  // yields ~0.15 ΔIQ on a Hold probe; ~5 such probes/week → ~3 training-IQ
  // per month, the top of the defensible engagement range. Drop adds a tiny
  // tax so the trajectory can move down.
  let iqCredit = 0;
  if (probe.kind && probe.outcome) {
    iqCredit = Math.round(probeScore(probe.outcome) * difficulty * 0.03 * 100) / 100;
    if (probe.outcome === 'Drop') iqCredit -= 0.02;
  }
  return { g, probe, iqCredit };
}

// Compute the cumulative trio + ground-truth comparison from the full history.
// `assessments` is the Reasoning Index assessment list (chronological); when
// at least two exist we surface a validated Δ-IQ alongside.
export function computeCapacityCredits(sessions, coachState, assessments, coachPhases) {
  const perSession = [];
  let gTotal = 0;
  let iqCreditTotal = 0;
  const probes = { switches: [], rechecks: [] };

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const history = sessions.slice(0, i);
    // Use saved g/iqCredit when present; recompute otherwise so older sessions
    // backfill on the fly without a migration.
    let g = Number(s.gThisSession);
    let probeKind = s.probeKind || null;
    let probeOutcome = s.probeOutcome || null;
    let probeDelta = Number.isFinite(s.probeDelta) ? s.probeDelta : null;
    let probeBaseline = Number.isFinite(s.probeBaselineAcc) ? s.probeBaselineAcc : null;
    let iqCredit = Number(s.iqCreditThisSession);
    if (!Number.isFinite(g) || !Number.isFinite(iqCredit)) {
      const computed = computeSessionCredits(s, history, coachState, coachPhases);
      g = computed.g;
      iqCredit = computed.iqCredit;
      probeKind = computed.probe.kind;
      probeOutcome = computed.probe.outcome;
      probeDelta = computed.probe.delta;
      probeBaseline = computed.probe.baselineAcc;
    }
    gTotal += g;
    iqCreditTotal = Math.round((iqCreditTotal + iqCredit) * 100) / 100;
    perSession.push({
      id: s.id,
      createdDate: s.created_date,
      g,
      iqCredit,
      probeKind,
      probeOutcome,
      probeDelta,
      probeBaseline,
      accuracy: Number(s.accuracy) || 0,
    });
    if (probeKind === 'switch') probes.switches.push(perSession[perSession.length - 1]);
    if (probeKind === 'recheck') probes.rechecks.push(perSession[perSession.length - 1]);
  }

  const probeRecords = perSession.filter(r => r.probeKind);
  const lastK = probeRecords.slice(-12).map(r => probeScore(r.probeOutcome));
  let farTransferPct = null;
  let tier = 'no_evidence';
  if (lastK.length >= 3) {
    // EMA: alpha 0.6 toward recent probes.
    let ema = lastK[0];
    for (let i = 1; i < lastK.length; i++) ema = 0.6 * lastK[i] + 0.4 * ema;
    farTransferPct = Math.round(ema * 100);
    const tierDef = FAR_TRANSFER_TIERS.find(t => farTransferPct < t.max) || FAR_TRANSFER_TIERS[0];
    tier = tierDef.code;
  }

  // Ground truth — chronologically earliest + latest paired assessments.
  let sandiaDelta = null;
  let calibration = 'no_post_yet';
  if (Array.isArray(assessments) && assessments.length >= 2) {
    const sorted = [...assessments].sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
    const pre = sorted[0];
    const post = sorted[sorted.length - 1];
    if (Number.isFinite(pre?.iq) && Number.isFinite(post?.iq)) {
      const norm = { reliability: 0.7, sdIQ: 15, n: post.n || pre.n || 12 };
      const rc = reliableChange(pre.iq, post.iq, norm);
      sandiaDelta = {
        preIQ: pre.iq,
        postIQ: post.iq,
        deltaIQ: rc.deltaIQ,
        seDiff: rc.seDiff,
        reliable: rc.reliable,
        thresholdIQ: rc.thresholdIQ,
        ci95: [Math.round((rc.deltaIQ - rc.thresholdIQ) * 10) / 10, Math.round((rc.deltaIQ + rc.thresholdIQ) * 10) / 10],
      };
      // Calibration: is the training estimate inside the validated CI?
      const trainingLo = iqCreditTotal - 0.5;
      const trainingHi = iqCreditTotal + 0.5;
      const [validLo, validHi] = sandiaDelta.ci95;
      if (trainingHi < validLo) calibration = 'cool';
      else if (trainingLo > validHi + (validHi - validLo)) calibration = 'hot';
      else calibration = 'aligned';
    }
  }

  return {
    perSession,
    totals: {
      gTotal,
      iqCreditTotal,
      farTransferPct,
      tier,
    },
    probes: {
      switches: probes.switches,
      rechecks: probes.rechecks,
      counts: { switch: probes.switches.length, recheck: probes.rechecks.length, total: probeRecords.length },
    },
    ground: { sandiaDelta, calibration },
  };
}

export function tierLabel(tierCode) {
  const t = FAR_TRANSFER_TIERS.find(x => x.code === tierCode);
  return t ? t.label : '—';
}

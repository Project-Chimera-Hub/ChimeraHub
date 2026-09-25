import {
  ADAPT_UP_THRESHOLD,
  ADAPT_DOWN_THRESHOLD,
  N_MIN,
  N_MAX,
} from './gameConstants';

export function streamStats(hits, misses, falseAlarms, correctRejections) {
  const totalTargets = hits + misses;
  const totalNonTargets = falseAlarms + correctRejections;
  const total = totalTargets + totalNonTargets;
  const hitRate = totalTargets > 0 ? Math.round((hits / totalTargets) * 100) : 0;
  const falseAlarmRate = totalNonTargets > 0 ? Math.round((falseAlarms / totalNonTargets) * 100) : 0;
  const scoredAttempts = totalTargets + falseAlarms;
  const accuracy = scoredAttempts > 0 ? Math.round((hits / scoredAttempts) * 100) : 0;
  return { hits, misses, falseAlarms, correctRejections, total, accuracy, hitRate, falseAlarmRate };
}

// Lure-trial stats: lures are always non-targets, so we only see FAs vs CRs.
// Surface as a "lure resistance" number (1 - FA/(FA+CR)) when present.
function lureStats(lureFA, lureCR) {
  const total = (lureFA || 0) + (lureCR || 0);
  if (total === 0) return null;
  const lureFARate = Math.round(((lureFA || 0) / total) * 100);
  const resistance = 100 - lureFARate;
  return { lureFA: lureFA || 0, lureCR: lureCR || 0, total, lureFARate, resistance };
}

export function calculateResults(state) {
  const A = streamStats(state.hitsA, state.missesA, state.falseAlarmsA, state.correctRejectionsA);
  const luresA = lureStats(state.lureFalseAlarmsA, state.lureCorrectRejectionsA);
  const positionA = (state.modes?.includes('alien_cube') || state.modes?.includes('alien_square') || state.modes?.includes('alien_tesseract'))
    ? streamStats(state.positionHitsA || 0, state.positionMissesA || 0, state.positionFalseAlarmsA || 0, state.positionCorrectRejectionsA || 0)
    : null;
  const cctA = state.modes?.includes('cct_overlay')
    ? streamStats(state.cctHitsA || 0, state.cctMissesA || 0, state.cctFalseAlarmsA || 0, state.cctCorrectRejectionsA || 0)
    : null;
  const rstA = state.modes?.includes('rst_overlay')
    ? streamStats(state.rstHitsA || 0, state.rstMissesA || 0, state.rstFalseAlarmsA || 0, state.rstCorrectRejectionsA || 0)
    : null;

  const extra = (state.extraHits || []).map((h, i) =>
    streamStats(
      h || 0,
      (state.extraMisses || [])[i] || 0,
      (state.extraFalseAlarms || [])[i] || 0,
      (state.extraCorrectRejections || [])[i] || 0
    )
  );

  const extraLures = (state.extraLureFalseAlarms || []).map((fa, i) =>
    lureStats(fa || 0, (state.extraLureCorrectRejections || [])[i] || 0)
  );

  const extraPosition = positionA ? (state.extraPositionHits || []).map((h, i) =>
    streamStats(
      h || 0,
      (state.extraPositionMisses || [])[i] || 0,
      (state.extraPositionFalseAlarms || [])[i] || 0,
      (state.extraPositionCorrectRejections || [])[i] || 0
    )
  ) : [];

  const extraCCT = cctA ? (state.extraCCTHits || []).map((h, i) =>
    streamStats(
      h || 0,
      (state.extraCCTMisses || [])[i] || 0,
      (state.extraCCTFalseAlarms || [])[i] || 0,
      (state.extraCCTCorrectRejections || [])[i] || 0
    )
  ) : [];

  const extraRST = rstA ? (state.extraRSTHits || []).map((h, i) =>
    streamStats(
      h || 0,
      (state.extraRSTMisses || [])[i] || 0,
      (state.extraRSTFalseAlarms || [])[i] || 0,
      (state.extraRSTCorrectRejections || [])[i] || 0
    )
  ) : [];

  const allStreamsStats = [A, ...extra,
    ...(positionA ? [positionA, ...extraPosition] : []),
    ...(cctA ? [cctA, ...extraCCT] : []),
    ...(rstA ? [rstA, ...extraRST] : [])];
  const allHits = allStreamsStats.reduce((s, x) => s + x.hits, 0);
  const allMisses = allStreamsStats.reduce((s, x) => s + x.misses, 0);
  const allFA = allStreamsStats.reduce((s, x) => s + x.falseAlarms, 0);
  const allCR = allStreamsStats.reduce((s, x) => s + x.correctRejections, 0);
  const overall = streamStats(allHits, allMisses, allFA, allCR);

  // RST family breakdown — per-trial records carry the family that fired
  // (Distinction / Comparison / Analogy). Bucket accuracy by family so the
  // results screen and stats dashboard can show "you're 78% on Distinction
  // but 41% on Analogy" — useful for picking the right difficulty next time.
  const rstByFamily = (() => {
    if (!rstA) return null;
    const buckets = { distinction: { hits: 0, misses: 0, fa: 0, cr: 0 },
                      comparison:  { hits: 0, misses: 0, fa: 0, cr: 0 },
                      analogy:     { hits: 0, misses: 0, fa: 0, cr: 0 } };
    (state.allTrials || []).forEach(t => {
      if (t.responseType !== 'rst') return;
      const fam = t.rst?.family || 'distinction';
      const b = buckets[fam];
      if (!b) return;
      if (t.isTarget && t.userResponded) b.hits++;
      else if (t.isTarget && !t.userResponded) b.misses++;
      else if (!t.isTarget && t.userResponded) b.fa++;
      else b.cr++;
    });
    const out = {};
    Object.entries(buckets).forEach(([fam, b]) => {
      const s = streamStats(b.hits, b.misses, b.fa, b.cr);
      if (s.total > 0) out[fam] = s;
    });
    return Object.keys(out).length ? out : null;
  })();

  return {
    A, positionA, cctA, rstA, rstByFamily, luresA,
    extra, extraPosition, extraCCT, extraRST, extraLures,
    rstDifficulty: state.rstDifficulty || 'easy',
    overall,
  };
}

export function computeNextNLevel(currentN, results) {
  const acc = results.overall.accuracy;
  if (acc >= ADAPT_UP_THRESHOLD && currentN < N_MAX) return currentN + 1;
  if (acc <= ADAPT_DOWN_THRESHOLD && currentN > N_MIN) return currentN - 1;
  return currentN;
}
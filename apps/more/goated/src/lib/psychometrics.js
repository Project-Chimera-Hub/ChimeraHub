// Psychometrics for the ICAR-based Reasoning Index.
//
// Method (honest, defensible):
//  - Items are public-domain ICAR (International Cognitive Ability Resource,
//    Condon & Revelle 2014), which is norm-referenced on a very large online
//    sample (SAPA) and correlates ~0.80 with full IQ batteries.
//  - A raw score is mapped to a 100/15 standard scale using ICAR-anchored
//    norm constants (same anchoring IQ Mindware's SgS-12 uses: per-form
//    mean ≈ 5.4, SD ≈ 1.6 of 12).
//  - Unlike a bare point score, we report a 95% CONFIDENCE INTERVAL from the
//    standard error of measurement, an empirical reliability, and a RELIABLE
//    CHANGE INDEX for pre→post so a noise bump is never sold as a gain.
//  - An IRT (2PL EAP) path is included but dormant; it activates automatically
//    if/when every item in a form carries calibrated `irt` parameters.
//
// Caveats surfaced in-app: the SAPA norm sample skews young/educated (scores
// may run optimistic vs. the general population), and a ~12-item form has a
// wide CI — so the trajectory and the Reliable Change Index matter more than
// any single number.

export const ICAR_CITATION =
  'Items: ICAR (International Cognitive Ability Resource), public domain — Condon & Revelle (2014), Intelligence 43:52-64.';

export const NORM_CAVEAT =
  'Norm-referenced to the ICAR/SAPA online sample (skews young and educated, so scores may run a few points optimistic vs. the general population). A 12-item form is a short snapshot — read the confidence interval and the pre/post change, not the single number.';

// Length-aware norms. Anchored to the established 12-item ICAR snapshot
// (mean ≈ 5.4 of 12, SD ≈ 1.6, reliability ≈ 0.78 — the SgS-12 anchoring),
// then projected to any test length n with standard test-theory:
//   • mean(n)  = p0·n           (p0 = per-item proportion correct = 5.4/12)
//   • sd(n)    = sd12·√(n/12)   (SD grows with √length)
//   • rel(n)   = Spearman-Brown from a derived per-item reliability r1
// This makes a longer test genuinely more reliable (tighter CI), which is the
// whole point of growing the item bank. `provisional` flags that the anchors
// are ICAR-informed estimates pending a local IRT calibration.
const P0 = 5.4 / 12;          // ≈ 0.45 per-item proportion correct (provisional raw anchor)
const SD12 = 1.6;             // raw SD at 12 items (provisional)
// Per-item reliability derived from the PUBLISHED ICAR-16 internal consistency
// (0.81 over 16 items; Condon & Revelle 2014, Table 8) via inverse
// Spearman-Brown. Consistency check: projecting this back up to 60 items gives
// ≈0.94, matching the paper's published ICAR-60 reliability of 0.93 — so the
// length model is anchored to two real data points, not guessed.
const ICAR16_REL = 0.81, ICAR16_N = 16;
const R1 = ICAR16_REL / (ICAR16_N - (ICAR16_N - 1) * ICAR16_REL); // ≈ 0.2104
export const NORMS_PROVISIONAL = true;

export function normsForLength(n) {
  const len = Math.max(1, Math.round(n) || 12);
  const reliability = (len * R1) / (1 + (len - 1) * R1);
  return {
    n: len,
    mean: P0 * len,
    sd: SD12 * Math.sqrt(len / 12),
    reliability,
    sdIQ: 15,
    meanIQ: 100,
    provisional: NORMS_PROVISIONAL,
  };
}

// Default (12-item) norm, kept for back-compat call sites.
export const FORM_NORM = Object.freeze(normsForLength(12));

const clamp = (lo, hi, v) => Math.max(lo, Math.min(hi, v));

// Standard normal CDF (Abramowitz & Stegun 7.1.26) → percentile.
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

export function semIQ(norm = FORM_NORM) {
  return norm.sdIQ * Math.sqrt(Math.max(0, 1 - norm.reliability));
}

// raw (0..n) → { iq, sem, ci95:[lo,hi], percentile, band }
export function rawToStandardScore(raw, norm = FORM_NORM) {
  const safeRaw = clamp(0, norm.n, Math.round(Number(raw) || 0));
  const z = (safeRaw - norm.mean) / norm.sd;
  const iq = clamp(40, 160, Math.round(norm.meanIQ + norm.sdIQ * z));
  const sem = semIQ(norm);
  const half = 1.96 * sem;
  const ci95 = [clamp(40, 160, Math.round(iq - half)), clamp(40, 160, Math.round(iq + half))];
  const percentile = clamp(0.1, 99.9, Math.round(normalCdf((iq - 100) / 15) * 1000) / 10);
  return { raw: safeRaw, n: norm.n, iq, sem: Math.round(sem * 10) / 10, ci95, percentile, band: indexBand(iq) };
}

export function indexBand(iq) {
  if (iq >= 130) return { label: 'Very High', color: 'text-emerald-400' };
  if (iq >= 120) return { label: 'High', color: 'text-cyan-400' };
  if (iq >= 110) return { label: 'High Average', color: 'text-cyan-300' };
  if (iq >= 90) return { label: 'Average', color: 'text-foreground' };
  if (iq >= 80) return { label: 'Low Average', color: 'text-amber-400' };
  return { label: 'Below Average', color: 'text-rose-400' };
}

// Reliable Change Index for pre→post. SE of the difference = √2 · SEM.
// |RCI| ≥ 1.96 ⇒ change exceeds measurement error at p < .05.
export function reliableChange(preIQ, postIQ, norm = FORM_NORM) {
  const sem = semIQ(norm);
  const seDiff = Math.sqrt(2) * sem;
  const deltaIQ = Math.round(postIQ - preIQ);
  const rci = deltaIQ / seDiff;
  return {
    deltaIQ,
    seDiff: Math.round(seDiff * 10) / 10,
    rci: Math.round(rci * 100) / 100,
    reliable: Math.abs(rci) >= 1.96,
    thresholdIQ: Math.round(1.96 * seDiff),
  };
}

// Empirical reliability is just the norm reliability for the raw-norm path;
// exposed so the UI can display it.
export function empiricalReliability(norm = FORM_NORM) {
  return norm.reliability;
}

// ── Dormant IRT (2PL EAP) — activates only when items carry `irt` params ─────
const QUAD = (() => {
  const pts = [];
  for (let i = 0; i < 41; i++) {
    const theta = -4 + (8 * i) / 40;
    pts.push({ theta, prior: Math.exp(-0.5 * theta * theta) });
  }
  return pts;
})();

function p2pl(theta, a, b, c = 0) {
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}

// responses: [{ correct: bool, irt:{a,b,c} }]; returns { theta, sem }.
export function irtEAP(responses) {
  const items = responses.filter(r => r.irt && Number.isFinite(r.irt.a) && Number.isFinite(r.irt.b));
  if (!items.length) return null;
  let num = 0, den = 0, num2 = 0;
  for (const q of QUAD) {
    let like = q.prior;
    for (const r of items) {
      const p = p2pl(q.theta, r.irt.a, r.irt.b, r.irt.c || 0);
      like *= r.correct ? p : (1 - p);
    }
    num += q.theta * like;
    num2 += q.theta * q.theta * like;
    den += like;
  }
  if (den <= 0) return null;
  const theta = num / den;
  const variance = Math.max(1e-6, num2 / den - theta * theta);
  return { theta, sem: Math.sqrt(variance) };
}

export function iqFromTheta(theta, semTheta) {
  const iq = clamp(40, 160, Math.round(100 + 15 * theta));
  const semI = 15 * semTheta;
  const half = 1.96 * semI;
  return {
    iq,
    sem: Math.round(semI * 10) / 10,
    ci95: [clamp(40, 160, Math.round(iq - half)), clamp(40, 160, Math.round(iq + half))],
    percentile: clamp(0.1, 99.9, Math.round(normalCdf(theta) * 1000) / 10),
    band: indexBand(iq),
  };
}

// Top-level scorer: prefers IRT when every answered item has params, else
// falls back to the published raw-score norm.
// formNorm (optional): { mean, sd } anchored to the item set's own norming
// sample (e.g. Sandia item difficulties). Reliability/SEM always come from the
// length-aware model; mean/sd come from formNorm when supplied.
export function scoreBattery(items, answers, formNorm = null) {
  const norm = formNorm
    ? { ...normsForLength(items.length), mean: formNorm.mean, sd: formNorm.sd }
    : normsForLength(items.length);
  let raw = 0;
  const perDomain = {};
  const irtResponses = [];
  items.forEach((item, i) => {
    const dom = item.domain;
    if (!perDomain[dom]) perDomain[dom] = { correct: 0, total: 0 };
    perDomain[dom].total += 1;
    const correct = answers[i] != null && answers[i] === item.correctIndex;
    if (correct) { raw += 1; perDomain[dom].correct += 1; }
    if (item.irt) irtResponses.push({ correct, irt: item.irt });
  });
  const useIRT = irtResponses.length === items.length && items.length > 0;
  let score;
  if (useIRT) {
    const eap = irtEAP(irtResponses);
    score = eap ? { ...iqFromTheta(eap.theta, eap.sem), raw, n: items.length, theta: eap.theta, method: 'irt' }
                : { ...rawToStandardScore(raw, norm), method: 'raw' };
  } else {
    score = { ...rawToStandardScore(raw, norm), method: 'raw' };
  }
  return { ...score, perDomain };
}

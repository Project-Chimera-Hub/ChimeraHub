// Insight puzzle generator — no WM load
// ----------------------------------------------------------------------------
// Single-puzzle, no-n-back tasks for the Insight Mode. Each puzzle isolates
// relational inference from working memory: the player has all the panels
// in front of them and unlimited time. Closer to Raven-style matrix reasoning
// than to n-back paradigm.
//
// Per the response to sokuichi's critique: relational training apps usually
// stress WM with relational content. Insight Mode isolates the relational
// inference operation itself, no chaining required. The "discovery" framing
// stays — the player still has to abstract the form class from examples.

import { RELATION_FORM_CLASS, RELATIONSHIPS, SHAPES, COLORS } from './gameConstants';

// Build an index from form-class → member relations so we can pick a class
// and then sample relations from it.
const CLASS_TO_RELATIONS = (() => {
  const out = {};
  Object.entries(RELATION_FORM_CLASS).forEach(([rel, cls]) => {
    if (!out[cls]) out[cls] = [];
    out[cls].push(rel);
  });
  return out;
})();

export const FORM_CLASSES = Object.keys(CLASS_TO_RELATIONS);

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomExcluding(arr, exclude) {
  const filtered = arr.filter(x => !exclude.includes(x));
  return pickRandom(filtered.length > 0 ? filtered : arr);
}

function pickShuffle(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// Build a minimal stimulus object for a relation — enough for the existing
// renderRelationship pipeline to draw it. Avoids the engine's heavier
// makeStimulusEntry which carries n-back / RINT metadata.
function makeInsightStimulus(rel) {
  const shapeA = pickRandom(SHAPES);
  const shapeB = pickRandomExcluding(SHAPES, [shapeA]);
  const colorA = pickRandom(COLORS);
  const colorB = pickRandomExcluding(COLORS, [colorA]);
  return {
    rel,
    shapeA, shapeB,
    colorA, colorB,
    renderMode: Math.floor(Math.random() * 3),
    shape3DA: pickRandom(['cube', 'sphere', 'pyramid', 'cone', 'torus', 'octahedron']),
    shape3DB: pickRandom(['cube', 'sphere', 'pyramid', 'cone', 'torus', 'octahedron']),
    size3DA: 2 + Math.random() * 1.5,
    size3DB: 2 + Math.random() * 1.5,
    // Words / sounds may be used by verbal/sound renderers — generic fillers
    wordA: 'α', wordB: 'β',
    soundA: 'X', soundB: 'Y',
  };
}

// Filter form classes by minimum member count so we always have enough
// distinct relations for a puzzle.
function eligibleClasses(minMembers = 3, excludeRels = []) {
  return FORM_CLASSES.filter(cls => {
    const members = CLASS_TO_RELATIONS[cls].filter(r => !excludeRels.includes(r));
    return members.length >= minMembers;
  });
}

// ─── Odd-one-out puzzle ──────────────────────────────────────────────────────
// N panels (3–6, randomized). All but 1 share a form class. Player clicks
// the odd one. Layout cycles between grid / linear / scattered so the
// surface format isn't a Raven's-clone signature.
//
// sokuichi's critique: Insight puzzles should have *distant similarity* to
// matrix tests — same construct, varied surface. We vary panel count and
// layout each puzzle so the brain can't overfit to "4-panel pick-one".
export function generateOddOneOut({ excludeRels = [], panelCount = null, layout = null } = {}) {
  const totalPanels = panelCount || pickRandom([3, 4, 5, 6]);
  const sharedCount = totalPanels - 1;
  const classes = eligibleClasses(sharedCount, excludeRels);
  if (classes.length < 2) return null;
  const sharedClass = pickRandom(classes);
  const oddClass = pickRandomExcluding(classes, [sharedClass]);
  const sharedPool = CLASS_TO_RELATIONS[sharedClass].filter(r => !excludeRels.includes(r));
  const oddPool = CLASS_TO_RELATIONS[oddClass].filter(r => !excludeRels.includes(r));
  const sharedRels = pickShuffle(sharedPool, sharedCount);
  const oddRel = pickRandom(oddPool);

  const panels = sharedRels.map(rel => ({
    relation: rel,
    stimulus: makeInsightStimulus(rel),
    isOdd: false,
    formClass: sharedClass,
  }));
  panels.push({
    relation: oddRel,
    stimulus: makeInsightStimulus(oddRel),
    isOdd: true,
    formClass: oddClass,
  });
  for (let i = panels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [panels[i], panels[j]] = [panels[j], panels[i]];
  }
  panels.forEach((p, i) => { p.id = i; });
  const correctId = panels.findIndex(p => p.isOdd);

  return {
    type: 'odd_one_out',
    prompt: `${sharedCount} of these panels share a structural form. Pick the ODD one out.`,
    panels,
    correctId,
    sharedClass,
    oddClass,
    layout: layout || pickRandom(['grid', 'linear', 'scatter']),
    hint: `${sharedCount} are ${sharedClass.replace(/_/g, ' ')}; one is ${oddClass.replace(/_/g, ' ')}.`,
  };
}

// ─── Reverse Sort puzzle ─────────────────────────────────────────────────────
// Given a form class LABEL, pick all panels that match it from a mixed pool.
// Inverts the direction of inference — instead of inferring the form class
// from examples, the player applies the form class to candidate examples.
// Different surface format from matrix-test style; same underlying construct.
export function generateReverseSort({ excludeRels = [] } = {}) {
  const classes = eligibleClasses(3, excludeRels);
  if (classes.length < 2) return null;
  const targetClass = pickRandom(classes);
  const targetPool = CLASS_TO_RELATIONS[targetClass].filter(r => !excludeRels.includes(r));
  const targetCount = pickRandom([2, 3]); // 2 or 3 correct answers
  const targets = pickShuffle(targetPool, targetCount);

  // Fill with distractors from different classes
  const distractorClasses = classes.filter(c => c !== targetClass);
  const distractorCount = 6 - targetCount; // total 6 panels
  const distractors = [];
  for (let i = 0; i < distractorCount; i++) {
    const cls = pickRandom(distractorClasses);
    const pool = CLASS_TO_RELATIONS[cls];
    distractors.push({ rel: pickRandom(pool), cls });
  }

  const panels = [
    ...targets.map(rel => ({ relation: rel, stimulus: makeInsightStimulus(rel), isTarget: true, formClass: targetClass })),
    ...distractors.map(d => ({ relation: d.rel, stimulus: makeInsightStimulus(d.rel), isTarget: false, formClass: d.cls })),
  ];
  for (let i = panels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [panels[i], panels[j]] = [panels[j], panels[i]];
  }
  panels.forEach((p, i) => { p.id = i; });
  const correctIds = panels.filter(p => p.isTarget).map(p => p.id);

  return {
    type: 'reverse_sort',
    prompt: `Pick ALL panels showing the "${targetClass.replace(/_/g, ' ')}" form.`,
    panels,
    correctIds,
    targetCount,
    sharedClass: targetClass,
    hint: `${targetCount} panels match. Look for the structural pattern of "${targetClass.replace(/_/g, ' ')}".`,
  };
}

// ─── Verbal Analogy puzzle ───────────────────────────────────────────────────
// Pure text-only relational analogy: "α [REL_A] β :: γ [?] δ". Player picks
// the missing relation from 4 candidates. No rendered shape panels — tests
// the same form-class construct in a completely different surface modality.
// Counters the visual-overfitting risk of the panel-based puzzles.
const ENTITY_TOKENS = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'λ', 'μ'];

function readableRel(rel) {
  return rel.replace(/_/g, ' ').toLowerCase();
}

export function generateVerbalAnalogy({ excludeRels = [] } = {}) {
  const classes = eligibleClasses(2, excludeRels);
  if (classes.length < 4) return null;
  const sharedClass = pickRandom(classes);
  const sharedPool = CLASS_TO_RELATIONS[sharedClass].filter(r => !excludeRels.includes(r));
  if (sharedPool.length < 2) return generateVerbalAnalogy({ excludeRels }); // re-roll
  const [shownRel, correctRel] = pickShuffle(sharedPool, 2);

  const otherClasses = classes.filter(c => c !== sharedClass);
  const distractorClasses = pickShuffle(otherClasses, 3);
  const distractors = distractorClasses.map(cls => pickRandom(CLASS_TO_RELATIONS[cls]));

  const candidates = [
    { id: 'c-0', relation: correctRel, isCorrect: true, formClass: sharedClass },
    ...distractors.map((rel, i) => ({
      id: `c-${i + 1}`,
      relation: rel,
      isCorrect: false,
      formClass: distractorClasses[i],
    })),
  ];
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const correctIndex = candidates.findIndex(c => c.isCorrect);

  // Pick fresh entity pairs for both sides of the analogy
  const tokens = pickShuffle(ENTITY_TOKENS, 4);
  const a = tokens[0], b = tokens[1], c = tokens[2], d = tokens[3];

  return {
    type: 'verbal_analogy',
    prompt: 'Pick the relation that completes the analogy.',
    base: { a, rel: readableRel(shownRel), b },
    question: { c, d },
    candidates: candidates.map(cand => ({ ...cand, label: readableRel(cand.relation) })),
    correctIndex,
    sharedClass,
    hint: `Both sides share the "${sharedClass.replace(/_/g, ' ')}" form. The relation token differs.`,
  };
}

// ─── Analogy completion puzzle ───────────────────────────────────────────────

// ─── Analogy completion puzzle ───────────────────────────────────────────────
// "Three panels share a form class. From 4 candidates, pick the one that
// belongs with them." Effectively a Raven-style matrix completion: player
// abstracts the form class from the 3 shown, then picks the candidate that
// fits — must distinguish from 3 distractors of different form classes.
export function generateAnalogyCompletion({ excludeRels = [] } = {}) {
  const classes = eligibleClasses(4, excludeRels); // need 4 from same class (3 shown + 1 candidate)
  if (classes.length < 4) return null;
  const sharedClass = pickRandom(classes);
  const sharedPool = CLASS_TO_RELATIONS[sharedClass].filter(r => !excludeRels.includes(r));
  const sharedRels = pickShuffle(sharedPool, 4);
  const shown = sharedRels.slice(0, 3);
  const correctCandidate = sharedRels[3];

  // 3 distractors from 3 different other classes
  const otherClasses = classes.filter(c => c !== sharedClass);
  const distractorClasses = pickShuffle(otherClasses, 3);
  const distractors = distractorClasses.map(cls => pickRandom(CLASS_TO_RELATIONS[cls]));

  const shownPanels = shown.map((rel, i) => ({
    id: `shown-${i}`,
    relation: rel,
    stimulus: makeInsightStimulus(rel),
    formClass: sharedClass,
  }));

  const candidates = [
    { id: 'c-0', relation: correctCandidate, stimulus: makeInsightStimulus(correctCandidate), isCorrect: true, formClass: sharedClass },
    ...distractors.map((rel, i) => ({
      id: `c-${i + 1}`,
      relation: rel,
      stimulus: makeInsightStimulus(rel),
      isCorrect: false,
      formClass: distractorClasses[i],
    })),
  ];
  // Shuffle candidates so correct isn't always first
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const correctIndex = candidates.findIndex(c => c.isCorrect);

  return {
    type: 'analogy_completion',
    prompt: 'These three share a structural form. Pick the candidate that BELONGS with them.',
    shown: shownPanels,
    candidates,
    correctIndex,
    sharedClass,
    hint: `All three share the ${sharedClass.replace(/_/g, ' ')} form. Find another one.`,
  };
}

// Public: pick a random puzzle type and generate it. Weights matter — we
// over-sample the formats that diverge most from matrix-test conventions
// (verbal_analogy, reverse_sort) so the surface variety is felt.
export const INSIGHT_TYPES = ['odd_one_out', 'analogy_completion', 'reverse_sort', 'verbal_analogy'];

export function generateInsightPuzzle({ type = 'random', excludeRels = [] } = {}) {
  const t = type === 'random'
    ? pickRandom(INSIGHT_TYPES)
    : type;
  if (t === 'reverse_sort') return generateReverseSort({ excludeRels });
  if (t === 'verbal_analogy') return generateVerbalAnalogy({ excludeRels });
  if (t === 'analogy_completion') return generateAnalogyCompletion({ excludeRels });
  return generateOddOneOut({ excludeRels });
}

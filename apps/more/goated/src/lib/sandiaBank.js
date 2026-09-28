// Sandia Matrices item bank — free, validated, norm-referenced Raven-style
// matrix-reasoning items from Sandia National Laboratories.
//   Matzen, L.E., Benz, Z.O., Dixon, K.R., Posey, J., Kroger, J.K., & Speed,
//   A.E. (2010). Recreating Raven's: Software for systematically generating
//   large numbers of Raven-like matrix problems with normed properties.
//   Behavior Research Methods, 42(2), 525-541.
//
// Items released publicly by Sandia National Labs for use (cite the paper).
// Matrix reasoning is the single best proxy for fluid intelligence (g).
//
// Two PARALLEL, DISJOINT 24-item forms (matched difficulty distribution), each
// item carrying its norming-study difficulty (`difficulty` = proportion correct
// in Matzen et al. 2010). Each item shows a problem image (3×3 matrix, one cell
// missing) plus an answer-array image (2×4 grid, cells numbered 1-8 left→right,
// top row then bottom row); the player picks the cell. `correctIndex` is 0-based.

export const SANDIA_CITATION =
  'Items: Sandia Matrices (public, free) — Matzen, Benz, Dixon, Posey, Kroger & Speed (2010), Behavior Research Methods 42(2):525-541.';

export const SANDIA_CAVEAT =
  'Anchored to the Sandia Matrices 2010 norming study (university-student sample; ~4 ratings per item, so item difficulties are approximate). This is an honest index for tracking your own change over time — not a clinical or population-normed IQ. The confidence interval and the reliable-change verdict matter more than the single number.';

const OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8'];

const FORM_A = [
  { id: 'A1B4C2', imageUrl: '/assets/sandia/formA/A1B4C2.png', answersImageUrl: '/assets/sandia/formA/A1B4C2_Answers.png', correctIndex: 7, difficulty: 1.0 },
  { id: 'A3D4E5_2', imageUrl: '/assets/sandia/formA/A3D4E5_2.png', answersImageUrl: '/assets/sandia/formA/A3D4E5_2_Answers.png', correctIndex: 0, difficulty: 1.0 },
  { id: 'A2E1', imageUrl: '/assets/sandia/formA/A2E1.png', answersImageUrl: '/assets/sandia/formA/A2E1_Answers.png', correctIndex: 6, difficulty: 1.0 },
  { id: 'B4D1', imageUrl: '/assets/sandia/formA/B4D1.png', answersImageUrl: '/assets/sandia/formA/B4D1_Answers.png', correctIndex: 1, difficulty: 1.0 },
  { id: 'A3B2C4', imageUrl: '/assets/sandia/formA/A3B2C4.png', answersImageUrl: '/assets/sandia/formA/A3B2C4_Answers.png', correctIndex: 7, difficulty: 0.75 },
  { id: 'D4E5', imageUrl: '/assets/sandia/formA/D4E5.png', answersImageUrl: '/assets/sandia/formA/D4E5_Answers.png', correctIndex: 0, difficulty: 0.75 },
  { id: 'A2B3E4', imageUrl: '/assets/sandia/formA/A2B3E4.png', answersImageUrl: '/assets/sandia/formA/A2B3E4_Answers.png', correctIndex: 1, difficulty: 0.75 },
  { id: 'X_9', imageUrl: '/assets/sandia/formA/X_9.png', answersImageUrl: '/assets/sandia/formA/X_9_Answers.png', correctIndex: 4, difficulty: 0.75 },
  { id: 'A1D4', imageUrl: '/assets/sandia/formA/A1D4.png', answersImageUrl: '/assets/sandia/formA/A1D4_Answers.png', correctIndex: 6, difficulty: 0.75 },
  { id: 'E1_2', imageUrl: '/assets/sandia/formA/E1_2.png', answersImageUrl: '/assets/sandia/formA/E1_2_Answers.png', correctIndex: 4, difficulty: 0.75 },
  { id: 'A4E2', imageUrl: '/assets/sandia/formA/A4E2.png', answersImageUrl: '/assets/sandia/formA/A4E2_Answers.png', correctIndex: 3, difficulty: 0.75 },
  { id: 'C5D4E1', imageUrl: '/assets/sandia/formA/C5D4E1.png', answersImageUrl: '/assets/sandia/formA/C5D4E1_Answers.png', correctIndex: 5, difficulty: 0.75 },
  { id: 'Z_13', imageUrl: '/assets/sandia/formA/Z_13.png', answersImageUrl: '/assets/sandia/formA/Z_13_Answers.png', correctIndex: 1, difficulty: 0.5 },
  { id: 'A4C2D3', imageUrl: '/assets/sandia/formA/A4C2D3.png', answersImageUrl: '/assets/sandia/formA/A4C2D3_Answers.png', correctIndex: 7, difficulty: 0.5 },
  { id: 'Y_11', imageUrl: '/assets/sandia/formA/Y_11.png', answersImageUrl: '/assets/sandia/formA/Y_11_Answers.png', correctIndex: 3, difficulty: 0.5 },
  { id: 'X_20', imageUrl: '/assets/sandia/formA/X_20.png', answersImageUrl: '/assets/sandia/formA/X_20_Answers.png', correctIndex: 6, difficulty: 0.5 },
  { id: 'A4B1D2', imageUrl: '/assets/sandia/formA/A4B1D2.png', answersImageUrl: '/assets/sandia/formA/A4B1D2_Answers.png', correctIndex: 2, difficulty: 0.5 },
  { id: 'A4B3D5_1', imageUrl: '/assets/sandia/formA/A4B3D5_1.png', answersImageUrl: '/assets/sandia/formA/A4B3D5_1_Answers.png', correctIndex: 0, difficulty: 0.5 },
  { id: 'D4E1', imageUrl: '/assets/sandia/formA/D4E1.png', answersImageUrl: '/assets/sandia/formA/D4E1_Answers.png', correctIndex: 3, difficulty: 0.5 },
  { id: 'Y_1', imageUrl: '/assets/sandia/formA/Y_1.png', answersImageUrl: '/assets/sandia/formA/Y_1_Answers.png', correctIndex: 5, difficulty: 0.5 },
  { id: 'C3D5E4_2', imageUrl: '/assets/sandia/formA/C3D5E4_2.png', answersImageUrl: '/assets/sandia/formA/C3D5E4_2_Answers.png', correctIndex: 2, difficulty: 0.25 },
  { id: 'Z_17', imageUrl: '/assets/sandia/formA/Z_17.png', answersImageUrl: '/assets/sandia/formA/Z_17_Answers.png', correctIndex: 2, difficulty: 0.25 },
  { id: 'B5C4D3_1', imageUrl: '/assets/sandia/formA/B5C4D3_1.png', answersImageUrl: '/assets/sandia/formA/B5C4D3_1_Answers.png', correctIndex: 6, difficulty: 0.25 },
  { id: 'C2D4E5', imageUrl: '/assets/sandia/formA/C2D4E5.png', answersImageUrl: '/assets/sandia/formA/C2D4E5_Answers.png', correctIndex: 5, difficulty: 0.25 },
];

const FORM_B = [
  { id: 'A4D5E3_1', imageUrl: '/assets/sandia/formB/A4D5E3_1.png', answersImageUrl: '/assets/sandia/formB/A4D5E3_1_Answers.png', correctIndex: 0, difficulty: 1.0 },
  { id: 'C1E4', imageUrl: '/assets/sandia/formB/C1E4.png', answersImageUrl: '/assets/sandia/formB/C1E4_Answers.png', correctIndex: 4, difficulty: 1.0 },
  { id: 'A3B5E4_2', imageUrl: '/assets/sandia/formB/A3B5E4_2.png', answersImageUrl: '/assets/sandia/formB/A3B5E4_2_Answers.png', correctIndex: 6, difficulty: 1.0 },
  { id: 'A4B3C5_4', imageUrl: '/assets/sandia/formB/A4B3C5_4.png', answersImageUrl: '/assets/sandia/formB/A4B3C5_4_Answers.png', correctIndex: 2, difficulty: 1.0 },
  { id: 'A2C3E1', imageUrl: '/assets/sandia/formB/A2C3E1.png', answersImageUrl: '/assets/sandia/formB/A2C3E1_Answers.png', correctIndex: 7, difficulty: 0.75 },
  { id: 'B3C2', imageUrl: '/assets/sandia/formB/B3C2.png', answersImageUrl: '/assets/sandia/formB/B3C2_Answers.png', correctIndex: 7, difficulty: 0.75 },
  { id: 'Y_6', imageUrl: '/assets/sandia/formB/Y_6.png', answersImageUrl: '/assets/sandia/formB/Y_6_Answers.png', correctIndex: 7, difficulty: 0.75 },
  { id: 'B2D3E1', imageUrl: '/assets/sandia/formB/B2D3E1.png', answersImageUrl: '/assets/sandia/formB/B2D3E1_Answers.png', correctIndex: 3, difficulty: 0.75 },
  { id: 'A4B1', imageUrl: '/assets/sandia/formB/A4B1.png', answersImageUrl: '/assets/sandia/formB/A4B1_Answers.png', correctIndex: 4, difficulty: 0.75 },
  { id: 'C3D4E5_3', imageUrl: '/assets/sandia/formB/C3D4E5_3.png', answersImageUrl: '/assets/sandia/formB/C3D4E5_3_Answers.png', correctIndex: 3, difficulty: 0.75 },
  { id: 'B3E4', imageUrl: '/assets/sandia/formB/B3E4.png', answersImageUrl: '/assets/sandia/formB/B3E4_Answers.png', correctIndex: 7, difficulty: 0.75 },
  { id: 'B4C5D3_1', imageUrl: '/assets/sandia/formB/B4C5D3_1.png', answersImageUrl: '/assets/sandia/formB/B4C5D3_1_Answers.png', correctIndex: 0, difficulty: 0.75 },
  { id: 'B3C5D4_4', imageUrl: '/assets/sandia/formB/B3C5D4_4.png', answersImageUrl: '/assets/sandia/formB/B3C5D4_4_Answers.png', correctIndex: 5, difficulty: 0.5 },
  { id: 'A3D2', imageUrl: '/assets/sandia/formB/A3D2.png', answersImageUrl: '/assets/sandia/formB/A3D2_Answers.png', correctIndex: 7, difficulty: 0.5 },
  { id: 'A4C3D5_2', imageUrl: '/assets/sandia/formB/A4C3D5_2.png', answersImageUrl: '/assets/sandia/formB/A4C3D5_2_Answers.png', correctIndex: 1, difficulty: 0.5 },
  { id: 'A3B5E4_4', imageUrl: '/assets/sandia/formB/A3B5E4_4.png', answersImageUrl: '/assets/sandia/formB/A3B5E4_4_Answers.png', correctIndex: 5, difficulty: 0.5 },
  { id: 'C3D5E4_1', imageUrl: '/assets/sandia/formB/C3D5E4_1.png', answersImageUrl: '/assets/sandia/formB/C3D5E4_1_Answers.png', correctIndex: 3, difficulty: 0.5 },
  { id: 'A4D5E3_3', imageUrl: '/assets/sandia/formB/A4D5E3_3.png', answersImageUrl: '/assets/sandia/formB/A4D5E3_3_Answers.png', correctIndex: 6, difficulty: 0.5 },
  { id: 'X_8', imageUrl: '/assets/sandia/formB/X_8.png', answersImageUrl: '/assets/sandia/formB/X_8_Answers.png', correctIndex: 7, difficulty: 0.5 },
  { id: 'A3C5D4_3', imageUrl: '/assets/sandia/formB/A3C5D4_3.png', answersImageUrl: '/assets/sandia/formB/A3C5D4_3_Answers.png', correctIndex: 5, difficulty: 0.5 },
  { id: 'Y_10', imageUrl: '/assets/sandia/formB/Y_10.png', answersImageUrl: '/assets/sandia/formB/Y_10_Answers.png', correctIndex: 4, difficulty: 0.25 },
  { id: 'A3C5E1', imageUrl: '/assets/sandia/formB/A3C5E1.png', answersImageUrl: '/assets/sandia/formB/A3C5E1_Answers.png', correctIndex: 3, difficulty: 0.25 },
  { id: 'Z_2', imageUrl: '/assets/sandia/formB/Z_2.png', answersImageUrl: '/assets/sandia/formB/Z_2_Answers.png', correctIndex: 5, difficulty: 0.25 },
  { id: 'C5D4E3_1', imageUrl: '/assets/sandia/formB/C5D4E3_1.png', answersImageUrl: '/assets/sandia/formB/C5D4E3_1_Answers.png', correctIndex: 6, difficulty: 0.25 },
];

export const SANDIA_FORMS = { A: FORM_A, B: FORM_B, full: [...FORM_A, ...FORM_B] };

const TIME_CAP_MS = 60000; // generous per-item cap; timeout = no credit

// Norm derived directly from the item difficulties (classical test theory under
// local independence): expected raw = Σ pᵢ, variance = Σ pᵢ(1−pᵢ). This anchors
// the standard-score scale to the Sandia 2010 norming sample.
export function sandiaNorm(items) {
  const mean = items.reduce((s, it) => s + it.difficulty, 0);
  const variance = items.reduce((s, it) => s + it.difficulty * (1 - it.difficulty), 0);
  return { n: items.length, mean, sd: Math.sqrt(variance) || 1 };
}

export function buildSandiaForm(form = 'A') {
  const items = (SANDIA_FORMS[form] || FORM_A).map(it => ({
    ...it, domain: 'matrix', kind: 'sandia-matrix', options: OPTIONS, timeMs: TIME_CAP_MS,
  }));
  return { form, items, norm: sandiaNorm(items) };
}

export function validateSandia() {
  const issues = [];
  for (const [form, items] of Object.entries(SANDIA_FORMS)) {
    items.forEach(it => {
      if (it.correctIndex < 0 || it.correctIndex > 7) issues.push(`${it.id}: bad correctIndex`);
      if (!it.imageUrl || !it.answersImageUrl) issues.push(`${it.id}: missing image`);
    });
  }
  const idsA = new Set(FORM_A.map(i => i.id));
  if (FORM_B.some(i => idsA.has(i.id))) issues.push('forms A/B share item ids');
  return issues;
}

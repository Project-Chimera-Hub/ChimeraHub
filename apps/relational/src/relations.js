import {
  SHAPE_SIDES,
  SHAPE_BY_SIDES,
  RELATION_BY_ID,
  POSITION_PROMPTS_2D,
  POSITION_PROMPTS_3D,
  SOUND_MIN,
  SOUND_MAX,
} from './constants.js';

export function positionMatches(current, remembered, prompt, mode = '2d') {
  if (!current || !remembered) return false;
  const dx = remembered.x - current.x;
  const dy = remembered.y - current.y;
  const dz = remembered.z - current.z;

  switch (prompt) {
    case 'NORTH': return dx === 0 && dy === -1 && (mode === '2d' || dz === 0);
    case 'SOUTH': return dx === 0 && dy === 1 && (mode === '2d' || dz === 0);
    case 'EAST': return dx === 1 && dy === 0 && (mode === '2d' || dz === 0);
    case 'WEST': return dx === -1 && dy === 0 && (mode === '2d' || dz === 0);
    case 'ROW': return remembered.y === current.y && remembered.x !== current.x && (mode === '2d' || remembered.z === current.z);
    case 'COLUMN': return remembered.x === current.x && remembered.y !== current.y && (mode === '2d' || remembered.z === current.z);
    case 'ABOVE': return mode !== '2d' && dx === 0 && dy === 0 && dz === 1;
    case 'BELOW': return mode !== '2d' && dx === 0 && dy === 0 && dz === -1;
    default: return false;
  }
}

export function validPositionPrompts(current, remembered, mode = '2d') {
  const prompts = mode === '2d' ? POSITION_PROMPTS_2D : POSITION_PROMPTS_3D;
  return prompts.filter((prompt) => positionMatches(current, remembered, prompt, mode));
}

export function numberMatches(current, remembered, prompt) {
  if (!Number.isInteger(current) || !Number.isInteger(remembered) || !prompt) return false;
  if (prompt.type === 'BEFORE') return remembered === current - 1;
  if (prompt.type === 'AFTER') return remembered === current + 1;
  if (prompt.type === 'DELTA') return remembered === current + prompt.delta;
  return false;
}

export function validNumberPrompts(current, remembered) {
  if (!Number.isInteger(current) || !Number.isInteger(remembered)) return [];
  const delta = remembered - current;
  const out = [{ type: 'DELTA', delta }];
  if (delta === -1) out.unshift({ type: 'BEFORE' });
  if (delta === 1) out.unshift({ type: 'AFTER' });
  return out;
}

export function viableNumberPrompts(current, maxAbsDelta = 4) {
  const out = [];
  if (current > SOUND_MIN) out.push({ type: 'BEFORE' });
  if (current < SOUND_MAX) out.push({ type: 'AFTER' });
  for (let delta = -maxAbsDelta; delta <= maxAbsDelta; delta += 1) {
    const result = current + delta;
    if (result >= SOUND_MIN && result <= SOUND_MAX) out.push({ type: 'DELTA', delta });
  }
  return out;
}

export function applyNumberPrompt(current, prompt) {
  if (prompt.type === 'BEFORE') return current - 1;
  if (prompt.type === 'AFTER') return current + 1;
  if (prompt.type === 'DELTA') return current + prompt.delta;
  return null;
}

export function shapeMatches(currentShape, rememberedShape, prompt) {
  const current = SHAPE_SIDES[currentShape];
  const remembered = SHAPE_SIDES[rememberedShape];
  if (!current || !remembered || !prompt) return false;
  if (prompt.type === 'FEWER') return remembered < current;
  if (prompt.type === 'MORE') return remembered > current;
  if (prompt.type === 'DELTA') return remembered === current + prompt.delta;
  return false;
}

export function validShapePrompts(currentShape, rememberedShape) {
  const current = SHAPE_SIDES[currentShape];
  const remembered = SHAPE_SIDES[rememberedShape];
  if (!current || !remembered) return [];
  const out = [{ type: 'DELTA', delta: remembered - current }];
  if (remembered < current) out.unshift({ type: 'FEWER' });
  if (remembered > current) out.unshift({ type: 'MORE' });
  return out;
}

export function viableShapePrompts(currentShape, allowedShapes = Object.keys(SHAPE_SIDES)) {
  const current = SHAPE_SIDES[currentShape];
  if (!current) return [];
  const allowed = [...new Set(allowedShapes)].filter((shape) => SHAPE_SIDES[shape]);
  const sideValues = allowed.map((shape) => SHAPE_SIDES[shape]).sort((a, b) => a - b);
  const out = [];
  if (sideValues.some((value) => value < current)) out.push({ type: 'FEWER' });
  if (sideValues.some((value) => value > current)) out.push({ type: 'MORE' });
  for (const target of sideValues) out.push({ type: 'DELTA', delta: target - current });
  return out;
}

export function applyShapePrompt(currentShape, prompt, allowedShapes = Object.keys(SHAPE_SIDES)) {
  const current = SHAPE_SIDES[currentShape];
  if (!current || !prompt) return null;
  const allowed = [...new Set(allowedShapes)].filter((shape) => SHAPE_SIDES[shape]);
  const values = allowed.map((shape) => SHAPE_SIDES[shape]).sort((a, b) => a - b);
  if (prompt.type === 'DELTA') return SHAPE_BY_SIDES[current + prompt.delta] ?? null;
  if (prompt.type === 'FEWER') return values.filter((value) => value < current).map((value) => SHAPE_BY_SIDES[value]);
  if (prompt.type === 'MORE') return values.filter((value) => value > current).map((value) => SHAPE_BY_SIDES[value]);
  return null;
}

export function relationMatches(currentRelation, rememberedRelation, prompt) {
  const current = RELATION_BY_ID[currentRelation];
  const remembered = RELATION_BY_ID[rememberedRelation];
  if (!current || !remembered) return false;
  if (prompt === 'SAME') return current.id === remembered.id;
  if (prompt === 'INVERSE') return current.inverse === remembered.id;
  if (prompt === 'SAME_FAMILY') return current.family === remembered.family;
  return false;
}

export function validRelationPrompts(currentRelation, rememberedRelation) {
  return ['SAME', 'INVERSE', 'SAME_FAMILY'].filter((p) => relationMatches(currentRelation, rememberedRelation, p));
}

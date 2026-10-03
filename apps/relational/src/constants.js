export const SHAPES = Object.freeze([
  { id: 'CIRCLE', sides: 1, label: 'Circle' },
  { id: 'TRIANGLE', sides: 3, label: 'Triangle' },
  { id: 'SQUARE', sides: 4, label: 'Square' },
  { id: 'PENTAGON', sides: 5, label: 'Pentagon' },
  { id: 'HEXAGON', sides: 6, label: 'Hexagon' },
]);

export const SHAPE_SIDES = Object.freeze(Object.fromEntries(SHAPES.map((s) => [s.id, s.sides])));
export const SHAPE_BY_SIDES = Object.freeze(Object.fromEntries(SHAPES.map((s) => [s.sides, s.id])));
export const SHAPE_LABELS = Object.freeze(Object.fromEntries(SHAPES.map((s) => [s.id, s.label])));

/**
 * READING RULE FOR EVERY RELATION ICON
 * ------------------------------------
 * A relation icon always shows exactly two different shapes. Their roles are
 * decided by side count and by nothing else:
 *
 *   FEWER sides  -> FIRST TERM  (the subject of the sentence)
 *   MORE sides   -> SECOND TERM (the object of the sentence)
 *
 * The icon is then read as "FIRST TERM <relation> SECOND TERM". Left/right
 * placement is randomised on every draw and carries no meaning.
 *
 * This matches assets/relations/relation-guide.png, where the circle (1 side)
 * is always the subject: circle contains square, circle is inside square,
 * circle is greater than square, and so on.
 */
export const SUBJECT_RULE = 'FEWER_SIDES';

export const RELATION_FAMILY_LABELS = Object.freeze({
  EQUIVALENCE: 'Equivalence',
  CONTAINMENT: 'Containment',
  SEQUENCE: 'Sequence',
  MAGNITUDE: 'Magnitude',
});

export const RELATIONS = Object.freeze([
  {
    id: 'SAME',
    label: 'Same',
    family: 'EQUIVALENCE',
    inverse: 'SAME',
    sentence: 'First term is the same as second term.',
    layout: 'Stacked on one centre at matching size.',
    rule: 'Both shapes share a centre and are the same size, so neither one is a container and neither one is bigger.',
  },
  {
    id: 'OPPOSITE',
    label: 'Opposite',
    family: 'EQUIVALENCE',
    inverse: 'OPPOSITE',
    sentence: 'First term is the opposite of second term.',
    layout: 'Side by side, same size, clear gap.',
    rule: 'Two equal-sized shapes held apart. Equal size marks the equivalence family; the gap separates Opposite from Same.',
  },
  {
    id: 'CONTAINS',
    label: 'Contains',
    family: 'CONTAINMENT',
    inverse: 'INSIDE',
    sentence: 'First term contains second term.',
    layout: 'One shape drawn inside the other.',
    rule: 'The FEWER-sided shape is the big outer one; the MORE-sided shape sits inside it.',
  },
  {
    id: 'INSIDE',
    label: 'Inside',
    family: 'CONTAINMENT',
    inverse: 'CONTAINS',
    sentence: 'First term is inside second term.',
    layout: 'One shape drawn inside the other.',
    rule: 'The FEWER-sided shape is the small inner one; the MORE-sided shape is the big outer one.',
  },
  {
    id: 'LEADS_TO',
    label: 'Leads to',
    family: 'SEQUENCE',
    inverse: 'FOLLOWS',
    sentence: 'First term leads to second term.',
    layout: 'Two overlapping shapes offset diagonally, one higher.',
    rule: 'The FEWER-sided shape is the HIGHER one. Only up and down matter; the diagonal leans either way at random.',
  },
  {
    id: 'FOLLOWS',
    label: 'Follows',
    family: 'SEQUENCE',
    inverse: 'LEADS_TO',
    sentence: 'First term follows second term.',
    layout: 'Two overlapping shapes offset diagonally, one higher.',
    rule: 'The FEWER-sided shape is the LOWER one. Only up and down matter; the diagonal leans either way at random.',
  },
  {
    id: 'GREATER',
    label: 'Greater',
    family: 'MAGNITUDE',
    inverse: 'LESS',
    sentence: 'First term is greater than second term.',
    layout: 'Side by side, one clearly big and one clearly small.',
    rule: 'The FEWER-sided shape is the BIG one. The side of the icon it sits on is random.',
  },
  {
    id: 'LESS',
    label: 'Less',
    family: 'MAGNITUDE',
    inverse: 'GREATER',
    sentence: 'First term is less than second term.',
    layout: 'Side by side, one clearly big and one clearly small.',
    rule: 'The FEWER-sided shape is the SMALL one. The side of the icon it sits on is random.',
  },
]);

export const RELATION_BY_ID = Object.freeze(Object.fromEntries(RELATIONS.map((r) => [r.id, r])));

export const RELATION_PROMPT_LABELS = Object.freeze({
  SAME: 'SAME RELATION',
  INVERSE: 'INVERSE',
  SAME_FAMILY: 'SAME FAMILY',
});

export const POSITION_PROMPTS_2D = Object.freeze(['NORTH', 'SOUTH', 'EAST', 'WEST', 'ROW', 'COLUMN']);
export const POSITION_PROMPTS_3D = Object.freeze([...POSITION_PROMPTS_2D, 'ABOVE', 'BELOW']);
export const RELATION_PROMPTS = Object.freeze(['SAME', 'INVERSE', 'SAME_FAMILY']);
export const STREAMS = Object.freeze(['position', 'sound', 'shape', 'relation']);
export const STREAM_LABELS = Object.freeze({ position: 'Position', sound: 'Sound', shape: 'Shape', relation: 'Relation' });
export const STREAM_HOTKEYS = Object.freeze({ position: 'A', sound: 'S', shape: 'D', relation: 'F' });
export const DEFAULT_STREAMS = Object.freeze({ position: true, sound: true, shape: true, relation: true });
export const SOUND_MIN = 1;
export const SOUND_MAX = 8;
export const DEFAULT_SHAPE_POOL = Object.freeze(Object.fromEntries(SHAPES.map((shape) => [shape.id, true])));

export const LIMITS = Object.freeze({
  n: { min: 1, max: 9 },
  trials: { min: 5, max: 500 },
  intervalMs: { min: 800, max: 10000 },
  visibleMs: { min: 200, max: 8000 },
  targetRatePct: { min: 15, max: 65 },
  maxOffset: { min: 1, max: 9 },
});

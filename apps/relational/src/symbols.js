import { RELATION_BY_ID, SHAPES, SHAPE_SIDES, SHAPE_LABELS } from './constants.js';
import { shapeSvg } from './geometry.js';

/**
 * Every icon is drawn in a 120x120 box.
 *
 * Role assignment is by side count only (see SUBJECT_RULE in constants.js):
 *   first  = the shape with FEWER sides  (subject)
 *   second = the shape with MORE sides   (object)
 *
 * Sizes are chosen so the four families are separable at a glance:
 *   equivalence -> two equal sizes
 *   containment -> one shape inside the other
 *   magnitude   -> one clearly big, one clearly small
 *   sequence    -> equal sizes, offset diagonally, overlapping
 */
const SIZE = Object.freeze({
  equalOuter: 22,
  equalInner: 18,
  apart: 19,
  container: 37,
  contained: 15,
  big: 26,
  small: 14,
  sequence: 20,
});

export function createRelationVisual(relationId, options = {}, rng = Math.random) {
  const { enabledShapes = SHAPES.map((shape) => shape.id), previousPairKey = '' } = options;
  const relation = RELATION_BY_ID[relationId];
  if (!relation) throw new Error(`Unknown relation: ${relationId}`);
  const allowed = uniqueShapeIds(enabledShapes);
  if (allowed.length < 2) throw new Error('At least two shapes must be enabled for relation symbols');

  const pairs = createPairs(allowed).filter((pair) => pair.key !== previousPairKey);
  const sourcePairs = pairs.length ? pairs : createPairs(allowed);
  const pair = pick(sourcePairs, rng);
  const [a, b] = pair.shapes;
  const first = SHAPE_SIDES[a] < SHAPE_SIDES[b] ? a : b;
  const second = first === a ? b : a;
  const mirrored = rng() < 0.5;

  return {
    semantic: relationId,
    label: relation.label,
    family: relation.family,
    inverse: relation.inverse,
    sentence: relation.sentence,
    pairKey: pair.key,
    first,
    second,
    nodes: relationNodes(relationId, { first, second, mirrored }),
  };
}

export function relationGlyphSVG(relationId, variant = 0, className = '', enabledShapes = SHAPES.map((shape) => shape.id)) {
  const visual = createRelationVisual(
    relationId,
    { enabledShapes, previousPairKey: variant % 2 ? '__skip__' : '' },
    seededRng(relationId, variant),
  );
  return relationVisualSVG(visual, className);
}

export function relationVisualSVG(visual, className = '') {
  const relation = RELATION_BY_ID[visual.semantic];
  const body = visual.nodes.map((node) => shapeSvg(node.shape, node.cx, node.cy, node.size, 'glyph-node')).join('');
  return `<svg class="relation-glyph ${className}" viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(relation?.label || visual.semantic)}">${body}</svg>`;
}

export function relationGuideData(enabledShapes = SHAPES.map((shape) => shape.id), variant = 0) {
  return Object.keys(RELATION_BY_ID).map((id, index) => {
    const relation = RELATION_BY_ID[id];
    const visual = createRelationVisual(id, { enabledShapes }, seededRng(id, variant + index));
    return {
      id,
      label: relation.label,
      family: relation.family,
      inverse: RELATION_BY_ID[relation.inverse].label,
      sentence: relation.sentence,
      layout: relation.layout,
      rule: relation.rule,
      first: visual.first,
      second: visual.second,
      firstLabel: SHAPE_LABELS[visual.first],
      secondLabel: SHAPE_LABELS[visual.second],
      firstSides: SHAPE_SIDES[visual.first],
      secondSides: SHAPE_SIDES[visual.second],
      reading: readingFor(id, visual),
      svg: relationVisualSVG(visual),
    };
  });
}

/**
 * Plain-language sentence describing the specific icon that was drawn, e.g.
 * "Circle has 1 side and Square has 4, so the circle is the first term: the
 * circle is drawn as the big outer shape, which reads circle contains square."
 */
export function readingFor(relationId, visual) {
  const first = `${SHAPE_LABELS[visual.first]} (${SHAPE_SIDES[visual.first]} ${plural(SHAPE_SIDES[visual.first])})`;
  const second = `${SHAPE_LABELS[visual.second]} (${SHAPE_SIDES[visual.second]} ${plural(SHAPE_SIDES[visual.second])})`;
  const role = {
    SAME: 'both are drawn at the same size on one centre',
    OPPOSITE: 'both are drawn at the same size with a gap between them',
    CONTAINS: `the ${SHAPE_LABELS[visual.first].toLowerCase()} is the outer shape`,
    INSIDE: `the ${SHAPE_LABELS[visual.first].toLowerCase()} is the inner shape`,
    LEADS_TO: `the ${SHAPE_LABELS[visual.first].toLowerCase()} is drawn higher`,
    FOLLOWS: `the ${SHAPE_LABELS[visual.first].toLowerCase()} is drawn lower`,
    GREATER: `the ${SHAPE_LABELS[visual.first].toLowerCase()} is drawn bigger`,
    LESS: `the ${SHAPE_LABELS[visual.first].toLowerCase()} is drawn smaller`,
  }[relationId];
  const verb = {
    SAME: 'is the same as',
    OPPOSITE: 'is the opposite of',
    CONTAINS: 'contains',
    INSIDE: 'is inside',
    LEADS_TO: 'leads to',
    FOLLOWS: 'follows',
    GREATER: 'is greater than',
    LESS: 'is less than',
  }[relationId];
  return {
    first,
    second,
    role,
    sentence: `${SHAPE_LABELS[visual.first]} ${verb} ${SHAPE_LABELS[visual.second].toLowerCase()}.`,
  };
}

function relationNodes(relationId, { first, second, mirrored }) {
  const [leftX, rightX] = mirrored ? [84, 36] : [36, 84];
  const [nearX, farX] = mirrored ? [72, 48] : [48, 72];

  switch (relationId) {
    // EQUIVALENCE: equal sizes.
    case 'SAME':
      return mirrored
        ? [
            { shape: second, cx: 60, cy: 60, size: SIZE.equalOuter, role: 'second' },
            { shape: first, cx: 60, cy: 60, size: SIZE.equalInner, role: 'first' },
          ]
        : [
            { shape: first, cx: 60, cy: 60, size: SIZE.equalOuter, role: 'first' },
            { shape: second, cx: 60, cy: 60, size: SIZE.equalInner, role: 'second' },
          ];
    case 'OPPOSITE':
      return [
        { shape: first, cx: leftX, cy: 60, size: SIZE.apart, role: 'first' },
        { shape: second, cx: rightX, cy: 60, size: SIZE.apart, role: 'second' },
      ];

    // CONTAINMENT: one shape inside the other.
    case 'CONTAINS':
      return [
        { shape: first, cx: 60, cy: 60, size: SIZE.container, role: 'first' },
        { shape: second, cx: 60, cy: 60, size: SIZE.contained, role: 'second' },
      ];
    case 'INSIDE':
      return [
        { shape: second, cx: 60, cy: 60, size: SIZE.container, role: 'second' },
        { shape: first, cx: 60, cy: 60, size: SIZE.contained, role: 'first' },
      ];

    // MAGNITUDE: one clearly big, one clearly small.
    case 'GREATER':
      return [
        { shape: first, cx: leftX, cy: 60, size: SIZE.big, role: 'first' },
        { shape: second, cx: rightX, cy: 60, size: SIZE.small, role: 'second' },
      ];
    case 'LESS':
      return [
        { shape: first, cx: leftX, cy: 60, size: SIZE.small, role: 'first' },
        { shape: second, cx: rightX, cy: 60, size: SIZE.big, role: 'second' },
      ];

    // SEQUENCE: equal sizes, diagonal overlap, meaning carried by height only.
    case 'LEADS_TO':
      return [
        { shape: first, cx: nearX, cy: 46, size: SIZE.sequence, role: 'first' },
        { shape: second, cx: farX, cy: 74, size: SIZE.sequence, role: 'second' },
      ];
    case 'FOLLOWS':
      return [
        { shape: second, cx: nearX, cy: 46, size: SIZE.sequence, role: 'second' },
        { shape: first, cx: farX, cy: 74, size: SIZE.sequence, role: 'first' },
      ];

    default:
      throw new Error(`Unknown relation visual: ${relationId}`);
  }
}

function createPairs(shapes) {
  const pairs = [];
  for (let i = 0; i < shapes.length; i += 1) {
    for (let j = i + 1; j < shapes.length; j += 1) {
      const a = shapes[i];
      const b = shapes[j];
      pairs.push({ shapes: [a, b], key: [a, b].sort().join('|') });
    }
  }
  return pairs;
}

function uniqueShapeIds(ids) {
  return [...new Set(ids)].filter((id) => SHAPE_SIDES[id]);
}

function plural(count) {
  return count === 1 ? 'side' : 'sides';
}

function pick(items, rng) {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function seededRng(relationId, variant) {
  let seed = [...`${relationId}:${variant}`].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 17) >>> 0;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export const RELATION_VARIANT_COUNT = 3;
export { SHAPE_LABELS };

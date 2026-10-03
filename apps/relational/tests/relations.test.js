import test from 'node:test';
import assert from 'node:assert/strict';
import {
  positionMatches,
  numberMatches,
  shapeMatches,
  relationMatches,
  validNumberPrompts,
  validShapePrompts,
} from '../src/relations.js';
import { createRelationVisual } from '../src/symbols.js';
import { SHAPE_SIDES, RELATIONS } from '../src/constants.js';

test('position prompt uses current-to-N-back direction in 2D', () => {
  const current = { x: 1, y: 1, z: 1 };
  assert.equal(positionMatches(current, { x: 1, y: 0, z: 1 }, 'NORTH', '2d'), true);
  assert.equal(positionMatches(current, { x: 2, y: 1, z: 1 }, 'EAST', '2d'), true);
  assert.equal(positionMatches(current, { x: 0, y: 1, z: 1 }, 'EAST', '2d'), false);
  assert.equal(positionMatches(current, { x: 2, y: 1, z: 1 }, 'ROW', '2d'), true);
  assert.equal(positionMatches(current, { x: 1, y: 2, z: 1 }, 'COLUMN', '2d'), true);
});

test('3D above and below operate in cube-local coordinates', () => {
  const current = { x: 1, y: 1, z: 1 };
  assert.equal(positionMatches(current, { x: 1, y: 1, z: 2 }, 'ABOVE', '3d-static'), true);
  assert.equal(positionMatches(current, { x: 1, y: 1, z: 0 }, 'BELOW', '3d-rotating'), true);
});

test('digit offsets follow N-back = current + delta', () => {
  assert.equal(numberMatches(9, 6, { type: 'DELTA', delta: -3 }), true);
  assert.equal(numberMatches(4, 5, { type: 'AFTER' }), true);
  assert.equal(numberMatches(4, 3, { type: 'BEFORE' }), true);
  assert.equal(numberMatches(9, 9, { type: 'DELTA', delta: 0 }), true);
});

test('digit prompt generation exposes the current-to-remembered delta', () => {
  const prompts = validNumberPrompts(9, 4);
  assert.equal(prompts.some((p) => p.type === 'DELTA' && p.delta === -5), true);
  assert.equal(prompts.some((p) => p.type === 'AFTER'), false);
});

test('shape offsets use semantic side values, including circle=1', () => {
  assert.equal(shapeMatches('SQUARE', 'CIRCLE', { type: 'DELTA', delta: -3 }), true);
  assert.equal(shapeMatches('TRIANGLE', 'SQUARE', { type: 'MORE' }), true);
  assert.equal(shapeMatches('HEXAGON', 'PENTAGON', { type: 'FEWER' }), true);
});

test('shape prompt generation only returns reachable side counts', () => {
  const prompts = validShapePrompts('HEXAGON', 'CIRCLE');
  assert.equal(prompts.some((p) => p.type === 'DELTA' && p.delta === 1), false);
  assert.equal(prompts.some((p) => p.type === 'DELTA' && p.delta === -5), true);
});

test('relation matching separates semantics from icon variants', () => {
  assert.equal(relationMatches('CONTAINS', 'INSIDE', 'INVERSE'), true);
  assert.equal(relationMatches('GREATER', 'LESS', 'INVERSE'), true);
  assert.equal(relationMatches('CONTAINS', 'INSIDE', 'SAME_FAMILY'), true);
  assert.equal(relationMatches('LEADS_TO', 'GREATER', 'SAME_FAMILY'), false);
  assert.equal(relationMatches('FOLLOWS', 'FOLLOWS', 'SAME'), true);
});

test('relation visuals enforce different shapes and side-count roles', () => {
  const visual = createRelationVisual('CONTAINS', { enabledShapes: ['CIRCLE', 'SQUARE', 'TRIANGLE'] }, () => 0.2);
  assert.equal(visual.nodes.length, 2);
  assert.notEqual(visual.nodes[0].shape, visual.nodes[1].shape);
  assert.equal(SHAPE_SIDES[visual.first] < SHAPE_SIDES[visual.second], true, 'first term always has fewer sides');
  const outer = visual.nodes.reduce((a, b) => (a.size >= b.size ? a : b));
  assert.equal(outer.shape, visual.first, 'contains puts the fewer-sided first term on the outside');
});

test('contains and inside are exact mirrors of each other', () => {
  const rng = () => 0.2;
  const contains = createRelationVisual('CONTAINS', { enabledShapes: ['CIRCLE', 'HEXAGON'] }, rng);
  const inside = createRelationVisual('INSIDE', { enabledShapes: ['CIRCLE', 'HEXAGON'] }, rng);
  const outerOf = (v) => v.nodes.reduce((a, b) => (a.size >= b.size ? a : b)).shape;
  assert.equal(outerOf(contains), contains.first);
  assert.equal(outerOf(inside), inside.second);
});

test('greater and less are decided by side count, never by left versus right', () => {
  const makeRng = (values) => {
    let index = 0;
    return () => values[index++] ?? values.at(-1) ?? 0;
  };
  const pool = ['CIRCLE', 'HEXAGON'];
  const notMirrored = createRelationVisual('GREATER', { enabledShapes: pool }, makeRng([0, 0]));
  const mirrored = createRelationVisual('GREATER', { enabledShapes: pool }, makeRng([0, 0.99]));
  const nodeFor = (visual, shape) => visual.nodes.find((node) => node.shape === shape);

  assert.notEqual(nodeFor(notMirrored, 'CIRCLE').cx, nodeFor(mirrored, 'CIRCLE').cx, 'either side is possible');
  for (const visual of [notMirrored, mirrored]) {
    assert.ok(nodeFor(visual, 'CIRCLE').size > nodeFor(visual, 'HEXAGON').size, 'greater draws the fewer-sided first term bigger');
  }

  const less = createRelationVisual('LESS', { enabledShapes: pool }, makeRng([0, 0]));
  assert.ok(nodeFor(less, 'CIRCLE').size < nodeFor(less, 'HEXAGON').size, 'less draws the fewer-sided first term smaller');
});

test('leads to and follows are decided by height, not by horizontal lean', () => {
  const pool = ['TRIANGLE', 'HEXAGON'];
  const makeRng = (values) => { let i = 0; return () => values[i++] ?? values.at(-1) ?? 0; };
  for (const mirror of [0, 0.99]) {
    const leads = createRelationVisual('LEADS_TO', { enabledShapes: pool }, makeRng([0, mirror]));
    const follows = createRelationVisual('FOLLOWS', { enabledShapes: pool }, makeRng([0, mirror]));
    const higher = (v) => v.nodes.reduce((a, b) => (a.cy <= b.cy ? a : b)).shape;
    assert.equal(higher(leads), leads.first, 'leads to puts the fewer-sided first term higher');
    assert.equal(higher(follows), follows.second, 'follows puts the fewer-sided first term lower');
    assert.equal(leads.nodes[0].size, leads.nodes[1].size, 'sequence icons keep both shapes the same size');
  }
});

test('equivalence icons keep both shapes at a comparable size', () => {
  const rng = () => 0.2;
  for (const id of ['SAME', 'OPPOSITE']) {
    const visual = createRelationVisual(id, { enabledShapes: ['CIRCLE', 'PENTAGON'] }, rng);
    const [a, b] = visual.nodes.map((node) => node.size);
    assert.ok(Math.min(a, b) / Math.max(a, b) > 0.75, `${id} must not look like a magnitude or containment icon`);
  }
  const same = createRelationVisual('SAME', { enabledShapes: ['CIRCLE', 'PENTAGON'] }, rng);
  const opposite = createRelationVisual('OPPOSITE', { enabledShapes: ['CIRCLE', 'PENTAGON'] }, rng);
  assert.equal(same.nodes[0].cx, same.nodes[1].cx, 'same stacks on one centre');
  assert.notEqual(opposite.nodes[0].cx, opposite.nodes[1].cx, 'opposite is held apart');
});

test('every relation is drawn from a pair of distinct shapes for any pool', () => {
  for (const relation of RELATIONS) {
    for (let seed = 0; seed < 25; seed += 1) {
      const visual = createRelationVisual(relation.id, { enabledShapes: ['CIRCLE', 'TRIANGLE', 'SQUARE', 'PENTAGON', 'HEXAGON'] });
      assert.equal(visual.nodes.length, 2);
      assert.notEqual(visual.nodes[0].shape, visual.nodes[1].shape);
      assert.ok(SHAPE_SIDES[visual.first] < SHAPE_SIDES[visual.second]);
    }
  }
});

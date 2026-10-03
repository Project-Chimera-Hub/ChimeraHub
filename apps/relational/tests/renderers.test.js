import test from 'node:test';
import assert from 'node:assert/strict';
import { render2DGrid, renderSoloStage, stimulusSvgMarkup, relationInset } from '../src/renderers.js';

const trial = {
  position: { x: 2, y: 0, z: 1 },
  shape: 'HEXAGON',
  relation: {
    semantic: 'GREATER',
    nodes: [
      { shape: 'CIRCLE', cx: 36, cy: 60, size: 27 },
      { shape: 'HEXAGON', cx: 84, cy: 60, size: 12 },
    ],
  },
};
const streams = (overrides) => ({ position: false, sound: false, shape: false, relation: false, ...overrides });

test('disabled shape and relation streams are absent from 2D stimulus markup', () => {
  const html = stimulusSvgMarkup(trial.shape, trial.relation, streams({ position: true }));
  assert.doesNotMatch(html, /stimulus-outline/);
  assert.doesNotMatch(html, /stimulus-relation/);
});

test('disabled relation stream removes relation icon but preserves enabled outer shape', () => {
  const html = stimulusSvgMarkup(trial.shape, trial.relation, streams({ position: true, shape: true }));
  assert.match(html, /stimulus-outline/);
  assert.doesNotMatch(html, /stimulus-relation/);
});

test('disabled shape stream removes outer shape but preserves enabled relation icon', () => {
  const html = stimulusSvgMarkup(trial.shape, trial.relation, streams({ relation: true }));
  assert.doesNotMatch(html, /stimulus-outline/);
  assert.match(html, /stimulus-relation/);
});

test('relation icon is inset further when it shares a cell with the shape outline', () => {
  const withShape = relationInset(streams({ shape: true, relation: true }));
  const alone = relationInset(streams({ relation: true }));
  assert.ok(withShape.size < alone.size, 'sharing a cell must shrink the relation icon');
});

test('a disabled position stream draws no grid at all', () => {
  const container = { innerHTML: 'stale' };
  render2DGrid(container, trial, true, streams({ shape: true, relation: true }));
  assert.equal(container.innerHTML, '', 'no cells, no highlight, no spatial information');
});

test('an enabled position stream highlights exactly the trial cell', () => {
  const container = { innerHTML: '' };
  render2DGrid(container, trial, true, streams({ position: true, shape: true, relation: true }));
  assert.match(container.innerHTML, /grid-cell active" data-cell="2"/);
  assert.equal((container.innerHTML.match(/grid-cell active/g) || []).length, 1);
  assert.equal((container.innerHTML.match(/stimulus-svg/g) || []).length, 1);
});

test('solo stage shows only the stimuli of enabled streams', () => {
  const container = { innerHTML: '' };
  renderSoloStage(container, trial, true, streams({ sound: true, relation: true }));
  assert.match(container.innerHTML, /stimulus-relation/);
  assert.doesNotMatch(container.innerHTML, /stimulus-outline/);
});

test('sound-only mode renders no shape, no relation and no position cue', () => {
  const container = { innerHTML: '' };
  renderSoloStage(container, trial, true, streams({ sound: true }));
  assert.doesNotMatch(container.innerHTML, /stimulus-outline/);
  assert.doesNotMatch(container.innerHTML, /stimulus-relation/);
  assert.match(container.innerHTML, /neutral-marker/);
});

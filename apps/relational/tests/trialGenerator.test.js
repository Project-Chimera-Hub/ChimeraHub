import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrialSequence } from '../src/trialGenerator.js';
import { positionMatches, numberMatches, shapeMatches, relationMatches } from '../src/relations.js';

function rng(seed = 123456) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function verifyTruth(sequence, config) {
  for (let i = config.n; i < sequence.length; i += 1) {
    const trial = sequence[i];
    const remembered = sequence[i - trial.nBack];
    assert.equal(positionMatches(trial.position, remembered.position, trial.prompts.position, config.mode), trial.targets.position, `position trial ${i}`);
    assert.equal(numberMatches(trial.number, remembered.number, trial.prompts.sound), trial.targets.sound, `sound trial ${i}`);
    assert.equal(shapeMatches(trial.shape, remembered.shape, trial.prompts.shape), trial.targets.shape, `shape trial ${i}`);
    assert.equal(relationMatches(trial.relation.semantic, remembered.relation.semantic, trial.prompts.relation), trial.targets.relation, `relation trial ${i}`);
  }
}

test('sequence contains max-N warmups plus requested scored trials', () => {
  const config = { n: 2, trials: 30, mode: '2d', targetRate: 0.35, lureRate: 0 };
  const sequence = createTrialSequence(config, rng());
  assert.equal(sequence.length, 32);
  assert.equal(sequence.filter((t) => t.scored).length, 30);
  assert.equal(sequence[0].scored, false);
  assert.equal(sequence[1].scored, false);
});

test('stored ground truth always agrees with actual relational algebra in 2D', () => {
  const config = { n: 3, trials: 80, mode: '2d', targetRate: 0.4, lureRate: 0.1 };
  const sequence = createTrialSequence(config, rng(4));
  verifyTruth(sequence, config);
});

test('stored ground truth agrees in rotating 3D mode', () => {
  const config = { n: 2, trials: 80, mode: '3d-rotating', targetRate: 0.4, lureRate: 0.1 };
  const sequence = createTrialSequence(config, rng(8));
  verifyTruth(sequence, config);
});

test('prompts do not simply repeat on consecutive trials', () => {
  const config = { n: 2, trials: 50, mode: '3d-static', targetRate: 0.35, lureRate: 0 };
  const sequence = createTrialSequence(config, rng(22));
  for (let i = 1; i < sequence.length; i += 1) {
    assert.notEqual(sequence[i].prompts.position, sequence[i - 1].prompts.position);
    assert.notDeepEqual(sequence[i].prompts.sound, sequence[i - 1].prompts.sound);
    assert.notDeepEqual(sequence[i].prompts.shape, sequence[i - 1].prompts.shape);
    assert.notEqual(sequence[i].prompts.relation, sequence[i - 1].prompts.relation);
  }
});

test('every relation stimulus uses two different shapes', () => {
  const sequence = createTrialSequence({ n: 2, trials: 50, mode: '2d', targetRate: 0.35, enabledShapes: { CIRCLE: true, TRIANGLE: true, SQUARE: true, PENTAGON: true, HEXAGON: true } }, rng(3));
  for (const trial of sequence) {
    assert.equal(typeof trial.relation.semantic, 'string');
    assert.equal(trial.relation.nodes.length, 2);
    assert.notEqual(trial.relation.nodes[0].shape, trial.relation.nodes[1].shape);
  }
});

test('long sessions actually use a broad mix of relational demands', () => {
  const sequence = createTrialSequence({ n: 2, trials: 120, mode: '3d-rotating', targetRate: 0.35, lureRate: 0, maxOffset: 5 }, rng(77));
  assert.ok(new Set(sequence.map(t => t.prompts.position)).size >= 6, 'position should use at least six prompt types in 3D');
  assert.equal(new Set(sequence.map(t => t.prompts.relation)).size, 3, 'all relation meta-prompts should appear');
  assert.ok(new Set(sequence.map(t => t.prompts.sound.type)).size >= 3, 'sound should use before, after and delta');
  assert.ok(new Set(sequence.map(t => t.prompts.shape.type)).size >= 3, 'shape should use fewer, more and delta');
});

test('variable N samples within the requested floor and max N', () => {
  const sequence = createTrialSequence({ n: 5, trials: 50, variableN: true, variableFloor: 2, mode: '2d', targetRate: 0.35 }, rng(12));
  const nValues = sequence.filter((t) => t.scored).map((t) => t.nBack);
  assert.ok(nValues.every((n) => n >= 2 && n <= 5));
  assert.ok(new Set(nValues).size >= 3, 'should use multiple N values');
});

test('disabled streams never produce targets', () => {
  const sequence = createTrialSequence({ n: 2, trials: 30, mode: '2d', streams: { position: true, sound: false, shape: false, relation: true } }, rng(19));
  for (const trial of sequence.filter((t) => t.scored)) {
    assert.equal(trial.targets.sound, false);
    assert.equal(trial.targets.shape, false);
  }
});

test('shape pool can exclude individual shapes', () => {
  const sequence = createTrialSequence({ n: 2, trials: 30, enabledShapes: { CIRCLE: true, TRIANGLE: false, SQUARE: true, PENTAGON: false, HEXAGON: true } }, rng(25));
  const seenOuterShapes = new Set(sequence.map((t) => t.shape));
  assert.equal(seenOuterShapes.has('TRIANGLE'), false);
  assert.equal(seenOuterShapes.has('PENTAGON'), false);
  for (const trial of sequence) {
    for (const node of trial.relation.nodes) {
      assert.ok(['CIRCLE', 'SQUARE', 'HEXAGON'].includes(node.shape));
    }
  }
});

test('sound stimuli stay inside the prerecorded Quad Box 1-8 range', () => {
  const sequence = createTrialSequence({ n: 2, trials: 80, mode: '2d', targetRate: 0.35 }, rng(90));
  assert.ok(sequence.every((trial) => trial.number >= 1 && trial.number <= 8));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createScoreboard, scoreTrial, summarizeScoreboard } from '../src/session.js';

const streams = ['position', 'sound', 'shape', 'relation'];

test('scoreTrial records hit miss false alarm and correct rejection independently', () => {
  const board = createScoreboard();
  const truth = { position: true, sound: true, shape: false, relation: false };
  const responses = { position: true, sound: false, shape: true, relation: false };
  const verdicts = scoreTrial(board, truth, responses, { position: false, sound: false, shape: false, relation: false });
  assert.deepEqual(verdicts, { position: 'HIT', sound: 'MISS', shape: 'FALSE_ALARM', relation: 'CORRECT_REJECTION' });
  assert.equal(board.position.hit, 1);
  assert.equal(board.sound.miss, 1);
  assert.equal(board.shape.falseAlarm, 1);
  assert.equal(board.relation.correctRejection, 1);
});

test('summary calculates stream and combined accuracy', () => {
  const board = createScoreboard();
  scoreTrial(board,
    { position: true, sound: false, shape: true, relation: false },
    { position: true, sound: false, shape: false, relation: true },
    { position: false, sound: false, shape: false, relation: false });
  const summary = summarizeScoreboard(board);
  assert.equal(summary.streams.position.accuracy, 100);
  assert.equal(summary.streams.sound.accuracy, 100);
  assert.equal(summary.streams.shape.accuracy, 0);
  assert.equal(summary.streams.relation.accuracy, 0);
  assert.equal(summary.combinedAccuracy, 50);
  assert.deepEqual(Object.keys(summary.streams), streams);
});

test('lure resistance counts correct rejections of lure trials', () => {
  const board = createScoreboard();
  scoreTrial(board,
    { position: false, sound: false, shape: false, relation: false },
    { position: true, sound: false, shape: false, relation: false },
    { position: true, sound: false, shape: false, relation: false },
    streams);
  const summary = summarizeScoreboard(board);
  assert.equal(summary.streams.position.lureErrors, 1);
});

test('inactive streams are skipped from combined scoring', () => {
  const board = createScoreboard(['position']);
  scoreTrial(board,
    { position: true, sound: false, shape: false, relation: false },
    { position: true, sound: true, shape: true, relation: true },
    { position: false, sound: false, shape: false, relation: false },
    ['position']);
  const summary = summarizeScoreboard(board, ['position']);
  assert.equal(summary.combinedAccuracy, 100);
  assert.equal(summary.streams.sound.total, 0);
});

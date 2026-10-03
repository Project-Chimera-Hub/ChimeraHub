import test from 'node:test';
import assert from 'node:assert/strict';
import { rotatePoint, projectPoint } from '../src/projection.js';

test('zero-angle rotation leaves point unchanged', () => {
  const point = rotatePoint({ x: 1, y: -2, z: 3 }, 0, 0);
  assert.ok(Math.abs(point.x - 1) < 1e-10);
  assert.ok(Math.abs(point.y + 2) < 1e-10);
  assert.ok(Math.abs(point.z - 3) < 1e-10);
});

test('90 degree Y rotation moves +X toward -Z', () => {
  const point = rotatePoint({ x: 1, y: 0, z: 0 }, Math.PI / 2, 0);
  assert.ok(Math.abs(point.x) < 1e-10);
  assert.ok(Math.abs(point.z + 1) < 1e-10);
});

test('projection makes nearer points appear farther from center', () => {
  const near = projectPoint({ x: 1, y: 0, z: 1 }, 300, 300, 4, 180);
  const far = projectPoint({ x: 1, y: 0, z: -1 }, 300, 300, 4, 180);
  assert.ok(Math.abs(near.x - 150) > Math.abs(far.x - 150));
});

import { SHAPE_SIDES } from './constants.js';

/**
 * Rotation offset (radians) applied per shape so that polygons read the way
 * people expect them to. Without this a 4-sided polygon drawn from -90 degrees
 * lands on its corner and reads as a diamond rather than a square.
 */
const ROTATION_OFFSET = Object.freeze({
  CIRCLE: 0,
  TRIANGLE: 0,
  SQUARE: Math.PI / 4,
  PENTAGON: 0,
  HEXAGON: Math.PI / 6,
});

export function sidesOf(shapeId) {
  return SHAPE_SIDES[shapeId] || 0;
}

export function isRound(shapeId) {
  return shapeId === 'CIRCLE';
}

export function polygonVertices(shapeId, cx, cy, radius) {
  const sides = sidesOf(shapeId);
  const offset = ROTATION_OFFSET[shapeId] ?? 0;
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + offset + (index * Math.PI * 2) / sides;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });
}

export function polygonPoints(shapeId, cx, cy, radius) {
  return polygonVertices(shapeId, cx, cy, radius)
    .map((point) => `${round(point.x)},${round(point.y)}`)
    .join(' ');
}

export function shapeSvg(shapeId, cx, cy, radius, className = '') {
  if (isRound(shapeId)) {
    return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radius)}" class="${className}"/>`;
  }
  return `<polygon points="${polygonPoints(shapeId, cx, cy, radius)}" class="${className}"/>`;
}

export function traceShape(ctx, shapeId, cx, cy, radius) {
  ctx.beginPath();
  if (isRound(shapeId)) {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    return;
  }
  polygonVertices(shapeId, cx, cy, radius).forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

function round(value) {
  return Math.round(value * 100) / 100;
}

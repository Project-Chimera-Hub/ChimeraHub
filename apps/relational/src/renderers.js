import { relationVisualSVG } from './symbols.js';
import { rotatePoint, projectPoint } from './projection.js';
import { DEFAULT_STREAMS } from './constants.js';
import { shapeSvg, traceShape } from './geometry.js';

const OUTLINE_RADIUS = 54;
const NEUTRAL_MARKER = '<svg class="stimulus-svg neutral-marker" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="26"/></svg>';

export function hasVisualStream(streams = DEFAULT_STREAMS) {
  return Boolean(streams.position || streams.shape || streams.relation);
}

export function hasCellContent(streams = DEFAULT_STREAMS) {
  return Boolean(streams.shape || streams.relation);
}

/**
 * The 3x3 grid is only ever drawn when the position stream is enabled. When it
 * is off there is no grid, no highlighted cell and no spatial information of
 * any kind on screen; the app switches to the solo stage instead.
 */
export function render2DGrid(container, trial, visible = true, streams = DEFAULT_STREAMS) {
  if (!streams.position) {
    container.innerHTML = '';
    return;
  }
  const activeIndex = trial.position.y * 3 + trial.position.x;
  container.innerHTML = Array.from({ length: 9 }, (_, index) => {
    const active = visible && index === activeIndex;
    const stimulus = active && hasCellContent(streams) ? stimulusSvgMarkup(trial.shape, trial.relation, streams) : '';
    return `<div class="grid-cell${active ? ' active' : ''}" data-cell="${index}">${stimulus}</div>`;
  }).join('');
}

/**
 * Used when the position stream is disabled. Shows only the stimuli that belong
 * to enabled streams, in one fixed, information-free location.
 */
export function renderSoloStage(container, trial, visible = true, streams = DEFAULT_STREAMS) {
  if (!visible) {
    container.innerHTML = '<div class="solo-cell"></div>';
    return;
  }
  const body = hasCellContent(streams)
    ? stimulusSvgMarkup(trial.shape, trial.relation, streams)
    : NEUTRAL_MARKER;
  container.innerHTML = `<div class="solo-cell active">${body}</div>`;
}

export function stimulusSvgMarkup(shapeId, relationVisual, streams = DEFAULT_STREAMS) {
  const outline = streams.shape ? shapeSvg(shapeId, 60, 60, OUTLINE_RADIUS, 'stimulus-outline') : '';
  let relation = '';
  if (streams.relation) {
    const { offset, size } = relationInset(streams);
    relation = relationVisualSVG(relationVisual, 'stimulus-relation')
      .replace('<svg ', `<svg x="${offset}" y="${offset}" width="${size}" height="${size}" `);
  }
  return `<svg class="stimulus-svg" viewBox="0 0 120 120">${outline}${relation}</svg>`;
}

/**
 * When the shape stream is also on, the relation icon is pulled well inside the
 * outline so the two layers never read as one nested drawing. The outline is
 * the SHAPE stream and is never one of the two related shapes.
 */
export function relationInset(streams = DEFAULT_STREAMS) {
  return streams.shape ? { offset: 24, size: 72 } : { offset: 6, size: 108 };
}

export function draw3DStimulus(canvas, trial, options = {}) {
  const { yaw = 0.65, pitch = -0.42, visible = true, streams = DEFAULT_STREAMS } = options;
  const ratio = globalThis.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 720;
  const cssHeight = canvas.clientHeight || 560;
  if (canvas.width !== Math.round(cssWidth * ratio) || canvas.height !== Math.round(cssHeight * ratio)) {
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  if (!streams.position) return;

  const logical = [];
  for (let z = 0; z < 3; z += 1) for (let y = 0; y < 3; y += 1) for (let x = 0; x < 3; x += 1) {
    const world = { x: (x - 1) * 1.12, y: (y - 1) * 1.12, z: (z - 1) * 1.12 };
    const rotated = rotatePoint(world, yaw, pitch);
    const projected = projectPoint(rotated, cssWidth, cssHeight, 5.2, Math.min(cssWidth, cssHeight) * 1.0);
    logical.push({ x, y, z, projected });
  }

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#2c2c31';
  for (const a of logical) {
    for (const b of logical) {
      const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
      if (distance !== 1) continue;
      if (a.x * 9 + a.y * 3 + a.z >= b.x * 9 + b.y * 3 + b.z) continue;
      ctx.beginPath(); ctx.moveTo(a.projected.x, a.projected.y); ctx.lineTo(b.projected.x, b.projected.y); ctx.stroke();
    }
  }

  const sorted = [...logical].sort((a, b) => a.projected.depth - b.projected.depth).reverse();
  for (const point of sorted) {
    const isActive = visible && point.x === trial.position.x && point.y === trial.position.y && point.z === trial.position.z;
    const size = Math.max(5, Math.min(15, point.projected.scale * 0.09));
    ctx.fillStyle = isActive ? '#f0c443' : '#202024';
    ctx.fillRect(point.projected.x - size / 2, point.projected.y - size / 2, size, size);
  }

  if (visible && hasCellContent(streams)) {
    const active = logical.find((p) => p.x === trial.position.x && p.y === trial.position.y && p.z === trial.position.z);
    if (active) {
      const radius = Math.max(30, Math.min(48, active.projected.scale * 0.32));
      drawCanvasStimulus(ctx, active.projected.x, active.projected.y, trial.shape, trial.relation, streams, radius);
    }
  }
}

export function drawCanvasStimulus(ctx, cx, cy, shapeId, relationVisual, streams, radius) {
  ctx.save();
  ctx.translate(cx, cy);
  const unit = radius / OUTLINE_RADIUS;

  if (streams.shape) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f5f5f2';
    ctx.fillStyle = '#0b0b0c';
    traceShape(ctx, shapeId, 0, 0, radius);
    ctx.fill();
    ctx.stroke();
  }

  if (streams.relation) {
    const { offset, size } = relationInset(streams);
    const scale = size / 120;
    ctx.strokeStyle = '#f0c443';
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    for (const node of relationVisual.nodes) {
      const boxX = offset + node.cx * scale;
      const boxY = offset + node.cy * scale;
      traceShape(ctx, node.shape, (boxX - 60) * unit, (boxY - 60) * unit, node.size * scale * unit);
      ctx.stroke();
    }
  }
  ctx.restore();
}

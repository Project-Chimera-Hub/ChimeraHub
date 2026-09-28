import { drawShape } from './shapeRenderer';
import { SHAPES, COLORS, pickRandom, pickRandomExcluding, randomBetween, isVerbal, isSound, getVerbalPair, buildVerbalDisplay, buildSoundDisplay, VORONOI_TOKEN_PREFIX, SCRAP_TOKEN_PREFIX, RELATIONSHIP_CATEGORIES, LANDSCAPE_PATHS, getAssetUrl } from './gameConstants';

// Pre-preload high-contrast lightweight landscape collage images
const loadedLandscapes = [];
if (typeof window !== 'undefined') {
  LANDSCAPE_PATHS.forEach((path, idx) => {
    const img = new Image();
    img.src = getAssetUrl(path);
    img.onload = () => {
      loadedLandscapes[idx] = img;
    };
  });
}


// Check if a relationship is 3D
export function is3D(relationship) {
  return RELATIONSHIP_CATEGORIES.SPATIAL_3D.includes(relationship);
}

export function renderAlienSquare(ctx, canvasW, canvasH, relationship, stimulus, panelCanvas = null) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const settings = stimulus?.alienSettings || {};
  const direction = settings.squareDirection === 'ccw' ? -1 : 1;
  const speed = Number(settings.squareSpeed || 1);
  const angle = direction * performance.now() * 0.00025 * speed;
  const size = Math.min(canvasW, canvasH) * 0.82;
  const cell = size / 3;
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const pos = stimulus?.squarePosition || { x: 0, y: 0 };

  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = 'rgba(154, 168, 255, 0.28)';
  ctx.lineWidth = 2;
  for (let i = -1.5; i <= 1.5; i += 1) {
    ctx.beginPath(); ctx.moveTo(i * cell, -size / 2); ctx.lineTo(i * cell, size / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-size / 2, i * cell); ctx.lineTo(size / 2, i * cell); ctx.stroke();
  }

  [
    { color: '#ff1744', from: [-size / 2, 0], to: [0, 0] },
    { color: '#ffc400', from: [0, 0], to: [size / 2, 0] },
    { color: '#7c3aed', from: [0, -size / 2], to: [0, 0] },
    { color: '#39ff14', from: [0, 0], to: [0, size / 2] },
  ].forEach(axis => {
    ctx.strokeStyle = axis.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(axis.from[0], axis.from[1]);
    ctx.lineTo(axis.to[0], axis.to[1]);
    ctx.stroke();
  });

  const selectedX = pos.x * cell - cell / 2;
  const selectedY = pos.y * cell - cell / 2;
  ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
  ctx.fillRect(selectedX, selectedY, cell, cell);
  ctx.shadowColor = stimulus?.colorA || '#22d3ee';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = stimulus?.colorA || '#22d3ee';
  ctx.lineWidth = 7;
  ctx.strokeRect(selectedX, selectedY, cell, cell);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.lineWidth = 2;
  ctx.strokeRect(selectedX + 4, selectedY + 4, cell - 8, cell - 8);
  ctx.restore();

  const panelW = Math.min(canvasW * 0.72, 420);
  const panelH = Math.min(canvasH * 0.42, 260);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = canvasW < 420 ? 'rgba(8, 13, 22, 0.72)' : 'rgba(8, 13, 22, 0.84)';
  ctx.beginPath();
  ctx.roundRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.translate(-panelW / 2, -panelH / 2);
  if (panelCanvas) {
    ctx.drawImage(panelCanvas, 0, 0, panelW, panelH);
  } else {
    renderRelationship(ctx, panelW, panelH, relationship, null, { ...stimulus, renderScale: 0.95 });
  }
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.shadowColor = stimulus?.colorA || '#22d3ee';
  ctx.shadowBlur = canvasW < 420 ? 24 : 18;
  ctx.strokeStyle = stimulus?.colorA || '#22d3ee';
  ctx.lineWidth = canvasW < 420 ? 8 : 6;
  ctx.strokeRect(selectedX, selectedY, cell, cell);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(selectedX + 5, selectedY + 5, cell - 10, cell - 10);
  ctx.restore();
}

// Visuals are now always taken from the stimulus entry (pre-generated in gameEngine).
// This ensures target replays look identical to the original stimulus.
function getVisuals(stimulus) {
  return {
    shapeA: stimulus?.shapeA || pickRandom(SHAPES),
    shapeB: stimulus?.shapeB || pickRandom(SHAPES),
    colorA: stimulus?.colorA || pickRandom(COLORS),
    colorB: stimulus?.colorB || pickRandomExcluding(COLORS, stimulus?.colorA || '#000'),
  };
}

// ── Verbal renderer ───────────────────────────────────────────────────────────

function drawVerbalPill(ctx, cx, cy, canvasW, canvasH) {
  const pillW = canvasW * 0.88;
  const pillH = canvasH * 0.64;
  ctx.save();
  ctx.fillStyle = 'hsla(220,18%,13%,0.75)';
  ctx.beginPath();
  ctx.roundRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, 20);
  ctx.fill();
  ctx.strokeStyle = 'hsla(168,80%,50%,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  return pillH;
}

// ── Full-canvas Voronoi renderer ──────────────────────────────────────────────
// Renders a proper Voronoi diagram filling the entire canvas (like the reference images).
// Uses a clipping-region approach: for each cell, clip to a polygon formed by the
// perpendicular bisectors with all other cells, then fill. Fast and accurate.
export function renderVoronoiCanvas(ctx, canvasW, canvasH, seed) {
  const N = 4 + (seed % 4); // 4–7 cells
  // Seeded RNG
  let h = seed | 1;
  const rng = () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 0xffffffff;
  };

  const PALETTES = [
    ['#1DB88A', '#151D2E', '#0F3460'],
    ['#F4A261', '#264653', '#2EC4B6', '#E9C46A'],
    ['#A8DADC', '#457B9D', '#1D3557'],
    ['#95D5B2', '#B5838D', '#E5989B', '#6D6875'],
    ['#FF6B6B', '#4ECDC4', '#45B7D1'],
    ['#A29BFE', '#6C5CE7', '#FD79A8'],
    ['#74B9FF', '#0984E3', '#2D3436'],
    ['#81ECEC', '#6C5CE7', '#FDCB6E', '#E17055'],
  ];
  const palette = PALETTES[seed % PALETTES.length];

  // Cell centers — well-spread using a jittered grid
  const cols = Math.ceil(Math.sqrt(N));
  const rows = Math.ceil(N / cols);
  const pts = [];
  for (let r = 0; r < rows && pts.length < N; r++) {
    for (let c = 0; c < cols && pts.length < N; c++) {
      const jx = (rng() - 0.5) * 0.5;
      const jy = (rng() - 0.5) * 0.5;
      pts.push({
        x: canvasW * ((c + 0.5 + jx) / cols),
        y: canvasH * ((r + 0.5 + jy) / rows),
        color: palette[pts.length % palette.length],
      });
    }
  }

  // For each cell, compute its Voronoi region via half-plane intersection
  // Start with full canvas rectangle, then clip by each bisector
  for (let i = 0; i < pts.length; i++) {
    // Polygon = canvas corners
    let poly = [
      { x: 0, y: 0 }, { x: canvasW, y: 0 },
      { x: canvasW, y: canvasH }, { x: 0, y: canvasH },
    ];

    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      // Half-plane: points closer to pts[i] than pts[j]
      // Bisector midpoint and normal
      const mx = (pts[i].x + pts[j].x) / 2;
      const my = (pts[i].y + pts[j].y) / 2;
      const nx = pts[j].x - pts[i].x; // normal points toward pts[j]
      const ny = pts[j].y - pts[i].y;
      // Keep side where dot(p - mid, n) <= 0 (i.e., closer to pts[i])
      poly = clipPolygonByHalfPlane(poly, mx, my, -nx, -ny);
      if (poly.length === 0) break;
    }

    if (poly.length < 3) continue;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k].x, poly[k].y);
    ctx.closePath();
    ctx.fillStyle = pts[i].color;
    ctx.fill();
    ctx.restore();
  }
}

// Sutherland-Hodgman clip polygon against half-plane defined by point (mx,my) and inward normal (nx,ny)
function clipPolygonByHalfPlane(poly, mx, my, nx, ny) {
  if (poly.length === 0) return [];
  const inside = p => (p.x - mx) * nx + (p.y - my) * ny >= 0;
  const intersect = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const denom = dx * nx + dy * ny;
    if (Math.abs(denom) < 1e-10) return a;
    const t = ((mx - a.x) * nx + (my - a.y) * ny) / denom;
    return { x: a.x + t * dx, y: a.y + t * dy };
  };
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i], prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = inside(cur), prevIn = inside(prev);
    if (curIn) { if (!prevIn) out.push(intersect(prev, cur)); out.push(cur); }
    else if (prevIn) out.push(intersect(prev, cur));
  }
  return out;
}

// ── Small Voronoi token renderer (for verbal stimuli tokens) ──────────────────
export function drawVoronoiToken(ctx, seed, cx, cy, size, color) {
  const N = 6;
  let h = 0;
  const safeSeed = typeof seed === 'string' ? seed : String(seed || '');
  for (let i = 0; i < safeSeed.length; i++) h = (h * 31 + safeSeed.charCodeAt(i)) & 0xffff;
  const rng = (offset) => { let x = Math.sin(h + offset) * 43758.5453123; return x - Math.floor(x); };
  const pts = [];
  for (let i = 0; i < N; i++) {
    pts.push({ x: cx + (rng(i * 2) - 0.5) * size, y: cy + (rng(i * 2 + 1) - 0.5) * size });
  }
  
  let hex = '#22d3ee';
  if (typeof color === 'string' && color.startsWith('#') && color.length >= 7) {
    hex = color;
  }
  const ri = parseInt(hex.slice(1,3), 16) || 34,
        gi = parseInt(hex.slice(3,5), 16) || 211,
        bi = parseInt(hex.slice(5,7), 16) || 238;
        
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, size/2, 0, Math.PI*2); ctx.clip();
  for (let pi = 0; pi < N; pi++) {
    const alpha = 0.5 + (pi/N)*0.5;
    ctx.fillStyle = `rgba(${ri},${gi},${bi},${alpha.toFixed(2)})`;
    ctx.beginPath(); ctx.arc(pts[pi].x, pts[pi].y, size*0.22, 0, Math.PI*2); ctx.fill();
  }
  ctx.strokeStyle = `rgba(${ri},${gi},${bi},0.5)`; ctx.lineWidth = 0.8;
  for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) {
    const dx=pts[j].x-pts[i].x, dy=pts[j].y-pts[i].y;
    if (Math.sqrt(dx*dx+dy*dy) < size*0.55) { ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.stroke(); }
  }
  ctx.fillStyle = `rgba(${ri},${gi},${bi},0.9)`;
  pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,2.2,0,Math.PI*2); ctx.fill(); });
  ctx.restore();
}

// Determine if a token is an emoji/symbol (render larger, no quotes)
function isSymbol(tok) {
  if (typeof tok !== 'string') return false;
  return /\p{Emoji}/u.test(tok) || /^[◈◉◊◌◍◎●○◐◑◒◓▲△▴▵▶▷▸▹►▻▼▽◆◇❋✦✧✩✪✫✬✭✮⬡⬢⬣⬟⬠⬤⭕🔷🔶🔹🔸🔺🔻💠🔘🔳🔲⌬⎔⏣⟁⟐⟡]/.test(tok);
}

// Voronoi token detection
function isVoronoi(tok) { return typeof tok === 'string' && tok.startsWith(VORONOI_TOKEN_PREFIX); }
function voronoiSeed(tok) { return tok.slice(VORONOI_TOKEN_PREFIX.length); }

// Scrap token detection
function isScrap(tok) { return typeof tok === 'string' && tok.startsWith(SCRAP_TOKEN_PREFIX); }
function scrapSeed(tok) { return Number(tok.slice(SCRAP_TOKEN_PREFIX.length)) || 0; }

function makeSeededPRNG(seed) {
  let s = seed || 1;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function drawScrapToken(ctx, seed, cx, cy, size, baseColor) {
  const rand = makeSeededPRNG(seed);
  
  ctx.save();
  
  // 1. Generate hand-torn polygon vertices
  const numPoints = 8 + Math.floor(rand() * 5); // 8 to 12 points
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const jaggedRadius = size * 0.44 + (rand() * 0.14 - 0.07) * size;
    points.push({
      x: cx + Math.cos(angle) * jaggedRadius,
      y: cy + Math.sin(angle) * jaggedRadius
    });
  }
  
  // 2. Render shadow for depth
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 5;
  
  // 3. Draw standard backdrop (cream card backing)
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = '#f8f5eb'; // Authentic aged cream paper backing
  ctx.fill();
  
  // Disable shadow for internal artwork
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // 4. Clip to the torn polygon to draw the layered photo inside!
  ctx.save();
  ctx.clip();
  
  // 5. Draw photo background (crop from random landscape image or use gradient fallback)
  let drewImage = false;
  
  const activeImages = loadedLandscapes.filter(Boolean);
  if (activeImages.length > 0) {
    const imgIndex = Math.floor(rand() * activeImages.length);
    const img = activeImages[imgIndex];
    if (img && img.complete && img.naturalWidth > 0) {
      const cropW = img.naturalWidth * (0.35 + rand() * 0.35);
      const cropH = img.naturalHeight * (0.35 + rand() * 0.35);
      const cropX = rand() * (img.naturalWidth - cropW);
      const cropY = rand() * (img.naturalHeight - cropH);
      
      ctx.drawImage(img, cropX, cropY, cropW, cropH, cx - size * 0.5, cy - size * 0.5, size, size);
      drewImage = true;
    }
  }

  if (!drewImage) {
    const gradType = rand();
    if (gradType < 0.33) {
      const grad = ctx.createLinearGradient(cx - size * 0.5, cy - size * 0.5, cx + size * 0.5, cy + size * 0.5);
      grad.addColorStop(0, '#f43f5e'); // Sunset rose
      grad.addColorStop(0.5, '#d946ef'); // Synthwave violet
      grad.addColorStop(1, '#6366f1'); // Electric indigo
      ctx.fillStyle = grad;
    } else if (gradType < 0.66) {
      const grad = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.5);
      grad.addColorStop(0, '#10b981'); // Emerald glow
      grad.addColorStop(1, '#06b6d4'); // Cyber cyan
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createLinearGradient(cx - size * 0.5, cy + size * 0.5, cx + size * 0.5, cy - size * 0.5);
      grad.addColorStop(0, '#f97316'); // Tangerine
      grad.addColorStop(1, '#e11d48'); // Coral ruby
      ctx.fillStyle = grad;
    }
    ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
  }
  
  // 6. Draw dynamic retro photographic grid or lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.5;
  const numGridLines = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < numGridLines; i++) {
    const lineX = cx - size * 0.5 + (i / numGridLines) * size;
    ctx.beginPath();
    ctx.moveTo(lineX, cy - size);
    ctx.lineTo(lineX, cy + size);
    ctx.stroke();
  }
  
  // 7. Draw geometric camera subject inside the photo (e.g. abstract neon circle, sun, cross, or triangle)
  const subjectType = rand();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2.5;
  if (subjectType < 0.25) {
    // Glowing golden sun/orb
    ctx.beginPath();
    ctx.arc(cx + (rand() * 10 - 5), cy + (rand() * 10 - 5), size * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.stroke();
  } else if (subjectType < 0.5) {
    // Abstract neon triangle
    ctx.beginPath();
    const triS = size * 0.15;
    ctx.moveTo(cx, cy - triS);
    ctx.lineTo(cx - triS, cy + triS * 0.8);
    ctx.lineTo(cx + triS, cy + triS * 0.8);
    ctx.closePath();
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.stroke();
  } else if (subjectType < 0.75) {
    // Twin orbiting rings
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.16, 0, Math.PI * 2);
    ctx.strokeStyle = '#f472b6';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#a78bfa';
    ctx.fill();
    ctx.stroke();
  } else {
    // Dynamic retro cross hairs
    ctx.strokeStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
    ctx.stroke();
  }
  
  // 8. Dynamic visual overlays (film scratches, burn mark or grunge texture)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx + (rand() * size * 0.4 - size * 0.2), cy + (rand() * size * 0.4 - size * 0.2), rand() * 12, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Restore from clipping
  ctx.restore();
  
  // 9. Draw the sketchy cream border to look like physically torn, hand-crafted borders
  ctx.strokeStyle = '#fffdfc'; // White torn paper edge outline
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();
  
  // 10. Scribbled pencil contour to complete the beautiful collage journal aesthetic!
  ctx.strokeStyle = 'rgba(9, 13, 22, 0.45)'; // Faint pencil sketch
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(points[0].x + (rand() * 2 - 1), points[0].y + (rand() * 2 - 1));
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x + (rand() * 2 - 1), points[i].y + (rand() * 2 - 1));
  }
  ctx.closePath();
  ctx.stroke();
  
  ctx.restore();
}

// Draw a single token (word, nonsense, emoji, symbol, or voronoi) centered at (x,y)
function drawToken(ctx, token, x, y, canvasW, color, renderScale = 1) {
  if (isScrap(token)) {
    const size = Math.min(canvasW * 0.26, 96) * renderScale;
    drawScrapToken(ctx, scrapSeed(token), x, y, size, color);
    return;
  }
  if (isVoronoi(token)) {
    const size = Math.min(canvasW * 0.22, 72) * renderScale;
    drawVoronoiToken(ctx, voronoiSeed(token), x, y, size, color);
    return;
  }
  const sym = isSymbol(token);
  const size = (sym ? Math.min(canvasW * 0.22, 90) : Math.min(canvasW * 0.18, 76)) * renderScale;
  drawShape(ctx, token, x, y, size, color, true);
}

function relationTextScale(renderScale = 1) {
  return renderScale > 1 ? Math.min(3.4, renderScale * 2.55) : 1.25;
}

// Mode 0: pure text/token (tokenA — verb — tokenB), stacked vertically
function renderVerbalText(ctx, cx, cy, canvasW, canvasH, tokenA, verb, tokenB, relationship, renderScale = 1) {
  const pillH = drawVerbalPill(ctx, cx, cy, canvasW, canvasH);
  drawToken(ctx, tokenA, cx, cy - canvasH * 0.15, canvasW, '#22d3ee', renderScale);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.min(canvasW * 0.07, 26) * relationTextScale(renderScale)}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'hsla(210,20%,65%,0.9)';
  ctx.fillText(verb, cx, cy);
  ctx.restore();
  drawToken(ctx, tokenB, cx, cy + canvasH * 0.15, canvasW, '#a78bfa', renderScale);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.min(canvasW * 0.046, 16) * renderScale}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'hsla(210,10%,40%,0.65)';
  ctx.fillText(relationship.replace(/_/g, ' '), cx, cy + pillH / 2 - 14);
  ctx.restore();
}

// Mode 1: shape A — verb text — shape B (shapes replace words entirely)
function renderVerbalShapes(ctx, cx, cy, canvasW, canvasH, verb, relationship, renderScale = 1) {
  drawVerbalPill(ctx, cx, cy, canvasW, canvasH);
  const shapeA = pickRandom(SHAPES);
  const shapeB = pickRandomExcluding(SHAPES, shapeA);
  const colorA = pickRandom(COLORS);
  const colorB = pickRandomExcluding(COLORS, colorA);
  const shapeSize = Math.min(canvasW, canvasH) * 0.18;
  drawShape(ctx, shapeA, cx - canvasW * 0.28, cy, shapeSize, colorA, true);
  drawShape(ctx, shapeB, cx + canvasW * 0.28, cy, shapeSize, colorB, true);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.min(canvasW * 0.07, 25) * relationTextScale(renderScale)}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'hsla(210,20%,70%,0.9)';
  ctx.fillText(verb, cx, cy);
  ctx.font = `${Math.min(canvasW * 0.046, 16) * renderScale}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'hsla(210,10%,40%,0.65)';
  ctx.fillText(relationship.replace(/_/g, ' '), cx, cy + canvasH * 0.24);
  ctx.restore();
}

// Mode 2: blended — token/shape on each side, verb center (horizontal layout)
function renderVerbalBlended(ctx, cx, cy, canvasW, canvasH, tokenA, verb, tokenB, relationship, renderScale = 1, stimulus = null) {
  drawVerbalPill(ctx, cx, cy, canvasW, canvasH);
  const lx = cx - canvasW * 0.28;
  const rx = cx + canvasW * 0.28;

  // 50%: each side is a shape + token stacked; 50%: each side is just a token (no shape)
  if (Math.random() < 0.5) {
    const shapeA = stimulus?.shapeA || pickRandom(SHAPES);
    const shapeB = stimulus?.shapeB || pickRandomExcluding(SHAPES, shapeA);
    const colorA = stimulus?.colorA || '#22d3ee';
    const colorB = stimulus?.colorB || '#a78bfa';
    const shapeSize = Math.min(canvasW, canvasH) * 0.13 * renderScale;
    drawShape(ctx, shapeA, lx, cy - canvasH * 0.1, shapeSize, colorA, true);
    drawToken(ctx, tokenA, lx, cy + canvasH * 0.1, canvasW, '#22d3ee', renderScale);
    drawShape(ctx, shapeB, rx, cy - canvasH * 0.1, shapeSize, colorB, true);
    drawToken(ctx, tokenB, rx, cy + canvasH * 0.1, canvasW, '#a78bfa', renderScale);
  } else {
    // token only, larger
    drawToken(ctx, tokenA, lx, cy, canvasW, '#22d3ee', renderScale);
    drawToken(ctx, tokenB, rx, cy, canvasW, '#a78bfa', renderScale);
  }

  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.min(canvasW * 0.06, 22) * relationTextScale(renderScale)}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'hsla(210,20%,65%,0.9)';
  ctx.fillText(verb, cx, cy);
  ctx.font = `${Math.min(canvasW * 0.046, 16) * renderScale}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'hsla(210,10%,40%,0.65)';
  ctx.fillText(relationship.replace(/_/g, ' '), cx, cy + canvasH * 0.27);
  ctx.restore();
}

// Mode 3: token A left, shape center (as verb stand-in), token B right
function renderVerbalSymbolVerb(ctx, cx, cy, canvasW, canvasH, tokenA, verb, tokenB, relationship, renderScale = 1) {
  drawVerbalPill(ctx, cx, cy, canvasW, canvasH);
  drawToken(ctx, tokenA, cx - canvasW * 0.28, cy, canvasW, '#22d3ee', renderScale);
  // Verb as styled badge in center
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const verbSize = Math.min(canvasW * 0.06, 22) * relationTextScale(renderScale);
  ctx.font = `${verbSize}px 'JetBrains Mono', monospace`;
  // badge bg
  const tw = ctx.measureText(verb).width + 20;
  ctx.fillStyle = 'hsla(168,80%,50%,0.12)';
  ctx.beginPath(); ctx.roundRect(cx - tw/2, cy - verbSize - 4, tw, verbSize*2 + 8, 8); ctx.fill();
  ctx.strokeStyle = 'hsla(168,80%,50%,0.3)';
  ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'hsl(168,80%,60%)';
  ctx.fillText(verb, cx, cy);
  ctx.restore();
  drawToken(ctx, tokenB, cx + canvasW * 0.28, cy, canvasW, '#a78bfa', renderScale);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.min(canvasW * 0.046, 16) * renderScale}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'hsla(210,10%,40%,0.65)';
  ctx.fillText(relationship.replace(/_/g, ' '), cx, cy + canvasH * 0.27);
  ctx.restore();
}

function renderVerbal(ctx, canvasW, canvasH, relationship, fixedWordA, fixedWordB, renderMode, renderScale = 1, relationSymbolMode = 'normal', stimulus = null) {
  // Tokens are always pre-generated by the engine; fall back to semantic pair only if missing
  const tokenA = fixedWordA || getVerbalPair(relationship)[0];
  const tokenB = fixedWordB || getVerbalPair(relationship)[1];
  const [wordA, verb, wordB] = buildVerbalDisplay(relationship, [tokenA, tokenB], relationSymbolMode);
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  ctx.clearRect(0, 0, canvasW, canvasH);

  // Use the stored renderMode so target replays look identical to the original.
  const mode = renderMode !== undefined ? renderMode : Math.floor(Math.random() * 3);
  if (mode === 0) renderVerbalText(ctx, cx, cy, canvasW, canvasH, wordA, verb, wordB, relationship, renderScale);
  else if (mode === 1) renderVerbalBlended(ctx, cx, cy, canvasW, canvasH, wordA, verb, wordB, relationship, renderScale, stimulus);
  else renderVerbalSymbolVerb(ctx, cx, cy, canvasW, canvasH, wordA, verb, wordB, relationship, renderScale);

  return {};
}

function renderSound(ctx, canvasW, canvasH, relationship, soundA, soundB, renderScale = 1) {
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const [left, relation, right] = buildSoundDisplay(relationship, [soundA || 'tone A', soundB || 'tone B']);
  ctx.clearRect(0, 0, canvasW, canvasH);
  drawVerbalPill(ctx, cx, cy, canvasW, canvasH);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.min(canvasW * 0.11, 42)}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = '#fb7185';
  ctx.fillText(String(left), cx, cy - canvasH * 0.16);
  ctx.font = `${Math.min(canvasW * 0.065, 24) * relationTextScale(renderScale)}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'hsla(210,20%,70%,0.9)';
  ctx.fillText(relation, cx, cy);
  ctx.font = `bold ${Math.min(canvasW * 0.11, 42)}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(String(right), cx, cy + canvasH * 0.16);
  ctx.font = `${Math.min(canvasW * 0.046, 16) * renderScale}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'hsla(210,10%,45%,0.7)';
  ctx.fillText('audio + visual', cx, cy + canvasH * 0.31);
  ctx.restore();

  return {};
}

// ── Main dispatch ──────────────────────────────────────────────────────────────
// stimulus: {rel, wordA?, wordB?, shapeA, shapeB, colorA, colorB, renderMode} — always provided
export function renderRelationship(ctx, canvasW, canvasH, relationship, prevVisuals, stimulus) {
  let visuals = {};
  if (isSound(relationship)) {
    visuals = renderSound(ctx, canvasW, canvasH, relationship, stimulus?.soundA, stimulus?.soundB, stimulus?.renderScale || 1);
  } else if (isVerbal(relationship)) {
    visuals = renderVerbal(ctx, canvasW, canvasH, relationship, stimulus?.wordA, stimulus?.wordB, stimulus?.renderMode, stimulus?.renderScale || 1, stimulus?.relationSymbolMode || 'normal', stimulus);
  } else {
    visuals = getVisuals(stimulus);
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const scale = Math.min(1.28, Math.min(1, Math.max(canvasH / 140, 0.5)) * (stimulus?.renderScale || 1)); // Aggressive scaling for small canvases
    ctx.clearRect(0, 0, canvasW, canvasH);

    switch (relationship) {
      case 'INSIDE':             renderInside(ctx, cx, cy, visuals, scale); break;
      case 'OVERLAPPING':        renderOverlapping(ctx, cx, cy, visuals, scale); break;
      case 'TOUCHING':           renderTouching(ctx, cx, cy, visuals, scale); break;
      case 'SIZE_MISMATCH':      renderSizeMismatch(ctx, cx, cy, visuals, scale); break;
      case 'HOLLOW_VS_SOLID':    renderHollowVsSolid(ctx, cx, cy, visuals, scale); break;
      case 'ONE_SHARED_TRAIT':   renderOneSharedTrait(ctx, cx, cy, visuals, scale); break;
      case 'ONE_TO_MANY':        renderOneToMany(ctx, cx, cy, canvasW, canvasH, visuals, scale); break;
      case 'ABOVE_BELOW':        renderAboveBelow(ctx, cx, cy, visuals, scale); break;
      case 'DIAGONAL':           renderDiagonal(ctx, cx, cy, visuals, scale); break;
      case 'ROTATED':            renderRotated(ctx, cx, cy, visuals, scale); break;
      case 'EQUAL_COUNT':        renderEqualCount(ctx, cx, cy, visuals, scale); break;
      case 'TWO_TO_ONE':         renderTwoToOne(ctx, cx, cy, visuals, scale); break;
      case 'PYRAMID':            renderPyramid(ctx, cx, cy, visuals, scale); break;
      case 'CONNECTED':          renderConnected(ctx, cx, cy, visuals, scale); break;
      case 'SURROUNDED':         renderSurrounded(ctx, cx, cy, visuals, scale); break;
      case 'BETWEEN':            renderBetween(ctx, cx, cy, visuals, scale); break;
      // NEW SPATIAL
      case 'LEFT_RIGHT':         renderLeftRight(ctx, cx, cy, visuals, scale); break;
      case 'STACKED':            renderStacked(ctx, cx, cy, visuals, scale); break;
      case 'NESTED_3':           renderNested3(ctx, cx, cy, visuals, scale); break;
      case 'MIRRORED':           renderMirrored(ctx, cx, cy, visuals, scale); break;
      case 'SCATTERED':          renderScattered(ctx, cx, cy, canvasW, canvasH, visuals, scale); break;
      // NEW TRAIT
      case 'SAME_COLOR':         renderSameColor(ctx, cx, cy, visuals, scale); break;
      case 'SAME_SHAPE':         renderSameShape(ctx, cx, cy, visuals, scale); break;
      case 'OPPOSITE_COLORS':    renderOppositeColors(ctx, cx, cy, visuals, scale); break;
      case 'SIZE_GRADIENT':      renderSizeGradient(ctx, cx, cy, visuals, scale); break;
      case 'BORDER_ONLY':        renderBorderOnly(ctx, cx, cy, visuals, scale); break;
      case 'SHADOW_COPY':        renderShadowCopy(ctx, cx, cy, visuals, scale); break;
      case 'STRIPED':            renderStriped(ctx, cx, cy, visuals, scale); break;
      case 'DASHED_OUTLINE':     renderDashedOutline(ctx, cx, cy, visuals, scale); break;
      // NEW QUANT
      case 'THREE_TO_ONE':       renderThreeToOne(ctx, cx, cy, visuals, scale); break;
      case 'ONE_TO_FIVE':        renderOneToFive(ctx, cx, cy, canvasW, canvasH, visuals, scale); break;
      case 'DECREASING_ROW':     renderDecreasingRow(ctx, cx, cy, visuals, scale); break;
      case 'INCREASING_ROW':     renderIncreasingRow(ctx, cx, cy, visuals, scale); break;
      case 'BALANCED_SCALE':     renderBalancedScale(ctx, cx, cy, visuals, scale); break;
      // 3D relations — drawn as 2D fallbacks (used inside alien-cube/square panels
      // and on regular streams when the canvas is non-3D)
      case 'DEPTH_LAYERED':        renderDepthLayered(ctx, cx, cy, visuals, scale); break;
      case 'ORBITING':             renderOrbiting(ctx, cx, cy, visuals, scale); break;
      case 'ROTATING_PAIR':        renderRotatingPair(ctx, cx, cy, visuals, scale); break;
      case 'NESTED_VOLUME':        renderNestedVolume(ctx, cx, cy, visuals, scale); break;
      case 'ASCENDING_SPIRAL':     renderAscendingSpiral(ctx, cx, cy, visuals, scale); break;
      case 'COLLIDING':            renderColliding(ctx, cx, cy, visuals, scale); break;
      case 'REPELLING':            renderRepelling(ctx, cx, cy, visuals, scale); break;
      case 'BOUND_BY_GRAVITY':     renderBoundByGravity(ctx, cx, cy, visuals, scale); break;
      case 'INTERSECTING_PLANES':  renderIntersectingPlanes(ctx, cx, cy, visuals, scale); break;
      case 'IN_FRONT_OF':          renderInFrontOf(ctx, cx, cy, visuals, scale); break;
      case 'BEHIND':               renderBehind(ctx, cx, cy, visuals, scale); break;
      case 'STACKED_3D':           renderStacked3D(ctx, cx, cy, visuals, scale); break;
      case 'LEANING_AGAINST':      renderLeaningAgainst(ctx, cx, cy, visuals, scale); break;
      case 'FLOATING_ABOVE':       renderFloatingAbove(ctx, cx, cy, visuals, scale); break;
      case 'CASTING_SHADOW':       renderCastingShadow(ctx, cx, cy, visuals, scale); break;
      // Complex (high-complexity composite relations)
      case 'THREE_PAIRS_ONE_DIFFERENT': renderThreePairsOneDifferent(ctx, cx, cy, canvasW, canvasH, visuals, scale); break;
      case 'TWO_OF_THREE_HOLLOW':       renderTwoOfThreeHollow(ctx, cx, cy, visuals, scale); break;
      case 'ODD_COLOR_OUT':             renderOddColorOut(ctx, cx, cy, visuals, scale); break;
      case 'ODD_SHAPE_OUT':             renderOddShapeOut(ctx, cx, cy, visuals, scale); break;
      case 'FOUR_PAIRS_GRID':           renderFourPairsGrid(ctx, cx, cy, canvasW, canvasH, visuals, scale); break;
      // Nonverbal RINT composite stimulus (rendered from attribute set)
      case 'NRINT_COMPOSITE':           renderNRINTComposite(ctx, cx, cy, stimulus, scale); break;
      // Cognitive Control Training arithmetic stim
      case 'CCT_NUMERIC':               renderCCTNumeric(ctx, cx, cy, canvasW, canvasH, stimulus); break;
      default:
        // Fallback for any relation without a renderer: show the name so we never
        // ship a blank panel again.
        renderRelationFallback(ctx, cx, cy, canvasW, canvasH, relationship, scale);
        break;
    }
  }

  // RINT entity labels — when the engine generated this stim through the
  // RINT pipeline (verbal or complex), the entities (alpha/beta/gamma) carry
  // the logical chain. Verbal renderers already display them; non-verbal ones
  // don't, so we overlay a compact "α · β" header so the player can see who's
  // being related.
  if (stimulus?.isRINTStim && !isVerbal(relationship) && stimulus?.wordA && stimulus?.wordB) {
    drawRINTEntityHeader(ctx, canvasW, canvasH, stimulus.wordA, stimulus.wordB);
  }

  // Negation overlay — when the engine flagged this stim as logically negated,
  // we keep the visual as-is and stamp a ¬ badge on the corner so the player
  // reads it as "NOT (rel)". The n-back matcher compares (rel, negated) as a
  // tuple, so two visually-identical relations with different ¬ states do not
  // count as a match.
  if (stimulus?._negated) {
    drawNegationBadge(ctx, canvasW, canvasH);
  }

  return visuals;
}

function drawNegationBadge(ctx, canvasW, canvasH) {
  ctx.save();
  const r = Math.max(14, Math.min(22, canvasW * 0.06));
  const cx = canvasW - r - 10;
  const cy = r + 10;
  ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
  ctx.strokeStyle = 'rgba(254, 226, 226, 0.95)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(r * 1.2)}px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('¬', cx, cy + 1);
  ctx.restore();
}

function drawRINTEntityHeader(ctx, canvasW, canvasH, entityA, entityB) {
  ctx.save();
  const padding = 10;
  ctx.font = `bold ${Math.min(canvasW * 0.044, 16)}px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const text = `${entityA}  ·  ${entityB}`;
  const w = ctx.measureText(text).width + padding * 2;
  const h = 22;
  const x = canvasW / 2 - w / 2;
  const y = 6;
  ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'hsl(168, 80%, 65%)';
  ctx.fillText(text, canvasW / 2, y + 4);
  ctx.restore();
}

// ─── 3D-relation 2D fallbacks ──────────────────────────────────────────────────
// Each draws a 2D depiction that conveys the spatial idea without three.js, so
// the relation panel inside alien_cube / alien_square / alien_tesseract stays
// readable for any relationship.

function drawPerspectiveBox(ctx, cx, cy, size, color, filled = false) {
  // Drop-shadowed isometric-ish box; used to convey 3D-ness inside 2D
  const half = size / 2;
  const depth = size * 0.32;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  // back face (lighter)
  ctx.globalAlpha = filled ? 0.35 : 0.55;
  ctx.beginPath();
  ctx.rect(cx - half + depth * 0.7, cy - half - depth * 0.5, size, size);
  filled ? ctx.fill() : ctx.stroke();
  // connectors
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - half,        cy - half);        ctx.lineTo(cx - half + depth * 0.7, cy - half - depth * 0.5);
  ctx.moveTo(cx + half,        cy - half);        ctx.lineTo(cx + half + depth * 0.7, cy - half - depth * 0.5);
  ctx.moveTo(cx + half,        cy + half);        ctx.lineTo(cx + half + depth * 0.7, cy + half - depth * 0.5);
  ctx.moveTo(cx - half,        cy + half);        ctx.lineTo(cx - half + depth * 0.7, cy + half - depth * 0.5);
  ctx.stroke();
  // front face
  ctx.globalAlpha = filled ? 0.9 : 1;
  ctx.beginPath();
  ctx.rect(cx - half, cy - half, size, size);
  filled ? ctx.fill() : ctx.stroke();
  ctx.restore();
}

function renderDepthLayered(ctx, cx, cy, v, scale = 1) {
  // big faded shape in the back, smaller crisp shape in front
  const backSize = randomBetween(110, 140) * scale;
  const frontSize = randomBetween(55, 75) * scale;
  ctx.save();
  ctx.globalAlpha = 0.25;
  drawShape(ctx, v.shapeB, cx + 14 * scale, cy - 10 * scale, backSize, v.colorB, true);
  ctx.globalAlpha = 0.55;
  drawShape(ctx, v.shapeB, cx + 14 * scale, cy - 10 * scale, backSize, v.colorB, false);
  ctx.globalAlpha = 1;
  drawShape(ctx, v.shapeA, cx - 16 * scale, cy + 12 * scale, frontSize, v.colorA, true);
  ctx.restore();
}

function renderOrbiting(ctx, cx, cy, v, scale = 1) {
  const cs = randomBetween(40, 56) * scale;
  const os = randomBetween(28, 42) * scale;
  const radius = (cs / 2) + (os / 2) + 26 * scale;
  drawShape(ctx, v.shapeA, cx, cy, cs, v.colorA, true);
  ctx.save();
  ctx.strokeStyle = 'hsla(210,20%,70%,0.4)';
  ctx.setLineDash([4, 5]);
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, radius * 0.55, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  drawShape(ctx, v.shapeB, cx + radius, cy, os, v.colorB, true);
  // direction arrow
  ctx.save();
  ctx.strokeStyle = 'hsla(168,80%,60%,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.7, -Math.PI / 2, 0);
  ctx.stroke();
  ctx.restore();
}

function renderRotatingPair(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(46, 62) * scale;
  const offset = 60 * scale;
  drawShape(ctx, v.shapeA, cx - offset, cy, size, v.colorA, true);
  drawShape(ctx, v.shapeB, cx + offset, cy, size, v.colorB, true);
  // curved double-arrow
  ctx.save();
  ctx.strokeStyle = 'hsla(168,80%,60%,0.7)';
  ctx.lineWidth = Math.max(1.5, 2 * scale);
  ctx.beginPath();
  ctx.arc(cx, cy, offset * 0.9, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, offset * 0.9, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
  ctx.restore();
}

function renderNestedVolume(ctx, cx, cy, v, scale = 1) {
  // perspective-box outer, smaller inner shape
  drawPerspectiveBox(ctx, cx, cy, 130 * scale, v.colorB, false);
  drawShape(ctx, v.shapeA, cx, cy, 50 * scale, v.colorA, true);
}

function renderAscendingSpiral(ctx, cx, cy, v, scale = 1) {
  // spiral of 5 small shapes at increasing radius/angle
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + i * 0.7;
    const radius = 22 * scale + i * 14 * scale;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    const size = (22 + i * 4) * scale;
    drawShape(ctx, i % 2 === 0 ? v.shapeA : v.shapeB, x, y, size, i % 2 === 0 ? v.colorA : v.colorB, true);
  }
}

function renderColliding(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(48, 70) * scale;
  drawShape(ctx, v.shapeA, cx - size / 2 - 4 * scale, cy, size, v.colorA, true);
  drawShape(ctx, v.shapeB, cx + size / 2 + 4 * scale, cy, size, v.colorB, true);
  // impact starburst
  ctx.save();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = Math.max(1.5, 2 * scale);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 14 * scale, cy + Math.sin(a) * 14 * scale);
    ctx.lineTo(cx + Math.cos(a) * 22 * scale, cy + Math.sin(a) * 22 * scale);
    ctx.stroke();
  }
  ctx.restore();
}

function renderRepelling(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(48, 64) * scale;
  drawShape(ctx, v.shapeA, cx - 90 * scale, cy, size, v.colorA, true);
  drawShape(ctx, v.shapeB, cx + 90 * scale, cy, size, v.colorB, true);
  ctx.save();
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = Math.max(1.5, 2 * scale);
  // arrows facing outward from center
  [-1, 1].forEach(dir => {
    const x1 = cx + dir * 30 * scale;
    const x2 = cx + dir * 60 * scale;
    ctx.beginPath();
    ctx.moveTo(x1, cy); ctx.lineTo(x2, cy);
    ctx.moveTo(x2, cy); ctx.lineTo(x2 - dir * 8 * scale, cy - 6 * scale);
    ctx.moveTo(x2, cy); ctx.lineTo(x2 - dir * 8 * scale, cy + 6 * scale);
    ctx.stroke();
  });
  ctx.restore();
}

function renderBoundByGravity(ctx, cx, cy, v, scale = 1) {
  // big anchor below, smaller in orbit above
  drawShape(ctx, v.shapeB, cx, cy + 50 * scale, 80 * scale, v.colorB, true);
  drawShape(ctx, v.shapeA, cx, cy - 40 * scale, 40 * scale, v.colorA, true);
  ctx.save();
  ctx.strokeStyle = 'hsla(280,80%,70%,0.55)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.beginPath();
  ctx.moveTo(cx, cy - 18 * scale);
  ctx.lineTo(cx, cy + 18 * scale);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function renderIntersectingPlanes(ctx, cx, cy, v, scale = 1) {
  // two thin rectangles crossing at center
  const len = 120 * scale, thick = 28 * scale;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.32);
  ctx.fillStyle = v.colorA;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-len / 2, -thick / 2, len, thick);
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.45);
  ctx.fillStyle = v.colorB;
  ctx.globalAlpha = 0.65;
  ctx.fillRect(-len / 2, -thick / 2, len, thick);
  ctx.restore();
}

function renderInFrontOf(ctx, cx, cy, v, scale = 1) {
  const back = randomBetween(70, 90) * scale;
  const front = randomBetween(55, 70) * scale;
  ctx.save();
  ctx.globalAlpha = 0.45;
  drawShape(ctx, v.shapeB, cx + 18 * scale, cy - 12 * scale, back, v.colorB, true);
  ctx.globalAlpha = 1;
  // shadow under front shape
  ctx.globalAlpha = 0.2;
  drawShape(ctx, v.shapeA, cx - 18 * scale + 4 * scale, cy + 18 * scale + 4 * scale, front, '#000', true);
  ctx.globalAlpha = 1;
  drawShape(ctx, v.shapeA, cx - 18 * scale, cy + 18 * scale, front, v.colorA, true);
  ctx.restore();
}

function renderBehind(ctx, cx, cy, v, scale = 1) {
  const back = randomBetween(70, 90) * scale;
  const front = randomBetween(55, 70) * scale;
  ctx.save();
  ctx.globalAlpha = 0.45;
  drawShape(ctx, v.shapeA, cx - 18 * scale, cy - 18 * scale, back, v.colorA, true);
  ctx.globalAlpha = 1;
  drawShape(ctx, v.shapeB, cx + 18 * scale, cy + 18 * scale, front, v.colorB, true);
  ctx.restore();
}

function renderStacked3D(ctx, cx, cy, v, scale = 1) {
  // three perspective slabs stacked vertically
  const w = 110 * scale, h = 24 * scale, depth = 14 * scale;
  const yTop = cy - h * 1.2, yMid = cy, yBot = cy + h * 1.2;
  [{ y: yBot, color: v.colorB, alpha: 1 }, { y: yMid, color: v.colorA, alpha: 0.9 }, { y: yTop, color: v.colorB, alpha: 0.75 }].forEach(slab => {
    ctx.save();
    ctx.globalAlpha = slab.alpha;
    ctx.fillStyle = slab.color;
    // back
    ctx.beginPath();
    ctx.rect(cx - w / 2 + depth, slab.y - h / 2 - depth * 0.5, w, h);
    ctx.fill();
    // front
    ctx.beginPath();
    ctx.rect(cx - w / 2, slab.y - h / 2, w, h);
    ctx.fill();
    ctx.restore();
  });
}

function renderLeaningAgainst(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(60, 80) * scale;
  // upright shape
  drawShape(ctx, v.shapeB, cx + 30 * scale, cy, size, v.colorB, true);
  // tilted shape leaning into it
  ctx.save();
  ctx.translate(cx - 30 * scale, cy + size * 0.05);
  ctx.rotate(0.45);
  drawShape(ctx, v.shapeA, 0, 0, size, v.colorA, true);
  ctx.restore();
  // ground line
  ctx.save();
  ctx.strokeStyle = 'hsla(210,20%,55%,0.5)';
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.beginPath();
  ctx.moveTo(cx - 110 * scale, cy + size * 0.55);
  ctx.lineTo(cx + 110 * scale, cy + size * 0.55);
  ctx.stroke();
  ctx.restore();
}

function renderFloatingAbove(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(50, 70) * scale;
  drawShape(ctx, v.shapeA, cx, cy - 36 * scale, size, v.colorA, true);
  // shadow ellipse
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 40 * scale, size * 0.55, size * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawShape(ctx, v.shapeB, cx, cy + 40 * scale, size * 0.7, v.colorB, false);
}

function renderCastingShadow(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(60, 80) * scale;
  // ground line
  ctx.save();
  ctx.strokeStyle = 'hsla(210,20%,55%,0.6)';
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.beginPath();
  ctx.moveTo(cx - 120 * scale, cy + size * 0.6);
  ctx.lineTo(cx + 120 * scale, cy + size * 0.6);
  ctx.stroke();
  ctx.restore();
  // shape
  drawShape(ctx, v.shapeA, cx - 14 * scale, cy, size, v.colorA, true);
  // stretched skewed shadow
  ctx.save();
  ctx.translate(cx + 30 * scale, cy + size * 0.6);
  ctx.transform(1, 0, -0.7, 0.3, 0, 0);
  ctx.globalAlpha = 0.35;
  drawShape(ctx, v.shapeA, 0, -size / 2, size, '#000', true);
  ctx.restore();
}

// ─── Complex (composite) relations ─────────────────────────────────────────────

// Three pairs of shapes — two pairs overlap (touching), one pair is separated.
// Player learns to scan multiple groups and find the odd one out.
function renderThreePairsOneDifferent(ctx, cx, cy, canvasW, canvasH, v, scale = 1) {
  const positions = [
    { x: cx - canvasW * 0.28, y: cy - canvasH * 0.22 },
    { x: cx + canvasW * 0.28, y: cy - canvasH * 0.22 },
    { x: cx,                    y: cy + canvasH * 0.18 },
  ];
  const oddIdx = Math.floor(Math.random() * 3);
  const size = Math.min(canvasW, canvasH) * 0.12;
  positions.forEach((p, i) => {
    const overlap = i !== oddIdx;
    const gap = overlap ? -size * 0.25 : size * 0.55;
    drawShape(ctx, v.shapeA, p.x - size / 2 - gap / 2, p.y, size, v.colorA, true);
    drawShape(ctx, v.shapeB, p.x + size / 2 + gap / 2, p.y, size, v.colorB, true);
  });
  // subtle hint label
  ctx.save();
  ctx.fillStyle = 'hsla(168,80%,60%,0.7)';
  ctx.font = `${Math.min(canvasW * 0.032, 12) * scale}px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('one pair apart', cx, canvasH - 16);
  ctx.restore();
}

// Three shapes side by side; two are hollow, one is solid (or vice versa).
function renderTwoOfThreeHollow(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(48, 64) * scale;
  const gap = 78 * scale;
  const solidIdx = Math.floor(Math.random() * 3);
  for (let i = 0; i < 3; i++) {
    drawShape(ctx, v.shapeA, cx + (i - 1) * gap, cy, size, v.colorA, i === solidIdx);
  }
}

// 4 shapes in a row, same shape, one different color.
function renderOddColorOut(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(40, 52) * scale;
  const gap = 64 * scale;
  const oddIdx = Math.floor(Math.random() * 4);
  for (let i = 0; i < 4; i++) {
    drawShape(ctx, v.shapeA, cx + (i - 1.5) * gap, cy, size, i === oddIdx ? v.colorB : v.colorA, true);
  }
}

// 4 shapes in a row, same color, one different shape.
function renderOddShapeOut(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(40, 52) * scale;
  const gap = 64 * scale;
  const oddIdx = Math.floor(Math.random() * 4);
  for (let i = 0; i < 4; i++) {
    drawShape(ctx, i === oddIdx ? v.shapeB : v.shapeA, cx + (i - 1.5) * gap, cy, size, v.colorA, true);
  }
}

// 2x2 grid of pairs — players must scan all 4 to compare.
function renderFourPairsGrid(ctx, cx, cy, canvasW, canvasH, v, scale = 1) {
  const size = Math.min(canvasW, canvasH) * 0.1;
  const cellW = canvasW * 0.36;
  const cellH = canvasH * 0.32;
  const oddIdx = Math.floor(Math.random() * 4);
  for (let i = 0; i < 4; i++) {
    const row = Math.floor(i / 2), col = i % 2;
    const px = cx + (col - 0.5) * cellW;
    const py = cy + (row - 0.5) * cellH;
    const odd = i === oddIdx;
    const gap = odd ? size * 0.55 : -size * 0.25;
    drawShape(ctx, v.shapeA, px - size / 2 - gap / 2, py, size, v.colorA, true);
    drawShape(ctx, v.shapeB, px + size / 2 + gap / 2, py, size, v.colorB, true);
  }
}

// ─── Nonverbal cross-attribute RINT renderer ───────────────────────────────────
// Renders a composite stimulus with up to 3 independent visual attributes:
//   - touching      : two shapes adjacent (true) vs separated (false)
//   - hollow        : shapeA drawn as outline (true) vs filled (false)
//   - size_mismatch : shapeB much smaller than shapeA (true) vs equal sized (false)
function renderNRINTComposite(ctx, cx, cy, stimulus, scale = 1) {
  const attrs = stimulus?.attrs || {};
  const v = getVisuals(stimulus);
  const sizeA = 70 * scale;
  const sizeB = attrs.size_mismatch ? 30 * scale : 65 * scale;
  const gap = attrs.touching ? (sizeA + sizeB) / 2 - 8 * scale : (sizeA + sizeB) / 2 + 32 * scale;

  const ax = cx - gap / 2;
  const bx = cx + gap / 2;

  // Apply optional glow halo to both shapes when the glow flag is on. Sits
  // outside the save() blocks so it composites under the shape fill.
  const drawGlow = (x, y, size, color) => {
    if (!attrs.glow) return;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 28 * scale;
    ctx.globalAlpha = 0.95;
    drawShape(ctx, 'circle', x, y, size * 1.05, color, false);
    ctx.restore();
  };

  // Dashed border on both shapes when the dashed_border flag is on. We do
  // this by setting setLineDash before drawShape; drawShape uses ctx.stroke
  // for hollow shapes so the dash visibly applies on those, and for filled
  // shapes we layer a stroke pass on top of the fill.
  const dashedStrokePass = (x, y, size, color, isShape) => {
    if (!attrs.dashed_border) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6 * scale;
    ctx.setLineDash([7 * scale, 5 * scale]);
    drawShape(ctx, isShape, x, y, size, color, false); // outline pass
    ctx.restore();
  };

  // SHAPE A — left
  drawGlow(ax, cy, sizeA, v.colorA);
  ctx.save();
  if (attrs.rotated) {
    ctx.translate(ax, cy);
    ctx.rotate(Math.PI / 6); // 30°
    if (attrs.mirrored) ctx.scale(-1, 1); // horizontal flip
    drawShape(ctx, v.shapeA, 0, 0, sizeA, v.colorA, !attrs.hollow);
    ctx.restore();
    if (attrs.dashed_border) {
      ctx.save();
      ctx.translate(ax, cy);
      ctx.rotate(Math.PI / 6);
      if (attrs.mirrored) ctx.scale(-1, 1);
      dashedStrokePass(0, 0, sizeA, v.colorA, v.shapeA);
      ctx.restore();
    }
  } else {
    if (attrs.mirrored) {
      ctx.translate(ax, cy);
      ctx.scale(-1, 1);
      drawShape(ctx, v.shapeA, 0, 0, sizeA, v.colorA, !attrs.hollow);
      ctx.restore();
      if (attrs.dashed_border) {
        ctx.save();
        ctx.translate(ax, cy);
        ctx.scale(-1, 1);
        dashedStrokePass(0, 0, sizeA, v.colorA, v.shapeA);
        ctx.restore();
      }
    } else {
      ctx.restore();
      drawShape(ctx, v.shapeA, ax, cy, sizeA, v.colorA, !attrs.hollow);
      dashedStrokePass(ax, cy, sizeA, v.colorA, v.shapeA);
    }
  }

  // SHAPE B — right
  drawGlow(bx, cy, sizeB, v.colorB);
  drawShape(ctx, v.shapeB, bx, cy, sizeB, v.colorB, true);
  dashedStrokePass(bx, cy, sizeB, v.colorB, v.shapeB);

  // Diagonal stripes across shape B when the striped flag is on. Clip to
  // a square bounding the shape, draw parallel lines, then restore.
  if (attrs.striped) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx - sizeB / 2, cy - sizeB / 2, sizeB, sizeB);
    ctx.clip();
    ctx.strokeStyle = '#0d1117';
    ctx.lineWidth = 2.2 * scale;
    ctx.globalAlpha = 0.65;
    const step = 7 * scale;
    for (let i = -sizeB; i < sizeB * 2; i += step) {
      ctx.beginPath();
      ctx.moveTo(bx - sizeB / 2 + i, cy - sizeB / 2);
      ctx.lineTo(bx - sizeB / 2 + i + sizeB, cy - sizeB / 2 + sizeB);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Attribute legend along bottom — hidden when the session asks for a
  // truly nonverbal display (Grapist's "disable the words" request).
  if (stimulus?._nrintHideLegend) return;

  ctx.save();
  ctx.font = `${Math.max(9, 11 * scale)}px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const flags = [
    attrs.touching      ? { t: 'TOUCH',   c: '#22d3ee' } : null,
    attrs.hollow        ? { t: 'HOLLOW',  c: '#a78bfa' } : null,
    attrs.size_mismatch ? { t: 'SIZE!=',  c: '#fbbf24' } : null,
    attrs.rotated       ? { t: 'ROT',     c: '#f472b6' } : null,
    attrs.dashed_border ? { t: 'DASH',    c: '#94a3b8' } : null,
    attrs.glow          ? { t: 'GLOW',    c: '#fde68a' } : null,
    attrs.mirrored      ? { t: 'MIRROR',  c: '#7dd3fc' } : null,
    attrs.striped       ? { t: 'STRIPE',  c: '#fca5a5' } : null,
    attrs.audio         ? { t: 'AUDIO ♪', c: '#34d399' } : null,
    attrs.pitch_high    ? { t: 'HIGH ♪',  c: '#fb7185' } : null,
    attrs.audio_loud    ? { t: 'LOUD ♪',  c: '#fbbf24' } : null,
    attrs.audio_long    ? { t: 'LONG ♪',  c: '#60a5fa' } : null,
    attrs.audio_rhythmic? { t: 'RHYTHM ♪', c: '#c084fc' } : null,
    attrs.audio_warm    ? { t: 'WARM ♪',  c: '#fb923c' } : null,
  ].filter(Boolean);
  if (flags.length > 0) {
    const spacing = Math.max(54, Math.min(70, 360 / flags.length)) * scale;
    flags.forEach((f, i) => {
      ctx.fillStyle = f.c;
      ctx.fillText(f.t, cx + (i - (flags.length - 1) / 2) * spacing, cy + sizeA * 0.7);
    });
  } else {
    ctx.fillStyle = 'hsla(210,20%,55%,0.6)';
    ctx.fillText('— neutral —', cx, cy + sizeA * 0.7);
  }
  ctx.restore();
}

// Used when a relationship has no renderer registered — show the name so the
// canvas is never blank in production.
// ─── CCT (arithmetic n-back) renderer ──────────────────────────────────────
// Layout:
//   - large center digit (the current number)
//   - small "N-back ago" memo bar above it explaining the rule
//   - candidate-result pill below it (only once history >= N is available)
// When the result pill isn't shown the player just observes; otherwise they
// must judge whether `result === current_number + number_from_N_back`.
function renderCCTNumeric(ctx, cx, cy, canvasW, canvasH, stim) {
  const number = stim?.cctNumber ?? 0;
  const result = stim?.cctResult;
  const showResult = result != null;
  ctx.save();

  // Frame
  const frameW = canvasW * 0.84;
  const frameH = canvasH * 0.78;
  ctx.fillStyle = 'rgba(8, 13, 22, 0.78)';
  ctx.beginPath();
  ctx.roundRect(cx - frameW / 2, cy - frameH / 2, frameW, frameH, 20);
  ctx.fill();
  ctx.strokeStyle = 'hsla(168,80%,55%,0.32)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Memo bar (top)
  ctx.font = `${Math.min(canvasW * 0.055, 20)}px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'hsla(168,80%,70%,0.85)';
  ctx.fillText('CCT · current + N-back =', cx, cy - frameH * 0.36);

  // Big digit
  const digitSize = Math.min(canvasW * 0.35, canvasH * 0.50, 185);
  ctx.font = `bold ${digitSize}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = '#22d3ee';
  ctx.shadowColor = 'rgba(34, 211, 238, 0.45)';
  ctx.shadowBlur = 18;
  ctx.fillText(String(number), cx, cy - canvasH * 0.04);
  ctx.shadowBlur = 0;

  if (showResult) {
    // Result candidate pill (the value to compare against)
    const pillW = Math.min(canvasW * 0.52, 280);
    const pillH = Math.min(canvasH * 0.24, 80);
    const pillY = cy + canvasH * 0.22;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, pillY - pillH / 2, pillW, pillH, 14);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.min(canvasW * 0.055, 20)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.65)';
    ctx.fillText('≟', cx - pillW * 0.32, pillY);
    ctx.font = `bold ${Math.min(canvasW * 0.14, 60)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(String(result), cx + pillW * 0.05, pillY);
  } else {
    ctx.font = `${Math.min(canvasW * 0.046, 17)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = 'hsla(210,15%,55%,0.7)';
    ctx.fillText('observe — result appears once N trials are stored', cx, cy + canvasH * 0.27);
  }

  ctx.restore();
}

function renderRelationFallback(ctx, cx, cy, canvasW, canvasH, relationship, scale = 1) {
  ctx.save();
  ctx.fillStyle = 'hsla(168,80%,60%,0.08)';
  ctx.beginPath();
  ctx.roundRect(cx - canvasW * 0.4, cy - canvasH * 0.18, canvasW * 0.8, canvasH * 0.36, 12);
  ctx.fill();
  ctx.strokeStyle = 'hsla(168,80%,60%,0.35)';
  ctx.stroke();
  ctx.fillStyle = 'hsl(168,80%,60%)';
  ctx.font = `bold ${Math.min(canvasW * 0.082, 30) * scale}px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((relationship || '?').replace(/_/g, ' '), cx, cy);
  ctx.restore();
}

// ─── Original visuals ──────────────────────────────────────────────────────────

function renderInside(ctx, cx, cy, v, scale = 1) {
  const outerSize = randomBetween(100, 130) * scale;
  const innerSize = randomBetween(20, outerSize * 0.4);
  drawShape(ctx, v.shapeB, cx, cy, outerSize, v.colorB, true);
  drawShape(ctx, v.shapeA, cx + randomBetween(-8, 8), cy + randomBetween(-8, 8), innerSize, v.colorA, true);
}

function renderOverlapping(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(55, 85) * scale;
  const sizeB = randomBetween(55, 85) * scale;
  const offset = Math.min(sizeA, sizeB) * 0.4;
  ctx.globalAlpha = 0.85;
  drawShape(ctx, v.shapeA, cx - offset, cy, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeB, cx + offset, cy, sizeB, v.colorB, true);
  ctx.globalAlpha = 1;
}

function renderTouching(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(48, 70) * scale;
  const sizeB = randomBetween(48, 70) * scale;
  const gap = (sizeA + sizeB) / 2;
  drawShape(ctx, v.shapeA, cx - gap / 2, cy, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeB, cx + gap / 2, cy, sizeB, v.colorB, true);
}

function renderSizeMismatch(ctx, cx, cy, v, scale = 1) {
  const bigSize = randomBetween(100, 130) * scale;
  const smallSize = bigSize / randomBetween(3, 4.5);
  drawShape(ctx, v.shapeA, cx - 50 * scale, cy, bigSize, v.colorA, true);
  drawShape(ctx, v.shapeB, cx + 60 * scale, cy, smallSize, v.colorB, true);
}

function renderHollowVsSolid(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(55, 85) * scale;
  const sizeB = randomBetween(55, 85) * scale;
  drawShape(ctx, v.shapeA, cx - 55 * scale, cy, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeB, cx + 55 * scale, cy, sizeB, v.colorB, false);
}

function renderOneSharedTrait(ctx, cx, cy, v, scale = 1) {
  const shareColor = Math.random() < 0.5;
  let shapeA, shapeB, colorA, colorB;
  if (shareColor) {
    colorA = v.colorA; colorB = v.colorA;
    shapeA = v.shapeA; shapeB = pickRandomExcluding(SHAPES, shapeA);
  } else {
    shapeA = v.shapeA; shapeB = v.shapeA;
    colorA = v.colorA; colorB = pickRandomExcluding(COLORS, colorA);
  }
  drawShape(ctx, shapeA, cx - 60 * scale, cy, randomBetween(48, 80) * scale, colorA, true);
  drawShape(ctx, shapeB, cx + 60 * scale, cy, randomBetween(48, 80) * scale, colorB, true);
}

function renderOneToMany(ctx, cx, cy, canvasW, canvasH, v) {
  drawShape(ctx, v.shapeA, cx - 100, cy, randomBetween(60, 90), v.colorA, true);
  const sizeB = randomBetween(40, 65);
  [{ x: cx + 70, y: cy - 55 }, { x: cx + 130, y: cy - 55 }, { x: cx + 100, y: cy + 30 }]
    .forEach(p => drawShape(ctx, v.shapeB, p.x, p.y, sizeB, v.colorB, true));
}

function renderAboveBelow(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(44, 68) * scale;
  const sizeB = randomBetween(44, 68) * scale;
  const gap = ((sizeA + sizeB) / 2 + 15) * scale;
  drawShape(ctx, v.shapeA, cx, cy - gap / 2, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeB, cx, cy + gap / 2, sizeB, v.colorB, true);
}

function renderDiagonal(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(44, 68) * scale;
  const sizeB = randomBetween(44, 68) * scale;
  const dx = randomBetween(48, 72) * scale * (Math.random() < 0.5 ? -1 : 1);
  const dy = randomBetween(32, 56) * scale * (dx > 0 ? -1 : 1);
  drawShape(ctx, v.shapeA, cx + dx, cy + dy, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeB, cx - dx, cy - dy, sizeB, v.colorB, true);
}

function renderRotated(ctx, cx, cy, v, scale = 1) {
  const shape = v.shapeA;
  const size = randomBetween(52, 76) * scale;
  drawShape(ctx, shape, cx - 60 * scale, cy, size, v.colorA, true);
  ctx.save();
  ctx.translate(cx + 60 * scale, cy);
  ctx.rotate(Math.PI / 4);
  ctx.translate(-(cx + 60 * scale), -cy);
  drawShape(ctx, shape, cx + 60 * scale, cy, size, v.colorB, true);
  ctx.restore();
}

function renderEqualCount(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(36, 52) * scale;
  const sizeB = randomBetween(36, 52) * scale;
  drawShape(ctx, v.shapeA, cx - 70 * scale, cy - 30 * scale, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeA, cx - 70 * scale, cy + 30 * scale, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeB, cx + 70 * scale, cy - 30 * scale, sizeB, v.colorB, true);
  drawShape(ctx, v.shapeB, cx + 70 * scale, cy + 30 * scale, sizeB, v.colorB, true);
}

function renderTwoToOne(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(40, 56) * scale;
  drawShape(ctx, v.shapeA, cx - 70 * scale, cy - 30 * scale, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeA, cx - 70 * scale, cy + 30 * scale, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeB, cx + 56 * scale, cy, randomBetween(48, 72) * scale, v.colorB, true);
}

function renderPyramid(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(40, 56) * scale;
  const sizeB = randomBetween(36, 52) * scale;
  const vertGap = (sizeA + sizeB) / 2 + 12 * scale;
  drawShape(ctx, v.shapeA, cx, cy - vertGap / 2, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeB, cx - sizeB - 8 * scale, cy + vertGap / 2, sizeB, v.colorB, true);
  drawShape(ctx, v.shapeB, cx + sizeB + 8 * scale, cy + vertGap / 2, sizeB, v.colorB, true);
}

function renderConnected(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(44, 64) * scale;
  const sizeB = randomBetween(44, 64) * scale;
  const leftX = cx - 72 * scale, rightX = cx + 72 * scale;
  drawShape(ctx, v.shapeA, leftX, cy, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeB, rightX, cy, sizeB, v.colorB, true);
  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = Math.max(1.5, 2.5 * scale);
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(leftX + sizeA / 2, cy);
  ctx.lineTo(rightX - sizeB / 2, cy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function renderSurrounded(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(40, 56) * scale;
  const sizeB = randomBetween(28, 40) * scale;
  const radius = sizeA / 2 + sizeB / 2 + 16 * scale;
  drawShape(ctx, v.shapeA, cx, cy, sizeA, v.colorA, true);
  [{ x: 0, y: -radius }, { x: radius, y: 0 }, { x: 0, y: radius }, { x: -radius, y: 0 }]
    .forEach(o => drawShape(ctx, v.shapeB, cx + o.x, cy + o.y, sizeB, v.colorB, true));
}

function renderBetween(ctx, cx, cy, v, scale = 1) {
  const sizeOuter = randomBetween(44, 60) * scale;
  const sizeMiddle = randomBetween(36, 52) * scale;
  const colorC = COLORS.find(c => c !== v.colorA && c !== v.colorB) || v.colorA;
  const shapeC = pickRandomExcluding(SHAPES, v.shapeA);
  drawShape(ctx, v.shapeA, cx - 88 * scale, cy, sizeOuter, v.colorA, true);
  drawShape(ctx, shapeC,   cx,       cy, sizeMiddle, colorC,  true);
  drawShape(ctx, v.shapeB, cx + 88 * scale, cy, sizeOuter, v.colorB, true);
}

// ─── New Spatial ───────────────────────────────────────────────────────────────

function renderLeftRight(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(44, 72) * scale;
  const sizeB = randomBetween(44, 72) * scale;
  drawShape(ctx, v.shapeA, cx - 72 * scale, cy, sizeA, v.colorA, true);
  drawShape(ctx, v.shapeB, cx + 72 * scale, cy, sizeB, v.colorB, true);
  // label
  ctx.save();
  ctx.fillStyle = 'hsla(210,10%,50%,0.5)';
  ctx.font = `${Math.max(8, 9 * scale)}px JetBrains Mono, monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('L', cx - 72 * scale, cy + sizeA / 2 + 14 * scale);
  ctx.fillText('R', cx + 72 * scale, cy + sizeB / 2 + 14 * scale);
  ctx.restore();
}

function renderStacked(ctx, cx, cy, v, scale = 1) {
  // 3 shapes vertically stacked
  const size = randomBetween(38, 52) * scale;
  const gap = size + 10 * scale;
  const colorC = COLORS.find(c => c !== v.colorA && c !== v.colorB) || v.colorA;
  const shapeC = pickRandomExcluding(SHAPES, v.shapeA, v.shapeB);
  drawShape(ctx, v.shapeA, cx, cy - gap, size, v.colorA, true);
  drawShape(ctx, shapeC,   cx, cy,       size, colorC,  true);
  drawShape(ctx, v.shapeB, cx, cy + gap, size, v.colorB, true);
}

function renderNested3(ctx, cx, cy, v, scale = 1) {
  // 3 concentric shapes
  const colorC = COLORS.find(c => c !== v.colorA && c !== v.colorB) || '#14B8A6';
  drawShape(ctx, v.shapeB, cx, cy, 130 * scale, v.colorB, false);
  drawShape(ctx, v.shapeA, cx, cy, 85 * scale, v.colorA, false);
  drawShape(ctx, 'circle', cx, cy, 40 * scale,  colorC,   true);
}

function renderMirrored(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(48, 72) * scale;
  drawShape(ctx, v.shapeA, cx - 60 * scale, cy, size, v.colorA, true);
  ctx.save();
  ctx.translate(cx + 60 * scale, cy);
  ctx.scale(-1, 1);
  drawShape(ctx, v.shapeA, 0, 0, size, v.colorB, true);
  ctx.restore();
}

function renderScattered(ctx, cx, cy, canvasW, canvasH, v, scale = 1) {
  // 5 random small shapes scattered across canvas
  const size = randomBetween(24, 40) * scale;
  const xOffset = canvasW * 0.35;
  const yOffset = canvasH * 0.35;
  const positions = [
    { x: cx - xOffset, y: cy - yOffset * 0.7 },
    { x: cx + xOffset * 0.9, y: cy - yOffset },
    { x: cx - xOffset * 0.6, y: cy + yOffset * 0.8 },
    { x: cx + xOffset, y: cy + yOffset * 0.5 },
    { x: cx, y: cy - yOffset * 0.1 },
  ];
  const colors = [v.colorA, v.colorB, v.colorA, v.colorB, v.colorA];
  positions.forEach((p, i) =>
    drawShape(ctx, i % 2 === 0 ? v.shapeA : v.shapeB, p.x, p.y, size, colors[i], true)
  );
}

// ─── New Trait ────────────────────────────────────────────────────────────────

function renderSameColor(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(48, 72) * scale;
  const shapeB = pickRandomExcluding(SHAPES, v.shapeA);
  drawShape(ctx, v.shapeA, cx - 64 * scale, cy, size, v.colorA, true);
  drawShape(ctx, shapeB,   cx + 64 * scale, cy, size, v.colorA, true); // same color!
}

function renderSameShape(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(48, 72) * scale;
  drawShape(ctx, v.shapeA, cx - 64 * scale, cy, size, v.colorA, true);
  drawShape(ctx, v.shapeA, cx + 64 * scale, cy, size, v.colorB, true); // same shape, diff color
}

function renderOppositeColors(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(52, 76) * scale;
  // Draw one on dark bg, one inverted
  ctx.save();
  ctx.fillStyle = v.colorA;
  ctx.beginPath(); ctx.roundRect(cx - 96 * scale, cy - size / 1.4, size * 1.4, size * 1.4 * 1.2 + 2, 8); ctx.fill();
  ctx.restore();
  drawShape(ctx, v.shapeA, cx - 60 * scale, cy, size * 0.7, '#1e293b', true);
  drawShape(ctx, v.shapeB, cx + 60 * scale, cy, size * 0.7, v.colorA,  true);
}

function renderSizeGradient(ctx, cx, cy, v, scale = 1) {
  // 4 same shapes in a row, increasing size
  const sizes = [22, 35, 50, 66].map(s => s * scale);
  const gap = 40 * scale;
  const xs = [cx - gap * 1.5, cx - gap * 0.5, cx + gap * 0.5, cx + gap * 1.5];
  sizes.forEach((s, i) => drawShape(ctx, v.shapeA, xs[i], cy, s, v.colorA, true));
}

function renderBorderOnly(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(52, 76) * scale;
  drawShape(ctx, v.shapeA, cx - 64 * scale, cy, size, v.colorA, false); // outline only
  drawShape(ctx, v.shapeB, cx + 64 * scale, cy, size, v.colorB, false); // outline only
}

function renderShadowCopy(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(52, 72) * scale;
  // Draw shadow (offset, semi-transparent)
  ctx.save();
  ctx.globalAlpha = 0.25;
  drawShape(ctx, v.shapeA, cx + 10 * scale, cy + 10 * scale, size, '#000000', true);
  ctx.globalAlpha = 1;
  drawShape(ctx, v.shapeA, cx, cy, size, v.colorA, true);
  ctx.restore();
}

function renderStriped(ctx, cx, cy, v, scale = 1) {
  const size = randomBetween(56, 80) * scale;
  // Draw shape then clip stripes inside
  ctx.save();
  ctx.beginPath();
  // Use a circle clip for simplicity
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = v.colorA;
  ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
  ctx.strokeStyle = 'hsla(220,20%,6%,0.5)';
  ctx.lineWidth = Math.max(4, 5.6 * scale);
  for (let i = -size; i < size * 2; i += 13) {
    ctx.beginPath();
    ctx.moveTo(cx - size + i, cy - size);
    ctx.lineTo(cx - size + i, cy + size);
    ctx.stroke();
  }
  ctx.restore();
  drawShape(ctx, v.shapeA, cx, cy, size, v.colorA, false);
}

function renderDashedOutline(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(52, 72) * scale;
  const sizeB = randomBetween(52, 72) * scale;
  // A = solid, B = dashed outline
  drawShape(ctx, v.shapeA, cx - 64 * scale, cy, sizeA, v.colorA, true);
  ctx.save();
  ctx.setLineDash([8, 5]);
  ctx.lineWidth = Math.max(1.5, 2.4 * scale);
  ctx.strokeStyle = v.colorB;
  drawShape(ctx, v.shapeB, cx + 64 * scale, cy, sizeB, v.colorB, false);
  ctx.setLineDash([]);
  ctx.restore();
}

// ─── New Quant ────────────────────────────────────────────────────────────────

function renderThreeToOne(ctx, cx, cy, v, scale = 1) {
  const sizeA = randomBetween(33, 46) * scale;
  const sizeB = randomBetween(52, 72) * scale;
  const leftX = cx - 84 * scale, midX = cx - 48 * scale, rightX = cx + 64 * scale;
  const dy = 30 * scale;
  [{ x: leftX, y: cy - dy }, { x: leftX, y: cy + dy }, { x: midX, y: cy }]
    .forEach(p => drawShape(ctx, v.shapeA, p.x, p.y, sizeA, v.colorA, true));
  drawShape(ctx, v.shapeB, rightX, cy, sizeB, v.colorB, true);
}

function renderOneToFive(ctx, cx, cy, canvasW, canvasH, v, scale = 1) {
  const sizeA = randomBetween(44, 60) * scale;
  const sizeB = randomBetween(24, 34) * scale;
  const leftX = cx - 84 * scale;
  const topY = cy - 44 * scale, bottomY = cy + 16 * scale;
  const gapX = 40 * scale;
  drawShape(ctx, v.shapeA, leftX, cy, sizeA, v.colorA, true);
  const positions = [
    { x: cx + 32 * scale, y: topY }, { x: cx + 72 * scale, y: topY },
    { x: cx + 112 * scale, y: topY }, { x: cx + 52 * scale, y: bottomY },
    { x: cx + 92 * scale, y: bottomY },
  ];
  positions.forEach(p => drawShape(ctx, v.shapeB, p.x, p.y, sizeB, v.colorB, true));
}

function renderDecreasingRow(ctx, cx, cy, v, scale = 1) {
  // 4 shapes in a row, decreasing size left→right
  const sizes = [68, 52, 37, 24].map(s => s * scale);
  const gap = 42 * scale;
  const xs = [cx - gap * 1.5, cx - gap * 0.5, cx + gap * 0.5, cx + gap * 1.5];
  sizes.forEach((s, i) => drawShape(ctx, v.shapeA, xs[i], cy, s, v.colorA, true));
}

function renderIncreasingRow(ctx, cx, cy, v, scale = 1) {
  const sizes = [24, 37, 52, 68].map(s => s * scale);
  const gap = 42 * scale;
  const xs = [cx - gap * 1.5, cx - gap * 0.5, cx + gap * 0.5, cx + gap * 1.5];
  sizes.forEach((s, i) => drawShape(ctx, v.shapeA, xs[i], cy, s, v.colorB, true));
}

function renderBalancedScale(ctx, cx, cy, v, scale = 1) {
  // Beam
  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = Math.max(1.5, 2.4 * scale);
  const beamW = 96 * scale;
  ctx.beginPath(); ctx.moveTo(cx - beamW, cy - 8 * scale); ctx.lineTo(cx + beamW, cy - 8 * scale); ctx.stroke();
  // Pivot
  ctx.beginPath(); ctx.moveTo(cx, cy - 8 * scale); ctx.lineTo(cx, cy + 24 * scale); ctx.stroke();
  ctx.restore();
  // Pans
  const sizeA = randomBetween(33, 48) * scale;
  const sizeB = randomBetween(33, 48) * scale;
  const panX = 80 * scale;
  // Left pan
  ctx.save();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = Math.max(1, 1.2 * scale);
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(cx - panX, cy - 8 * scale); ctx.lineTo(cx - panX, cy + 16 * scale); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  drawShape(ctx, v.shapeA, cx - panX, cy + 16 * scale + sizeA / 2, sizeA, v.colorA, true);
  // Right pan
  ctx.save();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = Math.max(1, 1.2 * scale);
  ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(cx + panX, cy - 8 * scale); ctx.lineTo(cx + panX, cy + 16 * scale); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  drawShape(ctx, v.shapeB, cx + panX, cy + 16 * scale + sizeB / 2, sizeB, v.colorB, true);
}

if (typeof window !== 'undefined') {
  window.drawScrapToken = drawScrapToken;
  window.drawVoronoiToken = drawVoronoiToken;
}

// ── Trajectory N-Back / Schema Transfer board ──────────────────────────────
// Draws the graph as nodes (circles) and edges (lines), with the player's
// current position highlighted. Edges fade out after the learning phase so
// the player must internalize the topology rather than reading it off-screen.
//
//   stimulus._tjn = {
//     node, tier, K, goal, learnPhase, graph,
//     blockIndex, blockLabel, blockColor, schemaMode
//   }
//   graph = { nodes[], adjacency[][], positions[{x,y}] (in [0,1]^2), label, family }
export function renderTrajectoryBoard(ctx, canvasW, canvasH, stimulus) {
  const tjn = stimulus?._tjn;
  if (!tjn || !tjn.graph) return;
  const { graph, node: currentNode, tier, K, goal, learnPhase, blockLabel, blockColor, schemaMode } = tjn;

  // Background — themed per block so schema-transfer mode reads as "new world"
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, canvasW, canvasH);
  bg.addColorStop(0, 'rgba(8, 12, 22, 0.96)');
  bg.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.restore();

  // Block badge (top-left) — only in schema mode where it carries info
  if (schemaMode && blockLabel) {
    ctx.save();
    ctx.fillStyle = blockColor || '#22d3ee';
    ctx.font = 'bold 14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(blockLabel, 18, 18);
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
    ctx.fillText('schema instance — same topology, new surface', 18, 36);
    ctx.restore();
  }

  // Tier badge (top-right)
  ctx.save();
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`TJN · ${String(tier || 'easy').toUpperCase()}${tier === 'hard' ? ` · K=${K || 2}` : ''}`, canvasW - 18, 18);
  if (learnPhase) {
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('MAP LEARNING — edges visible', canvasW - 18, 36);
  } else {
    ctx.fillStyle = 'rgba(244, 114, 182, 0.85)';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('MAP FADED — recall topology from memory', canvasW - 18, 36);
  }
  ctx.restore();

  // Layout: center the graph in the canvas with margins
  const marginX = Math.min(canvasW * 0.14, 90);
  const marginY = Math.min(canvasH * 0.18, 90);
  const boardW = canvasW - 2 * marginX;
  const boardH = canvasH - 2 * marginY;
  const px = (p) => marginX + p.x * boardW;
  const py = (p) => marginY + p.y * boardH;

  // Edges
  const edgeAlpha = learnPhase ? 0.55 : 0.07; // fade after learning phase
  const edgeColor = `rgba(148, 163, 184, ${edgeAlpha})`;
  ctx.save();
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = learnPhase ? 2.2 : 1.0;
  for (let i = 0; i < graph.adjacency.length; i++) {
    const from = graph.positions[i];
    for (const j of graph.adjacency[i]) {
      if (j <= i) continue;
      const to = graph.positions[j];
      ctx.beginPath();
      ctx.moveTo(px(from), py(from));
      ctx.lineTo(px(to), py(to));
      ctx.stroke();
    }
  }
  ctx.restore();

  // Goal highlight (Extreme tier)
  if (tier === 'extreme' && goal != null) {
    const gp = graph.positions[goal];
    ctx.save();
    ctx.beginPath();
    ctx.arc(px(gp), py(gp), 36, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Goal star marker
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', px(gp), py(gp) - 30);
    ctx.restore();
  }

  // Nodes
  for (let i = 0; i < graph.nodes.length; i++) {
    const p = graph.positions[i];
    const isCurrent = i === currentNode;
    const isGoal = tier === 'extreme' && i === goal;
    const r = isCurrent ? 30 : 22;

    ctx.save();
    // Fill
    ctx.beginPath();
    ctx.arc(px(p), py(p), r, 0, Math.PI * 2);
    if (isCurrent) {
      const grad = ctx.createRadialGradient(px(p), py(p), 4, px(p), py(p), r);
      grad.addColorStop(0, blockColor || '#22d3ee');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
      ctx.fillStyle = grad;
    } else if (isGoal) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
    } else {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    }
    ctx.fill();
    // Ring
    ctx.lineWidth = isCurrent ? 3 : 1.5;
    ctx.strokeStyle = isCurrent
      ? (blockColor || '#22d3ee')
      : (isGoal ? 'rgba(250, 204, 21, 0.9)' : 'rgba(148, 163, 184, 0.45)');
    ctx.stroke();
    // Label inside node
    ctx.fillStyle = isCurrent ? '#fff' : 'rgba(226, 232, 240, 0.85)';
    ctx.font = `bold ${isCurrent ? 16 : 13}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String.fromCharCode(65 + i), px(p), py(p));
    ctx.restore();
  }

  // "You are here" arrow above the current node
  const cp = graph.positions[currentNode];
  if (cp) {
    ctx.save();
    ctx.fillStyle = blockColor || '#22d3ee';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('▼ YOU', px(cp), py(cp) - 36);
    ctx.restore();
  }

  // Bottom hint strip — explains tier rule briefly so cold-start players
  // can attempt the task without needing the tutorial.
  ctx.save();
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const rule = tier === 'easy'    ? 'TARGET = current node IS the N-back node'
             : tier === 'medium'  ? 'TARGET = current node is a NEIGHBOUR of the N-back node'
             : tier === 'hard'    ? `TARGET = current node is reachable in EXACTLY ${K || 2} steps from N-back`
             :                      'TARGET = current node lies on the shortest path N-back → ★ goal';
  ctx.fillText(rule, canvasW / 2, canvasH - 14);
  ctx.restore();
}
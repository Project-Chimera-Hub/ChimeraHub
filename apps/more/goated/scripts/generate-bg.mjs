// Generate a deterministic, copyright-free SVG used as the StartScreen
// background. The image is a faint "deep-field nebula" — atmospheric blobs of
// warm glow scattered through a turbulence-noise wash, with a few curving
// filaments connecting regions. Inspired by deep-space and microscopy
// imagery; entirely composed from primitives, so there is no third-party
// provenance to track.
//
// The output is committed to public/assets/start-bg.svg so the asset ships
// without requiring contributors to run the generator. Re-running this script
// is idempotent: a fixed seed (mulberry32) means the same SVG every time.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'public', 'assets');
const outPath = resolve(outDir, 'start-bg.svg');

// 6-line seeded PRNG; identical sequence every run for byte-stable output.
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0xb33f;
const rand = mulberry32(SEED);
const rangeR = (lo, hi) => lo + rand() * (hi - lo);
const W = 1920;
const H = 1080;

// Glow palette — warm cores anchor the eye, cool fillers add depth. Each
// entry: [coreColor, samplingWeight]. Sampling weight controls how often the
// color is picked when placing a blob (not opacity).
const WARM = [
  { color: '#ff8c00', weight: 3 }, // amber
  { color: '#ff6020', weight: 2 }, // orange-red
  { color: '#ffa040', weight: 2 }, // gold
  { color: '#ff007f', weight: 2 }, // magenta
  { color: '#d946ef', weight: 1 }, // fuchsia
];
const COOL = [
  { color: '#8a2be2', weight: 3 }, // violet
  { color: '#1f75fe', weight: 2 }, // deep blue
  { color: '#6e5cff', weight: 2 }, // periwinkle
  { color: '#22d3ee', weight: 1 }, // teal (sparse — keeps the warm palette dominant)
];

function pickWeighted(pool) {
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = rand() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return e.color;
  }
  return pool[pool.length - 1].color;
}

// Place a single glow blob as a <radialGradient> + <circle>. The gradient
// fades from the core color (high alpha at center) to transparent at the rim
// so multiple blobs blend additively.
function blob(id, cx, cy, r, color, coreAlpha) {
  return {
    grad: `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="${coreAlpha.toFixed(2)}" />
      <stop offset="35%" stop-color="${color}" stop-opacity="${(coreAlpha * 0.4).toFixed(2)}" />
      <stop offset="100%" stop-color="${color}" stop-opacity="0" />
    </radialGradient>`,
    use: `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#${id})" />`,
  };
}

// Pick 3 "regions" — clusters of warm glow that anchor the eye. Far fewer
// than a continuous wash; the reference image has lots of dark space between
// concentrated bright zones.
function placeRegions() {
  const regions = [];
  const pad = 280;
  for (let i = 0; i < 3; i++) {
    let cx, cy;
    let attempt = 0;
    do {
      cx = pad + rand() * (W - 2 * pad);
      cy = pad + rand() * (H - 2 * pad);
      attempt++;
    } while (attempt < 30 && regions.some(r => Math.hypot(r.cx - cx, r.cy - cy) < 550));
    regions.push({ cx, cy, color: pickWeighted(WARM) });
  }
  return regions;
}

const grads = [];
const blobsLayer = [];
const regions = placeRegions();
let blobId = 0;

// Per-region: one big diffuse core + 2-3 medium satellites + 3-5 embers.
// Conservative counts keep dark space between the bright zones — the
// atmospheric "deep field" effect needs negative space, not a continuous
// wash.
regions.forEach((reg) => {
  // Big core: low alpha, wide footprint.
  {
    const b = blob(`g${blobId++}`, reg.cx, reg.cy, rangeR(300, 420), reg.color, 0.40);
    grads.push(b.grad); blobsLayer.push(b.use);
  }
  // Medium satellites: 2-3, sometimes shifted to a cool tone for chromatic
  // variety inside the region.
  const satCount = 2 + Math.floor(rand() * 2);
  for (let j = 0; j < satCount; j++) {
    const angle = rand() * Math.PI * 2;
    const dist = rangeR(80, 200);
    const cx = reg.cx + Math.cos(angle) * dist;
    const cy = reg.cy + Math.sin(angle) * dist;
    const color = rand() < 0.7 ? reg.color : pickWeighted(COOL);
    const b = blob(`g${blobId++}`, cx, cy, rangeR(80, 160), color, rangeR(0.25, 0.40));
    grads.push(b.grad); blobsLayer.push(b.use);
  }
  // Embers: small bright points reading as "stars" or focal highlights.
  const emberCount = 3 + Math.floor(rand() * 3);
  for (let j = 0; j < emberCount; j++) {
    const angle = rand() * Math.PI * 2;
    const dist = rangeR(40, 260);
    const cx = reg.cx + Math.cos(angle) * dist;
    const cy = reg.cy + Math.sin(angle) * dist;
    const color = rand() < 0.5 ? reg.color : pickWeighted(WARM);
    const b = blob(`g${blobId++}`, cx, cy, rangeR(15, 40), color, rangeR(0.55, 0.80));
    grads.push(b.grad); blobsLayer.push(b.use);
  }
});

// Just a few stray cool glows in the gaps — most of the empty space should
// stay dark.
for (let i = 0; i < 4; i++) {
  const cx = rand() * W;
  const cy = rand() * H;
  const tooClose = regions.some(r => Math.hypot(r.cx - cx, r.cy - cy) < 250);
  if (tooClose) continue;
  const b = blob(`g${blobId++}`, cx, cy, rangeR(60, 120), pickWeighted(COOL), rangeR(0.15, 0.25));
  grads.push(b.grad); blobsLayer.push(b.use);
}

// Filaments — long, smooth cubic-bezier paths threading between regions.
// They read as the curved neural/connective tissue in the reference image.
const filaments = [];
for (let i = 0; i < regions.length; i++) {
  for (let j = i + 1; j < regions.length; j++) {
    if (rand() > 0.55) continue;
    const a = regions[i], b = regions[j];
    const dx = b.cx - a.cx, dy = b.cy - a.cy;
    // Two random control points perpendicular-ish to the chord create a
    // smooth S-curve rather than a straight line.
    const c1x = a.cx + dx * 0.3 + (rand() - 0.5) * 300;
    const c1y = a.cy + dy * 0.3 + (rand() - 0.5) * 300;
    const c2x = a.cx + dx * 0.7 + (rand() - 0.5) * 300;
    const c2y = a.cy + dy * 0.7 + (rand() - 0.5) * 300;
    const stroke = rand() < 0.5 ? '#22d3ee' : '#d946ef';
    filaments.push(
      `<path d="M ${a.cx.toFixed(1)} ${a.cy.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${b.cx.toFixed(1)} ${b.cy.toFixed(1)}" stroke="${stroke}" stroke-width="${rangeR(0.8, 1.8).toFixed(1)}" fill="none" opacity="${rangeR(0.22, 0.45).toFixed(2)}" />`
    );
  }
}

// Tiny scattered stars — 1-2px white dots, sparse, no blur. Adds the "deep
// field" depth without competing with the glows.
const stars = [];
for (let i = 0; i < 110; i++) {
  const cx = rand() * W;
  const cy = rand() * H;
  const r = rand() < 0.85 ? 0.8 : 1.5;
  const alpha = rangeR(0.20, 0.70);
  stars.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="white" opacity="${alpha.toFixed(2)}" />`);
}

// Turbulence backdrop — feTurbulence is built into SVG; it's free Perlin
// noise. Tinted to deep blue/violet by a color matrix, blurred, and held at
// low alpha so the warm blobs sit on top of a cool textured haze.
const turbulence = `
  <filter id="nebula" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.0025" numOctaves="3" seed="7" />
    <feColorMatrix values="0.18 0.05 0.30 0 0   0.10 0.08 0.45 0 0   0.55 0.18 0.78 0 0   0 0 0 0.55 -0.05" />
    <feGaussianBlur stdDeviation="2" />
  </filter>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Deep-field nebula background">
  <defs>
    ${turbulence}
    <filter id="blobBlur"><feGaussianBlur stdDeviation="22" /></filter>
    <filter id="filamentBlur"><feGaussianBlur stdDeviation="3" /></filter>
    <radialGradient id="centerFade" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="white" stop-opacity="0.05" />
      <stop offset="40%" stop-color="white" stop-opacity="0.55" />
      <stop offset="100%" stop-color="white" stop-opacity="1" />
    </radialGradient>
    <mask id="centerMask">
      <rect width="${W}" height="${H}" fill="url(#centerFade)" />
    </mask>
    ${grads.join('\n    ')}
  </defs>
  <g mask="url(#centerMask)">
    <rect width="${W}" height="${H}" filter="url(#nebula)" opacity="0.28" />
    <g filter="url(#blobBlur)">
      ${blobsLayer.join('\n      ')}
    </g>
    <g filter="url(#filamentBlur)">
      ${filaments.join('\n      ')}
    </g>
    <g>
      ${stars.join('\n      ')}
    </g>
  </g>
</svg>
`;

await mkdir(outDir, { recursive: true });
await writeFile(outPath, svg, 'utf8');
console.log(`Wrote: ${outPath} (${(svg.length / 1024).toFixed(1)} KB, ${regions.length} regions, ${blobsLayer.length} glows, ${filaments.length} filaments, ${stars.length} stars)`);

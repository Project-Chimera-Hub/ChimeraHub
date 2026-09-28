// Rasterize the SVG favicon into the PNG sizes a PWA needs to be installable
// on Chrome/Edge (192×192 + 512×512), iOS Safari "Add to Home Screen"
// (180×180 apple-touch-icon), and the maskable variant (Android adaptive
// icons). Run via `node scripts/generate-icons.mjs`. Outputs to public/.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '..', 'public');
const svgPath = resolve(publicDir, 'favicon.svg');
const svg = await readFile(svgPath);

// Maskable icons need a generous safe-zone (~10% padding); we rasterize the
// SVG centered on a 512×512 brand-color background, then re-export at the
// target sizes. The "any"-purpose icons skip the padding.
async function rasterAny(size, outName) {
  const png = await sharp(svg).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await writeFile(resolve(publicDir, outName), png);
  return outName;
}

async function rasterMaskable(size, outName) {
  const safeSize = Math.round(size * 0.78);
  const inner = await sharp(svg).resize(safeSize, safeSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const png = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 8, g: 10, b: 15, alpha: 1 } },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toBuffer();
  await writeFile(resolve(publicDir, outName), png);
  return outName;
}

const outputs = await Promise.all([
  rasterAny(192, 'icon-192.png'),
  rasterAny(512, 'icon-512.png'),
  rasterAny(180, 'apple-touch-icon.png'),
  rasterMaskable(192, 'icon-192-maskable.png'),
  rasterMaskable(512, 'icon-512-maskable.png'),
]);
console.log('Wrote:', outputs.join(', '));

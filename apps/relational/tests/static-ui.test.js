import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { relationGlyphSVG } from '../src/symbols.js';

const root = new URL('../', import.meta.url);
async function read(path) { return readFile(new URL(path, root), 'utf8'); }

test('entry page exposes setup, game, wiki, history and all four response channels', async () => {
  const html = await read('index.html');
  for (const id of ['setup-view', 'game-view', 'wiki-view', 'history-view']) assert.match(html, new RegExp(`id="${id}"`));
  for (const stream of ['position', 'sound', 'shape', 'relation']) assert.match(html, new RegExp(`data-stream="${stream}"`));
  assert.match(html, /3D Rotating/);
  assert.match(html, /Remembered N-back/);
  assert.match(html, /discord\.gg\/chmr/);
  assert.match(html, /variable-floor/);
});

test('app module wires trial generation, scoring and wiki', async () => {
  const app = await read('src/app.js');
  assert.match(app, /createTrialSequence/);
  assert.match(app, /scoreTrial/);
  assert.match(app, /renderWiki/);
  assert.match(app, /variableFloor/);
  assert.match(app, /keydown/);
});

test('relation glyph variants remain semantically labelled SVGs', () => {
  const svg = relationGlyphSVG('CONTAINS', 2);
  assert.match(svg, /<svg/);
  assert.match(svg, /aria-label="Contains"/);
  assert.match(svg, /polygon|circle/);
});

test('sound stream ships with the Quad Box Natural-Numbers 1-8 recordings and no TTS', async () => {
  const audioModule = await read('src/audio.js');
  assert.doesNotMatch(audioModule, /speechSynthesis|SpeechSynthesisUtterance/);
  for (let digit = 1; digit <= 8; digit += 1) {
    const bytes = await readFile(new URL(`assets/audio/${digit}.mp3`, root));
    assert.ok(bytes.length > 1000, `audio ${digit}.mp3 should be a real recording`);
  }
});

test('game view is ordered topline, N display, grid, response deck', async () => {
  const html = await read('index.html');
  const at = (needle) => html.indexOf(needle);
  assert.ok(at('id="trial-n-display"') > 0);
  assert.ok(at('id="trial-n-display"') < at('id="grid-2d"'), 'the current N must be printed above the grid');
  assert.ok(at('id="grid-2d"') < at('class="response-deck"'), 'the response deck must sit directly below the grid');
  const app = await read('src/app.js');
  assert.match(app, /trial-n-display/);
  assert.match(app, /trial\.nBack/);
});

test('the game view is laid out to fit the viewport instead of scrolling', async () => {
  const css = await read('styles.css');
  assert.match(css, /body\.in-game\s*\{[^}]*overflow:\s*hidden/, 'the game must not scroll');
  assert.match(css, /body\.in-game \.app-shell\s*\{[^}]*height:\s*calc\(100dvh/, 'the shell is pinned to the viewport height');
  assert.match(css, /#game-view\.active\s*\{[^}]*display:\s*flex/, 'the game view is a flex column');
  assert.match(css, /\.game-stage\s*\{[^}]*flex:\s*1 1 auto/, 'the stage absorbs leftover space so the deck stays visible');
  assert.match(css, /\.response-deck\s*\{[^}]*flex:\s*none/, 'the response deck is never squeezed out');
  assert.match(css, /min\(100cqw, 100cqh\)/, 'the grid is sized from whatever space is left');
  const app = await read('src/app.js');
  assert.match(app, /classList\.toggle\('in-game'/);
  assert.match(app, /window\.scrollTo\(0, 0\)/, 'navigation resets scroll so the HUD is never hidden');
});

test('per-trial feedback survives the start of the next trial', async () => {
  const app = await read('src/app.js');
  const present = app.match(/function presentTrial\(\) \{([\s\S]*?)\n\}/);
  assert.ok(present, 'presentTrial should exist');
  assert.doesNotMatch(present[1], /clearVerdicts\(\)/);
  const update = app.match(/function updateResponseButton\(stream\) \{([\s\S]*?)\n\}/);
  assert.ok(update, 'button state updates should be isolated from verdict colours');
  assert.doesNotMatch(update[1], /'hit'|'miss'|'false-alarm'|'correct-rejection'/);
  assert.match(app, /verdictTimer/, 'verdict clearing is owned by its own timer');
});

test('space still works while the session is paused', async () => {
  const app = await read('src/app.js');
  const handler = app.match(/window\.addEventListener\('keydown',([\s\S]*?)\n\}\);/);
  assert.ok(handler, 'keydown handler should exist');
  const body = handler[1];
  const pauseAt = body.indexOf('togglePause()');
  const pausedGuard = body.indexOf('if (state?.paused) return;');
  assert.ok(pauseAt > 0 && pausedGuard > pauseAt, 'the pause toggle must be reachable while paused');
});

test('an in-game relation cheat sheet is reachable without leaving the session', async () => {
  const html = await read('index.html');
  assert.match(html, /id="relation-help"/);
  assert.match(html, /id="relation-sheet"/);
  const app = await read('src/app.js');
  assert.match(app, /openRelationSheet/);
  assert.match(app, /renderRelationSheet/);
});

test('wiki teaches the side-count reading rule and that left versus right is meaningless', async () => {
  const wiki = await read('src/wiki.js');
  assert.match(wiki, /FEWER sides is the first term/);
  assert.match(wiki, /MORE sides is the second term/);
  assert.match(wiki, /first term → relation → second term/);
  assert.match(wiki, /Left versus right is randomised on every single draw and never means anything/);
  assert.match(wiki, /white outline is not part of the relation/i);
  const constants = await read('src/constants.js');
  for (const phrase of [
    'FEWER-sided shape is the big outer one',
    'FEWER-sided shape is the small inner one',
    'FEWER-sided shape is the BIG one',
    'FEWER-sided shape is the SMALL one',
    'FEWER-sided shape is the HIGHER one',
    'FEWER-sided shape is the LOWER one',
  ]) {
    assert.ok(constants.includes(phrase), `relation rule text missing: ${phrase}`);
  }
});

test('every relation carries a plain-language rule and worked example', async () => {
  const { relationGuideData } = await import('../src/symbols.js');
  const guides = relationGuideData();
  assert.equal(guides.length, 8);
  for (const guide of guides) {
    assert.ok(guide.rule.length > 30, `${guide.id} needs a readable rule`);
    assert.ok(guide.reading.sentence.includes(guide.firstLabel), `${guide.id} worked example should name the first term`);
    assert.ok(guide.firstSides < guide.secondSides);
  }
});

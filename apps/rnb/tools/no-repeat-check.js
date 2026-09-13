#!/usr/bin/env node
/*
 * The cube always moves.
 *
 * Standing still for a trial reads as nothing having happened — the eye has no
 * event to attach the judgement to, and above lag one it is never a target
 * either, so the trial asks for a comparison against a picture that did not
 * change.
 *
 * The one place it must still be allowed is lag one, where the previous trial
 * *is* the n-back item and a position match is a repeat by definition.
 *
 * `trials.js` is loaded in a sandbox with the few globals it reaches for, so
 * this runs without a browser:  node tools/no-repeat-check.js
 */

const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');

let bad = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  ' + extra));
  if (!cond) bad++;
};

/** A 3×3×3 grid, which is what the app builds. */
function cells() {
  const out = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) {
    out.push({ x, y, z });
  }
  return out;
}

function run({ n, streams, meta = false, trials = 4000, lureRate = 0.25 }) {
  const ctx = vm.createContext({ console, Math, Array, Object, JSON });
  vm.runInContext(`
    var cfg = { n: ${n}, meta: ${meta}, lureRate: ${lureRate}, gating: false,
                streams: ${JSON.stringify(streams)} };
    var state = { cells: ${JSON.stringify(cells())}, chain: [] };
    var STREAM_KEYS = ['position','pitch','timbre','pan','color','size','quantity','letter'];
    /* The feature pools the sampler indexes into. Sizes only — nothing here
       reads their contents. */
    var PITCHES = [0,0,0,0], PANS = [0,0,0], COLORS = [0,0,0,0],
        SIZES = [0,0,0], COUNTS = [0,0,0], LETTER_KEYS = [0,0,0,0];
    function voiceSet() { return { voices: [0,0,0] }; }
    /* No coordinate axes here — this file is about the cube standing still, and
       a property that is a coordinate is drawn by a different branch. The pool
       lookup still has to answer, since the feature draws go through it. */
    function coordAxes() { return []; }
    function magnitudeCap() { return 2; }
    function dimCount() { return 3; }
    function poolFor(k) {
      return { pitch: PITCHES, pan: PANS, color: COLORS, size: SIZES,
               quantity: COUNTS, letter: LETTER_KEYS }[k] || [0,0,0];
    }
    var TARGET_RATE = 0.28;
    function cardinalOf() { return null; }
    function positionGuides() {}
  `, ctx);

  // `randInt` and `pick` are defined by the file itself.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/trials.js'), 'utf8'), ctx);

  let repeats = 0, matches = 0;
  for (let i = 0; i < trials; i++) {
    const t = vm.runInContext('(function(){ var t = sampleTrial(); state.chain.push(t); return t; })()', ctx);
    const chain = vm.runInContext('state.chain', ctx);
    const prev = chain[chain.length - 2];
    const nb = chain.length > n ? chain[chain.length - 1 - n] : null;
    if (prev && t.cellIdx === prev.cellIdx) repeats++;
    if (nb && t.cellIdx === nb.cellIdx) matches++;
  }
  return { repeats, matches, trials };
}

/* Only position is on: the other streams have their own samplers and nothing to
   do with where the cube stands. */
const IDENTITY = { position: 'identity' };
const RELATIONAL = { position: 'relational' };

for (const n of [2, 3, 4]) {
  const r = run({ n, streams: IDENTITY });
  ok(`identity, n=${n}: the cube never stands still`, r.repeats === 0,
     `${r.repeats} of ${r.trials} trials repeated the previous cell`);
  const rate = r.matches / r.trials;
  ok(`identity, n=${n}: position matches still arrive`, rate > 0.15 && rate < 0.45,
     `${(rate * 100).toFixed(1)}% were matches`);
}

for (const n of [2, 3]) {
  const r = run({ n, streams: RELATIONAL });
  ok(`relational, n=${n}: the cube never stands still`, r.repeats === 0,
     `${r.repeats} of ${r.trials} repeated`);
}

{
  const r = run({ n: 2, streams: RELATIONAL, meta: true });
  ok('meta, n=2: the cube never stands still', r.repeats === 0,
     `${r.repeats} of ${r.trials} repeated`);
}

/* Lag one is the exception, and it has to stay one: the previous trial IS the
   n-back item, so forbidding a repeat would make a match unstateable. */
{
  const r = run({ n: 1, streams: IDENTITY });
  ok('identity, n=1: a repeat is still possible, because it is the match',
     r.repeats > 0, `no trial repeated, so a 1-back match can never be shown`);
}

console.log(bad ? `\n${bad} FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);

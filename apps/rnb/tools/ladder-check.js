#!/usr/bin/env node
/*
 * The target-accuracy setting, checked against the staircase it drives.
 *
 * `ladder.js` is loaded on its own in a sandbox with nothing but a `tune` object,
 * which is all it needs for the parts under test -- so this runs without a browser,
 * a DOM or a build step:  node tools/ladder-check.js
 *
 * What it is guarding, in order of how badly each would have gone unnoticed:
 *
 *  · The default has to reproduce the old fixed numbers exactly. A new setting that
 *    quietly changes behaviour before anybody touches it is the worst kind.
 *  · `psi(T, T)` must equal the target, or the grid parameter stops being "the
 *    interval at which you score the target" and every printed threshold is a lie.
 *  · Retargeting must translate the posterior rather than reinterpret it. The
 *    stored evidence is about a criterion; change the criterion without moving the
 *    grid and months of blocks silently start claiming to be about a different one.
 *  · The clamp has to hold, because `stairC` divides by `(1 - lapse) - target` and
 *    a target at or above 0.97 makes the whole model infinite.
 */

const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');

const ctx = vm.createContext({ console, Math, Array, Object, JSON });
// Only what ladder.js reaches for.
vm.runInContext('var TUNE_DEFAULTS = { targetAccuracy: 0.40 };', ctx);
vm.runInContext('var tune = { startInterval: 5000, targetInterval: 3000, maxInterval: 6500, nMax: 3, targetAccuracy: 0.40 };', ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/ladder.js'), 'utf8'), ctx);
const g = k => vm.runInContext(k, ctx);
const set = (k, v) => vm.runInContext(`tune.targetAccuracy = ${v};`, ctx);

const LEGACY = 0.80;   // what every pre-setting record was fitted at
let bad = 0;
const ok = (name, cond, extra='') => { console.log((cond?'  ok   ':'  FAIL ') + name + (cond?'':'  '+extra)); if(!cond) bad++; };
const near = (a, b, tol=1e-9) => Math.abs(a-b) <= tol;

// 1. The band is the target plus its margins, whatever the target is.
ok('the band brackets the target',
   near(g('advanceAt()'), g('targetAccuracy()') + 0.05, 1e-9) &&
   near(g('demoteAt()'), g('targetAccuracy()') - 0.10, 1e-9),
   `target=${g('targetAccuracy()')} advance=${g('advanceAt()')} demote=${g('demoteAt()')}`);

/*
 * The scale the band has to live on -- the bug this file exists to keep out.
 *
 * `streamScore` maps "never pressed" to 0 and perfect to 1, and for the
 * relational position stream the never-press rate is 2/3 by construction: three
 * axis judgments per interval, one of them non-empty for an axis-aligned move.
 * So a raw accuracy `a` scores (a - 2/3) / (1/3), and a band chosen as though
 * the score were a raw accuracy is a band nobody can sit inside. At the original
 * 0.85 / 0.70 a player answering 85% of judgments exactly right scored 55% and
 * was told to ease off on every block.
 *
 * Written as a reachability check rather than as fixed numbers, so it keeps
 * meaning the same thing if the target is retuned again.
 */
const POSITION_CHANCE = 2 / 3;
const corrected = a => (a - POSITION_CHANCE) / (1 - POSITION_CHANCE);
const rawFor = s => POSITION_CHANCE + s * (1 - POSITION_CHANCE);

const holdLo = rawFor(g('demoteAt()')), holdHi = rawFor(g('advanceAt()'));
console.log(`   hold band is ${(holdLo * 100).toFixed(0)}%-${(holdHi * 100).toFixed(0)}%`
  + ` of judgments answered exactly right (target ${(rawFor(g('targetAccuracy()')) * 100).toFixed(0)}%)`);

ok('a player at the target scores inside the hold band',
   corrected(rawFor(g('targetAccuracy()'))) > g('demoteAt()') &&
   corrected(rawFor(g('targetAccuracy()'))) < g('advanceAt()'));
ok('the hold band sits where a human can actually play',
   holdLo >= 0.60 && holdHi <= 0.95,
   `${(holdLo * 100).toFixed(0)}%-${(holdHi * 100).toFixed(0)}% raw is not a band anyone sits in`);
ok('easing off means genuinely below target, not merely imperfect',
   holdLo > POSITION_CHANCE + 0.02 && holdLo < 0.85,
   `eases off below ${(holdLo * 100).toFixed(0)}% raw`);

// 2. The grid parameter IS the threshold, at any target.
let curveOk = true, band = [];
for (const p of [0.20, 0.35, 0.40, 0.55, 0.75, 0.90]) {
  set('t', p);
  const T = 3.5;
  if (!near(g(`psi(${T}, ${T})`), p, 1e-12)) curveOk = false;
  band.push([p, +g('advanceAt()').toFixed(3), +g('demoteAt()').toFixed(3)]);
}
ok('psi(T,T) equals the target at every setting', curveOk);
ok('the band follows the target', band.every(([p,a,d]) => near(a, Math.min(0.98,p+0.05), 1e-6) && near(d, Math.max(0.02,p-0.10), 1e-6)),
   JSON.stringify(band));

// 3. Out-of-range values are clamped rather than making stairC infinite.
set('t', 0.99);
ok('a target above the lapse ceiling is clamped', g('targetAccuracy()') === 0.90 && isFinite(g('stairC()')),
   `${g('targetAccuracy()')} / ${g('stairC()')}`);
set('t', 0.01);
ok('a target below the floor is clamped', g('targetAccuracy()') === 0.20);

// 4. Retargeting preserves the fitted curve.
set('t', 0.40);
vm.runInContext('stairInit(5000);', ctx);
// Some evidence: 14 of 20 at 3.2s, twice.
vm.runInContext('stairObserve(Math.log10(3200), 14, 20); stairObserve(Math.log10(3200), 15, 20);', ctx);
const T0 = g('stairMeanT()');
// Predicted performance across the interval range, under the old criterion.
const xs = [3.0, 3.2, 3.4, 3.6, 3.8];
const before = xs.map(x => g(`psi(${x}, ${T0})`));

set('t', 0.70);
vm.runInContext('stairRetarget(0.40, 0.70);', ctx);
const T1 = g('stairMeanT()');
const after = xs.map(x => g(`psi(${x}, ${T1})`));

const expectedShift = (Math.log(0.70/(0.97-0.70)) - Math.log(0.40/(0.97-0.40))) / 6.0;
ok('the posterior shifts by exactly (C_new - C_old)/beta',
   near(T1 - T0, expectedShift, 2e-3), `moved ${(T1-T0).toFixed(5)}, expected ${expectedShift.toFixed(5)}`);
ok('aiming higher puts the threshold at a slower interval', T1 > T0,
   `${(10**T0).toFixed(0)}ms -> ${(10**T1).toFixed(0)}ms`);
ok('the fitted performance curve itself is unchanged',
   before.every((v, i) => near(v, after[i], 2e-2)),
   JSON.stringify({before: before.map(v=>+v.toFixed(3)), after: after.map(v=>+v.toFixed(3))}));

console.log(`\nthreshold at 40%: ${(10**T0/1000).toFixed(2)}s   at 70%: ${(10**T1/1000).toFixed(2)}s`);

// 5. Retargeting back returns to where it started.
vm.runInContext('stairRetarget(0.70, 0.40);', ctx);
set('t', 0.40);
ok('retargeting back is a round trip', near(g('stairMeanT()'), T0, 3e-3),
   `${g('stairMeanT()').toFixed(5)} vs ${T0.toFixed(5)}`);

// 6. A no-op call and a missing posterior are both safe.
vm.runInContext('stairRetarget(0.40, 0.40);', ctx);
const T2 = g('stairMeanT()');
ok('retargeting to the same value changes nothing', near(T2, g('stairMeanT()')));
vm.runInContext('stairLog = null; stairRetarget(0.40, 0.70);', ctx);
ok('retargeting with no posterior yet does not throw', g('stairLog') === null);

/*
 * The migration every record written before the target was a setting goes
 * through on its first load. Last, because it replaces the posterior the checks
 * above share.
 */
set('t', LEGACY);
vm.runInContext('stairInit(4000);', ctx);
const legacyT = g('stairMeanT()');
vm.runInContext('stairRetarget(LEGACY_P_TARGET, 0.40);', ctx);
set('t', 0.40);
const adoptedT = g('stairMeanT()');
ok('a record fitted at the old target is re-read, not relabelled', adoptedT < legacyT,
   `${(10 ** legacyT).toFixed(0)}ms at ${LEGACY} -> ${(10 ** adoptedT).toFixed(0)}ms at 0.40`);
ok('the constant the migration reads is the criterion those records were fitted at',
   g('LEGACY_P_TARGET') === LEGACY, `LEGACY_P_TARGET=${g('LEGACY_P_TARGET')}`);
console.log(`   a stored 4.00s threshold at the old criterion reads as `
  + `${(10 ** adoptedT / 1000).toFixed(2)}s at the new one`);

/* ------------------------------------------------------------------ *
 * What the report says about a score                                  *
 * ------------------------------------------------------------------ */

/*
 * The colours and the criterion have to move with the target too.
 *
 * They did not. `barColor` was fixed at 0.85 and 0.70 and `progressSummary` held
 * a `CRIT = 0.80`, all three of which were the right numbers while every block
 * aimed at 80%. At the 40% default a cleared milestone was painted red for
 * scoring 56%, and "Load held" read "no block at ≥80% yet" for everybody
 * permanently, because no block at that target ever scores 0.80.
 *
 * Checked by reading the source rather than by calling it: both files reach for
 * the DOM at load, and what went wrong is a literal in the file, which is
 * exactly what a source scan can see.
 */
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const hud = src('js/hud.js');
const barLine = (hud.match(/const barColor = [^;]*;/) || [''])[0];
ok('the report colours a score against the target, not against 80%',
   /advanceAt\(\)/.test(barLine) && /demoteAt\(\)/.test(barLine)
     && !/0\.\d/.test(barLine.replace(/#[0-9a-f]{6}/gi, '')),
   `barColor reads: ${barLine || '(not found)'}`);

const crit = (src('js/analysis.js').match(/const CRIT = [^;]*;/) || [''])[0];
ok('"load held" is held to the score that would advance you',
   /advanceAt\(\)/.test(crit), `CRIT reads: ${crit || '(not found)'}`);

/* ------------------------------------------------------------------ *
 * What the meta relations are called                                  *
 * ------------------------------------------------------------------ */

/*
 * "Same direction" and "Opposite" name relations; the third named the leftovers.
 * A residual category cannot be reasoned with — and it is not a residual, it is
 * orthogonality: `cardinalOf` reduces a move to one axis and a sign, so a
 * different axis is a zero dot product exactly.
 *
 * Checked because the payoff is dimensional and arrives later. There are as
 * many mutually orthogonal directions as dimensions, so a fourth axis gives a
 * third way to be orthogonal rather than a second, and the response set stays
 * at three while the state behind it grows.
 */
const meta = fs.readFileSync(path.join(ROOT, 'js/constants.js'), 'utf8');
ok('the third meta relation is named for what it is',
   /id:'meta-diff'[^}]*label:'Orthogonal'/.test(meta),
   'the third option still names the leftovers rather than the relation');
ok('its id is untouched, so stored blocks still resolve',
   /id:'meta-diff'/.test(meta),
   'renaming the id orphans every block already recorded under it');


/* ------------------------------------------------------------------ *
 * The fourth axis                                                     *
 * ------------------------------------------------------------------ *
 *
 * Pitch as a coordinate of the move rather than a stream beside it. The point
 * is orthogonality: there are as many mutually orthogonal directions as there
 * are dimensions, so a fourth axis gives a third way to be orthogonal instead
 * of a second — the answers stay at three while the space behind them grows,
 * which is the only kind of difficulty that costs no buttons.
 *
 * Driven through a sandbox rather than a browser, so it needs the geometry the
 * real app builds. `state.cells` is stood up here as the lattice it would be.
 */
const geo = vm.createContext({ console, Math, Array, Object, JSON });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/constants.js'), 'utf8')
  .replace(/^"use strict";/, ''), geo);

/* A 3×3×3 lattice, which is what `dim: 3` builds. */
vm.runInContext(`
  var cfg = { coordAxes: ['pitch'], magnitudeCap: 2, streams: { position: 'relational' } };
  var state = { cells: [] };
  for (var x = 0; x < 3; x++) for (var y = 0; y < 3; y++) for (var z = 0; z < 3; z++)
    state.cells.push({ x: x, y: y, z: z });
  var idx = function (x, y, z) {
    for (var i = 0; i < state.cells.length; i++) {
      var c = state.cells[i];
      if (c.x === x && c.y === y && c.z === z) return i;
    }
    return -1;
  };
`, geo);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/judgments.js'), 'utf8')
  .replace(/^"use strict";/, ''), geo);

const g4 = k => vm.runInContext(k, geo);

/*
 * A coordinate step is a direction like any other, and it borrows the stream's
 * own relational channel ids for its poles — no new buttons, no new keys.
 */
ok('a coordinate step is named as a direction of its own',
   g4(`cardinalId(cardinalOf({ cellIdx: idx(1,1,1), pitch: 1 },
                             { cellIdx: idx(1,1,1), pitch: 2 }))`) === 'pitch-up',
   'a move up the pool was not read as a move');
ok('and downward too',
   g4(`cardinalId(cardinalOf({ cellIdx: idx(1,1,1), pitch: 2 },
                             { cellIdx: idx(1,1,1), pitch: 1 }))`) === 'pitch-down');

/* Each of the four properties can be the coordinate, not just the tone. */
['pitch', 'color', 'size', 'quantity'].forEach(k => {
  vm.runInContext(`cfg.coordAxes = ['${k}'];`, geo);
  const poles = g4(`coordPoles('${k}')`);
  ok(`${k} can be an axis of the move`,
     g4(`cardinalId(cardinalOf({ cellIdx: idx(1,1,1), ${k}: 0 },
                               { cellIdx: idx(1,1,1), ${k}: 1 }))`) === poles[0],
     `a step on ${k} was not read as a move`);
  ok(`and it names itself with ${k}'s own two channels`,
     poles.every(p => typeof p === 'string' && p) && poles[0] !== poles[1],
     `poles ${JSON.stringify(poles)} — a coordinate needs no invented ids`);
});

/* Several at once, which is what makes five, six and seven dimensions. */
vm.runInContext("cfg.coordAxes = ['pitch', 'size', 'quantity'];", geo);
ok('the count of axes is the cube plus whatever was chosen',
   g4('dimCount()') === 6, `dimCount() reads ${g4('dimCount()')}`);
ok('and a later coordinate is still its own axis',
   g4(`cardinalId(cardinalOf({ cellIdx: idx(1,1,1), pitch: 0, size: 0, quantity: 0 },
                             { cellIdx: idx(1,1,1), pitch: 0, size: 0, quantity: 1 }))`)
     === g4("coordPoles('quantity')[0]"),
   'the third coordinate is being read on somebody else\'s axis');
vm.runInContext("cfg.coordAxes = ['pitch'];", geo);

ok('the three cube axes still read as they did',
   g4(`cardinalId(cardinalOf({ cellIdx: idx(1,1,1), pitch: 1 },
                             { cellIdx: idx(2,1,1), pitch: 1 }))`) === 'east',
   'adding a fourth component changed what a spatial move is called');

/*
 * The invariant a *named* move rests on: it is on exactly one axis. Moving the
 * cell *and* the pitch names nothing, which is what makes the generator draw
 * the axis rather than filter for it afterwards. (Composite moves are still
 * drawn — they are measured as vectors, and simply have no cardinal name.)
 */
ok('a move on two axes at once is not a direction',
   g4(`cardinalOf({ cellIdx: idx(1,1,1), pitch: 1 },
                   { cellIdx: idx(2,1,1), pitch: 2 })`) === null,
   'a diagonal through space and pitch was given a name');

ok('a coordinate step is invisible when nothing is a coordinate',
   (vm.runInContext('cfg.coordAxes = [];', geo),
    g4(`cardinalOf({ cellIdx: idx(1,1,1), pitch: 1 },
                    { cellIdx: idx(1,1,1), pitch: 2 })`) === null),
   'a coordinate axis is being read when none was chosen');
vm.runInContext("cfg.coordAxes = ['pitch'];", geo);

/* Given a move east, the axes orthogonal to it: two at three dimensions, three
   at four. That count *is* the feature. */
const orth = d => {
  vm.runInContext(`cfg.coordAxes = ${d >= 4 ? "['pitch']" : '[]'};`, geo);
  return g4(`(function () {
    var A = cardinalOf({ cellIdx: idx(1,1,1), pitch: 1 },
                       { cellIdx: idx(2,1,1), pitch: 1 });
    var moves = [
      { cellIdx: idx(1,0,1), pitch: 1 }, { cellIdx: idx(1,2,1), pitch: 1 },
      { cellIdx: idx(1,1,0), pitch: 1 }, { cellIdx: idx(1,1,2), pitch: 1 },
      { cellIdx: idx(1,1,1), pitch: 0 }, { cellIdx: idx(1,1,1), pitch: 2 },
    ];
    var axes = {};
    moves.forEach(function (m) {
      var c = cardinalOf({ cellIdx: idx(1,1,1), pitch: 1 }, m);
      if (c && c[0] !== A[0]) axes[c[0]] = true;
    });
    return Object.keys(axes).length;
  })()`);
};
ok('three dimensions leave two ways to be orthogonal', orth(3) === 2,
   `counted ${orth(3)}`);
ok('four dimensions leave three', orth(4) === 3,
   `counted ${orth(4)} — the fourth axis is not reaching the relation`);

/* Nothing is judged twice. */
const st = fs.readFileSync(path.join(ROOT, 'js/state.js'), 'utf8');
ok('a coordinate cannot also be a stream',
   (function () {
     /* Run the real guard rather than read it: lifted out of state.js, because
        state.js declares a cfg of its own that would collide with the sandbox's. */
     const src = st.slice(st.indexOf('function applyDimensions'));
     vm.runInContext(src.slice(0, src.indexOf('\n}') + 2), geo);
     return g4(`(function () {
       var c = { coordAxes: ['pitch', 'size'],
                 streams: { position: 'relational', pitch: 'identity',
                            size: 'relational', color: 'identity' } };
       applyDimensions(c);
       return Object.keys(c.streams).sort().join(',');
     })()`) === 'color,position';
   })(),
   'a property is being judged both as a coordinate and as a stream');
const blk = fs.readFileSync(path.join(ROOT, 'js/block.js'), 'utf8');
ok('and the guard runs on both paths into a block',
   (blk.match(/applyDimensions\(cfg\)/g) || []).length >= 2,
   'progression or free play can still reach a block with pitch judged twice');


/* ------------------------------------------------------------------ *
 * The tones themselves                                               *
 * ------------------------------------------------------------------ */

ok('the tone axis offers three levels at the default cap',
   g4("COORD_POOLS.pitch[2].length") === 3);
ok('and four when the furthest step is three',
   g4("COORD_POOLS.pitch[3].length") === 4,
   'a step of three needs a level to reach');

/*
 * Equal intervals. A step has to read as one step wherever on the axis it
 * happens; a mixture of fourths and fifths makes the same displacement sound
 * different depending where it started, which a coordinate cannot afford.
 */
/*
 * Equal steps on every ordered axis, at every cap. A step has to read as one
 * step wherever on the axis it happens, and an uneven pool makes the same
 * displacement feel different depending where it started.
 *
 * Ratios for the ones discrimination scales on — pitch and size — and
 * differences for quantity, which is counted exactly rather than estimated.
 * Colour is a hue sweep and neither, so it is left out.
 */
[['pitch', 'ratio'], ['size', 'ratio'], ['quantity', 'diff']].forEach(([k, how]) => {
  [2, 3].forEach(cap => {
    const steps = g4(`(function () {
      var p = COORD_POOLS['${k}'][${cap}], out = [];
      for (var i = 1; i < p.length; i++) out.push(${how === 'ratio' ? 'p[i] / p[i-1]' : 'p[i] - p[i-1]'});
      return out;
    })()`);
    const spread = Math.max(...steps) / Math.min(...steps);
    ok(`${k} steps evenly at cap ${cap}`, spread < 1.15,
       `steps ${steps.map(x => x.toFixed(2)).join(', ')}`);
  });
});

/* Hue is a circle, so the sweep must stop short of wrapping or a step would
   sometimes reverse its own direction. */
ok('the colour axis does not wrap round to where it started',
   g4("COORD_POOLS.color[2][0]") !== g4("COORD_POOLS.color[2][2]"));

/* The second cue, and it runs the same way as the first: down is lower and louder. */
vm.runInContext('cfg.pitchLoudness = true;', geo);
ok('deeper is louder when it is asked for',
   g4('pitchLevel(0)') > g4('pitchLevel(1)') && g4('pitchLevel(1)') > g4('pitchLevel(2)'),
   `levels ${[0, 1, 2].map(i => g4(`pitchLevel(${i})`).toFixed(2)).join(', ')}`);
ok('and the top of the pool is left where it was',
   g4('pitchLevel(PITCHES.length - 1)') === 1,
   'the option makes every tone louder rather than tilting them');

vm.runInContext('cfg.pitchLoudness = false;', geo);
ok('off, every tone is the level it always was',
   [0, 1, 2].every(i => g4(`pitchLevel(${i})`) === 1),
   'the option is doing something while switched off');


/* ------------------------------------------------------------------ *
 * Moves on several axes at once                                      *
 * ------------------------------------------------------------------ *
 *
 * A move used to be one axis, so "orthogonal" could only mean "a different
 * axis" — two of them in three dimensions, three in four. Composite moves make
 * it a dot product, and there are far more ways to satisfy one, which is the
 * difference between deriving the relation and reading off whichever axis moved.
 */
vm.runInContext("cfg.coordAxes = [];", geo);

ok('parallel is parallel, however many axes it runs on',
   g4(`metaRelationOf([1,1,0], [1,1,0])`) === 'same');
ok('antiparallel likewise',
   g4(`metaRelationOf([1,1,0], [-1,-1,0])`) === 'opp');
ok('a zero dot product is orthogonal, not "a different axis"',
   g4(`metaRelationOf([1,1,0], [-1,1,0])`) === 'diff',
   'two moves at right angles across two axes each were not read as orthogonal');
ok('and the axis-aligned case still is',
   g4(`metaRelationOf([1,0,0], [0,1,0])`) === 'diff');

/*
 * The case three buttons cannot express, and the reason the generator draws only
 * the clean three. (1,0,0) against (1,1,0) is 45° — neither the same direction
 * nor a right angle.
 */
ok('oblique asks nothing rather than scoring a coin toss',
   g4(`metaRelationOf([1,0,0], [1,1,0])`) === null,
   'a 45-degree relation was given one of the three answers');
ok('a move that goes nowhere states no relation',
   g4(`metaRelationOf([1,0,0], [0,0,0])`) === null);

/* The count that makes the mode less slow: how many directions are orthogonal
   to a given move, once a move may combine axes. */
const orthCount = (vec, d) => {
  vm.runInContext(`cfg.coordAxes = ${d >= 4 ? "['pitch']" : '[]'};`, geo);
  return g4(`(function () {
    var out = [], v = [];
    (function walk(w) {
      if (w.length === ${d}) { if (w.some(function (c) { return c !== 0; })) v.push(w.slice()); return; }
      [-1, 0, 1].forEach(function (c) { walk(w.concat(c)); });
    })([]);
    return v.filter(function (b) { return metaRelationOf(${JSON.stringify(vec)}.slice(0, ${d}), b) === 'diff'; }).length;
  })()`);
};

ok('an axis-aligned move has more than two ways to be crossed',
   orthCount([1,0,0,0], 3) > 2,
   `counted ${orthCount([1,0,0,0], 3)} in three dimensions, where a single-axis`
   + ' move had exactly two');
ok('and a diagonal has its own set',
   orthCount([1,1,0,0], 3) >= 2,
   `counted ${orthCount([1,1,0,0], 3)} orthogonal to a two-axis move`);
ok('the fourth dimension widens it again',
   orthCount([1,0,0,0], 4) > orthCount([1,0,0,0], 3),
   `${orthCount([1,0,0,0], 4)} at four dimensions against`
   + ` ${orthCount([1,0,0,0], 3)} at three`);

/* A diagonal has no single name, and now it has several. */
vm.runInContext("cfg.coordAxes = [];", geo);
ok('a composite move can be spelled out',
   g4(`moveNames([1,-1,0]).join('+')`) === 'east+north',
   `named ${g4(`moveNames([1,-1,0]).join('+')`)}`);
ok('and a single-axis one reads as the one axis',
   g4(`moveNames([0,0,1]).join('+')`) === 'above');

/* ------------------------------------------------------------------ *
 * What the generator actually draws                                  *
 * ------------------------------------------------------------------ *
 *
 * `pickMetaMove` is lifted out of trials.js and run against the same lattice,
 * because the bounds it enforces are the ones nothing downstream re-checks: a
 * level outside its pool renders as an undefined colour or a missing tone, and
 * a move past the cap is a displacement the player was told could not happen.
 */
const trialsSrc = fs.readFileSync(path.join(ROOT, 'js/trials.js'), 'utf8');
const pmAt = trialsSrc.indexOf('function pickMetaMove');
vm.runInContext(trialsSrc.slice(pmAt, trialsSrc.indexOf('\n}\n', pmAt) + 2), geo);
/* The two helpers it reaches for, which live in files with a DOM behind them. */
vm.runInContext(`
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var randInt = function (n) { return Math.floor(Math.random() * n); };
`, geo);

[['pitch'], ['pitch', 'color', 'size', 'quantity']].forEach(list => {
  [2, 3].forEach(cap => {
    vm.runInContext(`cfg.coordAxes = ${JSON.stringify(list)}; cfg.magnitudeCap = ${cap};`, geo);
    const bad = g4(`(function () {
      var axes = ${JSON.stringify(list)}, out = [];
      for (var t = 0; t < ${list.length > 1 ? 25 : 200}; t++) {
        var from = { cellIdx: idx(1,1,1) };
        axes.forEach(function (k) { from[k] = 1; });
        var A = [1, 0, 0].concat(axes.map(function () { return 0; }));
        var m = pickMetaMove(from.cellIdx, from, A, -1);
        if (!m) { out.push('drew nothing'); break; }
        axes.forEach(function (k) {
          var v = m.levels[k];
          if (v == null || v < 0 || v >= poolFor(k).length) out.push(k + ' level ' + v);
        });
        var c = state.cells[m.cellIdx];
        [c.x, c.y, c.z].forEach(function (q) { if (q < 0 || q > 2) out.push('off lattice'); });
      }
      return out.slice(0, 3);
    })()`);
    ok(`every drawn move is in bounds — ${list.length} extra at cap ${cap}`,
       bad.length === 0, bad.join('; '));
  });
});

/*
 * The cap and the pool are the same fact stated twice: a pool of cap+1 levels
 * makes the furthest step exactly the cap and makes every level reachable, and
 * it is the pool — not the offset list — that bounds a drawn move. So the
 * length is the thing worth guarding.
 */
Object.keys(g4('COORD_POOLS')).forEach(k => {
  [2, 3].forEach(cap => {
    vm.runInContext(`cfg.coordAxes = ['${k}']; cfg.magnitudeCap = ${cap};`, geo);
    ok(`${k} has exactly ${cap + 1} levels at cap ${cap}`,
       g4(`poolFor('${k}').length`) === cap + 1,
       `${g4(`poolFor('${k}').length`)} levels — either a step past the cap fits, `
       + 'or the furthest one does not');
  });
});

/* And the furthest step is not merely permitted but drawn, which is the point of
   raising the cap. */
[2, 3].forEach(cap => {
  vm.runInContext(`cfg.coordAxes = ['pitch']; cfg.magnitudeCap = ${cap};`, geo);
  const far = g4(`(function () {
    var most = 0;
    for (var t = 0; t < 200; t++) {
      var from = { cellIdx: idx(1,1,1), pitch: 0 };
      var m = pickMetaMove(from.cellIdx, from, [1, 0, 0, 0], -1);
      if (m) most = Math.max(most, Math.abs(m.levels.pitch - 0));
    }
    return most;
  })()`);
  ok(`a step of ${cap} does get drawn at cap ${cap}`, far === cap,
     `the furthest step drawn was ${far}`);
});

/* And the relation it draws is always one of the three that have a button. */
vm.runInContext("cfg.coordAxes = ['pitch', 'size']; cfg.magnitudeCap = 2;", geo);
const rels = g4(`(function () {
  var seen = {};
  for (var t = 0; t < 400; t++) {
    var from = { cellIdx: idx(1,1,1), pitch: 1, size: 1 };
    var A = [1, 0, 0, 0, 0];
    var m = pickMetaMove(from.cellIdx, from, A, -1);
    if (!m) continue;
    var b = { cellIdx: m.cellIdx, pitch: m.levels.pitch, size: m.levels.size };
    seen[String(metaRelationOf(A, moveVectorOf(from, b)))] = true;
  }
  return Object.keys(seen).sort();
})()`);
ok('no trial is drawn oblique, which has no answer',
   rels.indexOf('null') < 0, `drew ${rels.join(', ')}`);
ok('and all three answers do get drawn',
   ['same', 'opp', 'diff'].every(r => rels.indexOf(r) >= 0), `drew ${rels.join(', ')}`);
vm.runInContext("cfg.coordAxes = ['pitch']; cfg.magnitudeCap = 2;", geo);

/* ------------------------------------------------------------------ *
 * Every axis has a button                                            *
 * ------------------------------------------------------------------ *
 *
 * A coordinate axis is judged inside the *position* judgement while the
 * property's own stream is off, so its two poles have to appear on the position
 * deck or the trial asks something with no key to answer it — which shows up as
 * a run of misses on a stream the player never turned on.
 *
 * The whole check is "what can be asked" against "what can be pressed", read
 * off the same two functions the app uses.
 */
const deckSrc = fs.readFileSync(path.join(ROOT, 'js/deck.js'), 'utf8');
vm.runInContext(deckSrc.replace(/^"use strict";/, ''), geo);

const deckIds = () => g4(`(function () {
  var g = deckGroups().filter(function (x) { return x.key === 'position'; })[0];
  return g ? g.channels.map(function (c) { return c.id; }) : [];
})()`);

[[], ['pitch'], ['color', 'size', 'quantity']].forEach(list => {
  vm.runInContext(`cfg.coordAxes = ${JSON.stringify(list)}; cfg.meta = false; cfg.frame = 'cube';`, geo);
  const ids = deckIds();
  const askable = g4('cardinalIds()').flat();
  ok(`every direction can be pressed with ${list.length ? list.join(' + ') : 'the cube alone'}`,
     askable.every(id => ids.indexOf(id) >= 0),
     `asked ${askable.filter(id => ids.indexOf(id) < 0).join(', ')} with no button`);
  ok(`and nothing extra is offered`,
     ids.length === askable.length,
     `${ids.length} buttons for ${askable.length} directions: ${ids.join(', ')}`);
});

/* At quaternary the answer is the relation between two moves, so the axes widen
   the space without touching the deck at all — the reason this scales. */
vm.runInContext("cfg.coordAxes = ['pitch', 'size']; cfg.meta = true; cfg.frame = 'cube';", geo);
ok('quaternary asks the same three questions however wide the space is',
   deckIds().length === 3, `${deckIds().length} buttons: ${deckIds().join(', ')}`);
vm.runInContext("cfg.coordAxes = ['pitch']; cfg.meta = false;", geo);

/* ------------------------------------------------------------------ *
 * Which mode owns the extra axes                                     *
 * ------------------------------------------------------------------ *
 *
 * Progression keeps its own copy, for the reason cfg.feedback exists twice: a
 * setting written by one mode and read by the other is invisible until you are
 * in the other mode wondering why the task changed. Extra axes are worse than
 * feedback that way — they change what a recorded rung is about.
 *
 * Source scans, because there is no DOM here. Each names the writer and the
 * store it must read, so a line copied from the other mode fails.
 */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const wir = fs.readFileSync(path.join(ROOT, 'js/wiring.js'), 'utf8');
const sui = fs.readFileSync(path.join(ROOT, 'js/settings-ui.js'), 'utf8');
const body = (src, fn) => {
  const at = src.indexOf('function ' + fn);
  return at < 0 ? '' : src.slice(at, src.indexOf('\n}', at));
};

const COORD_FIELDS = ['coordAxes', 'magnitudeCap', 'pitchLoudness'];
[['applyProgression', 'progCfg', 'freeCfg'],
 ['applyFree', 'freeCfg', 'progCfg']].forEach(([fn, mine, theirs]) => {
  const src = body(blk, fn);
  COORD_FIELDS.forEach(f => {
    ok(`${fn} sets ${f} from ${mine}`,
       new RegExp(`${f}:[^,\n]*${mine}`).test(src),
       `${fn} either leaves ${f} to whatever the other mode left behind, or reads ${theirs}`);
  });
});
ok('a ladder run cannot inherit Free Play\'s axes',
   !new RegExp('freeCfg').test(body(blk, 'applyProgression')));

const per = fs.readFileSync(path.join(ROOT, 'js/persistence.js'), 'utf8');
const resetBody = body(per, 'resetInMemoryState');
/* The assign that clears each store, read out of the reset rather than pattern-
   matched across it, so a field listed on the wrong store still fails. */
const clears = store => {
  const at = resetBody.indexOf('Object.assign(' + store);
  return at < 0 ? '' : resetBody.slice(at, resetBody.indexOf('});', at));
};
COORD_FIELDS.forEach(f => {
  ['progCfg', 'freeCfg'].forEach(store => {
    ok(`a reset clears ${f} on ${store}`,
       clears(store).indexOf(f) >= 0,
       `a new profile would start with the last profile's ${f}`);
  });
});

/* Both panes offer every property, and every box names a real one. */
['coordAxes', 'progCoordAxes'].forEach(id => {
  const at = html.indexOf(`id="${id}"`);
  const grp = at < 0 ? '' : html.slice(at, html.indexOf('</div>', at));
  const offered = (grp.match(/data-coord="(\w+)"/g) || [])
    .map(m => m.replace(/.*"(\w+)"/, '$1'));
  ok(`${id} offers every property that can be an axis`,
     Object.keys(g4('COORD_POOLS')).every(k => offered.indexOf(k) >= 0),
     `offers ${offered.join(', ') || 'nothing'}`);
  ok(`and offers nothing that has no pool`,
     offered.length > 0 && offered.every(k => g4(`!!COORD_POOLS['${k}']`)),
     `${offered.join(', ')} against pools for ${Object.keys(g4('COORD_POOLS')).join(', ')}`);
  ok(`${id} is wired to a handler`,
     wir.indexOf(`#${id} input[data-coord]`) >= 0,
     'the boxes render and do nothing');
});

/* Every id the sync touches has to exist, or syncSettingsUI throws and the whole
   settings screen stops updating — which is how a silent one of these hides. */
['magnitudeCap', 'coordCount', 'pitchLoudness',
 'progMagnitudeCap', 'progCoordCount', 'progPitchLoudness'].forEach(id => {
  ok(`#${id} exists for the sync to write to`,
     html.indexOf(`id="${id}"`) >= 0);
});
ok('both panes sync through the one helper',
   (sui.match(/syncCoordUI\(/g) || []).length >= 3,
   'a second copy of the sync is how the two modes drift apart');

console.log(bad ? `\n${bad} FAILED` : '\nall checks passed');
process.exit(bad ? 1 : 0);

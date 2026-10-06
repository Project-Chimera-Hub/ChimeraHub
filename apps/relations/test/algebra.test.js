/* node apps/relations/test/algebra.test.js — checks the engine against itself
   and against brute force, across every material and level. */
"use strict";
const A = require("../algebra.js");
const assert = require("assert");
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const BAD = /undefined|null|NaN|\[object/;

for (const [name, G] of Object.entries(A.GROUPS)) {
  const rng = A.Rng(7);
  const o = A.difficulty(20);
  const el = () => G.random(rng, o);
  for (let i = 0; i < 300; i++) {
    const a = el(), b = el(), c = el();
    ok(G.eq(G.op(G.op(a, b), c), G.op(a, G.op(b, c))), name + ": associative");
    ok(G.eq(G.op(a, G.id()), a) && G.eq(G.op(G.id(), a), a), name + ": identity");
    ok(G.eq(G.op(a, G.inv(a)), G.id()) && G.eq(G.op(G.inv(a), a), G.id()), name + ": inverse");
  }
  for (const s of G.symmetries || []) for (let i = 0; i < 50; i++) {
    const a = el(), b = el();
    if (G.abelian) ok(G.eq(s.f(G.op(a, b)), G.op(s.f(a), s.f(b))), name + ": symmetry " + s.id + " respects composition");
  }
}
{ const S = A.GROUPS.square;   /* order matters in D4 */
  ok(!S.eq(S.op([1, 0], [0, 1]), S.op([0, 1], [1, 0])), "square: turn∘mirror ≠ mirror∘turn"); }

const tally = {};
for (const [name, G] of Object.entries(A.GROUPS)) {
  for (let level = 1; level <= 20; level++) {
    for (let seed = 0; seed < 40; seed++) {
      const rng = A.Rng(level * 1000 + seed + name.length * 77);
      const o = A.difficulty(level);
      const style = ["inline", "marks", "mixed"][seed % 3];

      const q = A.questionTrial(G, rng, o);
      ok(q, `${name} L${level}: a question was made`);
      for (const p of q.premises) {
        const v = A.solve(G, [p], p.X, p.Y);
        ok(G.eq(v, A.rel(G, q.world, p.X, p.Y)), `${name} L${level}: premise ${p.kind} solves to the truth`);
      }
      const solved = A.solve(G, q.premises, q.X, q.Y);
      if (q.answer === "cant") ok(solved === null, `${name}: can't tell means unlinked`);
      else {
        ok(solved !== null && G.eq(solved, q.truth), `${name}: shown premises determine the truth`);
        ok((q.answer === "yes") === G.eq(q.asked, q.truth), `${name}: yes iff asked is the truth`);
      }
      const lines = A.render(G, o, q.premises, style, rng);
      ok(lines.length >= q.premises.length && lines.every((l) => !BAD.test(l)), `${name}: sentences are clean: ${lines.join(" ")}`);
      ok(!BAD.test(q.question), `${name}: question clean: ${q.question}`);
      tally[name + ":" + q.answer] = (tally[name + ":" + q.answer] || 0) + 1;
      if (q.lure) tally["lure:" + q.lure] = (tally["lure:" + q.lure] || 0) + 1;

      const pt = A.possibleTrial(G, rng, o);
      ok(pt, `${name} L${level}: a possible/impossible item was made`);
      ok(A.consistent(G, pt.premises, pt.world.names) === (pt.answer === "possible"), `${name}: possible iff every loop closes`);
      ok(A.render(G, o, pt.premises, style, rng).every((l) => !BAD.test(l)), `${name}: possible sentences clean`);

      if (G.metric) {
        const h = A.howfarTrial(G, rng, o, seed % 2 ? "king" : "manhattan");
        ok(h && h.options.includes(h.answer) && new Set(h.options).size === h.options.length, `${name}: how-far options`);
        ok(String(G.metric(A.solve(G, h.premises, h.X, h.Y), h.metric)) === h.answer, `${name}: how-far answer is the solved distance`);
      }

      if (level % 4 === 1 && seed < 10) {
        const o2 = A.difficulty(level, "nback");
        const rot = name === "space" && seed % 2 === 0;
        const r = A.nbackRound(G, rng, o2, o2.n, 12, rot);
        r.items.forEach((it, i) => {
          for (const p of it.premises) ok(G.eq(A.solve(G, [p], p.X, p.Y), A.rel(G, it.world, p.X, p.Y)), `${name}: n-back premise true`);
          if (i < r.n) return;
          const back = r.items[i - r.n].world, base = r.names[0];
          const relsOf = (w, f) => r.names.map((nm) => f(A.rel(G, w, nm, base)));
          const fs = [(v) => v].concat(rot ? G.symmetries.filter((s) => s.rotation).map((s) => s.f) : []);
          const target = relsOf(back, (v) => v);
          const same = fs.some((f) => relsOf(it.world, f).every((v, j) => G.eq(v, target[j])));
          ok(same === it.target, `${name}: n-back target is right (${it.kind})`);
          tally["nback:" + (it.target ? "match" : it.kind)] = (tally["nback:" + (it.target ? "match" : it.kind)] || 0) + 1;
        });
      }
    }
  }
}
console.log(checks + " checks passed");
console.log(JSON.stringify(tally));

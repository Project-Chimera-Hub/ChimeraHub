import { buildForm } from './src/lib/assessmentItems.js';
function vkey(c){const rot=c.shape==='triangle'?(((c.rot%4)+4)%4):0;return `${c.shape}|${c.count}|${rot}|${c.fill}`;}
let dup=0,bad=0;
const Akeys=new Set(buildForm('A',777).items.map(i=>i.key));
const A=buildForm('A',777), B=buildForm('B',777,Akeys);
for(const f of [A,B]) for(const it of f.items){
  const keys = it.subtest==='matrix' ? it.options.map(vkey) : it.options;
  if(new Set(keys).size!==keys.length) dup++;
  if(it.correctIndex<0||it.correctIndex>=it.options.length) bad++;
}
const out=['dupOptionItems(0): '+dup+' badCorrect(0): '+bad,
 'number: '+A.items.filter(i=>i.subtest==='number').map(i=>i.prompt+' -> '+i.options[i.correctIndex]).join('  ||  '),
 'letter: '+A.items.filter(i=>i.subtest==='letter').map(i=>i.prompt+' -> '+i.options[i.correctIndex]).join('  ||  '),
 'A/B overlap(0): '+B.items.filter(i=>new Set(A.items.map(x=>x.key)).has(i.key)).length].join('\n');
import('node:fs').then(fs=>fs.writeFileSync('/tmp/a2out.txt',out));

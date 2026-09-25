import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Brain, Clock, BarChart3, Play, Info } from 'lucide-react';
import { buildSandiaForm, SANDIA_CITATION, SANDIA_CAVEAT } from '@/lib/sandiaBank';
import { scoreBattery, reliableChange, normsForLength } from '@/lib/psychometrics';
import { getAssessments, addAssessment } from '@/lib/localStorageManager';
import { getAssetUrl } from '@/lib/gameConstants';

const FORM_META = {
  A: { label: 'Baseline', sub: 'Form A · 24 items — take before a training block', tag: 'baseline' },
  B: { label: 'Follow-up', sub: 'Form B · 24 items — take after a training block', tag: 'followup' },
  full: { label: 'Full test', sub: 'All 48 items — most reliable single estimate', tag: 'full' },
};

export default function Assessment() {
  const [phase, setPhase] = React.useState('pick'); // pick | run | done
  const [form, setForm] = React.useState('A');
  const [battery, setBattery] = React.useState(null);
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState([]);
  const [remainingMs, setRemainingMs] = React.useState(0);
  const [result, setResult] = React.useState(null);
  const [history, setHistory] = React.useState(() => getAssessments());
  const startRef = React.useRef(0);
  const tickRef = React.useRef(null);

  const items = battery?.items || [];
  const item = items[idx];

  const finish = React.useCallback((finalAnswers) => {
    if (tickRef.current) clearInterval(tickRef.current);
    const scored = scoreBattery(items, finalAnswers, battery?.norm);
    const meta = FORM_META[form];
    const rec = addAssessment({
      form, benchmark: meta.tag, instrument: 'sandia',
      raw: scored.raw, n: scored.n, iq: scored.iq, sem: scored.sem, ci95: scored.ci95,
      percentile: scored.percentile, band: scored.band.label, method: scored.method,
      responses: finalAnswers, durationSeconds: Math.round((Date.now() - startRef.current) / 1000),
    });
    setHistory(getAssessments());
    setResult({ ...scored, record: rec });
    setPhase('done');
  }, [items, form, battery]);

  const advance = React.useCallback((choiceIndex) => {
    if (tickRef.current) clearInterval(tickRef.current);
    setAnswers(prev => {
      const next = [...prev];
      next[idx] = choiceIndex;
      if (idx + 1 >= items.length) finish(next); else setIdx(idx + 1);
      return next;
    });
  }, [idx, items.length, finish]);

  React.useEffect(() => {
    if (phase !== 'run' || !item) return;
    const dur = item.timeMs || 60000;
    const t0 = Date.now();
    setRemainingMs(dur);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      const left = dur - (Date.now() - t0);
      if (left <= 0) { clearInterval(tickRef.current); setRemainingMs(0); advance(null); }
      else setRemainingMs(left);
    }, 100);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [phase, idx, item, advance]);

  const startForm = (f) => {
    setForm(f);
    setBattery(buildSandiaForm(f));
    setIdx(0); setAnswers([]); setResult(null);
    startRef.current = Date.now();
    setPhase('run');
  };

  const lastBaseline = [...history].reverse().find(a => a.benchmark === 'baseline');
  const lastFollowup = [...history].reverse().find(a => a.benchmark === 'followup');
  const rc = (lastBaseline && lastFollowup) ? reliableChange(lastBaseline.iq, lastFollowup.iq) : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background p-3 sm:p-6" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-lg sm:text-xl font-mono font-bold text-foreground tracking-tight">Reasoning Index</h1>
              <p className="text-[10px] font-mono text-muted-foreground">Matrix-reasoning measure (Sandia Matrices) · pre/post tracker</p>
            </div>
          </div>
          <Link to="/" className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground text-xs font-mono font-semibold transition-colors flex items-center gap-1.5">
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Link>
        </div>

        {phase === 'pick' && (
          <div className="space-y-5">
            <div className="rounded-xl bg-secondary/20 border border-border p-4 font-mono text-[12px] leading-relaxed text-muted-foreground space-y-2">
              <p>Abstract <strong className="text-cyan-300">matrix reasoning</strong> — the single best proxy for fluid intelligence. Each item shows a 3×3 pattern with one cell missing; pick the option that completes it. Items are the free, validated, normed <strong className="text-cyan-300">Sandia Matrices</strong> (Matzen et al. 2010).</p>
              <p>Take <strong className="text-cyan-300">Baseline (Form A)</strong> before a training block and <strong className="text-cyan-300">Follow-up (Form B)</strong> after. The forms are different items of matched difficulty, so nothing is memorized. Or run the <strong className="text-cyan-300">Full test (48)</strong> for the most reliable single estimate.</p>
              <p className="text-[11px] text-amber-400/80 border-t border-border/40 pt-2">{SANDIA_CAVEAT}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['A', 'B', 'full'].map(f => {
                const meta = FORM_META[f];
                const last = f === 'A' ? lastBaseline : f === 'B' ? lastFollowup : [...history].reverse().find(a => a.benchmark === 'full');
                return (
                  <button key={f} onClick={() => startForm(f)} className="rounded-xl bg-secondary/30 border border-border hover:border-cyan-400/60 p-4 text-left transition-colors space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono font-bold text-foreground">{meta.label}</span>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400">{f === 'full' ? '48' : 'Form ' + f}</span>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">{meta.sub}</p>
                    <div className="flex items-center gap-2 text-[11px] font-mono pt-1">
                      <Play className="w-3.5 h-3.5 text-cyan-400" /><span className="text-cyan-300">Start</span>
                      {last && <span className="text-muted-foreground/70 ml-auto">last: {last.iq} ± {Math.round(1.96 * (last.sem || 7))}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {history.length > 0 && (
              <div className="rounded-xl bg-secondary/20 border border-border p-4 space-y-3">
                <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-cyan-400" /><h3 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">Reasoning Index over time</h3></div>
                <Trajectory history={history} />
                {rc && (
                  <div className={`text-[11px] font-mono rounded-lg px-3 py-2 border ${rc.reliable ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                    Baseline {lastBaseline.iq} → Follow-up {lastFollowup.iq} ({rc.deltaIQ > 0 ? '+' : ''}{rc.deltaIQ}). {rc.reliable
                      ? `That exceeds the ±${rc.thresholdIQ}-point reliable-change threshold — a statistically reliable change.`
                      : `That's within the ±${rc.thresholdIQ}-point measurement-error band, so it can't yet be called a real change.`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {phase === 'run' && item && (
          <div className="space-y-4">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-muted-foreground">{idx + 1} / {items.length} · <span className="text-cyan-400">Matrix Reasoning</span></span>
              <span className="flex items-center gap-1.5 text-amber-400"><Clock className="w-3.5 h-3.5" /> {Math.ceil(remainingMs / 1000)}s</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden"><div className="h-full bg-amber-400 transition-[width] duration-100" style={{ width: `${(remainingMs / (item.timeMs || 60000)) * 100}%` }} /></div>

            <p className="font-mono text-sm text-foreground">Which option completes the pattern?</p>
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-xl bg-white p-2 w-full flex justify-center">
                <img src={getAssetUrl(item.imageUrl)} alt="matrix" className="max-w-full max-h-[40vh] object-contain" />
              </div>
              <div className="rounded-xl bg-white p-2 w-full flex justify-center">
                <img src={getAssetUrl(item.answersImageUrl)} alt="answer options" className="max-w-full max-h-[26vh] object-contain" />
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {item.options.map((opt, i) => (
                <button key={i} onClick={() => advance(i)}
                  className="h-12 rounded-lg bg-secondary/40 border border-border hover:border-cyan-400 hover:bg-secondary/70 font-mono text-foreground text-sm font-bold transition-colors">
                  {opt}
                </button>
              ))}
            </div>
            <p className="text-center text-[10px] font-mono text-muted-foreground/50">Cells are numbered 1-8, left→right, top row then bottom row. Take your time; no going back.</p>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="space-y-5">
            <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/30 p-5 text-center space-y-1">
              <p className="text-[11px] font-mono uppercase tracking-widest text-cyan-400">{FORM_META[form].label} · {form === 'full' ? '48 items' : 'Form ' + form}</p>
              <div className="text-5xl font-mono font-bold text-foreground">{result.iq}</div>
              <p className="text-xs font-mono text-muted-foreground">95% CI {result.ci95[0]}–{result.ci95[1]} · {result.percentile}th percentile</p>
              <p className={`text-xs font-mono font-semibold ${result.band.color}`}>{result.band.label} · Reasoning Index</p>
              <p className="text-[11px] font-mono text-muted-foreground">{result.raw} / {result.n} correct · reliability {normsForLength(result.n).reliability.toFixed(2)}</p>
            </div>

            {rc && (
              <div className={`rounded-lg px-3 py-2 border font-mono text-[11px] ${rc.reliable ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                Baseline {lastBaseline.iq} → Follow-up {lastFollowup.iq} = <strong>{rc.deltaIQ > 0 ? '+' : ''}{rc.deltaIQ}</strong>. {rc.reliable ? `Reliable change (beyond ±${rc.thresholdIQ}).` : `Within measurement error (need ±${rc.thresholdIQ}+ to be reliable).`}
              </div>
            )}

            {history.length > 1 && (
              <div className="rounded-xl bg-secondary/20 border border-border p-4 space-y-2">
                <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">Trajectory</h3>
                <Trajectory history={history} />
              </div>
            )}

            <div className="rounded-lg bg-secondary/20 border border-border/60 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase"><Info className="w-3.5 h-3.5" /> Methodology &amp; limits</div>
              <p>{SANDIA_CITATION}</p>
              <p>{SANDIA_CAVEAT}</p>
            </div>

            <button onClick={() => setPhase('pick')} className="w-full h-11 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-sm font-semibold transition-colors">Done</button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Trajectory({ history }) {
  const W = 520, H = 130, pad = 18;
  const pts = history.map((a, i) => ({
    x: pad + (history.length === 1 ? (W - pad * 2) / 2 : (i / (history.length - 1)) * (W - pad * 2)),
    y: H - pad - ((Math.max(40, Math.min(160, a.iq)) - 40) / 120) * (H - pad * 2),
    a,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[40, 70, 100, 130, 160].map(v => {
        const y = H - pad - ((v - 40) / 120) * (H - pad * 2);
        return (<g key={v}>
          <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
          <text x={2} y={y + 3} className="fill-muted-foreground" style={{ fontSize: 8, fontFamily: 'monospace' }}>{v}</text>
        </g>);
      })}
      {pts.length > 1 && <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={p.a.benchmark === 'followup' ? '#34d399' : '#22d3ee'} stroke="#0b1220" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

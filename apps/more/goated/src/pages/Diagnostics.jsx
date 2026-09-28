import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Play, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { runGameDiagnostics } from '@/lib/gameDiagnostics';

export default function Diagnostics() {
  const [result, setResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = (maxCases) => {
    setIsRunning(true);
    setResult(null);
    setTimeout(() => {
      const nextResult = runGameDiagnostics({ maxCases });
      setResult(nextResult);
      setIsRunning(false);
    }, 50);
  };

  const passed = result?.status === 'passed';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-mono font-bold text-foreground">Diagnostics</h1>
              <p className="text-xs font-mono text-muted-foreground">Stress-test the core game logic across modes, N-levels, streams, pools, and round counts.</p>
            </div>
          </div>
          <Link to="/" className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground text-xs font-mono transition-colors inline-flex items-center gap-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Game
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-4">
          <div className="flex items-start gap-3 text-sm font-mono text-muted-foreground">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p>
              This does not mathematically prove perfection, but it catches broken generation, scoring drift, duplicate scoring, invalid totals, missing stimuli, and bad mode/stream combinations before release.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => runDiagnostics(600)} disabled={isRunning} className="font-mono gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Standard Run
            </Button>
            <Button onClick={() => runDiagnostics(2500)} disabled={isRunning} variant="outline" className="font-mono gap-2">
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Deep Run
            </Button>
          </div>
        </div>

        {result && (
          <div className={`rounded-xl border p-5 ${passed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
            <div className="flex items-center gap-3 mb-4">
              {passed ? <CheckCircle2 className="w-7 h-7 text-emerald-400" /> : <XCircle className="w-7 h-7 text-red-400" />}
              <div>
                <h2 className={`text-xl font-mono font-bold ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
                  {passed ? 'All diagnostics passed' : 'Diagnostics found issues'}
                </h2>
                <p className="text-xs font-mono text-muted-foreground">
                  {result.totalRun} cases run · {result.passed} passed · {result.failed} failed · {result.skipped} skipped · {result.durationMs}ms
                </p>
              </div>
            </div>

            {result.coverage && (
              <div className="grid md:grid-cols-2 gap-2 mb-4">
                {[
                  ['Relation types', result.coverage.relationTypes],
                  ['Stimuli mixes', result.coverage.stimulusMixes],
                  ['Token styles', result.coverage.tokenStyles],
                  ['Streams', result.coverage.streamCounts.map(v => `${v} stream${v === '1' ? '' : 's'}`)],
                  ['Enhancement modes', result.coverage.enhancementModes],
                  ['Noob coverage', result.coverage.noobModes],
                ].map(([label, items]) => (
                  <div key={label} className="rounded-lg bg-background/40 border border-border p-3 font-mono text-xs">
                    <div className="text-primary font-semibold mb-1">{label}</div>
                    <div className="text-muted-foreground leading-relaxed">{items.join(' · ')}</div>
                  </div>
                ))}
              </div>
            )}

            {result.failures.length > 0 && (
              <div className="space-y-2 mb-4">
                {result.failures.slice(0, 20).map((failure, idx) => (
                  <div key={idx} className="rounded-lg bg-background/50 border border-red-500/20 p-3 font-mono text-xs">
                    <div className="text-red-400 font-semibold">{failure.label}</div>
                    <div className="text-muted-foreground mt-1">{failure.message}</div>
                  </div>
                ))}
              </div>
            )}

            {result.samples.length > 0 && (
              <div className="grid md:grid-cols-2 gap-2">
                {result.samples.map((sample, idx) => (
                  <div key={idx} className="rounded-lg bg-background/40 border border-border p-3 font-mono text-xs">
                    <div className="text-foreground truncate">{sample.label}</div>
                    <div className="text-muted-foreground mt-1">{sample.total} scored trials · {sample.accuracy}% accuracy</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
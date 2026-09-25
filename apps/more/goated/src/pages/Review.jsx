import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import GameCanvas from '@/components/game/GameCanvas';
import { getSession } from '@/lib/localStorageManager';

export default function Review() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [currentTrialIdx, setCurrentTrialIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const s = getSession(sessionId);
    if (!s) {
      navigate('/stats');
      return;
    }
    setSession(s);
    setIsLoading(false);
  }, [sessionId, navigate]);

  if (isLoading || !session) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const trials = session.trials || [];
  if (trials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <p className="text-sm font-mono text-muted-foreground mb-4">No trials recorded for this session.</p>
        <Button onClick={() => navigate('/stats')} className="bg-primary text-primary-foreground">← Back to Stats</Button>
      </div>
    );
  }

  const trial = trials[currentTrialIdx];
  const hasNext = currentTrialIdx < trials.length - 1;
  const hasPrev = currentTrialIdx > 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background py-6 px-4 flex flex-col">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-mono font-bold text-foreground">Session Review</h1>
            <button onClick={() => navigate('/stats')} className="text-muted-foreground hover:text-foreground transition-colors">
              <Home className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs font-mono text-muted-foreground">
            N={session.nLevel} · {(session.modes || []).join(', ') || 'Normal'} · Accuracy: {session.accuracy}%
          </p>
        </div>

        {/* Canvas area */}
        <div className="flex-1 min-h-0 rounded-xl bg-secondary/30 border border-border mb-6 flex items-center justify-center">
          {trial.stimulus ? (
            <GameCanvas relationship={trial.relationship} stimulus={trial.stimulus} />
          ) : (
            <p className="text-sm font-mono text-muted-foreground">No stimulus data</p>
          )}
        </div>

        {/* Trial info */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-lg bg-secondary/40 border border-border p-3">
            <div className="text-xs font-mono text-muted-foreground">Trial</div>
            <div className="text-lg font-mono font-bold text-foreground">{currentTrialIdx + 1} / {trials.length}</div>
          </div>
          <div className="rounded-lg bg-secondary/40 border border-border p-3">
            <div className="text-xs font-mono text-muted-foreground">Mode</div>
            <div className="text-lg font-mono font-bold text-primary">{trial.trialMode || 'normal'}</div>
          </div>
          <div className="rounded-lg bg-secondary/40 border border-border p-3">
            <div className="text-xs font-mono text-muted-foreground">Response</div>
            <div className={`text-lg font-mono font-bold ${trial.correct ? 'text-emerald-400' : 'text-red-400'}`}>
              {trial.correct ? '✓ Correct' : '✗ Wrong'}
            </div>
          </div>
          <div className="rounded-lg bg-secondary/40 border border-border p-3">
            <div className="text-xs font-mono text-muted-foreground">Type</div>
            <div className={`text-lg font-mono font-bold ${trial.isTarget ? 'text-accent' : 'text-muted-foreground'}`}>
              {trial.isTarget ? 'TARGET' : 'non-target'}
            </div>
          </div>
        </div>

        {/* Relationship info */}
        {trial.relationship && (
          <div className="rounded-lg bg-secondary/40 border border-border p-3 mb-6">
            <div className="text-xs font-mono text-muted-foreground mb-1">Relationship</div>
            <div className="text-sm font-mono font-semibold text-foreground">{trial.relationship.replace(/_/g, ' ')}</div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            onClick={() => setCurrentTrialIdx(idx => Math.max(0, idx - 1))}
            disabled={!hasPrev}
            className="flex items-center gap-2 bg-secondary border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>

          <div className="flex-1 h-1 bg-secondary/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentTrialIdx + 1) / trials.length) * 100}%` }}
            />
          </div>

          <Button
            onClick={() => setCurrentTrialIdx(idx => Math.min(trials.length - 1, idx + 1))}
            disabled={!hasNext}
            className="flex items-center gap-2 bg-secondary border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Back button */}
        <div className="text-center mt-6">
          <Button onClick={() => navigate('/stats')} className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
            ← Back to Stats
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
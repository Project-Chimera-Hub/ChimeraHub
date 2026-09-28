import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, Check, X, RotateCcw, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GameCanvas from '@/components/game/GameCanvas';
import { generateInsightPuzzle } from '@/lib/insightGenerator';
import { Button } from '@/components/ui/button';

// localStorage key for cumulative insight stats — non-blocking, just a counter
const INSIGHT_STATS_KEY = 'goated_insight_stats_v1';

function loadStats() {
  try {
    const raw = localStorage.getItem(INSIGHT_STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { totalSolved: 0, totalAttempted: 0, streak: 0, bestStreak: 0, byType: {} };
}

function saveStats(stats) {
  try { localStorage.setItem(INSIGHT_STATS_KEY, JSON.stringify(stats)); } catch { /* ignore */ }
}

// Small panel that renders a single relation via the existing GameCanvas
function PuzzlePanel({ panel, onClick, state, label }) {
  // state: 'idle' | 'selected_correct' | 'selected_wrong' | 'revealed_correct'
  const border = state === 'selected_correct' || state === 'revealed_correct'
    ? 'border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.45)]'
    : state === 'selected_wrong'
      ? 'border-red-400 shadow-[0_0_24px_rgba(248,113,113,0.4)]'
      : 'border-border hover:border-primary/60';
  return (
    <button
      onClick={onClick}
      disabled={state !== 'idle' && !onClick}
      className={`relative rounded-xl border-2 bg-secondary/30 overflow-hidden aspect-square transition-all duration-150 ${border} ${onClick && state === 'idle' ? 'cursor-pointer hover:bg-secondary/50' : 'cursor-default'}`}
    >
      {label && (
        <span className="absolute top-2 left-2 z-10 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">{label}</span>
      )}
      <div className="absolute inset-0">
        <GameCanvas relationship={panel.relation} stimulus={panel.stimulus} clearCanvas={false} streamCount={1} />
      </div>
      {state === 'selected_correct' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Check className="w-12 h-12 text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" strokeWidth={3} />
        </div>
      )}
      {state === 'selected_wrong' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <X className="w-12 h-12 text-red-300 drop-shadow-[0_0_8px_rgba(248,113,113,0.6)]" strokeWidth={3} />
        </div>
      )}
      {state === 'revealed_correct' && (
        <div className="absolute bottom-1 left-1 right-1 text-[9px] font-mono font-bold text-emerald-300 uppercase tracking-widest bg-background/70 backdrop-blur-sm rounded px-1.5 py-0.5 text-center">
          ✓ correct answer
        </div>
      )}
    </button>
  );
}

export default function Insight() {
  const [puzzle, setPuzzle] = useState(() => generateInsightPuzzle());
  const [selectedId, setSelectedId] = useState(null);
  // For multi-select puzzles (reverse_sort): track the player's set
  const [selectedIds, setSelectedIds] = useState([]);
  const [resolved, setResolved] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [stats, setStats] = useState(loadStats);
  const [startTime, setStartTime] = useState(() => Date.now());
  const containerRef = useRef(null);

  useEffect(() => { saveStats(stats); }, [stats]);

  const nextPuzzle = useCallback(() => {
    setPuzzle(generateInsightPuzzle());
    setSelectedId(null);
    setSelectedIds([]);
    setResolved(false);
    setShowHint(false);
    setStartTime(Date.now());
  }, []);

  const isCorrectOf = useCallback((puz, sel, selSet) => {
    if (puz.type === 'reverse_sort') {
      const wanted = new Set(puz.correctIds);
      const got = new Set(selSet);
      if (wanted.size !== got.size) return false;
      return [...wanted].every(id => got.has(id));
    }
    const correctId = puz.type === 'odd_one_out'
      ? puz.correctId
      : puz.candidates[puz.correctIndex].id;
    return sel === correctId;
  }, []);

  const recordResult = useCallback((isCorrect) => {
    const rt = Date.now() - startTime;
    setStats(prev => {
      const byType = { ...(prev.byType || {}) };
      const tStat = byType[puzzle.type] || { solved: 0, attempted: 0 };
      tStat.attempted += 1;
      if (isCorrect) tStat.solved += 1;
      byType[puzzle.type] = tStat;
      const newStreak = isCorrect ? prev.streak + 1 : 0;
      return {
        totalSolved: prev.totalSolved + (isCorrect ? 1 : 0),
        totalAttempted: prev.totalAttempted + 1,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak || 0, newStreak),
        byType,
        lastRtMs: rt,
      };
    });
  }, [puzzle, startTime]);

  const handleSelect = useCallback((id) => {
    if (resolved || !puzzle) return;
    // reverse_sort: toggle the id in/out of the set; don't auto-resolve
    if (puzzle.type === 'reverse_sort') {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      return;
    }
    setSelectedId(id);
    setResolved(true);
    recordResult(isCorrectOf(puzzle, id, []));
  }, [resolved, puzzle, recordResult, isCorrectOf]);

  // Reverse-sort explicit submit (since selection is multi-step)
  const handleSubmit = useCallback(() => {
    if (resolved || !puzzle) return;
    setResolved(true);
    recordResult(isCorrectOf(puzzle, null, selectedIds));
  }, [resolved, puzzle, recordResult, selectedIds, isCorrectOf]);

  if (!puzzle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-sm font-mono text-muted-foreground">No puzzle available.</p>
      </div>
    );
  }

  // Derive correct-id targets depending on puzzle type
  const correctId = puzzle.type === 'odd_one_out'
    ? puzzle.correctId
    : puzzle.type === 'analogy_completion' || puzzle.type === 'verbal_analogy'
      ? puzzle.candidates[puzzle.correctIndex].id
      : null; // reverse_sort uses correctIds array

  const correctIdSet = puzzle.type === 'reverse_sort'
    ? new Set(puzzle.correctIds)
    : null;

  const panelState = (id) => {
    if (puzzle.type === 'reverse_sort') {
      const isSelected = selectedIds.includes(id);
      if (!resolved) return isSelected ? 'selected_correct' : 'idle'; // pre-submit: green for chosen
      const inAnswer = correctIdSet.has(id);
      if (isSelected && inAnswer) return 'selected_correct';
      if (isSelected && !inAnswer) return 'selected_wrong';
      if (!isSelected && inAnswer) return 'revealed_correct';
      return 'idle';
    }
    if (!resolved) return 'idle';
    if (id === selectedId && id === correctId) return 'selected_correct';
    if (id === selectedId && id !== correctId) return 'selected_wrong';
    if (id === correctId) return 'revealed_correct';
    return 'idle';
  };

  const accuracy = stats.totalAttempted > 0
    ? Math.round((stats.totalSolved / stats.totalAttempted) * 100)
    : 0;

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background p-3 sm:p-6"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <Lightbulb className="w-6 h-6 text-amber-400 animate-pulse" />
            <div>
              <h1 className="text-lg sm:text-xl font-mono font-bold text-foreground tracking-tight">Insight Mode</h1>
              <p className="text-[10px] font-mono text-muted-foreground">Pure relational inference · no working-memory load</p>
            </div>
          </div>
          <Link to="/" className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground text-xs font-mono font-semibold transition-colors flex items-center gap-1.5">
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Link>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-2 text-center font-mono">
          {[
            { label: 'Streak', value: stats.streak, color: 'text-amber-400' },
            { label: 'Best', value: stats.bestStreak, color: 'text-emerald-400' },
            { label: 'Solved', value: `${stats.totalSolved}/${stats.totalAttempted}`, color: 'text-primary' },
            { label: 'Accuracy', value: `${accuracy}%`, color: accuracy >= 75 ? 'text-emerald-400' : accuracy >= 50 ? 'text-amber-400' : 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-secondary/30 border border-border rounded-lg p-2">
              <div className={`text-base sm:text-lg font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Prompt */}
        <div className="text-center">
          <p className="text-xs sm:text-sm font-mono text-foreground/90 px-2">{puzzle.prompt}</p>
        </div>

        {/* Puzzle body */}
        <AnimatePresence mode="wait">
          <motion.div
            key={puzzle.type + (puzzle.sharedClass || '') + (resolved ? '-resolved' : '-fresh')}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="space-y-5"
          >
            {puzzle.type === 'odd_one_out' && (() => {
              // Layout varies per puzzle: grid / linear / scatter
              const n = puzzle.panels.length;
              const layout = puzzle.layout || 'grid';
              const cols = layout === 'linear'
                ? `repeat(${n}, minmax(0, 1fr))`
                : layout === 'scatter'
                  ? `repeat(${Math.min(n, 3)}, minmax(0, 1fr))`
                  : n <= 4 ? 'repeat(2, minmax(0, 1fr))' : `repeat(${Math.min(n, 3)}, minmax(0, 1fr))`;
              const containerCls = layout === 'linear'
                ? 'max-w-2xl mx-auto'
                : layout === 'scatter'
                  ? 'max-w-lg mx-auto'
                  : 'max-w-md mx-auto';
              return (
                <div className={containerCls}>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 text-center mb-2">{n} panels · {layout} layout</div>
                  <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: cols }}>
                    {puzzle.panels.map(p => (
                      <PuzzlePanel
                        key={p.id}
                        panel={p}
                        state={panelState(p.id)}
                        onClick={resolved ? null : () => handleSelect(p.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {puzzle.type === 'reverse_sort' && (
              <div className="max-w-2xl mx-auto space-y-3">
                <div className="text-center">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">target form</div>
                  <div className="inline-block px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-400/60 text-violet-200 font-mono text-sm font-bold uppercase tracking-wider">
                    {puzzle.sharedClass.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {puzzle.panels.map(p => (
                    <PuzzlePanel
                      key={p.id}
                      panel={p}
                      state={panelState(p.id)}
                      onClick={resolved ? null : () => handleSelect(p.id)}
                    />
                  ))}
                </div>
                {!resolved && (
                  <div className="text-center">
                    <Button
                      onClick={handleSubmit}
                      disabled={selectedIds.length === 0}
                      className="font-mono text-xs gap-1.5 bg-violet-500 text-white hover:bg-violet-500/90 disabled:opacity-40"
                    >
                      Submit ({selectedIds.length} selected · target {puzzle.targetCount})
                    </Button>
                  </div>
                )}
              </div>
            )}

            {puzzle.type === 'verbal_analogy' && (
              <div className="max-w-xl mx-auto space-y-5">
                <div className="rounded-xl border-2 border-border bg-secondary/30 p-5 text-center font-mono">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-3">complete the analogy</div>
                  <div className="text-base sm:text-lg text-foreground/90 leading-relaxed space-y-2">
                    <div>
                      <span className="text-cyan-300 font-bold">{puzzle.base.a}</span>
                      <span className="text-muted-foreground mx-2 italic">{puzzle.base.rel}</span>
                      <span className="text-cyan-300 font-bold">{puzzle.base.b}</span>
                    </div>
                    <div className="text-violet-300/70 text-xs">∷</div>
                    <div>
                      <span className="text-amber-300 font-bold">{puzzle.question.c}</span>
                      <span className="text-violet-300 mx-2 italic">?</span>
                      <span className="text-amber-300 font-bold">{puzzle.question.d}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {puzzle.candidates.map((c, i) => {
                    const state = panelState(c.id);
                    const border = state === 'selected_correct' || state === 'revealed_correct'
                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                      : state === 'selected_wrong'
                        ? 'border-red-400 bg-red-500/15 text-red-200'
                        : 'border-border bg-secondary/40 text-foreground/85 hover:border-primary/60 hover:bg-secondary/70';
                    return (
                      <button
                        key={c.id}
                        onClick={resolved ? null : () => handleSelect(c.id)}
                        disabled={resolved}
                        className={`px-3 py-3 rounded-lg border-2 font-mono text-xs sm:text-sm text-left transition-all duration-150 ${border}`}
                      >
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mr-1.5">{String.fromCharCode(65 + i)}.</span>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {puzzle.type === 'analogy_completion' && (
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center mb-2">The three shown</div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {puzzle.shown.map((p, i) => (
                      <PuzzlePanel key={p.id} panel={p} state="idle" onClick={null} label={`#${i + 1}`} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-violet-300 text-center mb-2">Pick the candidate that belongs</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {puzzle.candidates.map((p, i) => (
                      <PuzzlePanel
                        key={p.id}
                        panel={p}
                        state={panelState(p.id)}
                        onClick={resolved ? null : () => handleSelect(p.id)}
                        label={`${String.fromCharCode(65 + i)}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Hint + Next */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {!resolved ? (
            <Button
              variant="outline"
              onClick={() => setShowHint(v => !v)}
              className="font-mono text-xs gap-1.5"
            >
              <Lightbulb className="w-3.5 h-3.5" /> {showHint ? 'Hide hint' : 'Show hint'}
            </Button>
          ) : (
            <div className="text-xs font-mono">
              {(() => {
                const isCorrect = puzzle.type === 'reverse_sort'
                  ? (selectedIds.length === puzzle.correctIds.length && selectedIds.every(id => puzzle.correctIds.includes(id)))
                  : selectedId === correctId;
                return isCorrect
                  ? <span className="text-emerald-400 font-bold">✓ Correct — {puzzle.sharedClass.replace(/_/g, ' ')}</span>
                  : <span className="text-red-400 font-bold">✗ Wrong — answer was {puzzle.sharedClass.replace(/_/g, ' ')}</span>;
              })()}
            </div>
          )}
          <Button
            onClick={nextPuzzle}
            className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {resolved ? 'Next puzzle' : 'Skip'}
          </Button>
        </div>

        {showHint && !resolved && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/40 p-3 text-xs font-mono text-amber-200">
            💡 {puzzle.hint}
          </div>
        )}

        {/* Foot note */}
        <div className="text-center text-[10px] font-mono text-muted-foreground/60 pt-4 border-t border-border/30 max-w-lg mx-auto leading-relaxed">
          Insight Mode trains relational <strong>inference</strong> in isolation — no n-back chain, no time pressure. The form-class taxonomy is built into the app's relation library; each puzzle is freshly generated from it. <Link to="/tutorial" className="underline hover:text-foreground">Form-class reference</Link>.
        </div>
      </div>
    </motion.div>
  );
}

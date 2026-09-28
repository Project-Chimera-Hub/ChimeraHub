import React from 'react';

export default function GameHUD({ round, totalRounds, nLevel, effectiveN, hitsA, missesA, falseAlarmsA, correctRejectionsA = 0, modes = [], numStreams }) {
  const isImpossible = modes.includes('impossible');
  const isNRINT = modes.includes('nonverbal_rint');
  const isTJN = modes.includes('trajectory_nback');
  const isCCT = modes.includes('cct');
  const explicitFeedback = modes.includes('feedback_per_trial');
  const progressPct = totalRounds > 0 ? Math.min(100, (round / totalRounds) * 100) : 0;
  // Target count = trials that were targets (hits + misses). Useful for
  // sanity-checking that targets are actually firing — especially for new
  // modes like TJN where target rates depend on tier + topology.
  const targetCount = (hitsA || 0) + (missesA || 0);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center justify-between w-full px-1 gap-2 flex-wrap">
        {/* Left: Round & N-Level */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <div className="font-mono text-xs text-muted-foreground whitespace-nowrap">
            <span className="text-foreground font-semibold">{round}</span>
            <span className="mx-0.5">/</span>
            <span>{totalRounds}</span>
          </div>
          <div className="px-1.5 sm:px-2 py-0.5 rounded bg-primary/10 border border-primary/20 whitespace-nowrap">
            <span className="font-mono text-xs font-semibold text-primary">N={effectiveN ?? nLevel}</span>
          </div>
          {numStreams > 1 && (
            <div className="px-1.5 sm:px-2 py-0.5 rounded bg-accent/10 border border-accent/20 whitespace-nowrap">
              <span className="font-mono text-xs font-semibold text-accent">{numStreams}×</span>
            </div>
          )}
          {isImpossible && (
            <div className="px-1.5 sm:px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 whitespace-nowrap">
              <span className="font-mono text-[10px] sm:text-xs font-semibold text-red-400">IMPOSSIBLE</span>
            </div>
          )}
          {isNRINT && (
            <div className="px-1.5 sm:px-2 py-0.5 rounded bg-fuchsia-500/10 border border-fuchsia-500/30 whitespace-nowrap">
              <span className="font-mono text-[10px] sm:text-xs font-semibold text-fuchsia-400">NRINT</span>
            </div>
          )}
          {isTJN && (
            <div className="px-1.5 sm:px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 whitespace-nowrap">
              <span className="font-mono text-[10px] sm:text-xs font-semibold text-indigo-400">TJN</span>
            </div>
          )}
          {isCCT && (
            <div className="px-1.5 sm:px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/40 whitespace-nowrap">
              <span className="font-mono text-[10px] sm:text-xs font-semibold text-amber-400">CCT</span>
            </div>
          )}
          {explicitFeedback && (
            <div className="px-1.5 sm:px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 whitespace-nowrap">
              <span className="font-mono text-[10px] sm:text-xs font-semibold text-emerald-400">FB</span>
            </div>
          )}
        </div>

        {/* Right: Stats (Stream A counts) */}
        <div className="flex items-center gap-2 sm:gap-3 font-mono text-xs">
          <span className="text-emerald-400" title="Hits">H{hitsA}</span>
          <span className="text-amber-400" title="Misses">M{missesA}</span>
          <span className="text-red-400" title="False Alarms">FA{falseAlarmsA}</span>
          <span className="text-indigo-300" title="Targets so far (hits + misses)">T{targetCount}</span>
        </div>
      </div>
      {/* Progress bar — visible mostly on mobile to anchor where we are */}
      <div className="h-0.5 w-full bg-secondary/60 rounded-full overflow-hidden">
        <div className="h-full bg-primary/80 transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}

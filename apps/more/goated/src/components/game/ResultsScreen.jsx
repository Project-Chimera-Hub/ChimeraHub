import React from 'react';
import { Button } from '@/components/ui/button';
import { Brain, RotateCcw, ArrowLeft, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { calculateResults, computeNextNLevel } from '@/lib/gameEngine';
import { migrateCoachState, updateMastery, MASTERY_INTERVALS, phaseDisplayTitle, rankOf } from '@/lib/coachMastery';
import { getSessions } from '@/lib/localStorageManager';
import { COACH_PHASES } from '@/lib/gameConstants';

function StatBlock({ label, value, suffix = '', color = 'text-foreground' }) {
  return (
    <div className="text-center space-y-1">
      <div className={`text-2xl font-mono font-bold ${color}`}>{value}{suffix}</div>
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{label}</div>
    </div>
  );
}

function StreamResults({ title, stats, color = 'text-primary' }) {
  if (!stats) return null;
  return (
    <div className="space-y-2">
      <div className={`text-xs font-mono uppercase tracking-widest font-semibold ${color}`}>{title}</div>
      <div className="grid grid-cols-3 gap-3 bg-secondary/40 rounded-lg p-3 border border-border">
        <StatBlock label="Accuracy" value={stats.accuracy} suffix="%" color={stats.accuracy >= 75 ? 'text-emerald-400' : stats.accuracy >= 50 ? 'text-amber-400' : 'text-red-400'} />
        <StatBlock label="Hit Rate" value={stats.hitRate} suffix="%" color="text-emerald-400" />
        <StatBlock label="FA Rate" value={stats.falseAlarmRate} suffix="%" color="text-red-400" />
      </div>
      <div className="flex gap-4 text-xs font-mono text-muted-foreground justify-center">
        <span className="text-emerald-400">{stats.hits} hits</span>
        <span className="text-amber-400">{stats.misses} miss</span>
        <span className="text-red-400">{stats.falseAlarms} FA</span>
        <span className="text-primary">{stats.correctRejections} CR</span>
      </div>
    </div>
  );
}

// RST family breakdown — only meaningful when RST overlay ran AND the
// session pool included more than one family. Shows accuracy by family
// (Distinction / Comparison / Analogy) so the player can decide whether
// to bump difficulty or stay.
function RSTFamilyResults({ byFamily, difficulty }) {
  if (!byFamily) return null;
  const families = Object.keys(byFamily);
  if (families.length === 0) return null;
  const labels = { distinction: 'Distinction (XOR)', comparison: 'Comparison (order)', analogy: 'Analogy (4-place)' };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono uppercase tracking-widest font-semibold text-violet-400">RST by Family</div>
        <span className="text-[10px] font-mono text-violet-300/70 uppercase">{difficulty}</span>
      </div>
      <div className="space-y-1.5">
        {families.map(fam => {
          const s = byFamily[fam];
          const accColor = s.accuracy >= 75 ? 'text-emerald-400' : s.accuracy >= 50 ? 'text-amber-400' : 'text-red-400';
          return (
            <div key={fam} className="flex items-center gap-3 bg-secondary/40 rounded p-2 border border-border">
              <div className="text-xs font-mono text-foreground/85 flex-1">{labels[fam] || fam}</div>
              <div className={`text-sm font-mono font-bold ${accColor}`}>{s.accuracy}%</div>
              <div className="text-[10px] font-mono text-muted-foreground/70">{s.total} trials</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Lure-trial readout — only meaningful when there were any lure trials this
// session. Surfaces "lure resistance" (= 1 - FA rate on lures), the cleanest
// summary of how well the player isolated N from N-1/N+1.
function LureResults({ stats }) {
  if (!stats || stats.total === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-xs font-mono uppercase tracking-widest font-semibold text-fuchsia-400">Lure Resistance</div>
      <div className="grid grid-cols-3 gap-3 bg-secondary/40 rounded-lg p-3 border border-border">
        <StatBlock label="Resistance" value={stats.resistance} suffix="%" color={stats.resistance >= 75 ? 'text-emerald-400' : stats.resistance >= 50 ? 'text-amber-400' : 'text-red-400'} />
        <StatBlock label="Lure FAs" value={stats.lureFA} color="text-red-400" />
        <StatBlock label="Lure CRs" value={stats.lureCR} color="text-primary" />
      </div>
      <div className="text-[10px] font-mono text-muted-foreground/60 text-center">
        Lures look like targets at N±1 instead of N. Lower FA = sharper count.
      </div>
    </div>
  );
}

export default function ResultsScreen({ gameState, onRestart, onBack }) {
  const results = calculateResults(gameState);
  const nextN = computeNextNLevel(gameState.nLevel, results);
  const nChanged = nextN !== gameState.nLevel;

  const [selectedZone, setSelectedZone] = React.useState(null);
  const [transferText, setTransferText] = React.useState('');
  const [savedTransfer, setSavedTransfer] = React.useState(false);
  const [coachProgressionText, setCoachProgressionText] = React.useState('');
  const [phaseUpgradeState, setPhaseUpgradeState] = React.useState(null); // 'up', 'down', or null

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('goated_coach_state');
      let coach = saved ? JSON.parse(saved) : {};
      coach = migrateCoachState(coach);

      // Only mutate coach state when this was an autopilot run with enough trials.
      // Manual mode sessions don't move the mastery needle.
      const playedAutopilot = !!gameState.autopilot;
      const playedPhaseIndex = (gameState.coachPickedPhaseIndex != null)
        ? gameState.coachPickedPhaseIndex
        : coach.phaseIndex;
      const accuracy = results.overall.accuracy;

      if (playedAutopilot && results.overall.total >= 8) {
        const before = coach;
        const after = updateMastery(coach, playedPhaseIndex, accuracy, COACH_PHASES.length);
        const beforeM = before.phaseMastery?.[playedPhaseIndex];
        const afterM = after.phaseMastery[playedPhaseIndex];
        const beforeLvl = beforeM?.masteryLevel ?? 0;
        const afterLvl = afterM.masteryLevel;
        const beforeFrontier = before.phaseIndex || 0;
        const afterFrontier = after.phaseIndex || 0;

        if (afterFrontier > beforeFrontier) {
          setPhaseUpgradeState('up');
          setCoachProgressionText(`🚀 Phase ${rankOf(playedPhaseIndex) + 1} mastered (Lvl ${afterLvl}). Frontier advanced to ${phaseDisplayTitle(afterFrontier)}.`);
        } else if (afterLvl > beforeLvl) {
          setCoachProgressionText(`✓ Mastery Lvl ${afterLvl} on Phase ${playedPhaseIndex + 1}. Next review in ${MASTERY_INTERVALS[afterLvl]} sessions.`);
        } else if (afterLvl < beforeLvl) {
          setPhaseUpgradeState('down');
          setCoachProgressionText(`↓ Mastery slipped to Lvl ${afterLvl} on Phase ${playedPhaseIndex + 1}. Will resurface sooner.`);
        } else {
          setCoachProgressionText(`Hold pattern on Phase ${playedPhaseIndex + 1} (Lvl ${afterLvl}). Next review in ${Math.max(0, (afterM.nextReviewN || 0) - (after.sessionCount || 0))} sessions.`);
        }

        // Mirror current frontier's parameters onto coach for legacy display fields
        const p = COACH_PHASES[after.phaseIndex] || COACH_PHASES[0];
        after.nLevel = p.nLevel;
        after.speedMs = p.speedMs;
        after.rounds = p.rounds;

        // Rank still derived from frontier index (purely cosmetic)
        const ranks = [
          "Initiate (Rank I)",
          "Apprentice (Rank II)",
          "Specialist (Rank III)",
          "Elite Specialist (Rank IV)",
          "Quantum Operator (Rank V)",
          "GOATED Focus Master (Rank VI)"
        ];
        const step = Math.max(1, COACH_PHASES.length / ranks.length);
        const rankIdx = Math.min(ranks.length - 1, Math.floor((after.phaseIndex || 0) / step));
        after.rankName = ranks[rankIdx];

        localStorage.setItem('goated_coach_state', JSON.stringify(after));
      } else {
        // Non-autopilot or low-trial session: persist migration without scoring
        localStorage.setItem('goated_coach_state', JSON.stringify(coach));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const saveZoneCheckIn = (zone, accuracy, nLevel) => {
    try {
      const history = JSON.parse(localStorage.getItem('goated_zone_checkins') || '[]');
      history.push({
        timestamp: new Date().toISOString(),
        zone,
        accuracy,
        nLevel,
      });
      localStorage.setItem('goated_zone_checkins', JSON.stringify(history));
    } catch (e) {
      console.error(e);
    }
  };

  const saveTransferCard = (text, zone, accuracy, nLevel) => {
    try {
      const ledger = JSON.parse(localStorage.getItem('goated_transfer_ledger') || '[]');
      ledger.push({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        text,
        zone: zone || 'unknown',
        accuracy,
        nLevel,
      });
      localStorage.setItem('goated_transfer_ledger', JSON.stringify(ledger));
    } catch (e) {
      console.error(e);
    }
  };

  const getGrade = (acc) => {
    if (acc >= 90) return { label: 'Excellent', color: 'text-emerald-400' };
    if (acc >= 75) return { label: 'Good', color: 'text-primary' };
    if (acc >= 60) return { label: 'Fair', color: 'text-amber-400' };
    return { label: 'Needs Practice', color: 'text-red-400' };
  };

  const grade = getGrade(results.overall.accuracy);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center min-h-[100dvh] px-3 sm:px-4 py-5 sm:py-8"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-md w-full space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <Brain className="w-6 h-6 sm:w-7 sm:h-7 text-primary mx-auto mb-2" />
          <h2 className="text-xl sm:text-2xl font-mono font-bold text-foreground">Session Complete</h2>
          <p className="text-xs font-mono text-muted-foreground">
            N={gameState.nLevel} &middot; {results.overall.total} trials
            {gameState.modes?.length > 0 && <> &middot; {gameState.modes.join(', ')}</>}
          </p>
        </div>

        {gameState.autopilot && (
          <div className={`p-4 rounded-xl border font-mono text-center space-y-1.5 shadow-lg transition-all duration-300
            ${phaseUpgradeState === 'up' 
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-emerald-500/5' 
              : phaseUpgradeState === 'down' 
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-amber-500/5' 
                : 'bg-secondary/40 border-border/80 text-foreground'}`}
          >
            <div className="text-[10px] uppercase tracking-widest font-semibold text-primary/80 flex items-center justify-center gap-1.5">
              <Brain className="w-3.5 h-3.5 animate-pulse text-primary" /> Coach Autopilot Evaluation
            </div>
            <div className="text-xs font-bold text-fuchsia-400">
              {gameState.phaseTitle || "Curriculum Phase"}
            </div>
            {coachProgressionText && (
              <p className="text-[11px] font-semibold leading-relaxed mt-1 text-muted-foreground/90">
                {coachProgressionText}
              </p>
            )}
          </div>
        )}

        {/* Capacity credit earned this session — drawn from the session
            record that handleFinish just persisted. Shows g earned, training
            ΔIQ delta, and the probe outcome chip (when this session counted
            as a probe). */}
        {(() => {
          const sessions = getSessions();
          const justSaved = sessions[sessions.length - 1];
          if (!justSaved || (justSaved.gThisSession == null && justSaved.iqCreditThisSession == null)) return null;
          const g = Number(justSaved.gThisSession) || 0;
          const iq = Number(justSaved.iqCreditThisSession) || 0;
          const probeKind = justSaved.probeKind;
          const probeOutcome = justSaved.probeOutcome;
          const probeDelta = justSaved.probeDelta;
          const outcomeColor = probeOutcome === 'Hold'
            ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
            : probeOutcome === 'Partial'
              ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
              : 'bg-rose-500/20 border-rose-400/60 text-rose-200';
          return (
            <div className="rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/30 p-3 space-y-1.5 font-mono">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest text-fuchsia-300">Capacity credit</span>
                <span className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-300">+{g} <span className="text-muted-foreground/70 text-[10px]">g</span></span>
                  <span className={iq >= 0 ? 'text-cyan-300' : 'text-amber-300'}>
                    {iq >= 0 ? '+' : ''}{iq.toFixed(2)} <span className="text-muted-foreground/70 text-[10px]">ΔIQ</span>
                  </span>
                </span>
              </div>
              {probeKind && probeOutcome && (
                <div className="flex items-center justify-between gap-2 flex-wrap text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded border ${outcomeColor} uppercase tracking-wider font-bold`}>
                    {probeKind} probe · {probeOutcome}
                  </span>
                  <span className="text-muted-foreground/80">
                    {probeOutcome === 'Hold' && 'Accuracy held under changed conditions.'}
                    {probeOutcome === 'Partial' && `Small drop vs. baseline (Δ ${probeDelta}%).`}
                    {probeOutcome === 'Drop' && `Did not hold under switch (Δ ${probeDelta}%).`}
                  </span>
                </div>
              )}
              {!probeKind && (
                <div className="text-[10px] text-muted-foreground/70 italic">
                  No probe fired — same-config training. g grows on volume; ΔIQ updates only on probe wins.
                </div>
              )}
            </div>
          );
        })()}

        {/* Overall */}
        <div className="text-center py-4 border-y border-border">
          <div className={`text-4xl sm:text-5xl font-mono font-bold ${grade.color}`}>
            {results.overall.accuracy}%
          </div>
          <div className={`text-sm font-mono font-semibold mt-1 ${grade.color}`}>{grade.label}</div>
        </div>

        {/* Adaptive N hint */}
        {gameState.modes?.includes('adaptive') && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-xs
            ${nChanged ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            {nChanged
              ? `Adaptive: N will change to ${nextN} next session (${nextN > gameState.nLevel ? '↑ level up!' : '↓ easing back'})`
              : `Adaptive: N stays at ${gameState.nLevel} (keep going!)`}
          </div>
        )}

        {/* Metacognitive State Zone Assessment */}
        <div className="bg-secondary/20 rounded-xl p-4 border border-border/60 space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest font-semibold text-primary flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" /> Metacognitive Zone Check-in
          </div>
          <p className="text-[11px] font-mono text-muted-foreground leading-normal">
            Assess your arousal & attention state during this session to calibrate your zone:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'too_hot', label: 'Too Hot', desc: 'Overloaded, reactive, tense', cls: 'border-red-500/30 hover:bg-red-500/10 text-red-400 bg-red-500/5' },
              { id: 'in_band', label: 'In Band', desc: 'Flow, workable focus', cls: 'border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 bg-emerald-500/5' },
              { id: 'too_cold', label: 'Too Cold', desc: 'Flat, slow, fatigued', cls: 'border-blue-500/30 hover:bg-blue-500/10 text-blue-400 bg-blue-500/5' },
              { id: 'shaky', label: 'Shaky', desc: 'Volatile, distracted', cls: 'border-amber-500/30 hover:bg-amber-500/10 text-amber-400 bg-amber-500/5' },
            ].map(zone => (
              <button
                key={zone.id}
                onClick={() => {
                  setSelectedZone(zone.id);
                  saveZoneCheckIn(zone.id, results.overall.accuracy, gameState.nLevel);
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-lg border font-mono transition-all text-center group relative overflow-hidden ${
                  selectedZone === zone.id 
                    ? 'ring-2 ring-primary border-primary bg-primary/10' 
                    : zone.cls
                }`}
              >
                <span className="text-xs font-bold">{zone.label}</span>
                <span className="text-[9px] opacity-70 group-hover:opacity-100 transition-opacity mt-0.5">{zone.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Transfer Operator Far-Transfer Prompt */}
        <div className="bg-secondary/20 rounded-xl p-4 border border-border/60 space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest font-semibold text-fuchsia-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Transfer Operator Card
          </div>
          <p className="text-[11px] font-mono text-muted-foreground leading-normal">
            Crystallize this raw relational focus ($G_f$) into portable real-world cognitive transfer ($G_c$):
          </p>
          
          {savedTransfer ? (
            <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono text-xs text-center animate-pulse">
              ✓ Transfer operator logged in your Ledger!
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={transferText}
                onChange={e => setTransferText(e.target.value)}
                placeholder="E.g., I will apply this deep auditory relational tracking to isolate key requirements in my upcoming client sync today."
                className="w-full h-20 bg-background/50 border border-border rounded-lg p-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none"
              />
              <Button
                disabled={!transferText.trim()}
                onClick={() => {
                  saveTransferCard(transferText, selectedZone, results.overall.accuracy, gameState.nLevel);
                  setSavedTransfer(true);
                }}
                className="w-full font-mono text-xs py-1 h-8 bg-fuchsia-600 hover:bg-fuchsia-500 text-white disabled:opacity-50"
              >
                Log to Transfer Ledger
              </Button>
            </div>
          )}
        </div>

        {/* Per-stream results */}
        <div className="space-y-4">
          <StreamResults title="Stream A · Relation" stats={results.A} color="text-primary" />
          {results.positionA && <StreamResults title="Stream A · Position" stats={results.positionA} color="text-amber-400" />}
          {results.cctA && <StreamResults title="Stream A · CCT" stats={results.cctA} color="text-rose-400" />}
          {results.rstA && results.rstA.total > 0 && <StreamResults title="Stream A · RST (Reasoning)" stats={results.rstA} color="text-violet-400" />}
          {results.rstByFamily && <RSTFamilyResults byFamily={results.rstByFamily} difficulty={results.rstDifficulty} />}
          {results.luresA && <LureResults stats={results.luresA} />}
          {(results.extra || []).map((s, i) => (
            <React.Fragment key={i}>
              <StreamResults title={`Stream ${String.fromCharCode(66 + i)} · Relation`} stats={s} color={['text-accent','text-chart-3','text-chart-4','text-chart-5'][i] || 'text-accent'} />
              {(results.extraPosition || [])[i] && <StreamResults title={`Stream ${String.fromCharCode(66 + i)} · Position`} stats={(results.extraPosition || [])[i]} color="text-amber-400" />}
              {(results.extraCCT || [])[i] && <StreamResults title={`Stream ${String.fromCharCode(66 + i)} · CCT`} stats={(results.extraCCT || [])[i]} color="text-rose-400" />}
              {(results.extraRST || [])[i] && (results.extraRST || [])[i].total > 0 && <StreamResults title={`Stream ${String.fromCharCode(66 + i)} · RST (Reasoning)`} stats={(results.extraRST || [])[i]} color="text-violet-400" />}
              {(results.extraLures || [])[i] && <LureResults stats={(results.extraLures || [])[i]} />}
            </React.Fragment>
          ))}
          {results.C && <StreamResults title="Category (Hierarchical)" stats={results.C} color="text-chart-3" />}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" onClick={onBack} className="font-mono text-xs gap-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Menu
          </Button>
          <Button onClick={() => onRestart(nextN)} className="font-mono text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <RotateCcw className="w-3.5 h-3.5" /> Train Again
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
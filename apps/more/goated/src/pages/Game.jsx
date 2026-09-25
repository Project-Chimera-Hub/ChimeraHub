import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import StartScreen from '@/components/game/StartScreen';
import GameScreen from '@/components/game/GameScreen';
import ResultsScreen from '@/components/game/ResultsScreen';
import InstallAppButton from '@/components/InstallAppButton';
import ThemeToggle from '@/components/ThemeToggle';
import { calculateResults, computeNextNLevel } from '@/lib/gameEngine';
import { addSession, saveSettings, getSettings, getSessions } from '@/lib/localStorageManager';
import { computeSessionCredits } from '@/lib/farTransfer';
import { migrateCoachState } from '@/lib/coachMastery';
import { COACH_PHASES } from '@/lib/gameConstants';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Menu as MenuIcon, BookOpen, Activity, Sparkles, GraduationCap, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Evidence base, grouped by the app aspect each study supports. Every entry
// links to the paper (DOI / publisher). Kept honest: the WM→Gf transfer
// section includes the major skeptical meta-analysis, not just the positive one.
const STUDY_SECTIONS = [
  {
    heading: 'Working memory → fluid-intelligence transfer',
    note: 'The core n-back premise — and the honest debate around it.',
    studies: [
      { title: 'Improving fluid intelligence with training on working memory', cite: 'Jaeggi, Buschkuehl, Jonides & Perrig (2008) · PNAS', url: 'https://doi.org/10.1073/pnas.0801268105', impact: 'The landmark dual-n-back study: WM training improved Gf with a dose-response relationship. The paradigm this whole app builds on.' },
      { title: 'Improving fluid intelligence with training on working memory: a meta-analysis', cite: 'Au, Sheehan, Tsai, Duncan, Buschkuehl & Jaeggi (2015) · Psychonomic Bulletin & Review', url: 'https://doi.org/10.3758/s13423-014-0699-x', impact: 'Across active-control studies, n-back training showed a small but reliable Gf gain (~3-4 IQ points).' },
      { title: 'Hundred days of cognitive training enhance broad cognitive abilities', cite: 'Schmiedek, Lövdén & Lindenberger (2010) · Frontiers in Aging Neuroscience', url: 'https://doi.org/10.3389/fnagi.2010.00027', impact: 'Heavy multi-task WM training transferred broadly to reasoning and episodic memory — supports the multi-stream + multi-mode design.' },
      { title: 'Is working memory training effective? A meta-analytic review', cite: 'Melby-Lervåg & Hulme (2013) · Developmental Psychology', url: 'https://doi.org/10.1037/a0028228', impact: 'The skeptical counterweight: found mostly near-transfer and little durable far-transfer. Why this app measures change honestly (CI + reliable-change) instead of overclaiming.' },
    ],
  },
  {
    heading: 'Relational reasoning & the Gf bottleneck',
    note: 'Behind RINT, Analogy N-Back, RST and Insight.',
    studies: [
      { title: 'Separating cognitive capacity from knowledge: a new hypothesis', cite: 'Halford, Cowan & Andrews (2007) · Trends in Cognitive Sciences', url: 'https://doi.org/10.1016/j.tics.2007.04.001', impact: 'Relational complexity — how many relations you can bind at once (the 4-place limit) — is a core constraint of reasoning. The basis for the Analogy/RST tiers.' },
      { title: 'Rostrolateral prefrontal cortex involvement in relational integration during reasoning', cite: 'Christoff, Prabhakaran, Dorfman, et al. (2001) · NeuroImage', url: 'https://doi.org/10.1006/nimg.2001.0922', impact: 'Integrating multiple relations recruits rostrolateral PFC — the neural signature of the 4-place rung the Analogy and RST-Hard modes target.' },
    ],
  },
  {
    heading: 'Cognitive maps & Successor Representation',
    note: 'Behind Trajectory N-Back (SR) and Schema Transfer (TEM).',
    studies: [
      { title: 'The hippocampus as a predictive map', cite: 'Stachenfeld, Botvinick & Gershman (2017) · Nature Neuroscience', url: 'https://doi.org/10.1038/nn.4650', impact: 'Place cells encode a Successor Representation (expected future occupancy); grid cells are its eigenvectors. The model Trajectory N-Back trains directly.' },
      { title: 'What is a cognitive map? Organizing knowledge for flexible behavior', cite: 'Behrens, Muller, Whittington, et al. (2018) · Neuron', url: 'https://doi.org/10.1016/j.neuron.2018.10.002', impact: 'The hippocampal-entorhinal map generalizes beyond space to abstract relational structure — the rationale for schema-based training.' },
      { title: 'The Tolman-Eichenbaum Machine: unifying space and relational memory', cite: 'Whittington, Muller, Mark, et al. (2020) · Cell', url: 'https://doi.org/10.1016/j.cell.2020.10.024', impact: 'Formal model of how the same machinery learns reusable schemas across environments — the basis for the Schema Transfer (TEM) mode.' },
      { title: 'Inferences on a multidimensional social hierarchy use a grid-like code', cite: 'Park, Miller & Boorman (2021) · Nature Neuroscience', url: 'https://doi.org/10.1038/s41593-021-00916-3', impact: 'The same map code organizes non-spatial (social) structure — evidence the predictive-map system is general-purpose.' },
    ],
  },
  {
    heading: 'Selective attention & distractor control',
    note: 'Behind the Decoy stream and the lure/distractor modes.',
    studies: [
      { title: 'Working memory capacity as executive attention', cite: 'Engle (2002) · Current Directions in Psychological Science', url: 'https://doi.org/10.1111/1467-8721.00160', impact: 'High-WM individuals are precisely those who filter irrelevant input best — the construct the Decoy (ignore-this-stream) mode trains.' },
      { title: 'Neural measures reveal individual differences in controlling access to working memory', cite: 'Vogel, McCollough & Machizawa (2005) · Nature', url: 'https://doi.org/10.1038/nature04171', impact: 'Efficiency of WM is largely about keeping distractors OUT, not raw capacity — direct support for distractor-inhibition training.' },
    ],
  },
  {
    heading: 'Spaced repetition & retrieval practice',
    note: 'Behind the Coach mastery scheduler (Leitner intervals).',
    studies: [
      { title: 'Test-enhanced learning: taking memory tests improves long-term retention', cite: 'Roediger & Karpicke (2006) · Psychological Science', url: 'https://doi.org/10.1111/j.1467-9280.2006.01693.x', impact: 'Spaced retrieval beats massed practice for durable learning — the principle behind the Coach revisiting mastered phases on expanding intervals.' },
      { title: 'Distributed practice in verbal recall tasks: a review and quantitative synthesis', cite: 'Cepeda, Pashler, Vul, Wixted & Rohrer (2006) · Psychological Bulletin', url: 'https://doi.org/10.1037/0033-2909.132.3.354', impact: 'Quantifies the spacing effect across hundreds of studies — basis for the Leitner 1·2·5·11·25·60 schedule.' },
    ],
  },
  {
    heading: 'Measuring reasoning (the Reasoning Index)',
    note: 'Behind the pre/post assessment.',
    studies: [
      { title: "The Raven's Progressive Matrices: change and stability over culture and time", cite: 'Raven (2000) · Cognitive Psychology', url: 'https://doi.org/10.1006/cogp.1999.0735', impact: 'Matrix reasoning is the most g-loaded single measure — why the Reasoning Index is matrix-based.' },
      { title: "Recreating Raven's: software for generating Raven-like matrices with normed properties", cite: 'Matzen, Benz, Dixon, et al. (2010) · Behavior Research Methods', url: 'https://doi.org/10.3758/BRM.42.2.525', impact: 'The free, public, normed Sandia Matrices — the actual item bank the Reasoning Index uses.' },
      { title: 'The International Cognitive Ability Resource (ICAR): a public-domain measure', cite: 'Condon & Revelle (2014) · Intelligence', url: 'https://doi.org/10.1016/j.intell.2014.01.004', impact: 'Open, normed reasoning items (~0.8 with full IQ) — anchored the reliability model.' },
      { title: 'Clinical significance: a statistical approach (Reliable Change Index)', cite: 'Jacobson & Truax (1991) · J. Consulting & Clinical Psychology', url: 'https://doi.org/10.1037/0022-006X.59.1.12', impact: 'The RCI the assessment uses to decide whether a pre→post change exceeds measurement error.' },
    ],
  },
  {
    heading: 'Neuroplasticity from training',
    studies: [
      { title: 'Changes in cortical dopamine D1 receptor binding associated with cognitive training', cite: 'McNab, Varrone, Farde, et al. (2009) · Science', url: 'https://doi.org/10.1126/science.1166102', impact: 'WM training physically changed prefrontal/parietal dopamine D1 binding — neurochemical plasticity, not just practice.' },
      { title: 'Dynamic reconfiguration of functional brain networks during working memory training', cite: 'Finc, Bonna, He, et al. (2020) · Nature Communications', url: 'https://doi.org/10.1038/s41467-020-15631-z', impact: 'Training reorganized frontoparietal connectivity toward greater efficiency (lower neural cost).' },
    ],
  },
];

export default function Game() {
  const [screen, setScreen] = useState('start');
  const [nLevel, setNLevel] = useState(2);
  const [modes, setModes] = useState([]);
  const [relationshipPool, setRelationshipPool] = useState(null);
  const [finalState, setFinalState] = useState(null);
  const [suggestedN, setSuggestedN] = useState(null);
  const [rounds, setRounds] = useState(20);
  const [speedMs, setSpeedMs] = useState(2800);
  const [extraStreams, setExtraStreams] = useState([]);
  const [streamA, setStreamA] = useState({ key: 'Space', keyDisplay: 'SPACE', positionKey: 'KeyP', positionKeyDisplay: 'P' });
  const [alienSettings, setAlienSettings] = useState({ cubeDirection: 'cw', cubeSpeed: 1, cubeSpeedMode: 'fixed', squareDirection: 'cw', squareSpeed: 1, squareSpeedMode: 'fixed' });
  const [carouselSettings, setCarouselSettings] = useState({ enabled: true, streamsPerSlide: 'auto', slideMs: 2800 });
  const [nrintEnabledFlags, setNrintEnabledFlags] = useState(null);
  const [nrintHideLegend, setNrintHideLegend] = useState(false);
  const [nrintMaxPerTrial, setNrintMaxPerTrial] = useState(0);
  const [nrintMatchRule, setNrintMatchRule] = useState('union');
  // Weights object — Grapist follow-up: multiple rules can be enabled with
  // per-rule weighting controlling per-trial sampling frequency. Single-rule
  // mode is the special case of one weight > 0.
  const [nrintMatchRuleWeights, setNrintMatchRuleWeights] = useState({ union: 1, intersection: 0, xor: 0, implication: 0, biconditional: 0 });
  const [decoyFilterRule, setDecoyFilterRule] = useState('never_target');
  const [decoyFilterRandom, setDecoyFilterRandom] = useState(true);
  const [decoyFilterCategories, setDecoyFilterCategories] = useState([]);
  const [rstDifficulty, setRstDifficulty] = useState('easy');
  const [tjnTier, setTjnTier] = useState('easy');
  const [tjnTopology, setTjnTopology] = useState('small_world');
  const [tjnNodes, setTjnNodes] = useState(6);
  const [tjnK, setTjnK] = useState(2);
  const [tjnSchemaMode, setTjnSchemaMode] = useState(false);
  const [tjnSchemaBlocks, setTjnSchemaBlocks] = useState(3);
  const [noobMode, setNoobMode] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
  const [phaseTitle, setPhaseTitle] = useState('');
  const [coachPickedPhaseIndex, setCoachPickedPhaseIndex] = useState(null);
  const [coachPickReason, setCoachPickReason] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [gameRunId, setGameRunId] = useState(0);
  const [showStudies, setShowStudies] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Persisted settings restored on mount
  const [lastSettings, setLastSettings] = useState(() => {
    try {
      const settings = getSettings();
      return settings.lastGame || null;
    } catch {
      return null;
    }
  });

  const handleStart = (n, selectedModes, poolRels, totalRounds, stimulusMs, extraSettings, noob) => {
    setNLevel(n);
    setModes(selectedModes);
    setRelationshipPool(poolRels && poolRels.length > 0 ? poolRels : null);
    setRounds(totalRounds || 20);
    setSpeedMs(stimulusMs || 2800);
    setExtraStreams(extraSettings?.extraStreams || []);
    setStreamA(extraSettings?.streamA || { key: 'Space', keyDisplay: 'SPACE', positionKey: 'KeyP', positionKeyDisplay: 'P' });
    setAlienSettings(extraSettings?.alienSettings || { cubeDirection: 'cw', cubeSpeed: 1, cubeSpeedMode: 'fixed', squareDirection: 'cw', squareSpeed: 1, squareSpeedMode: 'fixed' });
    setCarouselSettings({ enabled: true, streamsPerSlide: 'auto', slideMs: 2800, ...(extraSettings?.carouselSettings || {}) });
    setNrintEnabledFlags(extraSettings?.nrintEnabledFlags || null);
    setNrintHideLegend(!!extraSettings?.nrintHideLegend);
    setNrintMaxPerTrial(Number(extraSettings?.nrintMaxPerTrial) || 0);
    setNrintMatchRule(extraSettings?.nrintMatchRule || 'union');
    setNrintMatchRuleWeights(extraSettings?.nrintMatchRuleWeights || (extraSettings?.nrintMatchRule ? { union: 0, intersection: 0, xor: 0, implication: 0, biconditional: 0, [extraSettings.nrintMatchRule]: 1 } : { union: 1, intersection: 0, xor: 0, implication: 0, biconditional: 0 }));
    setDecoyFilterRule(extraSettings?.decoyFilterRule || 'never_target');
    setDecoyFilterRandom(extraSettings?.decoyFilterRandom !== false);
    setDecoyFilterCategories(Array.isArray(extraSettings?.decoyFilterCategories) ? extraSettings.decoyFilterCategories : []);
    setRstDifficulty(extraSettings?.rstDifficulty || 'easy');
    setTjnTier(extraSettings?.tjnTier || 'easy');
    setTjnTopology(extraSettings?.tjnTopology || 'small_world');
    setTjnNodes(extraSettings?.tjnNodes || 6);
    setTjnK(extraSettings?.tjnK || 2);
    setTjnSchemaMode(!!extraSettings?.tjnSchemaMode);
    setTjnSchemaBlocks(extraSettings?.tjnSchemaBlocks || 3);
    setNoobMode(noob || false);
    setAutopilot(!!extraSettings?.autopilot);
    setPhaseTitle(extraSettings?.phaseTitle || '');
    // Mastery scheduler attribution — which phase this session is being scored against
    setCoachPickedPhaseIndex(extraSettings?.coachPickedPhaseIndex ?? null);
    setCoachPickReason(extraSettings?.coachPickReason || null);
    setStartTime(Date.now());
    setGameRunId(id => id + 1);

    const settings = {
      lastGame: {
        n, modes: selectedModes,
        rels: extraSettings?.rels || poolRels,
        rounds: totalRounds || 20,
        speedMs: stimulusMs || 2800,
        catWeights: extraSettings?.catWeights,
        useCustomMix: extraSettings?.useCustomMix,
        tokenWeights: extraSettings?.tokenWeights,
        extraStreams: extraSettings?.extraStreams || [],
        streamA: extraSettings?.streamA || { key: 'Space', keyDisplay: 'SPACE', positionKey: 'KeyP', positionKeyDisplay: 'P' },
        alienSettings: extraSettings?.alienSettings,
        carouselSettings: { enabled: true, streamsPerSlide: 'auto', slideMs: 2800, ...(extraSettings?.carouselSettings || {}) },
        nrintEnabledFlags: extraSettings?.nrintEnabledFlags || null,
        nrintHideLegend: !!extraSettings?.nrintHideLegend,
        nrintMaxPerTrial: Number(extraSettings?.nrintMaxPerTrial) || 0,
        nrintMatchRule: extraSettings?.nrintMatchRule || 'union',
        nrintMatchRuleWeights: extraSettings?.nrintMatchRuleWeights || undefined,
        decoyFilterRule: extraSettings?.decoyFilterRule || 'never_target',
        decoyFilterRandom: extraSettings?.decoyFilterRandom !== false,
        decoyFilterCategories: Array.isArray(extraSettings?.decoyFilterCategories) ? extraSettings.decoyFilterCategories : [],
        rstDifficulty: extraSettings?.rstDifficulty || 'easy',
        tjnTier: extraSettings?.tjnTier || 'easy',
        tjnTopology: extraSettings?.tjnTopology || 'small_world',
        tjnNodes: extraSettings?.tjnNodes || 6,
        tjnK: extraSettings?.tjnK || 2,
        tjnSchemaMode: !!extraSettings?.tjnSchemaMode,
        tjnSchemaBlocks: extraSettings?.tjnSchemaBlocks || 3,
        noobMode: noob || false,
      }
    };
    saveSettings(settings);
    setLastSettings(settings.lastGame);
    setScreen('playing');
  };

  const handleFinish = (state) => {
    const results = calculateResults(state);
    const durationSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    
    const synaesthesia = localStorage.getItem('goated_synaesthesia_enabled') === 'true';
    
    // Save session to localStorage
    const sessionData = {
      nLevel: state.nLevel,
      modes: state.modes,
      synaesthesia,
      totalTrials: state.round,
      accuracy: results.overall.accuracy,
      hitRate: results.overall.hitRate,
      falseAlarmRate: results.overall.falseAlarmRate,
      hitsA: results.A.hits,
      missesA: results.A.misses,
      falseAlarmsA: results.A.falseAlarms,
      correctRejectionsA: results.A.correctRejections,
      extraStreamStats: results.extra || [],
      positionStatsA: results.positionA,
      extraPositionStats: results.extraPosition || [],
      durationSeconds,
      noobMode,
      autopilot: !!state.autopilot,
      // Whether a decoy filter was active (type-based selective attention),
      // for the Stats "Selective Attention" with/without comparison.
      decoyFilterActive: (state.modes || []).includes('decoy_filter'),
      // Tag the active NRINT match rule(s) when NRINT was on, so Stats can
      // break accuracy down per rule. With multi-rule + weights, the session
      // carries the full weights object; the legacy single-rule string is
      // kept too for older Stats code paths.
      nrintMatchRule: (state.modes || []).includes('nonverbal_rint') ? (state.nrintMatchRule || 'union') : null,
      nrintMatchRuleWeights: (state.modes || []).includes('nonverbal_rint') ? (state.nrintMatchRuleWeights || null) : null,
      phaseTitle: state.phaseTitle || '',
      coachPickedPhaseIndex,
      coachPickReason,
      trials: state.allTrials || [] // trials saved during gameplay
    };
    // Capacity Credits — compute g + probe outcome + training Δ-IQ for this
    // session against the user's prior history + Coach mastery state. Pure
    // function; persisted onto the session record so later reads avoid
    // recomputation cost and the probe history is stable.
    try {
      const priorSessions = getSessions();
      const coachStateRaw = localStorage.getItem('goated_coach_state');
      const coachState = migrateCoachState(coachStateRaw ? JSON.parse(coachStateRaw) : null);
      const credits = computeSessionCredits(sessionData, priorSessions, coachState, COACH_PHASES);
      sessionData.gThisSession = credits.g;
      sessionData.iqCreditThisSession = credits.iqCredit;
      sessionData.probeKind = credits.probe.kind;
      sessionData.probeOutcome = credits.probe.outcome;
      sessionData.probeDelta = credits.probe.delta;
      sessionData.probeBaselineAcc = credits.probe.baselineAcc;
      sessionData.probeBaselineSource = credits.probe.baselineSource;
    } catch (_) { /* never block session persistence on credits compute */ }
    addSession(sessionData);

    setFinalState(state);
    if (state.modes?.includes('adaptive')) {
      const nextN = computeNextNLevel(state.nLevel, results);
      setSuggestedN(nextN);
    } else {
      setSuggestedN(null);
    }
    setScreen('results');
  };

  const handleRestart = (nextN) => {
    setFinalState(null);
    if (modes.includes('adaptive') && nextN) setNLevel(nextN);
    setStartTime(Date.now());
    setGameRunId(id => id + 1);
    setScreen('playing');
  };

  const handleBack = () => {
    setFinalState(null);
    setScreen('start');
  };

  return (
    <div className="min-h-screen bg-background relative isolate">
      {screen === 'start' && (
        <>
          {/* Copyright-free relational lattice backdrop. Generated by
              scripts/generate-bg.mjs from a fixed seed; sits behind every
              StartScreen control at low opacity. Mounted only on the start
              screen — gameplay/results screens stay clean. */}
          <div
            aria-hidden="true"
            className="fixed inset-0 -z-10 bg-no-repeat bg-center bg-cover pointer-events-none opacity-0 dark:opacity-75 text-foreground/80"
            style={{ backgroundImage: 'url(./assets/start-bg.svg)' }}
          />
          <StartScreen onStart={handleStart} suggestedN={suggestedN} lastSettings={lastSettings} />
        </>
      )}
      {screen === 'playing' && (
        <GameScreen
          key={gameRunId}
          nLevel={nLevel}
          modes={modes}
          relationshipPool={relationshipPool}
          totalRounds={rounds}
          stimulusDuration={speedMs}
          extraStreams={extraStreams}
          streamA={streamA}
          alienSettings={alienSettings}
          carouselSettings={carouselSettings}
          nrintEnabledFlags={nrintEnabledFlags}
          nrintHideLegend={nrintHideLegend}
          nrintMaxPerTrial={nrintMaxPerTrial}
          nrintMatchRule={nrintMatchRule}
          nrintMatchRuleWeights={nrintMatchRuleWeights}
          decoyFilterRule={decoyFilterRule}
          decoyFilterRandom={decoyFilterRandom}
          decoyFilterCategories={decoyFilterCategories}
          rstDifficulty={rstDifficulty}
          tjnTier={tjnTier}
          tjnTopology={tjnTopology}
          tjnNodes={tjnNodes}
          tjnK={tjnK}
          tjnSchemaMode={tjnSchemaMode}
          tjnSchemaBlocks={tjnSchemaBlocks}
          noobMode={noobMode}
          autopilot={autopilot}
          phaseTitle={phaseTitle}
          coachPickedPhaseIndex={coachPickedPhaseIndex}
          coachPickReason={coachPickReason}
          onFinish={handleFinish}
          onExit={handleBack}
        />

      )}
      {screen === 'results' && finalState && (
        <ResultsScreen
          gameState={finalState}
          onRestart={handleRestart}
          onBack={handleBack}
        />
      )}
      {/* Top nav — collapsed into a single Menu (≡) to reduce clutter (sokuichi feedback).
          ThemeToggle + InstallAppButton stay inline; everything else lives in the dropdown. */}
      <div className="fixed top-3 right-3 z-30 flex gap-2 justify-end" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
        {screen === 'start' && (
          <>
            <ThemeToggle />
            <InstallAppButton />
            <div className="relative">
              <button
                onClick={() => setShowMenu(v => !v)}
                aria-label="Open menu"
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-secondary border border-border text-foreground hover:border-muted-foreground/60 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
              >
                <MenuIcon className="w-3.5 h-3.5" /> Menu
              </button>
              {showMenu && (
                <>
                  {/* Click-outside backdrop */}
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 mt-2 w-52 rounded-lg bg-card border border-border shadow-2xl z-40 overflow-hidden font-mono">
                    <button
                      onClick={() => { setShowMenu(false); setShowStudies(true); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-secondary/50 flex items-center gap-2 text-emerald-400"
                    >
                      <BookOpen className="w-3.5 h-3.5" /> Studies
                    </button>
                    <Link to="/assessment" onClick={() => setShowMenu(false)} className="block px-3 py-2 text-xs hover:bg-secondary/50 flex items-center gap-2 text-cyan-400">
                      <Brain className="w-3.5 h-3.5" /> Snapshot (Reasoning Index)
                    </Link>
                    <Link to="/insight" onClick={() => setShowMenu(false)} className="block px-3 py-2 text-xs hover:bg-secondary/50 flex items-center gap-2 text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" /> Insight
                    </Link>
                    <Link to="/tutorial" onClick={() => setShowMenu(false)} className="block px-3 py-2 text-xs hover:bg-secondary/50 flex items-center gap-2 text-accent">
                      <GraduationCap className="w-3.5 h-3.5" /> Tutorial
                    </Link>
                    <Link to="/stats" onClick={() => setShowMenu(false)} className="block px-3 py-2 text-xs hover:bg-secondary/50 flex items-center gap-2 text-chart-3">
                      <Activity className="w-3.5 h-3.5" /> Stats
                    </Link>
                    <a
                      href="https://github.com/sponsors/find-1-bug"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowMenu(false)}
                      className="block px-3 py-2 text-xs hover:bg-secondary/50 flex items-center gap-2 text-rose-400 border-t border-border/60"
                    >
                      <Heart className="w-3.5 h-3.5 animate-pulse" /> Donate
                    </a>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {showStudies && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-border/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-emerald-400 animate-pulse animate-duration-3000" />
                  <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-foreground">Working Memory &amp; Transfer Studies</h3>
                </div>
                <button
                  onClick={() => setShowStudies(false)}
                  className="text-xs font-mono text-muted-foreground hover:text-foreground border border-border px-2 py-1 rounded bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  ESC
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-4 overflow-y-auto space-y-4 font-mono text-xs text-foreground/90 scrollbar-thin">
                <div className="text-[11px] text-muted-foreground leading-relaxed border-b border-border/40 pb-3">
                  The peer-reviewed evidence behind each part of this trainer, grouped by what it supports. Every entry links to the paper. The transfer debate is presented honestly — the skeptical meta-analysis is included, not hidden.
                </div>

                {STUDY_SECTIONS.map((section) => (
                  <div key={section.heading} className="space-y-2 text-left">
                    <div className="border-t border-border/40 pt-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-cyan-400">{section.heading}</span>
                      {section.note && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{section.note}</p>}
                    </div>
                    {section.studies.map((s) => (
                      <a key={s.title} href={s.url} target="_blank" rel="noreferrer"
                        className="block p-3 bg-secondary/30 rounded-lg border border-border/60 space-y-1 hover:border-cyan-400/60 transition-colors">
                        <div className="text-emerald-400 font-bold text-[12px] leading-snug">{s.title}</div>
                        <div className="text-[11px] text-muted-foreground font-semibold">{s.cite}</div>
                        <p className="text-[11px] text-foreground/75 leading-relaxed">{s.impact}</p>
                        <div className="text-[10px] text-cyan-400/80 underline">{s.url.replace('https://doi.org/', 'doi:')}</div>
                      </a>
                    ))}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border/80 shrink-0 bg-secondary/20 flex justify-end">
                <Button
                  onClick={() => setShowStudies(false)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs"
                >
                  Got It
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
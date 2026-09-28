import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameCanvas from './GameCanvas';
import GameHUD from './GameHUD';
import {
  createGameState,
  generateNextStimulus,
  processResponses,
  advanceRound,
  NRINT_MATCH_RULE_META,
} from '@/lib/gameEngine';
import {
  WIPE_DURATION,
  FEEDBACK_DURATION,
  isSound,
  getAssetUrl,
} from '@/lib/gameConstants';
import {
  playSoundStimulus,
  playNRINTAudioCue, playNRINTPitchHighCue,
  playNRINTLoudCue, playNRINTLongCue, playNRINTRhythmicCue, playNRINTWarmCue,
} from '@/lib/audioRelationships';

function StreamModeBadge({ mode, alwaysShow }) {
  if (!mode) return null;
  const cfg = {
    normal:       { label: 'NRM',  cls: 'bg-secondary border-border text-muted-foreground' },
    type:         { label: 'TYPE', cls: 'bg-chart-4/10 border-chart-4/30 text-chart-4' },
    rint:         { label: 'RINT', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
    hierarchical: { label: 'HIER', cls: 'bg-violet-500/10 border-violet-500/30 text-violet-400' },
  }[mode];
  if (!cfg) return null;
  if (mode === 'normal' && !alwaysShow) return null;
  return (
    <span className={`px-1 py-0.5 rounded border font-mono text-xs font-semibold leading-none ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const STREAM_COLORS = ['text-primary', 'text-accent', 'text-chart-3', 'text-chart-4', 'text-chart-5', 'text-primary', 'text-accent', 'text-chart-3', 'text-chart-4'];
const STREAM_BORDER_COLORS = ['border-border', 'border-accent/20', 'border-chart-3/20', 'border-chart-4/20', 'border-chart-5/20', 'border-border', 'border-accent/20', 'border-chart-3/20', 'border-chart-4/20'];
const STREAM_DOT_COLORS = ['bg-primary/60', 'bg-accent/60', 'bg-chart-3/60', 'bg-chart-4/60', 'bg-chart-5/60', 'bg-primary/60', 'bg-accent/60', 'bg-chart-3/60', 'bg-chart-4/60'];
const STREAM_LABELS = Array.from({ length: 20 }, (_, i) => String.fromCharCode(65 + i));
// Short category labels for the decoy-filter "Ignore:" reminder chip.
const CATEGORY_SHORT = {
  SPATIAL: 'Spatial', SPATIAL_3D: '3D', TRAIT: 'Trait', QUANT: 'Quant',
  VERBAL: 'Verbal', SOUND: 'Sound', COMPLEX: 'Complex',
};

function getRecordedResponses(progressState, round, streamCount) {
  const records = (progressState?.allTrials || []).filter(trial => trial.trialNumber === round);
  const respondedA = records.find(trial => trial.streamLabel === 'A' && (trial.responseType || 'relation') === 'relation')?.userResponded || false;
  const positionRespondedA = records.find(trial => trial.streamLabel === 'A' && trial.responseType === 'position')?.userResponded || false;
  const extraResponded = Array(Math.max(0, streamCount - 1)).fill(false);
  const extraPositionResponded = Array(Math.max(0, streamCount - 1)).fill(false);

  records.forEach(trial => {
    const index = (trial.streamLabel || '').charCodeAt(0) - 66;
    if (index >= 0 && index < extraResponded.length) {
      if (trial.responseType === 'position') extraPositionResponded[index] = !!trial.userResponded;
      else extraResponded[index] = !!trial.userResponded;
    }
  });

  return { respondedA, positionRespondedA, extraResponded, extraPositionResponded };
}

function makeHistoricalSnapshot(state) {
  return {
    ...structuredClone(state),
    respondedA: false,
    extraResponded: Array(state.numExtraStreams || 0).fill(false),
    positionRespondedA: false,
    extraPositionResponded: Array(state.numExtraStreams || 0).fill(false),
    hitsA: 0,
    missesA: 0,
    falseAlarmsA: 0,
    correctRejectionsA: 0,
    positionHitsA: 0,
    positionMissesA: 0,
    positionFalseAlarmsA: 0,
    positionCorrectRejectionsA: 0,
    extraHits: Array(state.numExtraStreams || 0).fill(0),
    extraMisses: Array(state.numExtraStreams || 0).fill(0),
    extraFalseAlarms: Array(state.numExtraStreams || 0).fill(0),
    extraCorrectRejections: Array(state.numExtraStreams || 0).fill(0),
    extraPositionHits: Array(state.numExtraStreams || 0).fill(0),
    extraPositionMisses: Array(state.numExtraStreams || 0).fill(0),
    extraPositionFalseAlarms: Array(state.numExtraStreams || 0).fill(0),
    extraPositionCorrectRejections: Array(state.numExtraStreams || 0).fill(0),
    scoredTrialKeys: [],
    allTrials: [],
  };
}

function mergeHistoricalWithProgress(historicalState, progressState, streamCount) {
  const historical = structuredClone(historicalState);
  if (!progressState) return historical;
  const recordedResponses = getRecordedResponses(progressState, historical.round, streamCount);
  return {
    ...historical,
    respondedA: recordedResponses.respondedA,
    positionRespondedA: recordedResponses.positionRespondedA,
    extraResponded: recordedResponses.extraResponded,
    extraPositionResponded: recordedResponses.extraPositionResponded,
    hitsA: progressState.hitsA,
    missesA: progressState.missesA,
    falseAlarmsA: progressState.falseAlarmsA,
    correctRejectionsA: progressState.correctRejectionsA,
    positionHitsA: progressState.positionHitsA,
    positionMissesA: progressState.positionMissesA,
    positionFalseAlarmsA: progressState.positionFalseAlarmsA,
    positionCorrectRejectionsA: progressState.positionCorrectRejectionsA,
    extraHits: progressState.extraHits || [],
    extraMisses: progressState.extraMisses || [],
    extraFalseAlarms: progressState.extraFalseAlarms || [],
    extraCorrectRejections: progressState.extraCorrectRejections || [],
    extraPositionHits: progressState.extraPositionHits || [],
    extraPositionMisses: progressState.extraPositionMisses || [],
    extraPositionFalseAlarms: progressState.extraPositionFalseAlarms || [],
    extraPositionCorrectRejections: progressState.extraPositionCorrectRejections || [],
    scoredTrialKeys: progressState.scoredTrialKeys || [],
    allTrials: progressState.allTrials || [],
  };
}

export default function GameScreen({ nLevel, modes, relationshipPool, totalRounds, stimulusDuration, extraStreams, streamA, alienSettings, carouselSettings, nrintEnabledFlags, nrintHideLegend, nrintMaxPerTrial = 0, nrintMatchRule = 'union', nrintMatchRuleWeights = null, decoyFilterRule = 'never_target', decoyFilterRandom = true, decoyFilterCategories = [], rstDifficulty = 'easy', tjnTier = 'easy', tjnTopology = 'small_world', tjnNodes = 6, tjnK = 2, tjnSchemaMode = false, tjnSchemaBlocks = 3, noobMode, autopilot, phaseTitle, coachPickedPhaseIndex = null, coachPickReason = null, onFinish, onExit }) {
  // extraStreams: [{ key, label, keyDisplay, positionKey, positionKeyDisplay }]
  const getStimulusDuration = useCallback(() => {
    if (modes.includes('adaptive_closed_loop') && gameStateRef.current?.adaptiveSpeedMs) {
      return gameStateRef.current.adaptiveSpeedMs;
    }
    const duration = stimulusDuration === 'random' ? 1000 + Math.random() * 3000 : stimulusDuration || 2800;
    let d = modes.includes('alien_cube') || modes.includes('alien_tesseract') ? Math.max(1400, duration) : duration;
    // Heavy RST trial (Hard / analogy): extend SOA by 60% so the player can
    // actually read the pair-vs-pair claim. Reading load on analogy is ~2x
    // distinction; SOA bump keeps adherence sustainable.
    if (gameStateRef.current?.currentStimulusA?._rst?.heavy) {
      d = Math.round(d * 1.6);
    }
    return d;
  }, [stimulusDuration, modes]);
  const hasAlienPosition = modes.includes('alien_cube') || modes.includes('alien_tesseract') || modes.includes('alien_square');
  const hasCCTOverlay = modes.includes('cct_overlay');
  const hasRSTOverlay = modes.includes('rst_overlay');
  const allStreams = [
    {
      key: streamA?.key || 'Space', keyDisplay: streamA?.keyDisplay || 'SPACE',
      positionKey: streamA?.positionKey || 'KeyP', positionKeyDisplay: streamA?.positionKeyDisplay || 'P',
      cctKey: streamA?.cctKey || 'KeyM', cctKeyDisplay: streamA?.cctKeyDisplay || 'M',
      rstKey: streamA?.rstKey || 'KeyR', rstKeyDisplay: streamA?.rstKeyDisplay || 'R',
      streamType: streamA?.streamType || 'relation',
      label: 'A',
    },
    ...(extraStreams || []).map((stream) => ({
      ...stream,
      positionKey: stream.positionKey || stream.key,
      positionKeyDisplay: stream.positionKeyDisplay || stream.keyDisplay,
      cctKey: stream.cctKey || 'KeyM',
      cctKeyDisplay: stream.cctKeyDisplay || 'M',
      streamType: stream.streamType || 'relation',
      label: String.fromCharCode(66 + (extraStreams || []).indexOf(stream)),
    })),
  ];
  const numExtra = (extraStreams || []).length;

  const [gameState, setGameState] = useState(() => {
    const state = createGameState({ nLevel, modes, relationshipPool, totalRounds, extraStreams: extraStreams || [], alienSettings, streamA, nrintEnabledFlags, nrintHideLegend, nrintMaxPerTrial, nrintMatchRule, nrintMatchRuleWeights, decoyFilterRule, decoyFilterRandom, decoyFilterCategories, rstDifficulty, tjnTier, tjnTopology, tjnNodes, tjnK, tjnSchemaMode, tjnSchemaBlocks, initialSpeedMs: stimulusDuration === 'random' ? 2800 : (stimulusDuration || 2800) });
    state.autopilot = autopilot;
    state.phaseTitle = phaseTitle;
    state.coachPickedPhaseIndex = coachPickedPhaseIndex;
    state.coachPickReason = coachPickReason;
    return state;
  });
  const [phase, setPhase] = useState('stimulus');
  const [clearCanvas, setClearCanvas] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const [shouldShake, setShouldShake] = useState(false);
  const [shouldGlitch, setShouldGlitch] = useState(false);
  const [responsesUnlocked, setResponsesUnlocked] = useState(true);
  // Store full game state after each generated trial, indexed by round number.

  // One response ref per stream (index 0 = stream A, 1..N = extra streams)
  const respondedRefs = useRef(allStreams.map(() => false));
  const positionRespondedRefs = useRef(allStreams.map(() => false));
  const cctRespondedRefs = useRef(allStreams.map(() => false));
  const rstRespondedRefs = useRef(allStreams.map(() => false));
  const phaseTimerRef = useRef([]);
  const gameStateRef = useRef(gameState);
  const phaseRef = useRef(phase);
  const progressStateRef = useRef(gameState);
  const trialStatesRef = useRef([]);
  const navigationLockRef = useRef(false);
  const hasFinishedRef = useRef(false);
  const hasStartedRef = useRef(false);

  const clearPhaseTimers = useCallback(() => {
    phaseTimerRef.current.forEach(timer => clearTimeout(timer));
    phaseTimerRef.current = [];
  }, []);

  const scheduleTimer = useCallback((callback, delay) => {
    const timer = setTimeout(callback, delay);
    phaseTimerRef.current.push(timer);
    return timer;
  }, []);

  const getCarouselCapacity = useCallback(() => {
    if (!carouselSettings?.enabled) return allStreams.length;
    if (carouselSettings.streamsPerSlide !== 'auto') return Math.max(1, Number(carouselSettings.streamsPerSlide) || allStreams.length);
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 800;
    const reservedHeight = width < 768 ? 240 : 160;
    const minStreamWidth = width < 768 ? 170 : 320;
    const minStreamHeight = width < 768 ? 280 : 340;
    const cols = width < 768 ? 1 : Math.max(1, Math.floor((width - 24) / minStreamWidth));
    const rows = Math.max(1, Math.floor((height - reservedHeight) / minStreamHeight));
    return Math.max(1, cols * rows);
  }, [carouselSettings, allStreams.length]);

  const finishGame = useCallback((finalState) => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    clearPhaseTimers();
    onFinish(finalState);
  }, [onFinish, clearPhaseTimers]);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const startRound = useCallback((currentState, historicalState = null) => {
    const nextState = historicalState || (() => {
      const stimulus = generateNextStimulus(currentState);
      return advanceRound(currentState, stimulus);
    })();
    
    clearPhaseTimers();
    setGameState(nextState);
    respondedRefs.current = allStreams.map(() => false);
    positionRespondedRefs.current = allStreams.map(() => false);
    cctRespondedRefs.current = allStreams.map(() => false);
    rstRespondedRefs.current = allStreams.map(() => false);
    setClearCanvas(false);
    setActiveSlide(0);
    setResponsesUnlocked(false);
    setPhase('stimulus');
    setTimerKey(prev => prev + 1);

    if (modes.includes('stress_shake') && Math.random() < 0.35) {
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
    }
    if (modes.includes('stress_glitch') && Math.random() < 0.25) {
      setShouldGlitch(true);
      setTimeout(() => setShouldGlitch(false), 600);
    }
    
    // Store this state for later playback (only if new trial, not from history)
    // Store indexed by round number for easy lookup during prev/next
    if (!historicalState && noobMode) {
      const updated = Array.isArray(trialStatesRef.current) ? [...trialStatesRef.current] : [];
      updated[nextState.round] = makeHistoricalSnapshot(nextState);
      trialStatesRef.current = updated;
    }
    
    const slideCount = Math.ceil(allStreams.length / getCarouselCapacity());
    const duration = getStimulusDuration();
    const carouselActive = carouselSettings?.enabled && slideCount > 1;
    const slideDuration = carouselActive ? Math.max(1200, carouselSettings?.slideMs || 2800) : 0;
    const responseWindow = carouselActive ? Math.max(1000, duration) : 0;
    const totalWatchTime = carouselActive ? slideDuration * slideCount : duration;

    if (!carouselActive) {
      setResponsesUnlocked(true);
    } else {
      setResponsesUnlocked(false);
      for (let i = 1; i < slideCount; i += 1) {
        scheduleTimer(() => setActiveSlide(i), slideDuration * i);
      }
      scheduleTimer(() => setResponsesUnlocked(true), totalWatchTime);
    }

    // In noob mode, don't auto-advance — wait for user to click Next
    if (!noobMode) {
      scheduleTimer(() => endStimulus(nextState), totalWatchTime + responseWindow);
    }
  }, [noobMode, getStimulusDuration, getCarouselCapacity, scheduleTimer, allStreams.length]);

  const explicitFeedback = modes.includes('feedback_per_trial');
  const feedbackDuration = explicitFeedback ? 1600 : FEEDBACK_DURATION;
  const endStimulus = useCallback((currentState) => {
    if (noobMode) {
      // In noob mode, stimulus stays visible, just wait for user action
      setPhase('feedback');
      return;
    }

    // With explicit feedback, keep the stimulus on-screen during the verdict
    // overlay so the player can connect "what I saw" to "right or wrong".
    if (!explicitFeedback) setClearCanvas(true);
    setPhase(explicitFeedback ? 'feedback_wait' : 'wipe');
    const processDelay = explicitFeedback ? 0 : WIPE_DURATION;
    scheduleTimer(() => {
      const state = gameStateRef.current;
      const pressedA = respondedRefs.current[0];
      const pressedExtra = respondedRefs.current.slice(1);
      const pressedPositionA = positionRespondedRefs.current[0];
      const pressedPositionExtra = positionRespondedRefs.current.slice(1);
      const pressedCCTA = cctRespondedRefs.current[0];
      const pressedCCTExtra = cctRespondedRefs.current.slice(1);
      const pressedRSTA = rstRespondedRefs.current[0];
      const pressedRSTExtra = rstRespondedRefs.current.slice(1);

      const updatedState = processResponses(state, { pressedA, pressedExtra, pressedPositionA, pressedPositionExtra, pressedCCTA, pressedCCTExtra, pressedRSTA, pressedRSTExtra });
      progressStateRef.current = updatedState;
      setGameState(updatedState);
      setPhase('feedback');

      scheduleTimer(() => {
        if (explicitFeedback) setClearCanvas(true);
        if (updatedState.round >= updatedState.totalRounds) {
          finishGame(updatedState);
        } else {
          // small wipe gap before the next round when explicit feedback is on
          scheduleTimer(() => startRound(updatedState), explicitFeedback ? WIPE_DURATION : 0);
        }
      }, feedbackDuration);
    }, processDelay);
  }, [finishGame, startRound, noobMode, scheduleTimer, explicitFeedback, feedbackDuration]);

  const handleNextTrial = useCallback(() => {
    // In noob mode, can advance from stimulus phase; otherwise only from feedback
    if (noobMode && phaseRef.current !== 'stimulus') return;
    if (!noobMode && phaseRef.current !== 'feedback') return;
    if (navigationLockRef.current) return;
    navigationLockRef.current = true;
    const unlockNavigation = () => requestAnimationFrame(() => { navigationLockRef.current = false; });
    
    const state = gameStateRef.current;
    const pressedA = respondedRefs.current[0];
    const pressedExtra = respondedRefs.current.slice(1);
    const pressedPositionA = positionRespondedRefs.current[0];
    const pressedPositionExtra = positionRespondedRefs.current.slice(1);
    const pressedCCTA = cctRespondedRefs.current[0];
    const pressedCCTExtra = cctRespondedRefs.current.slice(1);
    const pressedRSTA = rstRespondedRefs.current[0];
    const pressedRSTExtra = rstRespondedRefs.current.slice(1);

    if (noobMode) {
      const alreadyScored = (progressStateRef.current?.scoredTrialKeys || []).includes(state.round);
      const progressState = alreadyScored
        ? progressStateRef.current
        : processResponses(state, { pressedA, pressedExtra, pressedPositionA, pressedPositionExtra, pressedCCTA, pressedCCTExtra, pressedRSTA, pressedRSTExtra });

      progressStateRef.current = progressState;

      if (state.round >= state.totalRounds) {
        finishGame(progressState);
        return;
      }

      const nextRound = state.round + 1;
      const savedNextState = trialStatesRef.current?.[nextRound];
      if (savedNextState) {
        const restoredState = mergeHistoricalWithProgress(savedNextState, progressState, allStreams.length);
        setGameState(restoredState);
        respondedRefs.current = [restoredState.respondedA, ...(restoredState.extraResponded || [])];
        positionRespondedRefs.current = [restoredState.positionRespondedA, ...(restoredState.extraPositionResponded || [])];
        cctRespondedRefs.current = [restoredState.cctRespondedA, ...(restoredState.extraCCTResponded || [])];
        rstRespondedRefs.current = [restoredState.rstRespondedA, ...(restoredState.extraRSTResponded || [])];
        setClearCanvas(false);
        setPhase('stimulus');
      } else {
        startRound(progressState);
      }
      unlockNavigation();
      return;
    }

    const updatedState = processResponses(state, { pressedA, pressedExtra, pressedPositionA, pressedPositionExtra, pressedCCTA, pressedCCTExtra, pressedRSTA, pressedRSTExtra });
    progressStateRef.current = updatedState;

    if (updatedState.round >= updatedState.totalRounds) {
      finishGame(updatedState);
    } else {
      startRound(updatedState);
      unlockNavigation();
    }
  }, [noobMode, finishGame, startRound, allStreams.length]);

  const handlePrevTrial = useCallback(() => {
    const currentRound = gameStateRef.current?.round ?? 0;
    if (currentRound <= 1) return;
    const historicalState = trialStatesRef.current?.[currentRound - 1];
    if (historicalState) {
      const restoredState = mergeHistoricalWithProgress(historicalState, progressStateRef.current, allStreams.length);
      setGameState(restoredState);
      respondedRefs.current = [restoredState.respondedA, ...(restoredState.extraResponded || [])];
      positionRespondedRefs.current = [restoredState.positionRespondedA, ...(restoredState.extraPositionResponded || [])];
      cctRespondedRefs.current = [restoredState.cctRespondedA, ...(restoredState.extraCCTResponded || [])];
      rstRespondedRefs.current = [restoredState.rstRespondedA, ...(restoredState.extraRSTResponded || [])];
      setClearCanvas(false);
      setPhase('stimulus');
    }
  }, [allStreams.length]);

  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startRound(gameState);
    }
    return clearPhaseTimers;
  }, []);

  const markResponse = useCallback((idx, type = 'relation') => {
    if (!(phaseRef.current === 'stimulus')) return;
    if (!responsesUnlocked) return;
    if (noobMode && (progressStateRef.current?.scoredTrialKeys || []).includes(gameStateRef.current?.round)) return;
    if (type === 'rst') {
      if (rstRespondedRefs.current[idx]) return;
      rstRespondedRefs.current[idx] = true;
      if (idx === 0) {
        setGameState(prev => ({ ...prev, rstRespondedA: true }));
      } else {
        setGameState(prev => {
          const next = [...(prev.extraRSTResponded || [])];
          next[idx - 1] = true;
          return { ...prev, extraRSTResponded: next };
        });
      }
      return;
    }
    const refs = type === 'position' ? positionRespondedRefs
               : type === 'cct' ? cctRespondedRefs
               : respondedRefs;
    if (refs.current[idx]) return;
    refs.current[idx] = true;
    if (idx === 0) {
      setGameState(prev => (
        type === 'position' ? { ...prev, positionRespondedA: true }
        : type === 'cct' ? { ...prev, cctRespondedA: true }
        : { ...prev, respondedA: true }
      ));
    } else {
      setGameState(prev => {
        const key = type === 'position' ? 'extraPositionResponded'
                  : type === 'cct' ? 'extraCCTResponded'
                  : 'extraResponded';
        const next = [...(prev[key] || [])];
        next[idx - 1] = true;
        return { ...prev, [key]: next };
      });
    }
  }, [noobMode, responsesUnlocked]);

  // Keyboard controls — dynamic per stream key
  useEffect(() => {
    const handleKey = (e) => {
      if (phase !== 'stimulus') return;
      if (noobMode && (progressStateRef.current?.scoredTrialKeys || []).includes(gameStateRef.current?.round)) return;
      allStreams.forEach((stream, idx) => {
        if (e.code === stream.key) {
          e.preventDefault();
          markResponse(idx, 'relation');
        }
        if (hasAlienPosition && e.code === stream.positionKey) {
          e.preventDefault();
          markResponse(idx, 'position');
        }
        if (hasCCTOverlay && stream.streamType !== 'cct' && e.code === stream.cctKey) {
          e.preventDefault();
          markResponse(idx, 'cct');
        }
      });
      if (hasRSTOverlay) {
        allStreams.forEach((stream, idx) => {
          if (e.code === (stream.rstKey || 'KeyR')) {
            e.preventDefault();
            markResponse(idx, 'rst');
          }
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, markResponse, hasAlienPosition, hasCCTOverlay, hasRSTOverlay]);

  // Get current stimulus & rel for each stream (A + extras)
  const allTrialModes = [gameState.trialMode, ...(gameState.extraTrialModes || [])];
  const allTrialBinaryConfigs = gameState.trialBinaryConfigs || [];
  const isBinaryLogic = modes.includes('binary_logic');
  const streamStimuli = [
    {
      rel: gameState.currentRelationship,
      stimulus: gameState.currentStimulusA,
      responded: gameState.respondedA,
      positionResponded: gameState.positionRespondedA,
      cctResponded: gameState.cctRespondedA,
      rstResponded: gameState.rstRespondedA,
    },
    ...(gameState.extraCurrentRels || []).map((rel, i) => ({
      rel,
      stimulus: (gameState.extraCurrentStimuli || [])[i],
      responded: (gameState.extraResponded || [])[i],
      positionResponded: (gameState.extraPositionResponded || [])[i],
      cctResponded: (gameState.extraCCTResponded || [])[i],
      rstResponded: (gameState.extraRSTResponded || [])[i],
    })),
  ];
  const audioStreamIndexes = gameState.audioStreamIndexes || [];
  const audioEarForIndex = (idx) => {
    if (!isSound(streamStimuli[idx]?.rel)) return null;
    const audioIndex = audioStreamIndexes.indexOf(idx);
    if (audioIndex === -1) return null;
    return audioIndex === 0 ? 'L' : 'R';
  };

  React.useEffect(() => {
    if (phase !== 'stimulus' || clearCanvas) return;
    const allAudible = [
      { rel: gameState.currentRelationship, stimulus: gameState.currentStimulusA, index: 0 },
      ...(gameState.extraCurrentRels || []).map((rel, i) => ({
        rel,
        stimulus: (gameState.extraCurrentStimuli || [])[i],
        index: i + 1,
      })),
    ];

    const selected = (gameState.audioStreamIndexes?.length
      ? gameState.audioStreamIndexes.map(index => allAudible.find(item => item.index === index)).filter(Boolean)
      : allAudible.filter(item => isSound(item.rel)).slice(0, 1)
    ).filter(item => isSound(item.rel));

    selected.slice(0, 2).forEach((item, i) => {
      const pan = selected.length === 1 ? 0 : i === 0 ? -0.85 : 0.85;
      const delaySeconds = selected.length === 2 && i === 1 ? 0.32 : 0;
      playSoundStimulus(item.stimulus, pan, delaySeconds);
    });

    // NRINT audio-modality cues — separate from the sound-rel dispatch
    // above because NRINT stims have rel === 'NRINT_COMPOSITE' (isSound is
    // false) and the audio cues are per-trial flags inside stim.attrs.
    // Each flag plays its own distinct cue; both can fire on the same trial.
    const nrintCueItems = allAudible.filter(item => item.stimulus?.rel === 'NRINT_COMPOSITE');
    nrintCueItems.forEach((item, i) => {
      const pan = nrintCueItems.length === 1 ? 0 : (i % 2 === 0 ? -0.6 : 0.6);
      if (item.stimulus?.attrs?.audio) playNRINTAudioCue(pan);
      if (item.stimulus?.attrs?.pitch_high) playNRINTPitchHighCue(pan);
      if (item.stimulus?.attrs?.audio_loud) playNRINTLoudCue(pan);
      if (item.stimulus?.attrs?.audio_long) playNRINTLongCue(pan);
      if (item.stimulus?.attrs?.audio_rhythmic) playNRINTRhythmicCue(pan);
      if (item.stimulus?.attrs?.audio_warm) playNRINTWarmCue(pan);
    });
  }, [phase, clearCanvas, gameState.round, gameState.audioStreamIndexes, gameState.currentRelationship, gameState.currentStimulusA, gameState.extraCurrentRels, gameState.extraCurrentStimuli]);

  const numStreams = streamStimuli.length;
  const streamsPerSlide = getCarouselCapacity();
  const slideCount = Math.ceil(numStreams / streamsPerSlide);
  const isCarouselActive = carouselSettings?.enabled && slideCount > 1;
  const visibleStart = isCarouselActive ? activeSlide * streamsPerSlide : 0;
  const visibleStimuli = streamStimuli.slice(visibleStart, visibleStart + streamsPerSlide);
  const visibleStreams = allStreams.slice(visibleStart, visibleStart + streamsPerSlide);
  const visibleCount = visibleStimuli.length;
  const mobileCols = 1;
  const desktopCols = visibleCount === 1 ? 1
    : visibleCount === 2 ? 2
    : visibleCount === 3 ? 3
    : visibleCount === 4 ? 2
    : visibleCount <= 6 ? 3
    : visibleCount <= 8 ? 4
    : Math.ceil(Math.sqrt(visibleCount));

  return (
    <div className={`flex flex-col min-h-[100dvh] h-[100dvh] overflow-hidden px-2 sm:px-3 py-2 sm:py-3 select-none ${shouldShake ? 'animate-shake' : ''} ${shouldGlitch ? 'animate-glitch' : ''}`} style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      <style>{`
        @keyframes screen-shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          10% { transform: translate(-2px, -1px) rotate(-0.5deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(0px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          75% { transform: translate(2px, 1px) rotate(-0.5deg); }
          90% { transform: translate(-1px, -2px) rotate(1deg); }
        }
        @keyframes visual-glitch {
          0%, 100% { filter: hue-rotate(0deg) saturate(1); transform: scale(1); }
          10% { filter: hue-rotate(30deg) saturate(1.4); transform: skewX(0.5deg); }
          25% { filter: hue-rotate(-20deg) saturate(1.2); }
          45% { filter: hue-rotate(60deg) saturate(1.6); transform: skewX(-0.5deg); }
          60% { filter: hue-rotate(0deg) saturate(1); }
        }
        @keyframes timer-countdown {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-shake {
          animation: screen-shake 0.3s ease-in-out infinite;
        }
        .animate-glitch {
          animation: visual-glitch 0.4s ease-in-out infinite;
        }
      `}</style>

      {/* Dynamic Closed Loop Alert */}
      {modes.includes('adaptive_closed_loop') && gameState.adaptiveMessage && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="px-4 py-2 rounded-full border border-primary/30 bg-background/90 backdrop-blur-md shadow-lg shadow-primary/20 text-primary font-mono text-xs font-semibold animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            {gameState.adaptiveMessage}
            <span className="text-[10px] text-muted-foreground opacity-80">
              ({gameState.adaptiveSpeedMs}ms)
            </span>
          </div>
        </div>
      )}

      {/* Timer Panic Heatbar */}
      {modes.includes('timer_panic') && phase === 'stimulus' && (
        <div className="w-full h-1 bg-secondary/20 relative overflow-hidden shrink-0 mb-2 rounded-full border border-border/10">
          <div 
            key={timerKey}
            className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 animate-[timer-countdown_linear_forwards]"
            style={{
              animationDuration: `${getStimulusDuration()}ms`
            }}
          />
        </div>
      )}

      {/* HUD */}
      <div className="w-full flex items-center gap-2 mb-2 shrink-0">
        <div className="flex-1 min-w-0">
          <GameHUD
            round={gameState.round}
            totalRounds={gameState.totalRounds}
            nLevel={gameState.nLevel}
            effectiveN={gameState.currentEffectiveN}
            hitsA={gameState.hitsA}
            missesA={gameState.missesA}
            falseAlarmsA={gameState.falseAlarmsA}
            correctRejectionsA={gameState.correctRejectionsA}
            modes={modes}
            numStreams={allStreams.length}
          />
        </div>
        {onExit && (
          <button onClick={onExit}
            aria-label="Exit"
            className="shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors">
            Exit
          </button>
        )}
      </div>

      {/* Stream canvases — fill remaining vertical space */}
      <div
        className="flex-1 min-h-0 grid gap-2 overflow-y-auto md:overflow-hidden [grid-template-columns:var(--mobile-grid-cols)] md:[grid-template-columns:var(--desktop-grid-cols)] auto-rows-[minmax(240px,1fr)] md:auto-rows-[minmax(0,1fr)]"
        style={{
          '--mobile-grid-cols': `repeat(${mobileCols}, 1fr)`,
          '--desktop-grid-cols': `repeat(${desktopCols}, 1fr)`,
        }}
      >
        {visibleStimuli.map((s, localIdx) => {
          const idx = visibleStart + localIdx;
          const rintChain = gameState.rintStates?.[idx]?.chainLog;
          const showRintChain = phase === 'stimulus' && allTrialModes[idx] === 'rint' && rintChain?.length > 0;
          const theme = s.stimulus?._activeTheme;
          return (
            <div 
              key={idx} 
              className={`relative rounded-xl flex flex-col overflow-hidden transition-[box-shadow,border-color] duration-150 ${
                theme
                  ? theme.className
                  : (audioEarForIndex(idx)
                      ? 'bg-emerald-500/10 border-emerald-400 shadow-[0_0_28px_rgba(52,211,153,0.28)] border-2'
                      : (s.responded || s.positionResponded || s.cctResponded) && phase === 'stimulus'
                        ? 'bg-secondary/30 border-primary/80 shadow-[0_0_32px_rgba(43,227,198,0.40)] border-2'
                        : `bg-secondary/30 ${STREAM_BORDER_COLORS[idx % STREAM_BORDER_COLORS.length]} border-2`)
              }`}
              style={s.stimulus?._backgroundImage ? {
                backgroundImage: `url(${getAssetUrl(s.stimulus._backgroundImage)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : undefined}
            >
              {s.stimulus?._backgroundImage && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] pointer-events-none z-0" />
              )}
              <div className="flex-1 min-h-0 relative z-10">
                <GameCanvas
                relationship={!clearCanvas ? s.rel : null}
                stimulus={s.stimulus}
                clearCanvas={clearCanvas}
                rintChain={gameState.rintStates?.[idx]?.chainLog}
                streamCount={numStreams}
                />
                <div className="absolute top-2 left-3 flex items-center gap-1 flex-wrap max-w-[90%]">
                  <span className={`text-xs font-mono uppercase tracking-widest ${STREAM_COLORS[idx % STREAM_COLORS.length]} opacity-70 shrink-0`}>
                    {STREAM_LABELS[idx]}
                  </span>
                  {isBinaryLogic ? (() => {
                    const bc = allTrialBinaryConfigs[idx];
                    if (!bc) return null;
                    return (
                      <>
                        <StreamModeBadge mode={bc.primaryMode} alwaysShow />
                        <span className="text-muted-foreground/40 font-mono text-xs leading-none">{(bc.binaryOp || 'AND').replace('_', ' ')}</span>
                        <StreamModeBadge mode={bc.binaryMode} alwaysShow />
                      </>
                    );
                  })() : (
                    <StreamModeBadge mode={allTrialModes[idx]} />
                  )}
                  {/* Per-stream NRINT rule chip — surfaces the rule the
                      engine sampled for THIS stream THIS trial. Each NRINT
                      stream samples its own rule from the configured
                      weights, so when multiple streams + multi-rule weights
                      are active each block can show a different rule. */}
                  {s.stimulus?._nrintMatchRule && (
                    <span
                      className="px-1.5 py-0.5 rounded border border-fuchsia-500/60 bg-fuchsia-500/15 text-fuchsia-200 font-mono text-[10px] font-bold uppercase tracking-wider leading-none"
                      title={`NRINT rule on this trial: ${NRINT_MATCH_RULE_META[s.stimulus._nrintMatchRule]?.label || s.stimulus._nrintMatchRule}`}
                    >
                      {NRINT_MATCH_RULE_META[s.stimulus._nrintMatchRule]?.label?.toUpperCase() || s.stimulus._nrintMatchRule.toUpperCase()}
                    </span>
                  )}
                  {/* Decoy Filter — per-stream "ignore these categories" reminder. */}
                  {(gameState.streamDecoyCats?.[idx]?.length > 0) && (
                    <span className="px-1.5 py-0.5 rounded border border-amber-500/60 bg-amber-500/15 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider leading-none">
                      Ignore: {gameState.streamDecoyCats[idx].map(c => (CATEGORY_SHORT[c] || c)).join(' · ')}
                    </span>
                  )}
                </div>
                {audioEarForIndex(idx) && phase === 'stimulus' && !clearCanvas && (
                  <div className="absolute top-2 right-3 pointer-events-none w-8 h-8 rounded-full bg-emerald-400/25 border border-emerald-300/70 flex items-center justify-center text-sm font-mono font-bold text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.35)]">
                    {audioEarForIndex(idx)}
                  </div>
                )}
                {/* CCT side-task banner — visible whenever the engine
                    attached a CCT layer to this stream's stim. Sits at the
                    top-center of the card with large, contrasted digits so
                    the player can scan it without dragging eyes off the
                    relation visual underneath. */}
                {hasCCTOverlay && allStreams[idx]?.streamType !== 'cct' && phase === 'stimulus' && !clearCanvas && s.stimulus?.cctNumber != null && (
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-background/85 backdrop-blur-sm border-2 border-rose-400/70 shadow-[0_0_28px_rgba(251,113,133,0.45)] font-mono z-10 whitespace-nowrap">
                    <span className="text-[10px] sm:text-xs text-rose-300 uppercase tracking-widest font-bold">CCT</span>
                    <span className="font-bold text-cyan-300 text-2xl sm:text-3xl leading-none drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]">{s.stimulus.cctNumber}</span>
                    {s.stimulus.cctResult != null ? (
                      <>
                        <span className="text-rose-300 text-sm sm:text-base font-bold leading-none">+N≟</span>
                        <span className="font-bold text-amber-300 text-2xl sm:text-3xl leading-none drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">{s.stimulus.cctResult}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/70 text-xs sm:text-sm italic ml-0.5">observe</span>
                    )}
                  </div>
                )}
                {/* RST top banner — mirrors the CCT banner. Stream A only.
                    One premise per trial; from trial N onwards a candidate
                    conclusion is also shown. Player presses R if valid.
                    For Hard / Analogy family the layout shifts to compare
                    the current pair against the N-back pair directly. */}
                {hasRSTOverlay && phase === 'stimulus' && !clearCanvas && s.stimulus?._rst && (
                  <div className={`absolute ${hasCCTOverlay && s.stimulus?.cctNumber != null ? 'top-14' : 'top-1.5'} left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-background/85 backdrop-blur-sm border-2 border-violet-400/70 shadow-[0_0_28px_rgba(167,139,250,0.45)] font-mono z-10 whitespace-nowrap`}>
                    <span className="text-[10px] sm:text-xs text-violet-300 uppercase tracking-widest font-bold">
                      RST{s.stimulus._rst.family && s.stimulus._rst.family !== 'distinction' ? ` · ${s.stimulus._rst.family.toUpperCase()}` : ''}
                    </span>
                    {/* Premise line — current pair / chain step */}
                    {s.stimulus._rst.premise?.b ? (
                      <span className="font-bold text-cyan-300 text-base sm:text-lg leading-none drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]">
                        {s.stimulus._rst.premise.a}
                        <span className="text-violet-200 mx-1 text-sm sm:text-base">{s.stimulus._rst.premise.rel}</span>
                        {s.stimulus._rst.premise.b}
                      </span>
                    ) : (
                      <span className="font-bold text-cyan-300 text-base sm:text-lg leading-none drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]">
                        {s.stimulus._rst.premise?.a}
                      </span>
                    )}
                    {/* Conclusion / claim */}
                    {s.stimulus._rst.hasConclusion ? (
                      s.stimulus._rst.family === 'meta_relation' ? (
                        // Meta-relation: boolean combination of TWO analogy claims
                        // "(current :: N-back) [AND / OR / AND¬ / IFF] (current :: (N-1)-back)"
                        (() => {
                          const c = s.stimulus._rst.conclusion;
                          const formLabel = (form, firstDom) => firstDom
                            ? (form === 'temporal' ? 'after' : form === 'magnitude' ? 'heavier' : form === 'hierarchy' ? 'above' : 'more')
                            : (form === 'temporal' ? 'before' : form === 'magnitude' ? 'lighter' : form === 'hierarchy' ? 'below' : 'less');
                          return (
                            <>
                              <span className="text-rose-300 text-sm sm:text-base font-bold leading-none">::</span>
                              <span className="font-bold text-amber-300 text-sm sm:text-base leading-none drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
                                {c.claimA.tgtA}
                                <span className="text-violet-200/80 mx-0.5 text-xs italic">{formLabel(c.claimA.tgtFamily, c.claimA.tgtFirstDominant)}</span>
                                {c.claimA.tgtB}
                              </span>
                              {c.claimB ? (
                                <>
                                  <span className="text-rose-300 text-base sm:text-lg font-bold leading-none px-0.5">{c.connectiveSym}</span>
                                  <span className="font-bold text-amber-300 text-sm sm:text-base leading-none drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
                                    ({c.claimB.tgtA}<span className="text-violet-200/80 mx-0.5 text-xs italic">{formLabel(c.claimB.tgtFamily, c.claimB.tgtFirstDominant)}</span>{c.claimB.tgtB})
                                  </span>
                                </>
                              ) : null}
                              <span className="text-rose-300 text-xs sm:text-sm italic">valid?</span>
                            </>
                          );
                        })()
                      ) : s.stimulus._rst.family === 'analogy' ? (
                        // Analogy: show "current pair :: N-back pair?"
                        <>
                          <span className="text-violet-300 text-sm sm:text-base font-bold leading-none">::</span>
                          <span className="font-bold text-amber-300 text-base sm:text-lg leading-none drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
                            {s.stimulus._rst.conclusion.tgtA}
                            <span className="text-violet-200/80 mx-1 text-xs sm:text-sm italic">
                              {s.stimulus._rst.conclusion.tgtFirstDominant
                                ? (s.stimulus._rst.conclusion.tgtFamily === 'temporal' ? 'after'
                                  : s.stimulus._rst.conclusion.tgtFamily === 'magnitude' ? 'heavier'
                                  : s.stimulus._rst.conclusion.tgtFamily === 'hierarchy' ? 'above'
                                  : 'more')
                                : (s.stimulus._rst.conclusion.tgtFamily === 'temporal' ? 'before'
                                  : s.stimulus._rst.conclusion.tgtFamily === 'magnitude' ? 'lighter'
                                  : s.stimulus._rst.conclusion.tgtFamily === 'hierarchy' ? 'below'
                                  : 'less')}
                            </span>
                            {s.stimulus._rst.conclusion.tgtB}
                          </span>
                          <span className="text-violet-300 text-xs sm:text-sm italic">analogous?</span>
                        </>
                      ) : (
                        // Distinction / Comparison: show "X rel Y?" candidate conclusion
                        <>
                          <span className="text-violet-300 text-sm sm:text-base font-bold leading-none">∴≟</span>
                          <span className="font-bold text-amber-300 text-base sm:text-lg leading-none drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
                            {s.stimulus._rst.conclusion.a}
                            <span className="text-violet-200 mx-1 text-sm sm:text-base">{s.stimulus._rst.conclusion.rel}</span>
                            {s.stimulus._rst.conclusion.b}
                          </span>
                        </>
                      )
                    ) : (
                      <span className="text-muted-foreground/70 text-xs sm:text-sm italic ml-0.5">observe</span>
                    )}
                  </div>
                )}
                {(s.responded || s.positionResponded || s.cctResponded || s.rstResponded) && phase === 'stimulus' && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-20 pointer-events-none flex-wrap justify-center max-w-[95%]">
                    {s.responded && (
                      <div className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold tracking-wider bg-primary/25 border border-primary shadow-[0_0_22px_rgba(43,227,198,0.55)] flex items-center gap-1">
                        <span className="text-primary">✓</span>
                        <span className="text-primary">{STREAM_LABELS[idx]} REL</span>
                      </div>
                    )}
                    {s.positionResponded && (
                      <div className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold tracking-wider bg-amber-500/25 border border-amber-400 shadow-[0_0_22px_rgba(251,191,36,0.55)] flex items-center gap-1">
                        <span className="text-amber-300">✓</span>
                        <span className="text-amber-300">{STREAM_LABELS[idx]} POS</span>
                      </div>
                    )}
                    {s.cctResponded && (
                      <div className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold tracking-wider bg-rose-500/25 border border-rose-400 shadow-[0_0_22px_rgba(251,113,133,0.55)] flex items-center gap-1">
                        <span className="text-rose-300">✓</span>
                        <span className="text-rose-300">{STREAM_LABELS[idx]} CCT</span>
                      </div>
                    )}
                    {s.rstResponded && (
                      <div className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold tracking-wider bg-violet-500/25 border border-violet-400 shadow-[0_0_22px_rgba(167,139,250,0.55)] flex items-center gap-1">
                        <span className="text-violet-300">✓</span>
                        <span className="text-violet-300">{STREAM_LABELS[idx]} RST</span>
                      </div>
                    )}
                  </div>
                )}
                {phase === 'wipe' && (
                  <div className="absolute inset-0 bg-background/90 rounded-xl flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse" />
                  </div>
                )}
                {explicitFeedback && phase === 'feedback' && (() => {
                  // Per-stream relation verdict + diagnostic hint (Bjork "desirable
                  // difficulty" framing: when wrong, point at the dimension that
                  // got misjudged without naming the answer — preserve discovery).
                  const records = (progressStateRef.current?.allTrials || [])
                    .filter(t => t.trialNumber === gameState.round && t.streamLabel === STREAM_LABELS[idx]);
                  const rel = records.find(t => (t.responseType || 'relation') === 'relation');
                  const pos = records.find(t => t.responseType === 'position');
                  const cct = records.find(t => t.responseType === 'cct');
                  const rst = records.find(t => t.responseType === 'rst');
                  const verdict = (rec) => {
                    if (!rec) return null;
                    if (rec.isTarget && rec.userResponded) return { tag: 'HIT', cls: 'text-emerald-300 bg-emerald-500/20 border-emerald-400/60' };
                    if (rec.isTarget && !rec.userResponded) return { tag: 'MISS · was target', cls: 'text-red-300 bg-red-500/25 border-red-400/60' };
                    if (!rec.isTarget && rec.userResponded) return { tag: 'FALSE ALARM', cls: 'text-amber-300 bg-amber-500/20 border-amber-400/60' };
                    return { tag: 'CORRECT REJECTION', cls: 'text-cyan-300 bg-cyan-500/15 border-cyan-400/50' };
                  };
                  // Hint diagnostic — only for MISS / FALSE ALARM (not for HIT/CR).
                  // Points at the *dimension* that was misjudged, not the answer.
                  const diagnose = (rec) => {
                    if (!rec || rec.isTarget === !!rec.userResponded) return null;
                    const type = rec.responseType || 'relation';
                    const mode = rec.trialMode || 'normal';
                    const isMiss = rec.isTarget && !rec.userResponded;
                    const stim = rec.stimulus || {};
                    if (type === 'position') {
                      return isMiss ? 'position matched N back' : 'position differed from N back';
                    }
                    if (type === 'cct') {
                      return isMiss ? 'candidate = current digit + N-back digit' : 'candidate didn\'t equal current + N-back';
                    }
                    if (type === 'rst') {
                      return isMiss ? 'conclusion followed from the chain' : 'conclusion didn\'t follow from the chain';
                    }
                    // type === 'relation' — branch by trial mode
                    if (mode === 'analogy') {
                      if (isMiss) return 'different token, same form class — analogous';
                      // FA: either same-token (excluded) or different form class
                      const nbStim = (gameState.historyA || [])[gameState.historyA.length - (rec.nBackValue || gameState.nLevel)];
                      if (nbStim && nbStim.rel === stim.rel) return 'same-token isn\'t analogy';
                      return 'different form class';
                    }
                    if (mode === 'rint') {
                      return isMiss ? 'valid logical conclusion from the chain' : 'conclusion not derivable from the chain';
                    }
                    if (mode === 'nrint') {
                      return isMiss ? 'attrs reachable from a subset of last N' : 'attrs not reachable from any subset';
                    }
                    if (mode === 'tjn') {
                      const tjn = stim?._tjn;
                      const tier = tjn?.tier || 'easy';
                      if (tier === 'easy') return isMiss ? 'current node IS the N-back node' : 'current ≠ N-back node';
                      if (tier === 'medium') return isMiss ? 'current is a neighbour of N-back' : 'current is not a neighbour of N-back';
                      if (tier === 'hard') return isMiss ? `current is reachable in ${tjn?.K || 2} steps from N-back` : `not reachable in ${tjn?.K || 2} steps from N-back`;
                      if (tier === 'extreme') return isMiss ? 'on the shortest path N-back → ★ goal' : 'NOT on the shortest path N-back → ★';
                    }
                    if (mode === 'cct') {
                      return isMiss ? 'result = current + N-back digit' : 'result didn\'t equal current + N-back';
                    }
                    if (mode === 'type') {
                      return isMiss ? 'this rel appeared N times in its own history' : 'rel hasn\'t hit the N count in its own history';
                    }
                    if (mode === 'hierarchical') {
                      return isMiss ? 'same category as N back' : 'different category from N back';
                    }
                    // normal n-back: check lure / negation flavors
                    if (!isMiss && stim._isLure) {
                      const off = stim._lureOffset > 0 ? `+${stim._lureOffset}` : `${stim._lureOffset}`;
                      return `lure at N${off} — not N`;
                    }
                    if (!isMiss && modes.includes('negation') && stim._negated !== undefined) {
                      const nbStim = (gameState.historyA || [])[gameState.historyA.length - (rec.nBackValue || gameState.nLevel)];
                      if (nbStim && stim.rel === nbStim.rel && !!stim._negated !== !!nbStim._negated) {
                        return 'rel matched but ¬ flag differs';
                      }
                    }
                    return isMiss ? 'this rel matched N back' : 'different rel from N back';
                  };
                  const relV = verdict(rel);
                  const posV = verdict(pos);
                  const cctV = verdict(cct);
                  const rstV = verdict(rst);
                  const relHint = diagnose(rel);
                  const posHint = diagnose(pos);
                  const cctHint = diagnose(cct);
                  const rstHint = diagnose(rst);
                  const HintRow = ({ label, verd, hint }) => verd && (
                    <div className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold tracking-wide flex flex-col items-center gap-0.5 ${verd.cls}`}>
                      <span>{label} · {verd.tag}</span>
                      {hint && <span className="text-[10px] font-normal opacity-90 italic">{hint}</span>}
                    </div>
                  );
                  return (
                    <div className="absolute inset-0 bg-background/70 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-2 px-3">
                      <HintRow label="REL" verd={relV} hint={relHint} />
                      <HintRow label="POS" verd={posV} hint={posHint} />
                      <HintRow label="CCT" verd={cctV} hint={cctHint} />
                      <HintRow label="RST" verd={rstV} hint={rstHint} />
                      {rel?.relationship && (
                        <div className="font-mono text-xs text-muted-foreground/80 mt-1">
                          {rel.relationship.replace(/_/g, ' ').toLowerCase()}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              {showRintChain && (
                <div className="shrink-0 px-2 py-1 border-t border-emerald-500/20 bg-emerald-500/5 font-mono text-xs overflow-x-auto whitespace-nowrap text-center">
                  {rintChain.slice(-(gameState.nLevel + 1)).map((fact, i, arr) => (
                    <span key={i}>
                      <span className="text-cyan-300">{fact.entityA}</span>
                      <span className="text-emerald-400/70 mx-1">{fact.rel.replace(/_/g, ' ').toLowerCase()}</span>
                      <span className="text-violet-300">{fact.entityB}</span>
                      {i < arr.length - 1 && <span className="text-muted-foreground/40 mx-1">·</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>


      {isCarouselActive && phase === 'stimulus' && (
        <div className="mt-1 shrink-0 text-center text-xs font-mono">
          <span className="text-primary">Slide {Math.min(activeSlide + 1, slideCount)}/{slideCount}</span>
          <span className="text-muted-foreground/40"> · Streams {STREAM_LABELS[visibleStart]}–{STREAM_LABELS[Math.min(numStreams - 1, visibleStart + streamsPerSlide - 1)]}</span>
          <span className={responsesUnlocked ? 'text-emerald-400' : 'text-amber-400'}> · {responsesUnlocked ? 'responses unlocked' : 'watch only'}</span>
        </div>
      )}

      {/* Controls hint — hidden on small screens; touch buttons replace it */}
      <div className="mt-1 shrink-0 text-center hidden md:block">
        <p className="text-xs font-mono text-muted-foreground/40 flex flex-wrap justify-center gap-x-2 gap-y-0.5">
          {allStreams.map((stream, idx) => (
            <span key={idx}>
              <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground font-semibold text-xs">{stream.keyDisplay}</kbd>
              {' '}= {STREAM_LABELS[idx]} REL
              {hasAlienPosition && <><kbd className="ml-1 px-1 py-0.5 rounded bg-muted text-amber-400 font-semibold text-xs">{stream.positionKeyDisplay}</kbd> = {STREAM_LABELS[idx]} POS</>}
              {hasCCTOverlay && stream.streamType !== 'cct' && <><kbd className="ml-1 px-1 py-0.5 rounded bg-muted text-rose-400 font-semibold text-xs">{stream.cctKeyDisplay}</kbd> = {STREAM_LABELS[idx]} CCT</>}
              {hasRSTOverlay && idx === 0 && <><kbd className="ml-1 px-1 py-0.5 rounded bg-muted text-violet-400 font-semibold text-xs">{stream.rstKeyDisplay}</kbd> = A RST</>}
            </span>
          ))}

          <span className="text-muted-foreground/25 ml-1">· N={gameState.nLevel}</span>
          {noobMode && <span className="text-amber-400 ml-1">· NOOB MODE</span>}
        </p>
      </div>

      {/* Mobile buttons */}
      {responsesUnlocked && (phase === 'stimulus' || (noobMode && phase === 'stimulus')) && (
        <div
          className="mt-1 shrink-0 md:hidden grid gap-1.5 w-full mx-auto"
          style={{ gridTemplateColumns: `repeat(${Math.min(2, hasAlienPosition ? 2 : 2)}, minmax(0, 1fr))` }}
        >
          {noobMode ? (
            <>
              <button
                onClick={handlePrevTrial}
                disabled={gameState.round <= 1}
                className="h-12 rounded-lg bg-secondary border border-border text-muted-foreground font-mono text-xs hover:border-muted-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              {allStreams.flatMap((stream, idx) => [
                <button key={`${idx}-rel`}
                  className={`h-11 rounded-lg bg-secondary border font-mono text-xs text-muted-foreground active:bg-secondary/70 transition-colors ${STREAM_BORDER_COLORS[idx % STREAM_BORDER_COLORS.length]}`}
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                  onPointerDown={(e) => { e.preventDefault(); markResponse(idx, 'relation'); }}>
                  {STREAM_LABELS[idx]} · REL
                </button>,
                hasAlienPosition && <button key={`${idx}-pos`}
                  className={`h-11 rounded-lg bg-secondary border font-mono text-xs text-amber-400 active:bg-secondary/70 transition-colors ${STREAM_BORDER_COLORS[idx % STREAM_BORDER_COLORS.length]}`}
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                  onPointerDown={(e) => { e.preventDefault(); markResponse(idx, 'position'); }}>
                  {STREAM_LABELS[idx]} · POS
                </button>,
                hasCCTOverlay && stream.streamType !== 'cct' && <button key={`${idx}-cct`}
                  className={`h-11 rounded-lg bg-secondary border font-mono text-xs text-rose-400 active:bg-secondary/70 transition-colors ${STREAM_BORDER_COLORS[idx % STREAM_BORDER_COLORS.length]}`}
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                  onPointerDown={(e) => { e.preventDefault(); markResponse(idx, 'cct'); }}>
                  {STREAM_LABELS[idx]} · CCT
                </button>,
                hasRSTOverlay && idx === 0 && <button key={`${idx}-rst`}
                  className={`h-11 rounded-lg bg-secondary border font-mono text-xs text-violet-400 active:bg-secondary/70 transition-colors border-violet-400/40`}
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                  onPointerDown={(e) => { e.preventDefault(); markResponse(0, 'rst'); }}>
                  A · RST
                </button>
              ].filter(Boolean))}
              <button
                onClick={handleNextTrial}
                className="h-12 rounded-lg bg-primary text-primary-foreground font-mono text-xs hover:bg-primary/90 transition-colors"
              >
                Next →
              </button>
            </>
          ) : (
            allStreams.flatMap((stream, idx) => [
              <button key={`${idx}-rel`}
                className={`h-12 rounded-lg bg-secondary border font-mono text-xs text-muted-foreground transition-colors ${STREAM_BORDER_COLORS[idx % STREAM_BORDER_COLORS.length]}`}
                style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                onPointerDown={(e) => { e.preventDefault(); markResponse(idx, 'relation'); }}>
                {STREAM_LABELS[idx]} · REL
              </button>,
              hasAlienPosition && <button key={`${idx}-pos`}
                className={`h-12 rounded-lg bg-secondary border font-mono text-xs text-amber-400 transition-colors ${STREAM_BORDER_COLORS[idx % STREAM_BORDER_COLORS.length]}`}
                style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                onPointerDown={(e) => { e.preventDefault(); markResponse(idx, 'position'); }}>
                {STREAM_LABELS[idx]} · POS
              </button>,
              hasCCTOverlay && stream.streamType !== 'cct' && <button key={`${idx}-cct`}
                className={`h-12 rounded-lg bg-secondary border font-mono text-xs text-rose-400 transition-colors ${STREAM_BORDER_COLORS[idx % STREAM_BORDER_COLORS.length]}`}
                style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                onPointerDown={(e) => { e.preventDefault(); markResponse(idx, 'cct'); }}>
                {STREAM_LABELS[idx]} · CCT
              </button>,
              hasRSTOverlay && idx === 0 && <button key={`${idx}-rst`}
                className={`h-12 rounded-lg bg-secondary border font-mono text-xs text-violet-400 transition-colors border-violet-400/40`}
                style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                onPointerDown={(e) => { e.preventDefault(); markResponse(0, 'rst'); }}>
                A · RST
              </button>
            ].filter(Boolean))
          )}
        </div>
      )}

      {/* Desktop noob mode navigation buttons */}
      {responsesUnlocked && noobMode && phase === 'stimulus' && (
        <div className="mt-2 shrink-0 hidden md:flex justify-center gap-3 flex-wrap">
          <button
            onClick={handlePrevTrial}
            disabled={gameState.round <= 1}
            className="px-6 h-10 rounded-lg bg-secondary border border-border text-muted-foreground font-mono text-sm hover:border-muted-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev Trial
          </button>
          {allStreams.flatMap((stream, idx) => [
            <button key={`${idx}-rel`}
              onMouseDown={(e) => { e.preventDefault(); markResponse(idx, 'relation'); }}
              className={`px-6 h-10 rounded-lg bg-secondary border font-mono text-sm transition-colors ${STREAM_BORDER_COLORS[idx % STREAM_BORDER_COLORS.length]}`}>
              {stream.keyDisplay} REL
            </button>,
            hasAlienPosition && <button key={`${idx}-pos`}
              onMouseDown={(e) => { e.preventDefault(); markResponse(idx, 'position'); }}
              className={`px-6 h-10 rounded-lg bg-secondary border font-mono text-sm text-amber-400 transition-colors ${STREAM_BORDER_COLORS[idx % STREAM_BORDER_COLORS.length]}`}>
              {stream.positionKeyDisplay} POS
            </button>,
            hasCCTOverlay && stream.streamType !== 'cct' && <button key={`${idx}-cct`}
              onMouseDown={(e) => { e.preventDefault(); markResponse(idx, 'cct'); }}
              className={`px-6 h-10 rounded-lg bg-secondary border font-mono text-sm text-rose-400 transition-colors ${STREAM_BORDER_COLORS[idx % STREAM_BORDER_COLORS.length]}`}>
              {stream.cctKeyDisplay} CCT
            </button>,
            hasRSTOverlay && idx === 0 && <button key={`${idx}-rst`}
              onMouseDown={(e) => { e.preventDefault(); markResponse(0, 'rst'); }}
              className={`px-6 h-10 rounded-lg bg-secondary border border-violet-400/40 font-mono text-sm text-violet-400 transition-colors`}>
              {stream.rstKeyDisplay} RST
            </button>
          ].filter(Boolean))}
          <button
            onClick={handleNextTrial}
            className="px-6 h-10 rounded-lg bg-primary text-primary-foreground font-mono text-sm hover:bg-primary/90 transition-colors"
          >
            Next Trial →
          </button>
        </div>
      )}
    </div>
  );
}
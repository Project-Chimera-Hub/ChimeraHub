
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NBackEvent, Score, Settings, Shape } from '../types';
import ShapeDisplay from './ShapeDisplay';

declare namespace Tone {
  interface Synth {
    toDestination(): this;
    triggerAttackRelease(frequency: number, duration: string): this;
    dispose(): void;
  }
  const Synth: new () => Synth;

  const Transport: {
    scheduleRepeat(callback: (time: number) => void, interval: number | string): number;
    start(): void;
    stop(): void;
    cancel(): void;
    clear(eventId: number): void;
  };
  function start(): Promise<void>;
}

interface NBackGameProps {
  settings: Settings;
  onGameEnd: (score: Score, totalMatches: number, completed: boolean, duration: number) => void;
}

const STIMULUS_DURATION_MS = 500;
type Modality = 'spatial' | 'audio' | 'color' | 'shape';

const generateBaseShape = (numVertices: number): Shape => ({
  vertices: Array.from({ length: numVertices }, () => ({ radius: 0.6 + Math.random() * 0.4 }))
});

const NBackGame: React.FC<NBackGameProps> = ({ settings, onGameEnd }) => {
  const { nLevel, matchRate, lureRate, isi, totalTrials, ballSize, variableN, devMode, gridRows, gridCols } = settings;
  const { audioThreshold, colorThreshold, shapeThreshold } = settings;

  const [history, setHistory] = useState<NBackEvent[]>([]);
  const [currentEvent, setCurrentEvent] = useState<NBackEvent | null>(null);
  const [trialNumber, setTrialNumber] = useState(0);
  const [isStimulusVisible, setIsStimulusVisible] = useState(false);
  const [score, setScore] = useState<Score>({ hits: 0, misses: 0, audioFalseAlarms: 0, spatialFalseAlarms: 0, colorFalseAlarms: 0, shapeFalseAlarms: 0 });
  const [feedback, setFeedback] = useState<{ type: string, key: number } | null>(null);
  const [buttonHighlights, setButtonHighlights] = useState<Record<Modality, 'none' | 'hit' | 'miss'>>({ spatial: 'none', audio: 'none', color: 'none', shape: 'none' });
  const [devLureInfo, setDevLureInfo] = useState<string>('');
  
  const [stimulusSize, setStimulusSize] = useState(settings.ballSize * 100);
  const gameBoardRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<Tone.Synth | null>(null);
  const transportEventIdRef = useRef<number | null>(null);
  const totalMatchesRef = useRef(0);
  const startTimeRef = useRef<number>(Date.now());
  
  const historyRef = useRef(history);
  const trialNumberRef = useRef(trialNumber);
  const scoreRef = useRef(score);
  const respondedToRef = useRef(new Set<string>());
  const activeModalitiesRef = useRef<Modality[]>([]);

  useEffect(() => {
    const active: Modality[] = [];
    if (settings.spatialEnabled) active.push('spatial');
    if (settings.audioEnabled) active.push('audio');
    if (settings.colorEnabled) active.push('color');
    if (settings.shapeEnabled) active.push('shape');
    activeModalitiesRef.current = active;
  }, [settings]);

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { trialNumberRef.current = trialNumber; }, [trialNumber]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  useEffect(() => {
    const board = gameBoardRef.current;
    if (!board) return;

    const calculateSize = () => {
        const boardWidth = board.offsetWidth;
        const cellWidth = boardWidth / gridCols;
        setStimulusSize(cellWidth * ballSize);
    };

    const resizeObserver = new ResizeObserver(calculateSize);
    resizeObserver.observe(board);

    // Initial calculation for first render
    calculateSize();

    return () => resizeObserver.disconnect();
  }, [gridCols, gridRows, ballSize]);

  const showFeedback = (type: string) => { setFeedback({ type, key: Date.now() }); };

  const handleUserResponse = useCallback((type: Modality) => {
    if (trialNumberRef.current === 0) return;
    const current = historyRef.current[historyRef.current.length - 1];
    if (!current || trialNumberRef.current <= current.n) return;
    
    const isMatch = current.isMatch[type];
    const responseKey = `${current.id}_${type}`;

    if(respondedToRef.current.has(responseKey)) return;
    
    if (isMatch) {
      setScore(s => ({ ...s, hits: s.hits + 1 }));
      showFeedback('hit');
      setButtonHighlights(prev => ({...prev, [type]: 'hit'}));
    } else {
      setScore(s => ({ ...s, [`${type}FalseAlarms`]: s[`${type}FalseAlarms`] + 1 }));
      showFeedback('false_alarm');
    }
    respondedToRef.current.add(responseKey);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      switch (key) {
        case 'a':
          if (settings.spatialEnabled) handleUserResponse('spatial');
          break;
        case 'l':
          if (settings.audioEnabled) handleUserResponse('audio');
          break;
        case 'f':
          if (settings.colorEnabled) handleUserResponse('color');
          break;
        case 'j':
          if (settings.shapeEnabled) handleUserResponse('shape');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUserResponse, settings.spatialEnabled, settings.audioEnabled, settings.colorEnabled, settings.shapeEnabled]);

  const endSession = useCallback((completed: boolean) => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      const duration = Date.now() - startTimeRef.current;
      onGameEnd(scoreRef.current, totalMatchesRef.current, completed, duration);
  }, [onGameEnd]);

  const quitSession = useCallback(() => {
    endSession(false);
  }, [endSession]);

  const generateNextEvent = useCallback(() => {
    const history = historyRef.current;
    const trialNumber = trialNumberRef.current;
    const activeModalities = activeModalitiesRef.current;

    let n = variableN ? 1 + Math.floor(Math.random() * nLevel) : nLevel;
    if (variableN && trialNumber > 0 && n === history[trialNumber - 1].n && nLevel > 1) {
        n = (n % nLevel) + 1;
    }
    
    const isReadyForMatch = trialNumber >= n;
    const targetEvent = isReadyForMatch ? history[trialNumber - n] : null;
    
    const newEvent: NBackEvent = {
        id: trialNumber, n,
        spatial: { row: Math.floor(Math.random() * gridRows), col: Math.floor(Math.random() * gridCols) },
        audio: 200 + Math.random() * 600,
        color: Math.random() * 360,
        shape: generateBaseShape(settings.shapeVertices),
        isMatch: { audio: false, spatial: false, color: false, shape: false },
        lureType: 'none',
    };
    
    let devInfoParts: string[] = [`N=${n}`];
    let lureFound = false;

    if (isReadyForMatch && targetEvent) {
      activeModalities.forEach(mod => {
        const rand = Math.random();
        if (rand < matchRate) {
          // This modality is a MATCH
          (newEvent[mod] as any) = targetEvent[mod];
          newEvent.isMatch[mod] = true;
          totalMatchesRef.current += 1;
          devInfoParts.push(`${mod.charAt(0).toUpperCase()}:MATCH`);
        } else if (rand < matchRate + lureRate) {
          // This modality is a LURE
          if (!lureFound) {
            newEvent.lureType = mod;
            lureFound = true;
          }
          devInfoParts.push(`${mod.charAt(0).toUpperCase()}:LURE`);
          switch (mod) {
            case 'spatial':
              const { row, col } = targetEvent.spatial;
              const possibleLures = [
                  { row: row - 1, col }, { row: row + 1, col },
                  { row, col: col - 1 }, { row, col: col + 1 }
              ].filter(p => p.row >= 0 && p.row < gridRows && p.col >= 0 && p.col < gridCols);
              if (possibleLures.length > 0) {
                  newEvent.spatial = possibleLures[Math.floor(Math.random() * possibleLures.length)];
              }
              break;
            case 'audio':
              newEvent.audio = targetEvent.audio * Math.pow(2, ((Math.random() < 0.5 ? 1 : -1) * audioThreshold) / 1200);
              break;
            case 'color':
              newEvent.color = (targetEvent.color + (Math.random() < 0.5 ? 1 : -1) * colorThreshold + 360) % 360;
              break;
            case 'shape':
              const newVertices = targetEvent.shape.vertices.map(v => ({...v}));
              const vIndex = Math.floor(Math.random() * newVertices.length);
              newVertices[vIndex].radius = Math.max(0.1, Math.min(1.0, newVertices[vIndex].radius + (Math.random() < 0.5 ? 1 : -1) * shapeThreshold));
              newEvent.shape = { vertices: newVertices };
              break;
          }
        } else {
          // This modality is RANDOM
          devInfoParts.push(`${mod.charAt(0).toUpperCase()}:RAND`);
        }
      });
    } else {
      devInfoParts.push("RANDOM (Pre-N)");
    }
    
    setDevLureInfo(devInfoParts.join(' '));
    return newEvent;
  }, [nLevel, variableN, matchRate, lureRate, settings]);
  
  const runTrial = useCallback(() => {
    setFeedback(null);
    setButtonHighlights({ spatial: 'none', audio: 'none', color: 'none', shape: 'none' });
    const activeModalities = activeModalitiesRef.current;

    if (trialNumberRef.current > 0) {
        const lastEvent = historyRef.current[historyRef.current.length - 1];
        if (trialNumberRef.current > lastEvent.n) {
            activeModalities.forEach(mod => {
                if (lastEvent.isMatch[mod] && !respondedToRef.current.has(`${lastEvent.id}_${mod}`)) {
                    setScore(s => ({...s, misses: s.misses + 1}));
                    setButtonHighlights(prev => ({...prev, [mod]: 'miss'}));
                }
            });
        }
    }

    if (trialNumberRef.current >= totalTrials) { endSession(true); return; }

    const newEvent = generateNextEvent();
    setCurrentEvent(newEvent);
    setHistory(h => [...h, newEvent]);
    setTrialNumber(t => t + 1);
    setIsStimulusVisible(true);

    if (settings.audioEnabled && synthRef.current) {
        synthRef.current.triggerAttackRelease(newEvent.audio, `${STIMULUS_DURATION_MS / 1000}s`);
    }

    setTimeout(() => { setIsStimulusVisible(false); }, STIMULUS_DURATION_MS);
  }, [generateNextEvent, endSession, totalTrials, settings.audioEnabled]);

  useEffect(() => {
    synthRef.current = new Tone.Synth().toDestination();
    const startAudio = async () => {
      await Tone.start();
      transportEventIdRef.current = Tone.Transport.scheduleRepeat(runTrial, (STIMULUS_DURATION_MS + isi) / 1000);
      Tone.Transport.start();
    };
    startAudio();
    return () => {
      if (transportEventIdRef.current !== null) { Tone.Transport.clear(transportEventIdRef.current); }
      Tone.Transport.stop(); Tone.Transport.cancel();
      synthRef.current?.dispose();
    };
  }, [isi, runTrial]);

  const getGameTitle = () => {
    const count = activeModalitiesRef.current.length;
    const names = ["", "Single", "Dual", "Triple", "Quad"];
    const baseTitle = `${names[count] || 'Multi'}-Modality`;
    if (variableN) return `Variable ${baseTitle} (Max N: ${nLevel})`;
    return `${nLevel}-Back ${baseTitle}`;
  };

  const getButtonClass = (modality: Modality) => {
    const baseClasses = 'py-4 px-6 text-xl font-bold text-white rounded-lg transition-all duration-150';
    const defaultClasses = 'bg-gray-600 hover:bg-gray-500';

    switch (buttonHighlights[modality]) {
        case 'hit':
            return `${baseClasses} bg-accent-success scale-105`;
        case 'miss':
            return `${baseClasses} bg-accent-error-heavy`;
        default:
            return `${baseClasses} ${defaultClasses}`;
    }
  };
  
  const gridStyle = {
      backgroundImage: `
          linear-gradient(to right, rgba(128, 128, 128, 0.15) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(128, 128, 128, 0.15) 1px, transparent 1px)
      `,
      backgroundSize: `${100 / gridCols}% ${100 / gridRows}%`
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-8 bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl">
      <div className="w-full flex justify-between items-center mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-primary">{getGameTitle()}</h2>
        <div className="text-lg font-mono">Trial: {trialNumber} / {totalTrials}</div>
      </div>
      
      <div
        ref={gameBoardRef}
        className="relative w-full bg-gray-900 rounded-lg mb-6 shadow-inner overflow-hidden"
        style={{
          ...gridStyle,
          aspectRatio: `${gridCols} / ${gridRows}`,
        }}
      >
        {devMode && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs font-mono rounded z-10">
            {devLureInfo}
          </div>
        )}
        {variableN && !isStimulusVisible && currentEvent && trialNumber < totalTrials && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span className="text-9xl font-bold text-white opacity-10">{currentEvent.n}</span>
          </div>
        )}

        {isStimulusVisible && currentEvent && (
          <div className="absolute" style={{
                left: `${(currentEvent.spatial.col + 0.5) / gridCols * 100}%`,
                top: `${(currentEvent.spatial.row + 0.5) / gridRows * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: `${stimulusSize}px`,
                height: `${stimulusSize}px`
              }}>
            <ShapeDisplay
                shape={currentEvent.shape}
                colorHue={currentEvent.color}
                size={stimulusSize}
                isCircle={!settings.shapeEnabled}
                useThemeColor={!settings.colorEnabled}
            />
          </div>
        )}
         {feedback && (
          <div key={feedback.key} className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-32 h-32 rounded-full border-8 animate-ping opacity-75 ${
              feedback.type === 'hit' ? 'border-accent-success' : 'border-accent-error'
            }`}></div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-lg mx-auto">
        {settings.spatialEnabled && <button onClick={() => handleUserResponse('spatial')} className={getButtonClass('spatial')}>Position <span className="text-xs opacity-70">(A)</span></button>}
        {settings.audioEnabled && <button onClick={() => handleUserResponse('audio')} className={getButtonClass('audio')}>Audio <span className="text-xs opacity-70">(L)</span></button>}
        {settings.colorEnabled && <button onClick={() => handleUserResponse('color')} className={getButtonClass('color')}>Color <span className="text-xs opacity-70">(F)</span></button>}
        {settings.shapeEnabled && <button onClick={() => handleUserResponse('shape')} className={getButtonClass('shape')}>Shape <span className="text-xs opacity-70">(J)</span></button>}
      </div>

      <div className="mt-6 w-full flex justify-between items-center text-gray-400 font-mono">
        <button onClick={quitSession} className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white font-bold rounded-lg text-sm">Quit</button>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
            <p>Hits: <span className="text-accent-success">{score.hits}</span></p>
            <p>Misses: <span className="text-accent-error">{score.misses}</span></p>
            {activeModalitiesRef.current.map(m => <p key={m}>{m.charAt(0).toUpperCase()} FA: <span className="text-accent-error">{score[`${m}FalseAlarms`]}</span></p>)}
        </div>
      </div>
    </div>
  );
};

export default NBackGame;
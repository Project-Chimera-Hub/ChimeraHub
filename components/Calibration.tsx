
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CalibrationResult, Settings, Shape } from '../types';
import ShapeDisplay from './ShapeDisplay';

declare namespace Tone {
  interface Synth {
    toDestination(): this;
    triggerAttackRelease(freq: number, duration: string): this;
    dispose(): void;
  }
  const context: { state: string };
  function start(): Promise<void>;
  const Synth: new () => Synth;
}

interface CalibrationProps {
  onComplete: (result: CalibrationResult) => void;
  onQuit: () => void;
  settings: Settings;
}

type Modality = 'spatial' | 'audio' | 'color' | 'shape';
type CalibrationMode = 'selection' | Modality;
type TrialStep = 'stimulus' | 'isi1' | 'noise' | 'isi2' | 'lure' | 'response' | 'feedback';

const MIN_AUDIO_DELTA = 5;
const MIN_SPATIAL_DELTA = 0.005;
const MIN_COLOR_DELTA = 2;
const MIN_SHAPE_DELTA = 0.01;

const TRIALS_PER_CALIBRATION = 15;
const CORRECT_STEP_DOWN_FACTOR = 0.90;
const INCORRECT_STEP_UP_FACTOR = 1.25;
const STIMULUS_DURATION_MS = 600;
const ISI_MS = 750;

const generateBaseShape = (numVertices: number): Shape => {
  const vertices = [];
  for (let i = 0; i < numVertices; i++) {
    vertices.push({ radius: 0.6 + Math.random() * 0.4 });
  }
  return { vertices };
};

type Stimulus = { audio: number; spatial: { x: number; y: number }; color: number; shape: Shape; };

const Calibration: React.FC<CalibrationProps> = ({ onComplete, onQuit, settings }) => {
  const [mode, setMode] = useState<CalibrationMode>('selection');
  const [trialCount, setTrialCount] = useState(0);
  const [trialStep, setTrialStep] = useState<TrialStep>('stimulus');
  const [currentStimulus, setCurrentStimulus] = useState<Stimulus | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [instructionText, setInstructionText] = useState<string>('');
  
  const baseStimulusRef = useRef<Stimulus | null>(null);
  const synthRef = useRef<Tone.Synth | null>(null);
  const trialTimeoutRef = useRef<number | undefined>(undefined);
  
  const thresholdsRef = useRef<CalibrationResult>({
      audioThreshold: settings.audioThreshold,
      spatialThreshold: settings.spatialThreshold,
      colorThreshold: settings.colorThreshold,
      shapeThreshold: settings.shapeThreshold,
  });
  
  useEffect(() => {
    synthRef.current = new Tone.Synth().toDestination();
    return () => {
      synthRef.current?.dispose();
      if (trialTimeoutRef.current) clearTimeout(trialTimeoutRef.current);
    };
  }, []);

  const playTone = useCallback((freq: number) => {
    const play = () => synthRef.current?.triggerAttackRelease(freq, `${STIMULUS_DURATION_MS / 1000}s`);
    if (synthRef.current && Tone.context.state !== 'running') {
      Tone.start().then(play);
    } else {
      play();
    }
  }, []);

  const runTrialStep = useCallback(() => {
    setFeedback(null);

    const generateLure = (base: Stimulus, modality: Modality): Stimulus => {
        let lure = { ...base, shape: { vertices: base.shape.vertices.map(v => ({...v})) } };
        switch (modality) {
            case 'audio':
                const directionA = Math.random() < 0.5 ? 1 : -1;
                lure.audio = base.audio * Math.pow(2, (directionA * thresholdsRef.current.audioThreshold) / 1200);
                break;
            case 'spatial':
                const angle = Math.random() * 2 * Math.PI;
                lure.spatial = {
                    x: Math.max(0.1, Math.min(0.9, base.spatial.x + thresholdsRef.current.spatialThreshold * Math.cos(angle))),
                    y: Math.max(0.1, Math.min(0.9, base.spatial.y + thresholdsRef.current.spatialThreshold * Math.sin(angle))),
                };
                break;
            case 'color':
                const directionC = Math.random() < 0.5 ? 1 : -1;
                lure.color = (base.color + directionC * thresholdsRef.current.colorThreshold + 360) % 360;
                break;
            case 'shape':
                const vIndex = Math.floor(Math.random() * lure.shape.vertices.length);
                const directionS = Math.random() < 0.5 ? 1 : -1;
                lure.shape.vertices[vIndex].radius = Math.max(0.1, Math.min(1.0, lure.shape.vertices[vIndex].radius + directionS * thresholdsRef.current.shapeThreshold));
                break;
        }
        return lure;
    };

    const generateRandomStimulus = (): Stimulus => ({
        audio: 200 + Math.random() * 600,
        spatial: { x: 0.2 + Math.random() * 0.6, y: 0.2 + Math.random() * 0.6 },
        color: Math.random() * 360,
        shape: generateBaseShape(settings.shapeVertices),
    });

    switch (trialStep) {
        case 'stimulus':
            baseStimulusRef.current = generateRandomStimulus();
            setCurrentStimulus(baseStimulusRef.current);
            setInstructionText('Remember this');
            if (mode === 'audio') playTone(baseStimulusRef.current.audio);
            trialTimeoutRef.current = window.setTimeout(() => setTrialStep('isi1'), STIMULUS_DURATION_MS);
            break;
        case 'isi1':
            setCurrentStimulus(null);
            setInstructionText('');
            trialTimeoutRef.current = window.setTimeout(() => setTrialStep('noise'), ISI_MS);
            break;
        case 'noise':
            const noiseStim = generateRandomStimulus();
            setCurrentStimulus(noiseStim);
            setInstructionText('...');
            if (mode === 'audio') playTone(noiseStim.audio);
            trialTimeoutRef.current = window.setTimeout(() => setTrialStep('isi2'), STIMULUS_DURATION_MS);
            break;
        case 'isi2':
            setCurrentStimulus(null);
            setInstructionText('');
            trialTimeoutRef.current = window.setTimeout(() => setTrialStep('lure'), ISI_MS);
            break;
        case 'lure':
            if (baseStimulusRef.current && mode !== 'selection') {
                const lureStim = generateLure(baseStimulusRef.current, mode);
                setCurrentStimulus(lureStim);
                setInstructionText('Same as the first?');
                if (mode === 'audio') playTone(lureStim.audio);
            }
            trialTimeoutRef.current = window.setTimeout(() => setTrialStep('response'), STIMULUS_DURATION_MS);
            break;
        case 'response':
            setCurrentStimulus(null);
            break;
        case 'feedback':
            const nextTrialCount = trialCount + 1;
            trialTimeoutRef.current = window.setTimeout(() => {
                if (nextTrialCount >= TRIALS_PER_CALIBRATION) {
                    setMode('selection'); // Go back to menu
                    onComplete(thresholdsRef.current); // Save progress
                } else {
                    setTrialCount(nextTrialCount);
                    setTrialStep('stimulus');
                }
            }, 1000);
            break;
    }
  }, [trialStep, mode, playTone, settings.shapeVertices, trialCount, onComplete]);
  
  useEffect(() => {
      if (mode !== 'selection') {
        runTrialStep();
      }
      return () => clearTimeout(trialTimeoutRef.current);
  }, [trialStep, mode, runTrialStep]);

  const handleResponse = (userChoseSame: boolean) => {
      if (mode === 'selection' || trialStep !== 'response') return;
      
      const wasCorrect = !userChoseSame; // Correct answer is always "Different"
      setFeedback(wasCorrect ? 'correct' : 'incorrect');

      let currentDelta: keyof CalibrationResult, minDelta: number;
      switch (mode) {
          case 'audio':   currentDelta = 'audioThreshold';   minDelta = MIN_AUDIO_DELTA;   break;
          case 'spatial': currentDelta = 'spatialThreshold'; minDelta = MIN_SPATIAL_DELTA; break;
          case 'color':   currentDelta = 'colorThreshold';   minDelta = MIN_COLOR_DELTA;   break;
          case 'shape':   currentDelta = 'shapeThreshold';   minDelta = MIN_SHAPE_DELTA;   break;
      }

      if (wasCorrect) {
          thresholdsRef.current[currentDelta] = Math.max(minDelta, thresholdsRef.current[currentDelta] * CORRECT_STEP_DOWN_FACTOR);
      } else {
          thresholdsRef.current[currentDelta] *= INCORRECT_STEP_UP_FACTOR;
      }
      
      setTrialStep('feedback');
  };
  
  const startModalityCalibration = (modality: Modality) => {
      setTrialCount(0);
      setTrialStep('stimulus');
      setMode(modality);
  };

  const handleEndCalibrationRun = () => {
    onComplete(thresholdsRef.current);
    setMode('selection');
  }

  const renderSelection = () => (
    <div className="text-center w-full max-w-md">
        <h2 className="text-3xl font-bold mb-4 text-primary">Calibration Menu</h2>
        <p className="mb-8 text-gray-300">Select a modality to fine-tune your perceptual threshold. The goal is to find the smallest difference you can reliably detect.</p>
        <div className="grid grid-cols-2 gap-4 mb-8">
            {settings.spatialEnabled && <button onClick={() => startModalityCalibration('spatial')} className="p-4 bg-button-spatial hover:bg-button-spatial-hover rounded-lg">Spatial<br/><span className="text-sm opacity-80">({thresholdsRef.current.spatialThreshold.toFixed(3)})</span></button>}
            {settings.audioEnabled && <button onClick={() => startModalityCalibration('audio')} className="p-4 bg-button-audio hover:bg-button-audio-hover rounded-lg">Audio<br/><span className="text-sm opacity-80">({thresholdsRef.current.audioThreshold.toFixed(2)})</span></button>}
            {settings.colorEnabled && <button onClick={() => startModalityCalibration('color')} className="p-4 bg-button-color hover:bg-button-color-hover rounded-lg">Color<br/><span className="text-sm opacity-80">({thresholdsRef.current.colorThreshold.toFixed(2)})</span></button>}
            {settings.shapeEnabled && <button onClick={() => startModalityCalibration('shape')} className="p-4 bg-button-shape hover:bg-button-shape-hover rounded-lg">Shape<br/><span className="text-sm opacity-80">({thresholdsRef.current.shapeThreshold.toFixed(3)})</span></button>}
        </div>
        <button onClick={onQuit} className="px-8 py-3 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-lg transition-colors">Finish & Back to Menu</button>
    </div>
  );

  const renderCalibration = () => (
    <>
      <h2 className="text-2xl font-bold mb-2 text-primary capitalize">{mode} Calibration</h2>
      <p className="text-lg text-gray-300 mb-2 h-7">{instructionText}</p>
      <p className="text-gray-400 mb-6">Trial: {trialCount + 1} / {TRIALS_PER_CALIBRATION}</p>
      <div className="relative w-96 h-96 bg-gray-900 rounded-lg mb-6 flex items-center justify-center shadow-inner overflow-hidden">
          {currentStimulus && (mode === 'spatial' || mode === 'color' || mode === 'shape' || (mode==='audio' && trialStep !== 'isi1' && trialStep !== 'isi2')) && (
            <div className="absolute" style={{
              left: `${currentStimulus.spatial.x * 100}%`,
              top: `${currentStimulus.spatial.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: `${settings.ballSize * 100}px`,
              height: `${settings.ballSize * 100}px`,
            }}>
              <ShapeDisplay 
                shape={currentStimulus.shape} 
                colorHue={currentStimulus.color} 
                size={settings.ballSize * 100} 
                isCircle={mode !== 'shape'} 
                useThemeColor={mode !== 'color'} />
            </div>
          )}
          {feedback && <span className={`text-5xl font-bold ${feedback === 'correct' ? 'text-accent-success' : 'text-accent-error'}`}>{feedback === 'correct' ? 'Correct' : 'Incorrect'}</span>}
      </div>
      <div className="flex space-x-4">
          <button disabled={trialStep !== 'response'} onClick={() => handleResponse(true)} className="px-8 py-3 w-36 bg-gray-600 hover:bg-gray-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Same</button>
          <button disabled={trialStep !== 'response'} onClick={() => handleResponse(false)} className="px-8 py-3 w-36 bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Different</button>
      </div>
      <button onClick={handleEndCalibrationRun} className="mt-6 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg transition-colors text-sm">End & Return to Menu</button>
    </>
  );

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl">
      {mode === 'selection' ? renderSelection() : renderCalibration()}
    </div>
  );
};

export default Calibration;

import React, { useState, useCallback, useEffect } from 'react';
import { GameState, CalibrationResult, Settings, PerformanceRecord, Score } from './types';
import Calibration from './components/Calibration';
import NBackGame from './components/NBackGame';
import SettingsComponent from './components/Settings';
import Performance from './components/Performance';
import { useLocalStorage } from './hooks/useLocalStorage';

const DEFAULT_SETTINGS: Settings = {
  nLevel: 2,
  matchRate: 0.20,
  lureRate: 0.30,
  isi: 2500,
  gridRows: 7,
  gridCols: 7,
  audioThreshold: 290,
  colorThreshold: 28,
  shapeThreshold: 0.20,
  calibrationEnabled: false,
  totalTrials: 25,
  theme: 'cyan',
  devMode: false,
  ballSize: 0.5,
  variableN: false,
  spatialEnabled: true,
  audioEnabled: true,
  colorEnabled: false,
  shapeEnabled: false,
  shapeVertices: 6,
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.Start);
  const [settings, setSettings] = useLocalStorage<Settings>('nback-settings', DEFAULT_SETTINGS);
  const [performanceHistory, setPerformanceHistory] = useLocalStorage<PerformanceRecord[]>('nback-performance', []);
  const [isCalibratingForGame, setIsCalibratingForGame] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const handleCalibrationComplete = useCallback((result: Partial<CalibrationResult>) => {
    setSettings(prev => ({
      ...prev,
      ...result,
    }));
    if (isCalibratingForGame) {
      setGameState(GameState.Playing);
    } else {
      setGameState(GameState.Start);
    }
    setIsCalibratingForGame(false);
  }, [setSettings, isCalibratingForGame]);
  
  const handleCalibrationQuit = useCallback(() => {
    setIsCalibratingForGame(false);
    setGameState(GameState.Start);
  }, []);

  const handleGameEnd = useCallback((finalScore: Score, totalMatches: number, completed: boolean) => {
    if (completed) {
      const accuracy = totalMatches > 0 ? (finalScore.hits / totalMatches) : 1;
      
      const record: PerformanceRecord = {
        date: new Date().toISOString(),
        settings: {
          nLevel: settings.nLevel,
          audioThreshold: settings.audioThreshold,
          colorThreshold: settings.colorThreshold,
          shapeThreshold: settings.shapeThreshold,
          gridRows: settings.gridRows,
          gridCols: settings.gridCols,
        },
        score: finalScore,
        accuracy: accuracy,
      };
      setPerformanceHistory(prev => [...prev, record]);

      // Dynamic difficulty adjustment
      if (accuracy > 0.75) {
        setSettings(prev => ({
          ...prev,
          audioThreshold: Math.max(5, prev.audioThreshold * 0.95),
          colorThreshold: Math.max(2, prev.colorThreshold * 0.95),
          shapeThreshold: Math.max(0.01, prev.shapeThreshold * 0.95),
        }));
      }
    }

    setGameState(GameState.Finished);
  }, [settings, setPerformanceHistory, setSettings]);
  
  const handleStartTraining = useCallback(() => {
    if (settings.calibrationEnabled) {
      setIsCalibratingForGame(true);
      setGameState(GameState.Calibrating);
    } else {
      setGameState(GameState.Playing);
    }
  }, [settings.calibrationEnabled]);

  const handleStartCalibration = () => {
    setIsCalibratingForGame(false);
    setGameState(GameState.Calibrating);
  };

  const renderContent = () => {
    switch (gameState) {
      case GameState.Start:
        return (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4 text-primary">Precision N-Back</h1>
            <p className="max-w-2xl mx-auto mb-8 text-lg text-gray-300">
              A cognitive training tool for high-fidelity sensory buffering and working memory.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleStartTraining}
                className="px-8 py-3 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-lg transition-colors shadow-lg"
              >
                Start Training
              </button>
               <button
                onClick={handleStartCalibration}
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors shadow-lg"
              >
                Calibrate
              </button>
              <button
                onClick={() => setGameState(GameState.Settings)}
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors shadow-lg"
              >
                Settings
              </button>
              <button
                onClick={() => setGameState(GameState.Performance)}
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors shadow-lg"
              >
                Performance
              </button>
            </div>
          </div>
        );
      case GameState.Settings:
        return <SettingsComponent settings={settings} onSave={setSettings} onBack={() => setGameState(GameState.Start)} />;
      case GameState.Performance:
        return <Performance history={performanceHistory} onBack={() => setGameState(GameState.Start)} />;
      case GameState.Calibrating:
        return <Calibration onComplete={handleCalibrationComplete} onQuit={handleCalibrationQuit} settings={settings} />;
      case GameState.Playing:
        return <NBackGame settings={settings} onGameEnd={handleGameEnd} />;
      case GameState.Finished:
        return (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4 text-primary">Training Complete</h2>
            <p className="mb-8 text-gray-300">You've completed the session. Great work!</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleStartTraining}
                className="px-8 py-3 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-lg transition-colors shadow-lg"
              >
                Train Again
              </button>
              <button
                onClick={() => setGameState(GameState.Start)}
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors shadow-lg"
              >
                Main Menu
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gray-900 font-sans">
      {renderContent()}
    </main>
  );
};

export default App;

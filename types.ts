
export enum GameState {
  Start,
  Calibrating,
  Playing,
  Finished,
  Settings,
  Performance,
}

export enum CalibrationState {
  Instructions,
  Audio,
  Spatial,
  Color,
  Shape,
  Finished,
}

export type CalibrationResult = {
  audioThreshold: number; // in cents
  spatialThreshold: number; // in normalized screen distance
  colorThreshold: number; // in hue degrees
  shapeThreshold: number; // in vertex displacement %
};

export type Shape = {
  vertices: { radius: number }[]; // radius is 0-1
};

export type NBackEvent = {
  id: number;
  spatial: { x: number; y: number };
  audio: number; // frequency in Hz
  color: number; // hue in degrees
  shape: Shape;
  isMatch: { audio: boolean, spatial: boolean, color: boolean, shape: boolean };
  lureType: 'none' | 'audio' | 'spatial' | 'color' | 'shape';
  n: number; // The n-level for this specific trial
};

export type Score = {
  hits: number;
  misses: number;
  audioFalseAlarms: number;
  spatialFalseAlarms: number;
  colorFalseAlarms: number;
  shapeFalseAlarms: number;
};

export type Settings = {
  nLevel: number;
  matchRate: number;
  lureRate: number;
  isi: number;
  gridRows: number;
  gridCols: number;
  audioThreshold: number;
  spatialThreshold: number;
  colorThreshold: number;
  shapeThreshold: number;
  calibrationEnabled: boolean;
  totalTrials: number;
  theme: 'cyan';
  devMode: boolean;
  ballSize: number;
  variableN: boolean;
  spatialEnabled: boolean;
  audioEnabled: boolean;
  colorEnabled: boolean;
  shapeEnabled: boolean;
  shapeVertices: number;
};

export type PerformanceRecord = {
  date: string;
  settings: {
    nLevel: number;
    audioThreshold: number;
    spatialThreshold: number;
    colorThreshold: number;
    shapeThreshold: number;
  };
  score: Score;
  accuracy?: number; // Optional accuracy field
};
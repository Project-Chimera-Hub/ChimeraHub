
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
  colorThreshold: number; // in hue degrees
  shapeThreshold: number; // in vertex displacement %
};

export type Shape = {
  vertices: { radius: number }[]; // radius is 0-1
};

export type ColorPattern = 'vertical' | 'horizontal' | 'triangles';

export type NBackEvent = {
  id: number;
  spatial: { row: number; col: number };
  audio: number; // frequency in Hz
  hues: [number, number, number]; // hue in degrees for 3-part stimulus
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
  colorPattern: ColorPattern;
};

export type PerformanceRecord = {
  date: string;
  settings: {
    nLevel: number;
    audioThreshold: number;
    colorThreshold: number;
    shapeThreshold: number;
    gridRows: number;
    gridCols: number;
  };
  score: Score;
  accuracy?: number; // Optional accuracy field
  duration?: number; // in milliseconds
  totalMatches?: number;
  correctRejections?: number;
  totalNonMatches?: number;
};

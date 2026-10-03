import {
  SHAPES,
  RELATIONS,
  POSITION_PROMPTS_2D,
  POSITION_PROMPTS_3D,
  RELATION_PROMPTS,
  DEFAULT_STREAMS,
  DEFAULT_SHAPE_POOL,
  SOUND_MIN,
  SOUND_MAX,
  LIMITS,
} from './constants.js';
import {
  positionMatches,
  numberMatches,
  shapeMatches,
  relationMatches,
  viableNumberPrompts,
  viableShapePrompts,
} from './relations.js';
import { createRelationVisual } from './symbols.js';

const DEFAULTS = Object.freeze({
  n: 2,
  trials: 30,
  mode: '2d',
  intervalMs: 2500,
  visibleMs: 900,
  feedback: true,
  targetRate: 0.35,
  lureRate: 0,
  maxOffset: 4,
  streams: DEFAULT_STREAMS,
  variableN: false,
  variableFloor: 1,
  enabledShapes: DEFAULT_SHAPE_POOL,
});

export function createTrialSequence(inputConfig = {}, rng = Math.random) {
  const config = normalizeConfig({ ...DEFAULTS, ...inputConfig });
  validateConfig(config);
  const enabledShapeIds = shapeIdsFromConfig(config.enabledShapes);
  const sequence = [];
  let previousPrompts = null;
  let previousRelationPairKey = '';
  const total = config.n + config.trials;

  for (let index = 0; index < total; index += 1) {
    const trialN = config.variableN && index >= config.n ? randomInt(config.variableFloor, config.n, rng) : config.n;
    const remembered = index >= config.n ? sequence[index - trialN] : null;
    const scored = index >= config.n;
    const targets = scored ? {
      position: config.streams.position && rng() < config.targetRate,
      sound: config.streams.sound && rng() < config.targetRate,
      shape: config.streams.shape && rng() < config.targetRate,
      relation: config.streams.relation && rng() < config.targetRate,
    } : { position: false, sound: false, shape: false, relation: false };

    const positionPair = scored
      ? generatePosition(remembered.position, targets.position, config.mode, previousPrompts?.position, rng)
      : randomPositionWarmup(config.mode, previousPrompts?.position, rng);
    const soundPair = scored
      ? generateNumber(remembered.number, targets.sound, config.maxOffset, previousPrompts?.sound, rng)
      : randomNumberWarmup(config.maxOffset, previousPrompts?.sound, rng);
    const shapePair = scored
      ? generateShape(remembered.shape, targets.shape, enabledShapeIds, previousPrompts?.shape, rng)
      : randomShapeWarmup(enabledShapeIds, previousPrompts?.shape, rng);
    const relationPair = scored
      ? generateRelation(remembered.relation.semantic, targets.relation, previousPrompts?.relation, rng)
      : randomRelationWarmup(previousPrompts?.relation, rng);

    const relationVisual = createRelationVisual(relationPair.value, { enabledShapes: enabledShapeIds, previousPairKey: previousRelationPairKey }, rng);
    previousRelationPairKey = relationVisual.pairKey;

    const trial = {
      index,
      nBack: trialN,
      scored,
      position: positionPair.value,
      number: soundPair.value,
      shape: shapePair.value,
      relation: relationVisual,
      prompts: {
        position: positionPair.prompt,
        sound: soundPair.prompt,
        shape: shapePair.prompt,
        relation: relationPair.prompt,
      },
      targets,
      lures: { position: false, sound: false, shape: false, relation: false },
    };

    if (scored && trialN >= 2 && index > 0) {
      const near = sequence[index - 1];
      trial.lures = {
        position: config.streams.position && !targets.position && positionMatches(trial.position, near.position, trial.prompts.position, config.mode),
        sound: config.streams.sound && !targets.sound && numberMatches(trial.number, near.number, trial.prompts.sound),
        shape: config.streams.shape && !targets.shape && shapeMatches(trial.shape, near.shape, trial.prompts.shape),
        relation: config.streams.relation && !targets.relation && relationMatches(trial.relation.semantic, near.relation.semantic, trial.prompts.relation),
      };
    }

    sequence.push(trial);
    previousPrompts = trial.prompts;
  }

  return sequence;
}

export function normalizeConfig(inputConfig = {}) {
  const config = { ...DEFAULTS, ...inputConfig };
  config.streams = { ...DEFAULT_STREAMS, ...(inputConfig.streams || {}) };
  config.enabledShapes = { ...DEFAULT_SHAPE_POOL, ...(inputConfig.enabledShapes || {}) };
  if (!['2d', '3d-static', '3d-rotating'].includes(config.mode)) config.mode = '2d';
  if (!Object.values(config.streams).some(Boolean)) config.streams = { ...DEFAULT_STREAMS };
  config.n = clampInt(config.n, LIMITS.n.min, LIMITS.n.max);
  config.trials = clampInt(config.trials, LIMITS.trials.min, LIMITS.trials.max);
  config.maxOffset = clampInt(config.maxOffset, LIMITS.maxOffset.min, LIMITS.maxOffset.max);
  config.intervalMs = clampInt(config.intervalMs, LIMITS.intervalMs.min, LIMITS.intervalMs.max);
  config.visibleMs = clampInt(config.visibleMs, LIMITS.visibleMs.min, LIMITS.visibleMs.max);
  config.feedback = Boolean(config.feedback);
  config.targetRate = Number(config.targetRate);
  if (!Number.isFinite(config.targetRate)) config.targetRate = 0.35;
  config.targetRate = Math.min(
    LIMITS.targetRatePct.max / 100,
    Math.max(LIMITS.targetRatePct.min / 100, config.targetRate),
  );
  config.variableN = Boolean(config.variableN);
  config.variableFloor = clampInt(config.variableFloor, 1, config.n);
  const enabledShapeIds = shapeIdsFromConfig(config.enabledShapes);
  if (enabledShapeIds.length < 2) {
    config.enabledShapes = { ...DEFAULT_SHAPE_POOL };
    config.variableFloor = clampInt(config.variableFloor, 1, config.n);
  }
  return config;
}

function validateConfig(config) {
  if (!Number.isInteger(config.n) || config.n < 1 || config.n > 9) throw new Error('n must be an integer from 1 to 9');
  if (!Number.isInteger(config.trials) || config.trials < 5 || config.trials > 500) throw new Error('trials must be an integer from 5 to 500');
  if (!['2d', '3d-static', '3d-rotating'].includes(config.mode)) throw new Error('invalid mode');
  if (config.targetRate <= 0 || config.targetRate >= 1) throw new Error('targetRate must be between 0 and 1');
  if (shapeIdsFromConfig(config.enabledShapes).length < 2) throw new Error('At least two shapes must be enabled');
}

function generatePosition(remembered, target, mode, previousPrompt, rng) {
  const positions = allPositions(mode);
  const prompts = mode === '2d' ? POSITION_PROMPTS_2D : POSITION_PROMPTS_3D;
  const candidates = [];
  for (const prompt of prioritizeDifferent(prompts, previousPrompt)) {
    for (const value of positions) {
      if (positionMatches(value, remembered, prompt, mode) === target) candidates.push({ value, prompt });
    }
  }
  return pick(candidates, rng);
}

function randomPositionWarmup(mode, previousPrompt, rng) {
  const prompts = mode === '2d' ? POSITION_PROMPTS_2D : POSITION_PROMPTS_3D;
  return { value: pick(allPositions(mode), rng), prompt: pick(prioritizeDifferent(prompts, previousPrompt), rng) };
}

function generateNumber(remembered, target, maxOffset, previousPrompt, rng) {
  const candidates = [];
  for (let value = SOUND_MIN; value <= SOUND_MAX; value += 1) {
    for (const prompt of viableNumberPrompts(value, maxOffset)) {
      if (!samePrompt(prompt, previousPrompt) && numberMatches(value, remembered, prompt) === target) candidates.push({ value, prompt });
    }
  }
  if (!candidates.length) {
    for (let value = SOUND_MIN; value <= SOUND_MAX; value += 1) {
      for (const prompt of viableNumberPrompts(value, maxOffset)) {
        if (numberMatches(value, remembered, prompt) === target) candidates.push({ value, prompt });
      }
    }
  }
  return pick(candidates, rng);
}

function randomNumberWarmup(maxOffset, previousPrompt, rng) {
  for (let attempts = 0; attempts < 40; attempts += 1) {
    const value = randomInt(SOUND_MIN, SOUND_MAX, rng);
    const prompts = viableNumberPrompts(value, maxOffset).filter((p) => !samePrompt(p, previousPrompt));
    if (prompts.length) return { value, prompt: pick(prompts, rng) };
  }
  const value = randomInt(SOUND_MIN, SOUND_MAX, rng);
  return { value, prompt: pick(viableNumberPrompts(value, maxOffset), rng) };
}

function generateShape(remembered, target, enabledShapeIds, previousPrompt, rng) {
  const candidates = [];
  for (const shapeId of enabledShapeIds) {
    for (const prompt of viableShapePrompts(shapeId, enabledShapeIds)) {
      if (!samePrompt(prompt, previousPrompt) && shapeMatches(shapeId, remembered, prompt) === target) candidates.push({ value: shapeId, prompt });
    }
  }
  if (!candidates.length) {
    for (const shapeId of enabledShapeIds) {
      for (const prompt of viableShapePrompts(shapeId, enabledShapeIds)) {
        if (shapeMatches(shapeId, remembered, prompt) === target) candidates.push({ value: shapeId, prompt });
      }
    }
  }
  return pick(candidates, rng);
}

function randomShapeWarmup(enabledShapeIds, previousPrompt, rng) {
  const value = pick(enabledShapeIds, rng);
  const prompts = viableShapePrompts(value, enabledShapeIds).filter((p) => !samePrompt(p, previousPrompt));
  return { value, prompt: pick(prompts.length ? prompts : viableShapePrompts(value, enabledShapeIds), rng) };
}

function generateRelation(remembered, target, previousPrompt, rng) {
  const candidates = [];
  for (const relation of RELATIONS) {
    for (const prompt of prioritizeDifferent(RELATION_PROMPTS, previousPrompt)) {
      if (relationMatches(relation.id, remembered, prompt) === target) candidates.push({ value: relation.id, prompt });
    }
  }
  return pick(candidates, rng);
}

function randomRelationWarmup(previousPrompt, rng) {
  return {
    value: pick(RELATIONS, rng).id,
    prompt: pick(prioritizeDifferent(RELATION_PROMPTS, previousPrompt), rng),
  };
}

function allPositions(mode) {
  const depth = mode === '2d' ? [1] : [0, 1, 2];
  const out = [];
  for (const z of depth) for (let y = 0; y < 3; y += 1) for (let x = 0; x < 3; x += 1) out.push({ x, y, z });
  return out;
}

function prioritizeDifferent(values, previous) {
  const different = values.filter((value) => !samePrompt(value, previous));
  return different.length ? different : [...values];
}

function samePrompt(a, b) {
  if (a == null || b == null) return false;
  return typeof a === 'object' || typeof b === 'object'
    ? JSON.stringify(a) === JSON.stringify(b)
    : a === b;
}

function pick(items, rng) {
  if (!items.length) throw new Error('Generator reached an empty candidate set');
  return items[Math.floor(rng() * items.length)];
}

function randomInt(min, max, rng) {
  return min + Math.floor(rng() * (max - min + 1));
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Number.parseInt(value, 10) || min));
}

export function shapeIdsFromConfig(enabledShapes = DEFAULT_SHAPE_POOL) {
  const ids = SHAPES.map((shape) => shape.id).filter((id) => enabledShapes[id] !== false);
  return ids.length ? ids : SHAPES.map((shape) => shape.id);
}

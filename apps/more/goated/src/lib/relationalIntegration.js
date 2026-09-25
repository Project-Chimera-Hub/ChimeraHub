// ─── Relational Integration N-Back (RINT) ────────────────────────────────────
//
// Entities (alpha, beta, gamma…) persist across trials in a fact-graph.
// A target fires when the current stimulus is a VALID transitive conclusion
// derivable by chaining the N most-recent facts in the same relation family.
//
// Only transitive relation families are supported (comparisons, directional,
// temporal, and a subset of semantic relations).

export const RINT_MIN_N = 2;

// Named entities used as subjects/objects in the fact graph
const ENTITIES = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];

// Transitive relation families: each entry lists relations that chain
// (A rel B, B rel C → A rel C). Pairs are [forward, inverse].
const TRANSITIVE_FAMILIES = [
  // Magnitude comparisons
  { rels: ['BIGGER_THAN', 'SMALLER_THAN'], inv: { BIGGER_THAN: 'SMALLER_THAN', SMALLER_THAN: 'BIGGER_THAN' } },
  { rels: ['MORE_THAN', 'LESS_THAN'],       inv: { MORE_THAN: 'LESS_THAN', LESS_THAN: 'MORE_THAN' } },
  { rels: ['FASTER_THAN', 'SLOWER_THAN'],   inv: { FASTER_THAN: 'SLOWER_THAN', SLOWER_THAN: 'FASTER_THAN' } },
  { rels: ['HEAVIER_THAN', 'LIGHTER_THAN'], inv: { HEAVIER_THAN: 'LIGHTER_THAN', LIGHTER_THAN: 'HEAVIER_THAN' } },
  { rels: ['HOTTER_THAN', 'COLDER_THAN'],   inv: { HOTTER_THAN: 'COLDER_THAN', COLDER_THAN: 'HOTTER_THAN' } },
  { rels: ['LOUDER_THAN', 'SOFTER_THAN'],   inv: { LOUDER_THAN: 'SOFTER_THAN', SOFTER_THAN: 'LOUDER_THAN' } },
  { rels: ['STRONGER_THAN', 'WEAKER_THAN'], inv: { STRONGER_THAN: 'WEAKER_THAN', WEAKER_THAN: 'STRONGER_THAN' } },
  { rels: ['OLDER_THAN', 'NEWER_THAN'],     inv: { OLDER_THAN: 'NEWER_THAN', NEWER_THAN: 'OLDER_THAN' } },
  { rels: ['HIGHER_THAN', 'LOWER_THAN'],    inv: { HIGHER_THAN: 'LOWER_THAN', LOWER_THAN: 'HIGHER_THAN' } },
  { rels: ['CLOSER_THAN', 'FURTHER_THAN'],  inv: { CLOSER_THAN: 'FURTHER_THAN', FURTHER_THAN: 'CLOSER_THAN' } },
  // Temporal
  { rels: ['BEFORE', 'AFTER'],              inv: { BEFORE: 'AFTER', AFTER: 'BEFORE' } },
  { rels: ['PRECEDES', 'FOLLOWS'],          inv: { PRECEDES: 'FOLLOWS', FOLLOWS: 'PRECEDES' } },
  // Directional
  { rels: ['LEFT_OF', 'RIGHT_OF'],          inv: { LEFT_OF: 'RIGHT_OF', RIGHT_OF: 'LEFT_OF' } },
  { rels: ['ABOVE', 'BELOW'],               inv: { ABOVE: 'BELOW', BELOW: 'ABOVE' } },
  { rels: ['NORTH_OF', 'SOUTH_OF'],         inv: { NORTH_OF: 'SOUTH_OF', SOUTH_OF: 'NORTH_OF' } },
  { rels: ['EAST_OF', 'WEST_OF'],           inv: { EAST_OF: 'WEST_OF', WEST_OF: 'EAST_OF' } },
  // Semantic chains
  { rels: ['PART_OF', 'CONTAINS'], inv: { PART_OF: 'CONTAINS', CONTAINS: 'PART_OF' } },
  { rels: ['CAUSES', 'DEPENDS_ON'], inv: { CAUSES: 'DEPENDS_ON', DEPENDS_ON: 'CAUSES' } },
  { rels: ['TRANSFORMS_INTO'], inv: {} },
  // Complex composite relations — each treated as its own symmetric family so
  // RINT can chain them (A rel B, B rel C → A rel C) like verbal ones.
  { rels: ['THREE_PAIRS_ONE_DIFFERENT'], inv: {} },
  { rels: ['FOUR_PAIRS_GRID'], inv: {} },
  { rels: ['TWO_OF_THREE_HOLLOW'], inv: {} },
  { rels: ['ODD_COLOR_OUT'], inv: {} },
  { rels: ['ODD_SHAPE_OUT'], inv: {} },
];

// Build a quick lookup: rel → family index
const REL_TO_FAMILY = new Map();
TRANSITIVE_FAMILIES.forEach((fam, idx) => {
  fam.rels.forEach(r => REL_TO_FAMILY.set(r, idx));
});

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomExcluding(arr, ...excl) {
  const filtered = arr.filter(x => !excl.includes(x));
  return filtered.length > 0 ? pickRandom(filtered) : pickRandom(arr);
}

// ─── State ────────────────────────────────────────────────────────────────────

export function createRINTState() {
  return {
    facts: [],
    chainLog: [],
  };
}

// Create an array of independent RINT states (one per stream)
export function createRINTStates(n) {
  return Array.from({ length: n }, () => createRINTState());
}

// ─── Stimulus Generation ──────────────────────────────────────────────────────

/**
 * Generate a RINT stimulus.
 * With probability matchChance (and if a valid chain exists), produce a target
 * stimulus that IS the transitive conclusion of chaining the last N facts.
 * Otherwise produce a new non-target fact and add it to the graph.
 *
 * Returns { stim, isTarget, rintState }
 */
export function generateRINTStimulus(rintState, pool, effectiveN, matchChance) {
  const { facts } = rintState;

  // Filter pool to only transitive relations
  const transitivePool = pool.filter(r => REL_TO_FAMILY.has(r));
  if (transitivePool.length === 0) {
    // fallback: no transitive rels in pool, generate a dummy non-target
    const rel = pickRandom(pool);
    const [eA, eB] = pickTwoEntities();
    const stim = makeRINTStim(eA, rel, eB);
    return { stim, isTarget: false, rintState };
  }

  // Try to generate a target (valid transitive conclusion)
  const canTarget = facts.length >= effectiveN;
  if (canTarget && Math.random() < matchChance) {
    // Take the last `effectiveN` facts and try to chain them
    const chain = facts.slice(-effectiveN);
    const conclusion = tryChainFacts(chain);
    if (conclusion) {
      const famIdx = REL_TO_FAMILY.get(conclusion.rel);
      const family = TRANSITIVE_FAMILIES[famIdx];
      const invRel = family?.inv?.[conclusion.rel];
      
      let finalA = conclusion.entityA;
      let finalRel = conclusion.rel;
      let finalB = conclusion.entityB;
      
      if (invRel && Math.random() < 0.5) {
        finalA = conclusion.entityB;
        finalRel = invRel;
        finalB = conclusion.entityA;
      }
      
      const stim = makeRINTStim(finalA, finalRel, finalB);
      // Don't add the conclusion to facts — it's a derived truth, not a new assertion
      return {
        stim,
        isTarget: true,
        rintState: { ...rintState }, // unchanged
      };
    }
  }

  // Generate a new non-target fact. When extending a chain, keep the same
  // relation direction or cycle within the same transitive family!
  let rel = pickRandom(transitivePool);
  let entityA, entityB;
  if (facts.length > 0 && Math.random() < 0.7) {
    const lastFact = facts[facts.length - 1];
    const lastFamIdx = REL_TO_FAMILY.get(lastFact.rel);
    if (lastFamIdx !== undefined) {
      const family = TRANSITIVE_FAMILIES[lastFamIdx];
      const familyPool = family.rels.filter(r => transitivePool.includes(r));
      if (familyPool.length > 0) {
        rel = pickRandom(familyPool);
        const lastCanonical = family.rels[0];
        const lastInverse = family.rels[1];
        let lastChild;
        if (lastFact.rel === lastCanonical) {
          lastChild = lastFact.entityB;
        } else if (lastInverse && lastFact.rel === lastInverse) {
          lastChild = lastFact.entityA;
        } else {
          lastChild = lastFact.entityB;
        }
        
        if (rel === lastCanonical || !lastInverse) {
          entityA = lastChild;
          entityB = pickRandomExcluding(ENTITIES, entityA, lastFact.entityA, lastFact.entityB);
        } else {
          entityB = lastChild;
          entityA = pickRandomExcluding(ENTITIES, entityB, lastFact.entityA, lastFact.entityB);
        }
      } else {
        [entityA, entityB] = pickTwoEntities();
      }
    } else {
      [entityA, entityB] = pickTwoEntities();
    }
  } else {
    [entityA, entityB] = pickTwoEntities();
  }

  let newFact = { entityA, rel, entityB };
  const existingConclusion = tryChainFacts(facts.slice(-effectiveN));
  if (factsEqual(existingConclusion, newFact)) {
    if (newFact.entityA === entityA) {
      newFact = { ...newFact, entityB: pickRandomExcluding(ENTITIES, newFact.entityA, newFact.entityB) };
    } else {
      newFact = { ...newFact, entityA: pickRandomExcluding(ENTITIES, newFact.entityB, newFact.entityA) };
    }
  }
  const nextFacts = [...facts, newFact];
  const nextChainLog = nextFacts.slice(-Math.max(effectiveN + 1, 4));
  const stim = makeRINTStim(newFact.entityA, newFact.rel, newFact.entityB);

  return {
    stim,
    isTarget: false,
    rintState: { facts: nextFacts, chainLog: nextChainLog },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickTwoEntities() {
  const a = pickRandom(ENTITIES);
  const b = pickRandomExcluding(ENTITIES, a);
  return [a, b];
}

// Try to chain an array of facts transitively; returns conclusion or null
function tryChainFacts(chain) {
  if (chain.length < 2) return null;
  
  // Ensure all facts belong to the same family
  const firstFamIdx = REL_TO_FAMILY.get(chain[0].rel);
  if (firstFamIdx === undefined) return null;
  for (let i = 1; i < chain.length; i++) {
    if (REL_TO_FAMILY.get(chain[i].rel) !== firstFamIdx) return null;
  }
  
  const family = TRANSITIVE_FAMILIES[firstFamIdx];
  const canonical = family.rels[0];
  const inverse = family.rels[1]; // might be undefined for non-invertible families
  
  // Build adjacency list for Greater-Than relations: parent -> child
  // also collect all unique entities
  const adj = {};
  const inDegree = {};
  const allEntities = new Set();
  
  function addEdge(u, v) {
    if (!adj[u]) adj[u] = [];
    adj[u].push(v);
    inDegree[v] = (inDegree[v] || 0) + 1;
    if (inDegree[u] === undefined) inDegree[u] = 0;
    allEntities.add(u);
    allEntities.add(v);
  }
  
  for (const fact of chain) {
    const { entityA, rel, entityB } = fact;
    if (rel === canonical) {
      addEdge(entityA, entityB);
    } else if (inverse && rel === inverse) {
      addEdge(entityB, entityA);
    } else {
      // Single direction or symmetric
      addEdge(entityA, entityB);
    }
  }
  
  // To have a single complete chain, we need exactly one source (in-degree 0) 
  // and all nodes connected in a single line.
  const sources = [];
  for (const ent of allEntities) {
    if (!inDegree[ent]) {
      sources.push(ent);
    }
  }
  
  if (sources.length !== 1) return null;
  
  let current = sources[0];
  const visited = new Set([current]);
  
  // Follow the single path
  while (adj[current] && adj[current].length === 1) {
    current = adj[current][0];
    if (visited.has(current)) {
      return null;
    }
    visited.add(current);
  }
  
  // If we visited all entities in the chain, we have a complete path!
  if (visited.size === allEntities.size) {
    return { entityA: sources[0], rel: canonical, entityB: current };
  }
  
  return null;
}

function factsEqual(a, b) {
  return !!a && !!b && a.entityA === b.entityA && a.rel === b.rel && a.entityB === b.entityB;
}

export function isRINTConclusion(rintState, stim, effectiveN) {
  if (!rintState || !stim || !stim.wordA || !stim.wordB || effectiveN < RINT_MIN_N) return false;
  const conclusion = tryChainFacts((rintState.facts || []).slice(-effectiveN));
  if (!conclusion) return false;
  
  const canonicalMatch = factsEqual(conclusion, { entityA: stim.wordA, rel: stim.rel, entityB: stim.wordB });
  if (canonicalMatch) return true;
  
  const famIdx = REL_TO_FAMILY.get(conclusion.rel);
  if (famIdx !== undefined) {
    const family = TRANSITIVE_FAMILIES[famIdx];
    const invRel = family.inv?.[conclusion.rel];
    if (invRel && conclusion.entityA === stim.wordB && invRel === stim.rel && conclusion.entityB === stim.wordA) {
      return true;
    }
  }
  
  return false;
}

// Make a stimulus object for RINT (verbal-style with entity names as tokens)
function makeRINTStim(entityA, rel, entityB) {
  return {
    rel,
    wordA: entityA,
    wordB: entityB,
    // Use a fixed renderMode=0 (text mode) for RINT so entity names are clear
    renderMode: 0,
    // Provide dummy shape/color fields to satisfy the engine
    shapeA: 'circle',
    shapeB: 'square',
    colorA: '#22d3ee',
    colorB: '#a78bfa',
    isRINTStim: true,
  };
}
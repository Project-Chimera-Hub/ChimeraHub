// Trajectory N-Back graph topology generators.
//
// Each topology returns an object with:
//   nodes:     number[]            — node ids 0..N-1
//   adjacency: number[][]          — undirected neighbour lists
//   positions: {x,y}[]             — pre-computed layout in [0,1]^2
//   label:     string              — human-readable topology name
//
// All graphs are connected and use small node counts (5-9) so a player can
// internalize the map within a session.

const TAU = Math.PI * 2;

function emptyAdj(n) {
  return Array.from({ length: n }, () => []);
}

function addEdge(adj, a, b) {
  if (a === b) return;
  if (!adj[a].includes(b)) adj[a].push(b);
  if (!adj[b].includes(a)) adj[b].push(a);
}

function ringPositions(n, cx = 0.5, cy = 0.5, r = 0.36) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * TAU - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

// 1. Ring — pure cycle. 5-7 nodes.
export function ringGraph(n = 6) {
  const adj = emptyAdj(n);
  for (let i = 0; i < n; i++) addEdge(adj, i, (i + 1) % n);
  return {
    nodes: Array.from({ length: n }, (_, i) => i),
    adjacency: adj,
    positions: ringPositions(n),
    label: 'Ring',
    family: 'ring',
  };
}

// 2. Ring + shortcuts — Watts-Strogatz-ish small-world.
// Adds one or two cross-cutting chords so 2-step occupancy varies.
export function ringPlusShortcutsGraph(n = 6, shortcuts = null) {
  const adj = emptyAdj(n);
  for (let i = 0; i < n; i++) addEdge(adj, i, (i + 1) % n);
  const count = shortcuts == null ? Math.max(1, Math.floor(n / 4)) : shortcuts;
  for (let k = 0; k < count; k++) {
    const a = Math.floor(Math.random() * n);
    let b = (a + 2 + Math.floor(Math.random() * (n - 3))) % n;
    if (b === a) b = (a + 2) % n;
    addEdge(adj, a, b);
  }
  return {
    nodes: Array.from({ length: n }, (_, i) => i),
    adjacency: adj,
    positions: ringPositions(n),
    label: 'Ring + Shortcuts',
    family: 'small_world',
  };
}

// 3. Tree — balanced binary-ish tree, hierarchical.
export function treeGraph(n = 7) {
  const adj = emptyAdj(n);
  for (let i = 1; i < n; i++) {
    const parent = Math.floor((i - 1) / 2);
    addEdge(adj, parent, i);
  }
  // Layout: root at top, levels distributed vertically.
  const positions = Array.from({ length: n }, (_, i) => {
    const depth = Math.floor(Math.log2(i + 1));
    const levelStart = Math.pow(2, depth) - 1;
    const levelSize = Math.pow(2, depth);
    const indexInLevel = i - levelStart;
    const maxDepth = Math.floor(Math.log2(n));
    const x = (indexInLevel + 0.5) / levelSize;
    const y = (depth + 0.5) / (maxDepth + 1);
    return { x: 0.1 + 0.8 * x, y: 0.1 + 0.75 * y };
  });
  return {
    nodes: Array.from({ length: n }, (_, i) => i),
    adjacency: adj,
    positions,
    label: 'Tree',
    family: 'tree',
  };
}

// 4. Lattice — 2×3 or 3×3 grid. n must be product of two integers ≥2.
export function latticeGraph(rows = 2, cols = 3) {
  const n = rows * cols;
  const adj = emptyAdj(n);
  const idx = (r, c) => r * cols + c;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) addEdge(adj, idx(r, c), idx(r, c + 1));
      if (r + 1 < rows) addEdge(adj, idx(r, c), idx(r + 1, c));
    }
  }
  const positions = Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const x = cols === 1 ? 0.5 : 0.15 + 0.7 * (c / (cols - 1));
    const y = rows === 1 ? 0.5 : 0.15 + 0.7 * (r / (rows - 1));
    return { x, y };
  });
  return {
    nodes: Array.from({ length: n }, (_, i) => i),
    adjacency: adj,
    positions,
    label: `Lattice ${rows}×${cols}`,
    family: 'lattice',
  };
}

// 5. Random — Erdős-Rényi with rejection sampling for connectivity.
export function randomGraph(n = 6, edgeProb = 0.45) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const adj = emptyAdj(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.random() < edgeProb) addEdge(adj, i, j);
      }
    }
    // ensure connected: BFS from 0, must reach all
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const v = queue.shift();
      for (const u of adj[v]) if (!seen.has(u)) { seen.add(u); queue.push(u); }
    }
    if (seen.size === n) {
      return {
        nodes: Array.from({ length: n }, (_, i) => i),
        adjacency: adj,
        positions: ringPositions(n),
        label: 'Random',
        family: 'random',
      };
    }
  }
  // fallback to ring+shortcuts if rejection failed
  return ringPlusShortcutsGraph(n);
}

// ── Topology dispatcher ────────────────────────────────────────────────────
export const TJN_TOPOLOGY_FAMILIES = ['ring', 'small_world', 'tree', 'lattice', 'random'];

export function buildTopology(family, opts = {}) {
  const { nodes = 6 } = opts;
  switch (family) {
    case 'ring':         return ringGraph(nodes);
    case 'small_world':  return ringPlusShortcutsGraph(nodes);
    case 'tree':         return treeGraph(Math.max(3, nodes));
    case 'lattice': {
      // pick a sensible rows/cols pair for the requested node count
      if (nodes <= 4) return latticeGraph(2, 2);
      if (nodes <= 6) return latticeGraph(2, 3);
      if (nodes <= 9) return latticeGraph(3, 3);
      return latticeGraph(3, 4);
    }
    case 'random':       return randomGraph(nodes);
    default:             return ringPlusShortcutsGraph(nodes);
  }
}

// ── Random walk planner ─────────────────────────────────────────────────────
// Plans a walk of given length over the graph. Used at session start so the
// engine can deterministically replay the same sequence even if the
// `Math.random` stream is consumed elsewhere between trials.
export function planRandomWalk(graph, length, startNode = null) {
  const walk = [];
  let cur = startNode == null
    ? Math.floor(Math.random() * graph.nodes.length)
    : startNode;
  walk.push(cur);
  for (let i = 1; i < length; i++) {
    const neighbours = graph.adjacency[cur];
    if (!neighbours.length) break;
    cur = neighbours[Math.floor(Math.random() * neighbours.length)];
    walk.push(cur);
  }
  return walk;
}

// ── BFS shortest-path utilities ────────────────────────────────────────────
export function shortestPath(graph, start, target) {
  if (start === target) return [start];
  const prev = new Map();
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const v = queue.shift();
    for (const u of graph.adjacency[v]) {
      if (seen.has(u)) continue;
      seen.add(u);
      prev.set(u, v);
      if (u === target) {
        const path = [u];
        let p = u;
        while (prev.has(p)) { p = prev.get(p); path.unshift(p); }
        return path;
      }
      queue.push(u);
    }
  }
  return null;
}

// Distance in edges; Infinity if disconnected.
export function nodeDistance(graph, a, b) {
  const p = shortestPath(graph, a, b);
  return p ? p.length - 1 : Infinity;
}

// All nodes reachable in EXACTLY k steps from start (allowing revisits).
// Returns a Set of node ids.
export function kStepReachable(graph, start, k) {
  if (k < 0) return new Set();
  if (k === 0) return new Set([start]);
  let frontier = new Set([start]);
  for (let step = 0; step < k; step++) {
    const next = new Set();
    for (const v of frontier) {
      for (const u of graph.adjacency[v]) next.add(u);
    }
    frontier = next;
  }
  return frontier;
}

// ── Target evaluators for each TJN tier ───────────────────────────────────
// All evaluators take the same args so the engine dispatch is uniform.
//
//   currentNode  number  — node the player is currently on
//   nBackNode    number  — node at trial t-N
//   graph        Graph
//   K            number  — successor horizon (Hard tier)
//   goalNode     number  — destination for revaluation (Extreme tier)
//
// Tiers:
//   easy     — current === nBack (pure WM on node identity)
//   medium   — current is a direct neighbour of nBack
//   hard     — current is reachable in EXACTLY K steps from nBack
//   extreme  — current sits on the shortest path nBack → goal
export function evalTJNTarget({ tier, currentNode, nBackNode, graph, K = 2, goalNode = null }) {
  if (nBackNode == null || currentNode == null) return false;
  if (tier === 'easy') {
    return currentNode === nBackNode;
  }
  if (tier === 'medium') {
    return graph.adjacency[nBackNode]?.includes(currentNode) || false;
  }
  if (tier === 'hard') {
    return kStepReachable(graph, nBackNode, K).has(currentNode);
  }
  if (tier === 'extreme') {
    if (goalNode == null || goalNode === nBackNode) return false;
    const path = shortestPath(graph, nBackNode, goalNode);
    if (!path) return false;
    // Player is "on path" if current is one of the intermediate nodes.
    // The endpoints don't count — that would trivialize trial 1.
    return path.slice(1, -1).includes(currentNode);
  }
  return false;
}

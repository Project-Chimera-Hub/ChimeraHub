import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Compass, ChevronLeft, RefreshCw, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

// localStorage key for successor mapping stats
const SUCCESSOR_STATS_KEY = 'goated_successor_stats_v1';

// Graph topology definition (6-node network)
// Every node connects to next neighbor and a cross-cutting shortcut
const GRAPH_CONNECTIONS = {
  0: [1, 3],
  1: [2, 4],
  2: [3, 5],
  3: [4, 0],
  4: [5, 1],
  5: [0, 2]
};

const NODE_LABELS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];

const NODE_THEMES = [
  { bg: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-400', text: 'text-cyan-300', icon: '✦' },
  { bg: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-400', text: 'text-emerald-300', icon: '❖' },
  { bg: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-400', text: 'text-amber-300', icon: '▲' },
  { bg: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-400', text: 'text-violet-300', icon: '●' },
  { bg: 'from-rose-500/20 to-pink-500/20', border: 'border-rose-400', text: 'text-rose-300', icon: '■' },
  { bg: 'from-indigo-500/20 to-sky-500/20', border: 'border-indigo-400', text: 'text-indigo-300', icon: '♦' }
];

function loadStats() {
  try {
    const raw = localStorage.getItem(SUCCESSOR_STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { streak: 0, bestStreak: 0, solved: 0, total: 0, phaseProgress: { learn: 0, successor: 0, revalue: 0 } };
}

function saveStats(stats) {
  try {
    localStorage.setItem(SUCCESSOR_STATS_KEY, JSON.stringify(stats));
  } catch { /* ignore */ }
}

// Simple BFS to find shortest path in our graph
function findShortestPath(start, target) {
  if (start === target) return [start];
  const queue = [[start]];
  const visited = new Set([start]);
  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === target) return path;
    const neighbors = GRAPH_CONNECTIONS[node] || [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push([...path, n]);
      }
    }
  }
  return null;
}

export default function Successor() {
  const [activeTab, setActiveTab] = useState('learn'); // 'learn' | 'successor' | 'revalue'
  const [stats, setStats] = useState(loadStats);
  const [currentGraph, setCurrentGraph] = useState(() => Math.floor(Math.random() * 1000));
  
  // Game states depending on activeTab
  const [startNode, setStartNode] = useState(0);
  const [targetNode, setTargetNode] = useState(1);
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isResolved, setIsResolved] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Pathfinding state for Reward Revaluation (revalue mode)
  const [currentPath, setCurrentPath] = useState([]);
  const [pathTargetNode, setPathTargetNode] = useState(3);
  const [pathStepsCount, setPathStepsCount] = useState(0);

  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  // Generate layouts for interactive graph SVG
  const svgRadius = 130;
  const svgCenter = 160;
  const nodeCoordinates = useMemo(() => {
    return Array.from({ length: 6 }, (_, idx) => {
      const angle = (idx * 2 * Math.PI) / 6 - Math.PI / 2;
      return {
        id: idx,
        x: svgCenter + svgRadius * Math.cos(angle),
        y: svgCenter + svgRadius * Math.sin(angle)
      };
    });
  }, []);

  // Generate a new trial based on current tab
  const nextTrial = useCallback(() => {
    setIsResolved(false);
    setSelectedOption(null);
    setIsCorrect(false);

    if (activeTab === 'learn') {
      // 1-step prediction (learn the transition network)
      const start = Math.floor(Math.random() * 6);
      const validDestinations = GRAPH_CONNECTIONS[start];
      const correctDest = validDestinations[Math.floor(Math.random() * validDestinations.length)];
      
      // Pick an invalid distractor
      const invalidDestinations = Array.from({ length: 6 }, (_, i) => i)
        .filter(i => !validDestinations.includes(i) && i !== start);
      const wrongDest = invalidDestinations[Math.floor(Math.random() * invalidDestinations.length)];
      
      setStartNode(start);
      setTargetNode(correctDest);
      setOptions(Math.random() < 0.5 ? [correctDest, wrongDest] : [wrongDest, correctDest]);
    } 
    else if (activeTab === 'successor') {
      // 2-step prediction (occupancy prediction / successor states)
      const start = Math.floor(Math.random() * 6);
      
      // Calculate direct 2-step successor occupancy distribution
      // A direct walk from start: we can go to two possible neighbors.
      // From those, we can go to their neighbors.
      const step1Dests = GRAPH_CONNECTIONS[start];
      const step2Dests = [];
      step1Dests.forEach(s1 => {
        const dests = GRAPH_CONNECTIONS[s1] || [];
        dests.forEach(s2 => step2Dests.push(s2));
      });

      // Find the most frequent 2-step occupancy (successor node)
      const counts = {};
      step2Dests.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
      let bestDest = null;
      let maxCount = -1;
      Object.keys(counts).forEach(k => {
        const val = Number(k);
        if (counts[val] > maxCount) {
          maxCount = counts[val];
          bestDest = val;
        }
      });

      // Pick an incorrect distractor (a state with low or zero 2-step occupancy)
      const distractors = Array.from({ length: 6 }, (_, i) => i)
        .filter(i => i !== bestDest && i !== start);
      const wrongDest = distractors[Math.floor(Math.random() * distractors.length)];

      setStartNode(start);
      setTargetNode(bestDest);
      setOptions(Math.random() < 0.5 ? [bestDest, wrongDest] : [wrongDest, bestDest]);
    }
    else if (activeTab === 'revalue') {
      // Zero-shot Pathfinding with revaluation
      const start = Math.floor(Math.random() * 6);
      let target = Math.floor(Math.random() * 6);
      while (target === start) {
        target = Math.floor(Math.random() * 6);
      }
      setStartNode(start);
      setPathTargetNode(target);
      setCurrentPath([start]);
      setPathStepsCount(0);
    }
  }, [activeTab]);

  useEffect(() => {
    nextTrial();
  }, [activeTab, currentGraph, nextTrial]);

  // Handle option select in Multiple Choice modes
  const handleSelectOption = useCallback((option) => {
    if (isResolved) return;
    setSelectedOption(option);
    setIsResolved(true);
    const correct = option === targetNode;
    setIsCorrect(correct);

    setStats(prev => {
      const newStreak = correct ? prev.streak + 1 : 0;
      const progress = { ...prev.phaseProgress };
      if (correct) {
        progress[activeTab] = Math.min(100, (progress[activeTab] || 0) + 10);
      }
      return {
        solved: prev.solved + (correct ? 1 : 0),
        total: prev.total + 1,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak || 0, newStreak),
        phaseProgress: progress
      };
    });
  }, [isResolved, targetNode, activeTab]);

  // Handle path node clicks in Revaluation navigation mode
  const handlePathNodeClick = useCallback((node) => {
    if (activeTab !== 'revalue' || isResolved) return;
    
    const currentPos = currentPath[currentPath.length - 1];
    const validDests = GRAPH_CONNECTIONS[currentPos] || [];

    if (!validDests.includes(node)) {
      // Flash error (invalid transition click)
      return;
    }

    const nextPath = [...currentPath, node];
    setCurrentPath(nextPath);
    setPathStepsCount(prev => prev + 1);

    if (node === pathTargetNode) {
      // Reached the target star! Verify if it's the absolute shortest path
      const shortest = findShortestPath(startNode, pathTargetNode);
      const isOptimal = nextPath.length <= shortest.length;
      
      setIsResolved(true);
      setIsCorrect(isOptimal);

      setStats(prev => {
        const newStreak = isOptimal ? prev.streak + 1 : 0;
        const progress = { ...prev.phaseProgress };
        if (isOptimal) {
          progress.revalue = Math.min(100, (progress.revalue || 0) + 15);
        }
        return {
          solved: prev.solved + (isOptimal ? 1 : 0),
          total: prev.total + 1,
          streak: newStreak,
          bestStreak: Math.max(prev.bestStreak || 0, newStreak),
          phaseProgress: progress
        };
      });
    }
  }, [activeTab, isResolved, currentPath, pathTargetNode, startNode]);

  const accuracy = stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background p-3 sm:p-6"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <Compass className="w-6 h-6 text-indigo-400 animate-pulse" />
            <div>
              <h1 className="text-lg sm:text-xl font-mono font-bold text-foreground tracking-tight">Successor Mapping</h1>
              <p className="text-[10px] font-mono text-muted-foreground">Hippocampal Predictive Map Training · Relational Transition Topology</p>
            </div>
          </div>
          <Link to="/" className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground text-xs font-mono font-semibold transition-colors flex items-center gap-1.5">
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Link>
        </div>

        {/* Cognitive Modes Selector Tab */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-secondary/20 border border-border rounded-xl font-mono">
          {[
            { id: 'learn', label: '1. Structure Discovery', desc: 'Predict 1-step' },
            { id: 'successor', label: '2. Successor Projection', desc: 'Predict 2-step occupancy' },
            { id: 'revalue', label: '3. Reward Revalue', desc: 'Optimal path shortcuts' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setStats(prev => ({ ...prev, streak: 0 })); // reset session streak on tab shift
              }}
              className={`py-2 px-1 rounded-lg text-center transition-all duration-150 ${activeTab === tab.id ? 'bg-indigo-500 text-white shadow-lg' : 'hover:bg-secondary/40 text-muted-foreground'}`}
            >
              <div className="text-[10px] sm:text-xs font-bold leading-tight">{tab.label}</div>
              <div className="text-[8px] opacity-70 hidden sm:block mt-0.5">{tab.desc}</div>
            </button>
          ))}
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-4 gap-2 text-center font-mono">
          {[
            { label: 'Active Streak', value: stats.streak, color: 'text-indigo-400' },
            { label: 'Trophy Solved', value: `${stats.solved}/${stats.total}`, color: 'text-primary' },
            { label: 'Overall accuracy', value: `${accuracy}%`, color: accuracy >= 75 ? 'text-emerald-400' : accuracy >= 50 ? 'text-amber-400' : 'text-red-400' },
            { label: 'Map Mastery', value: `${stats.phaseProgress[activeTab] || 0}%`, color: 'text-emerald-400' }
          ].map(s => (
            <div key={s.label} className="bg-secondary/30 border border-border rounded-lg p-2">
              <div className={`text-sm sm:text-base font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Visual interactive graph board */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          
          {/* Column Left: Visual Map rendering */}
          <div className="md:col-span-6 bg-secondary/10 border border-border rounded-2xl p-4 flex flex-col items-center justify-center min-h-[340px] relative overflow-hidden">
            <div className="absolute top-2 left-2 flex gap-1 items-center">
              <span className="text-[9px] font-mono text-indigo-400 font-bold uppercase bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Predictive Map (Graph 6)
              </span>
            </div>

            <button 
              onClick={() => setCurrentGraph(g => g + 1)}
              className="absolute top-2 right-2 p-1.5 bg-secondary/50 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Generate new topological map"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* SVG Renderer of the predictive map */}
            <svg width="320" height="320" className="drop-shadow-[0_4px_16px_rgba(99,102,241,0.06)] z-10">
              {/* Edges / Connections */}
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 2 L 10 5 L 0 8 z" fill="rgba(148, 163, 184, 0.45)" />
                </marker>
                <marker id="arrow-highlight" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 2 L 10 5 L 0 8 z" fill="#6366f1" />
                </marker>
              </defs>

              {/* Draw path lines */}
              {Object.entries(GRAPH_CONNECTIONS).map(([sourceStr, targets]) => {
                const src = Number(sourceStr);
                const fromCoords = nodeCoordinates[src];
                return targets.map(tgt => {
                  const toCoords = nodeCoordinates[tgt];
                  
                  // Check if this connection is currently active in the user's navigated path (revalue mode)
                  let isPathLine = false;
                  if (activeTab === 'revalue') {
                    for (let i = 0; i < currentPath.length - 1; i++) {
                      if (currentPath[i] === src && currentPath[i + 1] === tgt) {
                        isPathLine = true;
                        break;
                      }
                    }
                  }

                  return (
                    <line
                      key={`${src}-${tgt}`}
                      x1={fromCoords.x}
                      y1={fromCoords.y}
                      x2={toCoords.x}
                      y2={toCoords.y}
                      stroke={isPathLine ? '#6366f1' : 'rgba(148, 163, 184, 0.28)'}
                      strokeWidth={isPathLine ? 2.5 : 1.5}
                      markerEnd={isPathLine ? 'url(#arrow-highlight)' : 'url(#arrow)'}
                      strokeDasharray={!isPathLine && activeTab === 'revalue' ? '4 3' : 'none'}
                    />
                  );
                });
              })}

              {/* Draw Nodes */}
              {nodeCoordinates.map(node => {
                const theme = NODE_THEMES[node.id];
                const isStart = node.id === startNode;
                const isTarget = node.id === targetNode;
                const isPathTarget = activeTab === 'revalue' && node.id === pathTargetNode;
                const isVisited = activeTab === 'revalue' && currentPath.includes(node.id);
                const currentPos = activeTab === 'revalue' && currentPath[currentPath.length - 1] === node.id;
                
                let ringCls = 'stroke-border';
                let fillCls = 'fill-secondary/35';
                
                if (isStart) {
                  ringCls = 'stroke-indigo-400 stroke-[3px]';
                  fillCls = 'fill-indigo-500/10';
                } else if (currentPos) {
                  ringCls = 'stroke-indigo-400 stroke-[3.5px] animate-pulse';
                  fillCls = 'fill-indigo-500/20';
                } else if (isVisited) {
                  ringCls = 'stroke-indigo-500/60 stroke-2';
                  fillCls = 'fill-indigo-500/5';
                }

                return (
                  <g 
                    key={node.id} 
                    className="cursor-pointer select-none group"
                    onClick={() => handlePathNodeClick(node.id)}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="22"
                      className={`transition-all duration-150 ${fillCls} ${ringCls} group-hover:fill-secondary/60`}
                    />
                    
                    {/* Unique geometric token inside node */}
                    <text
                      x={node.x}
                      y={node.y + 4}
                      textAnchor="middle"
                      className={`text-xs font-mono font-bold ${theme.text}`}
                    >
                      {theme.icon}
                    </text>

                    {/* Numeric Node Label */}
                    <text
                      x={node.x}
                      y={node.y + 35}
                      textAnchor="middle"
                      className={`text-[9px] font-mono tracking-widest ${isStart || currentPos ? 'text-indigo-300 font-bold' : 'text-muted-foreground/60'}`}
                    >
                      {NODE_LABELS[node.id]}
                    </text>

                    {/* Floating star for revalue mode */}
                    {isPathTarget && (
                      <g className="animate-bounce">
                        <circle cx={node.x} cy={node.y - 32} r="8" className="fill-amber-400 stroke-amber-200 stroke-1 shadow-lg" />
                        <text x={node.x} y={node.y - 29} textAnchor="middle" className="text-[10px] fill-background">★</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Column Right: Interactive Trial controls */}
          <div className="md:col-span-6 flex flex-col justify-between space-y-4">
            
            {/* Context/Prompt Panel */}
            <div className="bg-secondary/20 border border-border/80 rounded-2xl p-4 font-mono space-y-3 flex-1 flex flex-col justify-center">
              
              {activeTab === 'learn' && (
                <>
                  <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Discovery Phase</div>
                  <h3 className="text-sm font-bold text-foreground">Where does {NODE_LABELS[startNode]}'s path lead?</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Identify a direct connection from **{NODE_LABELS[startNode]}** (the highlighted indigo node). Study how the nodes link!
                  </p>
                </>
              )}

              {activeTab === 'successor' && (
                <>
                  <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Successor Prediction</div>
                  <h3 className="text-sm font-bold text-foreground">Where will you be 2 steps from {NODE_LABELS[startNode]}?</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    If you take a 2-step transition starting at **{NODE_LABELS[startNode]}**, which successor state has the highest probability of occupancy?
                  </p>
                </>
              )}

              {activeTab === 'revalue' && (
                <>
                  <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Goal Revaluation Pathfinding</div>
                  <h3 className="text-sm font-bold text-foreground">Navigate from {NODE_LABELS[startNode]} to {NODE_LABELS[pathTargetNode]} ★</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Click the transition links sequentially to chart the absolute shortest path to reach the gold star. Minimal steps only!
                  </p>
                  
                  {/* Active Path Tracker */}
                  <div className="bg-background/40 border border-border p-2 rounded-lg text-[10px] flex items-center gap-1 overflow-x-auto">
                    <span className="text-muted-foreground uppercase font-bold">Path:</span>
                    {currentPath.map((node, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="text-indigo-400">→</span>}
                        <span className="bg-secondary px-1.5 py-0.5 rounded text-foreground font-semibold">
                          {NODE_LABELS[node]}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}

              {/* Feedback Block */}
              <AnimatePresence>
                {isResolved && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg border text-xs leading-relaxed ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}
                  >
                    {isCorrect ? (
                      <div>
                        <strong>✓ Perfect Map Alignment!</strong> {activeTab === 'revalue' 
                          ? `You found the optimal path in exactly ${pathStepsCount} steps.` 
                          : `Correct! You correctly predicted the state transitions.`}
                      </div>
                    ) : (
                      <div>
                        <strong>✗ Predictive Map Mismatch!</strong> {activeTab === 'revalue' 
                          ? `Not the absolute shortest path. Keep studying the graph shortcuts.` 
                          : `The correct target was ${NODE_LABELS[targetNode]}.`}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Interactive choices / actions */}
            <div className="space-y-3 font-mono">
              
              {/* Option Selector for Learn / Successor tabs */}
              {activeTab !== 'revalue' && (
                <div className="grid grid-cols-2 gap-3">
                  {options.map((opt, idx) => {
                    const label = NODE_LABELS[opt];
                    const isChoiceSelected = selectedOption === opt;
                    
                    let btnStyle = 'border-border bg-secondary/40 text-foreground hover:bg-secondary/80';
                    if (isResolved) {
                      if (opt === targetNode) btnStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-300';
                      else if (isChoiceSelected) btnStyle = 'border-red-500 bg-red-500/10 text-red-300';
                      else btnStyle = 'border-border opacity-50 bg-secondary/20';
                    }

                    return (
                      <button
                        key={opt}
                        onClick={() => handleSelectOption(opt)}
                        disabled={isResolved}
                        className={`w-full py-4 border-2 rounded-xl text-center text-xs font-semibold transition-all duration-150 flex flex-col items-center gap-1.5 ${btnStyle}`}
                      >
                        <span className="text-[10px] uppercase text-muted-foreground tracking-widest font-bold">Option {String.fromCharCode(65 + idx)}</span>
                        <span className="text-sm font-bold">{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex gap-2">
                {activeTab === 'revalue' && !isResolved && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentPath([startNode]);
                      setPathStepsCount(0);
                    }}
                    className="w-1/2 font-mono text-xs gap-1.5"
                  >
                    Reset Path
                  </Button>
                )}
                
                <Button
                  onClick={nextTrial}
                  className={`font-mono text-xs gap-1.5 bg-indigo-500 text-white hover:bg-indigo-600 ${activeTab === 'revalue' && !isResolved ? 'w-1/2' : 'w-full'}`}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> {isResolved ? 'Next Trial' : 'Skip / Regenerate'}
                </Button>
              </div>
            </div>

          </div>
        </div>

        {/* Dynamic Concept Explanation Panel */}
        <div className="bg-secondary/15 border border-border/60 rounded-2xl p-4 font-mono text-[10px] sm:text-xs leading-relaxed text-muted-foreground/80 space-y-2">
          <div className="flex items-center gap-1.5 text-indigo-400 font-bold uppercase text-[10px] sm:text-xs">
            <Trophy className="w-4 h-4" /> Why does this target the Hippocampal Successor Representation?
          </div>
          <p>
            Unlike typical working memory training, this protocol works on the brain's <strong>GPS and predictive map system</strong> (Hippocampus/Entorhinal).
          </p>
          <ul className="list-disc list-inside pl-1 space-y-1.5">
            <li>
              <strong>Structure Discovery (Phase 1):</strong> Encodes the transition probabilities matrix $T(s, s')$ through sequence prediction.
            </li>
            <li>
              <strong>Successor Expectancy (Phase 2):</strong> Directly builds the predictive vector of expected future occupancy—the core of the <strong>Successor Representation (SR)</strong>.
            </li>
            <li>
              <strong>Goal Revaluation (Phase 3):</strong> Forces zero-shot value propagation. If a target reward changes location (revalues), an SR-mapped brain instantly calculates the shortcut path without having to recalculate transition weights.
            </li>
          </ul>
        </div>

      </div>
    </motion.div>
  );
}

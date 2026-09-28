import React from 'react';
import { Button } from '@/components/ui/button';
import { Brain, Zap, TrendingUp, Layers, GitBranch, Shuffle, ChevronDown, ChevronUp, Plus, Minus, Eye, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RELATIONSHIP_CATEGORIES, setTokenWeights, getTokenWeights, filterTransitiveRelationships, COACH_PHASES, TJN_TIERS, TJN_TIER_META, TJN_TOPOLOGY_LABELS, TJN_DEFAULT_TIER, TJN_DEFAULT_TOPOLOGY, TJN_DEFAULT_NODES, TJN_HARD_K } from '@/lib/gameConstants';
import { migrateCoachState, pickNextPhase, masteryLabel, difficultyOrder, phaseDisplayTitle } from '@/lib/coachMastery';
import { computeCapacityCredits, tierLabel } from '@/lib/farTransfer';
import { NRINT_FLAGS, NRINT_FLAG_META, NRINT_MATCH_RULES, NRINT_MATCH_RULE_META } from '@/lib/gameEngine';
import { getSettings, saveSettings, getSessions, getAssessments } from '@/lib/localStorageManager';

// Build a weighted pool from category weights + enabled rels
// Each category's rels are repeated proportionally to its weight
function buildWeightedPool(enabledRels, catWeights) {
  const REPEAT = 10; // granularity
  const pool = [];
  const cats = Object.keys(RELATIONSHIP_CATEGORIES);
  const totalWeight = cats.reduce((s, c) => s + (catWeights[c] || 0), 0);
  if (totalWeight === 0) return [...enabledRels];
  for (const cat of cats) {
    const w = catWeights[cat] || 0;
    if (w === 0) continue;
    const members = RELATIONSHIP_CATEGORIES[cat].filter(r => enabledRels.has(r));
    if (members.length === 0) continue;
    const repeats = Math.max(1, Math.round((w / totalWeight) * REPEAT * cats.length));
    for (let i = 0; i < repeats; i++) pool.push(...members);
  }
  return pool.length > 0 ? pool : [...enabledRels];
}

const MODE_OPTIONS = [
  // Easiest / Foundational (Feedback & Lures)
  { id: 'feedback_per_trial', icon: Brain, label: 'Per-Trial Feedback', desc: 'After every trial, each stream briefly flashes a result tag (hit · miss · correct rejection · false alarm) — designed to accelerate learning of the rules.', phase: "Phase A: Foundational Support & Interference Control" },
  { id: 'distractors',   icon: Shuffle,    label: 'Distractors',       desc: 'Near-match stimuli from the same category create interference in normal mode.', phase: "Phase A: Foundational Support & Interference Control" },
  { id: 'lures',         icon: Zap,        label: 'Lure Trials',       desc: 'About 1 in 5 non-target trials becomes a near-miss: a stim that would match at N-1 or N+1 instead of N. The careful counter rejects; the loose counter false-alarms. Trains interference resistance. Tracked as a separate "lure FA rate" in results.', minN: 2, phase: "Phase A: Foundational Support & Interference Control" },
  { id: 'negation',      icon: GitBranch,  label: 'Negation',          desc: 'About 30 % of trials are flipped to ¬ (red badge in the corner). The visual stays the same but the logical fact is inverted — "A NOT inside B". An n-back match requires both the relation AND the negation flag to agree, so the player must read the ¬ to score.', minN: 2, phase: "Phase A: Foundational Support & Interference Control" },

  // Medium / Complexity Layers (Control & Arithmetic)
  { id: 'cct',           icon: Brain,      label: 'Cognitive Control Training', desc: 'Each trial shows one digit (1–9). From trial N onwards a candidate result also appears. Press REL when the result equals the current digit + the digit from N trials ago. Pure arithmetic working-memory — no relations or shapes.', phase: "Phase B: Working-Memory & Logic Layers" },
  { id: 'cct_overlay',   icon: Brain,      label: 'CCT Side-Task',     desc: 'Layers CCT arithmetic onto every relation stream as a separate response axis (like alien-square adds a position axis). Each stream then has REL (relation match), CCT (digit + N-back == result), and POS keys if alien mode is also on.', phase: "Phase B: Working-Memory & Logic Layers" },
  { id: 'rst_overlay',   icon: GitBranch,  label: 'RST Side-Task (Reasoning)', desc: 'About 1 in 4 trials gets a tiny premise / conclusion box overlaid on stream A — e.g., "α more than β, β more than γ. ∴ α more than γ?" Press the RST key when the conclusion is logically valid. Layered on top of n-back, the way CCT is, but trains deductive inference instead of arithmetic. Premise generators ported from Syllogimous v3 (CC BY-NC).', minN: 2, phase: "Phase B: Working-Memory & Logic Layers" },
  { id: 'variable_n',    icon: Shuffle,    label: 'Variable N',        desc: 'N changes randomly each trial (±1 around your chosen N). Forces flexible updating.', phase: "Phase B: Working-Memory & Logic Layers" },
  { id: 'adaptive',      icon: TrendingUp, label: 'Adaptive N',        desc: 'N auto-adjusts between sessions based on accuracy (≥80% → up, ≤50% → down).', phase: "Phase B: Working-Memory & Logic Layers" },
  { id: 'adaptive_closed_loop', icon: TrendingUp, label: 'Closed-Loop Adaptivity', desc: 'Dynamically scales speeds, lure rates, and negation levels continuously inside a session based on your real-time performance. High accuracy speeds up the flow and multiplies lures; low accuracy slows down parameters.', phase: "Phase B: Working-Memory & Logic Layers" },

  // Hard / Dynamic Rules (Integration & Multitasking)
  { id: 'type_nback',    icon: Brain,      label: 'Type N-Back',       desc: 'Each relation type has its own N-back queue. Match fires when this relation appeared N times ago in its own history — regardless of trial distance. Very hard.', phase: "Phase C: Memory Integration & Dynamic Rules" },
  { id: 'rint',          icon: GitBranch,  label: 'Relational Integration', desc: 'Entities (alpha, beta…) persist across trials. A target fires when the current stimulus is a VALID logical conclusion from chaining the N previous facts (e.g. A>B, B>C → A>C). Requires N≥2.', minN: 2, phase: "Phase C: Memory Integration & Dynamic Rules" },
  { id: 'nonverbal_rint',icon: GitBranch,  label: 'Nonverbal RINT',    desc: 'Each stimulus carries up to 14 independent binary attributes — 8 visual (touching · hollow · size-mismatch · rotated · dashed · glow · mirrored · striped) + 6 audio (tone · high-pitch · loud · long · rhythmic · warm). A target fires when the current stim\'s attribute set equals the union of some non-empty subset of the last N stims. Genuinely cross-modal. Requires N≥2.', minN: 2, phase: "Phase C: Memory Integration & Dynamic Rules" },
  { id: 'mixed_nback',   icon: Shuffle,    label: 'Mixed N-Back',      desc: 'Randomly switches between Normal and Type N-back each trial. You never know which rule applies.', phase: "Phase C: Memory Integration & Dynamic Rules" },
  { id: 'mixed_rint',    icon: Shuffle,    label: 'Mixed RINT',        desc: 'Three-way random per trial: Normal / Type / RINT. Maximum flexibility demand. Requires N≥2.', minN: 2, phase: "Phase C: Memory Integration & Dynamic Rules" },
  { id: 'wrapper_morph', icon: Shuffle,    label: 'Wrapper Morphing Mode', desc: 'Combines dynamic visual theme morphing (Cyberpunk, Stark, Glass, Sunset, Matrix) with logical token category morphing mid-session (blocks of 5 or trial-by-trial). Challenges cognitive set-shifting.', phase: "Phase C: Memory Integration & Dynamic Rules" },
  { id: 'token_blending',icon: Brain,      label: 'Cross-Modal Token Blending', desc: 'Blends verbal words, alphanumeric code letters, and emoji tokens directly inside spatial, trait, and quantitative relationships. Overloads the Episodic Buffer.', phase: "Phase C: Memory Integration & Dynamic Rules" },
  { id: 'binary_logic',  icon: GitBranch,  label: 'Binary Logic',      desc: 'Each trial, each stream is assigned a random pair: <NBack type> <OP> <NBack type> (e.g. NRM AND NOT RINT). A match fires only when the combined boolean condition is true. Shown as live badges on each stream. Requires N≥2.', minN: 2, phase: "Phase C: Memory Integration & Dynamic Rules" },
  { id: 'analogy_nback', icon: GitBranch,  label: 'Analogy N-Back (4-place)', desc: 'Visual 4-place analogy match. The N-back target fires when the CURRENT relation shares a STRUCTURAL FORM with the N-back relation, even if the relation tokens differ (e.g. ABOVE_BELOW ≈ BIGGER_THAN ≈ STACKED — all "directional asymmetric"). Same-token repeats are NOT matches — you have to abstract the form. This is the Halford 4-place rung in visual form — closest mode to what Raven\'s actually measures. Requires N≥2.', minN: 2, phase: "Phase C: Memory Integration & Dynamic Rules" },
  { id: 'trajectory_nback', icon: Compass, label: 'Trajectory N-Back (SR / TEM)', desc: 'Predictive map training — Stachenfeld 2017 + Behrens 2020. Each session generates one or more graphs; you walk through them as random walks. Four tiers progress from pure WM (same node N back) → adjacency → K-step successor → revaluation. Map edges fade after a learning phase forcing you to internalize the topology from memory (true hippocampal SR). Toggle Schema Transfer to enable TEM: multiple graphs share topology family but with fresh surfaces — tests whether you abstract the schema. Targets the hippocampus + entorhinal cortex, a system no other mode in the app trains. Requires N≥2.', minN: 2, phase: "Phase C: Memory Integration & Dynamic Rules" },

  // Spatial & Stress Overloads (Alien Dimensions & Distractors)
  { id: 'alien_square',    icon: Layers,     label: 'Alien Square Mode',    desc: 'Each stream appears inside a rotating 3×3 square. Relation and square position can be answered with separate keys.', phase: "Phase D: Spatial Overloads & Stress Resilience" },
  { id: 'alien_cube',      icon: Layers,     label: 'Alien Cube Mode',      desc: 'Each stream appears inside a rotating transparent 3×3×3 cube. Relation and position can be answered with separate keys.', phase: "Phase D: Spatial Overloads & Stress Resilience" },
  { id: 'alien_tesseract', icon: Layers,     label: 'Alien Tesseract Mode', desc: 'Each stream appears inside a projected 4D tesseract. Position targets include the visible cube cell plus an inner/outer hyperspace layer.', phase: "Phase D: Spatial Overloads & Stress Resilience" },
  { id: 'decoy_filter', icon: Eye, label: 'Decoy Filter (selective attention)', desc: 'Some relation CATEGORIES become decoys you must IGNORE in real time — withhold on them even if they\'d match. Categories are drawn only from your selected relation types; pick them manually or let each stream randomize its own. Two rules: "Never target" (decoys stay in the chain, pressing one = false alarm) or "Removed from chain" (decoys are noise, N-back counts only relevant trials). Trains distractor inhibition / selective attention (Engle\'s controlled-attention construct).', phase: "Phase D: Spatial Overloads & Stress Resilience" },
  { id: 'stress_glitch', icon: Shuffle, label: 'Stress Glitch Engine', desc: 'Randomly injects intense visual glitch distortions into stream cards to overload optical stability.', phase: "Phase D: Spatial Overloads & Stress Resilience" },
  { id: 'stress_shake', icon: Shuffle, label: 'Screen Shake Distractor', desc: 'Triggers intense structural screen shakes to challenge cognitive stability.', phase: "Phase D: Spatial Overloads & Stress Resilience" },
  { id: 'timer_panic', icon: Zap, label: 'Timer Panic Heatbar', desc: 'Renders a shrinking countdown bar that signals imminent trial termination. Creates extreme urgency.', phase: "Phase D: Spatial Overloads & Stress Resilience" },
  { id: 'impossible',    icon: Zap,        label: 'Impossible',        desc: 'Each stream independently randomizes between Normal, Type, and RINT every trial — different rules per stream simultaneously. Requires ≥2 streams and N≥2.', minN: 2, minStreams: 2, phase: "Phase D: Spatial Overloads & Stress Resilience" },
];

// Modes that are mutually exclusive with each other (only one from each group active)
// CCT is intentionally *not* in any exclusive group anymore — it's a stream
// type, not a core matching rule, so it freely blends with type_nback / rint /
// mixed / binary_logic / alien-modes via the per-stream REL/CCT toggle.
// Plain-English rule reminders — surfaced on the StartScreen before launch
// so the player knows what category of structure they're about to face.
// This is NOT instruction during play (which would defeat discovery) — it's
// a pre-flight "you're about to train: X" briefing. The actual figuring-out
// still has to happen during trials.
const MODE_RULE_BRIEFS = {
  type_nback: 'Match by relation TYPE — fires when this rel appeared N times in its own history (not by trial distance).',
  rint: 'Logical chain — fires when current is a VALID transitive conclusion from the last N facts (A>B, B>C → A>C).',
  nonverbal_rint: 'Composite attrs — fires when current attribute set equals the UNION of some subset of the last N stims.',
  cct: 'Arithmetic — fires when candidate result equals current digit + the digit from N back.',
  cct_overlay: 'CCT side-task layered on relation streams — same arithmetic rule, separate response key.',
  rst_overlay: 'Deduction side-task — premise per trial; from trial N a candidate conclusion appears. Press R if valid.',
  binary_logic: 'Two N-back rules combined per trial with AND/OR/XOR/AND_NOT — match when the boolean is true.',
  analogy_nback: 'Form-class analogy — fires when current and N-back relations share a STRUCTURAL FORM (different tokens). Same-token = NOT a match.',
  trajectory_nback: 'Graph traversal — each trial is a node visited during a random walk. Target rule depends on tier (Easy: identity, Medium: neighbour, Hard: K-step successor, Extreme: shortest-path). Map edges fade after the learn phase. Schema mode = multiple graphs share topology with fresh surfaces (TEM transfer test).',
  decoy_filter: 'Selective attention — certain relation categories are decoys to IGNORE (shown per stream). Withhold on decoy-category stimuli even if they would match. Pressing a decoy = false alarm.',
  mixed_nback: 'Per-trial random rule (Normal or Type) — can\'t pre-commit to one strategy.',
  mixed_rint: 'Per-trial random rule (Normal / Type / RINT) — three-way uncertainty.',
  impossible: 'Each stream picks Normal / Type / RINT independently per trial — chaos by design.',
  hierarchical: 'Match by relation CATEGORY (Spatial, Trait, …) — fires when category matches N back.',
  lures: '~1/5 of non-targets are near-misses at N-1 or N+1. Loose counting = false alarms.',
  negation: '~30% of trials are flipped to ¬ (red badge). Match requires BOTH the rel AND the negation flag to agree.',
  alien_cube: 'Each stream sits in a rotating 3D cube. Position is a SECOND response axis with its own key.',
  alien_square: 'Each stream sits in a rotating 3×3 square. Position is a SECOND response axis with its own key.',
  alien_tesseract: 'Each stream sits in a 4D tesseract. Position includes hyperspace layer plus cube cell.',
  wrapper_morph: 'Visual theme + active category pool morph mid-session (blocks of 5 or per-trial).',
  token_blending: 'Verbal / alphanumeric / emoji tokens blend inside relation grids — defeats surface shortcuts.',
  variable_n: 'N shifts ±1 each trial around your chosen N.',
  adaptive: 'N auto-adjusts between sessions based on overall accuracy.',
  adaptive_closed_loop: 'Speed + lure rate + negation rate scale mid-session based on your live performance.',
  distractors: 'Near-match stims from the same category inject interference.',
  feedback_per_trial: 'After every trial, each stream flashes HIT / MISS / FA / CR with a one-line hint.',
  stress_glitch: 'Visual glitch filter fires ~25% of trials. Distraction stress.',
  stress_shake: 'Screen shake fires ~35% of trials. Stability stress.',
  timer_panic: 'Shrinking countdown bar above each stream — urgency stress.',
};

const EXCLUSIVE_GROUPS = [
  ['type_nback', 'mixed_nback', 'mixed_rint', 'impossible', 'nonverbal_rint', 'analogy_nback', 'trajectory_nback', 'decoy_filter'],
  ['rint', 'mixed_rint', 'impossible', 'nonverbal_rint', 'analogy_nback', 'trajectory_nback', 'decoy_filter'],
  // binary_logic overrides the primary nback type selection per trial so conflicts with fixed-mode selectors
  ['binary_logic', 'mixed_nback', 'mixed_rint', 'impossible', 'nonverbal_rint', 'analogy_nback', 'trajectory_nback', 'decoy_filter'],
  ['alien_cube', 'alien_tesseract', 'alien_square'],
  // TJN replaces the relation pool entirely — disallow combinations with
  // overlay side-tasks that assume relation stims (CCT, RST, alien-positions,
  // wrapper morph, token blending). Map-only mode.
  ['trajectory_nback', 'cct', 'cct_overlay', 'rst_overlay', 'alien_cube', 'alien_tesseract', 'alien_square', 'wrapper_morph', 'token_blending'],
  // decoy_filter rewrites the normal relation generation — keep it off the
  // exotic rule modes (it builds on plain relation n-back).
  ['decoy_filter', 'nonverbal_rint', 'trajectory_nback', 'type_nback', 'rint', 'analogy_nback', 'binary_logic'],
];

const CATEGORY_META = {
  SPATIAL:    { label: 'Spatial',      color: 'text-cyan-400',     border: 'border-cyan-400/40',   bg: 'bg-cyan-400/10'  },
  SPATIAL_3D: { label: 'Spatial 3D',   color: 'text-sky-400',      border: 'border-sky-400/40',    bg: 'bg-sky-400/10'  },
  TRAIT:      { label: 'Trait',        color: 'text-violet-400',   border: 'border-violet-400/40', bg: 'bg-violet-400/10' },
  QUANT:      { label: 'Quantitative', color: 'text-amber-400',    border: 'border-amber-400/40',  bg: 'bg-amber-400/10' },
  COMPLEX:    { label: 'Complex',      color: 'text-fuchsia-400',  border: 'border-fuchsia-400/40',bg: 'bg-fuchsia-400/10' },
  VERBAL:     { label: 'Verbal',       color: 'text-emerald-400',  border: 'border-emerald-400/40',bg: 'bg-emerald-400/10' },
  SOUND:      { label: 'Sound',        color: 'text-rose-400',     border: 'border-rose-400/40',   bg: 'bg-rose-400/10' },
};

const REL_DISPLAY = {
  // Spatial
  INSIDE: 'Inside', OVERLAPPING: 'Overlapping', TOUCHING: 'Touching',
  ABOVE_BELOW: 'Above/Below', DIAGONAL: 'Diagonal', BETWEEN: 'Between',
  SURROUNDED: 'Surrounded', LEFT_RIGHT: 'Left/Right', STACKED: 'Stacked',
  NESTED_3: 'Nested 3', MIRRORED: 'Mirrored', SCATTERED: 'Scattered',
  // Spatial 3D
  DEPTH_LAYERED: 'Depth Layered', ORBITING: 'Orbiting', ROTATING_PAIR: 'Rotating Pair',
  NESTED_VOLUME: 'Nested Volume', ASCENDING_SPIRAL: 'Ascending Spiral', COLLIDING: 'Colliding',
  REPELLING: 'Repelling', BOUND_BY_GRAVITY: 'Bound by Gravity', INTERSECTING_PLANES: 'Intersecting Planes',
  IN_FRONT_OF: 'In Front Of', BEHIND: 'Behind', STACKED_3D: 'Stacked 3D',
  LEANING_AGAINST: 'Leaning Against', FLOATING_ABOVE: 'Floating Above', CASTING_SHADOW: 'Casting Shadow',
  // Trait
  HOLLOW_VS_SOLID: 'Hollow vs Solid', ONE_SHARED_TRAIT: 'Shared Trait', ROTATED: 'Rotated',
  CONNECTED: 'Connected', SAME_COLOR: 'Same Color', SAME_SHAPE: 'Same Shape',
  OPPOSITE_COLORS: 'Opposite Colors', SIZE_GRADIENT: 'Size Gradient', BORDER_ONLY: 'Border Only',
  SHADOW_COPY: 'Shadow Copy', STRIPED: 'Striped', DASHED_OUTLINE: 'Dashed Outline',
  // Quant
  SIZE_MISMATCH: 'Size Mismatch', ONE_TO_MANY: '1:3', EQUAL_COUNT: 'Equal Count',
  TWO_TO_ONE: '2:1', PYRAMID: 'Pyramid', THREE_TO_ONE: '3:1',
  ONE_TO_FIVE: '1:5', DECREASING_ROW: 'Decreasing Row', INCREASING_ROW: 'Increasing Row',
  BALANCED_SCALE: 'Balanced Scale',
  // Complex (composite scan-for-difference relations)
  THREE_PAIRS_ONE_DIFFERENT: '3 Pairs · 1 Different',
  FOUR_PAIRS_GRID:           '4 Pairs Grid',
  TWO_OF_THREE_HOLLOW:       '2-of-3 Hollow',
  ODD_COLOR_OUT:             'Odd Color Out',
  ODD_SHAPE_OUT:             'Odd Shape Out',
  // Cognitive Control Training (arithmetic n-back)
  CCT_NUMERIC:               'CCT Numeric',
  // Verbal — semantic
  SAME_AS: 'Same As', OPPOSITE_OF: 'Opposite Of', PART_OF: 'Part Of',
  CAUSES: 'Causes', CONTAINS: 'Contains', BELONGS_TO: 'Belongs To',
  DEFINES: 'Defines', REPLACES: 'Replaces', NEGATES: 'Negates',
  MATCHES: 'Matches', TRANSFORMS_INTO: '→', DEPENDS_ON: 'Depends On',
  // Verbal — comparison
  BIGGER_THAN: 'Bigger Than', SMALLER_THAN: 'Smaller Than',
  MORE_THAN: 'More Than', LESS_THAN: 'Less Than',
  FASTER_THAN: 'Faster Than', SLOWER_THAN: 'Slower Than',
  HEAVIER_THAN: 'Heavier Than', LIGHTER_THAN: 'Lighter Than',
  HOTTER_THAN: 'Hotter Than', COLDER_THAN: 'Colder Than',
  LOUDER_THAN: 'Louder Than', SOFTER_THAN: 'Softer Than',
  STRONGER_THAN: 'Stronger Than', WEAKER_THAN: 'Weaker Than',
  OLDER_THAN: 'Older Than', NEWER_THAN: 'Newer Than',
  HIGHER_THAN: 'Higher Than', LOWER_THAN: 'Lower Than',
  CLOSER_THAN: 'Closer Than', FURTHER_THAN: 'Further Than',
  // Verbal — temporal
  BEFORE: 'Before', AFTER: 'After', FOLLOWS: 'Follows', PRECEDES: 'Precedes',
  EXCEEDS: 'Exceeds', MIRRORS: 'Mirrors',
  // Verbal — directional
  LEFT_OF: 'Left Of', RIGHT_OF: 'Right Of', ABOVE: 'Above', BELOW: 'Below',
  NORTH_OF: 'North Of', SOUTH_OF: 'South Of', EAST_OF: 'East Of', WEST_OF: 'West Of',
  NORTH_EAST_OF: 'NE Of', NORTH_WEST_OF: 'NW Of', SOUTH_EAST_OF: 'SE Of', SOUTH_WEST_OF: 'SW Of',
  INSIDE_OF: 'Inside Of', OUTSIDE_OF: 'Outside Of', NEXT_TO: 'Next To', FAR_FROM: 'Far From',
  // Sound
  PITCH_HIGHER: 'Pitch Higher', PITCH_LOWER: 'Pitch Lower',
  RHYTHM_FASTER: 'Rhythm Faster', RHYTHM_SLOWER: 'Rhythm Slower',
  VOLUME_LOUDER: 'Volume Louder', VOLUME_QUIETER: 'Volume Quieter',
  DURATION_LONGER: 'Duration Longer', DURATION_SHORTER: 'Duration Shorter',
  TIMBRE_BRIGHT: 'Timbre Bright', TIMBRE_WARM: 'Timbre Warm',
};

const KEY_OPTIONS = [
  { code: 'Space',  display: 'SPACE' },
  { code: 'KeyA',   display: 'A' },
  { code: 'KeyS',   display: 'S' },
  { code: 'KeyD',   display: 'D' },
  { code: 'KeyF',   display: 'F' },
  { code: 'KeyG',   display: 'G' },
  { code: 'KeyH',   display: 'H' },
  { code: 'KeyJ',   display: 'J' },
  { code: 'KeyK',   display: 'K' },
  { code: 'KeyP',   display: 'P' },
  { code: 'KeyZ',   display: 'Z' },
  { code: 'KeyX',   display: 'X' },
  { code: 'KeyC',   display: 'C' },
  { code: 'KeyV',   display: 'V' },
  { code: 'Digit1', display: '1' },
  { code: 'Digit2', display: '2' },
  { code: 'Digit3', display: '3' },
  { code: 'Digit4', display: '4' },
  { code: 'Digit5', display: '5' },
  { code: 'Digit6', display: '6' },
  { code: 'Digit7', display: '7' },
  { code: 'Digit8', display: '8' },
  { code: 'Digit9', display: '9' },
  { code: 'Digit0', display: '0' },
  { code: 'KeyQ', display: 'Q' },
  { code: 'KeyW', display: 'W' },
  { code: 'KeyE', display: 'E' },
  { code: 'KeyR', display: 'R' },
  { code: 'KeyT', display: 'T' },
  { code: 'KeyY', display: 'Y' },
  { code: 'KeyU', display: 'U' },
  { code: 'KeyI', display: 'I' },
  { code: 'KeyO', display: 'O' },
  { code: 'KeyL', display: 'L' },
  { code: 'KeyB', display: 'B' },
  { code: 'KeyN', display: 'N' },
  { code: 'KeyM', display: 'M' },
];

const STREAM_COLORS = ['text-primary', 'text-accent', 'text-chart-3', 'text-chart-4', 'text-chart-5', 'text-primary', 'text-accent', 'text-chart-3', 'text-chart-4'];
const STREAM_LABELS = Array.from({ length: 20 }, (_, i) => String.fromCharCode(65 + i));
const MAX_STREAMS = STREAM_LABELS.length;

const SPEED_OPTIONS = [
  { label: 'Slow',   ms: 4000 },
  { label: 'Normal', ms: 2800 },
  { label: 'Fast',   ms: 1800 },
  { label: 'Turbo',  ms: 1000 },
  { label: 'Random', ms: 'random' },
];

const CAROUSEL_SPEED_OPTIONS = [
  { label: 'Slow', ms: 3600 },
  { label: 'Normal', ms: 2800 },
  { label: 'Fast', ms: 2000 },
  { label: 'Turbo', ms: 1400 },
];

function StreamRow({ label, labelColor, borderColor, keyCode, positionKeyCode, cctKeyCode, rstKeyCode, showPositionKey, showCCTKey, showRSTKey, onKeyChange, onPositionKeyChange, onCCTKeyChange, onRSTKeyChange, allStreamKeys, thisKey, thisPositionKey, thisCCTKey, thisRSTKey, onRemove, streamType, onStreamTypeChange }) {
  const isCCT = streamType === 'cct';
  // Default-collapsed key bindings: most users keep defaults — only expose the
  // 4 select dropdowns when the user opts in. Keeps the streams panel scannable.
  const [showKeys, setShowKeys] = React.useState(false);
  return (
    <div className={`rounded-lg bg-secondary/50 border ${borderColor} p-2 space-y-1.5`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-mono font-semibold ${labelColor} shrink-0`}>{label}</span>
        {/* Per-stream type selector: Relation (default) | CCT (arithmetic). */}
        {onStreamTypeChange && (
          <div className="flex rounded border border-border overflow-hidden text-[10px] sm:text-xs font-mono shrink-0">
            <button
              type="button"
              onClick={() => onStreamTypeChange('relation')}
              className={`px-2 py-0.5 transition-colors ${!isCCT ? 'bg-primary/25 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              title="Relation n-back stream"
            >
              REL
            </button>
            <button
              type="button"
              onClick={() => onStreamTypeChange('cct')}
              className={`px-2 py-0.5 transition-colors ${isCCT ? 'bg-amber-500/25 text-amber-400 font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              title="CCT arithmetic stream"
            >
              CCT
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowKeys(v => !v)}
          className={`${onRemove ? '' : 'ml-auto'} text-[10px] font-mono text-muted-foreground/70 hover:text-foreground transition-colors shrink-0 px-1.5 py-0.5`}
          title="Customize key bindings"
        >
          {showKeys ? '× keys' : '⋯ keys'}
        </button>
        {onRemove && (
          <button onClick={onRemove}
            className="ml-auto w-6 h-6 rounded bg-secondary border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 flex items-center justify-center transition-colors text-sm shrink-0">
            ×
          </button>
        )}
      </div>
      {showKeys && (<>
      <div className="flex items-center gap-2">
        {showPositionKey && <span className="text-xs font-mono text-muted-foreground/60 w-8 shrink-0">REL</span>}
        <select
          value={keyCode}
          onChange={e => onKeyChange(e.target.value)}
          className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-xs font-mono text-foreground">
          {KEY_OPTIONS.map(k => (
            <option key={k.code} value={k.code} disabled={allStreamKeys.includes(k.code) && k.code !== thisKey}>
              {k.display}
            </option>
          ))}
        </select>
        {showPositionKey && !isCCT && (
          <>
            <span className="text-xs font-mono text-muted-foreground/60 w-8 text-right shrink-0">POS</span>
            <select
              value={positionKeyCode}
              onChange={e => onPositionKeyChange(e.target.value)}
              className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-xs font-mono text-foreground">
              {KEY_OPTIONS.map(k => (
                <option key={k.code} value={k.code} disabled={allStreamKeys.includes(k.code) && k.code !== thisPositionKey}>
                  {k.display}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {showCCTKey && !isCCT && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-amber-400/80 w-8 shrink-0">CCT</span>
          <select
            value={cctKeyCode}
            onChange={e => onCCTKeyChange(e.target.value)}
            className="flex-1 bg-secondary border border-amber-500/30 rounded px-2 py-1 text-xs font-mono text-amber-300">
            {KEY_OPTIONS.map(k => (
              <option key={k.code} value={k.code} disabled={allStreamKeys.includes(k.code) && k.code !== thisCCTKey}>
                {k.display}
              </option>
            ))}
          </select>
        </div>
      )}
      {showRSTKey && !isCCT && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-violet-400 w-8 shrink-0">RST</span>
          <select
            value={rstKeyCode}
            onChange={e => onRSTKeyChange(e.target.value)}
            className="flex-1 bg-secondary border border-violet-500/30 rounded px-2 py-1 text-xs font-mono text-violet-300">
            {KEY_OPTIONS.map(k => (
              <option key={k.code} value={k.code} disabled={allStreamKeys.includes(k.code) && k.code !== thisRSTKey}>
                {k.display}
              </option>
            ))}
          </select>
        </div>
      )}
      </>)}
    </div>
  );
}

const DEFAULT_COLOR_MAP = {
  A: '#ff007f', B: '#ff3b3f', C: '#ff8c00', D: '#ffd700', E: '#39ff14',
  F: '#00f5ff', G: '#1f75fe', H: '#8a2be2', I: '#ff00ff', J: '#00ffcc',
  K: '#ff007f', L: '#ff3b3f', M: '#ff8c00', N: '#ffd700', O: '#39ff14',
  P: '#00f5ff', Q: '#1f75fe', R: '#8a2be2', S: '#ff00ff', T: '#00ffcc',
  U: '#ff007f', V: '#ff3b3f', W: '#ff8c00', X: '#ffd700', Y: '#39ff14', Z: '#00f5ff',
  '0': '#ff007f', '1': '#ff3b3f', '2': '#ff8c00', '3': '#ffd700', '4': '#39ff14',
  '5': '#00f5ff', '6': '#1f75fe', '7': '#8a2be2', '8': '#ff00ff', '9': '#00ffcc'
};

export default function StartScreen({ onStart, suggestedN, lastSettings }) {
  const allCats = Object.keys(RELATIONSHIP_CATEGORIES);
  const allRels = Object.values(RELATIONSHIP_CATEGORIES).flat();
  const savedRels = (lastSettings?.rels || []).filter(rel => allRels.includes(rel));

  const [coachState, setCoachState] = React.useState(() => {
    try {
      const saved = localStorage.getItem('goated_coach_state');
      const parsed = saved ? JSON.parse(saved) : {};
      const migrated = migrateCoachState(parsed);
      // Default rendering fields the legacy code expects
      if (!migrated.nLevel) migrated.nLevel = 2;
      if (!migrated.rounds) migrated.rounds = 20;
      if (!migrated.speedMs) migrated.speedMs = 3200;
      if (!migrated.rankName) migrated.rankName = 'Initiate (Rank I)';
      return migrated;
    } catch (e) {
      console.error(e);
      return migrateCoachState({});
    }
  });

  // Manual phase override — lets the user TEST any Coach phase without
  // disturbing their real curriculum progress (coachState.phaseIndex).
  // null = use the real coach progress; otherwise override with the picked
  // index. Cleared when user clicks "Reset to my progress".
  const [testPhaseIndex, setTestPhaseIndex] = React.useState(null);

  // Capacity Credits — derived from session history + coach state + paired
  // Reasoning Index assessments. Memoised; recomputes only when coachState
  // changes (i.e. when a finished session lands on disk).
  const capacityCredits = React.useMemo(() => {
    try {
      return computeCapacityCredits(getSessions(), coachState, getAssessments(), COACH_PHASES);
    } catch (_) { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachState.sessionCount]);
  const effectivePhaseIndex = testPhaseIndex !== null ? testPhaseIndex : (coachState.phaseIndex || 0);
  // Pre-session rule briefing toggle — default expanded; veterans can collapse.
  const [showRuleBrief, setShowRuleBrief] = React.useState(true);

  const [nLevel, setNLevel] = React.useState(suggestedN || lastSettings?.n || coachState.nLevel);
  const [modes, setModes] = React.useState(() => [...new Set(lastSettings?.modes || [])]);

  // Multi-stream config: stream A key + extra streams
  const [streamAKey, setStreamAKey] = React.useState(
    lastSettings?.streamA?.key || 'Space'
  );
  const [streamAPositionKey, setStreamAPositionKey] = React.useState(
    lastSettings?.streamA?.positionKey || 'KeyP'
  );
  const [streamAType, setStreamAType] = React.useState(
    lastSettings?.streamA?.streamType
      || (lastSettings?.modes?.includes('cct') ? 'cct' : 'relation')
  );
  const [streamACCTKey, setStreamACCTKey] = React.useState(
    lastSettings?.streamA?.cctKey || 'KeyM'
  );
  const [streamARSTKey, setStreamARSTKey] = React.useState(
    lastSettings?.streamA?.rstKey || 'KeyR'
  );
  const [extraStreams, setExtraStreams] = React.useState(
    (lastSettings?.extraStreams || []).map(s => ({
      ...s,
      // Coerce the removed 'decoy' stream type (and anything unknown) back to
      // a live type so stale saved settings don't disable a stream.
      streamType: s.streamType === 'cct' ? 'cct' : 'relation',
      rstKey: s.rstKey || 'KeyR',
      rstKeyDisplay: s.rstKeyDisplay || 'R',
    }))
  );
  // Decoy Filter (type-based selective attention): which relation categories
  // are decoys to ignore. Random per-stream by default; manual lets the player
  // pick. Rule = how decoys interact with the N-back chain.
  const [decoyFilterRule, setDecoyFilterRule] = React.useState(lastSettings?.decoyFilterRule || 'never_target');
  const [decoyFilterRandom, setDecoyFilterRandom] = React.useState(lastSettings?.decoyFilterRandom !== false);
  const [decoyFilterCategories, setDecoyFilterCategories] = React.useState(
    Array.isArray(lastSettings?.decoyFilterCategories) ? lastSettings.decoyFilterCategories : []
  );
  const toggleDecoyCategory = (cat) => {
    setDecoyFilterCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const [alienSettings, setAlienSettings] = React.useState(lastSettings?.alienSettings || {
    cubeDirection: 'cw',
    cubeSpeed: 1,
    cubeSpeedMode: 'fixed',
    squareDirection: 'cw',
    squareSpeed: 1,
    squareSpeedMode: 'fixed',
    tesseractDirection: 'cw',
    tesseractSpeed: 1,
    tesseractSpeedMode: 'fixed',
  });
  const [carouselSettings, setCarouselSettings] = React.useState({
    enabled: true,
    streamsPerSlide: 'auto',
    slideMs: 2800,
    ...(lastSettings?.carouselSettings || {}),
  });
  const [wrapperMorphStyle, setWrapperMorphStyle] = React.useState(
    lastSettings?.wrapperMorphStyle || 'shift'
  );
  const alienModeActive = modes.includes('alien_cube') || modes.includes('alien_tesseract') || modes.includes('alien_square');
  const cctOverlayActive = modes.includes('cct_overlay');
  const rstOverlayActive = modes.includes('rst_overlay');

  // NRINT per-session config: which attribute flags are active + whether
  // the textual legend is hidden (Grapist's "disable the words" request).
  const NRINT_DEFAULT_FLAGS_LOCAL = ['touching', 'hollow', 'size_mismatch', 'audio'];
  const [nrintEnabledFlags, setNrintEnabledFlags] = React.useState(
    Array.isArray(lastSettings?.nrintEnabledFlags) && lastSettings.nrintEnabledFlags.length
      ? lastSettings.nrintEnabledFlags.filter(f => NRINT_FLAGS.includes(f))
      : NRINT_DEFAULT_FLAGS_LOCAL
  );
  const [nrintHideLegend, setNrintHideLegend] = React.useState(!!lastSettings?.nrintHideLegend);
  // Max simultaneous attributes per trial (Grapist request). 0 = no cap.
  // Lets the player bound tracking load when many flags are enabled.
  const [nrintMaxPerTrial, setNrintMaxPerTrial] = React.useState(Number(lastSettings?.nrintMaxPerTrial) || 0);
  // Match rule: union (default) / intersection / xor / implication (Grapist req).
  // Weights object (Grapist follow-up). Multiple rules can be enabled with
  // per-rule weight controlling per-trial sampling frequency. Legacy single-
  // rule sessions migrate to { [oldRule]: 1, others: 0 }.
  const [nrintMatchRuleWeights, setNrintMatchRuleWeights] = React.useState(() => {
    const blank = { union: 0, intersection: 0, xor: 0, implication: 0, biconditional: 0 };
    const saved = lastSettings?.nrintMatchRuleWeights;
    if (saved && typeof saved === 'object') {
      const out = { ...blank };
      NRINT_MATCH_RULES.forEach(r => {
        const w = Number(saved[r]);
        out[r] = Number.isFinite(w) && w > 0 ? w : 0;
      });
      const total = NRINT_MATCH_RULES.reduce((s, r) => s + out[r], 0);
      if (total > 0) return out;
    }
    // Legacy single-string migration
    const legacy = lastSettings?.nrintMatchRule;
    if (NRINT_MATCH_RULES.includes(legacy)) {
      return { ...blank, [legacy]: 1 };
    }
    return { ...blank, union: 1 };
  });
  const nrintWeightTotal = NRINT_MATCH_RULES.reduce((s, r) => s + (nrintMatchRuleWeights[r] || 0), 0);
  const nrintEnabledRules = NRINT_MATCH_RULES.filter(r => (nrintMatchRuleWeights[r] || 0) > 0);
  // Legacy single-string mirror — used as fallback for Stats / sessions and
  // for downstream code that only knows the old shape. With one rule enabled
  // it's that rule; with multi-rule it's just the most-weighted one (and
  // weights stays authoritative).
  const nrintMatchRule = nrintEnabledRules.length
    ? nrintEnabledRules.reduce((a, b) => (nrintMatchRuleWeights[a] >= nrintMatchRuleWeights[b] ? a : b))
    : 'union';
  const setNrintRuleWeight = (rule, weight) => setNrintMatchRuleWeights(prev => ({ ...prev, [rule]: Math.max(0, Math.min(10, Number(weight) || 0)) }));
  const toggleNrintRule = (rule) => setNrintMatchRuleWeights(prev => {
    const cur = prev[rule] || 0;
    // Toggling OFF the last enabled rule is blocked — at least one must stay
    // on so the engine has a non-empty distribution.
    if (cur > 0) {
      const others = NRINT_MATCH_RULES.filter(r => r !== rule).reduce((s, r) => s + (prev[r] || 0), 0);
      if (others === 0) return prev;
      return { ...prev, [rule]: 0 };
    }
    return { ...prev, [rule]: 1 };
  });
  // RST family difficulty (Easy / Medium / Hard). Easy = Distinction only,
  // Medium = +Comparison, Hard = +Analogy (true 4-place). Family is picked
  // at session start from the difficulty pool and stays fixed for the run.
  const [rstDifficulty, setRstDifficulty] = React.useState(lastSettings?.rstDifficulty || 'easy');
  // Trajectory N-Back (SR / TEM) configuration. Tier picks the target rule,
  // topology picks the graph family, schemaMode enables TEM (multiple
  // graphs sharing topology with fresh surfaces).
  const [tjnTier, setTjnTier] = React.useState(lastSettings?.tjnTier || TJN_DEFAULT_TIER);
  const [tjnTopology, setTjnTopology] = React.useState(lastSettings?.tjnTopology || TJN_DEFAULT_TOPOLOGY);
  const [tjnNodes, setTjnNodes] = React.useState(lastSettings?.tjnNodes || TJN_DEFAULT_NODES);
  const [tjnK, setTjnK] = React.useState(lastSettings?.tjnK || TJN_HARD_K);
  const [tjnSchemaMode, setTjnSchemaMode] = React.useState(!!lastSettings?.tjnSchemaMode);
  const [tjnSchemaBlocks, setTjnSchemaBlocks] = React.useState(lastSettings?.tjnSchemaBlocks || 3);
  const toggleNrintFlag = (flag) => {
    setNrintEnabledFlags(prev => {
      if (prev.includes(flag)) {
        // Don't let the user disable every flag — at least one must stay on.
        return prev.length === 1 ? prev : prev.filter(f => f !== flag);
      }
      return [...prev, flag];
    });
  };
  // When Nonverbal RINT is active the engine replaces the relationship pool
  // with a single composite stim, so user-side pool / mix / token controls
  // are ignored. We grey them out (rather than hide) and add a small note
  // so the player can still see what they'd configured.
  const nrintActive = modes.includes('nonverbal_rint');
  const tjnActive = modes.includes('trajectory_nback');
  const decoyFilterActive = modes.includes('decoy_filter');
  const poolIgnoredCls = (nrintActive || tjnActive) ? 'opacity-50' : '';
  const poolIgnoredNote = tjnActive ? (
    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 rounded px-1.5 py-0.5 whitespace-nowrap">ignored in Trajectory N-Back</span>
  ) : nrintActive ? (
    <span className="text-[10px] font-mono text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded px-1.5 py-0.5 whitespace-nowrap">ignored in Nonverbal RINT</span>
  ) : null;

  // extra stream: { key, keyDisplay, positionKey, positionKeyDisplay, cctKey, cctKeyDisplay, streamType, label }
  const allStreamKeys = [
    streamAKey,
    ...(alienModeActive ? [streamAPositionKey] : []),
    ...(cctOverlayActive && streamAType !== 'cct' ? [streamACCTKey] : []),
    ...(rstOverlayActive ? [streamARSTKey] : []),
    ...extraStreams.flatMap(s => [
      s.key,
      ...(alienModeActive ? [s.positionKey] : []),
      ...(cctOverlayActive && (s.streamType || 'relation') !== 'cct' ? [s.cctKey] : []),
      ...(rstOverlayActive ? [s.rstKey] : []),
    ]).filter(Boolean),
  ];
  const addStream = () => {
    if (1 + extraStreams.length >= MAX_STREAMS) return;
    const nextLabel = STREAM_LABELS[1 + extraStreams.length];
    const taken = new Set(allStreamKeys);
    const pick = () => {
      const opt = KEY_OPTIONS.find(k => !taken.has(k.code));
      if (opt) taken.add(opt.code);
      return opt;
    };
    const available = pick();
    if (!available) return;
    const positionAvailable = pick();
    const cctAvailable = pick();
    const rstAvailable = pick();
    setExtraStreams(prev => [...prev, {
      key: available.code, keyDisplay: available.display,
      positionKey: positionAvailable?.code || available.code,
      positionKeyDisplay: positionAvailable?.display || available.display,
      cctKey: cctAvailable?.code || available.code,
      cctKeyDisplay: cctAvailable?.display || available.display,
      rstKey: rstAvailable?.code || available.code,
      rstKeyDisplay: rstAvailable?.display || available.display,
      label: nextLabel,
    }]);
  };
  const removeStream = (idx) => {
    setExtraStreams(prev => prev.filter((_, i) => i !== idx));
  };
  const setStreamKey = (idx, code) => {
    const opt = KEY_OPTIONS.find(k => k.code === code);
    if (!opt) return;
    setExtraStreams(prev => prev.map((s, i) => i === idx ? { ...s, key: opt.code, keyDisplay: opt.display } : s));
  };
  const setStreamPositionKey = (idx, code) => {
    const opt = KEY_OPTIONS.find(k => k.code === code);
    if (!opt) return;
    setExtraStreams(prev => prev.map((s, i) => i === idx ? { ...s, positionKey: opt.code, positionKeyDisplay: opt.display } : s));
  };
  const setStreamCCTKey = (idx, code) => {
    const opt = KEY_OPTIONS.find(k => k.code === code);
    if (!opt) return;
    setExtraStreams(prev => prev.map((s, i) => i === idx ? { ...s, cctKey: opt.code, cctKeyDisplay: opt.display } : s));
  };
  const setStreamRSTKey = (idx, code) => {
    const opt = KEY_OPTIONS.find(k => k.code === code);
    if (!opt) return;
    setExtraStreams(prev => prev.map((s, i) => i === idx ? { ...s, rstKey: opt.code, rstKeyDisplay: opt.display } : s));
  };
  const setStreamType = (idx, t) => {
    setExtraStreams(prev => prev.map((s, i) => i === idx ? { ...s, streamType: t } : s));
  };
  const updateAlienSetting = (key, value) => setAlienSettings(prev => ({ ...prev, [key]: value }));
  const [showRelTypes, setShowRelTypes] = React.useState(false);
  const [rounds, setRounds] = React.useState(lastSettings?.rounds || coachState.rounds);
  const [speedMs, setSpeedMs] = React.useState(lastSettings?.speedMs || coachState.speedMs);
  
  const [synaesthesiaEnabled, setSynaesthesiaEnabled] = React.useState(() => {
    return localStorage.getItem('goated_synaesthesia_enabled') === 'true';
  });
  
  const [synaesthesiaMap, setSynaesthesiaMap] = React.useState(() => {
    try {
      const saved = localStorage.getItem('goated_synaesthesia_map');
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...DEFAULT_COLOR_MAP, ...parsed };
      }
      return DEFAULT_COLOR_MAP;
    } catch (e) {
      return DEFAULT_COLOR_MAP;
    }
  });
  
  const [showSynaesthesiaEditor, setShowSynaesthesiaEditor] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem('goated_synaesthesia_enabled', String(synaesthesiaEnabled));
  }, [synaesthesiaEnabled]);

  React.useEffect(() => {
    localStorage.setItem('goated_synaesthesia_map', JSON.stringify(synaesthesiaMap));
  }, [synaesthesiaMap]);

  const [noobMode, setNoobMode] = React.useState(lastSettings?.noobMode || false);
  const [showLedger, setShowLedger] = React.useState(false);
  const [ledgerEntries, setLedgerEntries] = React.useState([]);

  const loadLedgerEntries = () => {
    try {
      const ledger = JSON.parse(localStorage.getItem('goated_transfer_ledger') || '[]');
      setLedgerEntries(ledger.reverse());
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    if (showLedger) {
      loadLedgerEntries();
    }
  }, [showLedger]);

  // Category mix weights (0–100 sliders, equal by default)
  const [catWeights, setCatWeights] = React.useState(
    lastSettings?.catWeights || { SPATIAL: 18, SPATIAL_3D: 14, TRAIT: 18, QUANT: 18, COMPLEX: 8, VERBAL: 10, SOUND: 14 }
  );
  const [useCustomMix, setUseCustomMix] = React.useState(lastSettings?.useCustomMix || false);
  const [showStimuliMix, setShowStimuliMix] = React.useState(false);

  // Token type weights for verbal stimuli
  const [tokenWeights, setTokenWeightsState] = React.useState(() => {
    const defaults = getTokenWeights();
    const saved = lastSettings?.tokenWeights || {};
    return { ...defaults, ...saved };
  });
  const [showTokenMix, setShowTokenMix] = React.useState(false);
  const [showEnhancementModes, setShowEnhancementModes] = React.useState(false);
  // Declutter (sokuichi feedback): the StartScreen used to dump every panel by
  // default. Now the Coach card + a single "Advanced settings" expander are
  // the default view; everything else stays one click away and persists.
  const initialUI = (lastSettings && lastSettings.uiPreferences) || {};
  const [showAdvanced, setShowAdvanced] = React.useState(!!initialUI.showAdvanced);
  const [showCoachDetails, setShowCoachDetails] = React.useState(!!initialUI.showCoachDetails);
  React.useEffect(() => {
    // Persist UI prefs alongside the existing lastGame snapshot so users only
    // get the default-collapsed view once.
    try {
      const cur = getSettings();
      const nextLastGame = { ...(cur.lastGame || {}), uiPreferences: { showAdvanced, showCoachDetails } };
      saveSettings({ ...cur, lastGame: nextLastGame });
    } catch (_) { /* localStorage may be unavailable; OK to ignore */ }
  }, [showAdvanced, showCoachDetails]);

  const TOKEN_META = [
    { id: 'meaningful',    label: 'Words',       color: '#22d3ee', desc: 'Real words (sun, fire, mind…)' },
    { id: 'nonsense',      label: 'Nonsense',    color: '#a78bfa', desc: 'Pronounceable but meaningless (blim, quor…)' },
    { id: 'garbage',       label: 'Garbage',     color: '#f87171', desc: 'Random letter strings (xqz, bvp…)' },
    { id: 'emoji',         label: 'Emoji',       color: '#fbbf24', desc: 'Emoji symbols (🔥, 💧, 🌀…)' },
    { id: 'voronoi_emoji', label: 'Abstract',    color: '#34d399', desc: 'Geometric unicode symbols (◈, ⬡, ⟐…)' },
    { id: 'random_string', label: 'Random Str',  color: '#fb923c', desc: 'Alphanumeric codes (Xk3F, aB9z…)' },
    { id: 'voronoi',       label: 'Voronoi',     color: '#f472b6', desc: 'Mini Voronoi cell diagrams as tokens' },
    { id: 'scrap',         label: 'Junk-Journal / Scrap', color: '#818cf8', desc: 'Procedural collage of hand-torn physical photos (junk journaling)' },
  ];

  const setTokenWeight = (id, val) => setTokenWeightsState(prev => ({ ...prev, [id]: Number(val) }));
  const totalTW = Object.values(tokenWeights).reduce((s, v) => s + v, 0);
  const tokenPct = (id) => totalTW > 0 ? Math.round((tokenWeights[id] / totalTW) * 100) : 0;

  // Selected individual relationships
  const [enabledRels, setEnabledRels] = React.useState(
    savedRels.length ? new Set(savedRels) : new Set(allRels)
  );
  // Derive enabled cats from enabled rels
  const [enabledCats, setEnabledCats] = React.useState(() => {
    const initRels = savedRels.length ? new Set(savedRels) : new Set(allRels);
    return new Set(allCats.filter(cat =>
      RELATIONSHIP_CATEGORIES[cat].some(r => initRels.has(r))
    ));
  });

  const toggleMode = (id) => {
    const opt = MODE_OPTIONS.find(m => m.id === id);
    const isActive = modes.includes(id);
    if (!isActive) {
      if (opt?.minN && nLevel < opt.minN) setNLevel(opt.minN);
      // Enforce stream requirement
      if (opt?.minStreams && (1 + extraStreams.length) < opt.minStreams) {
        // Auto-add a stream if missing
        const available = KEY_OPTIONS.find(k => ![streamAKey, ...extraStreams.map(s => s.key)].includes(k.code));
        if (available) setExtraStreams(prev => [...prev, { key: available.code, keyDisplay: available.display, label: STREAM_LABELS[1 + prev.length] || String(2 + prev.length) }]);
      }
      // Remove conflicting modes from exclusive groups
      const toRemove = new Set();
      EXCLUSIVE_GROUPS.forEach(group => {
        if (group.includes(id)) group.forEach(m => { if (m !== id) toRemove.add(m); });
      });
      setModes(prev => {
        const newModes = [...prev.filter(m => !toRemove.has(m)), id];

        // Auto-filter only for modes that can generate RINT trials
        const isRINTMode = newModes.includes('rint') || newModes.includes('mixed_rint') || newModes.includes('impossible');
        if (isRINTMode) {
          const filtered = filterTransitiveRelationships([...enabledRels], true, false);
          setEnabledRels(new Set(filtered));
        }

        return newModes;
      });
      // CCT now lives per-stream. The Enhancement Mode card acts as a
      // "set all streams to CCT" shortcut so the legacy single-toggle UX
      // still works for users who only want pure arithmetic training.
      if (id === 'cct') {
        setStreamAType('cct');
        setExtraStreams(prev => prev.map(s => ({ ...s, streamType: 'cct' })));
      }
    } else {
      setModes(prev => prev.filter(m => m !== id));
      // Toggling the global CCT card off resets all streams back to relation.
      if (id === 'cct') {
        setStreamAType('relation');
        setExtraStreams(prev => prev.map(s => ({ ...s, streamType: 'relation' })));
      }
    }
  };

  const toggleCat = (cat) => {
    const members = RELATIONSHIP_CATEGORIES[cat];
    const allOn = members.every(r => enabledRels.has(r));
    const next = new Set(enabledRels);
    if (allOn) {
      // only allow deselect if other cats remain
      const otherEnabled = [...next].filter(r => !members.includes(r));
      if (otherEnabled.length === 0) return;
      members.forEach(r => next.delete(r));
      setEnabledCats(prev => { const s = new Set(prev); s.delete(cat); return s; });
    } else {
      members.forEach(r => next.add(r));
      setEnabledCats(prev => new Set([...prev, cat]));
    }
    setEnabledRels(next);
  };

  const toggleRel = (rel, cat) => {
    const next = new Set(enabledRels);
    if (next.has(rel)) {
      // prevent disabling last one
      if (next.size === 1) return;
      next.delete(rel);
    } else {
      next.add(rel);
    }
    setEnabledRels(next);
    // sync cat toggle state
    const members = RELATIONSHIP_CATEGORIES[cat];
    const anyOn = members.some(r => next.has(r));
    setEnabledCats(prev => {
      const s = new Set(prev);
      if (anyOn) s.add(cat); else s.delete(cat);
      return s;
    });
  };

  const selectedRels = [...enabledRels];
  // Categories actually present in the current selection — decoy cats are
  // drawn only from these, and at least one must remain a relevant target.
  const activeDecoyCategories = Object.keys(RELATIONSHIP_CATEGORIES).filter(cat =>
    (RELATIONSHIP_CATEGORIES[cat] || []).some(rel => selectedRels.includes(rel))
  );
  const totalRels = Object.values(RELATIONSHIP_CATEGORIES).flat().length;
  const streamCount = 1 + extraStreams.length;
  const soundOnlySelection = streamCount >= 2 && selectedRels.length > 0 && selectedRels.every(rel => RELATIONSHIP_CATEGORIES.SOUND.includes(rel));
  const activeEnhancementCount = MODE_OPTIONS.filter(({ id }) => modes.includes(id)).length;

  // Build final pool (weighted or flat)
  const mixedPool = useCustomMix ? buildWeightedPool(enabledRels, catWeights) : selectedRels;
  const finalPool = mixedPool;

  const setCatWeight = (cat, val) => setCatWeights(prev => ({ ...prev, [cat]: Number(val) }));

  // Normalize weights to show % of total
  const totalW = Object.values(catWeights).reduce((s, v) => s + v, 0);
  const normalizedPct = (cat) => totalW > 0 ? Math.round((catWeights[cat] / totalW) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex flex-col items-center min-h-[100dvh] px-3 sm:px-4 pb-5 sm:pb-8"
      style={{
        // Generous top padding so the floating nav (Install / Tutorial /
        // Stats) doesn't sit on top of the title.
        paddingTop: 'calc(max(0.75rem, env(safe-area-inset-top)) + 4rem)',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}>
      <div className="max-w-lg w-full space-y-4 sm:space-y-5">

        {/* Title */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-1">
            <Brain className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-foreground">GOATED Relational <span className="whitespace-nowrap">n-Back</span></h1>
          </div>
          <p className="text-xs font-mono text-muted-foreground max-w-md mx-auto">
            Match the abstract <span className="text-primary">relationship</span> from{' '}
            <span className="text-primary">N</span> steps ago.
          </p>
          {suggestedN && suggestedN !== 2 && (
            <p className="text-xs font-mono text-accent">↑ Adaptive suggestion: N={suggestedN}</p>
          )}
        </div>

        {/* Dynamic Coach Level & Progression Card */}
        {(() => {
          // Compute the mastery scheduler's pick PREVIEW so the card shows
          // what will actually play when the user clicks Coach Autopilot.
          // (When test override is set, that wins instead.)
          const preview = testPhaseIndex !== null
            ? { phaseIndex: testPhaseIndex, reason: 'manual_test' }
            : pickNextPhase(coachState, COACH_PHASES.length);
          const previewPhaseIdx = preview.phaseIndex;
          const previewPhase = COACH_PHASES[previewPhaseIdx] || COACH_PHASES[0];
          const reasonLabel = {
            manual_test: 'TEST',
            review:      'REVIEW',
            frontier:    'FRONTIER',
            advance:     'ADVANCE',
            maintenance: 'MAINTAIN',
          }[preview.reason] || 'NEXT';
          const reasonCls = {
            manual_test: 'bg-amber-500/20 border-amber-400/60 text-amber-300',
            review:      'bg-violet-500/20 border-violet-400/60 text-violet-200',
            frontier:    'bg-primary/20 border-primary/60 text-primary',
            advance:     'bg-emerald-500/20 border-emerald-400/60 text-emerald-300',
            maintenance: 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300',
          }[preview.reason] || 'bg-secondary border-border text-foreground';
          return (
        <div className="bg-secondary/35 border border-border/80 rounded-xl p-3.5 space-y-2 text-center shadow-inner">
          <div className="text-[10px] font-mono uppercase tracking-widest font-semibold text-primary/80 flex items-center justify-center gap-1.5 flex-wrap">
            <Brain className="w-3.5 h-3.5 animate-pulse text-primary" /> Cognitive Coach Autopilot
            <span className={`text-[9px] font-mono uppercase tracking-widest border px-1.5 py-0.5 rounded ${reasonCls}`}>{reasonLabel}</span>
          </div>
          <div className="text-[11px] font-mono font-bold text-fuchsia-400">
            {phaseDisplayTitle(previewPhaseIdx) || "Phase 1: Classic N-1 Warm-up"}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground/90 max-w-sm mx-auto leading-normal">
            "{previewPhase.desc || ""}"
          </p>
          {/* One inline summary row stays visible: mastery + difficulty/N/speed. */}
          <div className="flex justify-between items-center text-[10px] font-mono border-t border-border/40 pt-2 px-1 gap-2 flex-wrap">
            <span className="text-muted-foreground">Mastery: <strong className="text-violet-300">{masteryLabel(coachState.phaseMastery?.[previewPhaseIdx], coachState.sessionCount || 0)}</strong></span>
            <span className="text-muted-foreground">D{previewPhase.difficulty ?? '?'} · N={previewPhase.nLevel || 2} · {previewPhase.speedMs || 3200}ms</span>
          </div>
          {/* Capacity Credits chip row — g (engagement), ΔIQ (training
              estimate, probe-gated), Far Transfer Score (rolling probe wins).
              Click anywhere to jump to the Stats breakdown. */}
          {capacityCredits && (
            <button
              type="button"
              onClick={() => { window.location.hash = '#/stats?panel=credits'; }}
              className="w-full flex items-center justify-between font-mono px-1 py-1.5 rounded hover:bg-secondary/40 transition-colors gap-2 flex-wrap"
              title="Click for the Capacity Credits breakdown"
            >
              <span className="flex items-baseline gap-1.5" title="Training credit — volume × quality. Engagement, not a cognitive measure.">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">g</span>
                <strong className="text-sm sm:text-base text-emerald-300">{capacityCredits.totals.gTotal.toLocaleString()}</strong>
              </span>
              <span className="flex items-baseline gap-1.5" title="Training-estimated Δ-IQ trajectory. Updates on probe wins only; validated Δ-IQ comes from the Reasoning Index.">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">ΔIQ</span>
                <strong className={`text-sm sm:text-base ${capacityCredits.totals.iqCreditTotal >= 0 ? 'text-cyan-300' : 'text-amber-300'}`}>
                  {capacityCredits.totals.iqCreditTotal >= 0 ? '+' : ''}{capacityCredits.totals.iqCreditTotal.toFixed(2)}
                </strong>
              </span>
              <span className="flex items-baseline gap-1.5" title="Far Transfer Score — rolling probe-win % across switch + recheck probes.">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">FT</span>
                {capacityCredits.totals.farTransferPct == null ? (
                  <strong className="text-sm sm:text-base text-muted-foreground/70">—</strong>
                ) : (
                  <strong className="text-sm sm:text-base text-fuchsia-300">
                    {capacityCredits.totals.farTransferPct}%
                    <span className="ml-1 text-[10px] text-muted-foreground/60 font-normal">{tierLabel(capacityCredits.totals.tier)}</span>
                  </strong>
                )}
              </span>
            </button>
          )}
          {/* Coach details (Rank / Sessions / Frontier / Test-phase override) —
              collapsed by default to keep the card scannable. */}
          <button
            onClick={() => setShowCoachDetails(v => !v)}
            className="w-full flex items-center justify-center gap-1 pt-1 text-[10px] font-mono text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            {showCoachDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Coach details
          </button>
          {showCoachDetails && (<>
          <div className="text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
            Rank: <strong className="text-emerald-400">{coachState.rankName}</strong>
          </div>
          <div className="text-[9px] font-mono text-muted-foreground/60 italic">
            Sessions played: {coachState.sessionCount || 0} · Frontier: {phaseDisplayTitle(coachState.phaseIndex || 0) || '—'} · D{COACH_PHASES[coachState.phaseIndex || 0]?.difficulty ?? '?'}
          </div>
          {/* Manual phase selector — pick any phase to test without losing
              real curriculum progress. Selecting "My progress" clears the
              override and goes back to the coach's choice. */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">Test phase</span>
            <select
              value={testPhaseIndex !== null ? testPhaseIndex : ''}
              onChange={(e) => {
                const v = e.target.value;
                setTestPhaseIndex(v === '' ? null : Number(v));
              }}
              className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground"
            >
              <option value="">Auto (mastery-scheduled)</option>
              {/* Sorted by difficulty (low → high) so the dropdown reflects
                  the actual progression, not the historical build order. */}
              {difficultyOrder().map(({ phaseIndex: i }, rankIdx) => {
                const p = COACH_PHASES[i];
                const m = coachState.phaseMastery?.[i];
                // Drop the "new" suffix — its absence already conveys
                // "not attempted yet". Keep [Lvl N] for played phases.
                const lvlStr = m && m.attempts > 0 ? ` · Lvl ${m.masteryLevel}` : '';
                return (
                  <option key={i} value={i}>
                    Phase {rankIdx + 1}: {p.title} · D{p.difficulty}{lvlStr}
                  </option>
                );
              })}
            </select>
            {testPhaseIndex !== null && (
              <button
                onClick={() => setTestPhaseIndex(null)}
                className="text-[10px] font-mono px-1.5 py-1 rounded border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition-colors shrink-0"
                title="Clear override — go back to your real coach progress"
              >
                ✕
              </button>
            )}
          </div>
          </>)}
        </div>
          );
        })()}

        {/* Quick Actions & Presets */}
        <div className="flex gap-2 justify-center shrink-0">
          <Button
            onClick={() => {
              const p = COACH_PHASES[effectivePhaseIndex] || COACH_PHASES[0];
              setNLevel(p.nLevel);
              setRounds(p.rounds);
              setSpeedMs(p.speedMs);
              setModes(p.modes);
              if (p.streamsCount === 2) {
                setExtraStreams([{
                  key: 'KeyF',
                  keyDisplay: 'F',
                  positionKey: 'KeyK',
                  positionKeyDisplay: 'K',
                  cctKey: 'KeyC',
                  cctKeyDisplay: 'C',
                  rstKey: 'KeyR',
                  rstKeyDisplay: 'R',
                  streamType: 'relation'
                }]);
              } else {
                setExtraStreams([]);
              }
              setEnabledCats(prev => {
                const copy = new Set(prev);
                copy.add('VERBAL');
                copy.add('SOUND');
                return copy;
              });
              alert(`🚀 PERSONALIZED WARM-UP LOADED!\n\nParameters customized to your current Coach Level (Level ${(coachState.phaseIndex || 0) + 1}):\nN=${p.nLevel} (Base), ${p.rounds} Rounds, ${p.speedMs}ms\n\nModes: ${p.modes.length > 0 ? p.modes.map(m => m.replace(/_/g, ' ')).join(', ') : 'normal relation matching'}.\nCategories: Verbal & Sound enabled.\n\nPress 'Manual Mode' or 'Coach Autopilot' below to begin!`);
            }}
            className="flex-1 h-9 bg-gradient-to-r from-amber-600 to-fuchsia-600 hover:from-amber-500 hover:to-fuchsia-500 text-white font-mono text-xs gap-1.5 shadow-lg shadow-fuchsia-600/20"
          >
            <Zap className="w-3.5 h-3.5" /> Daily Warm-up
          </Button>

          <Button 
            variant="outline"
            onClick={() => setShowLedger(true)}
            className="flex-1 h-9 border-primary/30 text-primary hover:bg-primary/5 font-mono text-xs gap-1.5"
          >
            <TrendingUp className="w-3.5 h-3.5" /> Transfer Ledger
          </Button>
        </div>

        {/* Advanced settings — every per-mode panel and toggle lives behind
            this one expander. Default collapsed for first-time visitors
            (sokuichi feedback: "ui is pretty cluttered"). Setting persists
            via lastSettings.uiPreferences. */}
        <div className="space-y-2">
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/60 border border-border hover:border-muted-foreground/40 transition-colors"
          >
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Advanced settings</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-muted-foreground/70">N={nLevel} · {modes.length} {modes.length === 1 ? 'mode' : 'modes'} · {1 + extraStreams.length} {extraStreams.length === 0 ? 'stream' : 'streams'}</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          </button>
        </div>

        <AnimatePresence>
        {showAdvanced && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
        <div className="space-y-6 pt-2">

        {/* N-Level spinner */}
        <div className="space-y-2">
          <label className="block text-xs font-mono text-muted-foreground uppercase tracking-widest text-center" title="How many trials back you must remember. N=2 means match what appeared 2 trials ago.">
            N-Level {modes.includes('variable_n') && <span className="text-primary/60 normal-case">(base)</span>}
          </label>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setNLevel(n => {
                // Honor minN requirements from any active mode so the user can't
                // bring N below what RINT / NRINT / etc. need.
                const activeMinN = Math.max(1, ...modes.map(m => MODE_OPTIONS.find(o => o.id === m)?.minN || 1));
                return Math.max(activeMinN, n - 1);
              })}
              className="w-10 h-10 rounded-lg bg-secondary border border-border text-muted-foreground hover:border-muted-foreground/50 flex items-center justify-center transition-colors">
              <Minus className="w-4 h-4" />
            </button>
            <div className="w-20 h-12 rounded-xl bg-primary/15 border-2 border-primary flex items-center justify-center">
              <span className="font-mono text-2xl font-bold text-primary">{nLevel}</span>
            </div>
            <button
              onClick={() => setNLevel(n => n + 1)}
              className="w-10 h-10 rounded-lg bg-secondary border border-border text-muted-foreground hover:border-muted-foreground/50 flex items-center justify-center transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Relationship Type Selector */}
        <div className={`space-y-2 ${poolIgnoredCls}`}>
          <button
            onClick={() => setShowRelTypes(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 border border-border hover:border-muted-foreground/40 transition-colors">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Relationship Types
            </span>
            <div className="flex items-center gap-2">
              {poolIgnoredNote}
              <span className="text-xs font-mono text-primary">{selectedRels.length}/{totalRels}</span>
              {showRelTypes ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          </button>

          <AnimatePresence>
            {showRelTypes && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="space-y-3 pt-1">
                  {Object.entries(RELATIONSHIP_CATEGORIES).map(([cat, members]) => {
                    const meta = CATEGORY_META[cat];
                    if (!meta) return null; // Skip categories without metadata

                    // Only RINT-capable modes require transitive relationships
                    const isRINTMode = modes.includes('rint') || modes.includes('mixed_rint') || modes.includes('impossible');
                    const restrictedRels = isRINTMode
                      ? new Set(filterTransitiveRelationships(members, true, false))
                      : new Set(members);

                    const allOn = members.every(r => enabledRels.has(r) && restrictedRels.has(r));
                    const someOn = members.some(r => enabledRels.has(r) && restrictedRels.has(r));
                    return (
                      <div key={cat} className={`rounded-lg border p-3 space-y-2 ${someOn ? meta.border : 'border-border'} ${someOn ? meta.bg : 'bg-secondary/20'}`}>
                        {/* Category header toggle */}
                        <div className="flex items-center justify-between">
                          <button onClick={() => toggleCat(cat)}
                            className="flex items-center gap-2">
                            <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors
                              ${allOn ? `${meta.bg} ${meta.border}` : someOn ? `${meta.bg} ${meta.border}` : 'border-border bg-transparent'}`}>
                              {allOn && <div className={`w-1.5 h-1.5 rounded-sm ${meta.color.replace('text-', 'bg-')}`} />}
                              {!allOn && someOn && <div className="w-1.5 h-0.5 bg-amber-400 rounded" />}
                            </div>
                            <span className={`text-xs font-mono font-semibold ${meta.color}`}>{meta.label}</span>
                            <span className="text-xs font-mono text-muted-foreground">
                              ({members.filter(r => enabledRels.has(r) && restrictedRels.has(r)).length}/{restrictedRels.size})
                            </span>
                          </button>
                        </div>
                        {/* Individual toggles */}
                        <div className="flex flex-wrap gap-1.5">
                          {members.map(rel => {
                            const on = enabledRels.has(rel);
                            const allowed = restrictedRels.has(rel);
                            const disabled = !allowed && isRINTMode;
                            return (
                              <button key={rel} onClick={() => allowed && toggleRel(rel, cat)}
                                disabled={disabled}
                                className={`px-2 py-0.5 rounded text-xs font-mono transition-all border
                                  ${disabled ? 'border-border/30 text-muted-foreground/30 cursor-not-allowed' : on ? `${meta.bg} ${meta.border} ${meta.color}` : 'border-border text-muted-foreground/50 hover:border-muted-foreground/30'}`}>
                                {REL_DISPLAY[rel] || rel}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stimuli Mix */}
        <div className={`space-y-2 ${poolIgnoredCls}`}>
          <div
            onClick={() => setShowStimuliMix(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 border border-border hover:border-muted-foreground/40 transition-colors cursor-pointer">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Stimuli Mix</span>
            <div className="flex items-center gap-2">
              {poolIgnoredNote}
              <button
                onClick={e => { e.stopPropagation(); setUseCustomMix(v => !v); }}
                className={`px-2 py-0.5 rounded text-xs font-mono border transition-all ${useCustomMix ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'}`}>
                {useCustomMix ? 'Custom' : 'Equal'}
              </button>
              {showStimuliMix ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          </div>

          <AnimatePresence>
            {showStimuliMix && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="space-y-3 pt-1 px-1">
                  {Object.entries(CATEGORY_META).map(([cat, meta]) => {
                    const members = RELATIONSHIP_CATEGORIES[cat];
                    if (!members) return null; // Skip if category doesn't exist
                    const hasMembersEnabled = members.some(r => enabledRels.has(r));
                    if (!hasMembersEnabled) return null;
                    const pct = normalizedPct(cat);
                    const accentColor = cat === 'SPATIAL' ? '#22d3ee'
                      : cat === 'SPATIAL_3D' ? '#38bdf8'
                      : cat === 'TRAIT' ? '#a78bfa'
                      : cat === 'QUANT' ? '#fbbf24'
                      : cat === 'COMPLEX' ? '#e879f9'
                      : cat === 'SOUND' ? '#fb7185'
                      : '#34d399';
                    return (
                      <div key={cat} className={`space-y-1 rounded-lg p-2 border ${useCustomMix ? meta.border + ' ' + meta.bg : 'border-border bg-secondary/20'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-mono font-semibold ${meta.color}`}>{meta.label}</span>
                          <span className="text-xs font-mono text-muted-foreground">{useCustomMix ? `${pct}%` : 'equal'}</span>
                        </div>
                        {useCustomMix && (
                          <div className="flex items-center gap-2 md:gap-3">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={catWeights[cat] ?? 25}
                              onChange={e => setCatWeight(cat, e.target.value)}
                              className="hidden md:flex flex-1 h-1.5 rounded-full cursor-pointer"
                              style={{ accentColor }}
                            />
                            <div className="flex gap-1 flex-1 md:flex-none">
                              <button onClick={() => setCatWeight(cat, Math.max(0, (catWeights[cat] ?? 25) - 5))}
                                className="flex-1 md:w-5 h-8 md:h-5 rounded bg-secondary border border-border text-muted-foreground hover:border-muted-foreground/50 flex items-center justify-center text-xs md:text-xs transition-colors font-semibold">−</button>
                              <button onClick={() => setCatWeight(cat, Math.min(100, (catWeights[cat] ?? 25) + 5))}
                                className="flex-1 md:w-5 h-8 md:h-5 rounded bg-secondary border border-border text-muted-foreground hover:border-muted-foreground/50 flex items-center justify-center text-xs md:text-xs transition-colors font-semibold">+</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs font-mono text-muted-foreground/50">Toggle "Equal/Custom" to bias category frequencies. Weights are relative.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Token Mix (for verbal stimuli) */}
        <div className={`space-y-2 ${poolIgnoredCls}`}>
          <button
            onClick={() => setShowTokenMix(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 border border-border hover:border-muted-foreground/40 transition-colors">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Token Style Mix</span>
            <div className="flex items-center gap-2">
              {poolIgnoredNote}
              <span className="text-xs font-mono text-primary/70 truncate max-w-[160px]">
                {TOKEN_META.filter(t => tokenWeights[t.id] > 0).map(t => `${t.label} ${tokenPct(t.id)}%`).join(' · ')}
              </span>
              {showTokenMix ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            </div>
          </button>

          <AnimatePresence>
            {showTokenMix && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="space-y-3 pt-1 px-1">
                  {TOKEN_META.map(({ id, label, color, desc }) => (
                    <div key={id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-mono font-semibold" style={{ color }}>{label}</span>
                          <span className="hidden md:inline text-xs font-mono text-muted-foreground/50 ml-2">{desc}</span>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">{tokenPct(id)}%</span>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={tokenWeights[id]}
                          onChange={e => setTokenWeight(id, e.target.value)}
                          className="hidden md:flex flex-1 h-1.5 rounded-full cursor-pointer"
                          style={{ accentColor: color }}
                        />
                        <div className="flex gap-1 flex-1 md:flex-none">
                          <button onClick={() => setTokenWeight(id, Math.max(0, tokenWeights[id] - 5))}
                            className="flex-1 md:w-5 h-8 md:h-5 rounded bg-secondary border border-border text-muted-foreground hover:border-muted-foreground/50 flex items-center justify-center text-xs transition-colors font-semibold">−</button>
                          <button onClick={() => setTokenWeight(id, Math.min(100, tokenWeights[id] + 5))}
                            className="flex-1 md:w-5 h-8 md:h-5 rounded bg-secondary border border-border text-muted-foreground hover:border-muted-foreground/50 flex items-center justify-center text-xs transition-colors font-semibold">+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs font-mono text-muted-foreground/50">Controls token style in verbal stimuli. Set to 0 to disable a type.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Synaesthesia Settings */}
        <div className="space-y-2 rounded-lg bg-secondary/35 border border-border/80 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary animate-pulse" />
              <div>
                <span className="block text-xs font-mono font-bold text-foreground uppercase tracking-wider">Synaesthesia Mode</span>
                <span className="block text-[10px] font-mono text-muted-foreground">Vibrant custom character-color mappings</span>
              </div>
            </div>
            <button
              onClick={() => setSynaesthesiaEnabled(!synaesthesiaEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${synaesthesiaEnabled ? 'bg-primary' : 'bg-secondary border border-border'}`}
            >
              <div
                className={`absolute w-5 h-5 rounded-full bg-foreground transition-transform duration-200 ${synaesthesiaEnabled ? 'translate-x-6' : 'translate-x-0.5'}`}
                style={{ top: '1px' }}
              />
            </button>
          </div>

          {synaesthesiaEnabled && (
            <div className="pt-2.5 border-t border-border/40 space-y-2">
              <button
                onClick={() => setShowSynaesthesiaEditor(!showSynaesthesiaEditor)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-background border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-all"
              >
                <span>Customize Grapheme Colors</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-primary font-bold">
                  {showSynaesthesiaEditor ? 'Collapse' : 'Expand Editor'}
                </span>
              </button>

              {showSynaesthesiaEditor && (
                <div className="p-3 rounded bg-background/80 border border-border/60 space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Grapheme-Color Map</span>
                    <button
                      onClick={() => {
                        if (confirm('Reset custom colors to default presets?')) {
                          setSynaesthesiaMap(DEFAULT_COLOR_MAP);
                        }
                      }}
                      className="text-[9px] font-mono text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Reset Defaults
                    </button>
                  </div>
                  
                  {/* Grid for alphabet and digits */}
                  <div className="grid grid-cols-6 gap-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                    {Object.keys(synaesthesiaMap).sort().map(char => {
                      const color = synaesthesiaMap[char];
                      return (
                        <div key={char} className="flex flex-col items-center gap-1 p-1 bg-secondary/50 border border-border rounded">
                          <span className="text-xs font-mono font-bold text-foreground">{char}</span>
                          <div className="relative w-6 h-6 rounded overflow-hidden border border-border/80 cursor-pointer hover:scale-105 transition-all">
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => {
                                setSynaesthesiaMap(prev => ({
                                  ...prev,
                                  [char]: e.target.value
                                }));
                              }}
                              className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer bg-transparent"
                              style={{ width: '150%', height: '150%', transform: 'translate(-15%, -15%)' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Streams */}
        <div className="space-y-2">
          <label className="block text-xs font-mono text-muted-foreground uppercase tracking-widest">Streams</label>
          <div className="space-y-2">
            {/* Stream A */}
            <StreamRow
              label="Stream A" labelColor="text-primary" borderColor="border-primary/20"
              keyCode={streamAKey} positionKeyCode={streamAPositionKey} cctKeyCode={streamACCTKey} rstKeyCode={streamARSTKey}
              showPositionKey={alienModeActive} showCCTKey={cctOverlayActive} showRSTKey={rstOverlayActive}
              onKeyChange={setStreamAKey} onPositionKeyChange={setStreamAPositionKey} onCCTKeyChange={setStreamACCTKey} onRSTKeyChange={setStreamARSTKey}
              allStreamKeys={allStreamKeys} thisKey={streamAKey} thisPositionKey={streamAPositionKey} thisCCTKey={streamACCTKey} thisRSTKey={streamARSTKey}
              streamType={streamAType} onStreamTypeChange={setStreamAType}
            />
            {/* Extra streams */}
            {extraStreams.map((stream, idx) => {
              const label = STREAM_LABELS[1 + idx] || String(2 + idx);
              const color = STREAM_COLORS[1 + idx] || 'text-primary';
              const border = 'border-accent/20';
              return (
                <StreamRow key={idx}
                  label={`Stream ${label}`} labelColor={color} borderColor={border}
                  keyCode={stream.key} positionKeyCode={stream.positionKey || stream.key} cctKeyCode={stream.cctKey || 'KeyM'} rstKeyCode={stream.rstKey || 'KeyR'}
                  showPositionKey={alienModeActive} showCCTKey={cctOverlayActive} showRSTKey={rstOverlayActive}
                  onKeyChange={code => setStreamKey(idx, code)} onPositionKeyChange={code => setStreamPositionKey(idx, code)} onCCTKeyChange={code => setStreamCCTKey(idx, code)} onRSTKeyChange={code => setStreamRSTKey(idx, code)}
                  allStreamKeys={allStreamKeys} thisKey={stream.key} thisPositionKey={stream.positionKey} thisCCTKey={stream.cctKey} thisRSTKey={stream.rstKey}
                  onRemove={() => removeStream(idx)}
                  streamType={stream.streamType || 'relation'} onStreamTypeChange={(t) => setStreamType(idx, t)}
                />
              );
            })}
            {/* Add stream button */}
            <button onClick={addStream}
              disabled={1 + extraStreams.length >= MAX_STREAMS}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-dashed border-border hover:border-muted-foreground/40 text-xs font-mono text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <Plus className="w-3.5 h-3.5" />
              {1 + extraStreams.length >= MAX_STREAMS ? 'Max Streams Reached' : 'Add Stream'}
            </button>

          </div>
        </div>

        {/* Nonverbal RINT Settings */}
        {nrintActive && (
          <div className="space-y-3 rounded-lg bg-secondary/30 border border-border p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-mono text-fuchsia-300 uppercase tracking-widest">Nonverbal RINT Settings</label>
              <span className="text-[10px] font-mono text-fuchsia-400/70">{nrintEnabledFlags.length}/{NRINT_FLAGS.length} attrs active</span>
            </div>
            <p className="text-xs font-mono text-muted-foreground/70 leading-relaxed">
              Match rule: current attrs == union of some subset of last N stims. Pick which attributes to use — disabled ones never fire.
            </p>
            {['visual', 'audio'].map(group => {
              const groupFlags = NRINT_FLAGS.filter(f => NRINT_FLAG_META[f].group === group);
              return (
                <div key={group} className="space-y-1.5">
                  <div className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-widest">{group}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {groupFlags.map(f => {
                      const on = nrintEnabledFlags.includes(f);
                      const meta = NRINT_FLAG_META[f];
                      return (
                        <button key={f}
                          onClick={() => toggleNrintFlag(f)}
                          title={meta.desc}
                          className={`px-2 py-1 rounded text-xs font-mono border transition-colors ${on
                            ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-200 font-semibold'
                            : 'bg-secondary/40 border-border text-muted-foreground hover:border-muted-foreground/50'}`}>
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-1 border-t border-fuchsia-500/20">
              <div>
                <span className="text-xs font-mono text-foreground">Hide legend labels</span>
                <p className="text-[10px] font-mono text-muted-foreground/70">Truly nonverbal display — no TOUCH / HOLLOW / etc. words underneath the shapes.</p>
              </div>
              <button
                onClick={() => setNrintHideLegend(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${nrintHideLegend ? 'bg-fuchsia-500' : 'bg-secondary border border-border'}`}
              >
                <div
                  className={`absolute w-5 h-5 rounded-full bg-foreground transition-transform ${nrintHideLegend ? 'translate-x-6' : 'translate-x-0.5'}`}
                  style={{ top: '2.5px' }}
                />
              </button>
            </div>
            {/* Max features per trial — caps how many attributes can be ON
                simultaneously on any single stim. 0 = no cap (all enabled
                flags eligible). Lets the player bound tracking load. */}
            <div className="pt-2 border-t border-fuchsia-500/20 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-mono text-foreground">Max features per trial</span>
                  <p className="text-[10px] font-mono text-muted-foreground/70">Cap how many attributes appear at once on a single stimulus. 0 = no cap (up to all {nrintEnabledFlags.length} enabled).</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setNrintMaxPerTrial(v => Math.max(0, v - 1))}
                    className="px-2 py-1 rounded bg-secondary/40 border border-border text-foreground text-xs font-mono">−</button>
                  <span className="text-sm font-mono font-bold text-fuchsia-200 min-w-[3ch] text-center">
                    {nrintMaxPerTrial === 0 ? '∞' : Math.min(nrintMaxPerTrial, nrintEnabledFlags.length)}
                  </span>
                  <button
                    onClick={() => setNrintMaxPerTrial(v => Math.min(nrintEnabledFlags.length, v + 1))}
                    className="px-2 py-1 rounded bg-secondary/40 border border-border text-foreground text-xs font-mono">+</button>
                </div>
              </div>
              {nrintMaxPerTrial > 0 && nrintMaxPerTrial < nrintEnabledFlags.length && (
                <p className="text-[10px] font-mono text-fuchsia-400/80">
                  Each stim will show at most {nrintMaxPerTrial} of the {nrintEnabledFlags.length} enabled feature{nrintMaxPerTrial === 1 ? '' : 's'}.
                </p>
              )}
            </div>
            {/* Match rules (multi-select with per-rule weights) — what counts
                as a target over the last-N tail. With one rule enabled this
                behaves identically to the original single-rule mode; with
                multiple rules enabled the engine samples one rule per trial
                in proportion to the weights. Grapist follow-up. */}
            <div className="pt-2 border-t border-fuchsia-500/20 space-y-1.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-mono text-foreground">Match rules · per-rule weights</span>
                  <p className="text-[10px] font-mono text-muted-foreground/70">Enable one or more; weight controls per-trial frequency.</p>
                </div>
                <span className="text-[10px] font-mono text-fuchsia-400/70">{nrintEnabledRules.length} active</span>
              </div>
              <div className="space-y-1">
                {NRINT_MATCH_RULES.map(r => {
                  const m = NRINT_MATCH_RULE_META[r];
                  const weight = nrintMatchRuleWeights[r] || 0;
                  const on = weight > 0;
                  const pct = on && nrintWeightTotal > 0 ? Math.round((weight / nrintWeightTotal) * 100) : 0;
                  return (
                    <div key={r}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded border transition-colors ${on
                        ? 'bg-fuchsia-500/10 border-fuchsia-400/50'
                        : 'bg-secondary/30 border-border'}`}>
                      <button
                        type="button"
                        onClick={() => toggleNrintRule(r)}
                        title={m.desc}
                        className={`shrink-0 w-20 px-2 py-1 rounded text-[11px] font-mono uppercase tracking-wide text-left ${on
                          ? 'bg-fuchsia-500/30 text-fuchsia-100 font-semibold'
                          : 'bg-secondary/60 text-muted-foreground hover:text-foreground'}`}>
                        {m.label}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={weight}
                        onChange={e => setNrintRuleWeight(r, e.target.value)}
                        disabled={!on}
                        className="flex-1 accent-fuchsia-400 disabled:opacity-30"
                        title="Weight (0 = off, higher = more frequent)"
                      />
                      <span className={`shrink-0 w-12 text-right text-[10px] font-mono ${on ? 'text-fuchsia-300' : 'text-muted-foreground/50'}`}>
                        {on ? `${weight} · ${pct}%` : 'off'}
                      </span>
                    </div>
                  );
                })}
              </div>
              {nrintEnabledRules.length === 1 && (
                <p className="text-[10px] font-mono text-fuchsia-400/80 leading-relaxed">{NRINT_MATCH_RULE_META[nrintEnabledRules[0]].desc}</p>
              )}
              {nrintEnabledRules.length > 1 && (
                <p className="text-[10px] font-mono text-fuchsia-400/80 leading-relaxed">
                  Each trial independently picks a rule by weight: {nrintEnabledRules.map(r => `${NRINT_MATCH_RULE_META[r].label} ${Math.round((nrintMatchRuleWeights[r] / nrintWeightTotal) * 100)}%`).join(' · ')}.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Trajectory N-Back / Schema Transfer (SR + TEM) Settings */}
        {tjnActive && (
          <div className="space-y-3 rounded-lg bg-secondary/30 border border-border p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-mono text-indigo-300 uppercase tracking-widest">Trajectory N-Back · Predictive Map</label>
              <span className="text-[10px] font-mono text-indigo-400/70">Stachenfeld 2017 · Behrens 2020</span>
            </div>
            <p className="text-xs font-mono text-muted-foreground/70 leading-relaxed">
              Each session pre-generates a graph; you walk through it as a random walk. After a short learning phase the edges fade — you must internalize the topology from memory. Targets the hippocampus + entorhinal predictive map system, distinct from PFC working memory.
            </p>

            {/* Tier selector */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-widest">Tier (target rule)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {TJN_TIERS.map(t => {
                  const meta = TJN_TIER_META[t];
                  const on = tjnTier === t;
                  return (
                    <button key={t}
                      onClick={() => setTjnTier(t)}
                      title={meta.desc}
                      className={`flex flex-col items-start gap-0.5 px-2.5 py-2 rounded text-left border transition-colors ${on
                        ? 'bg-indigo-500/20 border-indigo-400 text-indigo-100 font-semibold'
                        : 'bg-secondary/40 border-border text-muted-foreground hover:border-muted-foreground/50'}`}>
                      <span className="text-xs font-mono uppercase tracking-wide">{meta.label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground/80 leading-tight">{meta.desc.split('(')[0].trim()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topology selector */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-widest">Topology Family</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {Object.entries(TJN_TOPOLOGY_LABELS).map(([id, label]) => {
                  const on = tjnTopology === id;
                  return (
                    <button key={id}
                      onClick={() => setTjnTopology(id)}
                      className={`px-2 py-1.5 rounded text-xs font-mono border transition-colors ${on
                        ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200 font-semibold'
                        : 'bg-secondary/40 border-border text-muted-foreground hover:border-muted-foreground/50'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Node count + K knobs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-widest">Nodes</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setTjnNodes(n => Math.max(4, n - 1))} className="px-2 py-1 rounded bg-secondary/40 border border-border text-foreground text-xs font-mono">−</button>
                  <span className="text-sm font-mono font-bold text-indigo-200 min-w-[2ch] text-center">{tjnNodes}</span>
                  <button onClick={() => setTjnNodes(n => Math.min(12, n + 1))} className="px-2 py-1 rounded bg-secondary/40 border border-border text-foreground text-xs font-mono">+</button>
                </div>
              </div>
              {tjnTier === 'hard' && (
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-widest">K (successor horizon)</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setTjnK(k => Math.max(1, k - 1))} className="px-2 py-1 rounded bg-secondary/40 border border-border text-foreground text-xs font-mono">−</button>
                    <span className="text-sm font-mono font-bold text-indigo-200 min-w-[2ch] text-center">{tjnK}</span>
                    <button onClick={() => setTjnK(k => Math.min(4, k + 1))} className="px-2 py-1 rounded bg-secondary/40 border border-border text-foreground text-xs font-mono">+</button>
                  </div>
                </div>
              )}
            </div>

            {/* Schema mode (TEM) toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-indigo-500/20 gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-mono text-foreground">Schema Transfer (TEM)</span>
                <p className="text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
                  Tolman-Eichenbaum mode: multiple graphs sharing topology family but with fresh node identities and themes. Tests whether you encoded the abstract schema (Behrens 2020).
                </p>
              </div>
              <button
                onClick={() => setTjnSchemaMode(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${tjnSchemaMode ? 'bg-indigo-500' : 'bg-secondary border border-border'}`}
              >
                <div
                  className={`absolute w-5 h-5 rounded-full bg-foreground transition-transform ${tjnSchemaMode ? 'translate-x-6' : 'translate-x-0.5'}`}
                  style={{ top: '2.5px' }}
                />
              </button>
            </div>
            {tjnSchemaMode && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-widest">Schema Blocks (graphs per session)</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setTjnSchemaBlocks(b => Math.max(2, b - 1))} className="px-2 py-1 rounded bg-secondary/40 border border-border text-foreground text-xs font-mono">−</button>
                  <span className="text-sm font-mono font-bold text-indigo-200 min-w-[2ch] text-center">{tjnSchemaBlocks}</span>
                  <button onClick={() => setTjnSchemaBlocks(b => Math.min(5, b + 1))} className="px-2 py-1 rounded bg-secondary/40 border border-border text-foreground text-xs font-mono">+</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Decoy Filter (selective attention) settings */}
        {decoyFilterActive && (
          <div className="space-y-3 rounded-lg bg-secondary/30 border border-border p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-mono text-amber-300 uppercase tracking-widest">Decoy Filter · Selective Attention</label>
              <span className="text-[10px] font-mono text-amber-400/70">{activeDecoyCategories.length} categories in pool</span>
            </div>
            <p className="text-xs font-mono text-muted-foreground/70 leading-relaxed">
              Decoy categories are stimuli you must IGNORE — withhold even if they match. Drawn only from your selected relation types; at least one category always stays relevant.
            </p>

            {activeDecoyCategories.length < 2 && (
              <p className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5">
                Select relations from at least 2 categories for the decoy filter to work (it needs something to ignore AND something to respond to).
              </p>
            )}

            {/* Decoy source: random per-stream vs manual pick */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-widest">Decoy categories</div>
              <div className="flex rounded border border-border overflow-hidden text-xs font-mono w-max">
                <button onClick={() => setDecoyFilterRandom(true)}
                  className={`px-3 py-1 transition-colors ${decoyFilterRandom ? 'bg-amber-500/25 text-amber-300 font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
                  Random / stream
                </button>
                <button onClick={() => setDecoyFilterRandom(false)}
                  className={`px-3 py-1 transition-colors ${!decoyFilterRandom ? 'bg-amber-500/25 text-amber-300 font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
                  Manual
                </button>
              </div>
              {decoyFilterRandom ? (
                <p className="text-[10px] font-mono text-muted-foreground/70">Each stream independently picks 1+ random decoy categories at session start (you'll be shown which on each stream).</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeDecoyCategories.map(cat => {
                    const on = decoyFilterCategories.includes(cat);
                    const meta = CATEGORY_META[cat];
                    return (
                      <button key={cat} onClick={() => toggleDecoyCategory(cat)}
                        className={`px-2 py-1 rounded text-xs font-mono border transition-colors ${on
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                          : 'bg-secondary/40 border-border text-muted-foreground hover:border-muted-foreground/50'}`}>
                        {meta?.label || cat}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Filter rule */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-widest">Filter rule</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {[
                  { id: 'never_target', label: 'Never target', sub: 'Decoys stay in the chain; pressing one = false alarm' },
                  { id: 'removed_from_chain', label: 'Removed from chain', sub: 'Decoys are noise; "N back" counts only relevant trials (harder)' },
                ].map(({ id, label, sub }) => {
                  const on = decoyFilterRule === id;
                  return (
                    <button key={id} onClick={() => setDecoyFilterRule(id)}
                      className={`flex flex-col items-start gap-0.5 px-2.5 py-2 rounded text-left border transition-colors ${on
                        ? 'bg-amber-500/20 border-amber-400 text-amber-100 font-semibold'
                        : 'bg-secondary/40 border-border text-muted-foreground hover:border-muted-foreground/50'}`}>
                      <span className="text-xs font-mono uppercase tracking-wide">{label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground/80 leading-tight">{sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* RST Settings (only when RST Side-Task is enabled) */}
        {rstOverlayActive && (
          <div className="space-y-3 rounded-lg bg-secondary/30 border border-border p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-mono text-violet-300 uppercase tracking-widest">RST Side-Task · Difficulty</label>
              <span className="text-[10px] font-mono text-violet-400/70">family pool</span>
            </div>
            <p className="text-xs font-mono text-muted-foreground/70 leading-relaxed">
              Each difficulty locks the session to exactly one family. Easy = parity (XOR over same/opposite). Medium = transitive order. Hard = <span className="text-violet-300 font-semibold">4-place analogy</span>. Extreme = <span className="text-rose-300 font-semibold">5-place meta-relations</span> (boolean combos over two analogy claims; Halford "meta-knowledge" rung). Hard + Extreme auto-extend SOA by 60% to make the read sustainable.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'easy',    label: 'Easy',    sub: 'Distinction' },
                { id: 'medium',  label: 'Medium',  sub: 'Comparison' },
                { id: 'hard',    label: 'Hard',    sub: 'Analogy (4-place)' },
                { id: 'extreme', label: 'Extreme', sub: 'Meta (5-place)' },
              ].map(({ id, label, sub }) => {
                const on = rstDifficulty === id;
                return (
                  <button key={id}
                    onClick={() => setRstDifficulty(id)}
                    className={`flex flex-col items-start gap-0.5 px-2.5 py-2 rounded text-left border transition-colors ${on
                      ? 'bg-violet-500/20 border-violet-400 text-violet-100 font-semibold'
                      : 'bg-secondary/40 border-border text-muted-foreground hover:border-muted-foreground/50'}`}>
                    <span className="text-xs font-mono uppercase tracking-wide">{label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/80">{sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Alien Settings */}
        {alienModeActive && (
          <div className="space-y-3 rounded-lg bg-secondary/30 border border-border p-3">
            <label className="block text-xs font-mono text-muted-foreground uppercase tracking-widest">Alien Rotation</label>
            {[
              { id: 'cube', label: 'Cube', active: modes.includes('alien_cube') },
              { id: 'tesseract', label: 'Tesseract', active: modes.includes('alien_tesseract') },
              { id: 'square', label: 'Square', active: modes.includes('alien_square') },
            ].filter(item => item.active).map(item => (
              <div key={item.id} className="space-y-2">
                <div className="grid grid-cols-3 gap-1 rounded border border-border overflow-hidden">
                  {['cw', 'ccw', 'random'].map(dir => (
                    <button key={dir} onClick={() => updateAlienSetting(`${item.id}Direction`, dir)}
                      className={`px-2 py-1 text-xs font-mono ${alienSettings[`${item.id}Direction`] === dir ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
                      {dir === 'cw' ? 'Clockwise' : dir === 'ccw' ? 'Counter' : 'Random'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                  <button onClick={() => updateAlienSetting(`${item.id}SpeedMode`, alienSettings[`${item.id}SpeedMode`] === 'random' ? 'fixed' : 'random')}
                    className={`px-2 py-1 rounded border text-xs font-mono ${alienSettings[`${item.id}SpeedMode`] === 'random' ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground'}`}>
                    {alienSettings[`${item.id}SpeedMode`] === 'random' ? 'Random Speed' : 'Fixed Speed'}
                  </button>
                  <input type="range" min="0.25" max="3" step="0.25" value={alienSettings[`${item.id}Speed`] || 1}
                    disabled={alienSettings[`${item.id}SpeedMode`] === 'random'}
                    onChange={e => updateAlienSetting(`${item.id}Speed`, Number(e.target.value))}
                    className="h-1.5 disabled:opacity-40" />
                  <span className="text-xs font-mono text-primary w-16 text-right">
                    {alienSettings[`${item.id}SpeedMode`] === 'random' ? '0.25–3×' : `${alienSettings[`${item.id}Speed`] || 1}×`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Carousel */}
        <div className="space-y-2 rounded-lg bg-secondary/30 border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-mono text-muted-foreground uppercase tracking-widest">Automated Carousel</label>
              <p className="text-xs font-mono text-muted-foreground/50 mt-1">Splits many streams into timed slides, then unlocks responses after all slides.</p>
            </div>
            <button
              onClick={() => setCarouselSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              className="grid grid-cols-2 rounded-lg border border-border bg-background/60 p-0.5 text-xs font-mono shrink-0"
            >
              <span className={`px-2.5 py-1 rounded-md transition-colors ${!carouselSettings.enabled ? 'bg-secondary text-foreground' : 'text-muted-foreground/50'}`}>Off</span>
              <span className={`px-2.5 py-1 rounded-md transition-colors ${carouselSettings.enabled ? 'bg-primary text-primary-foreground' : 'text-muted-foreground/50'}`}>On</span>
            </button>
          </div>
          {carouselSettings.enabled && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1 rounded border border-border overflow-hidden">
                {['auto', 6, 8, 10, 12, 15].map(value => (
                  <button key={value} onClick={() => setCarouselSettings(prev => ({ ...prev, streamsPerSlide: value }))}
                    className={`px-2 py-1 text-xs font-mono ${carouselSettings.streamsPerSlide === value ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
                    {value === 'auto' ? 'Auto' : `${value}/slide`}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">Carousel Speed</label>
                <div className="grid grid-cols-4 gap-1">
                  {CAROUSEL_SPEED_OPTIONS.map(opt => (
                    <button key={opt.ms} onClick={() => setCarouselSettings(prev => ({ ...prev, slideMs: opt.ms }))}
                      className={`px-2 py-1.5 rounded text-xs font-mono transition-all border ${carouselSettings.slideMs === opt.ms ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/40'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Session Length & Speed */}
        <div className="grid grid-cols-2 gap-3">
          {/* Trials */}
          <div className="space-y-2">
            <label className="block text-xs font-mono text-muted-foreground uppercase tracking-widest text-center" title="Total number of stimuli presented in the session.">Trials</label>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setRounds(r => Math.max(1, r - 1))}
                className="w-8 h-8 rounded-lg bg-secondary border border-border text-muted-foreground hover:border-muted-foreground/50 flex items-center justify-center transition-colors">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="w-16 h-10 rounded-lg bg-secondary/80 border border-border flex items-center justify-center">
                <span className="font-mono text-lg font-bold text-foreground">{rounds}</span>
              </div>
              <button
                onClick={() => setRounds(r => r + 1)}
                className="w-8 h-8 rounded-lg bg-secondary border border-border text-muted-foreground hover:border-muted-foreground/50 flex items-center justify-center transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Speed */}
          <div className="space-y-2">
            <label className="block text-xs font-mono text-muted-foreground uppercase tracking-widest text-center" title="Time each stimulus is shown before disappearing.">Speed</label>
            <div className="grid grid-cols-2 gap-1">
              {SPEED_OPTIONS.map(opt => (
                <button key={opt.ms} onClick={() => setSpeedMs(opt.ms)}
                  className={`px-2 py-1.5 rounded text-xs font-mono transition-all border
                    ${speedMs === opt.ms ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/40'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>



        {/* Enhancement Modes */}
        <div className="space-y-2">
          <button
            onClick={() => setShowEnhancementModes(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 border border-border hover:border-muted-foreground/40 transition-colors">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Enhancement Modes</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-primary">{activeEnhancementCount} active</span>
              {showEnhancementModes ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          </button>

          <AnimatePresence>
            {showEnhancementModes && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="grid grid-cols-1 gap-2 pt-1">
            {(() => {
              let lastPhase = null;
              return MODE_OPTIONS.map(({ id, icon: Icon, label, desc, minN, minStreams, phase }) => {
                const active = modes.includes(id);
                const needsHigherN = minN && nLevel < minN;
                const needsMoreStreams = minStreams && (1 + extraStreams.length) < minStreams;
                const blockedBy = !active && EXCLUSIVE_GROUPS.some(g => g.includes(id) && g.some(m => m !== id && modes.includes(m)))
                  ? EXCLUSIVE_GROUPS.find(g => g.includes(id) && g.some(m => m !== id && modes.includes(m)))?.find(m => m !== id && modes.includes(m))
                  : null;
                const showHeader = phase && (phase !== lastPhase);
                lastPhase = phase;
                return (
                  <React.Fragment key={id}>
                    {showHeader && (
                      <div className="mt-4 first:mt-0 mb-1 border-b border-border/40 pb-1 flex items-center justify-between col-span-1">
                        <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-fuchsia-400">{phase}</span>
                      </div>
                    )}
                    <button onClick={() => toggleMode(id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all duration-150
                        ${active ? 'border-primary bg-primary/10' : blockedBy ? 'border-border bg-secondary/20 opacity-50' : 'border-border bg-secondary/40 hover:border-muted-foreground/40'}`}>
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-mono font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
                          {minN && (
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${needsHigherN ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' : 'border-border text-muted-foreground/50'}`}>
                              N≥{minN}
                            </span>
                          )}
                          {minStreams && (
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${needsMoreStreams ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' : 'border-border text-muted-foreground/50'}`}>
                              ≥{minStreams} streams
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground/60 mt-0.5">{desc}</div>
                        {active && needsHigherN && <div className="text-xs font-mono text-amber-400 mt-1">↑ N bumped to {minN}</div>}
                        {active && needsMoreStreams && <div className="text-xs font-mono text-amber-400 mt-1">↑ Stream added automatically</div>}
                        {blockedBy && <div className="text-xs font-mono text-muted-foreground/40 mt-1">conflicts with {blockedBy.replace(/_/g,' ')}</div>}
                        {active && id === 'wrapper_morph' && (
                          <div className="mt-2.5 space-y-1.5 p-2 rounded bg-background/50 border border-border/80" onClick={e => e.stopPropagation()}>
                            <span className="block text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Morphing Style</span>
                            <div className="grid grid-cols-2 gap-1 overflow-hidden rounded border border-border bg-background">
                              {[
                                { id: 'shift', label: 'Shift Mode (Block of 5)' },
                                { id: 'chaos', label: 'Chaos Mode (Trial-by-Trial)' }
                              ].map(style => (
                                <button key={style.id} onClick={() => setWrapperMorphStyle(style.id)}
                                  className={`px-2 py-1 text-xs font-mono transition-all ${wrapperMorphStyle === style.id ? 'bg-primary/20 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
                                  {style.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  </React.Fragment>
                );
              });
            })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls hint */}
        <div className="text-center">
          <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/70 border border-border justify-center">
            <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-mono text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-semibold">
                {KEY_OPTIONS.find(k => k.code === streamAKey)?.display || 'SPACE'}
              </kbd> = Stream A REL
              {alienModeActive && <>{' '}<kbd className="px-1.5 py-0.5 rounded bg-muted text-amber-400 font-semibold">{KEY_OPTIONS.find(k => k.code === streamAPositionKey)?.display || 'P'}</kbd> = Stream A POS</>}
              {modes.includes('rst_overlay') && <>{' '}<kbd className="px-1.5 py-0.5 rounded bg-muted text-violet-400 font-semibold">{KEY_OPTIONS.find(k => k.code === streamARSTKey)?.display || 'R'}</kbd> = Stream A RST</>}
              {extraStreams.map((s, i) => (
                <span key={i}>
                  {' '}&nbsp;<kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-semibold">{s.keyDisplay}</kbd> = Stream {STREAM_LABELS[1 + i]} REL
                  {alienModeActive && <>{' '}<kbd className="px-1.5 py-0.5 rounded bg-muted text-amber-400 font-semibold">{s.positionKeyDisplay || s.keyDisplay}</kbd> = Stream {STREAM_LABELS[1 + i]} POS</>}
                  {modes.includes('rst_overlay') && <>{' '}<kbd className="px-1.5 py-0.5 rounded bg-muted text-violet-400 font-semibold">{s.rstKeyDisplay || 'R'}</kbd> = Stream {STREAM_LABELS[1 + i]} RST</>}
                </span>
              ))}

            </span>
          </div>
        </div>

        {/* Noob Mode Toggle */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/40 border border-border">
          <span className="text-xs font-mono text-muted-foreground">Noob Mode (manual next/prev)</span>
          <button
            onClick={() => setNoobMode(!noobMode)}
            className={`relative w-12 h-6 rounded-full transition-colors ${noobMode ? 'bg-primary' : 'bg-secondary border border-border'}`}
          >
            <div
              className={`absolute w-5 h-5 rounded-full bg-foreground transition-transform ${noobMode ? 'translate-x-6' : 'translate-x-0.5'}`}
              style={{ top: '2.5px' }}
            />
          </button>
        </div>

        </div>
        </motion.div>
        )}
        </AnimatePresence>

        {/* Pre-session rule briefing — surfaces the rule for each currently
            active mode (either user's manual selection OR the test phase's
            modes if test override is on). Collapsible; default expanded so
            new users see it, easy to dismiss for veterans. */}
        {(() => {
          const effectiveModes = testPhaseIndex !== null
            ? (COACH_PHASES[effectivePhaseIndex]?.modes || [])
            : modes;
          const briefedModes = effectiveModes.filter(m => MODE_RULE_BRIEFS[m]);
          if (briefedModes.length === 0) return null;
          return (
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/30">
              <button
                onClick={() => setShowRuleBrief(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-left"
              >
                <span className="text-[10px] font-mono uppercase tracking-widest font-semibold text-emerald-300 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" /> You're about to train ({briefedModes.length} active {briefedModes.length === 1 ? 'rule' : 'rules'})
                </span>
                <span className="text-[10px] font-mono text-emerald-400/70">
                  {showRuleBrief ? '▼ hide' : '▶ show'}
                </span>
              </button>
              <AnimatePresence>
                {showRuleBrief && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-emerald-500/20"
                  >
                    <div className="px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
                      {briefedModes.map(m => (
                        <div key={m} className="text-[11px] font-mono leading-relaxed">
                          <span className="text-emerald-300 font-semibold">{m.replace(/_/g, ' ')}:</span>{' '}
                          <span className="text-foreground/85">{MODE_RULE_BRIEFS[m]}</span>
                        </div>
                      ))}
                      <p className="text-[10px] font-mono text-muted-foreground/60 italic pt-1 border-t border-emerald-500/10 mt-1">
                        Rules are surfaced here, not during play — discovery still happens at the trial.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })()}

        {/* Start */}
        {soundOnlySelection && (
          <p className="text-center text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            With 2+ streams, choose at least one non-sound relationship too.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pb-4 shrink-0">
          <Button
            disabled={soundOnlySelection}
            onClick={() => {
              if (soundOnlySelection) return;
              setTokenWeights(tokenWeights);

              // Pick which phase to play: when the user has manually overridden
              // via the Test Phase dropdown, honor that; otherwise let the
              // mastery-aware scheduler pick (review-due → frontier → advance →
              // maintenance). pickResult.reason is also recorded so ResultsScreen
              // can attribute the session correctly.
              const pickResult = testPhaseIndex !== null
                ? { phaseIndex: testPhaseIndex, reason: 'manual_test' }
                : pickNextPhase(coachState, COACH_PHASES.length);
              const launchPhaseIndex = pickResult.phaseIndex;
              const currentPhase = COACH_PHASES[launchPhaseIndex] || COACH_PHASES[0];
              const autopilotN = currentPhase.nLevel;
              const autopilotSpeedMs = currentPhase.speedMs;
              const autopilotRounds = currentPhase.rounds;
              const autopilotModes = currentPhase.modes;
              
              // Stream A setup
              const streamAObj = { key: streamAKey, keyDisplay: KEY_OPTIONS.find(k => k.code === streamAKey)?.display || 'SPACE' };
              const streamAWithPosition = {
                ...streamAObj,
                positionKey: streamAPositionKey,
                positionKeyDisplay: KEY_OPTIONS.find(k => k.code === streamAPositionKey)?.display || 'P',
                cctKey: streamACCTKey,
                cctKeyDisplay: KEY_OPTIONS.find(k => k.code === streamACCTKey)?.display || 'M',
                rstKey: streamARSTKey,
                rstKeyDisplay: KEY_OPTIONS.find(k => k.code === streamARSTKey)?.display || 'R',
                streamType: autopilotModes.includes('cct') ? 'cct' : 'relation',
              };
              
              // Extra streams setup — phase can call for 2 or 3 (or more)
              // streams. Earlier this only handled streamsCount === 2 so
              // phases like 24/25 (3 streams) shipped with one. Generalize.
              const EXTRA_STREAM_TEMPLATES = [
                { key: 'KeyF', keyDisplay: 'F', positionKey: 'KeyK', positionKeyDisplay: 'K', cctKey: 'KeyC', cctKeyDisplay: 'C', rstKey: 'KeyR', rstKeyDisplay: 'R' },
                { key: 'KeyJ', keyDisplay: 'J', positionKey: 'KeyL', positionKeyDisplay: 'L', cctKey: 'KeyN', cctKeyDisplay: 'N', rstKey: 'KeyT', rstKeyDisplay: 'T' },
                { key: 'KeyA', keyDisplay: 'A', positionKey: 'KeyS', positionKeyDisplay: 'S', cctKey: 'KeyD', cctKeyDisplay: 'D', rstKey: 'KeyG', rstKeyDisplay: 'G' },
              ];
              const wantedExtras = Math.max(0, (currentPhase.streamsCount || 1) - 1);
              // A phase may mark specific extra streams as decoys via
              // `decoyExtraIndexes` (0-based among extras) — used by the
              // Selective Attention Filter phase.
              const decoyExtraIndexes = currentPhase.decoyExtraIndexes || [];
              const autopilotExtraStreams = EXTRA_STREAM_TEMPLATES
                .slice(0, wantedExtras)
                .map((t, i) => ({ ...t, streamType: decoyExtraIndexes.includes(i) ? 'decoy' : 'relation' }));

              // Pool selection — when the user is testing an arbitrary phase
              // (testPhaseIndex set), force-expand to ALL relations so the
              // phase isn't starved by their narrowed manual pool. In normal
              // coach progression, respect their pool.
              const allRels = Object.values(RELATIONSHIP_CATEGORIES).flat();
              const enabledRels = testPhaseIndex !== null ? new Set(allRels) : new Set(selectedRels);
              let autopilotPool = buildWeightedPool(enabledRels, catWeights);
              if (autopilotModes.includes('rint') || autopilotModes.includes('type_nback')) {
                autopilotPool = filterTransitiveRelationships(autopilotPool);
              }

              onStart(
                autopilotN, 
                autopilotModes, 
                autopilotPool, 
                autopilotRounds, 
                autopilotSpeedMs, 
                { 
                  catWeights, 
                  useCustomMix, 
                  rels: selectedRels, 
                  tokenWeights, 
                  streamA: streamAWithPosition, 
                  extraStreams: autopilotExtraStreams, 
                  streams: [streamAWithPosition, ...autopilotExtraStreams], 
                  alienSettings, 
                  carouselSettings, 
                  nrintEnabledFlags,
                  nrintHideLegend,
                  nrintMaxPerTrial,
                  // Coach-phase NRINT match rule overrides the manual selector.
                  nrintMatchRule: currentPhase.nrintMatchRule || nrintMatchRule,
                  nrintMatchRuleWeights: currentPhase.nrintMatchRuleWeights || (currentPhase.nrintMatchRule ? { union: 0, intersection: 0, xor: 0, implication: 0, biconditional: 0, [currentPhase.nrintMatchRule]: 1 } : nrintMatchRuleWeights),
                  // Decoy filter: a phase may force config; else use the user's.
                  decoyFilterRule: currentPhase.decoyFilterRule || decoyFilterRule,
                  decoyFilterRandom: 'decoyFilterRandom' in currentPhase ? currentPhase.decoyFilterRandom : decoyFilterRandom,
                  decoyFilterCategories: currentPhase.decoyFilterCategories || decoyFilterCategories,
                  rstDifficulty: currentPhase.rstDifficulty || rstDifficulty,
                  // Coach-phase TJN config overrides the manual selector when
                  // a phase explicitly configures Trajectory N-Back.
                  tjnTier: currentPhase.tjnTier || tjnTier,
                  tjnTopology: currentPhase.tjnTopology || tjnTopology,
                  tjnNodes: currentPhase.tjnNodes || tjnNodes,
                  tjnK: currentPhase.tjnK || tjnK,
                  tjnSchemaMode: 'tjnSchemaMode' in currentPhase ? currentPhase.tjnSchemaMode : tjnSchemaMode,
                  tjnSchemaBlocks: currentPhase.tjnSchemaBlocks || tjnSchemaBlocks,
                  wrapperMorphStyle,
                  autopilot: true,
                  phaseTitle: phaseDisplayTitle(launchPhaseIndex),
                  coachPickedPhaseIndex: launchPhaseIndex,
                  coachPickReason: pickResult.reason,
                },
                false
              );
            }}
            className="flex-1 h-12 px-6 font-mono font-bold text-xs sm:text-sm tracking-wide bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-500/20 gap-1.5"
          >
            <Zap className="w-4 h-4 animate-bounce text-white shrink-0" /> Coach Autopilot
          </Button>

          <Button
            disabled={soundOnlySelection}
            onClick={() => {
              if (soundOnlySelection) return;
              setTokenWeights(tokenWeights);
              const streamAObj = { key: streamAKey, keyDisplay: KEY_OPTIONS.find(k => k.code === streamAKey)?.display || 'SPACE' };
              const streamAWithPosition = {
                ...streamAObj,
                positionKey: streamAPositionKey,
                positionKeyDisplay: KEY_OPTIONS.find(k => k.code === streamAPositionKey)?.display || 'P',
                cctKey: streamACCTKey,
                cctKeyDisplay: KEY_OPTIONS.find(k => k.code === streamACCTKey)?.display || 'M',
                rstKey: streamARSTKey,
                rstKeyDisplay: KEY_OPTIONS.find(k => k.code === streamARSTKey)?.display || 'R',
                streamType: streamAType,
              };
              onStart(nLevel, modes, finalPool, rounds, speedMs, { catWeights, useCustomMix, rels: selectedRels, tokenWeights, streamA: streamAWithPosition, extraStreams, streams: [streamAWithPosition, ...extraStreams], alienSettings, carouselSettings, nrintEnabledFlags, nrintHideLegend, nrintMaxPerTrial, nrintMatchRule, nrintMatchRuleWeights, decoyFilterRule, decoyFilterRandom, decoyFilterCategories, rstDifficulty, tjnTier, tjnTopology, tjnNodes, tjnK, tjnSchemaMode, tjnSchemaBlocks, wrapperMorphStyle, autopilot: false }, noobMode);
            }}
            className="flex-1 h-12 px-6 font-mono font-semibold text-xs sm:text-sm tracking-wide bg-secondary hover:bg-secondary/85 text-foreground border border-border"
          >
            Manual Mode
          </Button>
        </div>

        {/* Transfer Ledger Drawer */}
        <AnimatePresence>
          {showLedger && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6"
            >
              <div className="flex-1 overflow-y-auto max-w-md w-full mx-auto space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-fuchsia-400 animate-pulse" />
                    <h3 className="font-mono font-bold text-lg text-foreground">Transfer Ledger</h3>
                  </div>
                  <button 
                    onClick={() => setShowLedger(false)}
                    className="px-2 py-1 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground font-mono text-xs rounded border border-border"
                  >
                    Close
                  </button>
                </div>

                <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                  Your stored real-world cue-fired intentions ($G_c$) mapped from logical fluid reasoning ($G_f$) training sessions:
                </p>

                <div className="space-y-3">
                  {ledgerEntries.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground font-mono text-xs">
                      No transfer operators logged yet. Finish a training session to write your first entry!
                    </div>
                  ) : (
                    ledgerEntries.map(entry => (
                      <div key={entry.id} className="bg-secondary/40 border border-border rounded-xl p-3 space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground border-b border-border/40 pb-1.5">
                          <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
                            N={entry.nLevel} &middot; {entry.accuracy}%
                          </span>
                        </div>
                        <p className="text-xs font-mono text-foreground leading-relaxed italic">
                          "{entry.text}"
                        </p>
                        <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground pt-1">
                          <span>State: <strong className="text-primary">{entry.zone?.replace('_', ' ').toUpperCase()}</strong></span>
                          <button
                            onClick={() => {
                              try {
                                const currentLedger = JSON.parse(localStorage.getItem('goated_transfer_ledger') || '[]');
                                const filtered = currentLedger.filter(item => item.id !== entry.id);
                                localStorage.setItem('goated_transfer_ledger', JSON.stringify(filtered));
                                loadLedgerEntries();
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="text-red-400 hover:text-red-300 font-bold"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="max-w-md w-full mx-auto pt-4 border-t border-border mt-4">
                <Button 
                  onClick={() => setShowLedger(false)}
                  className="w-full font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Return to Menu
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}
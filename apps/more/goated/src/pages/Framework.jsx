import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Brain } from 'lucide-react';

const MODES = [
  {
    mode: 'Normal',
    rule: 'Match the relationship from exactly N trials ago.',
    example: 'N=2. Trials: "cat BIGGER THAN ant" → "sun HOTTER THAN ice" → "dog BIGGER THAN flea". The 3rd trial matches the 1st (both BIGGER THAN) → press the key.',
  },
  {
    mode: 'Type N-Back',
    rule: 'Match by relationship category, not trial distance. Each category maintains its own queue.',
    example: '"cat BIGGER THAN ant" counts as a "comparison" type entry. The next time any comparison relationship appears (e.g. "sun FASTER THAN moon"), it counts as N=1 back in the comparison queue — regardless of how many total trials have passed.',
  },
  {
    mode: 'RINT (Relational Integration)',
    rule: 'Derive a valid logical conclusion by chaining N facts transitively. "Integration" refers to mentally combining separate relational facts into a single unified conclusion.',
    example: 'N=2. Trial 1: "alpha BIGGER THAN beta". Trial 2: "beta BIGGER THAN gamma". Trial 3: "alpha BIGGER THAN gamma" — this is the logical conclusion of the chain → target, press the key.',
  },
  {
    mode: 'Mixed N-Back',
    rule: 'Each trial randomly uses either Normal or Type N-Back rules. You never know which applies.',
    example: 'Trial 3 might use Normal rules (did this exact relationship appear 2 trials ago?) while Trial 4 uses Type rules (has this category appeared N times in its own history?). Both are possible each trial.',
  },
  {
    mode: 'Mixed RINT',
    rule: 'Three-way random per trial: Normal, Type, or RINT (Relational Integration).',
    example: 'Same as Mixed N-Back but RINT is also a possible rule. You must hold all three evaluation strategies ready simultaneously.',
  },
  {
    mode: 'Impossible',
    rule: 'On multi-stream sessions, each stream independently randomizes its rule every trial.',
    example: 'Stream A uses Normal this trial, Stream B uses RINT. Next trial: Stream A uses RINT, Stream B uses Type. Each stream shows its current mode as a badge (NRM / TYPE / RINT).',
  },
  {
    mode: 'Binary Logic',
    rule: 'Each trial assigns two N-Back conditions per stream joined by AND / OR / XOR / AND_NOT.',
    example: '"Normal AND RINT" → press only if BOTH a normal match AND a RINT conclusion are true. "Type OR Normal" → press if either condition is true. The live badge on each stream shows the active pair.',
  },
  {
    mode: 'Alien Cube Mode',
    rule: 'Adds a rotating transparent 3×3×3 cube to every stream and requires position memory in addition to relationship memory.',
    example: 'A relation block appears inside one of 27 cube cells. Press only if both the relationship and the exact cube-cell position match N steps back. Multi-stream sessions show multiple independently rotating cubes.',
  },
  {
    mode: 'Variable N',
    rule: 'N shifts ±1 randomly each trial around your chosen base N.',
    example: 'Base N=3. Trial 5 might require matching 2 trials back; Trial 6 might require 4 trials back. The effective N is shown in the HUD.',
  },
  {
    mode: 'Adaptive N',
    rule: 'N auto-adjusts between sessions based on overall accuracy.',
    example: 'You finish a session at N=3 with 85% accuracy → next session starts at N=4. Finish at 45% → next session drops to N=2. Keeps you at the productive challenge edge.',
  },
  {
    mode: 'Distractors',
    rule: 'Near-miss stimuli from the same category appear to create interference.',
    example: 'Target relationship is BIGGER THAN. A distractor might show FASTER THAN (same "comparison" category). You must not press — it is not the exact relationship from N trials ago.',
  },
];

const CATEGORIES = [
  { name: 'Spatial', color: 'text-cyan-400', desc: 'Geometric arrangements between two shapes on a canvas.', examples: 'Inside, Overlapping, Touching, Above/Below, Surrounded, Left/Right, Mirrored, Nested 3…' },
  { name: 'Spatial 3D', color: 'text-sky-400', desc: 'Volumetric and motion-based arrangements rendered with Three.js.', examples: 'Depth Layered, Orbiting, Nested Volume, Ascending Spiral, Repelling, Bound by Gravity…' },
  { name: 'Trait', color: 'text-violet-400', desc: 'Visual property comparisons between two shapes.', examples: 'Same Color, Same Shape, Rotated, Hollow vs Solid, Size Gradient, Shadow Copy, Striped…' },
  { name: 'Quantitative', color: 'text-amber-400', desc: 'Numeric count or size ratios between groups.', examples: '2:1, 3:1, Equal Count, Pyramid, Balanced Scale, Increasing Row, Decreasing Row…' },
  { name: 'Verbal', color: 'text-emerald-400', desc: 'Language-based relationships across 4 sub-types: semantic, comparison, temporal, directional.', examples: 'Causes, Part Of, Bigger Than, Before, After, North Of, Inside Of, Depends On, Transforms Into…' },
  { name: 'Sound', color: 'text-rose-400', desc: 'Non-verbal audio relationships based on synthesized tones and beat timing.', examples: 'Pitch Higher, Pitch Lower, Rhythm Faster, Rhythm Slower…' },
];

const TOKENS = [
  { name: 'Words', color: '#22d3ee', desc: 'Real meaningful words', example: 'sun, fire, mind, wolf, depth' },
  { name: 'Nonsense', color: '#a78bfa', desc: 'Pronounceable but meaningless', example: 'blim, quor, neth, vask, plox' },
  { name: 'Garbage', color: '#f87171', desc: 'Random letter strings', example: 'xqz, bvp, rtk, mwf' },
  { name: 'Emoji', color: '#fbbf24', desc: 'Standard emoji symbols', example: '🔥 💧 🌀 ⚡ 🐉' },
  { name: 'Abstract', color: '#34d399', desc: 'Geometric unicode symbols', example: '◈ ⬡ ⟐ ⭕ ✦' },
  { name: 'Random Str', color: '#fb923c', desc: 'Mixed alphanumeric codes', example: 'Xk3F, aB9z, mR7q' },
  { name: 'Voronoi', color: '#f472b6', desc: 'Mini rendered Voronoi cell diagrams', example: '(procedurally generated geometric cell art)' },
];

const Section = ({ title, colorClass = 'text-primary', borderClass = 'border-primary/30', bgClass = 'bg-primary/10', children }) => (
  <div className={`rounded-lg ${bgClass} border ${borderClass} p-6 mb-6`}>
    <h2 className={`text-lg font-mono font-semibold ${colorClass} mb-4`}>{title}</h2>
    {children}
  </div>
);

export default function Framework() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-mono font-bold text-foreground">Conceptual Framework</h1>
        </div>
        <p className="text-sm font-mono text-muted-foreground mb-8">
          A detailed technical and conceptual reference for integrating the Relational N-Back system.
        </p>

        {/* Core Mechanic */}
        <Section title="Core Mechanic">
          <p className="text-sm font-mono text-foreground/90 leading-relaxed mb-4">
            Classic N-Back asks: <em>"did this position/letter appear N trials ago?"</em><br />
            Relational N-Back asks: <em>"did this <span className="text-primary font-semibold">relationship</span> appear N trials ago?"</em>
          </p>
          <p className="text-sm font-mono text-foreground/90 leading-relaxed mb-4">
            Each trial presents a triplet: <span className="text-primary font-semibold">[Token A]</span> <span className="text-accent font-semibold">[Relationship]</span> <span className="text-primary font-semibold">[Token B]</span>
          </p>
          <div className="rounded-lg bg-secondary/60 border border-border p-4 text-sm font-mono space-y-1">
            <div><span className="text-muted-foreground">Trial 1:</span> <span className="text-cyan-300">cat</span> <span className="text-primary">BIGGER THAN</span> <span className="text-violet-300">ant</span></div>
            <div><span className="text-muted-foreground">Trial 2:</span> <span className="text-cyan-300">sun</span> <span className="text-primary">HOTTER THAN</span> <span className="text-violet-300">ice</span></div>
            <div><span className="text-muted-foreground">Trial 3 (N=2):</span> <span className="text-cyan-300">dog</span> <span className="text-primary">BIGGER THAN</span> <span className="text-violet-300">flea</span> <span className="text-emerald-400 ml-2">← TARGET ✓ (matches Trial 1)</span></div>
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-3">
            The tokens (cat, dog, flea…) are irrelevant — only the <span className="text-primary">relationship type</span> matters. Tokens exist purely to create a surface to attach the relationship to.
          </p>
        </Section>

        {/* Relationship Taxonomy */}
        <Section title="Relationship Taxonomy (6 Categories)">
          <div className="space-y-4">
            {CATEGORIES.map(({ name, color, desc, examples }) => (
              <div key={name} className="rounded-lg bg-secondary/40 border border-border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-mono font-bold ${color}`}>{name}</span>
                </div>
                <p className="text-xs font-mono text-foreground/80 mb-1">{desc}</p>
                <p className="text-xs font-mono text-muted-foreground"><span className="text-foreground/50">Examples: </span>{examples}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Enhancement Modes */}
        <Section title="Enhancement Modes" colorClass="text-accent" borderClass="border-accent/30" bgClass="bg-accent/10">
          <p className="text-sm font-mono text-muted-foreground mb-4">Modes stack on top of normal N-Back, increasing difficulty and cognitive demand.</p>
          <div className="space-y-4">
            {MODES.map(({ mode, rule, example }) => (
              <div key={mode} className="rounded-lg bg-secondary/40 border border-border p-4">
                <div className="text-sm font-mono font-bold text-accent mb-1">{mode}</div>
                <div className="text-sm font-mono text-foreground/90 mb-2">{rule}</div>
                <div className="rounded bg-secondary/80 border border-border/60 p-2 text-xs font-mono text-muted-foreground">
                  <span className="text-foreground/40 uppercase tracking-widest mr-2">Example:</span>{example}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Token System */}
        <Section title="Token System">
          <p className="text-sm font-mono text-muted-foreground mb-4">
            Tokens are the A/B entities shown in each trial. Their <em>content is irrelevant to scoring</em> — only the relationship between them matters. Token type affects cognitive load (words are easy to hold; garbage strings are hard).
          </p>
          <div className="space-y-2">
            {TOKENS.map(({ name, color, desc, example }) => (
              <div key={name} className="rounded-lg bg-secondary/40 border border-border p-3 flex gap-3">
                <span className="text-sm font-mono font-bold shrink-0 w-24" style={{ color }}>{name}</span>
                <div className="text-xs font-mono">
                  <div className="text-foreground/80">{desc}</div>
                  <div className="text-muted-foreground mt-0.5"><span className="text-foreground/40">e.g. </span>{example}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs font-mono text-muted-foreground mt-3">
            Each token type has an independent weight (0–100). The engine samples token types proportionally. Set a weight to 0 to disable that type entirely.
          </p>
        </Section>

        {/* Multi-Stream */}
        <Section title="Multi-Stream">
          <p className="text-sm font-mono text-foreground/90 leading-relaxed mb-4">
            Multiple independent relationship sequences run simultaneously side-by-side. Each stream has its own:
          </p>
          <ul className="text-sm font-mono text-muted-foreground space-y-1 mb-4 ml-3">
            <li>• <span className="text-primary">Key binding</span> — e.g. SPACE for Stream A, A for Stream B, S for Stream C</li>
            <li>• <span className="text-primary">History queue</span> — completely independent N-back window</li>
            <li>• <span className="text-primary">Mode</span> — in Impossible/Binary Logic, each stream can have a different rule per trial</li>
            <li>• <span className="text-primary">Score tracking</span> — hits, misses, false alarms tracked separately per stream</li>
          </ul>
          <div className="rounded-lg bg-secondary/60 border border-border p-4 text-xs font-mono space-y-1">
            <div className="text-muted-foreground mb-1">Example — 3 streams, N=2, Impossible mode:</div>
            <div><span className="text-primary">Stream A:</span> cat <span className="text-emerald-400">BIGGER THAN</span> ant &nbsp;<span className="text-muted-foreground/50">[RINT this trial]</span></div>
            <div><span className="text-accent">Stream B:</span> sun <span className="text-amber-400">NORTH OF</span> moon &nbsp;<span className="text-muted-foreground/50">[TYPE this trial]</span></div>
            <div><span className="text-chart-3">Stream C:</span> fire <span className="text-violet-400">CAUSES</span> smoke &nbsp;<span className="text-muted-foreground/50">[NRM this trial]</span></div>
          </div>
        </Section>

        {/* Audio-Visual Sound System */}
        <Section title="Audio-Visual Sound System" colorClass="text-emerald-400" borderClass="border-emerald-500/30" bgClass="bg-emerald-500/10">
          <p className="text-sm font-mono text-foreground/90 leading-relaxed mb-4">
            Sound relationships are intentionally non-verbal. The engine now uses pure synthesized cues — pitch direction and rhythm speed — rather than spoken words, letters, or numbers.
          </p>
          <ul className="text-sm font-mono text-muted-foreground space-y-1 mb-4 ml-3">
            <li>• <span className="text-emerald-400">Pitch cues</span> distinguish higher vs lower tone patterns.</li>
            <li>• <span className="text-emerald-400">Rhythm cues</span> distinguish fast vs slow beat patterns.</li>
            <li>• <span className="text-emerald-400">Multi-stream audio</span> selects up to two sound streams and marks them visually with green borders.</li>
            <li>• <span className="text-emerald-400">L/R badges</span> show which stream is assigned to the left or right audio side.</li>
            <li>• <span className="text-emerald-400">Speaker support</span> offsets the right-side sound slightly after the left so the two cues remain separable without headphones.</li>
          </ul>
          <p className="text-xs font-mono text-muted-foreground">
            To preserve task clarity, multi-stream sessions cannot be started with only sound relationships enabled; at least one non-sound relationship must be included.
          </p>
        </Section>

        {/* RINT Logic Constraint */}
        <Section title="RINT Logic Constraint">
          <p className="text-sm font-mono text-foreground/90 leading-relaxed mb-3">
            RINT and Type N-Back <span className="text-primary font-semibold">only use transitive relationships</span> — ones where if A rel B and B rel C, then A rel C is logically valid.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
              <div className="text-xs font-mono font-bold text-emerald-400 mb-2">✓ Transitive (allowed in RINT)</div>
              <div className="text-xs font-mono text-muted-foreground space-y-0.5">
                <div>BIGGER THAN, SMALLER THAN</div>
                <div>BEFORE, AFTER, FOLLOWS</div>
                <div>NORTH OF, ABOVE, LEFT OF</div>
                <div>CAUSES, CONTAINS, PART OF</div>
              </div>
            </div>
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
              <div className="text-xs font-mono font-bold text-destructive mb-2">✗ Non-transitive (excluded in RINT)</div>
              <div className="text-xs font-mono text-muted-foreground space-y-0.5">
                <div>OVERLAPPING, TOUCHING</div>
                <div>ORBITING, COLLIDING</div>
                <div>SAME COLOR, ROTATED</div>
                <div>EQUAL COUNT, 2:1</div>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-secondary/60 border border-border p-3 text-xs font-mono">
            <div className="text-muted-foreground mb-1">Why OVERLAPPING fails:</div>
            <div className="text-foreground/80">A overlaps B, B overlaps C <span className="text-destructive">≠</span> A overlaps C (not guaranteed)</div>
            <div className="text-muted-foreground mt-2 mb-1">Why BIGGER THAN works:</div>
            <div className="text-foreground/80">A &gt; B, B &gt; C <span className="text-emerald-400">→</span> A &gt; C (always true)</div>
          </div>
        </Section>

        {/* Scoring */}
        <Section title="Scoring & Metrics">
          <p className="text-sm font-mono text-foreground/90 mb-3">Per-stream signal detection metrics:</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { name: 'Hit', color: 'text-emerald-400', desc: 'Target trial, user pressed key' },
              { name: 'Miss', color: 'text-red-400', desc: 'Target trial, user did NOT press' },
              { name: 'False Alarm', color: 'text-amber-400', desc: 'Non-target trial, user pressed key' },
              { name: 'Correct Rejection', color: 'text-primary', desc: 'Non-target trial, user did NOT press' },
            ].map(({ name, color, desc }) => (
              <div key={name} className="rounded bg-secondary/60 border border-border p-2 text-xs font-mono">
                <div className={`font-bold ${color}`}>{name}</div>
                <div className="text-muted-foreground mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
          <p className="text-xs font-mono text-muted-foreground">
            Sessions are stored locally with full trial-by-trial replay. The Stats page shows aggregate accuracy over time. Adaptive mode uses accuracy thresholds (≥80% → N+1, ≤50% → N−1) to keep difficulty calibrated.
          </p>
        </Section>

        {/* Integration */}
        <Section title="Integration Entry Points" colorClass="text-accent" borderClass="border-accent/30" bgClass="bg-accent/10">
          <div className="space-y-5 text-sm font-mono">
            <div>
              <div className="text-accent font-bold mb-1">1. Embed the full GameScreen component</div>
              <p className="text-muted-foreground mb-2">Drop-in the entire game UI. You own the setup, it handles the loop.</p>
              <div className="rounded bg-secondary/80 border border-border p-3 text-xs overflow-x-auto">
                <pre className="text-foreground/80">{`<GameScreen
  nLevel={2}
  modes={['rint']}
  relationshipPool={['BIGGER_THAN', 'BEFORE', 'NORTH_OF']}
  totalRounds={20}
  stimulusDuration={2800}
  streamA={{ key: 'Space', keyDisplay: 'SPACE' }}
  extraStreams={[]}
  noobMode={false}
  onFinish={(finalState) => console.log(finalState)}
  onExit={() => navigate('/')}
/>`}</pre>
              </div>
            </div>
            <div>
              <div className="text-accent font-bold mb-1">2. Drive the loop yourself via gameEngine.js</div>
              <p className="text-muted-foreground mb-2">For custom UIs — call the engine functions directly.</p>
              <div className="rounded bg-secondary/80 border border-border p-3 text-xs overflow-x-auto">
                <pre className="text-foreground/80">{`import { createGameState, generateNextStimulus,
         processResponses, advanceRound } from './lib/gameEngine';

const state = createGameState({ nLevel: 2, modes: ['rint'],
  relationshipPool: [...], totalRounds: 20, extraStreams: [] });

const stimulus = generateNextStimulus(state);
const nextState = advanceRound(state, stimulus);
// ... user responds ...
const scored = processResponses(nextState,
  { pressedA: true, pressedExtra: [] });`}</pre>
              </div>
            </div>
            <div>
              <div className="text-accent font-bold mb-1">3. Use gameConstants.js to populate your own UI</div>
              <p className="text-muted-foreground mb-2">Access all relationship data and filtering utilities.</p>
              <div className="rounded bg-secondary/80 border border-border p-3 text-xs overflow-x-auto">
                <pre className="text-foreground/80">{`import { RELATIONSHIP_CATEGORIES,
         filterTransitiveRelationships } from './lib/gameConstants';

// All relationships grouped by category
console.log(RELATIONSHIP_CATEGORIES.VERBAL);
// ['BIGGER_THAN', 'BEFORE', 'CAUSES', ...]

// Filter to only transitive ones (for RINT mode)
const pool = filterTransitiveRelationships(
  RELATIONSHIP_CATEGORIES.VERBAL,
  true,  // isRINTMode
  false  // isTypeMode
);`}</pre>
              </div>
            </div>
          </div>
        </Section>

        {/* Back */}
        <div className="flex justify-center pb-4">
          <Link to="/">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
              <ChevronLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>

      </div>
    </motion.div>
  );
}
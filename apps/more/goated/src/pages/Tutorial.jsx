import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, Brain, Zap, Layers, Gamepad2,
  GitBranch, Eye, Volume2, ShieldAlert,
  Sparkles, Menu, X, Play, Settings2, Compass, Award, TrendingUp
} from 'lucide-react';
import { COACH_PHASES } from '@/lib/gameConstants';
import { difficultyOrder } from '@/lib/coachMastery';

const TABS = [
  { id: 'intro',     label: 'Core Basics',     icon: Brain,        desc: 'N-Back introduction, play guide, and controls' },
  { id: 'settings',  label: 'Settings Guide',  icon: Settings2,    desc: 'Parameters, symbols, and custom token styles' },
  { id: 'modes',     label: 'Cognitive Modes', icon: Layers,       desc: 'Deep dive into transitive, nonverbal, and CCT logic' },
  { id: 'trajectory',label: 'Predictive Map',  icon: Compass,      desc: 'Trajectory N-Back full guide (SR · TEM) per tier' },
  { id: 'features',  label: 'Special Tech',    icon: Sparkles,     desc: 'Synaesthesia maps, audiobeats, and stressors' },
  { id: 'autopilot', label: 'Autopilot Prep',  icon: Zap,          desc: 'Scientific 20-level progressive curriculum grid' },
  { id: 'examples',  label: 'Step Walkthroughs',icon: GitBranch,    desc: 'Worked trial examples for complex rules' },
];

export default function Tutorial() {
  const [activeTab, setActiveTab] = React.useState('intro');
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Close mobile menu on tab switch
  const selectTab = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  const activeTabMeta = TABS.find(t => t.id === activeTab) || TABS[0];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="min-h-screen bg-[#090d16] text-foreground font-mono flex flex-col md:flex-row"
    >
      {/* SIDEBAR NAVIGATION (Desktop) / TOP MENU BAR (Mobile) */}
      <div className="w-full md:w-64 md:min-h-screen bg-[#0d1527] border-b md:border-b-0 md:border-r border-border/80 flex flex-col shrink-0 z-20">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-border/40">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-bold text-xs uppercase tracking-widest text-foreground">Academy</span>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex flex-col flex-1 p-3 space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2.5 font-medium
                  ${active 
                    ? 'bg-primary/15 text-primary border border-primary/30 font-semibold shadow-[0_0_12px_rgba(34,211,238,0.1)]' 
                    : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground border border-transparent'}`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-muted-foreground/80'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
          
          <div className="pt-4 mt-auto">
            <Link to="/" className="block">
              <Button className="w-full bg-[#1e293b] hover:bg-[#334155] border border-border text-foreground text-xs gap-1.5 h-9">
                <ChevronLeft className="w-4 h-4" /> Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-b border-border/60 bg-[#0d1527] overflow-hidden flex flex-col p-3 space-y-1"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => selectTab(tab.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2.5
                      ${active 
                        ? 'bg-primary/20 text-primary border border-primary/30 font-bold' 
                        : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground border border-transparent'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              <div className="pt-2 border-t border-border/40 mt-1">
                <Link to="/" className="block">
                  <Button className="w-full bg-secondary text-foreground text-xs gap-1.5 h-9">
                    <ChevronLeft className="w-4 h-4" /> Dashboard
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* MAIN CONTENT DISPLAY AREA */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 flex flex-col max-w-4xl mx-auto w-full">
        {/* Header Breadcrumb */}
        <div className="mb-6 pb-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary/80">
              <Brain className="w-3.5 h-3.5" />
              <span>Training Academy</span>
              <span>&middot;</span>
              <span className="text-muted-foreground">{activeTabMeta.label}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground mt-1 uppercase tracking-wider">{activeTabMeta.label}</h1>
          </div>
          <Link to="/" className="self-start sm:self-auto hidden md:block">
            <Button className="bg-[#22d3ee]/10 hover:bg-[#22d3ee]/20 text-[#22d3ee] border border-[#22d3ee]/40 text-xs font-semibold px-4 py-1.5 h-8">
              Launch Game
            </Button>
          </Link>
        </div>

        {/* Tab Subpage Content Switcher */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              {/* CORE BASICS TAB */}
              {activeTab === 'intro' && (
                <div className="space-y-6">
                  {/* Quick Start Card */}
                  <div className="rounded-xl bg-primary/10 border border-primary/20 p-5 sm:p-6 shadow-inner">
                    <h2 className="text-sm font-semibold text-primary uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
                      <Play className="w-4 h-4 fill-primary text-primary" /> Training Loop Quickstart
                    </h2>
                    <ol className="space-y-2.5 text-xs sm:text-sm font-mono text-foreground/90">
                      <li className="flex gap-2"><span className="text-primary font-bold">1.</span> <span>Choose your target <strong>N-Level</strong> (memory depth).</span></li>
                      <li className="flex gap-2"><span className="text-primary font-bold">2.</span> <span>Pick visual and acoustic categories (Spatial, Quantitative, Complex, Verbal, Sound).</span></li>
                      <li className="flex gap-2"><span className="text-primary font-bold">3.</span> <span>Bind <strong>Streams</strong> and customize response buttons (REL, POS, or CCT math).</span></li>
                      <li className="flex gap-2"><span className="text-primary font-bold">4.</span> <span>A stimulus appears. If its current property matches the one from <strong>N steps ago</strong>, trigger the key immediately.</span></li>
                      <li className="flex gap-2"><span className="text-primary font-bold">5.</span> <span>Analyze immediate trial feedback verdicts (HIT, MISS, LURE FA) to adapt.</span></li>
                    </ol>
                  </div>

                  {/* Core Concepts */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg bg-secondary/20 border border-border/80 p-5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4.5 h-4.5 text-emerald-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">What is N-Back?</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                        A scientifically verified memory-updating test. You track a moving chain of relations. A match occurs when the current relationship matches the relationship that was shown exactly <strong>N trials ago</strong>.
                      </p>
                    </div>

                    <div className="rounded-lg bg-secondary/20 border border-border/80 p-5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="w-4.5 h-4.5 text-cyan-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">How to Play</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                        Train focal attention. As each box updates, compare it to the one at N-distance back. Trigger matching keys rapidly before the next card rotates into the frame.
                      </p>
                    </div>

                    <div className="rounded-lg bg-secondary/20 border border-border/80 p-5 space-y-2 sm:col-span-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4.5 h-4.5 text-amber-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Independent Scored Axes</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                        If multi-task layers are enabled, a single stimulus can trigger multiple match types simultaneously (e.g., both a relationship match and an alien cell position match). Press all matching keys on the keyboard — each axis compiles its score completely independently!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SETTINGS GUIDE TAB */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-secondary/20 border border-border/80 p-5 space-y-4">
                    <h2 className="text-xs font-bold text-foreground uppercase tracking-widest border-b border-border/40 pb-2">Primary Controls</h2>
                    
                    <div className="space-y-3.5 text-xs leading-relaxed">
                      <div>
                        <strong className="text-primary block font-mono">N-Level (Memory Depth):</strong>
                        <span>How many steps back to retain. N=1 is immediate; N=3 represents a steep working memory challenge.</span>
                      </div>
                      <div>
                        <strong className="text-primary block font-mono">Relationship Types:</strong>
                        <span>Enable spatial relative matrices, 3D orbits, character traits, scans for quantitative ratios, sound frequencies, or verbal concepts.</span>
                      </div>
                      <div>
                        <strong className="text-primary block font-mono">Custom Stimuli Weighting Mix:</strong>
                        <span>Sliders on the main panel let you configure the percentage frequency of each category (e.g. training 80% Spatial 3D and 20% Sound).</span>
                      </div>
                      <div>
                        <strong className="text-primary block font-mono">Interactive Multi-Streams:</strong>
                        <span>Add up to 20 separate simultaneous sequences, assigning customizable keybind trigger buttons for each feed.</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-secondary/20 border border-border/80 p-5 space-y-4">
                    <h2 className="text-xs font-bold text-foreground uppercase tracking-widest border-b border-border/40 pb-2">Visual &amp; Representation Settings</h2>
                    
                    <div className="space-y-3.5 text-xs leading-relaxed">
                      <div>
                        <strong className="text-emerald-400 block font-mono">Relation Symbol Randomization:</strong>
                        <span>Stimuli toggle per-trial between <strong>normal</strong> written descriptions (e.g. "occurs before", "is heavier than") and <strong>minimal</strong> mathematical/directional symbols (e.g. "t &lt;", "▲"). Randomization blocks visual rote-verbalization and forces abstract cognitive parsing!</span>
                      </div>
                      <div>
                        <strong className="text-cyan-400 block font-mono">Junk-Journal / Scrap Collages:</strong>
                        <span>A custom procedurally-drawn token style modeling hand-torn physical scrap collage clippings (junk journaling), complete with jagged edges, exposures, shadow drops, and carbon outlines for maximum high-contrast character reading. Each scrap token carries a unique serialized code starting with <strong>S:</strong> (e.g. <span className="text-cyan-300 font-bold">S:13231</span>) which acts as a seed for the canvas rendering generator to draw the identical collage clipping every time that trial is shown again.</span>
                      </div>
                      <div>
                        <strong className="text-amber-400 block font-mono">Automated Carousel:</strong>
                        <span>Timely slides multiple active feeds when viewport bounds are packed. Carousel speed dictates slide transitions separately.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* COGNITIVE MODES TAB */}
              {activeTab === 'modes' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-secondary/20 border border-border/80 p-5 space-y-4">
                    <h2 className="text-xs font-bold text-foreground uppercase tracking-widest border-b border-border/40 pb-2">Enhancement Modes Breakdown</h2>
                    
                    <div className="space-y-4 text-xs leading-relaxed">
                      <div>
                        <strong className="text-accent block font-mono uppercase tracking-wider">Type N-Back</strong>
                        <span>Match matches by relationship <strong>category</strong> instead of exact string (e.g., matching any "inside" relation to any prior "inside" relation). Constrained to transitive rules to maintain logic. Challenges semantic storage.</span>
                      </div>
                      <div>
                        <strong className="text-accent block font-mono uppercase tracking-wider">RINT (Relational Integration)</strong>
                        <span>Chains facts logically using transitive deductions across the last N trials. Both <em>directions</em> within a relation family can appear in the same chain — e.g. Trial 1: "A &gt; B", Trial 2: "C &lt; B", target = "A &gt; C" (player must mentally invert C&lt;B into B&gt;C to chain). Conclusions render in either direction (A&gt;C or C&lt;A) interchangeably. Forces directional binding plus inference mapping. Requires N&ge;2.</span>
                      </div>
                      <div>
                        <strong className="text-accent block font-mono uppercase tracking-wider">Nonverbal RINT</strong>
                        <span>Stimuli carry up to <strong>14 independent binary attributes</strong> across two modalities — Visual: touching, hollow, size-mismatch, rotated, dashed, glow, mirrored, striped (8); Audio: tone, high-pitch, loud, long, rhythmic, warm (6). Each audio flag fires at its own time slot so multiple cues per trial layer without colliding. A match fires when the current composite satisfies the active <strong>match rule</strong> over a subset of the last N trials. Default is <strong>union</strong> (current = ∪ of some non-empty subset; e.g. T1 = {`{TOUCH, GLOW}`}, T2 = {`{HOLLOW}`} → current = {`{TOUCH, HOLLOW, GLOW}`} is a target since T1∪T2 = current). Four more rules can be selected in the Nonverbal RINT settings panel (Grapist request): <strong>intersection</strong> (current = ∩ of a non-empty subset — current must be a subset of every chosen stim), <strong>XOR</strong> (current = symmetric difference; a flag is ON in current iff it appears in an odd number of subset members — parity), <strong>implication</strong> (∃ a non-empty stim in the last N whose flags are a subset of current, i.e. that stim logically implies current), and <strong>biconditional</strong> / equivalence (current = the flags where ALL members of some subset of size ≥ 2 agree — the consensus / agreement set; for two stims this is exactly A ↔ B). <strong>Multi-rule mode</strong> (later Grapist follow-up): enable any combination of rules with per-rule weights — each trial independently samples one rule by weight, so a 3·1·1 weighting of Union·XOR·Implication shows Union ~60% of trials, XOR ~20%, Implication ~20%. Individual flags + the per-trial cap stay configurable across all rules.</span>
                      </div>
                      <div>
                        <strong className="text-accent block font-mono uppercase tracking-wider">CCT (Cognitive Control arithmetic)</strong>
                        <span>Pure arithmetic n-back. From trial N onwards, a candidate result appears. Press REL if <strong>result == current_digit + N-back_digit</strong>. Pure mathematical working memory updating.</span>
                      </div>
                      <div>
                        <strong className="text-accent block font-mono uppercase tracking-wider">Binary Logic</strong>
                        <span>Combines dual conditions per trial using boolean algebra gates (AND, OR, XOR, AND_NOT). Relational encoding requires both to resolve to true.</span>
                      </div>
                      <div>
                        <strong className="text-primary block font-mono uppercase tracking-wider">Wrapper Morphing Mode</strong>
                        <span>A premium visual and logical set-shifting distractor. Mid-session, the interface dynamically morphs both visually (shifting between Cyberpunk, Stark, Glassmorphic Frost, Sunset, and Matrix themes) and logically (rotating the active relationship categories either trial-by-trial or in blocks of 5). Tests rapid mental flexibility!</span>
                      </div>
                      <div>
                        <strong className="text-fuchsia-400 block font-mono uppercase tracking-wider">Cross-Modal Token Blending</strong>
                        <span>Blends verbal text, alphanumeric characters, and graphic emojis directly inside other relationship grids (like Spatial matrices, Orbiting 3D shapes, or Trait pairings). Blocks superficial shortcuts and overloads the episodic buffer.</span>
                      </div>
                      <div>
                        <strong className="text-amber-300 block font-mono uppercase tracking-wider">Decoy Filter (selective attention)</strong>
                        <span>
                          Enable <strong className="text-amber-300">Decoy Filter</strong> and certain relation <strong>categories</strong> become decoys you must <em>ignore in real time</em> — within a single stream, mixed trials of all your selected types. When a decoy-category stimulus appears you must <strong>withhold</strong>, even if it would otherwise match its N-back. This trains <strong>selective attention / distractor inhibition</strong>: filtering an irrelevant category under working-memory load (Engle's controlled-attention construct — high-WM individuals filter distractors best).
                          <br/><br/>
                          <strong className="text-amber-200">Picking decoys:</strong> categories are drawn <em>only</em> from the relation types you've selected, and at least one always stays relevant (you need something to respond to). Choose <em>Random / stream</em> (each stream independently picks 1+ decoy categories per session — you're shown which, e.g. an "Ignore: Sound · Trait" chip on the stream) or <em>Manual</em> to pick them yourself.
                          <br/><br/>
                          <strong className="text-amber-200">Two rules:</strong> <em>Never target</em> — decoy trials stay in the N-back sequence but can never be a match; pressing one is a false alarm. <em>Removed from chain</em> — decoy trials are pure noise that don't advance the count, so "N back" means N <em>relevant</em> trials ago (you mentally skip the decoys — harder).
                          <br/><br/>
                          <strong className="text-amber-200">Not the same as Distractors mode:</strong> the <em>Distractors</em> enhancement injects near-miss <em>lures</em> you still respond to. The <em>Decoy Filter</em> makes whole relation categories irrelevant — you suppress responses to them entirely. Coach <strong>Phase 33: Selective Attention Filter</strong> is a ready-made version.
                        </span>
                      </div>
                      <div>
                        <strong className="text-violet-300 block font-mono uppercase tracking-wider">RST Side-Task (Reasoning) · Easy / Medium / Hard / Extreme</strong>
                        <span>Layered on stream A like CCT, but trains deductive inference. One premise per trial; from trial N onwards a candidate conclusion is also shown. Press R if logically valid. Difficulty locks the family: <strong>Easy</strong> = Distinction (same/opposite XOR), <strong>Medium</strong> = Comparison (transitive order), <strong>Hard</strong> = Analogy (4-place structural mapping). <strong className="text-rose-300">Extreme</strong> = Meta-Relation: each conclusion is a BOOLEAN combination (∧, ∨, ∧¬, ↔) of TWO analogy claims spanning 5+ entities — pushes past Halford's 4-place rung into meta-knowledge territory. Hard + Extreme auto-extend SOA by 60%. Generators inspired by <a href="https://github.com/4skinskywalker/Syllogimous-v3" target="_blank" rel="noreferrer" className="underline">Syllogimous v3</a> (CC BY-NC 3.0). Requires N&ge;2.</span>
                      </div>
                      <div>
                        <strong className="text-cyan-300 block font-mono uppercase tracking-wider">Coach Autopilot · Mastery-Scaled Spaced Repetition</strong>
                        <span>The Coach no longer marches linearly through phases. Each phase has its own <strong>mastery level (0–5)</strong> tracked across attempts. A success (≥75%) bumps the level; a failure (&lt;55%) drops it. Higher mastery = longer wait until that phase resurfaces (Leitner intervals: 1 / 2 / 5 / 11 / 25 / 60 sessions). When a mastered phase is due for review, the Coach has a 40% chance to pick it instead of the frontier — keeping earlier skills warm rather than letting them rot. Click <em>Coach Autopilot</em> and the card header tells you the pick reason (FRONTIER / REVIEW / ADVANCE / MAINTAIN). Per-phase mastery levels also surface in the Stats Coach tab with color coding.</span>
                      </div>
                      <div>
                        <strong className="text-amber-300 block font-mono uppercase tracking-wider">Insight Mode (separate page · no WM load)</strong>
                        <span>Pure relational inference, isolated from n-back. <strong>Four puzzle types</strong> rotated randomly to avoid surface overfitting to one test format:
                          <br/>• <em>Odd-One-Out</em>: 3–6 panels, all but one share a form class. Layout varies (grid / linear / scatter) each puzzle.
                          <br/>• <em>Reverse Sort</em>: form-class label given, pick all matching panels from a pool. Inverts inference direction.
                          <br/>• <em>Analogy Completion</em>: 3 shown share a form, pick the candidate that belongs.
                          <br/>• <em>Verbal Analogy</em>: text-only ("α inside β :: γ ? δ" with 4 candidates) — cross-modality construct test.
                          <br/>No timer. All panels visible. Trains the relational <strong>inference operation itself</strong>. Access via the <Link to="/insight" className="underline text-amber-400">Insight</Link> nav button. Designed to have <em>distant similarity</em> to matrix tests — same construct, varied surface — to avoid test-format overfitting.</span>
                      </div>
                      <div>
                        <strong className="text-violet-300 block font-mono uppercase tracking-wider">Analogy N-Back (4-place visual)</strong>
                        <span>A target fires when the current relation shares structural <strong>form class</strong> with the N-back relation, even if the relation tokens differ (e.g. ABOVE_BELOW ≈ BIGGER_THAN ≈ STACKED — all "directional asymmetric"). Same-token repeats are NOT matches — you must abstract the form. This is the Halford 4-place rung in visual form: the cognitive operation that Raven's Progressive Matrices specifically measures at the high-difficulty end. Requires N&ge;2.</span>
                      </div>
                      <div>
                        <strong className="text-indigo-300 block font-mono uppercase tracking-wider">Trajectory N-Back — Predictive Map (SR) + Schema Transfer (TEM)</strong>
                        <span>
                          <strong>First mode in the app that trains the hippocampus instead of DLPFC.</strong> Every session pre-generates a small graph (ring · ring+shortcuts · tree · lattice · random); you play as a random walker visiting one node per trial. For the first six trials the edges are visible so you can encode the topology. After that, edges <strong>fade out</strong> — you must recall the structure from memory. Without map fading the task would be visual edge-checking, not Successor Representation learning.<br/>
                          <br/>
                          <strong className="text-indigo-200">Four tiers, increasing abstraction:</strong>
                          <br/>• <em>Easy</em> — current node IS the N-back node (pure WM on positions).
                          <br/>• <em>Medium</em> — current is a direct <em>neighbour</em> of the N-back node. Requires edge memory.
                          <br/>• <em>Hard</em> — current is reachable in EXACTLY K steps from the N-back node (predictive map / SR core, Stachenfeld 2017).
                          <br/>• <em>Extreme</em> — current node lies on the shortest path from N-back to a per-trial goal (★). Zero-shot revaluation / pathfinding.
                          <br/>
                          <br/>
                          <strong className="text-indigo-200">Schema Transfer (TEM toggle)</strong> activates Behrens et al. 2020 mode: the session contains 2–4 graphs sharing the same topology <em>family</em> but with fresh node identities and themes ("Map α", "Map β", …). The player must encode the <em>abstract schema</em> ("this is always a ring with 1 shortcut") rather than memorize one specific map — tested by re-applying it instantly when the surface swaps mid-session. Cross-block matches are never targets, so the first N trials of each new block are non-scoring.<br/>
                          <br/>
                          <strong>Why this matters more than n-back capacity:</strong> Place cells in the hippocampus and grid cells in entorhinal cortex aren't location detectors — they're the <em>eigenstructure of a Successor Representation</em>. By directly training the map-building system, we target a brain network none of the other modes touch (DLPFC-heavy modes train PFC; this trains medial temporal lobe). Theoretically closer to fluid intelligence than working memory because Raven's matrices are essentially "predict the next element in an abstract relational topology" — the SR operation, applied to non-spatial structure. Untested in human RCTs for IQ transfer; the app is the experiment.<br/>
                          <br/>
                          References: Stachenfeld, Botvinick &amp; Gershman 2017 (<em>Nature Neuroscience</em>); Behrens et al. 2020 (<em>Cell</em>); Park, Miller, Boorman &amp; Behrens 2020 (<em>Neuron</em> — same machinery for social hierarchies). Requires N&ge;2.
                        </span>
                      </div>
                    </div>

                    {/* Trajectory N-Back · Worked Example */}
                    <div className="mt-6 pt-4 border-t border-indigo-500/30 bg-indigo-500/5 rounded-lg p-4 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300 flex items-center gap-2">
                        <Compass className="w-3.5 h-3.5" /> Trajectory N-Back · Worked Example (N=2, Hard tier, K=2)
                      </h3>
                      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                        Pretend the session built a 6-node ring graph A–B–C–D–E–F with one extra shortcut A↔C. So adjacency:
                        <br/><strong className="text-indigo-300">A: B, F, C</strong> · <strong className="text-indigo-300">B: A, C</strong> · <strong className="text-indigo-300">C: B, D, A</strong> · <strong className="text-indigo-300">D: C, E</strong> · <strong className="text-indigo-300">E: D, F</strong> · <strong className="text-indigo-300">F: E, A</strong>
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-indigo-500/30 bg-background/40">
                        <table className="w-full text-[10px] sm:text-[11px] font-mono">
                          <thead>
                            <tr className="border-b border-indigo-500/30 bg-secondary/40">
                              <th className="text-left p-2 text-indigo-300 uppercase tracking-wider font-bold">Trial</th>
                              <th className="text-left p-2 text-indigo-300 uppercase tracking-wider font-bold">Visit</th>
                              <th className="text-left p-2 text-indigo-300 uppercase tracking-wider font-bold">N-back (t-2)</th>
                              <th className="text-left p-2 text-indigo-300 uppercase tracking-wider font-bold">K=2 reach from N-back</th>
                              <th className="text-left p-2 text-indigo-300 uppercase tracking-wider font-bold">Verdict</th>
                            </tr>
                          </thead>
                          <tbody className="text-foreground/85">
                            <tr className="border-b border-indigo-500/20"><td className="p-2">1</td><td className="p-2">A</td><td className="p-2 text-muted-foreground/60">—</td><td className="p-2 text-muted-foreground/60">—</td><td className="p-2 text-muted-foreground">no target yet (need 2 trials of history)</td></tr>
                            <tr className="border-b border-indigo-500/20"><td className="p-2">2</td><td className="p-2">C</td><td className="p-2 text-muted-foreground/60">—</td><td className="p-2 text-muted-foreground/60">—</td><td className="p-2 text-muted-foreground">no target yet</td></tr>
                            <tr className="border-b border-indigo-500/20"><td className="p-2">3</td><td className="p-2">B</td><td className="p-2">A</td><td className="p-2">{'{A, B, F, C}'}</td><td className="p-2 text-emerald-300 font-semibold">✓ TARGET (B ∈ K=2 reach of A)</td></tr>
                            <tr className="border-b border-indigo-500/20"><td className="p-2">4</td><td className="p-2">A</td><td className="p-2">C</td><td className="p-2">{'{A, B, C, D}'}</td><td className="p-2 text-emerald-300 font-semibold">✓ TARGET (A ∈ K=2 reach of C)</td></tr>
                            <tr className="border-b border-indigo-500/20"><td className="p-2">5</td><td className="p-2">F</td><td className="p-2">B</td><td className="p-2">{'{A, B, C, F}'}</td><td className="p-2 text-emerald-300 font-semibold">✓ TARGET (F ∈ K=2 reach of B via A)</td></tr>
                            <tr><td className="p-2">6</td><td className="p-2">E</td><td className="p-2">A</td><td className="p-2">{'{A, B, F, C}'}</td><td className="p-2 text-rose-300 font-semibold">✗ NOT a target (E unreachable in 2 from A)</td></tr>
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                        <strong className="text-indigo-200">What this tests:</strong> by trial 6, the edges are still visible (we're inside the learning phase). From trial 7+ they fade. You then have to remember that A↔C is a shortcut to reason about K=2 reachability without seeing the lines.
                        <br/>
                        <strong className="text-indigo-200">Schema Transfer twist:</strong> in TEM mode, at trial ~10 the graph swaps to a fresh ring-plus-shortcuts (different node positions, different theme color) — same family. The first N=2 trials in the new block are non-scoring (cross-block N-back). From trial 12+ the same K=2 reasoning applies: a player who encoded the schema ("ring + 1 chord") rather than the specific map can perform without re-learning.
                      </p>
                    </div>

                    {/* Analogy Form Class Table — the exact rule of the mode */}
                    <div className="mt-6 pt-4 border-t border-border/40">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-violet-300 mb-2 flex items-center gap-2">
                        <GitBranch className="w-3.5 h-3.5" /> Analogy Mode · Form Class Reference
                      </h3>
                      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed mb-3">
                        Match rule: two relations are <strong>analogous</strong> iff they share a form class AND are different tokens. Same-token (e.g. INSIDE → INSIDE) is treated as <strong>not a match</strong> — that would be plain 1-place identity, not 4-place structural mapping. Different form class is also not a match.
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/40">
                        <table className="w-full text-[10px] sm:text-[11px] font-mono">
                          <thead>
                            <tr className="border-b border-border/60 bg-secondary/40">
                              <th className="text-left p-2 text-violet-300 uppercase tracking-wider font-bold">Form Class</th>
                              <th className="text-left p-2 text-violet-300 uppercase tracking-wider font-bold">Sample Members</th>
                              <th className="text-left p-2 text-violet-300 uppercase tracking-wider font-bold">Cognitive Pattern</th>
                            </tr>
                          </thead>
                          <tbody className="text-foreground/85">
                            <tr className="border-b border-border/30">
                              <td className="p-2 text-cyan-300 font-semibold align-top">directional-asymmetric</td>
                              <td className="p-2 align-top">ABOVE_BELOW · STACKED · BIGGER_THAN · MORE_THAN · BEFORE · IN_FRONT_OF · FLOATING_ABOVE · LEFT_RIGHT · DIAGONAL · all transitive verbal comparisons</td>
                              <td className="p-2 text-muted-foreground/80 align-top">One element dominates the other on an axis (vertical, depth, size, weight, time, etc.)</td>
                            </tr>
                            <tr className="border-b border-border/30">
                              <td className="p-2 text-cyan-300 font-semibold align-top">containment</td>
                              <td className="p-2 align-top">INSIDE · SURROUNDED · NESTED_3 · NESTED_VOLUME · INSIDE_OF · CONTAINS · PART_OF · BELONGS_TO</td>
                              <td className="p-2 text-muted-foreground/80 align-top">One element wholly inside or part of another</td>
                            </tr>
                            <tr className="border-b border-border/30">
                              <td className="p-2 text-cyan-300 font-semibold align-top">symmetric-contact</td>
                              <td className="p-2 align-top">TOUCHING · OVERLAPPING · CONNECTED · COLLIDING · INTERSECTING_PLANES · NEXT_TO · BOUND_BY_GRAVITY</td>
                              <td className="p-2 text-muted-foreground/80 align-top">Elements are close / touching / joined — no dominance</td>
                            </tr>
                            <tr className="border-b border-border/30">
                              <td className="p-2 text-cyan-300 font-semibold align-top">symmetric-separation</td>
                              <td className="p-2 align-top">REPELLING · SCATTERED · FAR_FROM</td>
                              <td className="p-2 text-muted-foreground/80 align-top">Elements pushed apart / dispersed</td>
                            </tr>
                            <tr className="border-b border-border/30">
                              <td className="p-2 text-cyan-300 font-semibold align-top">identity</td>
                              <td className="p-2 align-top">SAME_COLOR · SAME_SHAPE · ONE_SHARED_TRAIT · SAME_AS · MIRRORED · SHADOW_COPY · EQUAL_COUNT · MATCHES</td>
                              <td className="p-2 text-muted-foreground/80 align-top">Elements share / duplicate a trait</td>
                            </tr>
                            <tr className="border-b border-border/30">
                              <td className="p-2 text-cyan-300 font-semibold align-top">opposition</td>
                              <td className="p-2 align-top">HOLLOW_VS_SOLID · OPPOSITE_COLORS · OPPOSITE_OF · NEGATES</td>
                              <td className="p-2 text-muted-foreground/80 align-top">Elements differ on a binary trait</td>
                            </tr>
                            <tr className="border-b border-border/30">
                              <td className="p-2 text-cyan-300 font-semibold align-top">multiplicity-asymmetric</td>
                              <td className="p-2 align-top">ONE_TO_MANY · TWO_TO_ONE · THREE_TO_ONE · ONE_TO_FIVE · SIZE_MISMATCH · PYRAMID</td>
                              <td className="p-2 text-muted-foreground/80 align-top">Counts differ across sides</td>
                            </tr>
                            <tr className="border-b border-border/30">
                              <td className="p-2 text-cyan-300 font-semibold align-top">ordered-sequence</td>
                              <td className="p-2 align-top">INCREASING_ROW · DECREASING_ROW · SIZE_GRADIENT · ASCENDING_SPIRAL · ORBITING · ROTATING_PAIR</td>
                              <td className="p-2 text-muted-foreground/80 align-top">Monotonic chain of elements</td>
                            </tr>
                            <tr className="border-b border-border/30">
                              <td className="p-2 text-cyan-300 font-semibold align-top">temporal-ordered</td>
                              <td className="p-2 align-top">BEFORE · AFTER · FOLLOWS · PRECEDES · EXCEEDS</td>
                              <td className="p-2 text-muted-foreground/80 align-top">Temporal sequence on a verbal axis</td>
                            </tr>
                            <tr className="border-b border-border/30">
                              <td className="p-2 text-cyan-300 font-semibold align-top">surface-modified</td>
                              <td className="p-2 align-top">BORDER_ONLY · STRIPED · DASHED_OUTLINE · ROTATED</td>
                              <td className="p-2 text-muted-foreground/80 align-top">Shapes carry a surface / texture modifier</td>
                            </tr>
                            <tr className="border-b border-border/30">
                              <td className="p-2 text-cyan-300 font-semibold align-top">complex-pattern</td>
                              <td className="p-2 align-top">THREE_PAIRS_ONE_DIFFERENT · FOUR_PAIRS_GRID · TWO_OF_THREE_HOLLOW · ODD_COLOR_OUT · ODD_SHAPE_OUT</td>
                              <td className="p-2 text-muted-foreground/80 align-top">Odd-one-out / multi-group scan</td>
                            </tr>
                            <tr>
                              <td className="p-2 text-cyan-300 font-semibold align-top">transform-dependency</td>
                              <td className="p-2 align-top">CAUSES · DEFINES · REPLACES · TRANSFORMS_INTO · DEPENDS_ON</td>
                              <td className="p-2 text-muted-foreground/80 align-top">Abstract logical / causal relations</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                        <div className="rounded p-2 bg-emerald-500/10 border border-emerald-500/30">
                          <div className="text-emerald-300 font-bold uppercase tracking-wider text-[9px] mb-0.5">TARGET</div>
                          <div className="text-foreground/85">N-back: <span className="text-primary">INSIDE</span><br/>Current: <span className="text-primary">NESTED_3</span><br/><span className="text-muted-foreground/70">→ both containment, different tokens</span></div>
                        </div>
                        <div className="rounded p-2 bg-rose-500/10 border border-rose-500/30">
                          <div className="text-rose-300 font-bold uppercase tracking-wider text-[9px] mb-0.5">NON-TARGET (cross-class)</div>
                          <div className="text-foreground/85">N-back: <span className="text-primary">INSIDE</span><br/>Current: <span className="text-primary">TOUCHING</span><br/><span className="text-muted-foreground/70">→ containment vs symmetric-contact</span></div>
                        </div>
                        <div className="rounded p-2 bg-rose-500/10 border border-rose-500/30">
                          <div className="text-rose-300 font-bold uppercase tracking-wider text-[9px] mb-0.5">NON-TARGET (same-token)</div>
                          <div className="text-foreground/85">N-back: <span className="text-primary">INSIDE</span><br/>Current: <span className="text-primary">INSIDE</span><br/><span className="text-muted-foreground/70">→ identical token, not 4-place analogy</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TRAJECTORY N-BACK · DEEP DIVE TAB */}
              {activeTab === 'trajectory' && (
                <div className="space-y-6 font-mono text-[12px] sm:text-[13px] leading-relaxed text-muted-foreground">

                  {/* Section 1 — Why this mode exists */}
                  <section className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Compass className="w-5 h-5 text-indigo-400 animate-pulse" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">Why Trajectory N-Back exists</h3>
                    </div>
                    <p>
                      All the other modes in this app train the <strong>prefrontal cortex</strong> — working memory capacity (n-back), relational integration (RINT / RST / Analogy), set-shifting (Wrapper Morph), inhibition (Negation), arithmetic updating (CCT). Powerful, but they all live in the same neural neighbourhood (DLPFC + parietal). Trajectory N-Back targets a <strong>different brain network</strong>: the <span className="text-indigo-300">hippocampus + entorhinal cortex</span>, which builds <em>cognitive maps</em> — graph-structured predictions about what comes after what.
                    </p>
                    <p>
                      Stachenfeld, Botvinick &amp; Gershman (2017, <em>Nature Neuroscience</em>) showed that hippocampal place cells aren't "I am here" detectors — they encode a <strong>Successor Representation</strong>: from each state, the expected discounted occupancy of all future states. The grid cells of the entorhinal cortex are the principal components (eigenvectors) of this SR matrix. Behrens et al. (2020, <em>Cell</em>) generalized this to abstract relational schemas (Tolman-Eichenbaum Machine — TEM): the same machinery that maps physical space also maps social hierarchies, conceptual networks, family trees.
                    </p>
                    <p>
                      <strong className="text-indigo-200">What you train here:</strong> the ability to walk through a graph, internalize its structure from experience, and predict where you'll be next. After a short learning window, the edges fade — you must navigate from memory. Tiers add layers: first identity, then neighbours, then K-step prediction, then shortest-path revaluation. Schema Transfer (TEM mode) pushes further: multiple graphs with the same topology but fresh surfaces, testing whether you've grasped the underlying schema.
                    </p>
                  </section>

                  {/* Section 2 — Anatomy of the Board */}
                  <section className="rounded-lg bg-secondary/20 border border-border p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <Eye className="w-4 h-4 text-indigo-400" /> Anatomy of the board
                    </h3>
                    <p>Every TJN trial draws the same graph on a dark canvas with these visual elements:</p>
                    <ul className="list-disc list-inside pl-1 space-y-1.5">
                      <li><strong className="text-indigo-200">Nodes (A, B, C…)</strong> — circles with letter labels (the graph's vertices). Position never changes within a block.</li>
                      <li><strong className="text-indigo-200">Edges</strong> — lines between nodes; the topology. Visible during the learning phase, faded afterwards.</li>
                      <li><strong className="text-indigo-200">Current node</strong> — large highlighted circle with a coloured ring + <span className="text-indigo-300">▼ YOU</span> arrow above. This is the only thing that changes per trial.</li>
                      <li><strong className="text-indigo-200">Tier badge (top-right)</strong> — e.g. <span className="text-amber-300">TJN · HARD · K=2</span>. Tells you the active target rule.</li>
                      <li><strong className="text-indigo-200">Phase indicator</strong> — green <em>"MAP LEARNING — edges visible"</em> for the first 6 trials, magenta <em>"MAP FADED — recall topology from memory"</em> after.</li>
                      <li><strong className="text-indigo-200">Goal star ★</strong> — only in Extreme tier; yellow star floats above the goal node.</li>
                      <li><strong className="text-indigo-200">Bottom hint strip</strong> — one-line restatement of the target rule for the active tier.</li>
                      <li><strong className="text-indigo-200">Block badge (top-left, TEM only)</strong> — e.g. <span className="text-cyan-300">Map α</span> / <span className="text-emerald-300">Map β</span> / <span className="text-violet-300">Map γ</span>. Each block has a distinct colour theme.</li>
                    </ul>
                    <p>
                      <strong className="text-indigo-200">HUD additions:</strong> the top-bar shows <strong>T<em>n</em></strong> alongside H / M / FA — that's <em>total targets fired this session</em> (hits + misses). Use it to verify targets are actually appearing; if T stays at 0 past trial 5, you may be on a sparse configuration (e.g. Extreme on a tiny graph). The indigo <strong>TJN</strong> badge confirms the mode is active.
                    </p>
                  </section>

                  {/* Section 3 — Map Fading */}
                  <section className="rounded-lg bg-secondary/20 border border-border p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" /> The Map Fading mechanic
                    </h3>
                    <p>
                      For the first <strong className="text-indigo-200">6 trials</strong> of each block, the graph's edges are drawn solid (~55% opacity). This is the <strong>learning phase</strong> — your job is to memorize the topology while doing easy walks.
                    </p>
                    <p>
                      From trial 7 onwards, the edges fade to ~7% opacity (barely visible — basically gone). You must now reason about adjacency / K-step reach / shortest paths <strong>from memory</strong> of the topology you encoded during learning.
                    </p>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 text-[12px]">
                      <strong className="text-amber-300">Why this matters:</strong> Without map-fading, the task would degrade into pure visual edge-checking. You'd be reading the edges off the screen, not <em>thinking</em> about the structure. That's NOT Successor Representation training — it's a visual pattern-matching task. The fading window forces real hippocampal encoding: you actually have to <em>remember</em> the graph.
                    </div>
                    <p>
                      <strong>In TEM mode:</strong> the 6-trial learning window <em>resets each block</em>. Every time the surface swaps to a new graph instance (Map α → Map β → Map γ), you get a fresh learning phase. But — and this is the whole point — if you've actually grasped the <em>schema</em> ("this is always a 6-cycle with one shortcut"), you don't really need the learning phase. You should be able to predict structure on Map β within 2-3 trials.
                    </p>
                  </section>

                  {/* Section 4 — Tier 1: Easy */}
                  <section className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                      <Award className="w-4 h-4" /> Tier 1 — Easy · Identity Matching
                    </h3>
                    <p className="text-[13px]">
                      <strong className="text-emerald-200">Rule:</strong> Press the response key if the <em>current node</em> is <em>exactly</em> the same node as the one you were on <strong>N trials ago</strong>.
                    </p>
                    <p>
                      This is essentially classic spatial n-back but on a labeled graph. You don't need to use the graph topology at all — you just have to remember "what letter was I on N trials ago?". Equivalent to remembering position in 6 numbered slots. It's a warm-up for the medium / hard tiers but still tests <em>positional working memory</em> on a graph substrate.
                    </p>
                    <div className="overflow-x-auto rounded border border-emerald-500/30 bg-background/40">
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-secondary/40 border-b border-emerald-500/30">
                          <th className="text-left p-2 text-emerald-300">Trial</th>
                          <th className="text-left p-2 text-emerald-300">Current</th>
                          <th className="text-left p-2 text-emerald-300">N=2 back</th>
                          <th className="text-left p-2 text-emerald-300">Same?</th>
                          <th className="text-left p-2 text-emerald-300">Action</th>
                        </tr></thead>
                        <tbody className="text-foreground/85">
                          <tr className="border-b border-emerald-500/20"><td className="p-2">1</td><td className="p-2">A</td><td className="p-2 text-muted-foreground/60">—</td><td className="p-2 text-muted-foreground/60">—</td><td className="p-2 text-muted-foreground">(no history, no press)</td></tr>
                          <tr className="border-b border-emerald-500/20"><td className="p-2">2</td><td className="p-2">D</td><td className="p-2 text-muted-foreground/60">—</td><td className="p-2 text-muted-foreground/60">—</td><td className="p-2 text-muted-foreground">(no history, no press)</td></tr>
                          <tr className="border-b border-emerald-500/20"><td className="p-2">3</td><td className="p-2">A</td><td className="p-2">A</td><td className="p-2 text-emerald-300">✓ yes</td><td className="p-2 text-emerald-300 font-semibold">PRESS</td></tr>
                          <tr className="border-b border-emerald-500/20"><td className="p-2">4</td><td className="p-2">B</td><td className="p-2">D</td><td className="p-2 text-rose-300">✗ no</td><td className="p-2 text-rose-300">don't press</td></tr>
                          <tr className="border-b border-emerald-500/20"><td className="p-2">5</td><td className="p-2">A</td><td className="p-2">A</td><td className="p-2 text-emerald-300">✓ yes</td><td className="p-2 text-emerald-300 font-semibold">PRESS</td></tr>
                          <tr><td className="p-2">6</td><td className="p-2">C</td><td className="p-2">B</td><td className="p-2 text-rose-300">✗ no</td><td className="p-2 text-rose-300">don't press</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <p><strong className="text-emerald-200">Strategy:</strong> Treat node labels as if they were any other n-back stimulus. The graph edges are a <em>distraction</em> at this tier — you can ignore them entirely. Focus only on the letter-level identity match.</p>
                    <p><strong className="text-emerald-200">Common mistake:</strong> Trying to overthink and use the graph topology when it's not needed. If the question is "is current = N-back?", neighbours and successors are irrelevant.</p>
                  </section>

                  {/* Section 5 — Tier 2: Medium */}
                  <section className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                      <Award className="w-4 h-4" /> Tier 2 — Medium · Neighbour Recall
                    </h3>
                    <p className="text-[13px]">
                      <strong className="text-cyan-200">Rule:</strong> Press if the <em>current node</em> is a <strong>direct neighbour</strong> of the node you were on N trials ago — i.e. there exists an edge between them in the graph.
                    </p>
                    <p>
                      Now the topology matters. You have to recall <em>which nodes are connected to which</em> AND the N-back position. After map-fading, you can't read the edges off the screen any more — you actually need to have memorized the adjacency structure.
                    </p>
                    <p><strong className="text-cyan-200">Example</strong> on a small-world graph (ring A-B-C-D-E-F-A with extra shortcut A↔C):</p>
                    <p className="text-[11px] text-muted-foreground/80">Adjacency: A→{'{'}B, F, C{'}'}  ·  B→{'{'}A, C{'}'}  ·  C→{'{'}B, D, A{'}'}  ·  D→{'{'}C, E{'}'}  ·  E→{'{'}D, F{'}'}  ·  F→{'{'}E, A{'}'}</p>
                    <div className="overflow-x-auto rounded border border-cyan-500/30 bg-background/40">
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-secondary/40 border-b border-cyan-500/30">
                          <th className="text-left p-2 text-cyan-300">Trial</th>
                          <th className="text-left p-2 text-cyan-300">Current</th>
                          <th className="text-left p-2 text-cyan-300">N=2 back</th>
                          <th className="text-left p-2 text-cyan-300">Neighbours of N-back</th>
                          <th className="text-left p-2 text-cyan-300">Verdict</th>
                        </tr></thead>
                        <tbody className="text-foreground/85">
                          <tr className="border-b border-cyan-500/20"><td className="p-2">3</td><td className="p-2">B</td><td className="p-2">A</td><td className="p-2">{'{B, F, C}'}</td><td className="p-2 text-emerald-300 font-semibold">✓ PRESS (B is in set)</td></tr>
                          <tr className="border-b border-cyan-500/20"><td className="p-2">4</td><td className="p-2">D</td><td className="p-2">C</td><td className="p-2">{'{B, D, A}'}</td><td className="p-2 text-emerald-300 font-semibold">✓ PRESS</td></tr>
                          <tr className="border-b border-cyan-500/20"><td className="p-2">5</td><td className="p-2">A</td><td className="p-2">B</td><td className="p-2">{'{A, C}'}</td><td className="p-2 text-emerald-300 font-semibold">✓ PRESS</td></tr>
                          <tr><td className="p-2">6</td><td className="p-2">E</td><td className="p-2">D</td><td className="p-2">{'{C, E}'}</td><td className="p-2 text-emerald-300 font-semibold">✓ PRESS</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <p><strong className="text-cyan-200">Strategy:</strong> During the learning phase, do <em>active rehearsal</em> of edges — every time the current node changes, mentally trace which other nodes it touches. By trial 6, you should be able to recite the full adjacency list. After map-fade, your mental list is your only reference.</p>
                    <p><strong className="text-cyan-200">Common mistake:</strong> Memorizing only the walk path (the sequence you've traversed) instead of the underlying topology. You can be on A → C → B → D and still not realize that A connects to F too. Map-fading exposes this — you'll start missing targets that involve unused edges.</p>
                  </section>

                  {/* Section 6 — Tier 3: Hard */}
                  <section className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                      <Award className="w-4 h-4" /> Tier 3 — Hard · K-Step Successor (the SR core)
                    </h3>
                    <p className="text-[13px]">
                      <strong className="text-amber-200">Rule:</strong> Press if the current node is reachable from the N-back node in <strong>exactly K steps</strong> (default K=2). "Reachable in K steps" means there exists at least one walk of length K from N-back-node to current.
                    </p>
                    <p>
                      This is the heart of Successor Representation training. You're predicting future occupancy. Given that I was at X two trials ago, where am I likely to be NOW (after 2 steps of walk)?
                    </p>
                    <p>
                      The K-step reachable set is computed by BFS over walks of length K. For K=2, from node X the reachable set is the union of neighbours-of-neighbours (revisits allowed).
                    </p>
                    <p><strong className="text-amber-200">Worked example</strong> (same small-world graph, N=2, K=2):</p>
                    <div className="overflow-x-auto rounded border border-amber-500/30 bg-background/40">
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-secondary/40 border-b border-amber-500/30">
                          <th className="text-left p-2 text-amber-300">Trial</th>
                          <th className="text-left p-2 text-amber-300">Current</th>
                          <th className="text-left p-2 text-amber-300">N=2 back</th>
                          <th className="text-left p-2 text-amber-300">K=2 reach from N-back</th>
                          <th className="text-left p-2 text-amber-300">Verdict</th>
                        </tr></thead>
                        <tbody className="text-foreground/85">
                          <tr className="border-b border-amber-500/20"><td className="p-2">3</td><td className="p-2">B</td><td className="p-2">A</td><td className="p-2">A→B / A→F / A→C in 1 step → 2-step: B can be reached via A→C→B ✓ — set {'{A, B, F, C, D, E}'}</td><td className="p-2 text-emerald-300 font-semibold">✓ PRESS</td></tr>
                          <tr className="border-b border-amber-500/20"><td className="p-2">4</td><td className="p-2">A</td><td className="p-2">C</td><td className="p-2">C neighbours: {'{B, D, A}'} → 2-step reach: {'{A, C, B, D, E}'} → A ∈ set</td><td className="p-2 text-emerald-300 font-semibold">✓ PRESS</td></tr>
                          <tr className="border-b border-amber-500/20"><td className="p-2">5</td><td className="p-2">F</td><td className="p-2">B</td><td className="p-2">B→A in 1, B→C in 1 → 2-step: {'{B, C, F, D, A}'} → F ∈ set</td><td className="p-2 text-emerald-300 font-semibold">✓ PRESS</td></tr>
                          <tr><td className="p-2">6</td><td className="p-2">E</td><td className="p-2">A</td><td className="p-2">A's 2-step reach is {'{A, B, F, C, D}'} — E NOT included</td><td className="p-2 text-rose-300 font-semibold">✗ don't press</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <p><strong className="text-amber-200">Strategy:</strong> Don't try to compute K-step reach on the fly during a trial — too slow. Instead, during the learning phase, mentally precompute the <em>2-hop neighbours</em> of each node and remember those clusters. For a 6-node graph this is doable: just memorize "A reaches {'{B, F, C, D, E}'} in 2 steps" etc. You're caching the SR matrix in your head.</p>
                    <p><strong className="text-amber-200">Common mistake:</strong> Confusing 1-step reach (medium tier rule) with 2-step reach. If current is a direct neighbour of N-back, it's <em>also</em> reachable in 2 steps (via any neighbour-of-neighbour that loops back). At K=2 the target set is much larger than at K=1.</p>
                    <p><strong className="text-amber-200">K knob:</strong> the start-screen lets you set K from 1 to 4. K=1 collapses Hard tier back to Medium. K=3 or 4 covers most of the graph for small node counts — target rates climb toward 60-70%, which can feel trivial. K=2 is the design sweet spot.</p>
                  </section>

                  {/* Section 7 — Tier 4: Extreme */}
                  <section className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-2">
                      <Award className="w-4 h-4" /> Tier 4 — Extreme · Goal Revaluation
                    </h3>
                    <p className="text-[13px]">
                      <strong className="text-rose-200">Rule:</strong> Each trial shows a goal node marked with a yellow ★ above it. Press if the current node sits on the <strong>shortest path</strong> from the N-back node to the goal (excluding the endpoints themselves).
                    </p>
                    <p>
                      This is Stachenfeld's "revaluation" test: when the reward / goal changes location, can you re-plan an optimal path on-the-fly using your cached cognitive map? A pure model-free agent (cached value lookups) would need re-training. A pure model-based agent (full topology + planning) could do it but slowly. An SR-mapped agent computes shortcuts instantly.
                    </p>
                    <p>
                      The engine auto-picks a goal each trial such that the shortest path from N-back to goal has at least one intermediate node (otherwise the test is trivial). On the 3×3 lattice this gives ~3-8 targets per 20 trials at MATCH_CHANCE.
                    </p>
                    <p><strong className="text-rose-200">Worked example</strong> (3×3 lattice, nodes A-I laid out in rows of 3, N=2):</p>
                    <p className="text-[11px] text-muted-foreground/80">Lattice adjacency (row-major): A-B-C | D-E-F | G-H-I with vertical edges A-D, B-E, C-F, D-G, E-H, F-I and horizontal edges within rows.</p>
                    <div className="overflow-x-auto rounded border border-rose-500/30 bg-background/40">
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-secondary/40 border-b border-rose-500/30">
                          <th className="text-left p-2 text-rose-300">Trial</th>
                          <th className="text-left p-2 text-rose-300">Current</th>
                          <th className="text-left p-2 text-rose-300">N-back</th>
                          <th className="text-left p-2 text-rose-300">Goal ★</th>
                          <th className="text-left p-2 text-rose-300">Shortest path (intermediates)</th>
                          <th className="text-left p-2 text-rose-300">Verdict</th>
                        </tr></thead>
                        <tbody className="text-foreground/85">
                          <tr className="border-b border-rose-500/20"><td className="p-2">3</td><td className="p-2">B</td><td className="p-2">A</td><td className="p-2">C</td><td className="p-2">A→<strong className="text-rose-200">B</strong>→C  → {'{B}'}</td><td className="p-2 text-emerald-300 font-semibold">✓ PRESS</td></tr>
                          <tr className="border-b border-rose-500/20"><td className="p-2">4</td><td className="p-2">F</td><td className="p-2">A</td><td className="p-2">I</td><td className="p-2">A→B→C→F→I → {'{B, C, F}'} (one of many 4-length paths)</td><td className="p-2 text-emerald-300 font-semibold">✓ PRESS</td></tr>
                          <tr className="border-b border-rose-500/20"><td className="p-2">5</td><td className="p-2">H</td><td className="p-2">A</td><td className="p-2">E</td><td className="p-2">A→B→E or A→D→E → {'{B, D}'} (NOT H)</td><td className="p-2 text-rose-300 font-semibold">✗ don't press</td></tr>
                          <tr><td className="p-2">6</td><td className="p-2">E</td><td className="p-2">B</td><td className="p-2">H</td><td className="p-2">B→<strong className="text-rose-200">E</strong>→H → {'{E}'}</td><td className="p-2 text-emerald-300 font-semibold">✓ PRESS</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <p><strong className="text-rose-200">Strategy:</strong> Pre-compute a "shortest paths from A to everywhere" mental table during the learning phase. For small lattices this is just Manhattan distance plus a few diagonal alternatives. On non-lattice topologies you need to memorize the actual edge structure. The goal changes per trial, so you can't pre-cache — but you CAN pre-cache the metric (distance matrix), then compute the path on the fly.</p>
                    <p><strong className="text-rose-200">Common mistake #1:</strong> Including the endpoints. The N-back node and the goal node are NOT targets even if current equals them — only <em>intermediate</em> nodes on the path count.</p>
                    <p><strong className="text-rose-200">Common mistake #2:</strong> On graphs with multiple shortest paths (very common in lattices), the current only needs to be on <em>one</em> valid shortest path. The engine returns true if current ∈ <em>some</em> shortest path's intermediate set.</p>
                  </section>

                  {/* Section 8 — Topology Guide */}
                  <section className="rounded-lg bg-secondary/20 border border-border p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-indigo-400" /> Topology guide — picking the right graph family
                    </h3>
                    <div className="overflow-x-auto rounded border border-border bg-background/40">
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-secondary/40 border-b border-border">
                          <th className="text-left p-2 text-indigo-300">Family</th>
                          <th className="text-left p-2 text-indigo-300">Structure</th>
                          <th className="text-left p-2 text-indigo-300">Easy/Medium feel</th>
                          <th className="text-left p-2 text-indigo-300">Hard/Extreme feel</th>
                        </tr></thead>
                        <tbody className="text-foreground/85">
                          <tr className="border-b border-border/40"><td className="p-2 text-indigo-300 font-semibold">Ring</td><td className="p-2">Pure cycle (each node connects to 2 neighbours)</td><td className="p-2">Trivial — only 2 neighbours per node</td><td className="p-2">K=2 reach = 2 nodes (just the 2-hops); diameter grows large for big N</td></tr>
                          <tr className="border-b border-border/40"><td className="p-2 text-indigo-300 font-semibold">Ring + Shortcuts (small-world)</td><td className="p-2">Cycle plus 1-2 random chords</td><td className="p-2">Slightly harder — must remember which chords exist</td><td className="p-2"><strong>Default</strong>. K=2 reach grows due to chord shortcuts. SR-like.</td></tr>
                          <tr className="border-b border-border/40"><td className="p-2 text-indigo-300 font-semibold">Tree</td><td className="p-2">Hierarchical binary-ish tree</td><td className="p-2">Asymmetric — root has more neighbours than leaves</td><td className="p-2">Sparse paths; revaluation is interesting (always through parents)</td></tr>
                          <tr className="border-b border-border/40"><td className="p-2 text-indigo-300 font-semibold">Lattice</td><td className="p-2">2D grid (2×3, 3×3, 3×4)</td><td className="p-2">Spatial intuition kicks in</td><td className="p-2">Manhattan-distance metric; multiple shortest paths common</td></tr>
                          <tr><td className="p-2 text-indigo-300 font-semibold">Random</td><td className="p-2">Erdős-Rényi (rejection-sampled for connectedness)</td><td className="p-2">Unpredictable; no exploitable visual pattern</td><td className="p-2">Hardest to memorize; pure topology recall</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <p>
                      <strong className="text-indigo-200">Starter pick:</strong> Ring for Easy / Medium, Ring + Shortcuts for Hard, Lattice for Extreme. The Coach phases already do this for you (Phase 26 = ring · Phase 27-28 = small-world · Phase 29 = lattice).
                    </p>
                  </section>

                  {/* Section 9 — Schema Transfer (TEM) */}
                  <section className="rounded-lg bg-violet-500/10 border border-violet-500/30 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Schema Transfer Mode (TEM)
                    </h3>
                    <p>
                      Toggle "Schema Transfer (TEM)" on the start screen and the session now contains <strong>2-5 blocks</strong>, each a fresh graph from the same topology family. The blocks are labelled <span className="text-cyan-300">Map α</span> · <span className="text-emerald-300">Map β</span> · <span className="text-violet-300">Map γ</span> · etc with distinct colour themes.
                    </p>
                    <p>
                      <strong className="text-violet-200">What's the same:</strong> the topology FAMILY (ring / small-world / tree / lattice / random) and the tier rule. If you chose "Hard tier, small-world, K=2, 3 blocks", you get three different small-world graphs, each evaluated with the K=2 reach rule.
                    </p>
                    <p>
                      <strong className="text-violet-200">What's different per block:</strong> the specific edges (graphs are independently sampled), the node positions, the theme colour. The labels (A-F) stay the same — that's the surface — but the connectivity changes.
                    </p>
                    <p>
                      <strong className="text-violet-200">Critical rule:</strong> When a block switches mid-session, the first N=2 trials in the new block <strong>cannot be targets</strong>. This is by design — comparing across surfaces would be ill-defined (the graphs are different). After those 2 trials, the rule applies normally within the current block.
                    </p>
                    <p>
                      <strong className="text-violet-200">What's being tested:</strong> can you grasp the abstract <em>schema</em> ("this is always a ring with 1 shortcut") rather than memorizing one specific map? An SR-mapped brain should perform well on Map β starting from trial 3 of Map β — no need to "re-learn" the topology. A surface-encoder will have to start from scratch each block.
                    </p>
                    <p>
                      The <strong>Stats → Predictive Map</strong> tab computes a "Schema Transfer Cost" metric: <em>single-graph avg accuracy − schema-transfer avg accuracy</em>. A small positive value (&lt; 8%) = you've encoded the schema. A large positive value = you're memorizing concrete maps.
                    </p>
                  </section>

                  {/* Section 10 — Strategy Summary */}
                  <section className="rounded-lg bg-secondary/30 border border-border p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <Brain className="w-4 h-4 text-indigo-400" /> Strategy summary — quick reference
                    </h3>
                    <div className="overflow-x-auto rounded border border-border bg-background/40">
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-secondary/40 border-b border-border">
                          <th className="text-left p-2 text-indigo-300">Tier</th>
                          <th className="text-left p-2 text-indigo-300">What to encode during learn phase</th>
                          <th className="text-left p-2 text-indigo-300">What to compute per trial</th>
                          <th className="text-left p-2 text-indigo-300">Mental load</th>
                        </tr></thead>
                        <tbody className="text-foreground/85">
                          <tr className="border-b border-border/40"><td className="p-2 text-emerald-300 font-semibold">Easy</td><td className="p-2">Nothing about topology — just track current node</td><td className="p-2">Is letter X = letter from 2 trials ago?</td><td className="p-2">Low — pure WM</td></tr>
                          <tr className="border-b border-border/40"><td className="p-2 text-cyan-300 font-semibold">Medium</td><td className="p-2">Adjacency list per node</td><td className="p-2">Is current ∈ neighbours(N-back)?</td><td className="p-2">Medium — WM + edge memory</td></tr>
                          <tr className="border-b border-border/40"><td className="p-2 text-amber-300 font-semibold">Hard</td><td className="p-2">K-hop reach set per node (pre-compute)</td><td className="p-2">Is current ∈ K-reach(N-back)?</td><td className="p-2">High — WM + SR matrix</td></tr>
                          <tr><td className="p-2 text-rose-300 font-semibold">Extreme</td><td className="p-2">Distance metric + shortest-path intuitions</td><td className="p-2">Is current on shortest-path(N-back → goal)?</td><td className="p-2">Highest — WM + dynamic planning</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <p>
                      <strong className="text-indigo-200">General tactic across all tiers:</strong> During the 6-trial learning window, don't just watch passively — actively rehearse the adjacency. Say each edge out loud (or sub-vocalize) as you see it: "A connects to B and F and C". By trial 6 you should have the full structure cached. Once fading kicks in, you're running entirely off that cache.
                    </p>
                    <p>
                      <strong className="text-indigo-200">Pacing:</strong> default SOA is 2.4-2.8 seconds per trial. That's tight for Hard / Extreme. If you find yourself guessing, drop to a less demanding tier first to consolidate topology recall before progressing.
                    </p>
                  </section>

                  {/* Section 11 — Common Pitfalls */}
                  <section className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" /> Common pitfalls
                    </h3>
                    <ul className="list-disc list-inside pl-1 space-y-1.5">
                      <li><strong className="text-amber-200">Only encoding the walk path, not the graph.</strong> If you only remember nodes you've visited, you miss edges that the random walk hasn't traversed yet. Always look at <em>all</em> visible edges during learn-phase, not just the highlighted ones.</li>
                      <li><strong className="text-amber-200">Forgetting that revisits are allowed.</strong> In Hard tier K=2, the path A→B→A is a valid 2-step walk back to A. So A is in its own 2-step reach set. Same for any node that has a neighbour with a back-edge.</li>
                      <li><strong className="text-amber-200">Misreading the tier badge.</strong> The top-right "TJN · MEDIUM" vs "TJN · HARD" looks similar at a glance. Always check before pressing on uncertain trials.</li>
                      <li><strong className="text-amber-200">Pressing too early after block switch (TEM mode).</strong> The first N trials of a new block are non-scoring by design — pressing them gets you a false alarm. Wait until you've seen at least N=2 trials in the new block before considering presses.</li>
                      <li><strong className="text-amber-200">Treating Easy tier like the others.</strong> Easy doesn't use the graph at all — using the graph slows you down without adding accuracy.</li>
                      <li><strong className="text-amber-200">Trying to read the goal ★ position from where the star is drawn.</strong> The star is drawn slightly above the goal node — the goal IS the node directly underneath. Don't confuse the star's centroid with the node centroid.</li>
                      <li><strong className="text-amber-200">Ignoring the T counter.</strong> If after 10 trials you have T=0, targets aren't firing — drop to an easier tier or larger topology, don't keep guessing.</li>
                    </ul>
                  </section>

                  {/* Section 12 — Where to find it & coach phases */}
                  <section className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                      <Zap className="w-4 h-4" /> Where to play it — manual + Coach phases
                    </h3>
                    <p>
                      <strong className="text-indigo-200">Manual launch:</strong> Start screen → expand <em>Enhancement Modes</em> → toggle <em>Trajectory N-Back (SR / TEM)</em>. The settings panel appears with tier / topology / nodes / K / Schema Transfer toggle / block count. Then Manual Mode.
                    </p>
                    <p>
                      <strong className="text-indigo-200">Coach Autopilot:</strong> the curriculum includes 7 dedicated TJN phases:
                    </p>
                    <ul className="list-disc list-inside pl-1 space-y-1 text-[12px]">
                      <li><strong>Phase 26:</strong> Map Encoding (TJN Easy · ring · 6 nodes)</li>
                      <li><strong>Phase 27:</strong> Neighbour Recall (TJN Medium · small-world · 6 nodes)</li>
                      <li><strong>Phase 28:</strong> Successor Prediction (TJN Hard · small-world · K=2)</li>
                      <li><strong>Phase 29:</strong> Goal Revaluation (TJN Extreme · 3×3 lattice · 9 nodes)</li>
                      <li><strong>Phase 30:</strong> Schema Transfer Easy (TEM · 3 ring graphs)</li>
                      <li><strong>Phase 31:</strong> Schema Transfer Successor (TEM · 3 small-world graphs · K=2)</li>
                      <li><strong>Phase 32:</strong> Cross-Topology Schema Crucible (TEM · 4 lattices · Medium tier)</li>
                    </ul>
                    <p>
                      Each phase has its own mastery slot in the spaced-repetition scheduler — pass at ≥75% to advance, fail at &lt;55% to drop back. The <strong>Stats → Predictive Map</strong> tab shows per-tier accuracy + the Schema Transfer Cost metric.
                    </p>
                  </section>

                </div>
              )}

              {/* SPECIAL TECH TAB */}
              {activeTab === 'features' && (
                <div className="space-y-4">
                  {/* Reasoning Index (Sandia Matrices) — pre/post assessment */}
                  <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Reasoning Index — pre/post matrix-reasoning measure</h3>
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      A matrix-reasoning test reached from the <strong className="text-cyan-300">Snapshot</strong> button, built from the <strong>Sandia Matrices</strong> (Matzen et al. 2010) — a free, published, norm-referenced Raven's-style item bank released by Sandia National Laboratories. Abstract matrix reasoning is the single best proxy for fluid intelligence (g). Each item shows a 3×3 pattern with one cell missing; you choose the option that completes it.
                    </p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      Take <strong>Baseline (Form A · 24 items)</strong> before a training block and <strong>Follow-up (Form B · 24 items)</strong> after — two <strong>different, difficulty-matched</strong> item sets, so nothing is memorized. Or run the <strong>Full test (48 items)</strong> for the most reliable single estimate. Your score maps to a <strong>100-average / 15-per-step</strong> scale with a <strong>95% confidence interval</strong>, percentile, and reliability (longer test → tighter interval).
                    </p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      <strong className="text-cyan-200">Pre/post done right:</strong> a <strong>Reliable Change Index</strong> judges your follow-up minus baseline against measurement error — a change has to clear the stated threshold to count as statistically reliable. Smaller real gains exist but can't be distinguished from noise; the app says so plainly rather than hyping a noise bump.
                    </p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      <strong className="text-amber-300">Honest limits:</strong> it's anchored to the Sandia 2010 norming study (university-student sample, few ratings per item), so it's an index for tracking <em>your own change over time</em> — not a clinical or population-normed IQ. Read the confidence interval and the change, not the bare number.
                    </p>
                  </div>
                  {/* Capacity Credits — probe-based far-transfer + training Δ-IQ + g */}
                  <div className="rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/30 p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-fuchsia-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-fuchsia-300">Capacity Credits — what the chip row means (and doesn't)</h3>
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      The Coach card now shows three numbers — <strong className="text-emerald-300">g</strong> (training credit), <strong className="text-cyan-300">ΔIQ</strong> (training-estimated trajectory), and <strong className="text-fuchsia-300">FT %</strong> (Far Transfer Score). Each one answers a different question and is computed from a different signal.
                    </p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      <strong className="text-emerald-300">g — training credit.</strong> Cumulative score that grows every session as <code>difficulty × accuracy × duration × mode-diversity</code>. It rewards showing up and putting in quality reps. Treat it like XP. It is <strong>engagement, not a cognitive measure</strong> — don't read it as an IQ proxy.
                    </p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      <strong className="text-fuchsia-300">Far Transfer Score — probe wins.</strong> The app watches your session config (mode set, N-band, NRINT rule, stream count, …). When you switch enough features from your recent baseline, the session is tagged as a <strong>switch probe</strong>. When you replay a phase you'd already attempted ≥ 5 sessions ago, it's a <strong>recheck</strong>. Each probe's outcome is <strong className="text-emerald-300">Hold</strong> (accuracy held), <strong className="text-amber-300">Partial</strong> (small drop), or <strong className="text-rose-300">Drop</strong> (large drop) vs. the baseline. The Far Transfer % is an EMA of the last 12 probe outcomes — what fraction of switches you weather without losing accuracy.
                    </p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      <strong className="text-cyan-300">Training ΔIQ — probe-gated trajectory.</strong> Updates <em>only</em> on probe sessions, scaled by phase difficulty. Drop probes subtract a small amount. Playing the same config repeatedly grows g but does not move ΔIQ. This makes the IQ-trajectory honest — it requires transfer evidence to register.
                    </p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      <strong className="text-cyan-200">Ground truth.</strong> The validated Δ-IQ comes from the <strong>Reasoning Index</strong> above — paired Sandia Matrices pre + post with a 95% CI and Reliable Change Index. The Stats panel surfaces both side-by-side; if the training estimate runs hot vs. the validated index, a calibration banner says so.
                    </p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      <strong className="text-amber-300">What this is and isn't.</strong> It's a transparent, probe-based training instrument inspired by the broader literature on n-back transfer hygiene (Jaeggi et al. 2008, Au et al. 2015, Owen et al. 2010, Soveri et al. 2017). It is <em>not</em> a clinical or population-normed IQ test, and the training estimate is not a substitute for a validated assessment. The Reasoning Index is the only number in this app you should treat as a real Δ-IQ.
                    </p>
                  </div>
                  {/* Synaesthesia */}
                  <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-indigo-400 animate-pulse" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">Grapheme-Color Synaesthesia Mode</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                      Experience customized letter-digit sensory coupling. Every alphanumeric character drawn in verbal tokens, CCT math grids, and 3D WebGL orbiters gets painted in its own distinct, custom-color preset. Custom-mapped graphemes use a heavy high-contrast mask outline to ensure perfect, instant legibility across all backgrounds.
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                      Toggle the option and expand the interactive swatch panel directly under "Token Style Mix" on the setup dashboard to set your custom letter color mappings.
                    </p>
                  </div>

                  {/* Audiobeats */}
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">Multi-Channel Spatial Beats</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                      Acoustic streams are completely abstract pitch beats, rather than spoken codes. Audio channels are isolated into left/right ears with green spatial status badges. Speaker playback separates signals in time to remain clean.
                    </p>
                  </div>

                  {/* Stressors */}
                  <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300">GPU Glitch Engines &amp; Panic Stressors</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                      Enable the premium visual stressor filters to build extreme attention resistance: visual GPU glitched card skews, violent canvas screen-shaking, and the countdown Timer Panic Heatbar that transitions color dynamically.
                    </p>
                  </div>
                </div>
              )}

              {/* AUTOPILOT CURRICULUM TAB */}
              {activeTab === 'autopilot' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                      <Brain className="w-4 h-4 text-emerald-400 animate-pulse" /> Autopilot Calibration Loop
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                      The Coach Autopilot maps your cognitive progression across 20 stages:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground font-mono">
                      <li>Maintain <strong className="text-foreground">&ge; 75% accuracy</strong> over 2 consecutive sessions to Level Up.</li>
                      <li>Drop below <strong className="text-foreground">55% accuracy</strong> over 2 consecutive sessions to trigger auto-fallback easing.</li>
                    </ul>
                  </div>

                  {/* Phase Table */}
                  <div className="border border-border/80 rounded-xl overflow-hidden bg-[#0d1527]">
                    <div className="overflow-x-auto max-h-[350px] scrollbar-thin">
                      <table className="w-full text-[10px] sm:text-xs font-mono text-left border-collapse">
                        <thead className="sticky top-0 bg-[#16223b] z-10">
                          <tr className="border-b border-border/60 text-primary font-bold">
                            <th className="p-2 sm:p-3">LVL</th>
                            <th className="p-2 sm:p-3">PHASE</th>
                            <th className="p-2 sm:p-3 text-center">N</th>
                            <th className="p-2 sm:p-3 text-center">SPEED</th>
                            <th className="p-2 sm:p-3 text-center">ROUNDS</th>
                            <th className="p-2 sm:p-3">MODES</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {difficultyOrder().map(({ phaseIndex: idx }, rankIdx) => {
                            const p = COACH_PHASES[idx];
                            // Colour by difficulty band so the ladder
                            // visually steps from gentle to brutal.
                            const d = p.difficulty ?? 5;
                            let phaseColor = "text-emerald-400";
                            if (d > 1.5) phaseColor = "text-cyan-400";
                            if (d > 3.5) phaseColor = "text-fuchsia-400";
                            if (d > 5.5) phaseColor = "text-amber-400";
                            if (d > 7.5) phaseColor = "text-rose-400";

                            return (
                              <tr key={idx} className="hover:bg-secondary/15 transition-colors">
                                <td className="p-2 sm:p-3 font-semibold text-foreground/80">{rankIdx + 1}</td>
                                <td className={`p-2 sm:p-3 font-bold ${phaseColor}`}>{p.title} <span className="text-foreground/40 font-normal">· D{p.difficulty}</span></td>
                                <td className="p-2 sm:p-3 text-center font-bold text-foreground">{p.nLevel}</td>
                                <td className="p-2 sm:p-3 text-center text-muted-foreground">{p.speedMs}ms</td>
                                <td className="p-2 sm:p-3 text-center text-muted-foreground">{p.rounds}</td>
                                <td className="p-2 sm:p-3 text-[10px] text-muted-foreground/80 leading-tight">
                                  {p.modes.length > 0 ? p.modes.map(m => m.replace(/_/g, ' ')).join(', ') : 'normal relations'}
                                  {p.streamsCount && p.streamsCount > 1 ? ` (${p.streamsCount} streams)` : ''}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* WORKED EXAMPLES TAB */}
              {activeTab === 'examples' && (
                <div className="space-y-4">
                  <div className="space-y-4 text-xs">
                    {/* Ex 1 */}
                    <div className="rounded-lg bg-secondary/20 border border-border/80 p-5 space-y-2">
                      <strong className="text-fuchsia-300 block font-mono">Nonverbal RINT Subset-Union Rule (N = 3)</strong>
                      <p className="text-muted-foreground leading-relaxed">
                        Match is true when current flags equal the union of some non-empty subset of the previous N stims.
                        Up to <strong>14 binary attributes</strong> available (8 visual + 6 audio).
                        Key catch: <em>a past stim is only usable as a "summand" if ALL its flags are also in current</em> — you can't partially use a stim.
                      </p>
                      <div className="rounded bg-background/50 border border-border p-3 space-y-1 font-mono text-[11px]">
                        <div>Trial 1: <span className="text-cyan-300">touching</span> · <span className="text-amber-300">glow</span> · <span className="text-emerald-300">audio ♪</span></div>
                        <div>Trial 2: <span className="text-violet-300">hollow</span> · <span className="text-orange-300">warm ♪</span></div>
                        <div>Trial 3: <span className="text-cyan-300">touching</span></div>
                        <div>Trial 4 (current = <span className="text-cyan-300">touching</span> · <span className="text-amber-300">glow</span> · <span className="text-emerald-300">audio</span>) &rarr; <span className="text-emerald-400 font-bold">TARGET</span> — T1 is fully in current, T3 is fully in current, T1 ∪ T3 = current. (T2 excluded — has hollow + warm, neither in current.)</div>
                        <div>Trial 5 (current = <span className="text-cyan-300">touching</span> · <span className="text-violet-300">hollow</span>) &rarr; <span className="text-rose-400 font-bold">not a target</span> — T2 has hollow (good) but also warm (not in current) → T2 excluded entirely. T1 has audio + glow (not in current) → excluded. Only T3 remains; T3 ∪ {`{}`} = {`{touching}`} ≠ current.</div>
                      </div>
                    </div>

                    {/* Ex 1b — NRINT multi-rule sampling */}
                    <div className="rounded-lg bg-secondary/20 border border-fuchsia-500/40 p-5 space-y-2">
                      <strong className="text-fuchsia-300 block font-mono">Nonverbal RINT — Multi-rule sampling (Grapist follow-up)</strong>
                      <p className="text-muted-foreground leading-relaxed">
                        Enable any combination of the 5 logical rules with per-rule weights. Each trial independently samples one rule by weight, so the player has to recognise which logic is active on the current stim — not just apply a fixed rule. Weights are relative frequencies, not probabilities; the engine normalises them.
                      </p>
                      <div className="rounded bg-background/50 border border-border p-3 space-y-1 font-mono text-[11px]">
                        <div>Weights: <span className="text-cyan-300">Union 2</span> · <span className="text-amber-300">XOR 1</span> · <span className="text-violet-300">Implication 1</span> &rarr; per-trial probabilities <span className="text-cyan-300">50%</span> / <span className="text-amber-300">25%</span> / <span className="text-violet-300">25%</span></div>
                        <div className="pt-1 text-muted-foreground/70">Over a 28-trial session that's ~14 Union trials, ~7 XOR, ~7 Implication (drift ±2 per run). Stats break down accuracy per rule using each trial&apos;s recorded rule.</div>
                        <div className="pt-2">Trial 5 (rule sampled = <span className="text-amber-300 font-bold">XOR</span>): T1={`{touch, glow}`}, T2={`{glow, hollow}`}, T3={`{touch}`}. Current={`{hollow}`}. T1⊕T2⊕T3 = {`{hollow}`} (touch cancels, glow cancels) &rarr; <span className="text-emerald-400 font-bold">TARGET</span>.</div>
                        <div>Trial 6 (rule sampled = <span className="text-cyan-300 font-bold">Union</span>): same tail. Current={`{hollow}`}. T2 has hollow + glow → excluded (glow ∉ current). No subset unions to {`{hollow}`} &rarr; <span className="text-rose-400 font-bold">not a target</span>.</div>
                        <div className="pt-1 text-muted-foreground/70">Same tail, different rule, different verdict. That&apos;s the load.</div>
                      </div>
                    </div>

                    {/* Ex 2 */}
                    <div className="rounded-lg bg-secondary/20 border border-border/80 p-5 space-y-2">
                      <strong className="text-fuchsia-300 block font-mono">CCT Arithmetic updating (N = 2)</strong>
                      <p className="text-muted-foreground leading-relaxed">
                        Match when candidate result matches current digit plus the digit from 2 steps back.
                      </p>
                      <div className="rounded bg-background/50 border border-border p-3 space-y-1 font-mono text-[11px]">
                        <div>Trial 1: digit <span className="text-cyan-300 font-bold">3</span></div>
                        <div>Trial 2: digit <span className="text-cyan-300 font-bold">5</span></div>
                        <div>Trial 3: digit <span className="text-cyan-300 font-bold">4</span>, candidate result <span className="text-amber-300 font-bold">7</span> &rarr; 4 + 3 = 7 &rarr; <span className="text-emerald-400 font-bold">TARGET</span></div>
                      </div>
                    </div>

                    {/* Ex 3 */}
                    <div className="rounded-lg bg-secondary/20 border border-border/80 p-5 space-y-2">
                      <strong className="text-fuchsia-300 block font-mono">Negation Operators (¬)</strong>
                      <p className="text-muted-foreground leading-relaxed">
                        A ¬ icon flips visual logic. Matches require both visual type AND negation flags to align exactly.
                      </p>
                      <div className="rounded bg-background/50 border border-border p-3 space-y-1 font-mono text-[11px]">
                        <div>Trial 1: <span className="text-primary font-bold">Inside</span> (no ¬)</div>
                        <div>Trial 2: <span className="text-primary font-bold">Above</span> (no ¬)</div>
                        <div>Trial 3: <span className="text-primary font-bold">Inside</span> with <span className="text-rose-400 font-bold">¬</span> &rarr; <span className="text-rose-400 font-bold">NOT A MATCH</span> (negation mismatch)</div>
                      </div>
                    </div>

                    {/* Ex 4 — RST Side-Task */}
                    <div className="rounded-lg bg-secondary/20 border border-violet-500/40 p-5 space-y-2">
                      <strong className="text-violet-300 block font-mono">RST Side-Task (Reasoning) — 3 families × 3 difficulties</strong>
                      <p className="text-muted-foreground leading-relaxed">
                        Layered on stream A like CCT, but tests deductive inference. One <em>premise</em> per trial; from trial N onwards a candidate <em>conclusion</em> also appears. Press <kbd className="px-1 py-0.5 rounded bg-muted text-violet-300 font-semibold">R</kbd> if the conclusion is logically valid.
                      </p>
                      <div className="rounded bg-background/50 border border-border p-3 space-y-2 font-mono text-[11px]">
                        <div className="text-violet-300 font-bold">Easy · Distinction (XOR over same/opposite)</div>
                        <div className="pl-3">T1: <span className="text-cyan-300">α</span> · T2: <span className="text-cyan-300">β same as α</span> · T3: <span className="text-cyan-300">γ opposite of β</span> + claim <span className="text-amber-300">∴≟ γ opposite of α</span> &rarr; α≡β, β≠γ → γ≠α → <span className="text-emerald-400 font-bold">VALID</span></div>
                        <div className="text-violet-300 font-bold pt-1">Medium · Comparison (transitive order)</div>
                        <div className="pl-3">T1: <span className="text-cyan-300">α</span> · T2: <span className="text-cyan-300">β more than α</span> · T3: <span className="text-cyan-300">γ less than β</span> + claim <span className="text-amber-300">∴≟ γ more than α</span> &rarr; depends on actual values (engine derives truth)</div>
                        <div className="text-violet-300 font-bold pt-1">Hard · Analogy (4-place — Halford / Raven's rung)</div>
                        <div className="pl-3">T1: <span className="text-cyan-300">α more than β</span> · T3 (N=2): <span className="text-cyan-300">γ heavier than δ</span> :: <span className="text-amber-300">α … β</span> <span className="text-violet-300">analogous?</span> &rarr; both have <em>first is dominant</em> form → <span className="text-emerald-400 font-bold">VALID</span></div>
                      </div>
                      <p className="text-muted-foreground/70 text-[11px] leading-relaxed pt-1">
                        Hard auto-extends SOA by 60% on analogy trials so the role-binding read is sustainable. Family generators ported from <a href="https://github.com/4skinskywalker/Syllogimous-v3" target="_blank" rel="noreferrer" className="underline text-violet-300">Syllogimous v3</a> (CC BY-NC 3.0).
                      </p>
                    </div>

                    {/* Ex 5 — Analogy N-Back (visual 4-place) */}
                    <div className="rounded-lg bg-secondary/20 border border-violet-500/40 p-5 space-y-2">
                      <strong className="text-violet-300 block font-mono">Analogy N-Back — visual 4-place (N = 2)</strong>
                      <p className="text-muted-foreground leading-relaxed">
                        A target fires when the current relation shares structural <strong>form class</strong> with the N-back relation, even if the relation tokens differ. Same-token = NOT a match (would be trivial identity).
                      </p>
                      <div className="rounded bg-background/50 border border-border p-3 space-y-2 font-mono text-[11px]">
                        <div className="text-violet-300 font-bold">Match across form class (target)</div>
                        <div className="pl-3">T1: <span className="text-primary font-bold">ABOVE_BELOW</span> (directional asymmetric) · T2: <span className="text-primary font-bold">INSIDE</span> · T3: <span className="text-primary font-bold">BIGGER_THAN</span> (also directional asymmetric) → <span className="text-emerald-400 font-bold">TARGET</span> (analogous to T1)</div>
                        <div className="text-violet-300 font-bold pt-1">Cross-class (non-target)</div>
                        <div className="pl-3">T1: <span className="text-primary font-bold">INSIDE</span> (containment) · T3: <span className="text-primary font-bold">TOUCHING</span> (symmetric-contact) → <span className="text-rose-400 font-bold">NOT A MATCH</span></div>
                        <div className="text-violet-300 font-bold pt-1">Same-token (trivially excluded)</div>
                        <div className="pl-3">T1: <span className="text-primary font-bold">MORE_THAN</span> · T3: <span className="text-primary font-bold">MORE_THAN</span> → <span className="text-rose-400 font-bold">NOT A MATCH</span> (identity ≠ analogy)</div>
                      </div>
                      <p className="text-muted-foreground/70 text-[11px] leading-relaxed pt-1">
                        Closest mode in this app to what Raven's Progressive Matrices measures at high difficulty. Form classes you'll meet: directional-asymmetric · containment · symmetric-contact · identity · opposition · multiplicity-asymmetric · ordered-sequence · temporal-ordered · complex-pattern · transform-dependency.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer actions inside the main display */}
        <div className="pt-6 border-t border-border/40 mt-8 shrink-0 flex items-center justify-between gap-4">
          <Link to="/">
            <Button className="bg-[#1e293b] hover:bg-[#334155] border border-border text-foreground text-xs gap-1.5 h-10 px-4">
              <ChevronLeft className="w-4 h-4" /> Back to Setup
            </Button>
          </Link>
          <Link to="/">
            <Button className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold gap-1.5 h-10 px-5 shadow-lg shadow-emerald-500/10">
              <Play className="w-4 h-4 fill-white text-white" /> Train Now
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
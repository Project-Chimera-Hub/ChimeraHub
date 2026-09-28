# GOATED Relational n-Back

**A free, open-source, PWA-installable working-memory & relational-reasoning trainer.**

Live at: https://find-1-bug.github.io/goated-relational-nback-2/

Single-user, client-side only, no backend, no accounts, no tracking. Sessions and settings live in your browser's `localStorage`. Built with React 18 + Vite + Three.js, deployed to GitHub Pages on every push to `main`.

---

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # outputs to dist/
npm run preview      # serve the built bundle
npm run lint         # eslint
```

Relative `base: './'` means the build works on any host path — GitHub Pages user site, project site, custom domain, file:// — with no rebuild. HashRouter for deep-link compatibility.

---

# What it is, in one sentence

A working-memory trainer that, instead of asking you to remember which letter or position appeared N trials ago, asks you to remember the *abstract relationship* between two stimuli — and then layers ~30 modes, side-tasks, and stressors on top to push the cognitive content as close as it can get to what fluid intelligence (Gf) actually measures.

---

# Pages (9 routes, all HashRouter)

| Route | Purpose |
|---|---|
| `/` | **Game** — StartScreen → GameScreen → ResultsScreen |
| `/insight` | **Insight Mode** — Raven-style puzzles with no WM load |
| `/assessment` | **Reasoning Index** — norm-referenced matrix-reasoning pre/post test (Sandia Matrices) |
| `/tutorial` | **Tutorial** — 7-tab Academy (incl. Predictive Map deep-dive) |
| `/stats` | **Stats** — neuro-analytics dashboard |
| `/framework` | **Framework** — worked-example reference per mode |
| `/diagnostics` | **Diagnostics** — pre-release engine validation suite |
| `/successor` | **Successor** — standalone graph-prediction sandbox (unlisted; Trajectory N-Back is the real mode) |
| `/review/:sessionId` | **Review** — trial-by-trial session playback |

---

# Game Modes (34 total, organised into 4 phases)

> Plus a per-stream **Decoy** type (see Phase D) and a per-stream REL/CCT type — orthogonal to the mode toggles below.

`MODE_OPTIONS` in [src/components/game/StartScreen.jsx](src/components/game/StartScreen.jsx). Players toggle these on/off freely; mutually-exclusive modes block each other in the UI.

### Phase A — Foundational Support & Interference Control
- **feedback_per_trial** — HIT/MISS/FA/CR verdict tag + one-line italic *hint* on errors (e.g. "lure at N+1 — not N", "different form class", "rel matched but ¬ flag differs"). HITs and CRs stay verdict-only — desirable-difficulty framing (Bjork: teach without telling).
- **distractors** — same-category near-match interference.
- **lures** (N≥2) — ~22% of non-targets match at **N±1** instead of N. Loose counting = false alarms. Separate **Lure Resistance %** tracked.
- **negation** (N≥2) — ~30% of trials flipped to **¬** (red badge). Match requires *both* the relation *and* the negation flag to agree.

### Phase B — Working-Memory & Logic Layers
- **cct** (Cognitive Control Training) — pure arithmetic: target when `candidate = current digit + N-back digit`.
- **cct_overlay** — CCT layered as a separate response axis on every relation stream.
- **rst_overlay** (N≥2) — Reasoning Side-Task with **Easy / Medium / Hard / Extreme** ladder (see below).
- **variable_n** — N shifts ±1 each trial.
- **adaptive** — N auto-adjusts between sessions (≥80% → up, ≤50% → down).
- **adaptive_closed_loop** — speed + lure rate + negation rate scale mid-session based on real-time accuracy.

### Phase C — Memory Integration & Dynamic Rules
- **type_nback** — match by relation **type**, not trial distance. Each rel has its own n-back queue.
- **rint** (N≥2) — Relational Integration. Persistent entities (α, β, γ…); target = current is a valid transitive conclusion from chaining the N most-recent facts. **Now with mixed direction within a chain** — e.g. `α > β`, `γ < β` requires mentally inverting to chain. Conclusions render in either direction (`A > C` or `C < A`).
- **nonverbal_rint** (N≥2) — composite attributes across **14 flags** (8 visual: touching, hollow, size_mismatch, rotated, dashed_border, glow, mirrored, striped + 6 audio: audio, pitch_high, audio_loud, audio_long, audio_rhythmic, audio_warm). Audio cues fire at staggered time slots so multiple can layer per trial without collision. Subset-union rule: current is a target iff its attrs equal the union of some non-empty subset of the last N stims. **Max-features-per-trial cap** (Grapist request) bounds how many flags can be ON at once so the tracking load stays manageable when many flags are enabled.
- **trajectory_nback** (N≥2) — **Successor-Representation / cognitive-map training**, the first mode that targets hippocampus + entorhinal cortex rather than DLPFC. Each session builds a graph; you walk it as a random walk. 4 tiers: Easy (same node N-back) → Medium (neighbour) → Hard (K-step successor) → Extreme (on the shortest path to a goal). Edges **fade** after a 6-trial learning window, forcing you to internalize the topology from memory (true SR, not visual edge-checking). **Schema Transfer (TEM)** toggle runs 2-5 graphs that share a topology family but with fresh surfaces — tests whether you abstract the schema (Stachenfeld 2017 × Behrens/Whittington TEM 2020). Topologies: ring · small-world · tree · lattice · random.
- **mixed_nback** — per-trial random: Normal or Type.
- **mixed_rint** (N≥2) — per-trial random: Normal / Type / RINT.
- **wrapper_morph** — visual theme + token category rotate mid-session.
- **token_blending** — verbal/alphanumeric/emoji tokens blend into relation grids.
- **binary_logic** (N≥2) — per-trial random `<NBack> <OP> <NBack>` pair (AND/OR/XOR/AND_NOT).
- **analogy_nback** (N≥2) — 4-place visual analogy: target fires when current and N-back share a **form class** (12 classes — directional-asymmetric, containment, identity, opposition, etc.). Same-token = **not** a match. Halford 4-place rung in visual form.

### Phase D — Spatial Overloads & Stress Resilience
- **alien_square** — relations rendered inside a 3×3 rotating square.
- **alien_cube** — 3×3×3 rotating cube; position is a 2nd answerable axis.
- **alien_tesseract** — 4D tesseract with inner/outer hyperspace layer.
- **stress_glitch** — visual glitch filter fires ~25% of trials.
- **stress_shake** — screen-shake animation fires ~35% of trials.
- **timer_panic** — shrinking countdown bar above each stream.
- **impossible** (N≥2, ≥2 streams) — each stream independently picks Normal/Type/RINT per trial.
- **Decoy stream** (per-stream type, not a global toggle) — a "spurious" stream that renders/plays normally but is **never scored and has no response key**. You must *ignore* it while tracking the real streams — **selective-attention / distractor-inhibition** training (Engle's controlled-attention construct), distinct from the `distractors` mode (which injects lures *into* a scored stream). A "hide ignore-label" toggle switches between a marked decoy (pure response inhibition) and an unmarked one (you must remember which streams are yours). Also fixed an audio master-limiter so overlapping sound cues no longer clip.

---

# RST Side-Task (Reasoning) — full ladder

| Difficulty | Family | Description |
|---|---|---|
| **Easy** | Distinction | XOR parity over `same as`/`opposite of` chain. Each entity has a hidden binary bucket; truth derives from parity. |
| **Medium** | Comparison | Transitive order chain (`more than`/`less than`). Hidden order indices. |
| **Hard** | Analogy (4-place) | Fresh entity pair each trial. Conclusion: "is current pair structurally analogous to N-back pair?" The **canonical Gf target** per Halford. |
| **Extreme** | Meta-Relation (5-place) | Conclusion is a **boolean** (∧, ∨, ∧¬, ↔) of TWO analogy claims spanning 5+ entities. Player must hold both sub-analogies + the connective in working memory simultaneously. **Pushes past the 4-place rung into meta-knowledge**. |

Hard + Extreme auto-extend stimulus duration by 60% on heavy trials so the reading load is sustainable.

Generators inspired by [Syllogimous v3 by 4skinskywalker](https://github.com/4skinskywalker/Syllogimous-v3) (CC BY-NC 3.0). See [src/lib/syllogimousAdapter.js](src/lib/syllogimousAdapter.js).

---

# Coach Autopilot — Mastery-Scaled Spaced Repetition

33 curated phases in [COACH_PHASES](src/lib/gameConstants.js). The Coach no longer marches you linearly through them. Instead:

- Each phase has its own **mastery level (0–5)** tracked across attempts.
- A success (≥75% accuracy) bumps the level by 1; a fail (<55%) drops it by 1.
- Higher mastery = longer wait until that phase resurfaces. **Leitner intervals** in sessions: `1 · 2 · 5 · 11 · 25 · 60`.
- When a mastered phase (L≥2) is due for review, the Coach has a **40% chance** to pick it instead of the frontier — keeping earlier skills warm.
- All else equal: lowest-index not-yet-mastered phase, otherwise advance the frontier.

The card shows the next pick + reason tag (**FRONTIER / REVIEW / ADVANCE / MAINTAIN / TEST**). Stats Coach tab color-codes phases by mastery level with a legend; phases due for review get a violet ring.

Implementation: [src/lib/coachMastery.js](src/lib/coachMastery.js). Legacy `consecutiveSuccesses/Failures` state migrated transparently — phases before your old frontier seed as L2-mastered so you don't get reset.

### Phase highlights
- **Phases A–D**: warm-ups (N=1)
- **1–10**: distractors → lures → negation → CCT → RST → adaptive → type → RINT → NRINT
- **11–14**: rule flexibility, set-shifting, episodic buffer
- **15–20**: 3D alien rotations, stress, dual-stream
- **21**: quantum focus (2 streams, N=3, impossible mode, all stressors)
- **22**: tesseract (4D)
- **22.5**: Analogy Crucible (pure 4-place visual analogy)
- **23**: Relational Supercomputer (RINT + RST Hard + CCT overlay)
- **24**: Grandmaster (3 streams, N=3)
- **25**: Infinite Singularity (3 streams, N=4, tesseract, max chaos)
- **26–29**: Trajectory N-Back ladder — Map Encoding (Easy/ring) → Neighbour Recall (Medium/small-world) → Successor Prediction (Hard/K=2) → Goal Revaluation (Extreme/lattice)
- **30–32**: Schema Transfer (TEM) — Easy (3 rings) → Successor (3 small-worlds) → Cross-Topology Crucible (4 lattices)
- **33**: Selective Attention Filter (2 streams, B is an unscored decoy you must ignore)

You can also **test any phase** without disturbing real curriculum progress via the Test Phase dropdown in the Coach card.

---

# Insight Mode (`/insight`)

Pure relational inference, **no n-back chain, no WM load, no time pressure**. Four puzzle types rotate randomly so the surface format isn't a Raven's-clone signature:

- **Odd-One-Out** — 3–6 panels (count varies); pick the one that doesn't share the form class. Layout varies grid / linear / scatter.
- **Reverse Sort** — given a form-class label, multi-select all panels matching it from a 6-pool.
- **Analogy Completion** — 3 panels share a form; pick the 4th candidate that belongs.
- **Verbal Analogy** — text-only, no rendered shapes: `α inside β :: γ ? δ` + 4 candidate relation labels.

Cumulative stats in localStorage. Optional hint button. Direct response to the *WM-strain vs direct-logic* critique — isolates the relational inference operation from working-memory overhead.

---

# Reasoning Index — pre/post assessment (`/assessment`)

A norm-referenced matrix-reasoning test for measuring whether training actually transfers. Built honestly, not as a gimmick:

- **Real, validated items** — the **Sandia Matrices** (Matzen et al. 2010), a free, public, normed Raven's-style item bank released by Sandia National Laboratories. Matrix reasoning is the single best proxy for fluid *g*.
- **Parallel disjoint forms** — Form A (baseline) and Form B (follow-up) are different, **difficulty-matched** 24-item sets (zero shared items → nothing to memorize). A 48-item **Full** test gives the most reliable single estimate.
- **Honest scoring** ([src/lib/psychometrics.js](src/lib/psychometrics.js)) — raw → a 100/15 standard scale anchored to the Sandia item difficulties, always shown with a **95% confidence interval** + empirical reliability (length-aware via Spearman-Brown; 24 items ≈ CI ±11, 48 ≈ ±7), plus a **Reliable Change Index** (Jacobson & Truax) that says whether a pre→post gain beats measurement error rather than hyping noise.
- **Honest framing** — anchored to the Sandia norming sample (university students, few ratings per item), so it's a *tracker of your own change*, not a clinical/population IQ. An IRT (2PL EAP) scoring path is built in and activates automatically if calibrated item parameters are ever loaded.

Item bank: [src/lib/sandiaBank.js](src/lib/sandiaBank.js); images under `public/assets/sandia/`. Cite: Matzen et al. 2010, *Behavior Research Methods* 42(2):525-541.

---

# Capacity Credits — probe-based far-transfer + training-IQ trajectory + g

A scoring trio shown on the Coach card and in Stats. Three numbers, three questions, three signals:

- **`g` — training credit.** Cumulative engagement. Per session: `difficulty × (accuracy / 100) × duration × mode-diversity`. Grows on every session. **Engagement metric, not a cognitive measure** — don't read it as an IQ proxy.
- **`ΔIQ` — training-estimated trajectory.** Updates *only* on probe sessions, scaled by phase difficulty. Drop probes subtract a small amount. Playing the same config repeatedly grows `g` but does not move `ΔIQ`. So the trajectory is honest — it requires transfer evidence to register.
- **`FT %` — Far Transfer Score.** EMA of the last 12 probe outcomes, scaled to 0–100. Tier bands: Early → Consolidating → Transferring → Broadly transferred.

**Probes** fire automatically. A **switch probe** fires when this session's config (mode set, N-band, NRINT rule, stream count, has-CCT/RST/TJN/Decoy/NRINT flags) differs from your recent baseline by ≥ 2 features. A **recheck** fires when you replay a phase whose mastery record is ≥ 5 sessions old. Each probe's outcome is graded vs. your baseline accuracy for that fingerprint:

- **Hold** — accuracy held under the switch (Δ ≥ −5%)
- **Partial** — small drop (−15% ≤ Δ < −5%)
- **Drop** — large drop (Δ < −15%)

**Ground truth.** The validated Δ-IQ is the **Reasoning Index** (Sandia Matrices) Δ with 95% CI + Reliable Change Index. The Stats panel surfaces both side-by-side: training estimate vs. validated. If the training number runs hot vs. the validated CI, a calibration banner says so. The Reasoning Index is the only number in this app you should treat as a real Δ-IQ.

Implementation: [src/lib/farTransfer.js](src/lib/farTransfer.js) — pure, deterministic. Persists per-session credit fields onto the session record at finish time. References on n-back transfer hygiene: Jaeggi et al. 2008, Au et al. 2015, Owen et al. 2010, Soveri et al. 2017.

---

# Other systems

- **Relation library**: 92+ relations across 7 categories — SPATIAL · SPATIAL_3D · TRAIT · QUANT · VERBAL · SOUND (10: pitch / rhythm / volume / duration / timbre — all pair-asymmetric except timbre which is opposition) · COMPLEX. 67 marked as transitive (used by RINT). Full inverse mapping (`BIGGER_THAN ↔ SMALLER_THAN` etc.) — see [src/lib/gameConstants.js](src/lib/gameConstants.js).
- **Form-class taxonomy** for Analogy N-Back & Insight: 12 abstract structural classes covering ~150 relations.
- **NRINT**: 14 attribute flags across visual + audio modalities (8 visual + 6 audio); per-flag enable picker; hide-legend toggle for truly nonverbal play.
- **Hint-shaped feedback**: per-trial diagnostic on MISS/FA names the misjudged dimension (e.g. "same-token isn't analogy", "different form class") without giving away the answer.
- **Pre-session rule briefing**: collapsible panel listing plain-English rules for currently-active modes before launch.
- **Multi-stream**: 1–20 streams; carousel pagination when too many for one viewport; each stream has its own REL/CCT type + key bindings.
- **3D rendering**: real Three.js scenes for alien-cube/square/tesseract + decorated SPATIAL_3D relations (orbit rings, tethers, shadows, fog, ground planes).
- **5 wrapper themes**: Cyberpunk Neon · Minimal Stark · Glassmorphic Frost · Sunset Glow · Matrix Terminal.
- **Synaesthesia engine**: per-character color map (A–Z, 0–9) applied to verbal tokens, CCT digits, 3D text sprites. Custom color picker, persisted in localStorage.
- **Token blending**: 8 token types — meaningful · nonsense · garbage · emoji · voronoi_emoji · random_string · voronoi · scrap (junk-journal procedural clipart).
- **Stats dashboard**: Overview / Coach / Stressors tabs. SVG accuracy trend chart; mastery-color-coded phase ladder; JSON export/import. Capacity Credits panel surfaces g · ΔIQ · FT + a probe ledger + ground-truth comparison vs. the validated Reasoning Index Δ.
- **Per-stream scoring axes**: REL · POS · CCT · RST — tracked independently with hit/miss/FA/CR + Lure subcounts + RST family breakdown.

---

# Storage (localStorage keys)

| Key | What |
|---|---|
| `nback_sessions` | Full session array with every trial recorded + per-session Capacity Credits (`gThisSession`, `iqCreditThisSession`, `probeKind`, `probeOutcome`, `probeDelta`, `probeBaselineAcc`) |
| `nback_settings` | Last-used config (modes, N, stream layout, RST difficulty, etc.) |
| `goated_coach_state` | Coach progress: `phaseIndex`, `sessionCount`, `phaseMastery{}`, `rankName` |
| `nback_theme` | Light/dark |
| `goated_synaesthesia_enabled` + `goated_synaesthesia_map` | Synaesthesia config |
| `goated_insight_stats_v1` | Insight Mode cumulative stats |
| `nback_assessments` | Reasoning Index results (form, raw, IQ, SEM, 95% CI, percentile, responses) |
| `goated_transfer_ledger` | Optional user journal |

Use **Stats → Export** for JSON backup, **Import** to restore.

---

# What's NOT in the app (intentionally absent)

- **No controlled transfer *experiment*** — the **Reasoning Index** (`/assessment`) now gives a real norm-referenced pre/post matrix-reasoning measure with a Reliable Change Index, which is the within-person half of the problem. What's still absent is a *controlled study* (a randomized control group), which a solo, local-only app can't run per user. So the index honestly tracks *your* change over time; it can't prove the training *caused* it.
- **No account / cloud sync / leaderboard / social** — single-user, local-only by design.
- **No formal logic instruction layer** — discovery-based learning only. Rules are pre-flight briefings, not during-play teaching.
- **No commercial monetization** — free, GitHub Sponsors funded only; compatible with CC BY-NC dependencies.

---

# Deploy to GitHub Pages

This repo ships with a GitHub Actions workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml) that builds + publishes on every push to `main`.

1. Create the repo, push this project to it.
2. **Settings → Pages → Source: GitHub Actions**.
3. Push to `main`. Workflow auto-runs.

If Pages was disabled / re-enabled and the workflow errors with `Create Pages site failed: Resource not accessible by integration`, manually re-enable via API:

```bash
gh api -X POST repos/<user>/<repo>/pages -f build_type=workflow
gh run rerun <last-run-id> --repo <user>/<repo>
```

---

# Tech stack

- React 18.2 + Vite 6.1 + Tailwind 3.4 + framer-motion 11.16
- HashRouter (react-router-dom 6.26) for static-host compatibility
- Three.js 0.171 for 3D scenes
- Canvas 2D for all 2D relation rendering
- Radix-UI primitives, lucide-react icons
- recharts 2.15 for Stats charts
- jspdf 4.0 + html2canvas 1.4 for export utilities
- Web Audio API for sound-relation playback + NRINT cues + CCT/RST press tones
- PWA installable (service worker + manifest)
- ESLint flat config; CI green on lint + build before push

---

# Scientific basis & references

The evidence behind each part of the app (also surfaced in-app via the **Studies** drawer on the start screen). The transfer question is presented honestly — the skeptical meta-analysis is included alongside the positive ones.

**Working memory → fluid-intelligence transfer** (the core n-back premise)
- Jaeggi, Buschkuehl, Jonides & Perrig (2008), *PNAS* — Improving fluid intelligence with training on working memory. https://doi.org/10.1073/pnas.0801268105
- Au et al. (2015), *Psychonomic Bulletin & Review* — meta-analysis: small but reliable Gf gain. https://doi.org/10.3758/s13423-014-0699-x
- Schmiedek, Lövdén & Lindenberger (2010), *Frontiers in Aging Neuroscience* — broad transfer from heavy multi-task training. https://doi.org/10.3389/fnagi.2010.00027
- Melby-Lervåg & Hulme (2013), *Developmental Psychology* — skeptical meta-analysis (mostly near-transfer). https://doi.org/10.1037/a0028228

**Relational reasoning & the Gf bottleneck** (RINT · Analogy N-Back · RST · Insight)
- Halford, Cowan & Andrews (2007), *Trends in Cognitive Sciences* — relational complexity / the 4-place limit. https://doi.org/10.1016/j.tics.2007.04.001
- Christoff et al. (2001), *NeuroImage* — rostrolateral PFC in relational integration. https://doi.org/10.1006/nimg.2001.0922

**Cognitive maps & Successor Representation** (Trajectory N-Back · Schema Transfer)
- Stachenfeld, Botvinick & Gershman (2017), *Nature Neuroscience* — the hippocampus as a predictive map. https://doi.org/10.1038/nn.4650
- Behrens et al. (2018), *Neuron* — what is a cognitive map? https://doi.org/10.1016/j.neuron.2018.10.002
- Whittington et al. (2020), *Cell* — the Tolman-Eichenbaum Machine (schema generalization). https://doi.org/10.1016/j.cell.2020.10.024
- Park, Miller & Boorman (2021), *Nature Neuroscience* — grid-like code for a social hierarchy. https://doi.org/10.1038/s41593-021-00916-3

**Selective attention & distractor control** (Decoy stream · lures)
- Engle (2002), *Current Directions in Psychological Science* — WM capacity as executive attention. https://doi.org/10.1111/1467-8721.00160
- Vogel, McCollough & Machizawa (2005), *Nature* — controlling access to WM. https://doi.org/10.1038/nature04171

**Spaced repetition & retrieval practice** (Coach mastery scheduler)
- Roediger & Karpicke (2006), *Psychological Science* — test-enhanced learning. https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Cepeda et al. (2006), *Psychological Bulletin* — the spacing effect, quantified. https://doi.org/10.1037/0033-2909.132.3.354

**Measuring reasoning** (Reasoning Index)
- Raven (2000), *Cognitive Psychology* — Progressive Matrices as a g measure. https://doi.org/10.1006/cogp.1999.0735
- Matzen et al. (2010), *Behavior Research Methods* — the Sandia Matrices (item bank used). https://doi.org/10.3758/BRM.42.2.525
- Condon & Revelle (2014), *Intelligence* — ICAR public-domain measure. https://doi.org/10.1016/j.intell.2014.01.004
- Jacobson & Truax (1991), *J. Consulting & Clinical Psychology* — the Reliable Change Index. https://doi.org/10.1037/0022-006X.59.1.12

**Neuroplasticity from training**
- McNab et al. (2009), *Science* — prefrontal dopamine D1 changes after WM training. https://doi.org/10.1126/science.1166102
- Finc et al. (2020), *Nature Communications* — frontoparietal network reconfiguration. https://doi.org/10.1038/s41467-020-15631-z

---

# Credits

**Built by [Stefanos (find-1-bug)](https://github.com/find-1-bug)** with [Claude Code (Opus)](https://www.anthropic.com/claude-code) and Gemini Flash 3.5 as coding partners.

**Community contributors (Mindbuilding Discord):**
- [@Grapist (AchvQdlty)](https://discord.com/invite/brain) — drove the original Nonverbal RINT design (subset-union rule), the RINT direction-cycling expansion, complex composite relations, per-trial feedback request, and the alien-cube panel bug report.
- [@sokuichi](https://discord.com/invite/brain) — sharp critique of WM-strain-with-relations vs direct-logic training; led directly to Insight Mode, hint-shaped feedback, pre-session rule briefing, and the diversification of Insight to 4 puzzle types ("distant similarity to matrix tests").
- [@davidbreneisen](https://discord.com/invite/brain) — community contributor on the relational-reasoning thread.
- [@Dark](https://discord.com/invite/brain) — critique on the WM vs reasoning blending tradeoff that informed how RINT/RST stacking was designed.

**Mindbuilding Discord**: https://discord.com/invite/brain
**Forum thread for this app**: https://discord.com/channels/1200540503654010910/1497601580797657269

**External influences:**
- [Syllogimous v3](https://github.com/4skinskywalker/Syllogimous-v3) by 4skinskywalker (CC BY-NC 3.0) — RST premise generator content ported with attribution.
- [Capacity Gym v2](https://github.com/Mindware-Lab/trident-g-platform) by Dr Mark Ashton Smith — inspiration for Lures, Coach family rotation, and transfer-score concepts.
- [Dr Mark Ashton Smith](https://iqmindware.substack.com) — IQ Mindware Substack, "demonstrate transfer experimentally" guidance.
- Halford / Christoff / Bunge — rostrolateral PFC relational complexity literature that drove the 4-place + 5-place RST design.
- Bjork — "desirable difficulties" framing for the hint-shaped feedback.

**Cognitive-science studies:** see the **Scientific basis & references** section above (also surfaced in the in-app Studies drawer, grouped by what each finding supports, every entry linked).

---

# License

App code: original work, free for any non-commercial use. RST generator content is derivative of Syllogimous v3 and therefore inherits **CC BY-NC 3.0**.

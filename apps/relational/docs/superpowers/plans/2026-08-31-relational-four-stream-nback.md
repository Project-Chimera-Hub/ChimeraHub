# Relational Four-Stream N-Back Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a repository-ready client-only relational four-stream n-back trainer with 2D/3D modes, changing relational prompts, a symbol wiki, local history, tests, GitHub Pages deployment, and a bundled PDF specification.

**Architecture:** Browser ES modules split pure relational logic from rendering and DOM orchestration. Trial generation stores explicit ground truth; the session engine scores response masks independently of rendering. The 3D cube is a dependency-free Canvas projection whose logical coordinates remain fixed while only the view rotates.

**Tech Stack:** HTML5, CSS3, JavaScript ES modules, Canvas 2D, Web Speech API, localStorage, Node built-in test runner, GitHub Pages Actions.

**Spec:** `docs/superpowers/specs/2026-08-31-relational-four-stream-nback-design.md`

## Global Constraints
- No backend, accounts, analytics, or network requirement.
- 2D grid is 3x3; 3D grid is 3x3x3.
- Comparison direction is always `N-back = relation(current)`.
- Relation prompts change continuously; immediate prompt repetition is avoided where possible.
- Shape bank stops at six sides.
- Relation semantic identity is distinct from glyph identity; every relation has multiple variants.
- The project must run from VS Code Live Server and GitHub Pages.

---

### Task 1: Pure relation algebra
**Files:** Create `tests/relations.test.js`, `src/constants.js`, `src/relations.js`.
**Interfaces:** Produces `positionMatches`, `numberMatches`, `shapeMatches`, `relationMatches`, `valid*Prompts`.
- [x] Write failing tests for comparison direction, offsets, shape ordering, 3D directions, inverses and families.
- [x] Run tests and verify missing-module failure.
- [x] Implement minimal pure functions.
- [x] Run tests and verify green.

### Task 2: Trial generator
**Files:** Create `tests/trialGenerator.test.js`, `src/symbols.js`, `src/trialGenerator.js`.
**Interfaces:** Produces `createTrialSequence(config, rng)` and symbol-library lookups.
- [x] Write failing tests proving warmup length, per-trial prompt changes, valid offsets, target truth, and absence of accidental matches.
- [x] Run and verify red.
- [x] Implement constrained target/non-target generation with deterministic RNG injection.
- [x] Run and verify green.

### Task 3: Session scoring
**Files:** Create `tests/session.test.js`, `src/session.js`, `src/storage.js`.
**Interfaces:** Produces `createScoreboard`, `scoreTrial`, `summarizeScoreboard`, storage helpers.
- [x] Write failing tests for HIT/MISS/FA/CR and combined accuracy.
- [x] Run and verify red.
- [x] Implement scoring and browser-safe persistence wrappers.
- [x] Run and verify green.

### Task 4: 3D projection
**Files:** Create `tests/projection.test.js`, `src/projection.js`, `src/renderers.js`.
**Interfaces:** Produces `rotatePoint`, `projectPoint`, display renderers.
- [x] Write failing tests for identity rotation and depth scaling.
- [x] Run and verify red.
- [x] Implement projection math and renderers.
- [x] Run and verify green.

### Task 5: Browser UI and Wiki
**Files:** Create `tests/static-ui.test.js`, `index.html`, `styles.css`, `src/audio.js`, `src/wiki.js`, `src/app.js`, `assets/favicon.svg`.
- [x] Write failing static smoke tests for required views, controls and four response buttons.
- [x] Run and verify red.
- [x] Implement setup/game/results/wiki UI, keyboard controls, timing loop, feedback, responsive styles, sound playback and rotating/static render paths.
- [x] Run and verify green.

### Task 6: Repository packaging
**Files:** Create `README.md`, `LICENSE`, `package.json`, `.gitignore`, `.github/workflows/pages.yml`; copy specification PDF to `docs/Relational_4_Stream_NBack_Specification.pdf`.
- [x] Add repository metadata and no-build GitHub Pages workflow.
- [x] Run full tests.
- [x] Serve locally and curl the app entry point.
- [x] Render/verify the bundled PDF.
- [x] Zip the complete repository excluding temporary artifacts.

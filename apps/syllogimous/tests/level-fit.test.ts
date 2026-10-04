/**
 * Is each mode the right difficulty for the player it is served to?
 *
 * Asked after a Partial Isomorphism item came up at twenty-five statements:
 * *"can you build some test to verify whether the difficulty and premise count
 * of all the new modes is appropriate to the players level."*
 *
 * Every other suite checks a mode against itself — its rungs show, its answer
 * is unique, more premises cost more. Nothing checked a mode against the
 * *player*: the person who has just unlocked it, at the level that unlocked it,
 * being handed the first item the progression chooses. That is a property of
 * four tables written at different times — `MODE_SCALE`'s weights,
 * `QUESTION_TYPE_SETTING_PARAMS`' premise floors, `TIERS_MATRIX`'s rows and
 * `TIER_UNLOCK_LEVELS` — and none of them can see the others.
 *
 * So this plays the part of that player. For every mode the tier ramp can
 * unlock it takes the unlock level as the player's ability, opens the mode the
 * way the app does (the cross-mode prior's spread, the caution cap of someone
 * with plenty of answers, the 80% target), lets the real `chooseConfig` pick
 * the item, then builds that item with the real generator and reads it. Four
 * properties have to hold:
 *
 * 1. **A mode opens within reach.** Its first item is no more than
 *    `OPEN_ABOVE` levels harder than the item the player is aimed at.
 * 2. **A mode can grow to meet its players.** Everything it offers at once —
 *    every rung, every premise it allows — reaches within `OPEN_ABOVE` of that
 *    same aim. Otherwise the only thing left to make it harder is the clock.
 * 3. **The reading is in proportion to the price.** Characters to read per
 *    level of difficulty is within `READ_FACTOR` times the median across modes.
 *    A mode far above it is charging for one premise and printing several.
 * 4. **Difficulty rises with the player**, never falls.
 *
 * Untimed throughout. The clock only ever *adds* difficulty, so it cannot
 * rescue an item that opens too hard, and leaning on it to make a mode hard
 * enough is the failure property 2 exists to catch.
 */

import { assert, seeded, test } from "./harness";
import { BUILD } from "./modes";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService, lengthCapFor } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { ORDERED_QUESTION_TYPES, TIERS_MATRIX } from "../src/app/syllogimous/constants/game.constants";
import { TIER_UNLOCK_LEVELS } from "../src/app/syllogimous/utils/tier.utils";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { dialsFor, ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import {
    ConfigChoice, DEFAULT_ABILITY, cautionPenalty, chooseConfig, guessRateForRungs, levelOf,
    pCorrect, targetLevel,
} from "../src/app/syllogimous/utils/ability.utils";

const cfg = DEFAULT_ABILITY;

/**
 * How far above the aim a first item may open, in levels.
 *
 * The aim is the 80% point. At the model's slope an item a level and a half
 * above it is answered about two times in three on true/false — noticeably
 * hard, still learnable. Past that the first few items of a new mode are
 * mostly failed, and the posterior spends them dragging the mode back down.
 */
const OPEN_ABOVE = 1.5;

/** Characters per level, as a multiple of the median across modes. */
const READ_FACTOR = 2.5;

/** The spread a mode opens with: `priorForNewMode`'s `crossModeSd`. */
const NEW_MODE_SD = cfg.crossModeSd;

/** Answers given anywhere — enough that the caution cap is fully in force. */
const SEASONED = 1000;

/** The row of `TIERS_MATRIX` that first opens a mode, or null if none does. */
function unlockRow(type: EnumQuestionType): number | null {
    const col = ORDERED_QUESTION_TYPES.indexOf(type);
    const rows = Object.keys(TIERS_MATRIX).map(Number).sort((a, b) => a - b);
    const row = rows.find(r => (TIERS_MATRIX as Record<number, number[]>)[r][col] === 1);
    return row ?? null;
}

/** What `ProgressionService.configFor` chooses, untimed, for this estimate. */
function serve(type: EnumQuestionType, level: number, sd: number) {
    const params = QUESTION_TYPE_SETTING_PARAMS[type];
    const ladder = ladderFor(type);
    const aim = { level: level - cautionPenalty(sd, cfg, SEASONED), sd } as Parameters<typeof targetLevel>[0];
    const opts = {
        minPremises: params.minNumOfPremises,
        maxPremises: lengthCapFor(type, params),
        ladder, target: 0, structureBefore: 5, untimed: true, dials: dialsFor(type),
    };
    // Aimed twice, as the service does: the rungs settle the answer mode.
    const first = chooseConfig(type, { ...opts, target: targetLevel(aim, 0.8, 0.5, cfg) }, cfg);
    const guess = guessRateForRungs(ladder.slice(0, first.rungs));
    const target = targetLevel(aim, 0.8, guess, cfg);
    const choice = guess === 0.5 ? first : chooseConfig(type, { ...opts, target }, cfg);
    return { choice, target, guess, claimed: ladder.slice(0, choice.rungs) };
}

/** The hardest item a mode can be, on structure alone. */
function hardest(type: EnumQuestionType): number {
    const params = QUESTION_TYPE_SETTING_PARAMS[type];
    return serve(type, 1000, 0).choice.level
        // `serve` respects the length cap; the far end of it is what is wanted.
        || levelOf({ type, premises: lengthCapFor(type, params), rungs: ladderFor(type), seconds: null });
}

/** A generator context that grants exactly the levers the choice claimed. */
function ctxFor(claimed: string[], dials: Record<string, number>): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    settings.setEnable("meta", true);
    settings.setEnable("negation", true);
    const has = (_t: string, r: string) => claimed.includes(r);
    const dial = (_t: string, n: string) => dials[n] ?? 0;
    const ctx: GeneratorContext = {
        settings, logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: has, depthBonusFor: () => 0, dialFor: dial, mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off", hasRung: has, dialFor: dial, mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const plain = (html: string) => String(html ?? "")
    .replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

interface Fit {
    type: EnumQuestionType;
    unlock: number;
    choice: ConfigChoice;
    target: number;
    guess: number;
    hardest: number;
    /** Mean over the items built: statements printed, and characters read. */
    statements: number;
    chars: number;
}

/** The first item of every unlockable mode, built and read. Computed once. */
const FITS: Fit[] = seeded(20261004, () => {
    const out: Fit[] = [];
    for (const type of ORDERED_QUESTION_TYPES) {
        const row = unlockRow(type);
        if (row == null || !BUILD[type]) continue;
        const unlock = TIER_UNLOCK_LEVELS[row];
        const { choice, target, guess, claimed } = serve(type, unlock, NEW_MODE_SD);

        let statements = 0, chars = 0, built = 0;
        for (let k = 0; k < 12; k++) {
            let q;
            try { q = BUILD[type](ctxFor(claimed, choice.dials), choice.premises); } catch { continue; }
            /* The premises, not the setup: the setup is the mode's standing
               instructions, the same on every item and skimmed after the first
               few, and counting it charged a mode for explaining itself. */
            const text = [
                ...q.premises,
                ...(q.series ?? []).flatMap(s => s.premises ?? []),
            ].map(plain).join(" ");
            statements += q.premises.length;
            chars += text.length;
            built++;
        }
        if (!built) continue;
        out.push({
            type, unlock, choice, target, guess, hardest: hardest(type),
            statements: statements / built, chars: chars / built,
        });
    }
    return out;
});

const pct = (x: number) => Math.round(x * 100) + "%";

/** What the player would score on it, at their real level rather than the aim. */
const success = (f: Fit, level: number) => pct(pCorrect(cfg, f.unlock, level, f.guess));

test("there is a mode to check, and every one of them was built", () => {
    assert(FITS.length >= 40, `only ${FITS.length} unlockable modes were built — this checks too little`);
});

/*
 * What each property finds, as mode -> the line that says why.
 *
 * Computed once and shared by the checks and the ledger below.
 */
const OPENS_HARD = new Map(FITS
    /* The modes a new player starts with are exempt: they are aimed below the
       easiest item the app has, and there is nothing easier to open with. */
    .filter(f => f.unlock > TIER_UNLOCK_LEVELS[0] && f.choice.level - f.target > OPEN_ABOVE)
    .map(f => [f.type as string, `unlocks at level ${f.unlock}, opens at ${f.choice.premises} premises`
        + ` = level ${f.choice.level.toFixed(1)}, ${(f.choice.level - f.target).toFixed(1)} above the`
        + ` aim (${f.target.toFixed(1)}) — about ${success(f, f.choice.level)} right where`
        + ` ${success(f, f.target)} was meant`]));

const STUNTED = new Map(FITS
    .filter(f => f.hardest < f.target - OPEN_ABOVE)
    .map(f => [f.type as string, `unlocks at level ${f.unlock} (aim ${f.target.toFixed(1)}), but at its`
        + ` hardest — every premise and rung it allows — it is level ${f.hardest.toFixed(1)}`]));

const WORDY = (() => {
    const perLevel = FITS.map(f => f.chars / Math.max(1, f.choice.level));
    const median = [...perLevel].sort((a, b) => a - b)[Math.floor(perLevel.length / 2)];
    return new Map(FITS
        .map((f, i) => ({ f, r: perLevel[i] }))
        .filter(({ r }) => r > median * READ_FACTOR)
        .map(({ f, r }) => [f.type as string, `${Math.round(f.chars)} characters over`
            + ` ${f.statements.toFixed(0)} statements at ${f.choice.premises} premises`
            + ` (level ${f.choice.level.toFixed(1)}) — ${Math.round(r)} a level,`
            + ` ${(r / median).toFixed(1)}x the median ${Math.round(median)}`]));
})();

/**
 * The modes these checks found when they were written, and have not been
 * fixed yet.
 *
 * A ratchet, not an amnesty. Each is a design decision — lower the premise
 * floor, move the unlock, or re-price the weight — rather than a defect with
 * one right repair, so they are listed here and taken off one at a time. A
 * mode not on a list that starts failing fails the suite; so does a mode on a
 * list that has stopped failing, so the list cannot outlive the problem.
 */
const KNOWN: Record<string, string[]> = {
    "opens harder than its player": [],
    "cannot grow to its players": [],
    /*
     * Infer the Relation and Analogy Completion are long because composed-space
     * wording is ("same longitude, same latitude, below relative to"), not
     * because the item is bigger than its price: three or four placements and a
     * few claims. Shortening that wording is a change to every composed space at
     * once. Pricing either up far enough opens it too hard instead.
     *
     * Axis Maps is different: its load is the worked examples its cheap rungs
     * add — four lines of composed changes at level 7. A higher weight barely
     * moves it (3.0 still reads at over three times the median), so it wants a
     * look at what those rungs cost rather than at the weight.
     */
    "prints more than it is priced for": ["Infer the Relation", "Analogy Completion", "Axis Maps"],
};

function ratchet(name: string, found: Map<string, string>, advice: string) {
    const known = new Set(KNOWN[name]);
    const fresh = [...found].filter(([t]) => !known.has(t)).map(([t, why]) => `${t}: ${why}`);
    assert(!fresh.length,
        `${fresh.length} mode(s) newly ${name}:\n  ${fresh.join("\n  ")}\n  ${advice}`);
    const fixed = [...known].filter(t => !found.has(t));
    assert(!fixed.length,
        `${fixed.join(", ")} no longer ${name} — take ${fixed.length > 1 ? "them" : "it"} off KNOWN`);
}

test("a mode opens within reach of the player who unlocks it", () => {
    ratchet("opens harder than its player", OPENS_HARD,
        "Unlock it later, lower its premise floor, or price it lower in MODE_SCALE.");
});

test("a mode can grow to meet the players it is unlocked for", () => {
    ratchet("cannot grow to its players", STUNTED,
        "Only a tighter clock can close the gap. Unlock it earlier, or let it take more premises.");
});

test("the reading in a mode's first item is in proportion to its price", () => {
    ratchet("prints more than it is priced for", WORDY,
        "Either the item is longer than a premise count says, or MODE_SCALE underprices it.");
});

test("difficulty rises with the player, in every mode", () => {
    const faults: string[] = [];
    for (const f of FITS) {
        let last = -Infinity, lastAt = 0;
        for (let level = f.unlock; level <= 26; level++) {
            const now = serve(f.type, level, 0.5).choice.level;
            if (now < last - 1e-9) {
                faults.push(`${f.type}: level ${lastAt} is served ${last.toFixed(2)},`
                    + ` level ${level} only ${now.toFixed(2)}`);
                break;
            }
            last = now; lastAt = level;
        }
    }
    assert(!faults.length, "a stronger player is served an easier item:\n  " + faults.join("\n  "));
});

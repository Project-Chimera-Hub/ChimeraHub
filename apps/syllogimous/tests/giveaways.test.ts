/**
 * Giveaways, swept across every mode.
 *
 * Reported one mode at a time, and each time the same few faults: Pivot
 * Transforms printed its answer as a premise; Missing Premise asked about a
 * name no premise mentioned and offered one nobody had heard of; it stated one
 * fact twice. Each was fixed and tested where it was found, and each is a
 * fault any generator can have. So this builds items of every mode on the menu
 * — at the bottom of its range and four counts up, with none, half and all of
 * its ladder — and checks them for the faults, from the card's text alone.
 *
 * None of these is about whether an item is hard. They are about whether it
 * can be answered without doing what it asks.
 */

import { assert, seeded, test } from "./harness";
import { BUILD } from "./modes";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { extractSubjects } from "../src/app/syllogimous/utils/question.utils";

const plain = (h: unknown) => String(h ?? "")
    .replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

function ctxFor(claimed: string[]): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    settings.setEnable("meta", true);
    settings.setEnable("negation", true);
    const has = (_t: string, r: string) => claimed.includes(r);
    const ctx: GeneratorContext = {
        settings, logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: has, depthBonusFor: () => 0, dialFor: () => 1, mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off", hasRung: has, dialFor: () => 1, mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

interface Built { type: EnumQuestionType; q: Question; }

/** Every mode on the menu, across its range and its ladder. Built once. */
const ITEMS: Built[] = seeded(20261006, () => {
    const out: Built[] = [];
    for (const type of Object.values(EnumQuestionType)) {
        const range = QUESTION_TYPE_SETTING_PARAMS[type];
        if (!BUILD[type] || !range.enabled) continue;
        const ladder = ladderFor(type);
        for (const cut of new Set([0, Math.ceil(ladder.length / 2), ladder.length])) {
            const ctx = ctxFor(ladder.slice(0, cut));
            const top = Math.min(range.maxNumOfPremises, range.minNumOfPremises + 4);
            for (let n = range.minNumOfPremises; n <= top; n++) {
                for (let k = 0; k < 8; k++) {
                    try { out.push({ type, q: BUILD[type](ctx, n) }); } catch { /* undrawable */ }
                }
            }
        }
    }
    return out;
});

/** Faults grouped by mode, one example each, so a report is readable. */
function report(faults: Array<[string, string]>): string {
    const by = new Map<string, { n: number; ex: string }>();
    for (const [type, ex] of faults) {
        const e = by.get(type) ?? { n: 0, ex };
        e.n++;
        by.set(type, e);
    }
    return [...by].map(([t, e]) => `${t} (${e.n}x): ${e.ex.slice(0, 160)}`).join("\n  ");
}

const conclusions = (q: Question) =>
    (Array.isArray(q.conclusion) ? q.conclusion : [q.conclusion]).filter(c => plain(c));

/** Names on the card that a reader is told about: premises, setup, series. */
const introduced = (q: Question) => new Set([
    ...q.premises, ...(q.setup ?? []),
    ...(q.series ?? []).flatMap(s => [s.text, ...(s.premises ?? [])]),
].flatMap(l => extractSubjects(String(l))));

/** A choice that is a claim about two or more named things, not a bare name. */
const isStatement = (c: string) => extractSubjects(c).length >= 2;

test("the sweep builds every mode on the menu", () => {
    const modes = new Set(ITEMS.map(b => b.type));
    const wanted = Object.values(EnumQuestionType)
        .filter(t => BUILD[t] && QUESTION_TYPE_SETTING_PARAMS[t].enabled);
    const missing = wanted.filter(t => !modes.has(t));
    assert(!missing.length, `no item could be built for: ${missing.join(", ")}`);
});

/*
 * A sequence of moves can repeat a move — two quarter turns in a row are two
 * premises that read the same and mean different things.
 */
const SEQUENCES = new Set<string>([EnumQuestionType.ShapeRotation]);

test("no premise is printed twice", () => {
    const faults: Array<[string, string]> = [];
    for (const { type, q } of ITEMS) {
        if (SEQUENCES.has(type)) continue;
        const seen = new Set<string>();
        for (const line of q.premises.map(plain)) {
            if (line && seen.has(line)) faults.push([type, line]);
            seen.add(line);
        }
    }
    assert(!faults.length, "a premise is stated twice:\n  " + report(faults));
});

test("a true-or-false conclusion is never one of the premises", () => {
    const faults: Array<[string, string]> = [];
    for (const { type, q } of ITEMS) {
        if (q.answerMode !== "boolean") continue;
        const premises = new Set(q.premises.map(plain));
        for (const c of conclusions(q)) {
            if (premises.has(plain(c))) faults.push([type, plain(c)]);
        }
    }
    assert(!faults.length, "the conclusion is printed as a premise:\n  " + report(faults));
});

/*
 * Some modes' options *are* their premises — Minimal Premises asks which of
 * the card's own statements did the settling — so an answer among the premises
 * is only a giveaway when the wrong options are not.
 */
test("an answer is not printed among the premises unless every option is", () => {
    const faults: Array<[string, string]> = [];
    for (const { type, q } of ITEMS) {
        if (q.answerMode !== "choice" && q.answerMode !== "select") continue;
        const premises = new Set(q.premises.map(plain));
        const printed = q.choices.map(c => isStatement(c) && premises.has(plain(c)));
        const right = q.answerMode === "choice" ? [q.correctChoice] : q.selectAnswer;
        const rightPrinted = right.some(i => printed[i]);
        const wrongUnprinted = q.choices.some((_, i) => !right.includes(i) && !printed[i]);
        if (rightPrinted && wrongUnprinted) {
            faults.push([type, plain(q.choices[right.find(i => printed[i])!])]);
        }
    }
    assert(!faults.length, "the answer is a premise and the other options are not:\n  "
        + report(faults));
});

/*
 * Where a stranger is the design: Graph Matching's conclusion describes a
 * second web under new names, which is the comparison it asks for; Relational
 * Web is drawn, so its names are on the picture rather than in sentences.
 */
const RENAMED = new Set<string>([EnumQuestionType.GraphMatching, EnumQuestionType.RelationalWeb]);

test("no option or conclusion names someone the card never introduces", () => {
    const faults: Array<[string, string]> = [];
    for (const { type, q } of ITEMS) {
        if (RENAMED.has(type)) continue;
        const known = introduced(q);
        for (const c of [...q.choices, ...conclusions(q)]) {
            const strangers = extractSubjects(String(c)).filter(w => !known.has(w));
            if (strangers.length) faults.push([type, `${strangers.join(", ")} in "${plain(c)}"`]);
        }
    }
    assert(!faults.length, "a name appears in an option or conclusion and nowhere before it — "
        + "dismissed, or chosen, on sight:\n  " + report(faults));
});

test("no option is offered twice", () => {
    const faults: Array<[string, string]> = [];
    for (const { type, q } of ITEMS) {
        const opts = q.choices.map(plain).filter(Boolean);
        if (new Set(opts).size !== opts.length) faults.push([type, opts.join(" | ")]);
    }
    assert(!faults.length, "the same option appears twice:\n  " + report(faults));
});

/* ------------------------------------------------------------------ *
 * Answers a reader can guess without reading                          *
 * ------------------------------------------------------------------ */

/*
 * The other kind of giveaway: not a fault on one card but a lean across many.
 * Measured on today's generators, five modes had one — Graph Matching came out
 * true 85% of the time (two and three premises, every time); Knights and
 * Knaves false 63%; Oblique Basis's right answer was the shorter option 93%,
 * Context Shifts' 68%, Missing Premise's 65%; Minimal Premises' answer was two
 * premises 91% of the time. Each is a strategy that beats the item without
 * reading it.
 *
 * The bands are wide on purpose: a mode is built a hundred-odd times here, and
 * the point is to catch a lean a player would feel, not to test randomness.
 */

/** Modes whose answer size is stated on the card, so it is not a guess. */
const SIZE_STATED = new Set<string>([
    EnumQuestionType.PartialIsomorphism,   // "select both of them"
    EnumQuestionType.CommonSubsystem,      // the sub-system's size is given
]);

/*
 * A sample of its own, larger than the sweep's: a lean of fifteen points is
 * invisible in forty items and plain in three hundred. Spread over the
 * same counts and ladder cuts, round-robin, so every mode gets the same number.
 */
const PER_MODE = 320;
const BALANCE: Map<string, Question[]> = seeded(20261008, () => {
    const out = new Map<string, Question[]>();
    for (const type of Object.values(EnumQuestionType)) {
        const range = QUESTION_TYPE_SETTING_PARAMS[type];
        if (!BUILD[type] || !range.enabled) continue;
        const ladder = ladderFor(type);
        const cuts = [...new Set([0, Math.ceil(ladder.length / 2), ladder.length])];
        const top = Math.min(range.maxNumOfPremises, range.minNumOfPremises + 4);
        const configs = cuts.flatMap(cut => Array.from(
            { length: top - range.minNumOfPremises + 1 },
            (_, i) => ({ ctx: ctxFor(ladder.slice(0, cut)), n: range.minNumOfPremises + i })));
        const qs: Question[] = [];
        for (let k = 0; qs.length < PER_MODE && k < PER_MODE * 3; k++) {
            const { ctx, n } = configs[k % configs.length];
            try { qs.push(BUILD[type](ctx, n)); } catch { /* undrawable */ }
        }
        out.set(type, qs);
    }
    return out;
});
const byMode = () => BALANCE;

const share = (part: number, whole: number) => Math.round(part / whole * 100);

/**
 * Off-centre by more than chance would put it: ten points, or three
 * standard errors where the sample is too small for ten to mean anything.
 */
const leans = (pct: number, n: number, centre = 50) =>
    Math.abs(pct - centre) > Math.max(10, 300 * Math.sqrt(0.25 / n));

test("true and false come up about equally often", () => {
    const faults: string[] = [];
    for (const [type, qs] of byMode()) {
        const judged = qs.filter(q => q.answerMode === "boolean");
        if (judged.length < 30) continue;
        const t = share(judged.filter(q => q.isValid).length, judged.length);
        if (leans(t, judged.length)) faults.push(`${type}: true ${t}% of ${judged.length}`);
    }
    assert(!faults.length, "always answering one way beats these:\n  " + faults.join("\n  "));
});

test("in a choice of two, neither the place nor the length gives the answer", () => {
    const faults: string[] = [];
    for (const [type, qs] of byMode()) {
        const pairs = qs.filter(q => q.answerMode === "choice" && q.choices.length === 2);
        if (pairs.length < 30) continue;
        const first = share(pairs.filter(q => q.correctChoice === 0).length, pairs.length);
        if (leans(first, pairs.length)) faults.push(`${type}: the first option is right ${first}%`);

        const sized = pairs.map(q => q.choices.map(c => plain(c).length))
            .map((l, i) => ({ l, right: pairs[i].correctChoice }))
            .filter(({ l }) => l[0] !== l[1]);
        if (sized.length >= 30) {
            const longer = share(sized.filter(({ l, right }) => l[right] > l[1 - right]).length, sized.length);
            if (leans(longer, sized.length)) {
                faults.push(`${type}: the ${longer > 50 ? "longer" : "shorter"} option is right `
                    + `${Math.max(longer, 100 - longer)}% of ${sized.length}`);
            }
        }
    }
    assert(!faults.length, "picking by position or by length beats these:\n  " + faults.join("\n  "));
});

test("no one size of selection is nearly always the answer", () => {
    const faults: string[] = [];
    for (const [type, qs] of byMode()) {
        if (SIZE_STATED.has(type)) continue;
        const picks = qs.filter(q => q.answerMode === "select");
        if (picks.length < 30) continue;
        const sizes = new Map<number, number>();
        for (const q of picks) sizes.set(q.selectAnswer.length, (sizes.get(q.selectAnswer.length) ?? 0) + 1);
        const [size, count] = [...sizes].sort((a, b) => b[1] - a[1])[0];
        if (share(count, picks.length) > 85) {
            faults.push(`${type}: ${size} selected in ${share(count, picks.length)}% of ${picks.length}`);
        }
    }
    assert(!faults.length, "selecting that many, whichever they are, is nearly always right:\n  "
        + faults.join("\n  "));
});

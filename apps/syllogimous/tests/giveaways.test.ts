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

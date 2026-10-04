/**
 * How much of the card the answers may take.
 *
 * The card is a flex column — header, body, footer — and the footer sizes to
 * whatever the mode answers with while the body takes what is left. That was
 * right when a footer held True and False. A selection offers one row per
 * relation, and `Interval Algebra` offers thirteen: measured in a real browser
 * on the built app at 420 x 880, the footer came to **619px, seventy per cent
 * of the card**, leaving the premises 259px in which to show 417px of
 * statements.
 *
 * The item still worked in the sense that every control was reachable. It had
 * simply stopped being answerable: the reader was choosing between eight
 * relations with most of the statements they are about scrolled out of sight,
 * and on a wider window the setup line was cut off mid-sentence. The options
 * had won the argument with the question.
 *
 * ── Why this is a test about CSS text ──
 *
 * The suite runs under node and cannot measure a layout, so this checks the two
 * rules that make the guarantee rather than the guarantee itself. That is worth
 * having anyway: the fix is one declaration, it is invisible in every mode whose
 * footer already fits, and nothing else in the suite would notice it going.
 *
 * The numbers came from the browser. This is what keeps them true.
 */

import { readFileSync } from "fs";
import { assert, test } from "./harness";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { ORDERED_QUESTION_TYPES } from "../src/app/syllogimous/constants/game.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { BUILD } from "./modes";
import { seeded } from "./harness";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";

const CARD_SCSS = readFileSync(
    "src/app/syllogimous/components/card/card.component.scss", "utf8");

/** The stylesheet with its comments taken out — a rule, not a mention of one. */
const declared = CARD_SCSS.replace(/\/\*[\s\S]*?\*\//g, "");

test("the footer is capped, so the answers cannot crowd out the question", () => {
    const footer = declared.slice(declared.indexOf(".playcard-footer"));
    const cap = footer.match(/max-block-size:\s*(\d+)%/);

    assert(!!cap,
        "nothing caps `.playcard-footer`, so a mode with thirteen options takes "
        + "seventy per cent of the card and the premises get what is left");

    const percent = Number(cap![1]);
    assert(percent >= 40 && percent <= 60,
        `the footer may take ${percent}% of the card — under 40 leaves no room for `
        + "a long option list, over 60 is the crowding this cap exists to stop");
});

test("and it scrolls inside the cap rather than clipping", () => {
    const footer = declared.slice(declared.indexOf(".playcard-footer"));
    const block = footer.slice(0, footer.indexOf("}"));

    assert(/overflow-y:\s*auto/.test(block),
        "the footer is capped without being scrollable, which is worse than "
        + "uncapped: the options past the cap cannot be reached at all");
});

test("the body may give way to it", () => {
    assert(/\.playcard\s*>\s*\.card-body\s*\{[^}]*min-block-size:\s*0/.test(declared),
        "the card body does not state that it may shrink — a flex item's "
        + "`min-height` is its content, and the cap above relies on it giving way");
});

/**
 * And no mode offers more than four.
 *
 * Asked for directly: "the count of options in all modes to 4 or less". Nine
 * modes offered more — a selection over Allen's thirteen relations, RCC8's
 * eight, every entity of two systems, every premise of the card — and the
 * footer cap above was measured against thirteen. Every mode is built at every
 * premise count it allows, with and without its whole ladder, and every menu on
 * it is counted: choices, picture options, and the questions of a series.
 */
const MAX_OPTIONS = 4;

test("no mode offers more than four options", () => {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;

    const ctxWith = (rungs: string[]): GeneratorContext => {
        const has = (_t: string, r: string) => rungs.includes(r);
        const ctx: GeneratorContext = {
            settings,
            logger: new Logger("error", false),
            settingsOverrideService: {
                linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
                spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
            } as unknown as SettingsOverrideService,
            progressionService: {
                hasRung: has, depthBonusFor: () => 0, dialFor: () => 1,
                mergeTarget: () => null,
            } as unknown as ProgressionService,
            forceConstruction: "off",
            hasRung: has,
            dialFor: () => 1,
            mergeTarget: () => null,
            random: (n?: number) => createDistinction(ctx, n ?? 2),
        };
        return ctx;
    };

    const faults: string[] = [];
    seeded(20261801, () => {
        for (const type of ORDERED_QUESTION_TYPES) {
            if (!BUILD[type]) continue;
            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            for (const rungs of [[], ladderFor(type)]) {
                const ctx = ctxWith(rungs);
                for (let n = params.minNumOfPremises; n <= params.maxNumOfPremises; n++) {
                    for (let k = 0; k < 3; k++) {
                        let q;
                        try { q = BUILD[type](ctx, n); } catch { continue; }
                        const widest = Math.max(q.choices?.length ?? 0, q.choiceGrids?.length ?? 0,
                            ...(q.series ?? []).map(c => c.choices?.length ?? 0));
                        if (widest > MAX_OPTIONS) faults.push(`${type} at ${n} premises: ${widest} options`);
                    }
                }
            }
        }
    });

    assert(!faults.length, "a menu runs past four:\n  " + [...new Set(faults)].slice(0, 20).join("\n  "));
});

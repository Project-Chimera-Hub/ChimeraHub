/**
 * Partial Analogy — the correspondence that keeps the most relations.
 *
 * Isomorph's guide: *"The two systems agree in most of their relations, not all,
 * and every entity has a colour. Under the correspondence that keeps the most
 * relations, what does the named entity correspond to? Colour is not a relation:
 * the entity that shares its colour is a lure."*
 *
 * Structure Match asks whether two systems are the same, which has a yes or a no.
 * This asks what to do when they are *nearly* the same, which has no yes — the
 * systems disagree somewhere and the answer is the lining-up that survives the
 * most of them. That is a different skill and the more useful one: two things
 * worth comparing are rarely isomorphic, and the question is almost always which
 * correspondence to prefer rather than whether one exists.
 *
 * ── No lure ──
 *
 * Isomorph adds a colour per entity as a lure, and this mode had one: a complete
 * "is the same kind as" pairing across the two systems. It did not work as a
 * lure. The wrong option was always the asked entity's kind partner, so "never
 * the one of the same kind" answered every item without reading an arrow — and
 * the pairing was a line per entity, a third of the card. The rival now is the
 * runner-up lining-up, which can only be told from the best by counting.
 *
 * ── What makes an item well-formed ──
 *
 * The best correspondence is found by trying every one, and the item is kept only
 * if exactly one achieves the maximum — otherwise "the correspondence that keeps
 * the most" names several and the card marks one of them. The systems must
 * disagree somewhere, or the analogy is total and this is Structure Match.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { EDGE_WORDS, hi, rel, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import { permutations } from "../utils/relation-systems.utils";
import {
    Web, cloneWeb, edgesOf, permuteWeb, randomPermutation, randomWeb,
} from "../utils/web.utils";
import { GeneratorContext } from "./context";

const arrow = (a: string, b: string) => `${subj(a)} ${rel(EDGE_WORDS["→"])} ${subj(b)}`;

/** A group named by its members, which is how the card says who is in which. */
const groupText = (names: string[]) =>
    `${names.slice(0, -1).map(subj).join(", ")} and ${subj(names[names.length - 1])}`;

const systemLines = (w: Web, names: string[]) =>
    edgesOf(w).map(([i, j]) => arrow(names[i], names[j]));

/**
 * How many of `a`'s arrows survive being read through `perm` into `b`.
 *
 * Counted over every ordered pair rather than over the arrows, so an arrow `b`
 * has where `a` has none counts against the correspondence too. Counting only
 * `a`'s arrows would let a correspondence that mapped everything into a densely
 * connected corner of `b` score perfectly.
 */
function agreement(a: Web, b: Web, perm: number[]): number {
    let kept = 0;
    for (let i = 0; i < a.n; i++) {
        for (let j = 0; j < a.n; j++) {
            if (i === j) continue;
            if (a.adj[i][j] === b.adj[perm[i]][perm[j]]) kept++;
        }
    }
    return kept;
}

/** The correspondences that keep the most, and how much that is. */
function bestCorrespondences(a: Web, b: Web): { best: number; perms: number[][] } {
    let best = -1;
    let perms: number[][] = [];
    for (const perm of permutations(a.n)) {
        const kept = agreement(a, b, perm);
        if (kept > best) { best = kept; perms = [perm]; } else if (kept === best) perms.push(perm);
    }
    return { best, perms };
}

/**
 * How many entities a side.
 *
 * Five was fixed, and the note beside it said four leaves too few
 * correspondences for exactly one of them to be best. Measured over twenty
 * thousand draws, that is not so: four a side yields a usable item once every
 * six draws against five-a-side's once every five, and at the sparsest arrow
 * count four is the *easier* of the two to draw — one in five against one in
 * ten. The rejection loop was never the problem.
 *
 * What five costs is the card. The mode states two systems and then a complete
 * kind pairing, one line per entity, so the size is roughly two lots of arrows
 * plus `n`: at five a side the floor rung printed **sixteen and a half lines**
 * while the ladder said six. A mode whose easiest item is sixteen statements has
 * no bottom step, which is the same thing that was wrong with Odd Analogy's
 * fixed four analogies.
 *
 * So the floor drops to four a side — fourteen lines — and everything above it
 * keeps five. Not lower than four: three leaves six correspondences to choose
 * between, which is few enough that the best one can be found by trying them
 * rather than by reading the structure, and that is the whole task.
 */
const systemSize = (numOfPremises: number) => (numOfPremises <= 6 ? 4 : 5);

export function createPartialAnalogy(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createPartialAnalogy");

    const type = EnumQuestionType.PartialAnalogy;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const n = systemSize(numOfPremises);
    /* Three arrows a side at the floor, from four: with the kind pairing gone
       the card is the two systems and nothing else, and three is still enough
       for one lining-up to keep strictly more than every other — which the
       draw checks rather than assumes. */
    const wanted = Math.max(3, Math.min(n * (n - 1) - 2, numOfPremises - 2));

    for (let attempt = 0; attempt < 300; attempt++) {
        const words = getRandomSymbols(settings, 2 * n);
        if (new Set(words).size !== 2 * n) continue;
        const left = words.slice(0, n);
        const right = words.slice(n);

        const a = randomWeb(n, 0.3);
        if (edgesOf(a).length < wanted || edgesOf(a).length > wanted + 1) continue;
        /* Nobody unconnected: an entity with no arrow appears in no arrow premise
           and its correspondence is decided by nothing. */
        const touched = (w: Web, v: number) => w.adj[v].some(Boolean) || w.adj.some(r => r[v]);
        if (![...Array(n).keys()].every(v => touched(a, v))) continue;

        /*
         * The second system is the first re-labelled and then disagreed with.
         *
         * One or two arrows changed, which is what "agree in most of their
         * relations, not all" means. Nought would make the analogy total; more
         * than two and the best correspondence stops being better than its
         * rivals by enough to be the only one.
         */
        const truth = randomPermutation(n);
        const b = permuteWeb(a, truth);
        const flips = 1 + Math.floor(Math.random() * 2);
        for (let k = 0; k < flips; k++) {
            const i = Math.floor(Math.random() * n);
            let j = Math.floor(Math.random() * n);
            if (i === j) j = (j + 1) % n;
            b.adj[i][j] = !b.adj[i][j];
        }
        if (![...Array(n).keys()].every(v => touched(b, v))) continue;

        const { best, perms } = bestCorrespondences(a, b);
        if (perms.length !== 1) continue;            // "the correspondence that keeps the most"
        if (best === n * (n - 1)) continue;           // then they agree on everything
        const correspondence = perms[0];

        /*
         * The other option is where the *runner-up* sends the asked entity: the
         * best lining-up among those that put it somewhere else. A real rival,
         * one that keeps nearly as much, so it is ruled out by counting what it
         * loses and not by anything about the name.
         *
         * It used to be the asked entity's partner in a stated "same kind"
         * pairing, there as a lure — and always the wrong answer, so "never
         * the one of the same kind" settled every item without looking at an
         * arrow. That pairing was also a line per entity, a third of the card.
         * Both went together.
         */
        const asked = Math.floor(Math.random() * n);
        let rival: number[] | null = null;
        let rivalKept = -1;
        for (const perm of permutations(n)) {
            if (perm[asked] === correspondence[asked]) continue;
            const kept = agreement(a, b, perm);
            if (kept > rivalKept) { rivalKept = kept; rival = perm; }
        }
        if (!rival) continue;

        const shown = shuffle([
            { word: right[correspondence[asked]], right: true },
            { word: right[rival[asked]], right: false },
        ]);

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            ...orderPremises(systemLines(a, left), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            ...orderPremises(systemLines(b, right), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
        ];
        question.choices = shown.map(c => subj(c.word));
        question.correctChoice = shown.findIndex(c => c.right);
        question.answerMode = "choice";
        question.choicePrompt = `Which one does ${left[asked]} correspond to?`;
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `${groupText(left)} form one system; ${groupText(right)} form another. They `
            + "agree in <b>most</b> of their arrows and not all, so no lining-up of the "
            + "names keeps every one.",
            `Under the correspondence that keeps the ${hi("most")} of them, which entity `
            + `does ${subj(left[asked])} correspond to?`,
        ];

        const total = n * (n - 1);
        question.explanation = [
            `one lining-up of the names keeps ${hi(String(best))} of the ${total} possible `
            + "arrows and disagreements, and no other keeps as many",
            `under it, ${subj(left[asked])} goes to `
            + `${hi(right[correspondence[asked]])}`,
            `the best lining-up that sends it to ${subj(right[rival[asked]])} instead keeps `
            + `${rivalKept}`,
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}

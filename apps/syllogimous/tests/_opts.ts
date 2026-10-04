import { BUILD } from "./modes";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";
function ctxFor(claimed: string[]) {
  const settings = new Settings();
  for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
  settings.setEnable("meta", true); settings.setEnable("negation", true);
  const has = (_: string, r: string) => claimed.includes(r);
  const ctx: any = { settings, logger: new Logger("error", false),
    settingsOverrideService: { linearOverride: () => null, axesFor: () => null, circularAxes: () => 0, spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null },
    progressionService: { hasRung: has, depthBonusFor: () => 0, dialFor: () => 2, mergeTarget: () => null },
    forceConstruction: "off", hasRung: has, dialFor: () => 2, mergeTarget: () => null };
  ctx.random = (n?: number) => createDistinction(ctx, n ?? 2);
  return ctx;
}
for (const type of Object.values(EnumQuestionType)) {
  const r = QUESTION_TYPE_SETTING_PARAMS[type];
  if (!BUILD[type] || !r.enabled) continue;
  const ladder = ladderFor(type);
  let max = 0; const modes = new Set<string>(); let series = 0;
  for (const cut of [0, ladder.length]) for (let n = r.minNumOfPremises; n <= r.maxNumOfPremises; n++) for (let k = 0; k < 6; k++) {
    let q: any; try { q = BUILD[type](ctxFor(ladder.slice(0, cut)), n); } catch { continue; }
    const counts = [q.choices?.length ?? 0, q.choiceGrids?.length ?? 0, ...(q.series ?? []).map((s: any) => s.choices?.length ?? 0)];
    max = Math.max(max, ...counts); if (counts[0] || counts[1]) modes.add(q.answerMode);
  }
  if (max > 4) console.log(type.padEnd(26), "max options", max, [...modes].join(","), `premises ${r.minNumOfPremises}-${r.maxNumOfPremises}`);
}

"use strict";

/*
 * Today's training in minutes, counted off disk.
 *
 *   node gate/count.js <dir-of-snapshots> [YYYY-MM-DD]
 *
 * The gate cannot ask the page how long you trained — a rule enforced by the
 * thing it is a rule about is not a rule. So `firefox-storage.py` lifts every
 * trainer's storage straight out of Firefox's own SQLite, and this runs the
 * archive's adapters over the result. Same adapters, same day boundary, same
 * numbers the archive would show: there is exactly one answer to "what did I do
 * today" in this project, and nothing here is allowed to invent a second.
 *
 * Prints one JSON object: { day, minutes, bySource }.
 */

const fs = require("fs");
const path = require("path");
const { readFile } = require("../apps/archive/js/adapters.js");

const dir = process.argv[2];
const day = process.argv[3] || new Date().toISOString().slice(0, 10);

if (!dir) {
  console.error("usage: node gate/count.js <dir> [day]");
  process.exit(2);
}

const bySource = {};

/* A trainer deployed at three different addresses is one trainer. The scan
   finds Syllogimous on half a dozen origins because that is how many forks of
   it are worth using, and an hour spent on somebody else's deployment is an
   hour trained. Taking the largest rather than the sum: the same session can
   appear under two origins if one is a mirror of the other, and over-counting
   here unlocks a machine that should have stayed locked. */
function offer(source, minutes) {
  if (!(minutes > 0)) return;
  bySource[source] = Math.max(bySource[source] || 0, minutes);
}

let files = [];
try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")); }
catch (e) { /* no scan yet: an empty day, which is the safe direction */ }

for (const name of files) {
  let reading;
  try {
    reading = readFile(fs.readFileSync(path.join(dir, name), "utf8"));
  } catch (e) { continue; }
  if (!reading || reading.error || !reading.minutes) continue;
  offer(reading.source, Number(reading.minutes[day]) || 0);
}

/* The archive is not a source any adapter reports and could not be counted
   here even by accident — but the exclusion is the gate's central promise, so
   it is written down rather than left to be inferred from an absence. */
delete bySource.archive;

let minutes = 0;
for (const s of Object.keys(bySource)) minutes += bySource[s];

process.stdout.write(JSON.stringify({ day, minutes, bySource }));

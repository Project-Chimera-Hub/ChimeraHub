/*
 * Copies the spoken numbers this trainer uses (1 to 19, the widest range it
 * offers) from Relational Integration Training's recordings, so this folder
 * runs on its own:
 *
 *   node apps/listening/tools/voices.mjs   → apps/listening/audio/<voice>.js
 *
 * The recordings are Dark's; see LICENSE.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const FROM = path.join(HERE, "..", "..", "rit", "audio");
const TO = path.join(HERE, "..", "audio");
const MAX = 19;

for (const voice of ["en", "en_bryce"]) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(FROM, voice + ".js"), "utf8"), sandbox);
  const clips = sandbox.window.RIT_AUDIO[voice].slice(0, MAX);
  fs.writeFileSync(path.join(TO, voice + ".js"),
    `/* Spoken numbers 1-${MAX}, voice "${voice}", from Relational Integration Training (Dark): 16 kHz mono WAV, base64. Made by tools/voices.mjs. */\n` +
    `window.RIT_AUDIO = window.RIT_AUDIO || {};\nwindow.RIT_AUDIO[${JSON.stringify(voice)}] = [\n` +
    clips.map((c) => JSON.stringify(c)).join(",\n") + "\n];\n");
  console.log(`${voice}: ${clips.length} clips`);
}

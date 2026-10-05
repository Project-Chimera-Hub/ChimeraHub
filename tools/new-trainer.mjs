#!/usr/bin/env node
/*
 * A new trainer, ready to run, from the template.
 *
 *   node tools/new-trainer.mjs <id> --name "Stroop Switch" --category inhibition \
 *        --what "Name the ink, not the word, and switch rules on a cue" \
 *        [--maintainer your-github-name] [--out ../stroop-switch]
 *
 * Writes a directory that is a complete trainer on its own — Posner cueing,
 * built on the harness — with the harness copied into harness/ so it never
 * depends on this repository. Open its index.html, play it, then replace the
 * inside of `session` in trainer.js with your own trials.
 *
 * It goes in your own repository, not this one: a trainer is submitted from
 * there (see CONTRIBUTING-TRAINERS.md) and grafted in with its history.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = createRequire(import.meta.url)(path.join(ROOT, "shell", "js", "catalog.js"));

function usage(msg) {
  if (msg) console.error(msg + "\n");
  console.error(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(2, 16)
    .map((l) => l.replace(/^ \* ?/, "")).join("\n"));
  process.exit(2);
}

const args = process.argv.slice(2);
const id = args[0];
const opt = (name, fallback) => {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

if (!id || id.startsWith("--")) usage("No id.");
if (!/^[a-z][a-z0-9-]*$/.test(id)) usage(`"${id}" is not an id: lower-case letters, digits and dashes, starting with a letter.`);
if (CATALOG.trainers.some((t) => t.id === id)) usage(`"${id}" is already a trainer on the hub.`);

const category = opt("category", "posner");
if (!CATALOG.categories.some((c) => c.id === category)) {
  usage(`No category "${category}". One of: ${CATALOG.categories.map((c) => c.id).join(", ")}.`);
}

const name = opt("name", id.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "));
const what = opt("what", "One line on what it trains.");
const maintainer = opt("maintainer", "your-github-name");
const out = path.resolve(opt("out", id));

if (fs.existsSync(out) && fs.readdirSync(out).length) usage(`${out} exists and is not empty.`);

const fill = (s) => s
  .replaceAll("__ID__", id)
  .replaceAll("__NAME__", name)
  .replaceAll("__WHAT__", what)
  .replaceAll("__CATEGORY__", category)
  .replaceAll("__MAINTAINER__", maintainer)
  .replaceAll("__YEAR__", String(new Date().getFullYear()));

const template = path.join(ROOT, "templates", "trainer");
fs.mkdirSync(path.join(out, "harness"), { recursive: true });
for (const f of fs.readdirSync(template)) {
  fs.writeFileSync(path.join(out, f), fill(fs.readFileSync(path.join(template, f), "utf8")));
}
/* The harness is copied, not linked: the trainer has to run on its own. */
for (const f of ["record.js", "harness.js", "harness.css", "FORMAT.md"]) {
  fs.copyFileSync(path.join(ROOT, "shared", "harness", f), path.join(out, "harness", f));
}

console.log(`Made ${path.relative(process.cwd(), out) || "."}/ — ${name}, in ${category}.

  1. Open ${path.join(path.relative(process.cwd(), out) || ".", "index.html")} and play a session.
  2. Replace the inside of \`session\` in trainer.js with your trials.
  3. Fill in README.md and chimera.json (unit, license, maintainer).
  4. Play a session, then History → Export record, and save the file as
     test/sample-record.json.
  5. node ${path.relative(process.cwd(), path.join(ROOT, "tools", "check-trainer.mjs"))} ${path.relative(process.cwd(), out) || "."}
  6. Push it to its own public repository and submit it:
     ${CATALOG.submit}`);

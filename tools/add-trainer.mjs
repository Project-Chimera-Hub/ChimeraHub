#!/usr/bin/env node
/*
 * Put a trainer already grafted into apps/<id>/ onto the hub.
 *
 *   node tools/add-trainer.mjs <id> [--owner <github-owner> --repo <name> --branch <branch>]
 *
 * Reads apps/<id>/chimera.json and adds the trainer to shell/js/catalog.js
 * (with a colour no other trainer has) and, given where it came from, to
 * tools/apps.json, so tools/sync.sh can take its later commits. The build
 * needs no line: tools/build-site.mjs builds or copies every catalog trainer
 * that has a chimera.json.
 *
 * The submission workflow runs this after `git subtree add`; it is also what
 * a leader runs by hand to do the same. It changes files and nothing else —
 * committing, and the pull request a leader approves, are the caller's.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const CATALOG_FILE = path.join(ROOT, "shell", "js", "catalog.js");
const APPS_FILE = path.join(ROOT, "tools", "apps.json");

const args = process.argv.slice(2);
const id = args[0];
const opt = (n) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : null; };
const die = (m) => { console.error(m); process.exit(1); };

if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) die("usage: node tools/add-trainer.mjs <id> [--owner o --repo r --branch b]");
const dir = path.join(ROOT, "apps", id);
const mf = path.join(dir, "chimera.json");
if (!fs.existsSync(mf)) die(`no ${path.relative(ROOT, mf)} — graft the trainer into apps/${id}/ first`);
const m = JSON.parse(fs.readFileSync(mf, "utf8"));
if (m.id !== id) die(`apps/${id}/chimera.json says its id is "${m.id}"`);

const CATALOG = require(CATALOG_FILE);
if (CATALOG.trainers.some((t) => t.id === id)) die(`"${id}" is already in the catalog`);
const cats = new Set(CATALOG.categories.map((c) => c.id));
for (const c of m.categories || []) if (!cats.has(c)) die(`no category "${c}"`);

/* Colours that read apart on the hub's black and from each other. The first
   one nobody has is the new trainer's. */
const PALETTE = ["#79c0ff", "#7ee787", "#d2a8ff", "#ffdf5d", "#ff9bce", "#a5d6ff", "#f2cc60",
  "#8ddb8c", "#bc8cff", "#ffb77c", "#76e3ea", "#ffa198", "#e2c5ff", "#b4f1b4", "#ffd8b5"];
const used = new Set(CATALOG.trainers.map((t) => t.colour.toLowerCase()));
const colour = (m.colour && !used.has(m.colour.toLowerCase()) && m.colour)
  || PALETTE.find((c) => !used.has(c)) || "#cccccc";

const q = (s) => JSON.stringify(String(s));
const entry = `    { id: ${q(id)}, name: ${q(m.name)}, path: ${q(id + "/")}, colour: ${q(colour)},
      categories: ${JSON.stringify(m.categories).replace(/,/g, ", ")}, counted: true,
      what: ${q(m.what)} },
`;

/* Inserted at the end of `trainers`, which is the line before the comment
   on `submit`. Text, not a re-serialised object, so the file's comments
   survive. */
let src = fs.readFileSync(CATALOG_FILE, "utf8");
const anchor = "  ],\n\n  /* Where \"submit one\" goes.";
if (!src.includes(anchor)) die("catalog.js has changed shape; add the entry by hand");
src = src.replace(anchor, entry + anchor);
fs.writeFileSync(CATALOG_FILE, src);

/* Check what was written by loading it again. */
delete require.cache[require.resolve(CATALOG_FILE)];
const after = require(CATALOG_FILE);
if (!after.trainers.some((t) => t.id === id)) die("the entry did not take; catalog.js left as it was written");

const owner = opt("owner"), repo = opt("repo"), branch = opt("branch") || "main";
if (owner && repo) {
  const apps = JSON.parse(fs.readFileSync(APPS_FILE, "utf8"));
  if (!apps.apps.some((a) => a.prefix === `apps/${id}`)) {
    /* One line, before the archive's, as the file is written by hand. */
    const line = `    { "prefix": ${q("apps/" + id)}, "owner": ${q(owner)}, "repo": ${q(repo)}, "branch": ${q(branch)} },\n`;
    let text = fs.readFileSync(APPS_FILE, "utf8");
    const at = text.indexOf('    { "prefix": "apps/archive"');
    if (at < 0) die("apps.json has changed shape; add the entry by hand");
    text = text.slice(0, at) + line + text.slice(at);
    JSON.parse(text);
    fs.writeFileSync(APPS_FILE, text);
  }
}

console.log(`${m.name} (${id}) is on the hub: ${m.categories.join(", ")}, colour ${colour}.`);

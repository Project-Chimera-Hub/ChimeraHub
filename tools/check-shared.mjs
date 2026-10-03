#!/usr/bin/env node
/*
 * Check and merge the files players uploaded through "Share your data".
 *
 *   node tools/check-shared.mjs <folder or files...> [--out <folder>]
 *
 * Point it at the folder you downloaded from the MEGA file request. It
 * writes, into --out (default ./chimerahub-dataset, which git ignores):
 *
 *   dataset.json   every accepted answer, one row per answer and participant
 *   dataset.csv    the same, for a spreadsheet or R/pandas
 *   report.txt     what was accepted, what was turned away, and why
 *
 * WHAT IT WILL NOT DO
 * -------------------
 * Anyone with the upload link can upload anything, and nothing restricts the
 * file type. So this treats every file as hostile until it proves otherwise:
 * it never executes, imports or opens a file with anything but JSON.parse, it
 * ignores file names and extensions, it does not follow symlinks, it skips
 * anything over 20 MB before reading it, and it accepts a file only if
 * share-kit's `validate` accepts every field of every row — the same function
 * that decided what the file could contain when it was made. One bad row turns
 * the whole file away: a genuine tool never writes one, so a file with one has
 * been edited.
 *
 * Duplicates — a player uploading twice — are removed by share-kit's `merge`;
 * see there for the rule.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Kit = require("../shared/share-kit/share-kit.js");

const MAX_BYTES = 20 * 1024 * 1024;

function parseArgs(argv) {
  const inputs = [];
  let out = "chimerahub-dataset";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out = argv[++i];
    else if (argv[i] === "-h" || argv[i] === "--help") return null;
    else inputs.push(argv[i]);
  }
  return inputs.length && out ? { inputs, out } : null;
}

/** Regular files only, recursively; symlinks are listed and skipped. */
function collect(inputs) {
  const files = [], skipped = [];
  const walk = (p) => {
    const st = fs.lstatSync(p, { throwIfNoEntry: false });
    if (!st) skipped.push([p, "does not exist"]);
    else if (st.isSymbolicLink()) skipped.push([p, "symlink, not followed"]);
    else if (st.isDirectory()) for (const e of fs.readdirSync(p).sort()) walk(path.join(p, e));
    else if (st.isFile()) files.push([p, st.size]);
    else skipped.push([p, "not a regular file"]);
  };
  inputs.forEach(walk);
  return { files, skipped };
}

/** `{ file }` or `{ reason }`. */
export function check(buf) {
  if (buf.length > MAX_BYTES) return { reason: "larger than 20 MB" };
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return { reason: "not UTF-8 text" }; }
  text = text.replace(/^﻿/, "");
  if (!/^\s*\{/.test(text)) return { reason: "not a JSON object" };
  let file;
  try { file = JSON.parse(text); } catch { return { reason: "not valid JSON" }; }
  const v = Kit.validate(file);
  return v.ok ? { file } : { reason: v.errors.slice(0, 3).join("; ") + (v.errors.length > 3 ? "; …" : "") };
}

const COLUMNS = ["participant", ...Kit.FIELDS];

function csvCell(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) v = v.join(";");
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error("usage: node tools/check-shared.mjs <folder or files...> [--out <folder>]");
    process.exit(2);
  }

  const { files, skipped } = collect(args.inputs);
  const accepted = [], report = [];
  for (const [p, size] of files) {
    const res = size > MAX_BYTES ? { reason: "larger than 20 MB" } : check(fs.readFileSync(p));
    if (res.file) { accepted.push(res.file); report.push(`ok       ${p}  (${res.file.answers} answers, participant ${res.file.participant})`); }
    else report.push(`REJECTED ${p}  — ${res.reason}`);
  }
  for (const [p, why] of skipped) report.push(`skipped  ${p}  — ${why}`);

  const rows = Kit.merge(accepted);
  const participants = new Set(rows.map((r) => r.participant));
  const dataset = {
    format: "mindbuild-dataset",
    version: 1,
    built: new Date().toISOString().slice(0, 10),
    files: accepted.length,
    participants: participants.size,
    answers: rows.length,
    rows,
  };

  fs.mkdirSync(args.out, { recursive: true });
  fs.writeFileSync(path.join(args.out, "dataset.json"), JSON.stringify(dataset));
  fs.writeFileSync(path.join(args.out, "dataset.csv"),
    [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n");
  const summary = `${accepted.length} of ${files.length} files accepted; ${rows.length} answers from ${participants.size} participants after removing duplicates.`;
  fs.writeFileSync(path.join(args.out, "report.txt"), report.join("\n") + "\n\n" + summary + "\n");

  console.log(report.join("\n"));
  console.log(`\n${summary}\nWritten to ${args.out}/`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

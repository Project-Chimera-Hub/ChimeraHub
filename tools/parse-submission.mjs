#!/usr/bin/env node
/*
 * The repository and ref out of a "Submit a trainer" issue.
 *
 *   ISSUE_BODY="…" node tools/parse-submission.mjs
 *
 * Prints `owner=…`, `repo=…`, `url=…` and `ref=…` lines, and appends them to
 * $GITHUB_OUTPUT when it is set. Exits 1, with the reason on stderr, when the
 * issue does not name a GitHub repository and a plain ref.
 *
 * The body is somebody else's text. It is read from the environment, never
 * interpolated into a shell command, and what comes out is held to patterns
 * that cannot carry anything but a repository name and a branch or tag.
 */

import fs from "node:fs";

/** `### Heading\n\nvalue` sections, as GitHub writes an issue form. */
export function sections(body) {
  const out = {};
  const parts = String(body || "").split(/^###\s+/m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const head = (nl < 0 ? p : p.slice(0, nl)).trim();
    const value = (nl < 0 ? "" : p.slice(nl + 1)).trim();
    out[head] = value === "_No response_" ? "" : value;
  }
  return out;
}

export function parse(body) {
  const s = sections(body);
  const url = (s["Repository"] || "").trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/.exec(url);
  if (!m) throw new Error("The Repository field is not a https://github.com/<owner>/<repo> address.");
  const ref = (s["Branch or tag"] || "main").trim();
  if (!/^[A-Za-z0-9._\/-]{1,100}$/.test(ref) || ref.includes("..") || ref.startsWith("-")) {
    throw new Error("The Branch or tag field is not a plain branch or tag name.");
  }
  return { owner: m[1], repo: m[2], url: `https://github.com/${m[1]}/${m[2]}`, ref };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const r = parse(process.env.ISSUE_BODY);
    const lines = Object.entries(r).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
    process.stdout.write(lines);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

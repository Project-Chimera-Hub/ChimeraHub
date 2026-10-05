#!/usr/bin/env node
/*
 * Does a trainer meet Chimera Hub's criteria?
 *
 *   node tools/check-trainer.mjs <dir> [--update] [--browser] [--markdown | --json]
 *
 * The criteria are CONTRIBUTING-TRAINERS.md; this is the part of them a
 * program can check. Run it before submitting. The submission workflow runs
 * it on every submitted repository and posts the result on the issue, so a
 * leader reviewing a trainer starts from what passed rather than from a diff.
 *
 *   --update    the trainer is already on the hub: its id is expected to be
 *               in the catalog rather than refused for being there
 *   --browser   also load it in Chromium (Playwright): no request may leave
 *               the page, nothing may throw, and a phone-width screen may not
 *               scroll sideways
 *   --markdown  the report as a GitHub comment
 *   --json      the report as JSON
 *
 * It reads the trainer and never runs its build: a submitted repository is
 * somebody else's code, and checking it must not mean executing it on the
 * runner. --browser runs its page, as a browser would, and nothing else.
 *
 * Exit status: 0 if every requirement passes (warnings allowed), 1 if not.
 */

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const CATALOG = require(path.join(ROOT, "shell", "js", "catalog.js"));
const ChimeraRecord = require(path.join(ROOT, "shared", "harness", "record.js"));

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const flag = (f) => args.includes("--" + f);
if (!dir) {
  console.error("usage: node tools/check-trainer.mjs <dir> [--update] [--browser] [--markdown | --json]");
  process.exit(2);
}
const DIR = path.resolve(dir);

/* ------------------------------------------------------------------ */

const results = [];
/** One criterion. `level` is "must" (fails the check) or "should" (a warning). */
/* `note` is said when it passes (a count, a fact); `why` when it fails. */
function check(id, level, title, problems, note, why) {
  results.push({ id, level, title, ok: problems.length === 0, problems, note: note || null, why: why || null });
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".angular", ".svelte-kit", "android", "ios"]);
const CODE = /\.(html?|m?js|cjs|jsx|tsx?|css|svelte|vue)$/i;

function walk(d, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, out); }
    else if (e.isFile()) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(DIR, p);
const files = walk(DIR);
const code = files.filter((f) => CODE.test(f) && !/\.min\.js$/.test(f))
  .map((f) => ({ file: f, text: fs.readFileSync(f, "utf8") }));
/* The harness's own files, copied in by new-trainer.mjs. Checked like the
   rest, but its documentation mentions `Harness.start(` and must not be what
   makes a trainer look as if it uses it. */
const inHarness = (f) => /[\\/]harness[\\/](harness|record)\.js$/.test(f);

/** Every line of every code file matching `re`, as "file:line: text". */
function grep(re, only) {
  const hits = [];
  for (const { file, text } of code) {
    if (only && !only.test(file)) continue;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) hits.push(`${rel(file)}:${i + 1}: ${lines[i].trim().slice(0, 140)}`);
    }
  }
  return hits;
}

/* ------------------------------------------------------------------ *
 * The manifest                                                        *
 * ------------------------------------------------------------------ */

let manifest = null;
{
  const p = path.join(DIR, "chimera.json");
  const problems = [];
  if (!fs.existsSync(p)) problems.push("there is no chimera.json at the repository's root");
  else {
    try { manifest = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { problems.push("chimera.json is not valid JSON: " + e.message); }
  }
  if (manifest) {
    const cats = new Set(CATALOG.categories.map((c) => c.id));
    if (!/^[a-z][a-z0-9-]*$/.test(manifest.id || "")) problems.push("`id` must be lower-case letters, digits and dashes, starting with a letter");
    for (const k of ["name", "what", "license", "maintainer"]) {
      if (typeof manifest[k] !== "string" || !manifest[k].trim()) problems.push(`\`${k}\` is missing`);
    }
    if (typeof manifest.what === "string" && manifest.what.length > 90) problems.push("`what` is over 90 characters; it is one line on a card");
    if (!Array.isArray(manifest.categories) || !manifest.categories.length) problems.push("`categories` must list at least one category");
    else for (const c of manifest.categories) if (!cats.has(c)) problems.push(`no category "${c}" — one of ${[...cats].join(", ")}`);
    if (manifest.unit !== null && manifest.unit !== undefined && typeof manifest.unit !== "string") problems.push("`unit` must be a string or null");
    if (manifest.build !== null && manifest.build !== undefined) {
      const b = manifest.build;
      if (!b || typeof b.command !== "string" || typeof b.output !== "string") problems.push("`build` must be null or { command, output }");
    }
    if (manifest.repository && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(manifest.repository)) {
      problems.push("`repository` should be https://github.com/<owner>/<repo>");
    }
    const taken = CATALOG.trainers.some((t) => t.id === manifest.id);
    if (taken && !flag("update")) problems.push(`the id "${manifest.id}" is already a trainer on the hub — choose another, or pass --update for an update to it`);
    if (!taken && flag("update")) problems.push(`--update, but "${manifest.id}" is not on the hub`);
  }
  check("manifest", "must", "chimera.json describes the trainer", problems);
}
const ID = manifest && manifest.id;

/* ------------------------------------------------------------------ *
 * It runs: an entry page, relative paths                              *
 * ------------------------------------------------------------------ */

const built = manifest && manifest.build;
const entry = path.join(DIR, "index.html");
{
  const problems = [];
  if (!built && !fs.existsSync(entry)) problems.push("there is no index.html at the root (and no `build` in chimera.json)");
  if (built && !fs.existsSync(path.join(DIR, "package.json"))) problems.push("`build` is set but there is no package.json");
  if (built && !fs.existsSync(path.join(DIR, "package-lock.json"))) problems.push("`build` is set but there is no package-lock.json; the hub builds with npm ci");
  check("entry", "must", "it has a page to open", problems,
    built ? `Built with \`${built.command}\` into \`${built.output}/\`; the build itself is checked by the hub's CI when the import PR is opened, not here.` : null);
}
/* Source pages of a built app say `/main.tsx` and the bundler rewrites it;
   for those, the build's base is what matters, and the import PR's CI builds
   it at the hub's. */
check("relative", "must", "every asset is loaded by a relative path",
  built ? [] : grep(/<(script|link|img|audio|video|source)\b[^>]*\s(src|href)=["']\/(?!\/)/i, /\.html?$/i),
  built ? "Built: the hub builds it at a relative base." : null,
  "The hub serves each trainer from a sub-folder, so `/app.js` would load the hub's root, not yours.");

/* ------------------------------------------------------------------ *
 * Offline: nothing fetched from anywhere                              *
 * ------------------------------------------------------------------ */

check("offline", "must", "nothing is loaded from the network", [
  ...grep(/<script\b[^>]*\ssrc=["'](https?:)?\/\//i),
  ...grep(/<link\b[^>]*\shref=["'](https?:)?\/\//i),
  ...grep(/@import\s+(url\()?\s*["']?(https?:)?\/\//i),
  ...grep(/url\(\s*["']?https?:\/\//i, /\.(css|html?|svelte|vue)$/i),
  ...grep(/\bfetch\(\s*["'`]https?:/),
  ...grep(/\bimport\s*(\(|[^;]*\bfrom)\s*["']https?:/),
  ...grep(/"imports"\s*:\s*\{/),
  ...grep(/new\s+(WebSocket|EventSource)\(|navigator\.sendBeacon\(/),
  ...grep(/new\s+XMLHttpRequest\(/),
], null, "Fonts, libraries, sounds and images are bundled. The hub and the APK run with the network off.");

check("tracking", "must", "no analytics, trackers or keys", [
  ...grep(/google-analytics|googletagmanager|\bgtag\(|plausible\.io|sentry|mixpanel|segment\.(io|com)|hotjar|clarity\.ms/i),
  ...grep(/AIza[0-9A-Za-z_-]{35}|\bsk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}/),
]);

/* ------------------------------------------------------------------ *
 * The record                                                          *
 * ------------------------------------------------------------------ */

const usesHarness = code.some(({ file, text }) => !inHarness(file) && /\bHarness\.start\s*\(/.test(text))
  && code.some(({ file }) => inHarness(file));
{
  const problems = [];
  const key = ID ? ChimeraRecord.key(ID) : null;
  const writesKey = key && code.some(({ text }) => text.includes(key) || text.includes(`chimera.${ID}.record`));
  if (!usesHarness && !writesKey) {
    problems.push(`nothing writes \`${key || "chimera.<id>.record.v1"}\`: use the harness (Harness.start) or write the record format yourself`);
  }
  check("format", "must", "it keeps its sessions in the Chimera record format", problems,
    usesHarness ? "Written by the harness." : null);
}
{
  const p = path.join(DIR, "test", "sample-record.json");
  const problems = [];
  let sessions = 0;
  if (!fs.existsSync(p)) problems.push("there is no test/sample-record.json — play a session and export the record (History → Export record, with the harness)");
  else {
    let rec = null;
    try { rec = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { problems.push("test/sample-record.json is not valid JSON"); }
    if (rec) {
      const v = ChimeraRecord.validate(rec);
      problems.push(...v.errors.slice(0, 15));
      if (v.errors.length > 15) problems.push(`…and ${v.errors.length - 15} more`);
      if (ID && rec.app !== ID) problems.push(`its \`app\` is "${rec.app}", not the manifest's "${ID}"`);
      sessions = Array.isArray(rec.sessions) ? rec.sessions.length : 0;
      if (!sessions) problems.push("it has no sessions");
      if (manifest && manifest.unit && rec.units && rec.units.level && rec.units.level !== manifest.unit) {
        problems.push(`its units.level is "${rec.units.level}" and the manifest's unit is "${manifest.unit}"`);
      }
      for (const w of v.warnings.slice(0, 5)) results.push({ id: "sample-warning", level: "should", title: "sample record", ok: false, problems: [w] });
    }
  }
  check("sample", "must", "a real session's record validates", problems, sessions ? `${sessions} session(s) in the sample.` : null);
}
{
  /* Keys a trainer writes besides its record. Not wrong, but a key named
     `settings` or `history` is a key another trainer on the same origin is
     going to write too. */
  const keys = new Set();
  for (const { text } of code) {
    for (const m of text.matchAll(/localStorage\.setItem\(\s*["'`]([^"'`$]+)["'`]/g)) keys.add(m[1]);
  }
  const loose = ID ? [...keys].filter((k) => !k.startsWith(`chimera.${ID}.`) && !k.startsWith(ID)) : [];
  check("storage", "should", "its own storage keys are namespaced",
    loose.map((k) => `\`${k}\` — name it \`chimera.${ID}.…\` so it cannot collide with another trainer's`));
}

/* ------------------------------------------------------------------ *
 * Behaviour inside the hub                                            *
 * ------------------------------------------------------------------ */

check("pause", "must", "it pauses when the page is hidden",
  usesHarness || grep(/visibilitychange|visibilityState|document\.hidden/).length ? [] :
    ["nothing listens for `visibilitychange`: the hub hides a trainer's frame when the player goes back to the menu, and its time must stop"]);

check("frame", "must", "it stays in its frame", [
  ...grep(/\b(window\.)?(top|parent)\.location\b/),
  ...grep(/target=["']_(top|parent)["']/i),
  ...grep(/\b(window\.)?(top|parent)\.(document|localStorage)\b/),
], null, "The hub runs every trainer in a frame on one origin; reaching out of it breaks the menu and the meter.");

{
  const html = fs.existsSync(entry) ? fs.readFileSync(entry, "utf8") : "";
  check("viewport", "should", "it is laid out for a phone",
    html && !/<meta[^>]+name=["']viewport["']/i.test(html) ? ["index.html has no viewport meta tag"] : []);
}

/* ------------------------------------------------------------------ *
 * The repository                                                      *
 * ------------------------------------------------------------------ */

{
  const lic = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"].find((f) => fs.existsSync(path.join(DIR, f)));
  const problems = lic ? [] : ["there is no LICENSE file"];
  if (lic && /__[A-Z]+__/.test(fs.readFileSync(path.join(DIR, lic), "utf8"))) problems.push(`${lic} still has template placeholders`);
  check("license", "must", "it has a license that lets the hub ship it", problems, lic || null,
    "Any OSI-approved license (MIT, Apache-2.0, GPL-3.0, …), covering every asset too.");
}
{
  const readme = ["README.md", "readme.md", "README"].find((f) => fs.existsSync(path.join(DIR, f)));
  const must = readme ? [] : ["there is no README.md"];
  check("readme", "must", "it has a README", must);
  if (readme) {
    const text = fs.readFileSync(path.join(DIR, readme), "utf8");
    const missing = ["What it trains", "How difficulty is measured", "Controls"]
      .filter((h) => !new RegExp("^#+\\s*" + h, "im").test(text));
    check("readme-sections", "should", "the README has the expected sections",
      missing.map((h) => `no "${h}" section`));
  }
}
check("placeholders", "must", "no template placeholders are left",
  grep(/__(ID|NAME|WHAT|CATEGORY|MAINTAINER|YEAR)__/).concat(
    manifest ? Object.entries(manifest).filter(([, v]) => typeof v === "string" && /__[A-Z]+__|your-github-name/.test(v))
      .map(([k]) => `chimera.json: \`${k}\` is still the template's`) : []));

{
  let total = 0;
  const big = [];
  for (const f of files) {
    const n = fs.statSync(f).size;
    total += n;
    if (n > 5 * 1024 * 1024) big.push(`${rel(f)} is ${(n / 1048576).toFixed(1)} MB`);
  }
  check("size", "must", "it is under 25 MB", total > 25 * 1024 * 1024 ? [`${(total / 1048576).toFixed(1)} MB in all`] : [],
    `${(total / 1048576).toFixed(1)} MB, without node_modules.`);
  if (big.length) check("big-files", "should", "no single file over 5 MB", big);
}

/* ------------------------------------------------------------------ *
 * In a browser                                                        *
 * ------------------------------------------------------------------ */

async function browserCheck() {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch (e) {
    try { ({ chromium } = require("playwright")); }
    catch (e2) { check("browser", "should", "it runs in a browser", ["Playwright is not installed here, so this was not run"]); return; }
  }
  if (built) { check("browser", "should", "it runs in a browser", ["it has a build step; the page is checked in the import PR's CI"]); return; }

  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let p = path.join(DIR, u);
    if (!p.startsWith(DIR)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    const type = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
      ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
      ".webp": "image/webp", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".opus": "audio/ogg" }[path.extname(p)] || "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const launch = {};
  if (fs.existsSync("/opt/pw-browsers/chromium")) launch.executablePath = "/opt/pw-browsers/chromium";
  let browser;
  try { browser = await chromium.launch(launch); }
  catch (e) { browser = await chromium.launch(); }
  const problems = [];
  try {
    /* Served from a sub-folder, as the hub serves it. */
    for (const [w, h] of [[1280, 800], [360, 740]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on("pageerror", (e) => problems.push(`${w}px: an uncaught error: ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error") problems.push(`${w}px: console error: ${m.text().slice(0, 160)}`); });
      page.on("request", (r) => {
        const u = r.url();
        if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) problems.push(`${w}px: a request left the page: ${u}`);
      });
      await page.route("**/*", (route) => {
        const u = route.request().url();
        if (u.startsWith(origin + "/sub/")) {
          return route.continue({ url: origin + "/" + u.slice((origin + "/sub/").length) });
        }
        return u.startsWith(origin) || u.startsWith("data:") || u.startsWith("blob:") ? route.continue() : route.abort();
      });
      await page.goto(origin + "/sub/index.html", { waitUntil: "load", timeout: 20000 });
      await page.waitForTimeout(800);
      if (w < 400) {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (over > 1) problems.push(`at 360px the page is ${over}px wider than the screen`);
      }
      await page.close();
    }
  } catch (e) {
    problems.push("the page did not load: " + e.message);
  } finally {
    await browser.close();
    server.close();
  }
  check("browser", "must", "it loads in a browser, offline, without errors, at phone width", [...new Set(problems)]);
}

if (flag("browser")) await browserCheck();

/* ------------------------------------------------------------------ *
 * The report                                                          *
 * ------------------------------------------------------------------ */

const failed = results.filter((r) => !r.ok && r.level === "must");
const warned = results.filter((r) => !r.ok && r.level === "should");
const ok = failed.length === 0;

if (flag("json")) {
  console.log(JSON.stringify({ ok, manifest, results }, null, 2));
} else if (flag("markdown")) {
  const lines = [];
  lines.push(ok ? `### ✅ ${manifest ? manifest.name : "This trainer"} meets every requirement the check can test`
    : `### ❌ ${failed.length} requirement${failed.length === 1 ? "" : "s"} not met`);
  lines.push("");
  if (manifest) {
    lines.push(`**${manifest.name}** (\`${manifest.id}\`) · ${(manifest.categories || []).join(", ")} · ${manifest.license || "no license"} · maintained by ${manifest.maintainer || "?"}`);
    lines.push("");
  }
  lines.push("| | Criterion | |", "|---|---|---|");
  for (const r of results) {
    const mark = r.ok ? "✅" : r.level === "must" ? "❌" : "⚠️";
    const detail = r.ok ? (r.note || "") : r.problems.slice(0, 6).map((p) => p.replace(/\|/g, "\\|")).join("<br>")
      + (r.problems.length > 6 ? `<br>…and ${r.problems.length - 6} more` : "")
      + (r.why ? `<br>*${r.why}*` : "");
    lines.push(`| ${mark} | ${r.title}${r.level === "should" ? " *(should)*" : ""} | ${detail} |`);
  }
  lines.push("", ok
    ? "A hub leader will now play it and review it. Adding the `approved` label imports it into a pull request."
    : "Fix these in your repository and edit this issue (or comment `/recheck`) to run the check again.",
  "", "See [CONTRIBUTING-TRAINERS.md](../blob/main/CONTRIBUTING-TRAINERS.md) for what each criterion means.");
  console.log(lines.join("\n"));
} else {
  for (const r of results) {
    const mark = r.ok ? "  ok  " : r.level === "must" ? "  FAIL" : "  warn";
    console.log(`${mark}  ${r.title}${r.ok && r.note ? " — " + r.note : ""}`);
    if (!r.ok) for (const p of r.problems.slice(0, 10)) console.log("          " + p);
    if (!r.ok && r.why) console.log("          (" + r.why + ")");
  }
  console.log(`\n${ok ? "Meets every requirement this can check." : failed.length + " requirement(s) not met."}`
    + (warned.length ? ` ${warned.length} warning(s).` : ""));
}

process.exit(ok ? 0 : 1);

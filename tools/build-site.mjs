#!/usr/bin/env node
/*
 * One site out of eight repositories.
 *
 * Every app stays exactly what it was — a Svelte app built with Vite, a set of
 * plain pages, the archive — and this script only decides where each one
 * lands. Nothing here rewrites an app's source, because the moment a build
 * step starts editing the thing it builds, the app stops working when opened
 * on its own and the archive's whole thesis (it must still run in five years,
 * from a USB stick, with no toolchain) goes with it.
 *
 *   node tools/build-site.mjs          → dist/, based at /ChimeraHub/
 *   BASE=/ node tools/build-site.mjs   → dist/, based at the domain root
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/* Trailing slash guaranteed: every base href below is built by concatenation,
   and `/ChimeraHubcct/` is the kind of bug that only shows up on the deployed
   site. */
const BASE = (process.env.BASE || "/ChimeraHub/").replace(/\/*$/, "/");

/* A visit counter for the published website, and only for that.
 *
 * GoatCounter: no cookies, no personal data, and nothing but a page count per
 * path. It is written in here rather than into shell/index.html because the
 * hub's source has to stay a page that runs with the network off — opened from
 * the repository, from a USB stick, or inside the APK, it makes no request to
 * anyone. So the snippet exists only in a build that asks for it
 * (GOATCOUNTER=<site code>, which the Pages workflow reads from a repository
 * variable), never in the APK's, and never inside a trainer: the hub counts
 * which trainer was opened from its own route, and no app's source is touched.
 *
 * Unset means off, so a build with no account behaves exactly as before. */
const GOATCOUNTER = process.env.APK ? "" : (process.env.GOATCOUNTER || "").trim();
if (GOATCOUNTER && !/^[a-z0-9-]+$/.test(GOATCOUNTER)) {
  throw new Error(`GOATCOUNTER should be a site code like "chimerahub", not ${JSON.stringify(GOATCOUNTER)}`);
}

/* The hub routes by hash (#/cct), which GoatCounter ignores by default,
 * so the route is added to the path: one count per hub visit and one per
 * trainer opened. */
function withAnalytics(html) {
  if (!GOATCOUNTER) return html;
  const snippet = [
    `<script>window.goatcounter = { path: function (p) { return p + (location.hash || ""); } };`,
    `window.addEventListener("hashchange", function () {`,
    `  if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: location.pathname + location.hash });`,
    `});</script>`,
    `<script data-goatcounter="https://${GOATCOUNTER}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`,
  ].join("\n");
  if (!html.includes("</head>")) throw new Error("hub index.html has no </head> to put the counter before");
  return html.replace("</head>", snippet + "\n</head>");
}

/* Copied out of an app rather than linked from it. `git subtree` gives each app
   its own directory and no way to reach across, and a symlink does not survive
   `actions/upload-pages-artifact`. The archive keeps the originals; these are a
   build output like any other. */
const SHARED_FROM_ARCHIVE = ["record.js", "adapters.js"];

/* Never copied into the site: history, the CI of the repo this app used to be,
   and dependency trees that are megabytes of nothing anyone requested. */
const SKIP = new Set([".git", ".github", "node_modules", ".angular", ".vscode"]);

const log = (...a) => console.log(...a);

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

/* `leave` is a further, per-app test on a file's name: what that app keeps in
   its repository but never asks for. */
function copyDir(from, to, leave) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst, leave);
    else if (entry.isFile() && !(leave && leave(entry.name))) fs.copyFileSync(src, dst);
  }
}

function run(cmd, args, cwd) {
  log(`  $ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

/* npm ci is minutes; skipping it when node_modules is already there turns a
   rebuild into seconds. CI starts clean and pays the cost once. */
function ensureDeps(dir) {
  if (fs.existsSync(path.join(dir, "node_modules"))) return;
  run("npm", ["ci", "--no-audit", "--no-fund"], dir);
}

/* ------------------------------------------------------------------ */

rmrf(DIST);
fs.mkdirSync(DIST, { recursive: true });

/* The four trainers, and the archive. They are already a website and use
   relative paths throughout — checked, not assumed — so they run at whatever
   depth they are put, and they are copied rather than built. */
for (const name of ["cct", "chimera", "ewmt", "relational", "archive"]) {
  log(`[copy] ${name}`);
  copyDir(path.join(ROOT, "apps", name), path.join(DIST, name));
}

/* The additional exercises under apps/more: offered by the hub in their own
   box, and not counted toward the quota, because no adapter reads their
   storage. Two are pages and are copied as they are.

   Attention Training keeps a .wav beside every .mp3 it plays — sixty-odd
   megabytes it never asks for — so they are left in the repository and out of
   the site, and out of the APK with it. */
const LEAVE = { att: (name) => name.endsWith(".wav") };
for (const name of ["att", "earshot"]) {
  log(`[copy] more/${name}`);
  copyDir(path.join(ROOT, "apps", "more", name), path.join(DIST, "more", name), LEAVE[name]);
}

/* N-back Constant Change is a Svelte app, and Vite builds it. A relative base
   is its own default and the right one here: the same output then runs at the
   Pages path, under open/, and inside the APK, with nothing to rewrite. */
log("[build] more/quadbox (vite)");
{
  const dir = path.join(ROOT, "apps", "more", "quadbox");
  ensureDeps(dir);
  run("npx", ["vite", "build", "--base", "./",
    "--outDir", path.join(DIST, "more", "quadbox"), "--emptyOutDir"], dir);
}

/* The record, hoisted where the shell can reach it. The archive remains the
   only place these are edited. */
log("[copy] shared record");
fs.mkdirSync(path.join(DIST, "shared"), { recursive: true });
for (const f of SHARED_FROM_ARCHIVE) {
  fs.copyFileSync(path.join(ROOT, "apps", "archive", "js", f),
                  path.join(DIST, "shared", f));
}
/* Code that is the shell's and the gate's but nobody's app. The quota policy
   lives here rather than in the archive because the archive must never apply
   it: one records what happened, the other decides what it was worth. */
copyDir(path.join(ROOT, "shared"), path.join(DIST, "shared"));

log("[copy] shell");
copyDir(path.join(ROOT, "shell"), DIST);

/* The shell needs to build URLs to the apps, and it is a static file, so the
   base has to be written into it at build time rather than guessed at runtime
   from location.pathname — which is wrong the moment a trainer is open. */
const idx = path.join(DIST, "index.html");
fs.writeFileSync(idx, withAnalytics(fs.readFileSync(idx, "utf8").replace("%BASE%", BASE)));

/* The hub again at open/, which older links point to. The gate it used to be
 * the gate-free copy of is gone from the site, so it is now the same page: the
 * shell's own index.html, loading the stylesheet, scripts and adapters from the
 * parent directory rather than copies of them.
 *
 * `prefix` is what every relative asset gets in front of it: "../" for the copy
 * served a directory down. The shell asks for `css/`, `js/`, `shared/` and its
 * icon, and any <link> or <script> with a relative target is rewritten. */
function shellIndex(prefix) {
  let html = fs.readFileSync(path.join(ROOT, "shell", "index.html"), "utf8");
  if (prefix) {
    html = html.replace(/(<(?:script|link)\b[^>]*?\s(?:src|href)=")(?!\.\.\/|https?:|\/|data:|#)/g,
                        "$1" + prefix);
  }
  return html.replace("%BASE%", BASE);
}

log("[copy] shell (again, at open/)");
{
  const open = path.join(DIST, "open");
  fs.mkdirSync(open, { recursive: true });
  fs.writeFileSync(path.join(open, "index.html"), withAnalytics(shellIndex("../")));
}

/* The Android build wraps this directory in a WebView and ships without the
 * analytics counter. See tools/build-apk.sh. */
if (process.env.APK) {
  log("[apk]  hub at the root, no counter");
  fs.writeFileSync(path.join(DIST, "index.html"), shellIndex(""));
}

fs.writeFileSync(path.join(DIST, ".nojekyll"), "");
log(`\nBuilt dist/ at base ${BASE}`);

#!/usr/bin/env node
/*
 * One site out of eight repositories.
 *
 * Every app stays exactly what it was — an Angular app, a Vite app, six pages
 * of plain HTML — and this script only decides where each one lands. Nothing
 * here rewrites an app's source, because the moment a build step starts
 * editing the thing it builds, the app stops working when opened on its own
 * and the archive's whole thesis (it must still run in five years, from a USB
 * stick, with no toolchain) goes with it.
 *
 *   node tools/build-site.mjs          → dist/, based at /mindbuild/
 *   BASE=/ node tools/build-site.mjs   → dist/, based at the domain root
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/* Trailing slash guaranteed: every base href below is built by concatenation,
   and `/mindbuildsyllogimous/` is the kind of bug that only shows up on the
   deployed site. */
const BASE = (process.env.BASE || "/mindbuild/").replace(/\/*$/, "/");

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
  throw new Error(`GOATCOUNTER should be a site code like "mindbuild", not ${JSON.stringify(GOATCOUNTER)}`);
}

/* The hub routes by hash (#/syllogimous), which GoatCounter ignores by default,
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

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
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

/* The six that are already a website, and the archive. They use relative paths
   throughout — checked, not assumed — so they run at whatever depth they are
   put, and they are copied rather than built: only Syllogimous has a toolchain.

   Isomorph used to be copied here too, and is not: every one of its modes is a
   Syllogimous mode now, so it was a second build of the same codebase offering
   a subset of the same trainer. What reads its *records* stays — see the
   archive's `readIsomorph` — because a file somebody exported in 2025 is still
   their training history. */
for (const name of ["rnb", "rotation", "cct", "rrt", "synth", "ewmt", "archive"]) {
  log(`[copy] ${name}`);
  copyDir(path.join(ROOT, "apps", name), path.join(DIST, name));
}

/* Angular. `--base-href` is the whole of what changes; the Capacitor build in
   apps/syllogimous is untouched and still builds its own dist for the APK. */
log("[build] syllogimous (angular)");
{
  const dir = path.join(ROOT, "apps", "syllogimous");
  ensureDeps(dir);
  run("npx", ["ng", "build", "--configuration=production",
    "--output-path", path.join(DIST, "syllogimous"),
    "--base-href", `${BASE}syllogimous/`], dir);
  /* Pages has no router, so a deep link 404s. Serving index.html as the 404
     page is how a project site fakes history-mode routing. */
  fs.copyFileSync(path.join(DIST, "syllogimous", "index.html"),
                  path.join(DIST, "syllogimous", "404.html"));
}

/* Vite. Its base lives in vite.config.ts and is read from the environment so
   the same config serves the standalone repo and this one. */
log("[build] precision (vite)");
{
  const dir = path.join(ROOT, "apps", "precision");
  ensureDeps(dir);
  run("npx", ["vite", "build", "--base", `${BASE}precision/`,
    "--outDir", path.join(DIST, "precision"), "--emptyOutDir"], dir);
}

/* The trainers under apps/more: offered by the hub in their own box, and not
   counted toward the quota, because no adapter reads their storage yet. Both
   are pages with no build step of their own, and are copied as they are. */
for (const name of ["dorsalflow", "prophantasia"]) {
  log(`[copy] more/${name}`);
  copyDir(path.join(ROOT, "apps", "more", name), path.join(DIST, "more", name));
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

/* The same hub with nothing in it that talks to this machine.
 *
 * The gate's heartbeat is a POST from the page to 127.0.0.1, and to a privacy
 * extension that is indistinguishable from a port scan — Port Authority and
 * uBlock's LAN list both stop it and say so in a notification. They are right
 * to: a website reaching into the local network is exactly the shape of the
 * thing they exist to stop. On a machine with no gate installed the request
 * was never going to be answered anyway, so all it could ever produce there
 * was that warning.
 *
 * So this is one generated file, and nothing else. It is the shell's own
 * index.html with the gate card cut out and `data-gate="off"`, loading the same
 * stylesheet, the same scripts and the same adapters from the parent directory
 * — not copies of them. The two pages look identical and behave identically in
 * everything but the gate, because there is nothing here that could drift:
 * one attribute, and the code reads it.
 *
 * `data-base` points at the parent too, so the trainers it frames are the same
 * copies the gated hub frames. Same origin, so the same saved history —
 * localStorage is per origin, not per path — and no second Angular build.
 */
/* `prefix` is what every relative asset gets in front of it: "../" for the copy
 * served a directory down at open/, "" for one served at the root. The shell
 * asks for `css/`, `js/`, `shared/` and its icon, and any <link> or <script>
 * with a relative target is rewritten — naming the stylesheet and the script
 * explicitly is what left the favicon pointing a directory too deep. */
function gateFreeIndex(prefix) {
  let html = fs.readFileSync(path.join(ROOT, "shell", "index.html"), "utf8");

  const before = html;
  html = html.replace(/[ \t]*<!-- gate:begin -->[\s\S]*?<!-- gate:end -->\n?/, "");
  if (html === before) throw new Error("shell/index.html: gate:begin/gate:end markers are gone");

  if (prefix) {
    html = html.replace(/(<(?:script|link)\b[^>]*?\s(?:src|href)=")(?!\.\.\/|https?:|\/|data:|#)/g,
                        "$1" + prefix);
  }
  return html.replace('data-gate="on"', 'data-gate="off"').replace("%BASE%", BASE);
}

log("[copy] shell (gate-free, at open/)");
{
  const open = path.join(DIST, "open");
  fs.mkdirSync(open, { recursive: true });
  fs.writeFileSync(path.join(open, "index.html"), withAnalytics(gateFreeIndex("../")));
}

/* The Android build wraps this directory in a WebView, where the gate is not
 * merely absent but meaningless: there is no daemon to answer 127.0.0.1 and no
 * screen for it to hold. So the app's front page is the gate-free one, served
 * from the root rather than from open/. See tools/build-apk.sh. */
if (process.env.APK) {
  log("[apk]  gate-free hub at the root");
  fs.writeFileSync(path.join(DIST, "index.html"), gateFreeIndex(""));
}

fs.writeFileSync(path.join(DIST, ".nojekyll"), "");
log(`\nBuilt dist/ at base ${BASE}`);

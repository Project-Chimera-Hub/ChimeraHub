#!/usr/bin/env node
/*
 * Fetches the photographs for Running Order's "Pictures" set from Wikimedia
 * Commons, and keeps a record of whose they are.
 *
 *   node tools/fetch-pictures.mjs            fetch what is missing
 *   node tools/fetch-pictures.mjs --force    fetch everything again
 *
 * Needs the network and ImageMagick's `convert`. Run by
 * .github/workflows/pictures.yml, which commits the result — the site and the
 * APK then carry the files themselves, and nothing is fetched at play time.
 *
 * apps/rrt/pictures/list.json is the whole input: for each picture its spoken
 * `name`, a Commons search `query`, and optionally `file` (a Commons file
 * title to use instead of searching) and `reject` (titles never to use). A bad
 * photo is fixed there, by pinning a better file or rejecting the bad one, and
 * the workflow runs again on the change.
 *
 * Only licences that allow reuse in an app are taken: public domain, CC0,
 * CC BY and CC BY-SA. Every one lands in credits.json with its author, licence
 * and source page, which the app shows beside the setting.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIR = path.join(ROOT, "apps", "rrt", "pictures");
const LIST = path.join(DIR, "list.json");
const CREDITS = path.join(DIR, "credits.json");
const API = "https://commons.wikimedia.org/w/api.php";
/* Wikimedia asks every client to say who it is. */
const UA = "mindbuild-picture-fetch/1.0 (https://github.com/Gagafutzi/mindbuild)";
const SIZE = 256;
const force = process.argv.includes("--force");

const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const plain = html => String(html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

function licenceOk(short) {
  const s = String(short || "").toLowerCase();
  if (/\b(nc|nd)\b|fair use|non-free/.test(s)) return false;
  return /^(cc0|public domain|pd|cc by(-sa)? [0-9.]+|cc-by(-sa)?-[0-9.]+)/.test(s);
}

async function api(params) {
  const url = API + "?" + new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params });
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.json();
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error("Commons API failed: " + url);
}

const INFO = {
  prop: "imageinfo",
  iiprop: "url|size|mime|extmetadata",
  iiurlwidth: "640",
  iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|Credit",
};

/* Pages whose image can be used: a photo, big enough, near square, and
   licensed for reuse. */
function usable(page, reject) {
  const ii = page.imageinfo && page.imageinfo[0];
  if (!ii || reject.includes(page.title)) return null;
  if (!/image\/(jpeg|png)/.test(ii.mime)) return null;
  if (ii.width < 400 || ii.height < 400) return null;
  const ratio = ii.width / ii.height;
  if (ratio < 0.6 || ratio > 1.8) return null;
  const meta = ii.extmetadata || {};
  const licence = meta.LicenseShortName && meta.LicenseShortName.value;
  if (!licenceOk(licence)) return null;
  return {
    file: page.title,
    thumb: ii.thumburl || ii.url,
    source: ii.descriptionurl,
    author: plain(meta.Artist && meta.Artist.value) || plain(meta.Credit && meta.Credit.value) || "unknown",
    licence,
    licenceUrl: (meta.LicenseUrl && meta.LicenseUrl.value) || "",
  };
}

async function candidate(item) {
  const reject = item.reject || [];
  if (item.file) {
    const data = await api({ action: "query", titles: item.file, ...INFO });
    const hit = usable(data.query.pages[0], []);
    if (!hit) throw new Error(`${item.name}: pinned ${item.file} is not usable`);
    return hit;
  }
  const data = await api({
    action: "query", generator: "search", gsrnamespace: "6", gsrlimit: "30",
    gsrsearch: `${item.query} filetype:bitmap`, ...INFO,
  });
  const pages = (data.query && data.query.pages || []).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const hit = usable(p, reject);
    if (hit) return hit;
  }
  throw new Error(`${item.name}: nothing usable for "${item.query}"`);
}

async function download(url, to) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`download ${res.status}: ${url}`);
  const tmp = to + ".src";
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  /* Square, from the centre, where the subject of a photo nearly always is. */
  execFileSync("convert", [tmp, "-auto-orient", "-resize", `${SIZE}x${SIZE}^`, "-gravity", "center",
    "-extent", `${SIZE}x${SIZE}`, "-strip", "-quality", "78", to]);
  fs.unlinkSync(tmp);
}

const list = JSON.parse(fs.readFileSync(LIST, "utf8"));
const credits = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, "utf8")) : {};
const out = {};
let failed = 0;

for (const item of list) {
  const file = slug(item.name) + ".jpg";
  const at = path.join(DIR, file);
  const old = credits[item.name];
  const stillGood = old && fs.existsSync(at) && !force
    && (!item.file || item.file === old.file)
    && !(item.reject || []).includes(old.file);
  if (stillGood) { out[item.name] = old; continue; }
  try {
    const hit = await candidate(item);
    await download(hit.thumb, at);
    delete hit.thumb;
    out[item.name] = { image: file, ...hit };
    console.log(`fetched  ${item.name.padEnd(12)} ${hit.file}  (${hit.licence})`);
  } catch (e) {
    failed++;
    console.log(`FAILED   ${item.name.padEnd(12)} ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 300));
}

/* Pictures no longer on the list go, file and credit both. */
const keep = new Set(Object.values(out).map(c => c.image));
for (const f of fs.readdirSync(DIR)) {
  if (f.endsWith(".jpg") && !keep.has(f)) fs.unlinkSync(path.join(DIR, f));
}
fs.writeFileSync(CREDITS, JSON.stringify(out, null, 1) + "\n");
console.log(`\n${Object.keys(out).length} pictures, ${failed} failed`);

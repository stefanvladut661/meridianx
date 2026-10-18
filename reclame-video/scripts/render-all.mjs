// Randează toate segmentele din out/plan.json (hook, 5 secvențe de body, CTA)
// ca ProRes 4444 cu canal alfa, plus fundalurile celor două stiluri. Sare
// peste ce există deja, deci se poate relua oricând.
// Folosire: node scripts/render-all.mjs [--only <regex>] [--force] [--concurrency N]

import { bundle } from "@remotion/bundler";
import { ensureBrowser, openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const force = args.includes("--force");
const only = new RegExp(opt("--only", "."));
const concurrency = Number(opt("--concurrency", "2"));

const plan = JSON.parse(readFileSync(join(root, "out/plan.json"), "utf8"));
const outDir = join(root, "out/segments");
mkdirSync(outDir, { recursive: true });

// Ordinea: întâi segmentele clipului 333f h3-c2 (cel cerut primul), apoi restul.
const jobs = [];
const seen = new Set();
const push = (id, kind) => {
  if (seen.has(id) || !only.test(id)) return;
  seen.add(id);
  jobs.push({ id, kind });
};
for (const style of ["larven", "shopify"]) push(`bg-${style}`, "bg");
const ordered = [...plan.clips].sort((a, b) => (a.id.startsWith("333f-h3-c2") ? -1 : 0) - (b.id.startsWith("333f-h3-c2") ? -1 : 0));
for (const c of ordered) for (const s of c.segments) push(s.comp, "seg");

await ensureBrowser();
console.log(`Bundle…`);
const serveUrl = await bundle({ entryPoint: join(root, "src/index.ts"), publicDir: join(root, "public") });
const browser = await openBrowser("chrome");

let k = 0;
for (const job of jobs) {
  k++;
  const out = join(outDir, job.kind === "bg" ? `${job.id}.png` : `${job.id}.mov`);
  if (!force && existsSync(out) && statSync(out).size > 0) {
    console.log(`[${k}/${jobs.length}] ${job.id} există`);
    continue;
  }
  const composition = await selectComposition({ serveUrl, id: job.id, puppeteerInstance: browser, inputProps: {} });
  if (job.kind === "bg") {
    // Fundalurile sunt statice: o singură imagine, pusă sub tot clipul la asamblare.
    await renderStill({ composition, serveUrl, puppeteerInstance: browser, inputProps: {}, output: out, frame: 0, imageFormat: "png", overwrite: true });
    console.log(`[${k}/${jobs.length}] ${job.id} gata (imagine)`);
    continue;
  }
  const tmp = join(outDir, `${job.id}.part.mov`);
  rmSync(tmp, { force: true });
  const t0 = Date.now();
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    puppeteerInstance: browser,
    inputProps: {},
    outputLocation: tmp,
    codec: "prores",
    proResProfile: job.kind === "bg" ? "hq" : "4444",
    imageFormat: job.kind === "bg" ? "jpeg" : "png",
    jpegQuality: 95,
    pixelFormat: job.kind === "bg" ? "yuv422p10le" : "yuva444p10le",
    colorSpace: "bt709",
    concurrency,
    timeoutInMilliseconds: 120000,
    overwrite: true,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10);
      if (pct !== last) {
        last = pct;
        process.stdout.write(`\r[${k}/${jobs.length}] ${job.id} ${pct * 10}%   `);
      }
    },
  });
  renameSync(tmp, out);
  const secs = (Date.now() - t0) / 1000;
  console.log(`\r[${k}/${jobs.length}] ${job.id} gata: ${composition.durationInFrames} cadre în ${secs.toFixed(0)} s (${(secs / composition.durationInFrames).toFixed(2)} s/cadru)`);
}
await browser.close({ silent: true });
console.log("Toate segmentele sunt randate.");

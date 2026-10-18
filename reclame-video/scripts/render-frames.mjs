// Randează cadre individuale dintr-o compoziție, cu un singur bundle și un
// singur Chrome, și le pune pe o planșă. Folosire:
//   node scripts/render-frames.mjs <dosar> <compoziție>:<cadre> [<compoziție>:<cadre> ...]
// <cadre> = listă separată prin virgulă; „%25" = 25% din durată. Segmentele
// transparente primesc fundalul stilului lor (withBg), ca să se vadă ca în clip.

import { bundle } from "@remotion/bundler";
import { ensureBrowser, openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [outDir, ...specs] = process.argv.slice(2);
if (!outDir || specs.length === 0) {
  console.error("Folosire: node scripts/render-frames.mjs <dosar> <compoziție>:<cadre> ...");
  process.exit(1);
}
const dir = resolve(root, outDir);
mkdirSync(dir, { recursive: true });

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: join(root, "src/index.ts"), publicDir: join(root, "public") });
const browser = await openBrowser("chrome");
const made = [];
for (const spec of specs) {
  const [id, list] = spec.split(":");
  const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, inputProps: { withBg: true } });
  for (const tok of list.split(",")) {
    const frame = tok.startsWith("%") ? Math.round((Number(tok.slice(1)) / 100) * (composition.durationInFrames - 1)) : Math.min(Number(tok), composition.durationInFrames - 1);
    const output = join(dir, `${id}__${String(frame).padStart(4, "0")}.png`);
    const t0 = Date.now();
    await renderStill({ composition, serveUrl, output, frame, imageFormat: "png", puppeteerInstance: browser, inputProps: { ...composition.defaultProps, withBg: true } });
    console.log(`${id} cadrul ${frame}/${composition.durationInFrames}  ${Date.now() - t0} ms`);
    made.push(output);
  }
}
await browser.close({ silent: true });

// Planșa: cadrele micșorate, câte 6 pe rând.
const ffmpeg = `${process.env.LOCALAPPDATA}/CapCut/Apps/9.4.0.4015/ffmpeg.exe`;
const seq = join(dir, "_seq");
rmSync(seq, { recursive: true, force: true });
mkdirSync(seq);
made.forEach((f, i) => copyFileSync(f, join(seq, `${String(i + 1).padStart(3, "0")}.png`)));
const cols = Math.min(6, made.length);
const rowsN = Math.ceil(made.length / cols);
spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "1", "-i", join(seq, "%03d.png"), "-vf", `scale=300:533,tile=${cols}x${rowsN}:padding=6:color=0x202020`, "-frames:v", "1", join(dir, "_plansa.png")]);
rmSync(seq, { recursive: true, force: true });
console.log(`Planșa: ${join(dir, "_plansa.png")}`);

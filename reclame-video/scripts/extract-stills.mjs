// Cadre statice 9:16 (540×960) din filmări, pentru miniaturi și grile.
// Pe clipurile BonaMi decupajul e ancorat jos și scoate filigranul din
// colțurile de sus (același factor ca în src/data/footage.ts).

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ffmpeg = join(root, "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");
const outDir = join(root, "public/stills");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const CROP = { "bonami-pizza": 1.17, "bonami-mana-rotativa": 1.17, "bonami-sclipici": 1.17 };

const STILLS = [
  ["bonami-pizza", 1.0], ["bonami-pizza", 5.0], ["bonami-pizza", 9.5], ["bonami-pizza", 11.0],
  ["bonami-pizza", 15.0], ["bonami-pizza", 22.0], ["bonami-pizza", 27.0],
  ["bonami-mana-rotativa", 5.5], ["bonami-mana-rotativa", 8.2], ["bonami-mana-rotativa", 9.6],
  ["bonami-mana-rotativa", 12.5], ["bonami-mana-rotativa", 14.5],
  ["bonami-sclipici", 0.5], ["bonami-sclipici", 13.5],
  ["e45-cappuccino", 2.0], ["e45-cappuccino", 4.5], ["e45-cappuccino", 7.0], ["e45-cappuccino", 10.0],
  ["e45-cappuccino", 13.5], ["e45-cappuccino", 17.5],
  ["allto-passione-gelato", 2.5], ["allto-passione-gelato", 7.0], ["allto-passione-gelato", 17.0], ["allto-passione-gelato", 23.0],
  ["allto-tiktok-cornete", 1.0], ["allto-tiktok-cornete", 5.5], ["allto-tiktok-cornete", 14.0], ["allto-tiktok-cornete", 18.0],
  ["allto-tiktok-cafea", 2.5], ["allto-tiktok-cafea", 4.5], ["allto-tiktok-cafea", 9.0], ["allto-tiktok-cafea", 13.0],
  ["allto-rosso", 2.0], ["allto-rosso", 12.0], ["allto-rosso", 22.0], ["allto-rosso", 42.0],
];

for (const [clip, t] of STILLS) {
  const name = `${clip}-${String(t).replace(".", "_")}.jpg`;
  const c = CROP[clip] ?? 1;
  const crop = c > 1 ? `crop=iw/${c}:ih/${c}:(iw-iw/${c})/2:ih-ih/${c},` : "";
  const res = spawnSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(t), "-i", join(root, "public/footage", `${clip}.mp4`),
    "-frames:v", "1", "-vf", `${crop}scale=540:960:force_original_aspect_ratio=increase:flags=lanczos,crop=540:960`,
    "-q:v", "2", join(outDir, name),
  ], { encoding: "utf8" });
  if (res.status !== 0) throw new Error(`${name}: ${res.stderr}`);
  process.stdout.write(".");
}
console.log(`\n${STILLS.length} cadre 9:16 în public/stills`);

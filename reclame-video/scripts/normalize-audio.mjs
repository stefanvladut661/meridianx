// Aduce vocile și muzica la același nivel (EBU R128, -16 LUFS, vârfuri sub
// -1,5 dBTP), în două treceri, ca volumele din compoziție să fie previzibile.
// Timpii nu se schimbă (loudnorm liniar), deci voice-map.json rămâne valabil.
// Ieșire: public/norm/<nume>.wav

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ffmpeg = process.env.FFMPEG ?? `${process.env.LOCALAPPDATA}/CapCut/Apps/9.4.0.4015/ffmpeg.exe`;
const out = join(root, "public/norm");
mkdirSync(out, { recursive: true });

const TARGET = { I: -16, TP: -1.5, LRA: 11 };
const files = [
  ...readdirSync(join(root, "public/voci")).map((f) => join(root, "public/voci", f)),
  ...readdirSync(join(root, "public/music")).map((f) => join(root, "public/music", f)),
];

for (const file of files) {
  const first = spawnSync(ffmpeg, [
    "-hide_banner", "-nostats", "-i", file,
    "-af", `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`,
    "-f", "null", "-",
  ], { encoding: "utf8" });
  const json = first.stderr.slice(first.stderr.lastIndexOf("{"), first.stderr.lastIndexOf("}") + 1);
  const m = JSON.parse(json);
  const filter =
    `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:linear=true:` +
    `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;
  const target = join(out, basename(file).replace(/\.mp3$/, ".wav"));
  const second = spawnSync(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y", "-i", file,
    "-af", filter, "-ar", "48000", "-c:a", "pcm_s16le", target,
  ], { encoding: "utf8" });
  if (second.status !== 0) throw new Error(second.stderr);
  console.log(`${basename(file).padEnd(34)} ${m.input_i} LUFS → ${TARGET.I} LUFS (vârf ${m.input_tp} dBTP)`);
}

// Asamblează clipurile finale din segmentele randate (out/segments) după
// out/plan.json, cu ffmpeg-ul din MiniTool (are overlay, sidechain și libx264):
//  1. sunetul: vocea, muzica coborâtă automat sub voce (sidechain), efectele,
//     apoi nivel final -14 LUFS (două treceri loudnorm);
//  2. imaginea: fundalul stilului + segmentele cu alfa lipite cap la cap,
//     codate H.264 la calitate maximă (CRF 14, preset slow), 1080×1920, 30 fps.
// Mai face cele 4 body-uri complete și legăturile către exporturile transparente.
// Folosire: node scripts/assemble.mjs [--only <regex>] [--skip-bodies] [--skip-existing]

import { spawnSync } from "node:child_process";
import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MT = process.env.FFMPEG ?? "E:/MiniTool MovieMaker/bin/ffmpeg.exe";
const FPS = 30;
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const only = new RegExp(opt("--only", "."));
const skipExisting = args.includes("--skip-existing");
const plan = JSON.parse(readFileSync(join(root, "out/plan.json"), "utf8"));
const SEG = join(root, "out/segments");
const OUT = join(root, "out/final");
const TMP = join(root, "out/tmp");
for (const d of [OUT, TMP, join(OUT, "clipuri"), join(OUT, "body"), join(OUT, "transparente")]) mkdirSync(d, { recursive: true });

const MUSIC = { larven: "public/norm/house-02-744.wav", shopify: "public/norm/light-it-up-boy-849.wav" };
const MUSIC_DB = -10;
const SFX_DB = -15;
const SFX = {
  whoosh: "public/sfx/mk-1490.mp3",
  "whoosh-soft": "public/sfx/mk-166.mp3",
  swoosh: "public/sfx/mk-1461.mp3",
  pop: "public/sfx/mk-3005.mp3",
  click: "public/sfx/mk-1117.mp3",
  tick: "public/sfx/mk-1117.mp3",
  flip: "public/sfx/mk-2380.mp3",
  paper: "public/sfx/mk-1530.mp3",
};

const run = (argv, label) => {
  const r = spawnSync(MT, ["-hide_banner", "-loglevel", "error", "-y", ...argv], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${label}: ${r.stderr}`);
  return r.stderr;
};
const AF = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
// Cu ffmpeg 9, după un atrim care nu pornește de la 0, adelay mută doar timpii,
// iar amix îi ignoră: bucata cânta de la începutul clipului, peste hook.
// aresample=async=1 transformă întârzierea în liniște reală.
const DELAY = (ms) => `adelay=${ms}|${ms},aresample=async=1`;

/** Mixajul: voci + muzică cu sidechain + efecte → wav la -14 LUFS. */
function mixAudio({ D, style, voices, cues }, outWav) {
  const total = (D / FPS).toFixed(3);
  const inputs = [];
  const f = [];
  const vLabels = [];
  voices.forEach((v, k) => {
    inputs.push("-i", join(root, "public", v.src));
    const ms = Math.round((v.at / FPS) * 1000);
    f.push(`[${inputs.length / 2 - 1}:a]${AF},atrim=start=${(v.trimBefore / FPS).toFixed(4)}:duration=${(v.dur / FPS).toFixed(4)},asetpts=PTS-STARTPTS,${DELAY(ms)},apad,atrim=0:${total}[v${k}]`);
    vLabels.push(`[v${k}]`);
  });
  if (vLabels.length > 1) f.push(`${vLabels.join("")}amix=inputs=${vLabels.length}:dropout_transition=0,volume=${vLabels.length}[voice]`);
  else f.push(`${vLabels[0]}anull[voice]`);
  f.push(`[voice]asplit=2[voiceOut][voiceSC]`);
  inputs.push("-i", join(root, MUSIC[style]));
  const mi = inputs.length / 2 - 1;
  f.push(`[${mi}:a]${AF},atrim=0:${total},asetpts=PTS-STARTPTS,volume=${MUSIC_DB}dB[mus0]`);
  f.push(`[mus0][voiceSC]sidechaincompress=threshold=0.04:ratio=4:attack=15:release=380:makeup=1[duck]`);
  f.push(`[duck]afade=t=in:st=0:d=0.25,afade=t=out:st=${(D / FPS - 1.4).toFixed(3)}:d=1.4[mus]`);
  const sLabels = [];
  cues.forEach((c, k) => {
    const file = SFX[c.sfx];
    if (!file) return;
    inputs.push("-i", join(root, file));
    const ms = Math.max(0, Math.round((c.f / FPS) * 1000));
    f.push(`[${inputs.length / 2 - 1}:a]${AF},${DELAY(ms)},volume=${SFX_DB + (c.gain ?? 0)}dB,apad,atrim=0:${total}[s${k}]`);
    sLabels.push(`[s${k}]`);
  });
  const all = ["[voiceOut]", "[mus]", ...sLabels];
  f.push(`${all.join("")}amix=inputs=${all.length}:dropout_transition=0,volume=${all.length},alimiter=limit=0.9[mix]`);
  const raw = join(TMP, "mix-raw.wav");
  run([...inputs, "-filter_complex", f.join(";"), "-map", "[mix]", "-c:a", "pcm_s24le", "-ar", "48000", "-t", total, raw], "mixaj");
  // Nivel final: măsurare, apoi loudnorm liniar spre -14 LUFS.
  const m = spawnSync(MT, ["-hide_banner", "-nostats", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const j = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf("{"), m.stderr.lastIndexOf("}") + 1));
  run(
    [
      "-i",
      raw,
      "-af",
      `loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}`,
      "-ar",
      "48000",
      "-c:a",
      "pcm_s24le",
      outWav,
    ],
    "loudnorm",
  );
  return j;
}

/** Imaginea: fundal + segmente cu alfa, lipite, peste care se pune sunetul. */
function assembleVideo({ D, style, segs, audio }, outMp4) {
  for (const s of segs) if (!existsSync(join(SEG, `${s}.mov`))) throw new Error(`Lipsește segmentul ${s}.mov`);
  const inputs = ["-framerate", String(FPS), "-loop", "1", "-i", join(SEG, `bg-${style}.png`)];
  segs.forEach((s) => inputs.push("-i", join(SEG, `${s}.mov`)));
  inputs.push("-i", audio);
  const n = segs.length;
  const ai = n + 1;
  // Fără grăunte animat: nu se comprimă (un clip ajungea la 465 MB) și platformele îl reencodează oricum.
  const grain = "";
  const fc = [
    `${segs.map((_, i) => `[${i + 1}:v]`).join("")}concat=n=${n}:v=1:a=0[fg]`,
    `[0:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv444p${grain},trim=end_frame=${D},setpts=PTS-STARTPTS[bg]`,
    `[bg][fg]overlay=format=auto:eof_action=endall,format=yuv420p[v]`,
  ].join(";");
  run(
    [
      ...inputs,
      "-filter_complex",
      fc,
      "-map",
      "[v]",
      "-map",
      `${ai}:a`,
      "-frames:v",
      String(D),
      "-r",
      String(FPS),
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "14",
      "-profile:v",
      "high",
      "-level",
      "4.2",
      "-pix_fmt",
      "yuv420p",
      "-x264-params",
      "colorprim=bt709:transfer=bt709:colormatrix=bt709",
      "-c:a",
      "aac",
      "-b:a",
      "320k",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      outMp4,
    ],
    "video",
  );
}

const fmt = (j) => `${Number(j.input_i).toFixed(1)} LUFS → -14`;

// 1. Clipurile.
for (const c of plan.clips) {
  if (!only.test(c.id) && !only.test(c.file)) continue;
  const out = join(OUT, "clipuri", c.file);
  if (skipExisting && existsSync(out)) continue;
  if (c.segments.some((s) => !existsSync(join(SEG, `${s.comp}.mov`)))) {
    console.log(`${c.file}: segmente încă nerandate, sar peste`);
    continue;
  }
  const wav = join(TMP, `${c.id}.wav`);
  const t0 = Date.now();
  try {
    const j = mixAudio({ D: c.D, style: c.style, voices: c.voiceAudio, cues: c.cues }, wav);
    assembleVideo({ D: c.D, style: c.style, segs: c.segments.map((s) => s.comp), audio: wav }, out);
    console.log(`${c.file.padEnd(36)} ${(statSync(out).size / 1e6).toFixed(1)} MB  sunet ${fmt(j)}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } catch (e) {
    console.log(`${c.file}: ${String(e.message).split("\n")[0]}`);
  }
}

// 2. Body-urile complete (câte o variantă pe stil, pe fiecare voce), cu vocea și muzica.
if (!args.includes("--skip-bodies")) {
  for (const style of ["larven", "shopify"]) {
    for (const voice of ["333f", "mihai"]) {
      const c = plan.clips.find((x) => x.voice === voice && x.style === style && x.voiceAudio.length === 3);
      if (!c) continue;
      const seqs = c.segments.filter((s) => s.kind === "seq");
      const start = seqs[0].at;
      const D = seqs.reduce((n, s) => n + s.D, 0);
      const name = `body_${style}_${voice}.mp4`;
      if (!only.test(name)) continue;
      const v = c.voiceAudio[1];
      const voices = [{ ...v, at: v.at - start }];
      const cues = c.cues.filter((q) => q.f >= start && q.f < start + D).map((q) => ({ ...q, f: q.f - start }));
      try {
        const wav = join(TMP, `body-${style}-${voice}.wav`);
        const j = mixAudio({ D, style, voices, cues }, wav);
        const out = join(OUT, "body", name);
        assembleVideo({ D, style, segs: seqs.map((s) => s.comp), audio: wav }, out);
        console.log(`${name.padEnd(36)} ${(statSync(out).size / 1e6).toFixed(1)} MB  sunet ${fmt(j)}`);
      } catch (e) {
        console.log(`${name}: ${String(e.message).split("\n")[0]}`);
      }
    }
  }
}

// 3. Exporturile transparente: legături (fără copii) cu nume care spun ce sunt.
const nameFor = (comp) => {
  let m;
  if ((m = comp.match(/^hook-(\w+)-(h\d)-(\w+)$/))) return `hook_${m[3]}_${m[1]}_${m[2]}.mov`;
  if ((m = comp.match(/^seq-(\w+)-(\w+)-(\d)$/))) return `body_${m[2]}_${m[1]}_fraza${m[3]}.mov`;
  if ((m = comp.match(/^cta-(\w+)-(c\d)(complet)?-(\w+)$/))) return `cta_${m[4]}_${m[1]}_${m[2]}${m[3] ? "_din-fisierul-complet" : ""}.mov`;
  return null;
};
let linked = 0;
for (const comp of new Set(plan.clips.flatMap((c) => c.segments.map((s) => s.comp)))) {
  const src = join(SEG, `${comp}.mov`);
  const name = nameFor(comp);
  if (!name || !existsSync(src)) continue;
  const dst = join(OUT, "transparente", name);
  rmSync(dst, { force: true });
  linkSync(src, dst);
  linked++;
}
console.log(`Exporturi transparente: ${linked} fișiere în out/final/transparente`);

// Analiză rapidă a pieselor candidate (nu le pot asculta): tempo estimat,
// cât durează intro-ul liniștit, cât de constantă e energia în primele 40 s.
// Folosire: node scripts/analyze-music.mjs <fișiere.mp3...>

import { spawnSync } from "node:child_process";
import { basename } from "node:path";

const ffmpeg = `${process.env.LOCALAPPDATA}/CapCut/Apps/9.4.0.4015/ffmpeg.exe`;
const SR = 11025;

function decode(file) {
  const res = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"], {
    maxBuffer: 1 << 30,
  });
  if (res.status !== 0) throw new Error(String(res.stderr));
  const buf = res.stdout;
  const out = new Float32Array(buf.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
  return out;
}

const db = (x) => 20 * Math.log10(Math.max(1e-6, x));

for (const file of process.argv.slice(2)) {
  const s = decode(file);
  const hop = 256; // ~23 ms
  const n = Math.floor(s.length / hop);
  const rms = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = 0; k < hop; k++) acc += s[i * hop + k] ** 2;
    rms[i] = Math.sqrt(acc / hop);
  }
  // Envelopa de atac: creșterile de energie, pentru tempo.
  const onset = new Float32Array(n);
  for (let i = 1; i < n; i++) onset[i] = Math.max(0, rms[i] - rms[i - 1]);
  const fps = SR / hop;
  const window = Math.min(n, Math.round(40 * fps));
  let best = { bpm: 0, score: -1 };
  for (let bpm = 70; bpm <= 160; bpm += 0.5) {
    const lag = (60 / bpm) * fps;
    let score = 0;
    for (let i = 0; i + lag * 4 < window; i++) {
      const a = onset[i];
      score += a * (onset[Math.round(i + lag)] + onset[Math.round(i + 2 * lag)] * 0.5 + onset[Math.round(i + 4 * lag)] * 0.25);
    }
    if (score > best.score) best = { bpm, score };
  }
  // Loudness pe ferestre de o secundă.
  const sec = Math.floor(n / fps);
  const loud = [];
  for (let t = 0; t < sec; t++) {
    let acc = 0;
    const a = Math.round(t * fps);
    const b = Math.round((t + 1) * fps);
    for (let i = a; i < b; i++) acc += rms[i] ** 2;
    loud.push(db(Math.sqrt(acc / (b - a))));
  }
  const sorted = [...loud].sort((x, y) => x - y);
  const median = sorted[Math.floor(sorted.length / 2)];
  const intro = loud.findIndex((v) => v > median - 6);
  const first40 = loud.slice(0, 40);
  const mean = first40.reduce((a, b) => a + b, 0) / first40.length;
  const sd = Math.sqrt(first40.reduce((a, b) => a + (b - mean) ** 2, 0) / first40.length);
  console.log(
    `${basename(file).padEnd(14)} ${String(sec).padStart(3)} s  ~${best.bpm.toFixed(1).padStart(5)} BPM  ` +
      `median ${median.toFixed(1)} dB  intro ${intro} s  sd40 ${sd.toFixed(1)} dB  ` +
      `curve ${loud.slice(0, 40).map((v) => Math.max(0, Math.round((v - median + 12) / 3))).join("")}`,
  );
}

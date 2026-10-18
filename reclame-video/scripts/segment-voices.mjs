// Taie fișierele de voce în bucăți (hook, body, CTA) pe baza pauzelor găsite
// cu `ffmpeg silencedetect` și scrie src/data/voice-map.json.
//
// Metoda: detectăm toate pauzele de peste 70 ms, apoi granițele dintre fraze
// sunt cele mai lungi N-1 pauze, unde N e numărul de fraze cunoscut din script.
// Pauzele de virgulă (~0,2 s) sunt mereu mai scurte decât cele dintre fraze
// (~0,3–0,5 s), deci nu sunt confundate. Momentul în care vocea spune „sună"
// e începutul frazei 2 la c1 și cea mai lungă pauză din interiorul frazei 2 la c2.

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ffmpeg = join(root, "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");

const NOISE_DB = -38;
const MIN_SILENCE = 0.07;

// Câte fraze are fiecare bucată, în ordinea din fișier.
const PIECES = {
  h1: 1, h2: 1, h3: 2, h4: 2, h5: 1, h6: 1,
  b1: 5,
  c1: 2, c2: 2,
};

const FILES = [
  { voice: "333f", file: "voci/333f-hooks.mp3", pieces: ["h1", "h2", "h3", "h4", "h5", "h6"] },
  { voice: "333f", file: "voci/333f-complet-h3-b1-c2.mp3", pieces: ["h3", "b1", "c2"], complet: true },
  { voice: "333f", file: "voci/333f-cta.mp3", pieces: ["c1", "c2"] },
  { voice: "mihai", file: "voci/mihai-hooks.mp3", pieces: ["h1", "h2", "h3", "h4", "h5", "h6"] },
  { voice: "mihai", file: "voci/mihai-b1.mp3", pieces: ["b1"] },
  { voice: "mihai", file: "voci/mihai-cta.mp3", pieces: ["c1", "c2"] },
];

const round = (x) => Math.round(x * 1000) / 1000;

function analyse(file) {
  const res = spawnSync(
    ffmpeg,
    ["-hide_banner", "-nostats", "-i", join(root, "public", file),
      "-af", `silencedetect=noise=${NOISE_DB}dB:d=${MIN_SILENCE}`, "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const log = res.stderr;
  const duration = (() => {
    const m = log.match(/Duration: (\d+):(\d+):([\d.]+)/);
    if (!m) throw new Error(`Nu găsesc durata pentru ${file}`);
    return +m[1] * 3600 + +m[2] * 60 + +m[3];
  })();
  const silences = [];
  let start = null;
  for (const line of log.split(/\r?\n/)) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) start = Math.max(0, +s[1]);
    if (e && start !== null) {
      silences.push({ start, end: +e[1] });
      start = null;
    }
  }
  if (start !== null) silences.push({ start, end: duration });
  // Lipim pauzele aproape lipite (ffmpeg le raportează uneori separat).
  const merged = [];
  for (const s of silences) {
    const last = merged.at(-1);
    if (last && s.start - last.end < 0.02) last.end = s.end;
    else merged.push({ ...s });
  }
  return { duration, silences: merged };
}

function segment({ file, pieces }) {
  const { duration, silences } = analyse(file);
  const lead = silences.find((s) => s.start <= 0.01);
  const trail = silences.find((s) => s.end >= duration - 0.01);
  const speechStart = lead ? lead.end : 0;
  const speechEnd = trail ? trail.start : duration;
  const inner = silences.filter((s) => s !== lead && s !== trail);

  const phraseCount = pieces.reduce((n, p) => n + PIECES[p], 0);
  const boundaries = [...inner]
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, phraseCount - 1)
    .sort((a, b) => a.start - b.start);
  if (boundaries.length !== phraseCount - 1) {
    throw new Error(`${file}: am găsit ${boundaries.length + 1} fraze, așteptam ${phraseCount}`);
  }

  const phrases = [];
  let cursor = speechStart;
  for (const b of [...boundaries, { start: speechEnd, end: speechEnd }]) {
    const pauses = inner
      .filter((s) => s.start > cursor && s.end < b.start)
      .map((s) => ({ start: round(s.start), end: round(s.end) }));
    phrases.push({ start: round(cursor), end: round(b.start), pauses });
    cursor = b.end;
  }

  const shortest = Math.min(...boundaries.map((b) => b.end - b.start));
  const longestInner = Math.max(0, ...phrases.flatMap((p) => p.pauses.map((s) => s.end - s.start)));

  const out = {};
  let i = 0;
  for (const piece of pieces) {
    const own = phrases.slice(i, i + PIECES[piece]);
    i += PIECES[piece];
    const entry = { file, start: own[0].start, end: own.at(-1).end, phrases: own };
    if (piece === "c1") entry.suna = own[1].start;
    if (piece === "c2") {
      const comma = [...own[1].pauses].sort((a, b) => b.end - b.start - (a.end - a.start))[0];
      if (!comma) throw new Error(`${file}: nu găsesc pauza de virgulă dinaintea lui „sună"`);
      entry.suna = comma.end;
    }
    out[piece] = entry;
  }
  return { duration: round(duration), margin: round(shortest - longestInner), pieces: out };
}

const map = { generatedAt: new Date().toISOString(), noiseDb: NOISE_DB, minSilence: MIN_SILENCE, voices: {} };
for (const f of FILES) {
  const seg = segment(f);
  const v = (map.voices[f.voice] ??= { pieces: {}, complet: null });
  if (f.complet) v.complet = { file: f.file, duration: seg.duration, pieces: seg.pieces };
  else Object.assign(v.pieces, seg.pieces);
  console.log(
    `${f.file.padEnd(34)} ${String(seg.duration).padStart(6)} s  ` +
      `fraze: ${Object.values(seg.pieces).reduce((n, p) => n + p.phrases.length, 0)}  ` +
      `marjă pauză frază vs. virgulă: ${seg.margin.toFixed(3)} s`,
  );
}
// Body-ul vocii 333f există doar în fișierul complet.
map.voices["333f"].pieces.b1 = map.voices["333f"].complet.pieces.b1;

const target = join(root, "src/data/voice-map.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(map, null, 2) + "\n");
console.log(`\nScris ${target}`);

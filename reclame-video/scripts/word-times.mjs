// Timpii fiecărui cuvânt, pentru textul care apare pe ecran pe voce.
// Transcrierile vin din tools/asr (Whisper prin transformers.js, cu timpi pe
// cuvânt). Aici cuvintele auzite se aliniază la textul știut (Needleman-
// Wunsch pe cuvinte normalizate); unde whisper a auzit altceva, timpul se
// interpolează între vecinii potriviți. Granițele dintre fraze rămân cele din
// silencedetect (scripts/segment-voices.mjs).
//
// Rezultat: src/data/word-times.json — { "voci/<fișier>.mp3": [{ text, start, end }] }

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const T = {
  h1: "Căutăm trei restaurante din Sectorul 6 pe care să le ajutăm să se dezvolte.",
  h2: "Căutăm trei restaurante din Sectorul 6 pentru un parteneriat de marketing pe termen lung.",
  h3: "Bucătăria ta are un șef. Imaginea ta online are?",
  h4: "Ai construit un restaurant bun. Imaginea lui online ar trebui să arate la fel.",
  h5: "Prezența online a restaurantului tău n-ar trebui să depindă de timpul tău liber.",
  h6: "Mâncarea bună nu se mai promovează singură.",
  b1:
    "Ne ocupăm de tot ce ține de imaginea online. Venim cu ideile și scriem scenariile. " +
    "Facem cinematografie gastronomică, cu echipament profesional. " +
    "Edităm, publicăm și administrăm campaniile de promovare care aduc oameni noi la masă. " +
    "În fiecare lună primești o analiză de performanță și propuneri pentru luna următoare.",
  c1: "Totul începe cu o analiză a prezenței tale online și o ofertă de colaborare. Sună la numărul de telefon de pe ecran.",
  c2: "Căutăm parteneri pe termen lung. Dacă și tu cauți la fel, sună la numărul de telefon de pe ecran.",
};

const FILES = {
  "333f-hooks": ["h1", "h2", "h3", "h4", "h5", "h6"],
  "333f-complet-h3-b1-c2": ["h3", "b1", "c2"],
  "333f-cta": ["c1", "c2"],
  "mihai-hooks": ["h1", "h2", "h3", "h4", "h5", "h6"],
  "mihai-b1": ["b1"],
  "mihai-cta": ["c1", "c2"],
};

const norm = (w) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const wdist = (a, b) => {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 1;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n] / Math.max(m, n);
};

function align(expected, heard) {
  const E = expected.map(norm);
  const H = heard.map((h) => norm(h.text));
  const GAP = 0.7;
  const m = E.length;
  const n = H.length;
  const s = Array.from({ length: m + 1 }, () => new Float64Array(n + 1));
  const bt = Array.from({ length: m + 1 }, () => new Uint8Array(n + 1));
  for (let i = 1; i <= m; i++) (s[i][0] = i * GAP), (bt[i][0] = 1);
  for (let j = 1; j <= n; j++) (s[0][j] = j * GAP), (bt[0][j] = 2);
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const diag = s[i - 1][j - 1] + wdist(E[i - 1], H[j - 1]) * 1.4;
      const up = s[i - 1][j] + GAP;
      const left = s[i][j - 1] + GAP;
      const best = Math.min(diag, up, left);
      s[i][j] = best;
      bt[i][j] = best === diag ? 0 : best === up ? 1 : 2;
    }
  const match = new Array(m).fill(-1);
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const b = i > 0 && j > 0 ? bt[i][j] : i > 0 ? 1 : 2;
    if (b === 0) {
      if (wdist(E[i - 1], H[j - 1]) < 0.6) match[i - 1] = j - 1;
      i--, j--;
    } else if (b === 1) i--;
    else j--;
  }
  return match;
}

const result = {};
for (const [name, pieces] of Object.entries(FILES)) {
  const heard = JSON.parse(readFileSync(join(root, "tools/asr/out", `${name}.json`), "utf8")).words;
  // Whisper scrie uneori „n-ar" ca două cuvinte; lipim după cratimă.
  const merged = [];
  for (const w of heard) {
    if (merged.length && (/^-/.test(w.text) || /-$/.test(merged.at(-1).text))) {
      merged.at(-1).text += w.text;
      merged.at(-1).end = w.end;
    } else merged.push({ ...w });
  }
  const expected = pieces.flatMap((p) => T[p].split(/\s+/));
  const match = align(expected, merged);
  const words = expected.map((text, k) => (match[k] >= 0 ? { text, start: merged[match[k]].start, end: merged[match[k]].end } : { text, start: null, end: null }));
  for (let k = 0; k < words.length; k++) {
    if (words[k].start !== null) continue;
    let a = k - 1;
    while (a >= 0 && words[a].start === null) a--;
    let b = k + 1;
    while (b < words.length && words[b].start === null) b++;
    const t0 = a >= 0 ? words[a].end : 0;
    const t1 = b < words.length ? words[b].start : t0 + 0.35 * (b - a);
    words[k].start = t0 + ((t1 - t0) * (k - a - 1)) / (b - a);
    words[k].end = t0 + ((t1 - t0) * (k - a)) / (b - a);
  }
  const matched = match.filter((x) => x >= 0).length;
  console.log(`${name.padEnd(24)} ${matched}/${expected.length} cuvinte potrivite`);
  result[`voci/${name}.mp3`] = words.map((w) => ({ text: w.text, start: Math.round(w.start * 1000) / 1000, end: Math.round(w.end * 1000) / 1000 }));
}

writeFileSync(join(root, "src/data/word-times.json"), JSON.stringify(result, null, 1) + "\n");
console.log("Scris src/data/word-times.json");

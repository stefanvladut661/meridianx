// Momentul în care începe fiecare cuvânt, estimat din limitele frazei găsite
// cu silencedetect: timpul de vorbire (fraza minus pauzele interioare) se
// împarte proporțional cu lungimea cuvintelor. După o virgulă, cuvântul
// următor e mutat la capătul pauzei reale din apropiere.

export type Pause = { start: number; end: number };
export type PhraseTiming = { start: number; end: number; pauses: Pause[] };
export type TimedWord = { text: string; start: number };

const letters = (w: string) => (w.match(/[\p{L}\p{N}]/gu) ?? []).length;

export function timeWords(text: string, ph: PhraseTiming): TimedWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  const weights = words.map((w) => letters(w) + 1.2);
  const total = weights.reduce((a, b) => a + b, 0);

  const spans: [number, number][] = [];
  let cursor = ph.start;
  for (const q of [...ph.pauses].sort((a, b) => a.start - b.start)) {
    if (q.start > cursor) spans.push([cursor, q.start]);
    cursor = Math.max(cursor, q.end);
  }
  if (ph.end > cursor) spans.push([cursor, ph.end]);
  const speech = spans.reduce((n, [s, e]) => n + e - s, 0);

  const at = (x: number) => {
    let rest = x;
    for (const [s, e] of spans) {
      if (rest < e - s) return s + rest;
      rest -= e - s;
    }
    return ph.end;
  };

  let acc = 0;
  const out = words.map((text, i) => {
    const start = at((acc / total) * speech);
    acc += weights[i];
    return { text, start };
  });

  for (let i = 0; i < out.length - 1; i++) {
    if (!/[,;:]$/.test(out[i].text)) continue;
    const near = ph.pauses
      .filter((q) => Math.abs(q.end - out[i + 1].start) < 0.45)
      .sort((a, b) => b.end - b.start - (a.end - a.start))[0];
    if (near) out[i + 1].start = near.end;
  }
  return out;
}

/** Cuvintele unui șir de fraze, cu timpii lor, într-o singură listă. */
export const timePhrases = (texts: string[], phrases: PhraseTiming[]) =>
  texts.flatMap((t, i) => timeWords(t, phrases[i]));

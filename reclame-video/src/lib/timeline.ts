import voiceMap from "../data/voice-map.json";
import wordTimes from "../data/word-times.json";
import { ClipDef, CtaId, FILE_PIECES, HookId, PIECE_TEXT, PieceId, VoiceId } from "../data/script";
import { timeWords } from "./words";

// Un clip = trei segmente lipite cap la cap: hook, body, CTA. Fiecare segment
// are timpul lui local (cadre de la 0) și își poartă bucata de voce. Body-ul
// și CTA-urile sunt aceleași în toate clipurile cu aceeași voce, deci se
// randează o singură dată și se refolosesc.

export const FPS = 30;
/** Tăietura cade cu atâtea cadre înaintea primului cuvânt al frazei. */
export const LEAD = 4;
/** Cadre de liniște la începutul clipului, înaintea primului cuvânt. */
export const HOOK_LEAD = 3;
/** Cât rămâne numărul pe ecran după ce vocea se oprește. */
export const HOLD = 2.2;
const POST = 0.12;
const GAP_HOOK_BODY = 0.42;
const GAP_BODY_CTA_MIHAI = 0.38;

export type WordT = { text: string; f: number; fe: number };
export type PhraseT = { f0: number; f1: number; words: WordT[] };
export type AudioPlace = { src: string; at: number; trimBefore: number; dur: number };
export type Seg = {
  D: number;
  phrases: PhraseT[];
  words: WordT[];
  audio: AudioPlace | null;
  /** La CTA: cadrul în care vocea spune „sună”. */
  suna?: number;
};

type RawPhrase = { start: number; end: number; pauses: { start: number; end: number }[] };
type RawPiece = { file: string; start: number; end: number; phrases: RawPhrase[]; suna?: number };
type VoiceEntry = { pieces: Record<string, RawPiece>; complet: { file: string; duration: number; pieces: Record<string, RawPiece> } | null };
const voices = voiceMap.voices as unknown as Record<VoiceId, VoiceEntry>;
const whisper = wordTimes as unknown as Record<string, { text: string; start: number; end: number }[]>;

/** Vocile normalizate (scripts/normalize-audio.mjs) au aceiași timpi ca originalele. */
export const normSrc = (file: string) => file.replace(/^voci\//, "norm/").replace(/\.mp3$/, ".wav");

const count = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Cuvintele unei bucăți, în secunde din fișierul sursă, pe fraze. */
function sourceWords(file: string, piece: PieceId, raw: RawPiece) {
  const order = FILE_PIECES[file];
  let k = order.slice(0, order.indexOf(piece)).reduce((n, p) => n + PIECE_TEXT[p].reduce((m, t) => m + count(t), 0), 0);
  const all = whisper[file];
  return raw.phrases.map((ph, i) => {
    const text = PIECE_TEXT[piece][i];
    const n = count(text);
    const w = all ? all.slice(k, k + n) : [];
    k += n;
    const inside = w.filter((x) => x.start >= ph.start - 0.3 && x.start <= ph.end + 0.1).length;
    if (w.length === n && inside >= n * 0.8) {
      // Whisper pune începutul cuvântului cu ~60–100 ms după sunet; primul
      // cuvânt al frazei îl lipim de capătul pauzei găsite de silencedetect.
      return {
        start: ph.start,
        end: ph.end,
        words: w.map((x, j) => ({
          text: x.text,
          start: j === 0 ? ph.start : Math.max(ph.start, Math.min(ph.end - 0.05, x.start - 0.04)),
          end: Math.min(ph.end, x.end),
        })),
      };
    }
    const est = timeWords(text, ph);
    return { start: ph.start, end: ph.end, words: est.map((x, j) => ({ text: x.text, start: x.start, end: j < est.length - 1 ? est[j + 1].start : ph.end })) };
  });
}

/** Segmentul în care cadrul local 0 corespunde cadrului `srcStart` din fișier. */
function segment(file: string, piece: PieceId, raw: RawPiece, srcStart: number, D: number, audioEnd: number): Seg {
  const toLocal = (t: number) => t * FPS - srcStart;
  const phrases = sourceWords(file, piece, raw).map((ph) => ({
    f0: toLocal(ph.start),
    f1: toLocal(ph.end),
    words: ph.words.map((w) => ({ text: w.text, f: toLocal(w.start), fe: toLocal(w.end) })),
  }));
  return {
    D,
    phrases,
    words: phrases.flatMap((p) => p.words),
    audio: {
      src: normSrc(file),
      at: Math.max(0, -srcStart),
      trimBefore: Math.max(0, srcStart),
      dur: Math.ceil(audioEnd * FPS) - Math.max(0, srcStart),
    },
    suna: raw.suna === undefined ? undefined : toLocal(raw.suna),
  };
}

const usesComplete = (voice: VoiceId, hook: HookId, cta: CtaId) => voice === "333f" && hook === "h3" && cta === "c2";

/** Body-ul: același pentru toate clipurile unei voci. */
export function bodySeg(voice: VoiceId): Seg {
  const v = voices[voice];
  const raw = v.pieces.b1;
  const srcStart = Math.round(raw.start * FPS) - LEAD;
  let ctaFirst: number;
  if (voice === "333f" && v.complet) {
    // Lungimea vine din fișierul complet, ca body-ul să fie identic și în 333f h3-c2.
    ctaFirst = v.complet.pieces.c2.start * FPS - srcStart;
  } else {
    ctaFirst = (raw.end + GAP_BODY_CTA_MIHAI) * FPS - srcStart;
  }
  const D = Math.round(ctaFirst) - LEAD;
  return segment(raw.file, "b1", raw, srcStart, D, raw.end + POST);
}

/** Ferestrele celor 5 secvențe ale body-ului, în cadre locale ale body-ului. */
export function bodyWindows(body: Seg) {
  const starts = body.phrases.map((ph, i) => (i === 0 ? 0 : Math.round(ph.f0) - LEAD));
  return starts.map((s, i) => ({ from: s, D: (i < starts.length - 1 ? starts[i + 1] : body.D) - s }));
}

/** Fraza `i` a body-ului, mutată în timpul local al secvenței ei. */
export function bodySeqSeg(body: Seg, i: number): Seg {
  const w = bodyWindows(body)[i];
  const ph = body.phrases[i];
  const shifted = { f0: ph.f0 - w.from, f1: ph.f1 - w.from, words: ph.words.map((x) => ({ ...x, f: x.f - w.from, fe: x.fe - w.from })) };
  return { D: w.D, phrases: [shifted], words: shifted.words, audio: null };
}

export function hookSeg(voice: VoiceId, hook: HookId, cta: CtaId): Seg {
  const v = voices[voice];
  const body = voices[voice].pieces.b1;
  if (usesComplete(voice, hook, cta) && v.complet) {
    const raw = v.complet.pieces.h3;
    const srcStart = -HOOK_LEAD;
    const D = Math.round(body.start * FPS - srcStart) - LEAD;
    const seg = segment(v.complet.file, "h3", raw, srcStart, D, 0);
    // În clipul cu fișierul complet, vocea e un singur fișier, pus de hook.
    seg.audio = { src: normSrc(v.complet.file), at: HOOK_LEAD, trimBefore: 0, dur: Math.ceil(v.complet.duration * FPS) };
    return seg;
  }
  const raw = v.pieces[hook];
  const srcStart = Math.round(raw.start * FPS) - HOOK_LEAD;
  const D = Math.round((raw.end + GAP_HOOK_BODY) * FPS - srcStart) - LEAD;
  return segment(raw.file, hook, raw, srcStart, D, raw.end + POST);
}

export function ctaSeg(voice: VoiceId, cta: CtaId, complete: boolean): Seg {
  const v = voices[voice];
  const raw = complete && v.complet ? v.complet.pieces.c2 : v.pieces[cta];
  const piece: PieceId = complete ? "c2" : cta;
  const srcStart = Math.round(raw.start * FPS) - LEAD;
  const D = Math.round((raw.end + HOLD) * FPS) - srcStart;
  const seg = segment(raw.file, piece, raw, srcStart, D, raw.end + POST);
  if (complete) seg.audio = null;
  return seg;
}

export type ClipPlan = {
  hook: Seg;
  body: Seg;
  cta: Seg;
  /** Cadrul absolut la care începe fiecare segment. */
  at: { hook: number; body: number; cta: number };
  D: number;
  complete: boolean;
};

export function clipPlan(c: Pick<ClipDef, "voice" | "hook" | "cta">): ClipPlan {
  const complete = usesComplete(c.voice, c.hook, c.cta);
  const hook = hookSeg(c.voice, c.hook, c.cta);
  const shared = bodySeg(c.voice);
  // În clipul cu fișierul complet, toată vocea vine din segmentul de hook.
  const body = complete ? { ...shared, audio: null } : shared;
  const cta = ctaSeg(c.voice, c.cta, complete);
  const at = { hook: 0, body: hook.D, cta: hook.D + body.D };
  return { hook, body, cta, at, D: at.cta + cta.D, complete };
}

/** Intervalele de vorbire (cadre absolute), pentru coborârea muzicii. */
export function speechSpans(plan: ClipPlan): [number, number][] {
  const spans: [number, number][] = [];
  for (const [seg, off] of [
    [plan.hook, plan.at.hook],
    [plan.body, plan.at.body],
    [plan.cta, plan.at.cta],
  ] as const)
    for (const ph of seg.phrases) spans.push([ph.f0 + off, ph.f1 + off]);
  return spans;
}

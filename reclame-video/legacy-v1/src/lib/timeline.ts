import voiceMap from "../data/voice-map.json";
import type { CtaId, HookId, VoiceId } from "../data/script";
import type { PhraseTiming } from "./words";

export const FPS = 30;

type Piece = { file: string; start: number; end: number; phrases: PhraseTiming[]; suna?: number };

export type AudioPart = { src: string; at: number; trimBefore: number; durationInFrames: number };

export type Timeline = {
  audio: AudioPart[];
  hook: Piece;
  body: Piece;
  cta: Piece & { suna: number };
  /** Ultimul cadru: după ce vocea se oprește, numărul rămâne pe ecran HOLD secunde. */
  durationInFrames: number;
};

type VoiceEntry = {
  pieces: Record<string, Piece>;
  complet: { file: string; duration: number; pieces: Record<string, Piece> } | null;
};
const voices = voiceMap.voices as unknown as Record<VoiceId, VoiceEntry>;

// Pauzele dintre bucăți, apropiate de cele naturale ale vocilor (0,3–0,5 s).
const PRE = 0.05;
const POST = 0.1;
const GAP_HOOK_BODY = 0.42;
const GAP_BODY_CTA = 0.38;
export const HOLD = 1.9;

const shift = (piece: Piece, d: number): Piece => ({
  ...piece,
  start: piece.start + d,
  end: piece.end + d,
  suna: piece.suna === undefined ? undefined : piece.suna + d,
  phrases: piece.phrases.map((ph) => ({
    start: ph.start + d,
    end: ph.end + d,
    pauses: ph.pauses.map((q) => ({ start: q.start + d, end: q.end + d })),
  })),
});

const withSuna = (piece: Piece) => {
  if (piece.suna === undefined) throw new Error(`Lipsește momentul „sună" în ${piece.file}`);
  return piece as Piece & { suna: number };
};

export function buildTimeline(voice: VoiceId, hook: HookId, cta: CtaId): Timeline {
  const v = voices[voice];

  // 333f h3-c2 folosește direct fișierul complet, fără tăieturi.
  if (voice === "333f" && hook === "h3" && cta === "c2" && v.complet) {
    const c = v.complet;
    const end = c.pieces.c2.end;
    return {
      audio: [{ src: c.file, at: 0, trimBefore: 0, durationInFrames: Math.ceil(c.duration * FPS) }],
      hook: c.pieces.h3,
      body: c.pieces.b1,
      cta: withSuna(c.pieces.c2),
      durationInFrames: Math.ceil((end + HOLD) * FPS),
    };
  }

  const audio: AudioPart[] = [];
  // Așază bucata astfel încât vorbirea ei să înceapă la `speechAt` (secunde în clip).
  const place = (piece: Piece, speechAt: number) => {
    const trimBefore = Math.max(0, Math.floor((piece.start - PRE) * FPS));
    const at = Math.max(0, Math.round((speechAt - piece.start) * FPS + trimBefore));
    const d = at / FPS - trimBefore / FPS;
    audio.push({
      src: piece.file,
      at,
      trimBefore,
      durationInFrames: Math.ceil((piece.end + POST) * FPS) - trimBefore,
    });
    return shift(piece, d);
  };

  const h = place(v.pieces[hook], PRE);
  const b = place(v.pieces.b1, h.end + GAP_HOOK_BODY);
  const c = withSuna(place(v.pieces[cta], b.end + GAP_BODY_CTA));
  return { audio, hook: h, body: b, cta: c, durationInFrames: Math.ceil((c.end + HOLD) * FPS) };
}

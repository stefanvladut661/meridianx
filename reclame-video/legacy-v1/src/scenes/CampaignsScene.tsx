import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CheckIcon, MeridianMark } from "../components/icons";
import { MetaFeedScreen, PHONE_H, PHONE_W, PhoneFrame, TikTokScreen } from "../components/Phone";
import { WordLines, WordSpec } from "../components/Text";
import { GRID_STILLS, PHONE_CLIPS } from "../data/footage";
import { easeInOut, mix, p } from "../lib/anim";
import type { Layout } from "../lib/layout";
import { C, FONT } from "../theme";

// „Edităm, publicăm și administrăm campaniile de promovare care aduc oameni
// noi la masă." Patru bătăi, legate de cuvintele vocii:
//  1. „Edităm" — chenarul de sticlă devine o celulă într-o grilă care se umple
//     cu reclame (grila „Making ads" din referință);
//  2. „publicăm" — două telefoane peste grila încețoșată (faza „Publishing");
//  3. „administrăm campaniile" — grila înclinată, cu câteva reclame scoase în
//     față și marcate „Live" (faza „Live on Meta", fără cifre inventate);
//  4. „oameni noi la masă" — text mare, ca în cadrele de final ale referinței.

const COLS = 6;
const ROWS = 9;
const TW = 200;
const TH = 250;
const GAP = 24;
const PW = COLS * TW + (COLS - 1) * GAP;
const PH = ROWS * TH + (ROWS - 1) * GAP;
const HIGHLIGHT = new Set([14, 21, 27, 20, 33, 26, 39]);

const tiles = Array.from({ length: COLS * ROWS }, (_, i) => {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  const dx = c - (COLS - 1) / 2;
  const dy = r - (ROWS - 1) / 2;
  return { i, c, r, d: Math.hypot(dx, dy * 1.1) };
});
const rank = new Map([...tiles].sort((a, b) => a.d - b.d).map((t, k) => [t.i, k]));

export const CampaignsScene: React.FC<{
  L: Layout;
  start: number;
  end: number;
  pubAt: number;
  admAt: number;
  masaAt: number;
  masaWords: WordSpec[];
}> = ({ L, start, end, pubAt, admAt, masaAt, masaWords }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = L.content;
  const cy = T + 440;

  const phonesOut = Math.min(masaAt - 30, Math.max(admAt + 24, pubAt + 44));
  const pull = p(frame, start - 4, 26, easeInOut);
  const tilt = p(frame, phonesOut - 6, 22, easeInOut);
  const phonesIn = p(frame, pubAt - 4, 16);
  const phonesExit = p(frame, phonesOut - 6, 12, easeInOut);
  const phones = phonesIn * (1 - phonesExit);
  const live = p(frame, phonesOut + 2, 14);
  const masa = p(frame, masaAt - 4, 12, easeInOut);
  const exit = p(frame, end - 6, 14, easeInOut);

  const scale = mix(2.25, 1.02, pull) * mix(1, 0.92, tilt) * mix(1, 1.06, masa);
  const blur = 9 * phones + 5 * masa;
  const bright = 1 - 0.55 * phones - 0.55 * masa;
  const dim = live > 0 ? `brightness(${1 - 0.55 * live}) saturate(${1 - 0.75 * live})` : "";

  return (
    <AbsoluteFill style={{ fontFamily: FONT, opacity: 1 - exit, filter: exit > 0 ? `blur(${exit * 12}px)` : undefined }}>
      {/* Filtrul stă pe containerul cu perspectivă: pe planul 3D ar turti ridicarea celulelor. */}
      <AbsoluteFill
        style={{
          perspective: 1900,
          perspectiveOrigin: `540px ${cy}px`,
          filter: blur > 0 || bright < 1 ? `blur(${blur}px) brightness(${bright})` : undefined,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 540 - PW / 2,
            top: cy - PH / 2,
            width: PW,
            height: PH,
            transformStyle: "preserve-3d",
            transform: `rotateX(${34 * tilt}deg) rotateZ(${-22 * tilt}deg) scale(${scale})`,
          }}
        >
          {tiles.map((t) => {
            const at = start + 2 + (rank.get(t.i) ?? 0) * 0.55;
            const f = p(frame, at, 10);
            const hi = HIGHLIGHT.has(t.i) ? live : 0;
            const src = GRID_STILLS[t.i % GRID_STILLS.length];
            return (
              <div
                key={t.i}
                style={{
                  position: "absolute",
                  left: t.c * (TW + GAP),
                  top: t.r * (TH + GAP),
                  width: TW,
                  height: TH,
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "#121318",
                  border: "1px solid rgba(255,255,255,0.06)",
                  transform: `translateZ(${hi * 70}px) scale(${1 + hi * 0.08})`,
                  boxShadow: hi > 0 ? `0 0 0 ${3 * hi}px #3C7DFF, 0 0 ${40 * hi}px rgba(60,125,255,0.7)` : undefined,
                }}
              >
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.18 }}>
                  <MeridianMark size={64} color="#C9D3EA" />
                </div>
                {f > 0 && (
                  <Img
                    src={staticFile(src)}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      opacity: f,
                      transform: `scale(${mix(1.25, 1, f)})`,
                      filter: `${f < 1 ? `blur(${(1 - f) * 10}px) ` : ""}${HIGHLIGHT.has(t.i) ? "" : dim}`.trim() || undefined,
                    }}
                  />
                )}
                {hi > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 12,
                      bottom: 12,
                      height: 36,
                      padding: "0 14px",
                      borderRadius: 18,
                      background: "#2F6BFF",
                      color: "#fff",
                      fontSize: 19,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      opacity: hi,
                      boxShadow: "0 6px 20px rgba(47,107,255,0.6)",
                    }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: 5, background: "#fff" }} />
                    LIVE
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {phones > 0 && (
        <>
          {[
            { x: 84, label: "Facebook & Instagram", el: <MetaFeedScreen src={PHONE_CLIPS.meta.src} from={PHONE_CLIPS.meta.from} fps={fps} />, d: 0 },
            { x: 592, label: "TikTok", el: <TikTokScreen src={PHONE_CLIPS.tiktok.src} from={PHONE_CLIPS.tiktok.from} fps={fps} />, d: 4 },
          ].map((ph) => {
            const t = p(frame, pubAt - 4 + ph.d, 16) * (1 - phonesExit);
            return (
              <div
                key={ph.label}
                style={{
                  position: "absolute",
                  left: ph.x,
                  top: T + 40,
                  width: PHONE_W,
                  opacity: Math.min(1, t * 2),
                  transform: `perspective(1600px) translateY(${mix(280, 0, t) + 120 * phonesExit}px) rotateX(${mix(28, 0, t)}deg)`,
                  filter: t < 0.95 ? `blur(${(1 - t) * 12}px)` : undefined,
                }}
              >
                <div style={{ height: 0, position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 14,
                      left: 0,
                      right: 0,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 24,
                      fontWeight: 500,
                      color: "#C9CFDB",
                    }}
                  >
                    {ph.label}
                    <CheckIcon size={28} color={C.green} progress={p(frame, pubAt + 14 + ph.d, 8)} stroke={3} />
                  </div>
                </div>
                <div style={{ height: PHONE_H }}>
                  <PhoneFrame>{ph.el}</PhoneFrame>
                </div>
              </div>
            );
          })}
        </>
      )}

      {masa > 0 && (
        <WordLines
          words={masaWords}
          lines={[2, 2]}
          frame={frame}
          color={C.ink}
          style={{ position: "absolute", left: 0, right: 0, top: cy - 150, fontSize: 138, fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1.04 }}
        />
      )}
      {masa > 0 && (
        <div
          style={{
            position: "absolute",
            left: 540 - 250,
            top: cy + 150,
            width: 500 * p(frame, (masaWords.at(-1)?.at ?? masaAt) + 4, 14),
            height: 7,
            borderRadius: 4,
            background: "#3C7DFF",
            boxShadow: "0 0 18px rgba(60,125,255,0.8)",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

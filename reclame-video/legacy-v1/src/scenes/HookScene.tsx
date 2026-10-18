import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ArrowUpRight, LinkIcon } from "../components/icons";
import { glassPill } from "../components/Glass";
import { WordLines, WordSpec } from "../components/Text";
import { DEMO, HookDef } from "../data/script";
import { easeInOut, mix, p } from "../lib/anim";
import type { Layout, Rect } from "../lib/layout";
import { C, FONT } from "../theme";

// Hookul: titlul mare din hero-ul de referință (alb, cu partea a doua gri),
// intrat în 3D ca bara de URL din primele cadre ale video-ului de referință.
// Sub titlu apare bara în care se tastează adresa restaurantului; clicul pe
// „Analizează" pornește body-ul, iar bara devine pastila de stare.

const EYEBROW_H = 58;
const BAR_H = 120;

export const hookLayout = (L: Layout, hook: HookDef) => {
  const lines = hook.phrases.flatMap((ph) => ph.lines);
  const maxChars = Math.max(...lines.map((l) => l.length));
  const fontSize = Math.round(Math.min(118, 930 / (maxChars * 0.5)));
  const titleH = lines.length * fontSize * 1.04;
  const groupH = EYEBROW_H + 44 + titleH + 64 + BAR_H;
  const y0 = L.stage + (1000 - groupH) / 2;
  const bar: Rect = { x: 90, y: y0 + EYEBROW_H + 44 + titleH + 64, w: 900, h: BAR_H };
  return { lines, fontSize, titleY: y0 + EYEBROW_H + 44, eyebrowY: y0, bar };
};

export const HookScene: React.FC<{
  L: Layout;
  hook: HookDef;
  words: WordSpec[];
  /** Cadrul în care începe body-ul (clicul pe buton). */
  end: number;
  /** Cadrul în care începe ultima frază a hookului. */
  lastPhraseAt: number;
}> = ({ L, hook, words, end, lastPhraseAt }) => {
  const frame = useCurrentFrame();
  const { fontSize, titleY, eyebrowY, bar } = hookLayout(L, hook);
  const counts = hook.phrases.flatMap((ph) => ph.lines.map((l) => l.split(" ").length));

  // Intrarea 3D a întregului grup.
  const e = p(frame, 0, 20);
  const group: React.CSSProperties = {
    transform: `perspective(1600px) translateY(${mix(240, 0, e)}px) rotateX(${mix(58, 0, e)}deg) rotateZ(${mix(-20, 0, e)}deg) scale(${mix(0.74, 1, e)})`,
    transformOrigin: `540px ${bar.y}px`,
    opacity: p(frame, 0, 7),
    filter: e < 1 ? `blur(${(1 - e) * 8}px)` : undefined,
  };

  // Ieșirea titlului, când pornește body-ul.
  const x = p(frame, end - 8, 12, easeInOut);
  const titleExit: React.CSSProperties = {
    opacity: 1 - x,
    transform: `translateY(${-90 * x}px) scale(${1 - 0.05 * x})`,
    filter: x > 0 ? `blur(${x * 16}px)` : undefined,
  };

  // Bara: apare în a doua parte a hookului, se tastează adresa, apoi clic.
  const inputAt = Math.max(lastPhraseAt + 8, end - 52);
  const barIn = p(frame, inputAt, 14);
  const typeAt = inputAt + 8;
  const typed = DEMO.domain.slice(0, Math.max(0, Math.min(DEMO.domain.length, Math.floor((frame - typeAt) / 1.45))));
  const caretOn = frame < end - 10 ? Math.floor(frame / 8) % 2 === 0 || typed.length < DEMO.domain.length : false;
  const press = p(frame, end - 7, 4) * (1 - p(frame, end - 3, 5));
  const cur = p(frame, end - 24, 16, easeInOut);
  const ripple = p(frame, end - 4, 20);
  const sheen = p(frame, typeAt, 34, easeInOut);
  const barVisible = frame < end;

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div style={{ position: "absolute", inset: 0, ...group }}>
        <div style={titleExit}>
          <div style={{ position: "absolute", top: eyebrowY, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <div
              style={{
                ...glassPill(EYEBROW_H),
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "0 28px",
                color: "#AFC2EA",
                fontSize: 21,
                fontWeight: 600,
                letterSpacing: "0.16em",
                boxShadow: "0 0 24px rgba(46,110,255,0.22)",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 5, background: "#5C93FF", boxShadow: "0 0 10px #5C93FF" }} />
              MARKETING PENTRU RESTAURANTE
            </div>
          </div>
          <WordLines
            words={words}
            lines={counts}
            frame={frame}
            color={C.ink}
            style={{
              position: "absolute",
              top: titleY,
              left: 0,
              right: 0,
              fontSize,
              lineHeight: 1.04,
              fontWeight: 500,
              letterSpacing: "-0.035em",
            }}
          />
        </div>

        {barVisible && (
          <div
            style={{
              position: "absolute",
              left: bar.x,
              top: bar.y,
              width: bar.w,
              ...glassPill(bar.h),
              opacity: barIn,
              transform: `translateY(${mix(40, 0, barIn)}px) scale(${mix(0.96, 1, barIn)})`,
              filter: barIn < 1 ? `blur(${(1 - barIn) * 10}px)` : undefined,
              display: "flex",
              alignItems: "center",
              padding: "0 16px 0 40px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(100deg, rgba(255,255,255,0) ${sheen * 120 - 30}%, rgba(170,200,255,0.12) ${sheen * 120 - 10}%, rgba(255,255,255,0) ${sheen * 120 + 10}%)`,
              }}
            />
            <LinkIcon size={34} />
            <div style={{ marginLeft: 18, fontSize: 37, color: "#E6E9EF", display: "flex", alignItems: "center", opacity: 1 - p(frame, end - 4, 4) }}>
              {typed || <span style={{ color: "#5E6472" }}>adresa restaurantului</span>}
              <span style={{ width: 3, height: 42, marginLeft: 3, background: "#5C93FF", opacity: caretOn ? 1 : 0 }} />
            </div>
            <div
              style={{
                marginLeft: "auto",
                height: 88,
                padding: "0 30px 0 36px",
                borderRadius: 44,
                background: "#fff",
                color: "#0B0D12",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 33,
                fontWeight: 500,
                transform: `scale(${1 - press * 0.06})`,
                boxShadow: "0 0 30px rgba(120,160,255,0.35)",
                position: "relative",
              }}
            >
              Analizează
              <ArrowUpRight size={28} />
              {ripple > 0 && ripple < 1 && (
                <div
                  style={{
                    position: "absolute",
                    inset: -6,
                    borderRadius: 50,
                    border: "2px solid rgba(160,190,255,0.7)",
                    transform: `scale(${1 + ripple * 0.9})`,
                    opacity: 1 - ripple,
                  }}
                />
              )}
            </div>
          </div>
        )}

        {frame > end - 26 && frame < end + 8 && (
          <svg
            width={54}
            height={54}
            viewBox="0 0 24 24"
            style={{
              position: "absolute",
              left: mix(1010, bar.x + bar.w - 120, cur),
              top: mix(bar.y + 340, bar.y + 70, cur),
              transform: `scale(${1 - press * 0.15})`,
              opacity: 1 - p(frame, end + 2, 6),
              filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))",
            }}
          >
            <path d="M5 3l14 8.5-6.2 1.3L16 20l-2.6 1.2-3.3-7.1L5 18.6z" fill="#fff" stroke="#111" strokeWidth={1.2} strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </AbsoluteFill>
  );
};

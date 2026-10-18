import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

// Fundalul din video-ul de referință: aproape negru, cu marginea unei sfere
// mari luminată în albastru, o a doua sferă mai mică în colțul din dreapta jos
// și câteva puncte de lumină. Totul alunecă foarte încet.

const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: random(`sx${i}`),
  y: random(`sy${i}`),
  r: 0.8 + random(`sr${i}`) * 1.8,
  o: 0.12 + random(`so${i}`) * 0.4,
  ph: random(`sp${i}`) * Math.PI * 2,
}));

export const Background: React.FC<{ glow?: number; transparent?: boolean }> = ({ glow = 0, transparent }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  if (transparent) return null;

  const drift = frame * 0.18;
  const a = { cx: -0.62 * W + drift * 0.25, cy: 0.79 * H - drift * 0.1, r: 1.6 * W };
  const b = { cx: 1.3 * W - drift * 0.15, cy: 1.03 * H, r: 0.6 * W };
  const lit = -32 + frame * 0.02;

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="aFill" cx={a.cx} cy={a.cy} r={a.r} gradientUnits="userSpaceOnUse">
            <stop offset="0.72" stopColor="#071022" stopOpacity="0" />
            <stop offset="0.9" stopColor="#0A1A3A" stopOpacity="0.4" />
            <stop offset="0.975" stopColor="#143A8F" stopOpacity="0.5" />
            <stop offset="1" stopColor="#2A62D8" stopOpacity="0.55" />
          </radialGradient>
          <radialGradient id="bFill" cx={b.cx} cy={b.cy} r={b.r} gradientUnits="userSpaceOnUse">
            <stop offset="0.6" stopColor="#06101F" stopOpacity="0" />
            <stop offset="0.9" stopColor="#0E2C66" stopOpacity="0.45" />
            <stop offset="1" stopColor="#3A86FF" stopOpacity="0.7" />
          </radialGradient>
          <linearGradient id="aLit" gradientUnits="userSpaceOnUse" x1={a.cx} y1={a.cy} x2={a.cx + Math.cos((lit * Math.PI) / 180) * a.r} y2={a.cy + Math.sin((lit * Math.PI) / 180) * a.r}>
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.15" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="aMask">
            <rect width={W} height={H} fill="url(#aLit)" />
          </mask>
          <filter id="halo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="38" />
          </filter>
          <filter id="rim" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <g mask="url(#aMask)">
          <circle cx={a.cx} cy={a.cy} r={a.r} fill="url(#aFill)" />
          <circle cx={a.cx} cy={a.cy} r={a.r + 18} fill="none" stroke="#1F58D8" strokeOpacity={0.32} strokeWidth={80} filter="url(#halo)" />
          <circle cx={a.cx} cy={a.cy} r={a.r} fill="none" stroke="#6E9BFF" strokeOpacity={0.28} strokeWidth={3} filter="url(#rim)" />
        </g>
        <circle cx={b.cx} cy={b.cy} r={b.r} fill="url(#bFill)" />
        <circle cx={b.cx} cy={b.cy} r={b.r + 12} fill="none" stroke="#2D74FF" strokeOpacity={0.3} strokeWidth={70} filter="url(#halo)" />
        <circle cx={b.cx} cy={b.cy} r={b.r} fill="none" stroke="#8FB6FF" strokeOpacity={0.3} strokeWidth={2.5} filter="url(#rim)" />

        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x * W}
            cy={((s.y * H - drift * 0.4 * (0.5 + s.r)) % H + H) % H}
            r={s.r}
            fill="#CFE0FF"
            opacity={s.o * (0.7 + 0.3 * Math.sin(frame / 14 + s.ph))}
          />
        ))}
      </svg>
      {glow > 0 && (
        <AbsoluteFill
          style={{
            opacity: glow,
            background:
              "radial-gradient(70% 38% at 50% 100%, rgba(41,98,255,0.45) 0%, rgba(41,98,255,0.12) 45%, rgba(0,0,0,0) 75%)",
          }}
        />
      )}
      <AbsoluteFill style={{ background: "radial-gradient(120% 80% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

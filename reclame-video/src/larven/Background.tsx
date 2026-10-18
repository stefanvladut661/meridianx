import React from "react";
import { AbsoluteFill, random } from "remotion";
import { LARVEN } from "../theme";

// Fundalul din video-ul larven: aproape negru, marginea unei sfere uriașe
// luminată în albastru și o sferă mai mică jos în dreapta, cu câteva puncte
// de lumină. Halourile sunt gradienți radiali, nu filtre de blur: un blur pe
// cercuri atât de mari ar costa secunde pe cadru. Fundalul e static; la
// asamblare se pune o singură imagine sub tot clipul.

export const LOOP = 600;

const STARS = Array.from({ length: 60 }, (_, i) => ({
  x: random(`sx${i}`),
  y: random(`sy${i}`),
  r: 0.8 + random(`sr${i}`) * 1.6,
  o: 0.1 + random(`so${i}`) * 0.35,
}));

/** Gradient de inel: transparent înăuntru, lumină pe margine, halou moale în afară. */
const Ring: React.FC<{ id: string; cx: number; cy: number; r: number; halo: number; color: string; rim: string; strength: number }> = ({ id, cx, cy, r, halo, color, rim, strength }) => {
  const R = r + halo;
  const at = (x: number) => (x / R).toFixed(4);
  return (
    <>
      <radialGradient id={id} cx={cx} cy={cy} r={R} gradientUnits="userSpaceOnUse">
        <stop offset={at(r * 0.74)} stopColor={color} stopOpacity={0} />
        <stop offset={at(r * 0.93)} stopColor={color} stopOpacity={0.3 * strength} />
        <stop offset={at(r * 0.99)} stopColor={color} stopOpacity={0.55 * strength} />
        <stop offset={at(r)} stopColor={rim} stopOpacity={0.8 * strength} />
        <stop offset={at(r + halo * 0.25)} stopColor={color} stopOpacity={0.22 * strength} />
        <stop offset={at(R)} stopColor={color} stopOpacity={0} />
      </radialGradient>
      <circle cx={cx} cy={cy} r={R} fill={`url(#${id})`} />
    </>
  );
};

export const LarvenBackground: React.FC = () => {
  const W = 1080;
  const H = 1920;
  const a = { cx: -0.64 * W, cy: 0.8 * H, r: 1.6 * W };
  const b = { cx: 1.3 * W, cy: 1.03 * H, r: 0.6 * W };
  const lit = (-32 * Math.PI) / 180;
  return (
    <AbsoluteFill style={{ background: LARVEN.bg, overflow: "hidden" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="aLit" gradientUnits="userSpaceOnUse" x1={a.cx} y1={a.cy} x2={a.cx + Math.cos(lit) * a.r} y2={a.cy + Math.sin(lit) * a.r}>
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="aMask">
            <rect width={W} height={H} fill="url(#aLit)" />
          </mask>
        </defs>
        <g mask="url(#aMask)">
          <Ring id="ga" cx={a.cx} cy={a.cy} r={a.r} halo={110} color="#1E55D6" rim="#7AA3FF" strength={0.9} />
        </g>
        <Ring id="gb" cx={b.cx} cy={b.cy} r={b.r} halo={90} color="#2D74FF" rim="#9CC0FF" strength={0.85} />
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x * W} cy={s.y * H} r={s.r} fill="#CFE0FF" opacity={s.o} />
        ))}
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(120% 80% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)" }} />
    </AbsoluteFill>
  );
};

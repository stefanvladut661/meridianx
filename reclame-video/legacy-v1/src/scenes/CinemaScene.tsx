import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Chip } from "../components/Glass";
import { CINEMA_SHOTS } from "../data/footage";
import { easeInOut, mix, p } from "../lib/anim";
import type { Layout, Rect } from "../lib/layout";

// „Facem cinematografie gastronomică, cu echipament profesional." — filmările
// în chenarul de sticlă din hero-ul de referință (margine groasă, albastru
// deschis, translucidă, cu halou). Patru cadre, tăiate pe ritmul frazei.

export const glassFrameRect = (L: Layout): Rect => ({ x: 60, y: L.content + 20, w: 960, h: 860 });

export const GlassFrame: React.FC<{ r: Rect; children: React.ReactNode; style?: React.CSSProperties }> = ({ r, children, style }) => (
  <div
    style={{
      position: "absolute",
      left: r.x,
      top: r.y,
      width: r.w,
      height: r.h,
      padding: 16,
      borderRadius: 46,
      background: "linear-gradient(160deg, rgba(150,185,245,0.62) 0%, rgba(84,124,200,0.5) 38%, rgba(66,104,178,0.55) 70%, rgba(120,160,235,0.6) 100%)",
      boxShadow:
        "0 0 0 1px rgba(255,255,255,0.22), inset 0 0 0 1px rgba(255,255,255,0.18), 0 0 90px rgba(41,98,255,0.4), 0 40px 100px rgba(0,0,0,0.55)",
      ...style,
    }}
  >
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 32, overflow: "hidden", background: "#000" }}>{children}</div>
  </div>
);

export const CinemaScene: React.FC<{ L: Layout; start: number; end: number; equipmentAt: number }> = ({ L, start, end, equipmentAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const r = glassFrameRect(L);
  const enter = p(frame, start - 4, 20);
  const exit = p(frame, end - 4, 12, easeInOut);

  const span = end - start;
  const cuts = CINEMA_SHOTS.map((_, i) => start + Math.round((span * i) / CINEMA_SHOTS.length));
  const shotIdx = Math.max(0, cuts.findLastIndex((c) => frame >= c));
  const label = p(frame, cuts[shotIdx], 8);

  return (
    <AbsoluteFill
      style={{
        opacity: 1 - exit,
        transform: `scale(${1 - 0.72 * exit})`,
        transformOrigin: `540px ${r.y + r.h / 2}px`,
      }}
    >
      <GlassFrame
        r={r}
        style={{
          opacity: enter,
          transform: `perspective(1800px) translateY(${mix(160, 0, enter)}px) rotateX(${mix(32, 0, enter)}deg) scale(${mix(0.86, 1, enter)})`,
          filter: enter < 1 ? `blur(${(1 - enter) * 14}px)` : undefined,
        }}
      >
        {CINEMA_SHOTS.map((shot, i) => {
          const from = i === 0 ? 0 : cuts[i];
          const to = i === CINEMA_SHOTS.length - 1 ? end + 20 : cuts[i + 1];
          return (
            <Sequence key={i} from={from} durationInFrames={Math.max(1, to - from)} layout="none">
              <ShotView src={shot.src} from={shot.from} fps={fps} />
            </Sequence>
          );
        })}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.45) 100%)" }} />
      </GlassFrame>

      <div style={{ position: "absolute", left: r.x + 40, top: r.y + r.h - 150, opacity: p(frame, start + 6, 10) }}>
        <Chip label="Cadru" check={label} width={340}>
          <span style={{ display: "inline-block", opacity: label, transform: `translateY(${(1 - label) * 14}px)` }}>{CINEMA_SHOTS[shotIdx].label}</span>
        </Chip>
      </div>
      {frame >= equipmentAt - 4 && (
        <div
          style={{
            position: "absolute",
            right: 1080 - (r.x + r.w) + 40,
            top: r.y + r.h - 150,
            opacity: p(frame, equipmentAt - 4, 10),
            transform: `translateY(${mix(30, 0, p(frame, equipmentAt - 4, 12))}px)`,
          }}
        >
          <Chip label="Echipament" check={p(frame, equipmentAt + 6, 8)} width={430}>
            adus în restaurant
          </Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};

const ShotView: React.FC<{ src: string; from: number; fps: number }> = ({ src, from, fps }) => {
  const frame = useCurrentFrame();
  const push = 1.08 - Math.min(1, frame / 40) * 0.06;
  return (
    <div style={{ position: "absolute", inset: 0, transform: `scale(${push})` }}>
      <OffthreadVideo src={staticFile(src)} trimBefore={Math.round(from * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
};

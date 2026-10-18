import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CheckIcon, Spinner } from "../components/icons";
import { glassPill, StatusChip } from "../components/Glass";
import { easeInOut, mix, p } from "../lib/anim";
import type { Rect } from "../lib/layout";
import { C, FONT } from "../theme";

export type PillState = {
  at: number;
  primary: string;
  secondary?: string;
  chip: string;
  tone: "blue" | "green";
  icon: "spin" | "check";
};

const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
  w: mix(a.w, b.w, t),
  h: mix(a.h, b.h, t),
});

export const StatusPill: React.FC<{
  /** Bara din hook, din care se naște pastila. */
  from: Rect;
  rect: Rect;
  bornAt: number;
  exitAt: number;
  states: PillState[];
}> = ({ from, rect, bornAt, exitAt, states }) => {
  const frame = useCurrentFrame();
  if (frame < bornAt) return null;

  const m = p(frame, bornAt, 12, easeInOut);
  const r = lerpRect(from, rect, m);
  const x = p(frame, exitAt - 4, 12, easeInOut);
  const contentIn = p(frame, bornAt + 7, 8);

  const idx = Math.max(0, states.findLastIndex((s) => frame >= s.at));
  const cur = states[idx];
  const prev = idx > 0 ? states[idx - 1] : undefined;
  const swap = p(frame, cur.at, 9);
  const h = rect.h;

  const Row: React.FC<{ s: PillState; t: number; dir: 1 | -1 }> = ({ s, t, dir }) => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        padding: `0 ${h * 0.16}px 0 ${h * 0.34}px`,
        opacity: t,
        transform: `translateY(${(1 - t) * 26 * dir}px)`,
        filter: t < 1 ? `blur(${(1 - t) * 8}px)` : undefined,
      }}
    >
      {s.icon === "spin" ? (
        <Spinner frame={frame} size={h * 0.36} />
      ) : (
        <CheckIcon size={h * 0.4} progress={p(frame, s.at + 2, 10)} color={s.tone === "green" ? C.green : "#9DB8FF"} stroke={2.8} />
      )}
      <div style={{ marginLeft: h * 0.2, fontSize: h * 0.36, whiteSpace: "nowrap", display: "flex", gap: "0.3em" }}>
        <span style={{ color: C.ink, fontWeight: 500 }}>{s.primary}</span>
        {s.secondary && <span style={{ color: "#8E95A4" }}>· {s.secondary}</span>}
      </div>
      <div style={{ marginLeft: "auto" }}>
        <StatusChip label={s.chip} tone={s.tone} frame={frame} h={h * 0.62} />
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ fontFamily: FONT, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: r.x,
          top: r.y,
          width: r.w,
          ...glassPill(r.h),
          overflow: "hidden",
          opacity: 1 - x,
          transform: `translateY(${-50 * x}px)`,
          filter: x > 0 ? `blur(${x * 10}px)` : undefined,
        }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: contentIn }}>
          {prev && swap < 1 && <Row s={prev} t={1 - swap} dir={-1} />}
          <Row s={cur} t={idx === 0 ? 1 : swap} dir={1} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

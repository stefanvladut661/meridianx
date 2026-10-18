import React from "react";
import { Img, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { FOOT, SHOTS, ShotName, STILLS, StillName } from "../data/footage";

// O filmare în formatul ei, vertical 9:16, într-un dreptunghi w×h.
// Pe clipurile cu filigran, cadrul e mărit ancorat jos (FOOT[id].crop).
// Video-ul pornește de la `from` exact în cadrul în care apare (`at`).

type Common = {
  w: number;
  h: number;
  radius?: number;
  style?: React.CSSProperties;
  filter?: string;
};

export const Footage: React.FC<Common & { shot: ShotName; at?: number; rate?: number }> = ({ shot, at = 0, rate, w, h, radius = 0, style, filter }) => {
  const { fps } = useVideoConfig();
  const s = SHOTS[shot];
  const f = FOOT[s.id];
  const c = f.crop;
  // Acoperă dreptunghiul păstrând 9:16, apoi aplică decupajul ancorat jos.
  const base = Math.max(w / 1080, h / 1920);
  const vw = 1080 * base * c;
  const vh = 1920 * base * c;
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: radius, overflow: "hidden", background: "#111", ...style }}>
      <Sequence from={at} layout="none">
        <OffthreadVideo
          src={staticFile(f.src)}
          trimBefore={Math.round(s.from * fps)}
          playbackRate={rate ?? ("rate" in s ? s.rate : undefined) ?? 1}
          muted
          style={{ position: "absolute", width: vw, height: vh, left: (w - vw) / 2, top: h - vh - (h - 1920 * base) / 2, filter }}
        />
      </Sequence>
    </div>
  );
};

/** Un cadru static (din public/stills), mai ieftin decât un video. */
export const Still: React.FC<Common & { still: StillName | string }> = ({ still, w, h, radius = 0, style, filter }) => {
  const src = still in STILLS ? STILLS[still as StillName] : still;
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: radius, overflow: "hidden", background: "#111", ...style }}>
      <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter }} />
    </div>
  );
};

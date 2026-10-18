import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CheckBox, StatusChip } from "../components/Glass";
import { Spinner } from "../components/icons";
import { easeInOut, mix, p } from "../lib/anim";
import type { Layout } from "../lib/layout";
import { C, FONT } from "../theme";

// „Venim cu ideile și scriem scenariile." — ideile intră ca niște carduri
// aruncate pe masă (ca în grila din referință) și se așază; scenariul se
// scrie rând cu rând, cu cursorul albastru din bara de URL a referinței.

const IDEAS = ["Focul din cuptor, filmat de aproape", "O zi din bucătărie, ca un trailer", "Rețeta casei, pas cu pas"];

const SCRIPT: [string, string][] = [
  ["Cadrul 1", "Aluatul întins pe blat."],
  ["Cadrul 2", "Flacăra, în prim-plan."],
  ["Cadrul 3", "Prima felie, cu aburi."],
];

export const IdeasScene: React.FC<{ L: Layout; start: number; end: number; scriptAt: number }> = ({ L, start, end, scriptAt }) => {
  const frame = useCurrentFrame();
  const T = L.content;
  const exit = p(frame, end - 6, 14, easeInOut);
  const scriptIn = p(frame, scriptAt - 8, 16);
  const typeStart = scriptAt + 2;
  const allTyped = typeStart + SCRIPT.length * 12 + 6;

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT,
        opacity: 1 - exit,
        transform: `translateY(${-50 * exit}px) scale(${1 - 0.06 * exit})`,
        filter: exit > 0 ? `blur(${exit * 14}px)` : undefined,
      }}
    >
      {IDEAS.map((text, i) => {
        const at = start + i * 6;
        const t = p(frame, at, 16);
        const tilt = [-7, 5, -4][i];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 90,
              top: T + 40 + i * 132,
              width: 900,
              height: 112,
              borderRadius: 20,
              background: C.card,
              border: "1px solid rgba(255,255,255,0.075)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              gap: 22,
              padding: "0 30px",
              opacity: Math.min(1, t * 2.5),
              transform: `perspective(1400px) translateY(${mix(220, 0, t)}px) rotateX(${mix(55, 0, t)}deg) rotateZ(${mix(tilt, 0, t)}deg) scale(${mix(0.86, 1, t)})`,
              filter: t < 0.9 ? `blur(${(1 - t) * 12}px)` : undefined,
            }}
          >
            <CheckBox size={46} progress={p(frame, at + 12, 8)} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "0.14em", color: C.mute }}>IDEE</div>
              <div style={{ fontSize: 34, fontWeight: 500, color: C.ink, marginTop: 2 }}>{text}</div>
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 90,
          top: T + 460,
          width: 900,
          height: 350,
          borderRadius: 26,
          background: "linear-gradient(180deg, rgba(20,24,34,0.96) 0%, rgba(12,14,20,0.96) 100%)",
          border: "1.5px solid rgba(98,144,255,0.35)",
          boxShadow: "0 0 40px rgba(46,110,255,0.22), 0 30px 70px rgba(0,0,0,0.55)",
          padding: "34px 40px",
          opacity: scriptIn,
          transform: `translateY(${mix(90, 0, scriptIn)}px) scale(${mix(0.92, 1, scriptIn)})`,
          filter: scriptIn < 1 ? `blur(${(1 - scriptIn) * 12}px)` : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: "0.16em", color: "#8FA6D6" }}>SCENARIU · REEL</div>
          <div style={{ marginLeft: "auto" }}>
            {frame < allTyped ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#8E95A4", fontSize: 24 }}>
                <Spinner frame={frame} size={26} />
                se scrie
              </div>
            ) : (
              <StatusChip label="GATA" tone="blue" frame={frame} h={44} />
            )}
          </div>
        </div>
        <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 30 }}>
          {SCRIPT.map(([tag, line], i) => {
            const at = typeStart + i * 12;
            const n = Math.max(0, Math.floor((frame - at) * 2.2));
            const shown = line.slice(0, n);
            const typing = n > 0 && n < line.length;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", fontSize: 36, opacity: frame >= at ? 1 : 0.0 }}>
                <span style={{ color: "#6F9BFF", fontWeight: 600, width: 170 }}>{tag}</span>
                <span style={{ color: C.ink }}>{shown}</span>
                {(typing || (i === SCRIPT.length - 1 && n >= line.length && frame < allTyped)) && (
                  <span style={{ width: 3, height: 40, marginLeft: 3, background: "#5C93FF", opacity: Math.floor(frame / 6) % 2 ? 1 : 0.35 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

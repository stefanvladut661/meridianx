import React from "react";
import { useCurrentFrame } from "remotion";
import { easeInOut, easeOut, p } from "../lib/anim";
import { LARVEN } from "../theme";

// Titlul din video-ul larven: rânduri centrate, alb / albastru / gri, fiecare
// cuvânt urcă scurt în poziție când e rostit; sub un rând se trage o linie.
// Fără blur pe litere: intrarea e o alunecare de 7 cadre, atât.

export type TitleWord = { text: string; at: number };
export type TitleLine = { words: TitleWord[]; color?: "ink" | "blue" | "grey"; underlineAt?: number };

const COLORS = { ink: LARVEN.ink, blue: LARVEN.blue, grey: LARVEN.grey };

export const LarvenTitle: React.FC<{
  lines: TitleLine[];
  size: number;
  top: number;
  /** Culoarea rândurilor înainte de tragerea înapoi a filmării (peste video totul e alb). */
  overFootageUntil?: number;
  exitAt?: number;
  shadow?: number;
}> = ({ lines, size, top, overFootageUntil = -1, exitAt, shadow = 0 }) => {
  const frame = useCurrentFrame();
  const exit = exitAt === undefined ? 0 : p(frame, exitAt, 8, easeInOut);
  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        right: 40,
        top,
        fontFamily: LARVEN.font,
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1.06,
        letterSpacing: "-0.035em",
        textAlign: "center",
        opacity: 1 - exit,
        transform: `translateY(${-70 * exit}px)`,
        textShadow: shadow > 0 ? `0 2px ${24 * shadow}px rgba(0,0,0,${0.55 * shadow})` : undefined,
      }}
    >
      {lines.map((line, i) => {
        const base = COLORS[line.color ?? "ink"];
        const u = line.underlineAt === undefined ? 0 : p(frame, line.underlineAt, 14, easeInOut);
        return (
          <div key={i} style={{ display: "flex", justifyContent: "center" }}>
            <span style={{ position: "relative", display: "inline-flex", columnGap: "0.24em" }}>
              {line.words.map((w, j) => {
                const t = p(frame, w.at - 2, 7, easeOut);
                const over = frame < overFootageUntil;
                return (
                  <span
                    key={j}
                    style={{
                      display: "inline-block",
                      whiteSpace: "pre",
                      color: over ? LARVEN.ink : base,
                      opacity: t,
                      transform: `translateY(${(1 - t) * 0.3}em)`,
                    }}
                  >
                    {w.text}
                  </span>
                );
              })}
              {u > 0 && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: "-0.08em",
                    height: Math.max(5, size * 0.055),
                    borderRadius: 4,
                    background: LARVEN.blue,
                    transform: `scaleX(${u})`,
                    transformOrigin: "left center",
                  }}
                />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** Construiește rândurile din cuvintele cu timpi și din numărul de cuvinte pe rând. */
export const linesFrom = (
  words: { text: string; f: number }[],
  spec: { n: number; color?: TitleLine["color"]; underline?: boolean }[],
  underlineDelay = 4,
): TitleLine[] => {
  let k = 0;
  return spec.map((s) => {
    const ws = words.slice(k, k + s.n).map((w) => ({ text: w.text, at: w.f }));
    k += s.n;
    return { words: ws, color: s.color, underlineAt: s.underline ? ws[ws.length - 1].at + underlineDelay : undefined };
  });
};

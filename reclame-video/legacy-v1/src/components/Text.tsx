import React from "react";
import { interpolateColors } from "remotion";
import { p } from "../lib/anim";

// Textul apare cuvânt cu cuvânt, cu blur și o mică ridicare, ca în cadrele
// de final din video-ul de referință. Fiecare cuvânt pornește când îl spune
// vocea (cu două cadre mai devreme, ca ochiul să nu rămână în urmă).

export type WordSpec = { text: string; at: number; color?: string; dimAt?: number; dimColor?: string };

const LEAD = 2;

export const Word: React.FC<{ w: WordSpec; frame: number; color: string; dur?: number }> = ({ w, frame, color, dur = 9 }) => {
  const t = p(frame, w.at - LEAD, dur);
  const fill =
    w.dimAt !== undefined && w.dimColor
      ? interpolateColors(p(frame, w.dimAt - 2, 10), [0, 1], [w.color ?? color, w.dimColor])
      : w.color ?? color;
  return (
    <span
      style={{
        display: "inline-block",
        opacity: t,
        filter: t < 1 ? `blur(${(1 - t) * 14}px)` : undefined,
        transform: `translateY(${(1 - t) * 0.42}em)`,
        color: fill,
        whiteSpace: "pre",
      }}
    >
      {w.text}
    </span>
  );
};

/** Rânduri de cuvinte; `lines` dă câte cuvinte are fiecare rând. */
export const WordLines: React.FC<{
  words: WordSpec[];
  lines: number[];
  frame: number;
  color: string;
  style?: React.CSSProperties;
  lineStyle?: (i: number) => React.CSSProperties | undefined;
}> = ({ words, lines, frame, color, style, lineStyle }) => {
  let k = 0;
  return (
    <div style={style}>
      {lines.map((n, i) => {
        const row = words.slice(k, k + n);
        k += n;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "center", flexWrap: "nowrap", columnGap: "0.24em", ...lineStyle?.(i) }}>
            {row.map((w, j) => (
              <Word key={j} w={w} frame={frame} color={color} />
            ))}
          </div>
        );
      })}
    </div>
  );
};

/** Cifre care se rotesc pe verticală, ca la contoarele din referință. */
export const RollingNumber: React.FC<{ value: number; digits: number; size: number; color: string; blurPerStep?: number; speed?: number }> = ({
  value,
  digits,
  size,
  color,
  speed = 0,
}) => {
  const h = size * 1.08;
  const cols = Array.from({ length: digits }, (_, i) => {
    const place = 10 ** (digits - 1 - i);
    const raw = value / place;
    const base = Math.floor(raw) % 10;
    // Odometru: o cifră se mută doar cât timp cea din dreapta ei trece de la 9 la 0.
    const lower = (value % place) / place;
    const carry = place === 1 ? raw - Math.floor(raw) : Math.max(0, (lower - 0.9) * 10);
    return { pos: base + carry, hidden: value < place && i !== digits - 1 };
  });
  return (
    <span style={{ display: "inline-flex", height: h, overflow: "hidden", fontSize: size, lineHeight: `${h}px`, color }}>
      {cols.map((c, i) =>
        c.hidden ? null : (
          <span key={i} style={{ display: "inline-block", width: "0.6em", textAlign: "center", position: "relative" }}>
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                transform: `translateY(${-(c.pos % 10) * h}px)`,
                filter: speed > 0 && i === digits - 1 ? `blur(${Math.min(6, speed * 1.2)}px)` : undefined,
              }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, k) => (
                <span key={k} style={{ height: h }}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        ),
      )}
    </span>
  );
};

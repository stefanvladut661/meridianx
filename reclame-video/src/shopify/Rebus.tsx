import React from "react";
import { useCurrentFrame } from "remotion";
import { easeIn, mix, p, rnd, sp, SpringFeel } from "../lib/anim";
import { SHOP } from "../theme";

// Motorul din clipul Shopify: propoziția e o coloană de rânduri, iar unele
// rânduri sunt obiecte care țin locul unui cuvânt („Get the [button]").
// Rândurile intră și ies cu arc, iar coloana se recentrează singură, pentru
// că înălțimile se animă și flexbox-ul face restul. Cuvintele sar în poziție
// când sunt rostite; la ieșire, literele se împrăștie.

export type RWord = { text: string; at: number; pill?: "tomato" | "saffron" | "cream" };
export type Row =
  | { kind: "text"; words: RWord[]; size?: number; from?: number; to?: number; weight?: number; key?: string }
  | { kind: "obj"; h: number; from?: number; to?: number; node: React.ReactNode; feel?: SpringFeel; key?: string; keepOnExit?: boolean };

const GAP = 6;

const rowHeight = (r: Row) => (r.kind === "text" ? (r.size ?? 116) * 1.1 : r.h) + GAP * 2;

export const Rebus: React.FC<{ rows: Row[]; center?: number; exitAt?: number }> = ({ rows, center = 880, exitAt }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: center * 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {rows.map((r, i) => {
        const full = rowHeight(r);
        const enter = r.from === undefined || r.from <= 0 ? 1 : sp(frame, r.from, r.kind === "obj" ? r.feel ?? "snap" : "snap");
        const to = r.to ?? exitAt;
        const leave = to === undefined ? 0 : sp(frame, to + 3, "snap");
        const h = full * enter * (1 - leave);
        // Obiectele unei pagini nu se desenează înainte de pagina lor, nici după ce au ieșit.
        if (r.kind === "obj" && ((r.from !== undefined && frame < r.from - 1) || (to !== undefined && !r.keepOnExit && frame > to + 18))) {
          return <div key={r.key ?? i} style={{ height: Math.max(0, h), flex: "none" }} />;
        }
        return (
          <div key={r.key ?? i} style={{ height: Math.max(0, h), width: 1080, position: "relative", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
            {r.kind === "text" ? (
              <TextRow row={r} exitAt={to} />
            ) : (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "50%",
                  height: 0,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  transform: r.keepOnExit || to === undefined ? undefined : `scale(${1 - p(frame, to, 10, easeIn)})`,
                  opacity: r.keepOnExit || to === undefined ? 1 : 1 - p(frame, to + 4, 6),
                }}
              >
                {/* Ancoră de mărime zero în centrul rândului: obiectele se desenează în jurul ei. */}
                <div style={{ position: "relative", width: 0, height: 0 }}>{r.node}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const PILL: Record<NonNullable<RWord["pill"]>, { bg: string; fg: string }> = {
  tomato: { bg: SHOP.tomato, fg: SHOP.ink },
  saffron: { bg: SHOP.saffron, fg: SHOP.bg },
  cream: { bg: SHOP.ink, fg: SHOP.bg },
};

const TextRow: React.FC<{ row: Extract<Row, { kind: "text" }>; exitAt?: number }> = ({ row, exitAt }) => {
  const frame = useCurrentFrame();
  const size = row.size ?? 116;
  const scatter = exitAt === undefined ? 0 : p(frame, exitAt, 8, easeIn);
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        display: "flex",
        justifyContent: "center",
        columnGap: "0.26em",
        fontFamily: SHOP.font,
        fontWeight: row.weight ?? 300,
        fontSize: size,
        lineHeight: 1.1,
        letterSpacing: "-0.025em",
        color: SHOP.ink,
        whiteSpace: "nowrap",
      }}
    >
      {row.words.map((w, j) => {
        const s = sp(frame, w.at - 2, "bouncy");
        const shown = frame >= w.at - 2;
        const seed = w.at * 7.3 + j * 13.1;
        const rot = (rnd(seed) - 0.5) * 12;
        const pill = w.pill ? PILL[w.pill] : null;
        return (
          <span
            key={j}
            style={{
              position: "relative",
              display: "inline-block",
              opacity: shown ? Math.min(1, (frame - w.at + 3) / 2) : 0,
              transform: `translateY(${(1 - s) * 0.32}em) rotate(${(1 - s) * rot}deg) scale(${mix(0.84, 1, s)})`,
              color: pill ? pill.fg : SHOP.ink,
              padding: pill ? "0 0.18em" : undefined,
            }}
          >
            {pill && (
              <span
                style={{
                  position: "absolute",
                  inset: "0.04em 0 0.02em 0",
                  borderRadius: "0.14em",
                  background: pill.bg,
                  transform: `scaleX(${mix(0.4, 1, sp(frame, w.at - 3, "bouncy")) * (1 - scatter)}) rotate(${scatter * 14}deg)`,
                  opacity: 1 - scatter,
                  zIndex: -1,
                }}
              />
            )}
            {scatter > 0 ? <Scatter text={w.text} t={scatter} seed={seed} /> : w.text}
          </span>
        );
      })}
    </div>
  );
};

/** Literele zboară în direcții diferite, ca „Get the" din clipul de referință. */
const Scatter: React.FC<{ text: string; t: number; seed: number }> = ({ text, t, seed }) => (
  <>
    {text.split("").map((ch, k) => {
      const a = rnd(seed + k * 3.7);
      const b = rnd(seed + k * 9.1);
      return (
        <span
          key={k}
          style={{
            display: "inline-block",
            whiteSpace: "pre",
            opacity: Math.max(0, 1 - t * 1.4),
            transform: `translate(${(a - 0.5) * 900 * t}px, ${(b - 0.65) * 640 * t}px) rotate(${(a - 0.5) * 260 * t}deg)`,
          }}
        >
          {ch}
        </span>
      );
    })}
  </>
);

/** Centrul vertical al rândului `index` la cadrul `frame` (pentru ținta mâinii-cursor). */
export const rowCenter = (rows: Row[], index: number, frame: number, center = 880, exitAt?: number) => {
  const hs = rows.map((r) => {
    const enter = r.from === undefined || r.from <= 0 ? 1 : sp(frame, r.from, r.kind === "obj" ? r.feel ?? "snap" : "snap");
    const to = r.to ?? exitAt;
    const leave = to === undefined ? 0 : sp(frame, to + 3, "snap");
    return rowHeight(r) * enter * (1 - leave);
  });
  const total = hs.reduce((a, b) => a + b, 0);
  const top = center - total / 2;
  return top + hs.slice(0, index).reduce((a, b) => a + b, 0) + hs[index] / 2;
};

/** Cuvintele `i..j` dintr-o listă cu timpi, ca RWord. */
export const ws = (words: { text: string; f: number }[], i: number, j: number, pill?: RWord["pill"]): RWord[] =>
  words.slice(i, j + 1).map((w) => ({ text: w.text, at: Math.round(w.f), pill }));

/** Un singur „cuvânt" format din mai multe cuvinte rostite (de pus într-o pastilă). */
export const joined = (words: { text: string; f: number }[], i: number, j: number, pill?: RWord["pill"]): RWord => ({
  text: words
    .slice(i, j + 1)
    .map((w) => w.text)
    .join(" "),
  at: Math.round(words[i].f),
  pill,
});

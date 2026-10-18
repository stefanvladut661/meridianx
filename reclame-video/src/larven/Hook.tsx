import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Footage } from "../components/Footage";
import { MeridianMark } from "../components/icons";
import { ShotName } from "../data/footage";
import { HookId } from "../data/script";
import { easeInOut, mix, p, sp } from "../lib/anim";
import type { Seg } from "../lib/timeline";
import { LARVEN, SATOSHI } from "../theme";
import { LarvenTitle, linesFrom, TitleLine } from "./Title";

// Hookul Larven: clipul deschide direct pe o filmare întreagă, cu titlul peste
// ea. La un cuvânt ales, filmarea se trage înapoi într-un card 3D și apare
// spațiul albastru din video-ul larven; titlul continuă în alb / albastru /
// gri. Ce face cardul după aceea ține de sensul frazei.

type Mode = "three" | "lonely" | "phone" | "tilt";
type Spec = {
  lines: { n: number; color?: TitleLine["color"]; underline?: boolean }[];
  size: number;
  pullWord: number;
  mode: Mode;
  shot: ShotName;
  /** La „three": cuvântul la care cardurile cresc. */
  growWord?: number;
};

const SPECS: Record<HookId, Spec> = {
  h1: {
    lines: [{ n: 2 }, { n: 2 }, { n: 2, color: "blue" }, { n: 5, color: "grey" }, { n: 3, color: "grey", underline: true }],
    size: 90,
    pullWord: 1,
    mode: "three",
    shot: "guestMenu",
    growWord: 10,
  },
  h2: {
    lines: [{ n: 2 }, { n: 2 }, { n: 2, color: "blue" }, { n: 3, color: "grey" }, { n: 2, color: "grey" }, { n: 3, color: "grey", underline: true }],
    size: 86,
    pullWord: 1,
    mode: "three",
    shot: "guestMenu",
    growWord: 8,
  },
  h3: {
    lines: [{ n: 2 }, { n: 3 }, { n: 2, color: "blue" }, { n: 2, color: "blue", underline: true }],
    size: 116,
    pullWord: 5,
    mode: "lonely",
    shot: "dough",
  },
  h4: {
    lines: [{ n: 3 }, { n: 2 }, { n: 3, color: "blue" }, { n: 4, color: "grey" }, { n: 2, color: "grey", underline: true }],
    size: 98,
    pullWord: 5,
    mode: "phone",
    shot: "guestSmile",
  },
  h5: {
    lines: [{ n: 2 }, { n: 3 }, { n: 4, color: "blue" }, { n: 4, color: "grey", underline: true }],
    size: 84,
    pullWord: 5,
    mode: "tilt",
    shot: "cutting",
  },
  h6: {
    lines: [{ n: 2 }, { n: 3, color: "grey" }, { n: 1, color: "grey" }, { n: 1, color: "blue", underline: true }],
    size: 124,
    pullWord: 2,
    mode: "lonely",
    shot: "pizzaFinal",
  },
};

const TOP = 330;

export const LarvenHook: React.FC<{ seg: Seg; hook: HookId }> = ({ seg, hook }) => {
  const frame = useCurrentFrame();
  const s = SPECS[hook];
  const w = seg.words;
  const fPull = Math.round(w[s.pullWord].f) - 5;
  const pull = p(frame, fPull, 18, easeInOut);
  const lines = linesFrom(w, s.lines, 5);
  const textH = s.lines.length * s.size * 1.06;

  // Unde ajunge cardul după tragerea înapoi.
  const areaTop = TOP + textH + 70;
  const areaBottom = 1560;
  const ch = Math.min(640, areaBottom - areaTop);
  const cw = (ch * 9) / 16;
  const cy = areaTop + ch / 2;

  // Cardul: din ecran întreg (1080×1920) în cw×ch, cu înclinare 3D.
  const cardW = mix(1080, cw, pull);
  const cardH = mix(1920, ch, pull);
  const cardX = mix(540, 540, pull);
  const cardY = mix(960, cy, pull);
  const radius = mix(0, 30, pull);

  let rotX = mix(0, 10, pull);
  let rotY = mix(0, -12, pull);
  let rotZ = mix(0, 2, pull);
  let z = 0;
  let filter: string | undefined;

  if (s.mode === "lonely") {
    const drift = p(frame, fPull + 10, 50, easeInOut);
    z = -420 * drift;
    rotY += 8 * drift;
    filter = `saturate(${mix(1, 0.15, drift)}) brightness(${mix(1, 0.62, drift)})`;
  }
  if (s.mode === "tilt") {
    const t = p(frame, fPull + 14, 40, easeInOut);
    rotX += 34 * t;
    z = -160 * t;
    filter = `brightness(${mix(1, 0.7, t)})`;
  }
  if (s.mode === "three" && s.growWord !== undefined) {
    const g = sp(frame, Math.round(w[s.growWord].f) - 2, "soft");
    z = 70 * g;
  }
  const exit = p(frame, seg.D - 5, 5, easeInOut);

  const sideIn = s.mode === "three" ? sp(frame, fPull + 6, "snap") : 0;
  const phoneIn = s.mode === "phone" ? sp(frame, fPull + 12, "soft") : 0;

  const cardStyle = (x: number, y: number, extra: string, cwid: number, chei: number): React.CSSProperties => ({
    position: "absolute",
    left: x - cwid / 2,
    top: y - chei / 2,
    width: cwid,
    height: chei,
    transformStyle: "preserve-3d",
    transform: extra,
  });

  return (
    <AbsoluteFill style={{ transform: `translateY(${-90 * exit}px)`, opacity: 1 - exit * 0.4 }}>
      <AbsoluteFill style={{ perspective: 1700, perspectiveOrigin: `540px ${mix(960, cy, pull)}px` }}>
        {s.mode === "three" &&
          [-1, 1].map((side) => (
            <div
              key={side}
              style={{
                ...cardStyle(540 + side * mix(0, cw * 0.82, sideIn), cy + 36, "", cw * 0.86, ch * 0.86),
                transform: `translateZ(${-90 + z * 0.8}px) rotateY(${side * 20}deg) rotateZ(${side * 7}deg) scale(${mix(0.6, 1, sideIn)})`,
                opacity: Math.min(1, sideIn * 2),
              }}
            >
              <Footage
                shot={side < 0 ? "pizzaInOven" : "latteArt"}
                at={fPull + 6}
                w={cw * 0.86}
                h={ch * 0.86}
                radius={26}
                style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.55)" }}
              />
            </div>
          ))}
        <div style={{ ...cardStyle(cardX, cardY, "", cardW, cardH), transform: `translateZ(${z}px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)` }}>
          {phoneIn > 0 && (
            <div
              style={{
                position: "absolute",
                inset: -18,
                borderRadius: 52,
                background: "linear-gradient(160deg, #2B2E35 0%, #111317 50%, #1E2026 100%)",
                boxShadow: "0 0 0 1.5px rgba(255,255,255,0.14), 0 50px 100px rgba(0,0,0,0.6)",
                opacity: phoneIn,
                transform: `scale(${mix(1.12, 1, phoneIn)})`,
              }}
            />
          )}
          <Footage
            shot={s.shot}
            w={cardW}
            h={cardH}
            radius={radius + phoneIn * 10}
            filter={filter}
            style={{ boxShadow: pull > 0.02 ? `0 50px 100px rgba(0,0,0,${0.55 * pull})` : undefined }}
          />
          {phoneIn > 0 && (
            <div style={{ position: "absolute", top: 12, left: "50%", width: 96, height: 26, marginLeft: -48, borderRadius: 13, background: "#000", opacity: phoneIn }} />
          )}
          {/* Umbra pentru lizibilitatea titlului cât timp filmarea e pe tot ecranul. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: radius,
              background: "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.35) 38%, rgba(0,0,0,0) 62%)",
              opacity: 1 - pull,
            }}
          />
        </div>
      </AbsoluteFill>

      <div style={{ position: "absolute", top: 232, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 14, opacity: 0.92 }}>
        <MeridianMark size={40} color={LARVEN.ink} />
        <span style={{ fontFamily: SATOSHI, fontWeight: 700, fontSize: 25, letterSpacing: "0.26em", color: LARVEN.ink }}>MERIDIAN</span>
      </div>

      <LarvenTitle lines={lines} size={s.size} top={TOP} overFootageUntil={fPull + 6} shadow={1 - pull} />
    </AbsoluteFill>
  );
};

/** Momentele cu efect sonor: tragerea înapoi a filmării. */
export const larvenHookCues = (seg: Seg, hook: HookId) => [{ f: Math.round(seg.words[SPECS[hook].pullWord].f) - 5, sfx: "whoosh-soft" as const }];

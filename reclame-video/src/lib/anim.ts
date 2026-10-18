import { Easing, interpolate, spring } from "remotion";

export const FPS_DEFAULT = 30;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.55, 0, 0.9, 0.3);
/** Ieșire care accelerează, ca un obiect aruncat afară din cadru. */
export const throwOut = Easing.bezier(0.6, 0, 0.9, 0.25);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Progres 0→1 între `start` și `start + dur` (cadre). */
export const p = (frame: number, start: number, dur: number, easing = easeOut) =>
  interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], { ...clamp, easing });

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export type SpringFeel = "snap" | "soft" | "bouncy" | "heavy";
const FEEL: Record<SpringFeel, { damping: number; stiffness: number; mass: number }> = {
  snap: { damping: 26, stiffness: 260, mass: 0.7 },
  soft: { damping: 30, stiffness: 120, mass: 1 },
  bouncy: { damping: 13, stiffness: 190, mass: 0.8 },
  heavy: { damping: 22, stiffness: 90, mass: 1.6 },
};

/** Arc fizic care pornește la `start`. Poate depăși puțin ținta, ca un obiect real. */
export const sp = (frame: number, start: number, feel: SpringFeel = "snap", fps = FPS_DEFAULT) =>
  frame < start ? 0 : spring({ frame: frame - start, fps, config: FEEL[feel] });

/**
 * O valoare care sare între ținte, cu arc la fiecare schimbare:
 * keys = [{ f, v }] — de la cadrul f, ținta devine v.
 */
export const springKeys = (frame: number, keys: { f: number; v: number }[], feel: SpringFeel = "snap", fps = FPS_DEFAULT) => {
  if (keys.length === 0) return 0;
  let v = keys[0].v;
  for (let i = 1; i < keys.length; i++) v += (keys[i].v - keys[i - 1].v) * sp(frame, keys[i].f, feel, fps);
  return v;
};

/** Viteza (unități/cadru) a unei funcții de timp, pentru blur de mișcare. */
export const vel = (f: (frame: number) => number, frame: number) => f(frame) - f(frame - 1);

/** Pseudo-aleator determinist în [0,1). */
export const rnd = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

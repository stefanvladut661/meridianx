import { Easing, interpolate } from "remotion";

// Mișcarea din referință: intrări rapide care frânează lung, fără arcuri.
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.55, 0, 0.9, 0.3);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Progres 0→1 între `start` și `start + dur` (în cadre). */
export const p = (frame: number, start: number, dur: number, easing = easeOut) =>
  interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], { ...clamp, easing });

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Intră între `inAt` și `inAt + inDur`, iese între `outAt` și `outAt + outDur`. */
export const life = (frame: number, inAt: number, inDur: number, outAt: number, outDur: number) => {
  const enter = p(frame, inAt, inDur);
  const exit = p(frame, outAt, outDur, easeInOut);
  return { enter, exit, visible: enter * (1 - exit) };
};

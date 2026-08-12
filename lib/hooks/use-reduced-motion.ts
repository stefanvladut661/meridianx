"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  // Pe server presupunem mișcare redusă: animațiile pornesc doar
  // după ce clientul confirmă că are voie. Evită flash de mișcare
  // la utilizatorii care au cerut reduced motion.
  return true;
}

/**
 * `true` dacă utilizatorul a cerut mișcare redusă (sau până aflăm).
 * Orice animație GSAP/Lenis/CSS condiționată în JS trece prin ăsta.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

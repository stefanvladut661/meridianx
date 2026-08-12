"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DIVISION_COOKIE,
  DIVISION_COOKIE_MAX_AGE,
  type Division,
  isDivision,
} from "@/lib/division";

function readCookie(): Division | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${DIVISION_COOKIE}=`));
  const value = match?.split("=")[1];
  return isDivision(value) ? value : null;
}

let listeners: Array<() => void> = [];

function emit() {
  for (const l of listeners) l();
}

function subscribe(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

/**
 * Preferința de divizie a vizitatorului (cookie `meridian_division`, 90 zile).
 * Gateway-ul (F1) o setează la alegere; „Vezi ambele divizii" o șterge.
 * Citirea pe server (pentru redirect) se face cu `getDivisionFromCookies`
 * din lib/division.ts.
 */
export function useDivision() {
  const division = useSyncExternalStore(subscribe, readCookie, () => null);

  const setDivision = useCallback((value: Division) => {
    document.cookie = `${DIVISION_COOKIE}=${value}; path=/; max-age=${DIVISION_COOKIE_MAX_AGE}; samesite=lax`;
    emit();
  }, []);

  const clearDivision = useCallback(() => {
    document.cookie = `${DIVISION_COOKIE}=; path=/; max-age=0; samesite=lax`;
    emit();
  }, []);

  return { division, setDivision, clearDivision };
}

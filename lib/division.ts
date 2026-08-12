/**
 * Contractul diviziilor (FAZA 0, ÎNGHEȚAT).
 * Sursa unică pentru numele cookie-ului și tipul Division —
 * folosit de gateway (F1), formulare (F3, F5) și API (F6).
 */

export const DIVISIONS = ["video", "software"] as const;
export type Division = (typeof DIVISIONS)[number];

export const DIVISION_COOKIE = "meridian_division";
/** 90 de zile, în secunde. */
export const DIVISION_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;

export function isDivision(value: unknown): value is Division {
  return typeof value === "string" && DIVISIONS.includes(value as Division);
}

/**
 * Citește preferința de divizie pe server.
 * `cookies` e obiectul din `next/headers` (await cookies()).
 */
export function getDivisionFromCookies(cookies: {
  get(name: string): { value: string } | undefined;
}): Division | null {
  const value = cookies.get(DIVISION_COOKIE)?.value;
  return isDivision(value) ? value : null;
}

/**
 * Consimțământul pentru cookie-uri (FAZA 7).
 *
 * Regula, nu doar forma: nimic din categoriile opționale nu se
 * încarcă înainte de un „da” explicit. Bannerul nu pre-bifează nimic,
 * refuzul e la fel de ușor ca acceptul, iar alegerea se poate schimba
 * oricând din pagina de cookie-uri.
 *
 * Preferința stă într-un cookie propriu (nu în localStorage) ca să fie
 * citibilă și pe server dacă F6 are nevoie, și ca să expire controlat.
 */

export const CONSENT_COOKIE = "meridian_consent";
/** 6 luni — după atât întrebăm din nou. */
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60;
/** Crește versiunea când se schimbă categoriile: reîntrebăm toată lumea. */
export const CONSENT_VERSION = 1;

/** Evenimentul emis pe `window` când preferința se schimbă. */
export const CONSENT_EVENT = "meridian:consent";

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export interface ConsentState {
  v: number;
  /** Mereu true — fără ele site-ul nu funcționează, deci nu se pot refuza. */
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  /** ISO 8601 — dovada momentului consimțământului (cerință GDPR). */
  ts: string;
}

export const CONSENT_ALL: Omit<ConsentState, "v" | "ts"> = {
  necessary: true,
  analytics: true,
  marketing: true,
};

export const CONSENT_NONE: Omit<ConsentState, "v" | "ts"> = {
  necessary: true,
  analytics: false,
  marketing: false,
};

function parse(raw: string): ConsentState | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;
    if (parsed.v !== CONSENT_VERSION) return null;
    return {
      v: CONSENT_VERSION,
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      ts: typeof parsed.ts === "string" ? parsed.ts : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Preferința curentă, sau null dacă omul n-a ales încă. */
export function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  return parse(match.slice(CONSENT_COOKIE.length + 1));
}

export function writeConsent(
  choice: Omit<ConsentState, "v" | "ts">
): ConsentState {
  const state: ConsentState = {
    v: CONSENT_VERSION,
    necessary: true,
    analytics: choice.analytics,
    marketing: choice.marketing,
    ts: new Date().toISOString(),
  };

  if (typeof document !== "undefined") {
    const value = encodeURIComponent(JSON.stringify(state));
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
  }

  return state;
}

/** Șterge preferința — bannerul reapare. */
export function resetConsent(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
}

export function hasConsent(category: ConsentCategory): boolean {
  if (category === "necessary") return true;
  const state = readConsent();
  return state ? state[category] : false;
}

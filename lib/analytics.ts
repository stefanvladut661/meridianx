/**
 * Analytics cu poartă de consimțământ (FAZA 7).
 *
 * Scriptul Vercel Analytics NU se injectează înainte de acceptul
 * explicit pe categoria „analitice”. De-aia nu folosim componenta
 * `<Analytics />` din pachet — aceea se montează necondiționat, iar
 * gate-ul trebuie să fie înainte de încărcare, nu după.
 *
 * Consecință plăcută: zero dependențe noi (CLAUDE.md §6.5).
 */

import { hasConsent } from "./consent";

declare global {
  interface Window {
    va?: (...args: unknown[]) => void;
    vaq?: unknown[][];
  }
}

const SCRIPT_ID = "meridian-va";
/** Ruta pe care Vercel o servește în producție; local nu există. */
const SCRIPT_SRC = "/_vercel/insights/script.js";

/** Injectează scriptul, o singură dată, doar dacă există consimțământ. */
export function loadAnalytics(): void {
  if (typeof window === "undefined") return;
  if (!hasConsent("analytics")) return;
  if (document.getElementById(SCRIPT_ID)) return;

  // coada oficială: apelurile făcute înainte de load nu se pierd
  if (!window.va) {
    window.va = function va(...args: unknown[]) {
      (window.vaq = window.vaq || []).push(args);
    };
  }

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = SCRIPT_SRC;
  script.defer = true;
  document.head.appendChild(script);
}

/** Scoate scriptul dacă omul își retrage consimțământul. */
export function unloadAnalytics(): void {
  if (typeof window === "undefined") return;
  document.getElementById(SCRIPT_ID)?.remove();
  delete window.va;
  delete window.vaq;
}

/**
 * Evenimentele de conversie ale site-ului. Lista e închisă intenționat:
 * un `track(oriceString)` devine în șase luni o mizerie pe care n-o mai
 * poate citi nimeni.
 */
export type ConversionEvent =
  | "lead_video_contact"
  | "lead_video_audit"
  | "lead_software_brief"
  | "lead_software_guide"
  | "whatsapp_open"
  | "call_click"
  | "estimator_used"
  | "guide_download";

export function track(
  event: ConversionEvent,
  properties: Record<string, string | number | boolean> = {}
): void {
  if (typeof window === "undefined") return;
  if (!hasConsent("analytics")) return;
  window.va?.("event", { name: event, data: properties });
}

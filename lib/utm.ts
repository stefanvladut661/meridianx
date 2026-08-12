/**
 * Captura UTM (FAZA 0, ÎNGHEȚAT) — folosită de toate formularele
 * (F3, F5) ca sursă unică. Rulează DOAR pe client.
 *
 * `captureUTM()` se cheamă o dată la mount în layout-urile de divizie
 * sau în componenta de formular; păstrează prima valoare din sesiune
 * (first-touch), ca lead-ul să atribuie campania care l-a adus.
 */

const STORAGE_KEY = "meridian_utm";

export interface UTMData {
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
}

/** Citește UTM-urile din URL-ul curent și le persistă în sessionStorage. */
export function captureUTM(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return; // first-touch câștigă

    const params = new URLSearchParams(window.location.search);
    const data: UTMData = {
      source: params.get("utm_source") ?? undefined,
      medium: params.get("utm_medium") ?? undefined,
      campaign: params.get("utm_campaign") ?? undefined,
      referrer: document.referrer || undefined,
    };

    if (data.source || data.medium || data.campaign || data.referrer) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // sessionStorage indisponibil (privacy mode) — atribuirea e best-effort.
  }
}

/** UTM-urile capturate în sesiunea curentă, pentru payload-ul de lead. */
export function getStoredUTM(): UTMData {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UTMData) : {};
  } catch {
    return {};
  }
}

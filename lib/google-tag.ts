/**
 * Tag-ul Google Ads (gtag.js), cu aceeași poartă de consimțământ ca
 * pixelii Meta și TikTok.
 *
 * Pornește doar dacă sunt adevărate amândouă:
 *   1. `NEXT_PUBLIC_GOOGLE_ADS_LEAD` e setat — eticheta conversiei „Lead"
 *      din Google Ads, de forma `AW-123456789/AbCdEfGhIjk` (Obiective →
 *      Conversii → acțiunea → „Configurează eticheta" → „send_to");
 *   2. omul a spus „da" la marketing.
 * Fără variabilă, nu se încarcă nimic — site-ul merge exact ca înainte.
 *
 * Consent Mode v2 (obligatoriu pentru publicul din SEE): scriptul se
 * încarcă abia după acord (implementarea „basic"), iar înainte de `config`
 * îi spunem lui Google explicit ce s-a acceptat — ad_storage, ad_user_data,
 * ad_personalization din categoria „marketing", analytics_storage din
 * „analitice". La retragere: `consent update` pe denied, apoi scriptul
 * scos, ca `googleAdsLead` să nu mai aibă pe cine chema.
 */

import { hasConsent } from "./consent";

const SEND_TO = process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD?.trim() ?? "";

/** `AW-123456789/AbCdEf` — destinația conversiei „Lead". `null` = tag-ul e oprit. */
export const GOOGLE_ADS_LEAD_SEND_TO = /^AW-\d{6,15}\/[A-Za-z0-9_-]{4,40}$/.test(SEND_TO) ? SEND_TO : null;

/** `AW-123456789` — contul din `config`. */
export const GOOGLE_ADS_TAG_ID = GOOGLE_ADS_LEAD_SEND_TO ? GOOGLE_ADS_LEAD_SEND_TO.split("/")[0] : null;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const SCRIPT_ID = "meridian-google-tag";

type ConsentValue = "granted" | "denied";

function consentNow(): Record<string, ConsentValue> {
  const marketing: ConsentValue = hasConsent("marketing") ? "granted" : "denied";
  return {
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
    analytics_storage: hasConsent("analytics") ? "granted" : "denied",
  };
}

/** Injectează tag-ul o singură dată, doar cu variabila setată și cu „da" la marketing. */
export function loadGoogleTag(): void {
  if (typeof window === "undefined" || !GOOGLE_ADS_TAG_ID) return;
  if (!hasConsent("marketing")) return;

  if (document.getElementById(SCRIPT_ID) && window.gtag) {
    // Deja încărcat în fila asta (accept → retragere → accept): doar acordul nou.
    window.gtag("consent", "update", consentNow());
    return;
  }

  window.dataLayer = window.dataLayer || [];
  /* Coada oficială: gtag.js citește obiecte `arguments`, nu liste — un
     `(...args) => push(args)` ar fi ignorat în tăcere. */
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  /* Ordinea din ghidul Google pentru implementarea „basic": starea
     implicită (totul refuzat), apoi alegerea omului, apoi `config`. */
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  });
  window.gtag("consent", "update", consentNow());
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ADS_TAG_ID);

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ADS_TAG_ID)}`;
  document.head.appendChild(script);
}

/** Retragerea acordului: Google află întâi, apoi scriptul și coada dispar. */
export function unloadGoogleTag(): void {
  if (typeof window === "undefined") return;
  window.gtag?.("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  document.getElementById(SCRIPT_ID)?.remove();
  delete window.gtag;
}

/** O vizualizare de pagină la navigările din interiorul site-ului (App Router nu reîncarcă). */
export function googlePageView(): void {
  if (typeof window === "undefined" || !GOOGLE_ADS_TAG_ID) return;
  if (!hasConsent("marketing")) return;
  window.gtag?.("event", "page_view", { send_to: GOOGLE_ADS_TAG_ID, page_location: window.location.href });
}

/**
 * Conversia „Lead", după ce serverul a confirmat lead-ul. Pleacă doar unde
 * există `gtag` — adică doar după acord. `transaction_id` = id-ul lead-ului:
 * Google numără o singură conversie chiar dacă evenimentul pleacă de două ori.
 */
export function googleAdsLead(leadId: string): void {
  if (typeof window === "undefined" || !GOOGLE_ADS_LEAD_SEND_TO) return;
  if (!hasConsent("marketing")) return;
  window.gtag?.("event", "conversion", { send_to: GOOGLE_ADS_LEAD_SEND_TO, transaction_id: leadId });
}

/**
 * Meta Pixel, cu poartă de consimțământ.
 *
 * Codul oficial de la Meta se lipește în `<head>` și pornește pe loc.
 * Aici nu: pixelul e cookie de marketing, iar în UE nu are voie să se
 * încarce înainte de un „da" explicit. Am păstrat exact secvența de
 * inițializare a lui Meta (coada `fbq`, `n.queue`, scriptul asincron),
 * dar am mutat-o în spatele aceleiași porți ca analytics-ul.
 *
 * Retragerea consimțământului scoate scriptul și golește `fbq`. Nu putem
 * șterge cookie-urile puse de facebook.com — sunt pe alt domeniu — dar
 * din momentul retragerii nu mai pleacă niciun eveniment.
 */

import { hasConsent } from "./consent";

/** ID-ul contului de reclame. Din env dacă e nevoie de altul, fără redeploy. */
export const PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "3075133136161307";

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: unknown;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const SCRIPT_ID = "meridian-meta-pixel";
const SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js";

/** Injectează pixelul o singură dată, doar cu consimțământ de marketing. */
export function loadMetaPixel(): void {
  if (typeof window === "undefined") return;
  if (!hasConsent("marketing")) return;
  if (document.getElementById(SCRIPT_ID)) return;
  /* Codul static din <head> a pornit deja pixelul (fbevents.js + init +
     PageView) și a lăsat `fbq`. Un al doilea init pe același ID dă
     „Duplicate Pixel ID" în consolă. Când `fbq` lipsește — după
     retragerea consimțământului — pornim noi, ca până acum. */
  if (window.fbq) return;

  if (!window.fbq) {
    /* Coada oficială Meta: apelurile de dinainte de load nu se pierd.
       Funcția se referă la ea însăși, deci are nevoie de numele legat
       înainte ca tipul complet să existe — de-aia declarăm întâi. */
    const fbq: Fbq = Object.assign(
      (...args: unknown[]) => {
        if (fbq.callMethod) {
          fbq.callMethod(...args);
        } else {
          fbq.queue.push(args);
        }
      },
      { queue: [] as unknown[][], push: null as unknown, loaded: true, version: "2.0" }
    );
    // `push` trebuie să fie funcția însăși — așa o așteaptă scriptul Meta.
    fbq.push = fbq;

    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
  }

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = SCRIPT_SRC;
  script.async = true;
  document.head.appendChild(script);

  /* Fără „configurare automată": altfel pixelul ghicește evenimente din
     textul butoanelor și raportează formularele noastre ca
     `SubmitApplication` sau `Subscribe`, iar campaniile optimizate pe
     `Lead` nu văd nicio conversie. Evenimentele le trimitem noi, explicit,
     din `submitLead`. Trebuie setat înainte de `init`. */
  window.fbq("set", "autoConfig", false, PIXEL_ID);

  /* `init` doar configurează pixelul; vizualizarea e un eveniment
     separat. Codul oficial Meta le are pe amândouă, una sub alta — dacă
     lipsește a doua, Events Manager rămâne gol și nu se poate construi
     nicio audiență. */
  window.fbq("init", PIXEL_ID);
  window.fbq("track", "PageView");
}

/** Scoate pixelul dacă omul își retrage consimțământul. */
export function unloadMetaPixel(): void {
  if (typeof window === "undefined") return;
  document.getElementById(SCRIPT_ID)?.remove();
  delete window.fbq;
  delete window._fbq;
}

/**
 * O vizualizare de pagină. Se cheamă și la navigările din interiorul
 * site-ului: App Router schimbă ruta fără reîncărcare, deci fără asta
 * Meta ar vedea o singură pagină per sesiune.
 */
export function pixelPageView(): void {
  if (typeof window === "undefined") return;
  if (!hasConsent("marketing")) return;
  window.fbq?.("track", "PageView");
}

/**
 * Evenimente standard Meta, cele pe care se pot optimiza campaniile.
 * Lista e închisă, ca și la analytics: un `track(oriceString)` devine în
 * șase luni o mizerie pe care n-o mai citește nimeni.
 */
export type PixelEvent = "Lead" | "Contact" | "Schedule" | "ViewContent";

/**
 * Pleacă oriunde există `fbq` — poarta e cine a încărcat pixelul, nu
 * funcția asta. Codul static din `<head>` îl pornește pentru toți, deci
 * un `Lead` condiționat de consimțământ ar lipsi din Events Manager
 * exact la vizitatorii pentru care Meta deja a numărat `PageView`-ul, iar
 * campania ar raporta o fracțiune din conversiile reale. Dacă pixelul se
 * întoarce vreodată doar în spatele porții, `fbq` există doar după „da"
 * și evenimentul se oprește singur acolo.
 */
export function pixelTrack(
  event: PixelEvent,
  properties: Record<string, string | number | boolean> = {}
): void {
  if (typeof window === "undefined") return;
  window.fbq?.("track", event, properties);
}

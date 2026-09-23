/**
 * TikTok Pixel, cu aceeași poartă de consimțământ ca Meta.
 *
 * Oglindește `lib/meta-pixel.ts`: coada oficială `ttq` (metodele se
 * pun în așteptare până se încarcă `events.js`), scriptul asincron,
 * `load` + `page` la pornire. Diferă doar vocabularul: TikTok are
 * `ttq.track("SubmitForm")` acolo unde Meta are `fbq("track", "Lead")`.
 *
 * Retragerea consimțământului scoate scriptul și golește `ttq`. Cookie-urile
 * de pe tiktok.com nu le putem șterge — sunt pe alt domeniu — dar din
 * momentul retragerii nu mai pleacă niciun eveniment.
 */

import { hasConsent } from "./consent";

/** ID-ul pixelului. Din env dacă e nevoie de altul, fără redeploy. */
export const TIKTOK_PIXEL_ID =
  process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID?.trim() || "DAN9FTJC77U07P78RH10";

/** Metodele pe care le expune SDK-ul — lista din codul oficial. */
const METHODS = [
  "page",
  "track",
  "identify",
  "instances",
  "debug",
  "on",
  "off",
  "once",
  "ready",
  "alias",
  "group",
  "enableCookie",
  "disableCookie",
  "holdConsent",
  "revokeConsent",
  "grantConsent",
] as const;

type TtqMethod = (typeof METHODS)[number];

type TtqQueue = unknown[][] & Partial<Record<TtqMethod, (...args: unknown[]) => void>>;

type Ttq = TtqQueue & {
  methods: readonly TtqMethod[];
  setAndDefer: (target: TtqQueue, method: TtqMethod) => void;
  instance: (id: string) => TtqQueue;
  load: (id: string, options?: Record<string, unknown>) => void;
  _i?: Record<string, TtqQueue & { _u?: string }>;
  _t?: Record<string, number>;
  _o?: Record<string, Record<string, unknown>>;
};

declare global {
  interface Window {
    ttq?: Ttq;
    TiktokAnalyticsObject?: string;
  }
}

const SCRIPT_ID = "meridian-tiktok-pixel";
const SCRIPT_SRC = "https://analytics.tiktok.com/i18n/pixel/events.js";

/** A fost retras consimțământul în fila asta, după ce pixelul rulase? */
let revokedHere = false;

/** Injectează pixelul o singură dată, doar cu consimțământ de marketing. */
export function loadTikTokPixel(): void {
  if (typeof window === "undefined") return;
  if (!hasConsent("marketing")) return;
  if (document.getElementById(SCRIPT_ID)) return;
  /* Cine avea consimțământul salvat are deja pixelul înregistrat de
     /pixels/tiktok.js din <head>. Meta ignoră un al doilea `init` pe
     același ID; TikTok nu — ar reseta coada și ar număra vizualizarea de
     două ori. */
  if (window.ttq?._i?.[TIKTOK_PIXEL_ID]) return;

  if (!window.ttq) {
    /* Coada oficială TikTok: fiecare metodă apelată înainte de load
       împinge `[nume, ...argumente]` în array; SDK-ul le consumă la
       încărcare. `instance(id)` primește propria coadă, cu aceleași
       metode amânate. */
    const setAndDefer = (target: TtqQueue, method: TtqMethod) => {
      target[method] = (...args: unknown[]) => {
        target.push([method, ...args]);
      };
    };

    const ttq = [] as unknown as Ttq;
    ttq.methods = METHODS;
    ttq.setAndDefer = setAndDefer;
    for (const method of METHODS) setAndDefer(ttq, method);

    ttq.instance = (id: string) => {
      const instance = (ttq._i?.[id] ?? []) as TtqQueue;
      for (const method of METHODS) setAndDefer(instance, method);
      return instance;
    };

    /* `load` din codul oficial: înregistrează id-ul și inserează
       scriptul. Aici doar înregistrăm — scriptul îl punem noi mai jos,
       cu id, ca să-l putem scoate la retragerea consimțământului. */
    ttq.load = (id: string, options?: Record<string, unknown>) => {
      ttq._i = ttq._i ?? {};
      ttq._i[id] = [] as unknown as TtqQueue & { _u?: string };
      ttq._i[id]._u = SCRIPT_SRC;
      ttq._t = ttq._t ?? {};
      ttq._t[id] = Date.now();
      ttq._o = ttq._o ?? {};
      ttq._o[id] = options ?? {};
    };

    window.TiktokAnalyticsObject = "ttq";
    window.ttq = ttq;
  }

  window.ttq.load(TIKTOK_PIXEL_ID);
  /* Accept după o retragere în aceeași filă: SDK-ul deja executat ține
     minte `revokeConsent` și ar tăcea până la `grantConsent`. */
  if (revokedHere) {
    window.ttq.grantConsent?.();
    revokedHere = false;
  }

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = `${SCRIPT_SRC}?sdkid=${TIKTOK_PIXEL_ID}&lib=ttq`;
  script.async = true;
  document.head.appendChild(script);

  /* `page` e vizualizarea — separată de `load`, ca la Meta `init` vs
     `PageView`. Fără ea, Events Manager nu vede nimic. */
  window.ttq.page?.();
}

/**
 * Scoate pixelul dacă omul își retrage consimțământul — indiferent cine
 * l-a pornit, noi sau /pixels/tiktok.js din <head>. Un SDK deja executat
 * nu se poate descărca, deci întâi `revokeConsent` (nu mai trimite nimic),
 * apoi ștergem `ttq`, ca `tiktokTrack` să nu mai aibă pe cine chema.
 *
 * Până la poarta din /pixels/tiktok.js, fișierul din <head> pornea
 * pixelul pentru toți, iar funcția asta trebuia să-l ocolească: altfel
 * `apply()` de la montare ștergea `ttq` la fiecare vizitator fără
 * consimțământ cât SDK-ul încă se încărca. Acum, fără „da", în <head> nu
 * pornește nimic, deci la montare nu e nimic de scos.
 */
export function unloadTikTokPixel(): void {
  if (typeof window === "undefined") return;
  if (!window.ttq) return;
  window.ttq.revokeConsent?.();
  revokedHere = true;
  document.getElementById(SCRIPT_ID)?.remove();
  delete window.ttq;
  delete window.TiktokAnalyticsObject;
}

/**
 * O vizualizare de pagină la navigările din interiorul site-ului —
 * App Router nu reîncarcă pagina, deci pixelul „clasic" ar vedea o
 * singură pagină per sesiune.
 */
export function tiktokPageView(): void {
  if (typeof window === "undefined") return;
  if (!hasConsent("marketing")) return;
  window.ttq?.page?.();
}

/**
 * Evenimente standard TikTok, cele pe care se pot optimiza campaniile.
 * `SubmitForm` e echivalentul lui `Lead` de la Meta. Listă închisă, din
 * același motiv ca la analytics.
 */
export type TikTokEvent = "SubmitForm" | "Contact" | "ViewContent";

/**
 * Pleacă oriunde există `ttq` — poarta e cine a încărcat pixelul, nu
 * funcția asta. Iar `ttq` există doar după „da" la marketing (la fel ca
 * `fbq` la Meta): din <head> pentru consimțământul salvat, din
 * `loadTikTokPixel` după accept.
 */
export function tiktokTrack(
  event: TikTokEvent,
  properties: Record<string, string | number | boolean> = {}
): void {
  if (typeof window === "undefined") return;
  window.ttq?.track?.(event, properties);
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, hasConsent } from "@/lib/consent";
import { PIXEL_ID, loadMetaPixel, pixelPageView, unloadMetaPixel } from "@/lib/meta-pixel";

/**
 * Montează pixelul Meta DUPĂ consimțământ și îl scoate dacă e retras.
 * Nu randează nimic vizibil.
 *
 * Două lucruri pe care codul lipit din Meta Events Manager nu le face:
 *
 * 1. Reacționează la schimbarea preferinței de cookie-uri, nu doar la
 *    prima încărcare.
 * 2. Trimite `PageView` și la navigările din interiorul site-ului.
 *    App Router schimbă ruta fără reîncărcare, deci pixelul „clasic" ar
 *    raporta o singură pagină pe sesiune — iar audiențele construite pe
 *    „a vizitat /video/portofoliu" ar rămâne goale.
 *
 * `<noscript>`-ul din codul original lipsește intenționat: e un pixel
 * imagine care pleacă necondiționat, deci exact ce n-avem voie să facem
 * înainte de accept. Îl randăm doar când există consimțământ, iar atunci
 * JavaScript-ul e oricum pornit — deci nu are ce acoperi.
 */
export function MetaPixel() {
  const pathname = usePathname();

  useEffect(() => {
    const apply = () => {
      if (hasConsent("marketing")) {
        loadMetaPixel();
      } else {
        unloadMetaPixel();
      }
    };

    apply();
    window.addEventListener(CONSENT_EVENT, apply);
    return () => window.removeEventListener(CONSENT_EVENT, apply);
  }, []);

  /* Prima vizualizare o trimite `loadMetaPixel`, în același loc în care
     face `init` — ca în codul oficial. Efectul ăsta prinde doar
     navigările de după, de-aia sare peste prima rulare: altfel pagina de
     intrare ar fi numărată de două ori. */
  const isFirstPath = useRef(true);
  useEffect(() => {
    if (isFirstPath.current) {
      isFirstPath.current = false;
      return;
    }
    pixelPageView();
  }, [pathname]);

  return null;
}

/** Doar ca ID-ul să fie vizibil în cod acolo unde se caută. */
export const META_PIXEL_ID = PIXEL_ID;

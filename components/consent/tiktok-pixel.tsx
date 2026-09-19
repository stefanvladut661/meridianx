"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, hasConsent } from "@/lib/consent";
import {
  TIKTOK_PIXEL_ID,
  loadTikTokPixel,
  tiktokPageView,
  unloadTikTokPixel,
} from "@/lib/tiktok-pixel";

/**
 * Montează pixelul TikTok DUPĂ consimțământ și îl scoate dacă e retras.
 * Nu randează nimic vizibil. Copia fidelă a `MetaPixel` — vezi acolo
 * de ce reacționăm la schimbarea preferinței și de ce trimitem `page`
 * la navigările din interiorul site-ului.
 */
export function TikTokPixel() {
  const pathname = usePathname();

  useEffect(() => {
    const apply = () => {
      if (hasConsent("marketing")) {
        loadTikTokPixel();
      } else {
        unloadTikTokPixel();
      }
    };

    apply();
    window.addEventListener(CONSENT_EVENT, apply);
    return () => window.removeEventListener(CONSENT_EVENT, apply);
  }, []);

  /* Prima vizualizare o trimite `loadTikTokPixel`, odată cu `load` — ca în
     codul oficial. Efectul ăsta prinde doar navigările de după. */
  const isFirstPath = useRef(true);
  useEffect(() => {
    if (isFirstPath.current) {
      isFirstPath.current = false;
      return;
    }
    tiktokPageView();
  }, [pathname]);

  return null;
}

/** Doar ca ID-ul să fie vizibil în cod acolo unde se caută. */
export const TIKTOK_PIXEL = TIKTOK_PIXEL_ID;

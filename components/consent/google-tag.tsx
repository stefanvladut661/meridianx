"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, hasConsent } from "@/lib/consent";
import { GOOGLE_ADS_TAG_ID, googlePageView, loadGoogleTag, unloadGoogleTag } from "@/lib/google-tag";

/**
 * Montează tag-ul Google Ads DUPĂ consimțământ și îl scoate dacă e retras.
 * Nu randează nimic. Același tipar ca `MetaPixel` și `TikTokPixel`; fără
 * `NEXT_PUBLIC_GOOGLE_ADS_LEAD` nu face nimic.
 */
export function GoogleTag() {
  const pathname = usePathname();

  useEffect(() => {
    if (!GOOGLE_ADS_TAG_ID) return;
    const apply = () => {
      if (hasConsent("marketing")) loadGoogleTag();
      else unloadGoogleTag();
    };
    apply();
    window.addEventListener(CONSENT_EVENT, apply);
    return () => window.removeEventListener(CONSENT_EVENT, apply);
  }, []);

  /* Prima vizualizare o trimite `config`, la încărcare. Efectul ăsta prinde
     doar navigările de după. */
  const isFirstPath = useRef(true);
  useEffect(() => {
    if (isFirstPath.current) {
      isFirstPath.current = false;
      return;
    }
    googlePageView();
  }, [pathname]);

  return null;
}

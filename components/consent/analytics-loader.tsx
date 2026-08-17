"use client";

import { useEffect } from "react";
import { CONSENT_EVENT } from "@/lib/consent";
import { loadAnalytics, unloadAnalytics } from "@/lib/analytics";
import { hasConsent } from "@/lib/consent";

/**
 * Montează analytics-ul DUPĂ consimțământ și îl scoate dacă e retras
 * (FAZA 7). Nu randează nimic.
 *
 * `loadAnalytics()` verifică el însuși consimțământul — dubla
 * verificare de aici e intenționată: componenta trebuie să reacționeze
 * și la schimbarea preferinței, nu doar la montare.
 */
export function AnalyticsLoader() {
  useEffect(() => {
    const apply = () => {
      if (hasConsent("analytics")) {
        loadAnalytics();
      } else {
        unloadAnalytics();
      }
    };

    apply();
    window.addEventListener(CONSENT_EVENT, apply);
    return () => window.removeEventListener(CONSENT_EVENT, apply);
  }, []);

  return null;
}

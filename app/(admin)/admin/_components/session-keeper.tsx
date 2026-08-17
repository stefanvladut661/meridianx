"use client";

import { useEffect } from "react";

/**
 * Ține sesiunea de admin vie (FAZA 6).
 *
 * Tokenul Supabase expiră în ~1h. Componentele de server nu pot scrie
 * cookie-uri, iar reîmprospătarea din middleware nu e o opțiune —
 * `middleware.ts` e înghețat după FAZA 0. Așa că lovim periodic un route
 * handler, unde scrierea de cookie-uri e permisă.
 *
 * Nu randează nimic și nu blochează nimic: dacă apelul eșuează, garda din
 * layout va trimite oricum la login la următoarea navigare.
 */

const REFRESH_INTERVAL = 45 * 60 * 1000;

export function SessionKeeper() {
  useEffect(() => {
    const refresh = () => {
      void fetch("/api/admin/session", {
        method: "POST",
        cache: "no-store",
      }).catch(() => {
        /* offline sau sesiune expirată — garda de la următoarea navigare decide */
      });
    };

    const interval = window.setInterval(refresh, REFRESH_INTERVAL);
    // Și la revenirea în filă: laptopul închis peste noapte e cazul obișnuit.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}

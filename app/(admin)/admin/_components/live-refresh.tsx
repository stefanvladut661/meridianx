"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Reîmprospătează lista de lead-uri fără să ceară un refresh manual (FAZA 6).
 *
 * `router.refresh()` re-cere payload-ul de Server Component pentru ruta
 * curentă — reia `listLeads`/`getLeadStats` cu filtrele deja din URL, fără
 * navigare și fără să piardă poziția de scroll sau un panou de lead deschis.
 *
 * De ce polling și nu Supabase Realtime: clienții Supabase din acest proiect
 * sunt legați de cookie-uri de sesiune și trăiesc doar pe server (vezi
 * garda din `lib/supabase/clients.ts`). Un canal realtime din browser ar
 * cere să scoatem tokenul de sesiune din cookie-ul httpOnly ca să treacă de
 * RLS — o gaură de securitate ca să câștigi câteva secunde. 20s e suficient
 * de aproape de „live" pentru o unealtă folosită de o singură persoană.
 */

const REFRESH_INTERVAL = 20 * 1000;

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), REFRESH_INTERVAL);

    // Revenirea în filă: dacă a stat plecat 10 minute, nu așteaptă intervalul.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}

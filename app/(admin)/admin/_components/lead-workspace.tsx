"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Lead, LeadEvent } from "@/lib/supabase/types";
import { LeadTable, type EmptyState } from "./lead-table";
import { LeadPanel } from "./lead-panel";

/**
 * Tabelul și fișa, împreună — ca fișa să se deschidă în secunda în care
 * dai clic, nu după ce serverul reia toată pagina.
 *
 * Starea de adevăr rămâne URL-ul (`?lead=<id>`): linkul se poate trimite,
 * Înapoi funcționează, refresh-ul păstrează fișa. Dar navigarea aia cere
 * serverului lista, indicatorii și lead-ul din nou, ceea ce durează
 * secunde — și în tot acest timp omul se uita la un rând apăsat și
 * nimic. Rândul are deja tot ce afișează fișa, în afară de istoric:
 * îl arătăm imediat, iar când răspunsul serverului sosește, îl ia el
 * de-acolo. Singurul lucru care „se încarcă” e istoricul.
 */

export interface LeadDetail {
  lead: Lead;
  events: LeadEvent[];
}

export function LeadWorkspace({
  leads,
  selectedId,
  detail,
  listHref,
  emptyState,
}: {
  leads: Lead[];
  selectedId: string | null;
  /** Lead-ul din URL, randat pe server — sau null dacă nu e niciunul. */
  detail: LeadDetail | null;
  /** URL-ul listei cu filtrele curente, fără `?lead=`. */
  listHref: string;
  emptyState: EmptyState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Lead | null>(null);

  const hrefFor = (leadId: string) =>
    `${listHref}${listHref.includes("?") ? "&" : "?"}lead=${leadId}`;

  const open = (lead: Lead) => {
    setOptimistic(lead);
    startTransition(() => {
      router.push(hrefFor(lead.id), { scroll: false });
    });
  };

  /* Când serverul a livrat fișa cerută (sau URL-ul nu mai are lead),
     copia optimistă și-a făcut treaba. */
  useEffect(() => {
    if (!isPending && (detail?.lead.id === optimistic?.id || !selectedId)) {
      setOptimistic(null);
    }
  }, [isPending, detail, selectedId, optimistic]);

  /* Copia optimistă câștigă doar cât timp serverul n-a livrat exact
     lead-ul ei; altfel fișa completă, cu istoric. */
  const shown =
    optimistic && detail?.lead.id !== optimistic.id
      ? { lead: optimistic, events: null }
      : detail;

  return (
    <>
      <LeadTable
        leads={leads}
        selectedId={optimistic?.id ?? selectedId}
        hrefFor={hrefFor}
        onOpen={open}
        emptyState={emptyState}
      />

      {shown ? (
        <LeadPanel
          lead={shown.lead}
          events={shown.events}
          closeHref={listHref}
        />
      ) : null}
    </>
  );
}

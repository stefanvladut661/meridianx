"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import type { Lead } from "@/lib/supabase/types";
import { STATUS_LABELS } from "@/lib/supabase/types";
import { Mark } from "@/components/site/mark";
import { cn } from "@/lib/utils";
import {
  DIVISION_LABEL,
  DIVISION_TONE,
  CHIP,
  FUNDED_TONE,
  STATUS_PILL,
  STATUS_TONE,
} from "./tone";

/**
 * Tabelul de lead-uri (FAZA 6). Dens, scanabil, cele mai noi primele.
 *
 * Tot rândul e clicabil — un lead se deschide de oriunde ai apăsa. Dar
 * un <tr> nu poate primi focus, deci numele rămâne o ancoră reală:
 * tastatura și cititoarele de ecran au un link adevărat, iar clicul pe
 * el nu deschide fișa de două ori (`closest("a")`).
 *
 * Culoarea spune lumea: muchia din stânga și eticheta de divizie poartă
 * albastrul video sau verdele software. Lead-urile din segmentul
 * „fonduri" au marcaj propriu — brief-ul le numește cele mai valoroase,
 * deci trebuie să sară în ochi într-o listă de cincizeci de rânduri.
 *
 * `next/link`, nu `@/i18n/navigation`: zona de admin e în afara i18n-ului
 * (middleware-ul o exclude explicit).
 */

export interface EmptyState {
  title: string;
  body: string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `azi ${date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}`
    : date.toLocaleDateString("ro-RO", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });
}

const HEADERS = ["Data", "Divizie", "Nume", "Contact", "Buget", "Formular", "Status"];

export function LeadTable({
  leads,
  selectedId,
  hrefFor,
  onOpen,
  emptyState,
}: {
  leads: Lead[];
  selectedId: string | null;
  /** Construiește URL-ul rândului păstrând filtrele curente. */
  hrefFor: (leadId: string) => string;
  /** Deschide fișa imediat, cu datele din rând. */
  onOpen: (lead: Lead) => void;
  emptyState: EmptyState;
}) {
  if (leads.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center rounded-panel-lg border border-dashed border-hair-strong px-6 py-20 text-center">
        <Mark size={28} className="text-dim" />
        <p className="display mt-6 text-[1.625rem] text-bone">
          {emptyState.title}
        </p>
        <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-dim">
          {emptyState.body}
        </p>
      </div>
    );
  }

  const onRowClick = (event: MouseEvent<HTMLTableRowElement>, lead: Lead) => {
    const target = event.target as HTMLElement;
    // Linkul de pe nume navighează singur; nu-l dublăm.
    if (target.closest("a, button")) return;
    // Selecția de text nu e un clic.
    if (window.getSelection()?.toString()) return;
    onOpen(lead);
  };

  return (
    <div className="mt-4 overflow-hidden rounded-panel-lg border border-hair bg-char">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[58rem] border-collapse text-left">
          <caption className="sr-only">
            Lead-uri, cele mai recente primele. Fiecare rând deschide fișa
            lead-ului.
          </caption>
          <thead>
            <tr className="border-b border-hair bg-glass">
              {HEADERS.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3.5 font-md-mono text-[11.5px] font-normal uppercase tracking-[0.16em] text-dim first:pl-6 last:pr-6"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const selected = lead.id === selectedId;
              const tone = DIVISION_TONE[lead.division];
              return (
                <tr
                  key={lead.id}
                  aria-current={selected ? "true" : undefined}
                  onClick={(event) => onRowClick(event, lead)}
                  className={cn(
                    "group relative cursor-pointer border-b border-hair transition-colors duration-150 last:border-b-0",
                    selected ? tone.tint : "hover:bg-white/[0.045]"
                  )}
                >
                  <td className="relative whitespace-nowrap py-4 pl-6 pr-4 font-md-mono text-[13px] tabular-nums text-bone/60">
                    {/* Muchia colorată a rândului: lumea din care vine. */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-2.5 left-0 w-1 rounded-r-full transition-opacity duration-150",
                        tone.bar,
                        selected ? "opacity-100" : "opacity-85 group-hover:opacity-100"
                      )}
                    />
                    {formatDate(lead.createdAt)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4">
                    <span className={cn(CHIP, tone.badge)}>
                      {DIVISION_LABEL[lead.division]}
                    </span>
                    {lead.isFunded ? (
                      <span className={cn(CHIP, "ml-1.5", FUNDED_TONE)}>
                        Fonduri
                      </span>
                    ) : null}
                  </td>

                  <td className="px-4 py-4">
                    <Link
                      href={hrefFor(lead.id)}
                      scroll={false}
                      onClick={(event) => {
                        // Ctrl/⌘-clic rămâne al browserului (filă nouă).
                        if (event.metaKey || event.ctrlKey || event.button !== 0) return;
                        event.preventDefault();
                        onOpen(lead);
                      }}
                      className="text-[16px] font-semibold text-bone underline-offset-4 group-hover:underline"
                    >
                      {lead.name}
                    </Link>
                    {lead.company ? (
                      <span className="mt-0.5 block text-[13.5px] text-dim">
                        {lead.company}
                      </span>
                    ) : null}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-[14px] text-bone/80">
                    {lead.phone ? (
                      <span className="block font-md-mono tabular-nums">
                        {lead.phone}
                      </span>
                    ) : null}
                    {lead.email ? (
                      <span className="block text-dim">{lead.email}</span>
                    ) : null}
                  </td>

                  <td className="px-4 py-4 text-[14px] text-bone/85">
                    {lead.budgetRange ?? <span className="text-dim">—</span>}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 font-md-mono text-[12px] tracking-wide text-dim">
                    {lead.source}
                  </td>

                  <td className="whitespace-nowrap py-4 pl-4 pr-6">
                    <span className={cn(STATUS_PILL, STATUS_TONE[lead.status])}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import type { MouseEvent } from "react";
import { Banknote, ChevronRight } from "lucide-react";
import type { Division } from "@/lib/division";
import type { Lead } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { Pill } from "../ui/primitives";
import { dateRo, initials, relativeRo, timeRo } from "../ui/format";
import { DIVISION_DOT, DIVISION_LABEL, STATUS_TONE, statusLabel } from "./labels";
import { NavLink } from "./nav-link";

function DivisionMark({ division }: { division: Division }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground/70">
      <span className={cn("h-1.5 w-1.5 rounded-full", DIVISION_DOT[division])} aria-hidden="true" />
      {DIVISION_LABEL[division]}
    </span>
  );
}

/**
 * Tabelul din prototip (de la 768 px) și lista pentru telefon. Tot rândul deschide fișa;
 * numele rămâne un link adevărat, ca tastatura și cititoarele de ecran să aibă unde ajunge.
 * Fișa se arată pe loc, cu datele din rând, înainte să răspundă serverul (`onOpen`).
 */
export function LeadsTable({
  rows,
  activeId,
  hrefFor,
  onOpen,
  freshIds,
  now,
}: {
  rows: Lead[];
  activeId: string | null;
  hrefFor: (leadId: string) => string;
  onOpen: (lead: Lead, href: string) => void;
  /** Lead-urile apărute între două reîmprospătări. */
  freshIds: ReadonlySet<string>;
  now: number;
}) {
  const linkClick = (event: MouseEvent<HTMLAnchorElement>, lead: Lead) => {
    // Ctrl/⌘-clic, clicul de mijloc și „filă nouă” rămân ale browserului.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onOpen(lead, hrefFor(lead.id));
  };

  const rowClick = (event: MouseEvent<HTMLTableRowElement>, lead: Lead) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    if (window.getSelection()?.toString()) return;
    onOpen(lead, hrefFor(lead.id));
  };

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Lead-uri, cele mai recente primele. Fiecare rând deschide fișa lead-ului.</caption>
          <thead>
            <tr className="border-b border-white/[0.07] text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <th scope="col" className="py-2.5 pl-4 pr-3 font-medium">
                Lead
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Divizie
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Status
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Data
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Tip proiect
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Sursă
              </th>
              <th scope="col" className="py-2.5 pl-3 pr-4 text-right font-medium">
                Buget
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => {
              const fresh = freshIds.has(lead.id);
              return (
                <tr
                  key={lead.id}
                  onClick={(event) => rowClick(event, lead)}
                  aria-current={activeId === lead.id ? "true" : undefined}
                  className={cn(
                    "group cursor-pointer border-b border-white/[0.04] transition-colors last:border-0",
                    activeId === lead.id ? "bg-white/[0.055]" : "hover:bg-white/[0.03]",
                    fresh && "bg-lav/[0.06]"
                  )}
                >
                  <td className="py-3 pl-4 pr-3">
                    <NavLink
                      href={hrefFor(lead.id)}
                      data-lead-link={lead.id}
                      onClick={(event) => linkClick(event, lead)}
                      className="flex min-w-0 items-center gap-2.5 outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.05] text-[10.5px] font-semibold text-foreground/70">
                        {initials(lead.name)}
                        {fresh ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-dotpulse rounded-full bg-lav ring-2 ring-[#12161a]" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium group-hover:text-lav">{lead.name}</span>
                          {fresh ? <Pill tone="lav">nou</Pill> : null}
                        </span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">{lead.company ?? "fără firmă"}</span>
                      </span>
                    </NavLink>
                  </td>
                  <td className="px-3 py-3">
                    <DivisionMark division={lead.division} />
                  </td>
                  <td className="px-3 py-3">
                    <Pill tone={STATUS_TONE[lead.status]} dot>
                      {statusLabel(lead.status)}
                    </Pill>
                  </td>
                  <td className="pu-num px-3 py-3 text-[12px] text-foreground/70">
                    <span className="block">{dateRo(lead.createdAt)}</span>
                    <span className="block text-[10.5px] text-muted-foreground">{timeRo(lead.createdAt)}</span>
                  </td>
                  <td className="max-w-[190px] px-3 py-3 text-[12.5px] text-foreground/80">
                    <span className="block truncate">{lead.projectType ?? <span className="text-muted-foreground">—</span>}</span>
                    {lead.isFunded ? (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-apricot">
                        <Banknote className="h-3 w-3" aria-hidden="true" /> cere fonduri
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-muted-foreground">
                    <span className="block">{lead.source}</span>
                    {lead.utm.source ? <span className="block text-[10.5px] text-muted-foreground/70">via {lead.utm.source}</span> : null}
                  </td>
                  <td className="py-3 pl-3 pr-4 text-right">
                    <span className="pu-num text-[12.5px] text-foreground/80">{lead.budgetRange ?? <span className="text-muted-foreground">—</span>}</span>
                    <ChevronRight className="ml-auto mt-0.5 h-3 w-3 text-foreground/20 group-hover:text-foreground/50" aria-hidden="true" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-white/[0.05] md:hidden">
        {rows.map((lead) => (
          <li key={lead.id}>
            <NavLink
              href={hrefFor(lead.id)}
              data-lead-link={lead.id}
              onClick={(event) => linkClick(event, lead)}
              className={cn("block px-4 py-3.5", freshIds.has(lead.id) && "bg-lav/[0.06]", activeId === lead.id && "bg-white/[0.055]")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">{lead.name}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{lead.company ?? "fără firmă"}</p>
                </div>
                <Pill tone={STATUS_TONE[lead.status]}>{statusLabel(lead.status)}</Pill>
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                <DivisionMark division={lead.division} />
                <span>{relativeRo(lead.createdAt, now)}</span>
                {lead.isFunded ? <span className="text-apricot">fonduri</span> : null}
              </div>
            </NavLink>
          </li>
        ))}
      </ul>
    </>
  );
}

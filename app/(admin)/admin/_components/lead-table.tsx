import Link from "next/link";
import type { Lead } from "@/lib/supabase/types";
import { STATUS_LABELS } from "@/lib/supabase/types";
import { Mark } from "@/components/site/mark";
import { cn } from "@/lib/utils";
import { FUNDED_TONE, STATUS_PILL, STATUS_TONE } from "./tone";

/**
 * Tabelul de lead-uri (FAZA 6). Dens, scanabil, cele mai noi primele.
 *
 * Lead-urile din segmentul „fonduri" au marcaj propriu — brief-ul le
 * numește cele mai valoroase, deci trebuie să sară în ochi într-o listă
 * de cincizeci de rânduri, nu să fie descoperite deschizându-le pe rând.
 *
 * `next/link`, nu `@/i18n/navigation`: zona de admin e în afara i18n-ului
 * (middleware-ul o exclude explicit).
 */

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
  emptyState,
}: {
  leads: Lead[];
  selectedId: string | null;
  /** Construiește URL-ul rândului păstrând filtrele curente. */
  hrefFor: (leadId: string) => string;
  emptyState: { title: string; body: string };
}) {
  if (leads.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center rounded-panel-lg border border-dashed border-hair-strong px-6 py-20 text-center">
        <Mark size={28} className="text-dim" />
        <p className="display mt-6 text-[1.375rem] text-bone">
          {emptyState.title}
        </p>
        <p className="mt-3 max-w-md text-pretty text-[14px] leading-relaxed text-dim">
          {emptyState.body}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-panel-lg border border-hair bg-char">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[58rem] border-collapse text-left">
          <caption className="sr-only">
            Lead-uri, cele mai recente primele. Fiecare rând deschide panoul
            de detaliu.
          </caption>
          <thead>
            <tr className="border-b border-hair bg-glass">
              {HEADERS.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-md-mono text-[10.5px] font-normal uppercase tracking-[0.18em] text-dim first:pl-5 last:pr-5"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const selected = lead.id === selectedId;
              return (
                <tr
                  key={lead.id}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "group border-b border-hair transition-colors duration-150 last:border-b-0",
                    selected ? "bg-white/[0.06]" : "hover:bg-glass"
                  )}
                >
                  <td className="whitespace-nowrap py-3 pl-5 pr-4 font-md-mono text-[12px] tabular-nums text-dim">
                    {formatDate(lead.createdAt)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-md-mono text-[10.5px] uppercase tracking-[0.16em] text-bone/70">
                      {lead.division === "video" ? "Video" : "Software"}
                    </span>
                    {lead.isFunded ? (
                      <span
                        className={cn(
                          "ml-2 rounded-full border px-2 py-0.5 font-md-mono text-[9.5px] uppercase tracking-[0.14em]",
                          FUNDED_TONE
                        )}
                      >
                        Fonduri
                      </span>
                    ) : null}
                  </td>

                  <td className="px-4 py-3">
                    {/* Linkul e pe nume, nu pe rând: un <tr> clicabil nu poate fi
                        focalizat cu tastatura fără trucuri. Aici e o ancoră reală. */}
                    <Link
                      href={hrefFor(lead.id)}
                      scroll={false}
                      className="text-[14.5px] font-medium text-bone underline-offset-4 group-hover:underline"
                    >
                      {lead.name}
                    </Link>
                    {lead.company ? (
                      <span className="block text-[12.5px] text-dim">
                        {lead.company}
                      </span>
                    ) : null}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-bone/75">
                    {lead.phone ? (
                      <span className="block font-md-mono tabular-nums">
                        {lead.phone}
                      </span>
                    ) : null}
                    {lead.email ? (
                      <span className="block text-dim">{lead.email}</span>
                    ) : null}
                  </td>

                  <td className="px-4 py-3 text-[12.5px] text-bone/80">
                    {lead.budgetRange ?? <span className="text-dim">—</span>}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 font-md-mono text-[11px] tracking-wide text-dim">
                    {lead.source}
                  </td>

                  <td className="whitespace-nowrap py-3 pl-4 pr-5">
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

import Link from "next/link";
import type { Lead } from "@/lib/supabase/types";
import { STATUS_LABELS } from "@/lib/supabase/types";
import type { LeadStatus } from "@/lib/validations/lead";
import { cn } from "@/lib/utils";

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

const STATUS_TONE: Record<LeadStatus, string> = {
  new: "border-accent text-accent",
  contacted: "border-line text-fg/80",
  qualified: "border-accent-2/70 text-accent-2",
  proposal: "border-accent-2/70 text-accent-2",
  won: "border-emerald-500/60 text-emerald-400",
  lost: "border-line text-muted",
};

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
      <div className="border-t border-line py-20 text-center">
        <p className="font-display text-lg font-semibold tracking-tight">
          {emptyState.title}
        </p>
        <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-fg/70">
          {emptyState.body}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-t border-line">
      <table className="w-full min-w-[56rem] border-collapse text-left">
        <caption className="sr-only">
          Lead-uri, cele mai recente primele. Fiecare rând deschide panoul de
          detaliu.
        </caption>
        <thead>
          <tr className="border-b border-line">
            {["Data", "Divizie", "Nume", "Contact", "Buget", "Formular", "Status"].map(
              (header) => (
                <th
                  key={header}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted first:pl-0 last:pr-0"
                >
                  {header}
                </th>
              )
            )}
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
                  "group border-b border-line transition-colors duration-150",
                  selected ? "bg-surface" : "hover:bg-surface/60"
                )}
              >
                <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-[11px] tabular-nums text-muted">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mr-2 inline-block h-3.5 w-0.5 align-middle",
                      lead.isFunded ? "bg-accent-2" : "bg-transparent"
                    )}
                  />
                  {formatDate(lead.createdAt)}
                </td>

                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg/70">
                    {lead.division === "video" ? "VID" : "SFW"}
                  </span>
                  {lead.isFunded ? (
                    <span className="ml-2 rounded-xs border border-accent-2/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-accent-2">
                      Fonduri
                    </span>
                  ) : null}
                </td>

                <td className="px-3 py-2.5">
                  {/* Linkul e pe nume, nu pe rând: un <tr> clicabil nu poate fi
                      focalizat cu tastatura fără trucuri. Aici e o ancoră reală. */}
                  <Link
                    href={hrefFor(lead.id)}
                    scroll={false}
                    className="font-medium text-fg underline-offset-4 group-hover:underline"
                  >
                    {lead.name}
                  </Link>
                  {lead.company ? (
                    <span className="block text-xs text-muted">{lead.company}</span>
                  ) : null}
                </td>

                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-fg/70">
                  {lead.phone ? <span className="block">{lead.phone}</span> : null}
                  {lead.email ? (
                    <span className="block text-muted">{lead.email}</span>
                  ) : null}
                </td>

                <td className="px-3 py-2.5 text-xs text-fg/80">
                  {lead.budgetRange ?? <span className="text-muted">—</span>}
                </td>

                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] tracking-wide text-muted">
                  {lead.source}
                </td>

                <td className="whitespace-nowrap py-2.5 pl-3">
                  <span
                    className={cn(
                      "inline-block rounded-xs border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                      STATUS_TONE[lead.status]
                    )}
                  >
                    {STATUS_LABELS[lead.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

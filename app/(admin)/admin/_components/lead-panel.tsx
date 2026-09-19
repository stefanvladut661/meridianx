import Link from "next/link";
import type { Lead, LeadEvent } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { PanelShell } from "./panel-shell";
import { StatusControl, NotesControl } from "./lead-forms";
import { FUNDED_TONE } from "./tone";

/**
 * Panoul de detaliu (FAZA 6). Se deschide lateral, prin `?lead=<id>`.
 *
 * Conținutul e randat pe server: se poate trimite pe chat unui coleg și
 * se deschide direct pe lead-ul respectiv, cu filtrele păstrate.
 */

const EVENT_LABELS: Record<string, string> = {
  created: "Lead creat",
  status_changed: "Status schimbat",
  note_added: "Note actualizate",
  email_sent: "Emailuri trimise",
  brief_step: "Pas de brief",
  estimator_used: "Estimator folosit",
  download: "Descărcare",
  call_booked: "Call programat",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * „Neatins de 6 zile” spune mai mult decât o dată calendaristică: panoul e
 * o coadă de lucru, iar întrebarea zilnică e pe cine n-ai mai sunat.
 */
function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "azi";
  if (days === 1) return "ieri";
  return `acum ${days} zile`;
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-hair py-3">
      <dt className="eyebrow !text-[10px] leading-5">{label}</dt>
      <dd className="break-words text-[14px] leading-5 text-bone/85">{value}</dd>
    </div>
  );
}

/** Rezumatul unui eveniment, fără să vărsăm JSON brut în interfață. */
function describeEvent(event: LeadEvent): string | null {
  const payload = event.payload ?? {};
  if (event.type === "status_changed") {
    const from = payload.from;
    const to = payload.to;
    if (typeof from === "string" && typeof to === "string") {
      return `${from} → ${to}`;
    }
  }
  if (event.type === "email_sent") {
    const notification = payload.notification;
    const confirmation = payload.confirmation;
    return `notificare: ${String(notification ?? "?")} · confirmare: ${String(confirmation ?? "?")}`;
  }
  if (event.type === "brief_step") {
    const step = payload.step;
    if (step !== undefined) return `pasul ${String(step)}`;
  }
  const keys = Object.keys(payload);
  return keys.length > 0 ? keys.join(", ") : null;
}

export function LeadPanel({
  lead,
  events,
  closeHref,
}: {
  lead: Lead;
  events: LeadEvent[];
  closeHref: string;
}) {
  const headingId = `lead-panel-${lead.id}`;

  return (
    <PanelShell closeHref={closeHref} labelledBy={headingId}>
      <div className="flex items-start justify-between gap-4 border-b border-hair px-6 py-5">
        <div className="min-w-0">
          <p className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1 !text-[10px]">
            <span>{lead.division === "video" ? "Video" : "Software"}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDateTime(lead.createdAt)}</span>
            {lead.updatedAt !== lead.createdAt ? (
              <>
                <span aria-hidden="true">·</span>
                <span>atins {relativeDays(lead.updatedAt)}</span>
              </>
            ) : null}
            {lead.isFunded ? (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 tracking-[0.14em]",
                  FUNDED_TONE
                )}
              >
                Fonduri
              </span>
            ) : null}
          </p>
          <h2
            id={headingId}
            className="display mt-2 truncate text-[1.5rem] text-bone"
          >
            {lead.name}
          </h2>
          {lead.company ? (
            <p className="mt-1 truncate text-[14px] text-dim">{lead.company}</p>
          ) : null}
        </div>

        <Link
          href={closeHref}
          scroll={false}
          className="btn btn-ghost shrink-0 !min-h-9 !px-4 !py-2 !text-[12.5px]"
        >
          Închide
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Acțiunea rapidă stă sus: de obicei deschizi panoul ca să suni. */}
        {lead.phone || lead.email ? (
          <div className="mb-7 flex flex-wrap gap-2.5">
            {lead.phone ? (
              <a
                href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
                className="btn btn-light !min-h-10 !px-5 !py-2 !text-[13.5px]"
              >
                Sună {lead.phone}
              </a>
            ) : null}
            {lead.email ? (
              <a
                href={`mailto:${lead.email}`}
                className="btn btn-ghost !min-h-10 !px-5 !py-2 !text-[13.5px]"
              >
                Scrie email
              </a>
            ) : null}
          </div>
        ) : null}

        <StatusControl leadId={lead.id} current={lead.status} />

        <dl className="mt-8 border-t border-hair">
          <Row label="Telefon" value={lead.phone} />
          <Row label="Email" value={lead.email} />
          <Row label="Tip proiect" value={lead.projectType} />
          <Row label="Buget" value={lead.budgetRange} />
          <Row label="Termen" value={lead.timeline} />
          <Row label="Formular" value={lead.source} />
          <Row label="Limbă" value={lead.locale.toUpperCase()} />
          <Row label="Campanie" value={lead.utm.campaign} />
          <Row label="Sursă UTM" value={lead.utm.source} />
          <Row label="Mediu UTM" value={lead.utm.medium} />
          <Row label="Referrer" value={lead.referrer} />
        </dl>

        {lead.message ? (
          <div className="mt-7">
            <p className="eyebrow">Mesaj</p>
            <p className="mt-3 whitespace-pre-wrap rounded-panel border border-hair bg-glass px-4 py-3.5 text-[14px] leading-relaxed text-bone/90">
              {lead.message}
            </p>
          </div>
        ) : null}

        <div className="mt-8">
          <NotesControl leadId={lead.id} notes={lead.notes} />
        </div>

        <div className="mt-8">
          <p className="eyebrow">Istoric</p>
          {events.length === 0 ? (
            <p className="mt-3 text-[14px] text-dim">
              Încă nu s-a întâmplat nimic în afară de sosirea lead-ului.
            </p>
          ) : (
            <ol className="mt-3 border-t border-hair">
              {events.map((event) => {
                const detail = describeEvent(event);
                return (
                  <li
                    key={event.id}
                    className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-hair py-3"
                  >
                    <span className="font-md-mono text-[10.5px] tabular-nums leading-5 text-dim">
                      {formatDateTime(event.createdAt)}
                    </span>
                    <span className="text-[14px] leading-5 text-bone/85">
                      {EVENT_LABELS[event.type] ?? event.type}
                      {detail ? (
                        <span className="block font-md-mono text-[10.5px] text-dim">
                          {detail}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

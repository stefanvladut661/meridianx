import Link from "next/link";
import type { Lead, LeadEvent } from "@/lib/supabase/types";
import { PanelShell } from "./panel-shell";
import { StatusControl, NotesControl } from "./lead-forms";

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
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-line py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {label}
      </dt>
      <dd className="break-words text-sm text-fg/85">{value}</dd>
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
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
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
              <span className="rounded-xs border border-accent-2/50 px-1.5 py-0.5 text-accent-2">
                Fonduri
              </span>
            ) : null}
          </p>
          <h2
            id={headingId}
            className="mt-1.5 truncate font-display text-xl font-semibold tracking-tight"
          >
            {lead.name}
          </h2>
          {lead.company ? (
            <p className="truncate text-sm text-muted">{lead.company}</p>
          ) : null}
        </div>

        <Link
          href={closeHref}
          scroll={false}
          className="shrink-0 rounded-sm border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-fg/70 hover:border-muted hover:text-fg"
        >
          Închide
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Acțiunea rapidă stă sus: de obicei deschizi panoul ca să suni. */}
        {lead.phone || lead.email ? (
          <div className="mb-6 flex flex-wrap gap-2">
            {lead.phone ? (
              <a
                href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex h-9 items-center rounded-sm bg-s-signal px-4 text-sm font-semibold text-s-ink transition-colors duration-150 hover:bg-[#6b93ff]"
              >
                Sună {lead.phone}
              </a>
            ) : null}
            {lead.email ? (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex h-9 items-center rounded-sm border border-line px-4 text-sm text-fg transition-colors duration-150 hover:border-muted"
              >
                Scrie email
              </a>
            ) : null}
          </div>
        ) : null}

        <StatusControl leadId={lead.id} current={lead.status} />

        <dl className="mt-8 border-t border-line">
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
          <div className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Mesaj
            </p>
            <p className="mt-2 whitespace-pre-wrap border-l-2 border-accent pl-4 text-sm leading-relaxed text-fg/85">
              {lead.message}
            </p>
          </div>
        ) : null}

        <div className="mt-8">
          <NotesControl leadId={lead.id} notes={lead.notes} />
        </div>

        <div className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Istoric
          </p>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Încă nu s-a întâmplat nimic în afară de sosirea lead-ului.
            </p>
          ) : (
            <ol className="mt-3 border-t border-line">
              {events.map((event) => {
                const detail = describeEvent(event);
                return (
                  <li
                    key={event.id}
                    className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-line py-2.5"
                  >
                    <span className="font-mono text-[10px] tabular-nums leading-5 text-muted">
                      {formatDateTime(event.createdAt)}
                    </span>
                    <span className="text-sm leading-5 text-fg/85">
                      {EVENT_LABELS[event.type] ?? event.type}
                      {detail ? (
                        <span className="block font-mono text-[10px] text-muted">
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

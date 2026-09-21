import Link from "next/link";
import type { Lead, LeadEvent } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { PanelShell } from "./panel-shell";
import { DeleteControl, NotesControl, StatusControl } from "./lead-forms";
import { formatLeadDateTime } from "./format-date";
import {
  CHIP,
  DIVISION_LABEL,
  DIVISION_TONE,
  FUNDED_TONE,
  WHATSAPP_TONE,
} from "./tone";

/**
 * Panoul de detaliu (FAZA 6). Se deschide lateral, prin `?lead=<id>`.
 *
 * Conținutul vine de pe server (deep-linkabil, cu filtrele păstrate),
 * dar componenta e pură: `LeadWorkspace` o randează și pe client, cu
 * lead-ul din rând, în secunda în care dai clic — istoricul (`events`)
 * e singurul lucru pe care îl așteaptă de la server, deci `null`
 * înseamnă „se încarcă”, nu „gol”.
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

/**
 * Numărul în formatul pe care îl cere wa.me: doar cifre, cu prefix de
 * țară. „07xx” e România — cazul de departe cel mai des pe formularele
 * noastre; un „+40” sau „0040” trece deja curat.
 */
function whatsappDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `40${digits.slice(1)}`;
  return digits;
}

/** Primul mesaj — scurt, cu numele și divizia, ca omul să știe cine scrie. */
function whatsappMessage(lead: Lead): string {
  const firstName = lead.name.trim().split(/\s+/)[0] ?? lead.name;
  const what =
    lead.division === "video" ? "proiectul video" : "proiectul de software";
  return `Bună, ${firstName}! Sunt de la MERIDIAN — am primit cererea ta de pe site pentru ${what}. Când ai 10 minute să vorbim?`;
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-hair py-3">
      <dt className="eyebrow !text-[11px] leading-6">{label}</dt>
      <dd className="break-words text-[15px] leading-6 text-bone/90">{value}</dd>
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
  /** `null` = încă nu a venit de pe server. */
  events: LeadEvent[] | null;
  closeHref: string;
}) {
  const headingId = `lead-panel-${lead.id}`;
  const tone = DIVISION_TONE[lead.division];
  const action =
    "btn !min-h-11 !px-5 !py-2 !text-[14.5px] !gap-2";

  return (
    <PanelShell closeHref={closeHref} labelledBy={headingId}>
      {/* Muchia de sus poartă culoarea lumii din care vine lead-ul —
          e primul lucru pe care îl vezi când se deschide fișa. */}
      <div aria-hidden className={cn("h-1 shrink-0", tone.bar)} />

      <div className="flex items-start justify-between gap-4 border-b border-hair px-6 py-5">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-md-mono text-[11px] uppercase tracking-[0.16em] text-dim">
            <span className={cn(CHIP, tone.badge)}>
              {DIVISION_LABEL[lead.division]}
            </span>
            {lead.isFunded ? (
              <span className={cn(CHIP, FUNDED_TONE)}>Fonduri</span>
            ) : null}
            <span>{formatLeadDateTime(lead.createdAt)}</span>
            {lead.updatedAt !== lead.createdAt ? (
              <>
                <span aria-hidden="true">·</span>
                <span>atins {relativeDays(lead.updatedAt)}</span>
              </>
            ) : null}
          </p>
          <h2
            id={headingId}
            className="display mt-3 truncate text-[1.75rem] text-bone"
          >
            {lead.name}
          </h2>
          {lead.company ? (
            <p className="mt-1 truncate text-[15px] text-dim">{lead.company}</p>
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
        {/* Acțiunile rapide stau sus: de obicei deschizi fișa ca să
            contactezi omul. Trei căi, în ordinea în care răspund
            clienții: WhatsApp, telefon, email. */}
        {lead.phone || lead.email ? (
          <div className="mb-7 flex flex-wrap gap-2.5">
            {lead.phone ? (
              <a
                href={`https://wa.me/${whatsappDigits(lead.phone)}?text=${encodeURIComponent(whatsappMessage(lead))}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(action, "btn-primary", WHATSAPP_TONE)}
              >
                <WhatsAppIcon />
                WhatsApp
              </a>
            ) : null}
            {lead.phone ? (
              <a
                href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
                className={cn(action, "btn-light")}
              >
                <PhoneIcon />
                Sună
              </a>
            ) : null}
            {lead.email ? (
              <a
                href={`mailto:${lead.email}`}
                className={cn(action, "btn-ghost")}
              >
                <MailIcon />
                Email
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
            <p
              className={cn(
                "mt-3 whitespace-pre-wrap rounded-panel border border-hair bg-glass px-4 py-3.5 text-[15px] leading-relaxed text-bone/90",
                tone.glow
              )}
            >
              {lead.message}
            </p>
          </div>
        ) : null}

        <div className="mt-8">
          <NotesControl leadId={lead.id} notes={lead.notes} />
        </div>

        <div className="mt-8">
          <p className="eyebrow">Istoric</p>
          {events === null ? (
            <p className="mt-3 text-[15px] text-dim" aria-live="polite">
              Se încarcă istoricul…
            </p>
          ) : events.length === 0 ? (
            <p className="mt-3 text-[15px] text-dim">
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
                    <span className="font-md-mono text-[11.5px] tabular-nums leading-6 text-dim">
                      {formatLeadDateTime(event.createdAt)}
                    </span>
                    <span className="text-[15px] leading-6 text-bone/90">
                      {EVENT_LABELS[event.type] ?? event.type}
                      {detail ? (
                        <span className="block font-md-mono text-[11.5px] text-dim">
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

        {/* Ultimul lucru din panou, după istoric: nimeni nu deschide un
            lead ca să-l șteargă, deci nu stă lângă „Sună”. */}
        <div className="mt-10 border-t border-hair pt-6">
          <DeleteControl leadId={lead.id} leadName={lead.name} returnTo={closeHref} />
        </div>
      </div>
    </PanelShell>
  );
}

/* Iconuri de 1.5px, aceeași gramatică ca `components/site/ui.tsx`;
   copiate aici fiindcă admin-ul nu importă din zona site-ului decât
   marca. */
const icon = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function WhatsAppIcon() {
  return (
    <svg {...icon}>
      <path d="M3.5 20.5 5 16.4A8 8 0 1 1 8 19.3l-4.5 1.2Z" />
      <path d="M9 9.2c.3 2.2 2.4 4.4 4.8 4.9.5.1 1-.2 1.2-.7l.2-.6-2-1-.7.8a5.4 5.4 0 0 1-2-2l.9-.6-.9-2h-.7c-.5.2-.9.6-.8 1.2Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg {...icon}>
      <path d="M6 3h3l2 5-2.2 1.4a12 12 0 0 0 5.8 5.8L16 13l5 2v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 6.2 2 2 0 0 1 6 3Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...icon}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m4 7.5 8 5.5 8-5.5" />
    </svg>
  );
}

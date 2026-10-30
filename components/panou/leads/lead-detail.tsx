"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Link2,
  Mail,
  Megaphone,
  MessageCircle,
  Phone,
  Trash2,
  X,
} from "lucide-react";
import type { Lead, LeadEvent } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { Btn, btnClass, Card, Pill } from "../ui/primitives";
import { dateTimeRo, relativeRo } from "../ui/format";
import { useToast } from "../ui/toast";
import { DeleteButton, DeleteControl, NotesControl, StatusControl } from "./lead-controls";
import { LeadHistory } from "./lead-history";
import { DIVISION_DOT, DIVISION_LABEL, STATUS_TONE, describeEvent, shortId, statusLabel, telHref, touchedAgo, whatsappHref } from "./labels";
import { NavLink, useLeadsNav } from "./nav-link";
import type { LeadDetailNeighbors } from "./urls";

function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-white/[0.06] px-4 py-4 sm:px-5", className)}>
      {title ? <h3 className="mb-3 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h3> : null}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-[12.5px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-foreground/85">{children}</span>
    </div>
  );
}

const Dash = () => <span className="text-muted-foreground">—</span>;

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboardul poate fi blocat; confirmarea se arată oricum */
  }
}

const iconButton = "rounded-md p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground";
const contactLink = "flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] text-[12.5px] transition-colors hover:bg-white/[0.06]";

/**
 * Fișa lead-ului din prototip, legată la datele reale. `events === null` = istoricul încă vine de pe
 * server (fișa s-a deschis pe loc, cu datele din rând); `neighbors === null` = pozițiile nu sunt încă
 * calculate. Peste prototip: mesajul întreg, emailurile trimise în istoric, „Atins acum…”, închiderea
 * cu Esc și pierderea notelor evitată la reîmprospătare.
 */
export function LeadDetail({
  lead,
  events,
  neighbors,
  listHref,
  now,
}: {
  lead: Lead;
  events: LeadEvent[] | null;
  neighbors: LeadDetailNeighbors | null;
  /** Lista cu filtrele curente, fără `lead`: „Înapoi”, „Închide” și redirectul după ștergere. */
  listHref: string;
  now: number;
}) {
  const nav = useLeadsNav();
  const { notify } = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const history = useMemo(() => (events ? events.map(describeEvent) : null), [events]);
  const whatsapp = whatsappHref(lead);

  // Fișa s-a deschis: focusul trece pe titlu, ca tastatura și cititorul de ecran să fie în ea.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [lead.id]);

  // Esc închide fișa, dar nu cât scrii într-un câmp sau cât e deschis un dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      nav?.go(listHref);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [nav, listHref]);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const copyLink = async () => {
    // Linkul curat, ca în emailurile de notificare: /admin?lead=<id>. Filtrele nu fac parte din lead.
    await copyText(`${window.location.origin}/admin?lead=${encodeURIComponent(lead.id)}`);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    notify("Linkul lead-ului e în clipboard.");
  };

  const headingId = `lead-${lead.id}-titlu`;

  return (
    <Card as="section" aria-labelledby={headingId} aria-busy={nav?.pending || undefined} className={cn("overflow-hidden p-0 transition-opacity", nav?.pending && "opacity-70")}>
      <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
        <NavLink href={listHref} className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground lg:hidden" aria-label="Înapoi la listă">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </NavLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} ref={headingRef} tabIndex={-1} className="truncate text-[17px] font-semibold outline-none">
              {lead.name}
            </h2>
            <Pill tone={STATUS_TONE[lead.status]} dot>
              {statusLabel(lead.status)}
            </Pill>
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            {lead.company ?? "fără firmă"} · <span className="font-mono text-[11.5px]" title={lead.id}>{shortId(lead.id)}</span> · {relativeRo(lead.createdAt, now)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={copyLink} className={iconButton} aria-label="Copiază linkul lead-ului">
            {copied ? <CheckCircle2 className="h-4 w-4 text-mint" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => setDeleteOpen(true)} className={cn(iconButton, "hover:bg-rose/10 hover:text-rose")} aria-label="Șterge definitiv lead-ul">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <NavLink href={listHref} className={cn(iconButton, "hidden lg:inline-flex")} aria-label="Închide fișa (Esc)" title="Închide (Esc)">
            <X className="h-4 w-4" aria-hidden="true" />
          </NavLink>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 sm:px-5">
        <span className="text-[11px] text-muted-foreground">
          {neighbors === null ? "se calculează poziția…" : neighbors.position !== null ? `${neighbors.position} din ${neighbors.total} în lista filtrată` : "în afara filtrului curent"}
        </span>
        <div className="flex items-center gap-1.5">
          {neighbors?.prevHref ? (
            <NavLink href={neighbors.prevHref} className={btnClass({ variant: "outline", size: "xs" })}>
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Anterior
            </NavLink>
          ) : (
            <Btn size="xs" variant="outline" disabled icon={ChevronLeft}>
              Anterior
            </Btn>
          )}
          {neighbors?.nextHref ? (
            <NavLink href={neighbors.nextHref} className={btnClass({ variant: "outline", size: "xs" })}>
              Următorul
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </NavLink>
          ) : (
            <Btn size="xs" variant="outline" disabled iconRight={ChevronRight}>
              Următorul
            </Btn>
          )}
        </div>
      </div>

      <Section title="Contact">
        {lead.phone || lead.email ? (
          <div className="grid grid-cols-2 gap-2">
            {lead.phone ? (
              <a
                href={telHref(lead.phone)}
                className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-mint/25 bg-mint/12 text-[13px] font-medium text-[#B4F2CD] transition-colors hover:bg-mint/20"
              >
                <Phone className="h-4 w-4" aria-hidden="true" /> Sună {lead.phone}
              </a>
            ) : null}
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={cn(contactLink, !lead.email && "col-span-2")}>
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> WhatsApp
              </a>
            ) : null}
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className={cn(contactLink, !whatsapp && "col-span-2")}>
                <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Scrie email
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">Clientul n-a lăsat nici telefon, nici email.</p>
        )}
        {lead.phone || lead.email ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {lead.email ? (
              <Pill tone="neutral" className="max-w-full font-mono text-[11px]">
                <span className="truncate">{lead.email}</span>
              </Pill>
            ) : null}
            {lead.phone ? (
              <Pill tone="neutral" className="font-mono text-[11px]">
                {lead.phone}
              </Pill>
            ) : null}
            {lead.phone ? (
              <button
                type="button"
                onClick={async () => {
                  await copyText(lead.phone ?? "");
                  notify("Numărul e în clipboard.");
                }}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" aria-hidden="true" /> copiază numărul
              </button>
            ) : null}
            {lead.email ? (
              <button
                type="button"
                onClick={async () => {
                  await copyText(lead.email ?? "");
                  notify("Emailul e în clipboard.");
                }}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" aria-hidden="true" /> copiază emailul
              </button>
            ) : null}
          </div>
        ) : null}
      </Section>

      <Section title="Cererea">
        <Row label="Divizie">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", DIVISION_DOT[lead.division])} aria-hidden="true" />
            {DIVISION_LABEL[lead.division]}
          </span>
        </Row>
        <Row label="Tip proiect">{lead.projectType ?? <Dash />}</Row>
        <Row label="Buget">{lead.budgetRange ?? <Dash />}</Row>
        <Row label="Termen dorit">{lead.timeline ?? <Dash />}</Row>
        <Row label="Fonduri">
          {lead.isFunded ? (
            <span className="inline-flex items-center gap-1 text-apricot">
              <Banknote className="h-3.5 w-3.5" aria-hidden="true" /> da, cere finanțare
            </span>
          ) : (
            "nu"
          )}
        </Row>
        {lead.message ? (
          <p className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-[12.5px] leading-relaxed text-foreground/85">{lead.message}</p>
        ) : (
          <p className="mt-3 text-[12px] text-muted-foreground">Clientul n-a scris niciun mesaj.</p>
        )}
      </Section>

      <Section title="Proveniența">
        <Row label="Sursă">
          <span className="font-mono text-[11px]">{lead.source}</span>
        </Row>
        <Row label="Limba site-ului">{lead.locale.toUpperCase()}</Row>
        <Row label="UTM">
          {lead.utm.source || lead.utm.medium || lead.utm.campaign ? (
            <span className="font-mono text-[11px]">
              {lead.utm.source ?? "—"} / {lead.utm.medium ?? "—"} / {lead.utm.campaign ?? "—"}
            </span>
          ) : (
            <span className="text-muted-foreground">fără parametri UTM</span>
          )}
        </Row>
        <Row label="Referrer">{lead.referrer ? <span className="break-all font-mono text-[11px]">{lead.referrer}</span> : <span className="text-muted-foreground">direct, fără referrer</span>}</Row>
        <Row label="Intrat">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" aria-hidden="true" />
            {dateTimeRo(lead.createdAt)}
          </span>
        </Row>
        {lead.updatedAt !== lead.createdAt ? <Row label="Ultima atingere">{touchedAgo(lead.updatedAt, now)}</Row> : null}
      </Section>

      <Section title="Status">
        <StatusControl leadId={lead.id} current={lead.status} />
      </Section>

      <Section title="Note interne">
        <NotesControl leadId={lead.id} notes={lead.notes} />
      </Section>

      <Section title="Istoric" className="pb-5">
        <LeadHistory entries={history} />
      </Section>

      <Section className="bg-white/[0.015]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[260px] text-[11px] leading-relaxed text-muted-foreground">
            Ștergerea nu poate fi anulată: notele și istoricul dispar odată cu lead-ul. Pentru spam sau teste. Un lead pierdut se marchează „Pierdut”, nu se șterge.
          </p>
          <div className="flex items-center gap-1.5">
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-mint/25 bg-mint/12 px-3 text-[12px] text-mint">
                <Megaphone className="h-3.5 w-3.5" aria-hidden="true" /> Continuă pe WhatsApp
              </a>
            ) : null}
            <DeleteButton onClick={() => setDeleteOpen(true)} />
          </div>
        </div>
        <DeleteControl
          leadId={lead.id}
          leadName={lead.name}
          leadMeta={`${lead.company ?? "Fără firmă"} · ${shortId(lead.id)}`}
          returnTo={listHref}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      </Section>
    </Card>
  );
}

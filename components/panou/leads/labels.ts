import type { Division } from "@/lib/division";
import type { Lead, LeadEvent } from "@/lib/supabase/types";
import { STATUS_LABELS } from "@/lib/supabase/types";
import type { LeadStatus } from "@/lib/validations/lead";
import type { PillTone } from "../ui/primitives";

/**
 * Vocabularul ecranului de lead-uri: etichetele din prototip (Nou, Contactat,
 * Calificat, Ofertă trimisă, Câștigat, Pierdut) puse pe statusurile reale din
 * bază (`new … lost`), tonurile lor și ajutoarele de contact.
 */

export const STATUS_ORDER: readonly LeadStatus[] = ["new", "contacted", "qualified", "proposal", "won", "lost"];

export const statusLabel = (status: LeadStatus): string => STATUS_LABELS[status];

/** `LEAD_TONE` din prototip. */
export const STATUS_TONE: Record<LeadStatus, PillTone> = {
  new: "lav",
  contacted: "sky",
  qualified: "apricot",
  proposal: "mint",
  won: "mint",
  lost: "neutral",
};

/** `STATUS_COLORS` din `LeadStats.jsx` (bara de distribuție). */
export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "#C6B5FF",
  contacted: "#8FD3FF",
  qualified: "#FFB27A",
  proposal: "#8FE3B0",
  won: "#5FCB8B",
  lost: "#3F3F4A",
};

export const DIVISION_LABEL: Record<Division, string> = { video: "Video", software: "Software" };

/** Punctul diviziei din prototip: Video lavandă, Software caisă. */
export const DIVISION_DOT: Record<Division, string> = { video: "bg-lav", software: "bg-apricot" };

/**
 * Numărul în formatul pe care îl cere wa.me: doar cifre, cu prefix de țară.
 * „07xx” e România, cazul de departe cel mai des pe formularele noastre; un „+40”
 * sau „0040” trece deja curat.
 */
export function whatsappDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `40${digits.slice(1)}`;
  return digits;
}

/** Primul mesaj pe WhatsApp: scurt, cu numele și divizia, ca omul să știe cine scrie. */
export function whatsappHref(lead: Pick<Lead, "name" | "phone" | "division">): string | null {
  if (!lead.phone) return null;
  const firstName = lead.name.trim().split(/\s+/)[0] ?? lead.name;
  const what = lead.division === "video" ? "proiectul video" : "proiectul de software";
  const text = `Bună, ${firstName}! Sunt de la MERIDIAN — am primit cererea ta de pe site pentru ${what}. Când ai 10 minute să vorbim?`;
  return `https://wa.me/${whatsappDigits(lead.phone)}?text=${encodeURIComponent(text)}`;
}

export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Id scurt pentru ochi (uuid-ul întreg rămâne în link și în `title`). */
export const shortId = (id: string): string => id.slice(0, 8);

/** „Neatins de 6 zile” spune mai mult decât o dată calendaristică: panoul e o coadă de lucru. */
export function touchedAgo(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "azi";
  if (days === 1) return "ieri";
  return `acum ${days} zile`;
}

export type MailOutcome = "sent" | "skipped" | "failed";

const MAIL_OUTCOME_LABEL: Record<MailOutcome, string> = { sent: "trimisă", skipped: "nu s-a trimis", failed: "a eșuat" };
const MAIL_OUTCOME_TONE: Record<MailOutcome, PillTone> = { sent: "mint", skipped: "neutral", failed: "rose" };

function isOutcome(value: unknown): value is MailOutcome {
  return value === "sent" || value === "skipped" || value === "failed";
}

export interface HistoryEntry {
  id: string;
  at: string;
  what: string;
  who: string;
  /** Emailurile trimise: câte o pastilă pe fiecare mesaj (notificare, confirmare). */
  mails?: { label: string; outcome: string; tone: PillTone }[];
  /** Rând secundar, mic (ex. „Nou → Contactat”). */
  detail?: string;
  /** Punct roșu: ceva n-a mers (email eșuat). */
  alert?: boolean;
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

const statusName = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) return null;
  return raw in STATUS_LABELS ? STATUS_LABELS[raw as LeadStatus] : raw;
};

/**
 * Evenimentul din bază, în forma pe care o desenează istoricul din prototip:
 * ce s-a întâmplat, cine și când. Nu vărsăm JSON brut în interfață.
 */
export function describeEvent(event: LeadEvent): HistoryEntry {
  const payload = event.payload ?? {};
  const actor = text(payload.actor);
  const base = { id: event.id, at: event.createdAt };

  switch (event.type) {
    case "created": {
      const source = text(payload.source);
      return { ...base, what: "Lead creat din formular", who: "Formular site", detail: source ? `formular: ${source}` : undefined };
    }
    case "status_changed": {
      const from = statusName(payload.from);
      const to = statusName(payload.to);
      return {
        ...base,
        what: to ? `Status schimbat în „${to}”` : "Status schimbat",
        who: actor ?? "Panou",
        detail: from && to ? `${from} → ${to}` : undefined,
      };
    }
    case "note_added": {
      const length = typeof payload.length === "number" ? payload.length : null;
      return {
        ...base,
        what: "Notițe interne actualizate",
        who: actor ?? "Panou",
        detail: length !== null ? `${length.toLocaleString("ro-RO")} caractere` : undefined,
      };
    }
    case "email_sent": {
      const notification = isOutcome(payload.notification) ? payload.notification : null;
      const confirmation = isOutcome(payload.confirmation) ? payload.confirmation : null;
      const mails: NonNullable<HistoryEntry["mails"]> = [];
      if (notification) mails.push({ label: "notificare către tine", outcome: MAIL_OUTCOME_LABEL[notification], tone: MAIL_OUTCOME_TONE[notification] });
      if (confirmation) mails.push({ label: "confirmare către client", outcome: MAIL_OUTCOME_LABEL[confirmation], tone: MAIL_OUTCOME_TONE[confirmation] });
      return {
        ...base,
        what: "Emailuri trimise",
        who: "Sistem",
        mails,
        alert: notification === "failed" || confirmation === "failed",
      };
    }
    case "brief_step": {
      const step = payload.step;
      return { ...base, what: "Pas de brief completat", who: "Client", detail: step !== undefined ? `pasul ${String(step)}` : undefined };
    }
    case "estimator_used":
      return { ...base, what: "Estimator folosit", who: "Client" };
    case "download":
      return { ...base, what: "Descărcare", who: "Client" };
    case "call_booked":
      return { ...base, what: "Call programat", who: "Client" };
    case "questionnaire_answers":
      return { ...base, what: "Chestionar completat", who: "Client" };
    case "duplicate_suppressed":
      return {
        ...base,
        what: "Cerere identică ignorată",
        who: "Sistem",
        detail: "aceeași trimitere, în câteva minute: nu s-a creat un al doilea lead",
      };
    default: {
      const keys = Object.keys(payload);
      return { ...base, what: event.type, who: "Sistem", detail: keys.length > 0 ? keys.join(", ") : undefined };
    }
  }
}

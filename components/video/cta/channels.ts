import type { VideoSegment } from "@/content/types";
import { SEGMENT_LABELS } from "@/components/video/segments";

/**
 * Canalele de contact ale diviziei VIDEO (FAZA 3) — sursă unică.
 *
 * Clientul de video decide rapid și preferă vocea (CLAUDE.md §8): vocea
 * și WhatsApp-ul au aceeași greutate vizuală ca formularul, nu stau sub
 * „alte metode de contact”.
 *
 * Datele de contact vin EXCLUSIV din env (`NEXT_PUBLIC_*`). Dacă un
 * canal nu e configurat, componenta îl ascunde — nu inventăm numere de
 * telefon și nu lăsăm href="#" în producție.
 */

/** Contextul din care pleacă mesajul — schimbă textul pre-completat. */
export type ContactContext =
  | "reclame"
  | "audit"
  | "contact"
  | "portofoliu"
  | "segment";

// i18n: mesaje RO hardcodate — F7 le mută în messages/*.json
const WHATSAPP_MESSAGES: Record<Exclude<ContactContext, "segment">, string> = {
  reclame:
    "Salut! Vin de pe pagina de reclame. Rulăm campanii și vrem și producția creativelor în aceeași echipă.",
  audit:
    "Salut! Vreau auditul de campanii. Rulez reclame acum și vreau să știu unde pierd bani.",
  contact: "Salut! Vreau o ofertă pentru un proiect video.",
  portofoliu:
    "Salut! Am văzut portofoliul și vreau ceva în direcția asta pentru firma mea.",
};

/** Mesaj contextual pentru un segment anume (imobiliare, corporate…). */
export function segmentMessage(segment: VideoSegment): string {
  // i18n:
  return `Salut! Vreau un film pentru ${SEGMENT_LABELS[segment].toLowerCase()}. Când putem vorbi?`;
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Numărul de telefon, așa cum e scris în env (pentru afișare). */
export function phoneDisplay(): string | null {
  return process.env.NEXT_PUBLIC_PHONE || null;
}

/** `tel:` — null dacă numărul nu e configurat. */
export function phoneHref(): string | null {
  const phone = process.env.NEXT_PUBLIC_PHONE;
  return phone ? `tel:+${digits(phone)}` : null;
}

/** Link wa.me cu mesaj pre-completat contextual. */
export function whatsappHref(
  context: ContactContext,
  customMessage?: string
): string | null {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!number) return null;
  const text =
    customMessage ??
    (context === "segment"
      ? WHATSAPP_MESSAGES.contact
      : WHATSAPP_MESSAGES[context]);
  return `https://wa.me/${digits(number)}?text=${encodeURIComponent(text)}`;
}

/** Profilul de Instagram (DM-ul e la un tap distanță de profil). */
export function instagramHref(): string | null {
  const handle = process.env.NEXT_PUBLIC_INSTAGRAM;
  if (!handle) return null;
  return handle.startsWith("http")
    ? handle
    : `https://instagram.com/${handle.replace(/^@/, "")}`;
}

/** Pagina publică Cal.com pentru divizia video. */
export function calHref(): string | null {
  const slug = process.env.NEXT_PUBLIC_CAL_VIDEO;
  if (!slug) return null;
  return slug.startsWith("http") ? slug : `https://cal.com/${slug}`;
}

/** Aceeași pagină, în varianta de embed (iframe, fără dependențe noi). */
export function calEmbedSrc(): string | null {
  const base = calHref();
  if (!base) return null;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}embed=true&theme=dark`;
}

/** True dacă măcar un canal „de voce” e configurat. */
export function hasVoiceChannel(): boolean {
  return Boolean(phoneHref() || whatsappHref("contact"));
}

/**
 * Vocabularul vizual al ecranelor de reclame din panoul nou: aceleași clase ca
 * în prototip (Base44), sub numele pe care le folosea codul vechi (`tone.ts`),
 * ca editoarele portate să-și păstreze importurile.
 *
 *   roz      — blochează crearea (eroare)
 *   caisă    — nu blochează, dar se citește (avertisment) și banii clienților
 *   mentă    — gata de creat
 */

/** Câmpurile de formular, ca `inputClass` din kit (înălțimea o dă cine îl folosește). */
export const FIELD =
  "block w-full rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-lav/50 focus:bg-white/[0.05] disabled:opacity-50";

export const FIELD_INVALID = "!border-rose/60 bg-rose/[0.06]";

export const ERROR_TEXT = "text-rose";
export const WARNING_TEXT = "text-apricot";
export const OK_TEXT = "text-mint";

export const ERROR_DOT = "bg-rose";
export const WARNING_DOT = "bg-apricot";
export const OK_DOT = "bg-mint";

/** Eticheta mică de deasupra unui câmp (ca `Field` din kit). */
export const LABEL = "block text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground";

/** Eticheta de secțiune: majuscule mici, deasupra unui bloc. */
export const EYEBROW = "text-[11px] uppercase tracking-[0.14em] text-muted-foreground";

/** Rândurile de eroare / avertisment / ok din verificări, ca în prototip (`NewPlanPage`). */
export const ROW_ERROR = "flex items-start gap-2 rounded-xl border border-rose/25 bg-rose/[0.07] px-3 py-2 text-[12px] leading-relaxed text-[#FFC2CE]";
export const ROW_WARNING = "flex items-start gap-2 rounded-xl border border-apricot/25 bg-apricot/[0.07] px-3 py-2 text-[12px] leading-relaxed text-[#FFD0AC]";
export const ROW_OK = "flex items-start gap-2 rounded-xl border border-mint/25 bg-mint/[0.07] px-3 py-2 text-[12px] leading-relaxed text-[#B4F2CD]";

/** Titlul unei pagini, ca în prototip: `h1` de 22/26px, subtitlu de 12.5px. */
export const PAGE_TITLE = "text-[22px] font-semibold leading-none sm:text-[26px]";
export const PAGE_LEAD = "mt-2 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground";

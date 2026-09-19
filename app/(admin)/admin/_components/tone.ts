import type { LeadStatus } from "@/lib/validations/lead";

/**
 * Vocabularul vizual al panoului — un singur loc, ca tabelul, panoul și
 * indicatorii să spună același lucru cu aceleași mijloace.
 *
 * Paleta porții e monocromă intenționat, deci diferența dintre statusuri
 * o face lumina: „Nou” e singurul plin și luminos, fiindcă e singurul
 * care cere o acțiune azi. Statusurile intermediare cresc în contur pe
 * măsură ce lead-ul avansează; „Pierdut” se stinge.
 *
 * Două culori semantice, nu de lume: verde pentru bani intrați,
 * chihlimbar pentru fonduri — cele mai valoroase lead-uri (brief).
 */
export const STATUS_TONE: Record<LeadStatus, string> = {
  new: "border-bone bg-bone text-ink",
  contacted: "border-hair-strong text-bone/75",
  qualified: "border-bone/40 text-bone/90",
  proposal: "border-bone/60 bg-bone/10 text-bone",
  won: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300",
  lost: "border-hair text-dim",
};

export const FUNDED_TONE =
  "border-[#f0c060]/45 bg-[#f0c060]/10 text-[#f0c060]";

/** Pilulă de status — aceeași formă în tabel și în panou. */
export const STATUS_PILL =
  "inline-flex items-center rounded-full border px-2.5 py-1 font-md-mono text-[10.5px] uppercase leading-none tracking-[0.14em]";

/** Câmpurile de formular din panou: aceleași în filtre, login și note. */
export const FIELD =
  "block w-full rounded-panel-sm border border-hair bg-ink/60 px-3.5 text-[14px] text-bone placeholder:text-dim transition-colors duration-150 focus:border-hair-strong";

import type { Division } from "@/lib/division";
import type { LeadStatus } from "@/lib/validations/lead";

/**
 * Vocabularul vizual al panoului — un singur loc, ca tabelul, panoul și
 * indicatorii să spună același lucru cu aceleași mijloace.
 *
 * Culoarea codifică divizia: albastrul royal al lumii video și verdele
 * lumii software, exact nuanțele de pe site (`[data-scope]` din
 * globals.css). Un lead „se vede” din ce lume vine înainte să-i citești
 * rândul — iar când sună telefonul, știi cu ce voce răspunzi.
 *
 * Statusurile spun altceva: cât de departe a ajuns lead-ul. „Nou” e
 * singurul plin și luminos, fiindcă e singurul care cere o acțiune azi;
 * verde pentru bani intrați, roșu stins pentru pierdut. Chihlimbarul e
 * rezervat fondurilor — cele mai valoroase lead-uri (brief).
 */

export const DIVISION_LABEL: Record<Division, string> = {
  video: "Video",
  software: "Software",
};

export const DIVISION_TONE: Record<
  Division,
  { text: string; badge: string; bar: string; glow: string; hex: string }
> = {
  video: {
    hex: "#4c74ff",
    text: "text-[#8fa8ff]",
    badge: "border-[#4c74ff]/50 bg-[#4c74ff]/15 text-[#a4b8ff]",
    bar: "bg-[#4c74ff]",
    glow: "border-l-[3px] !border-l-[#4c74ff]",
  },
  software: {
    hex: "#2fa37e",
    text: "text-[#4fcaa0]",
    badge: "border-[#2fa37e]/50 bg-[#2fa37e]/14 text-[#6ad9b3]",
    bar: "bg-[#2fa37e]",
    glow: "border-l-[3px] !border-l-[#2fa37e]",
  },
};

export const STATUS_TONE: Record<LeadStatus, string> = {
  new: "border-bone bg-bone text-ink",
  contacted: "border-hair-strong text-bone/75",
  qualified: "border-[#f0c060]/40 text-[#f0c060]/90",
  proposal: "border-[#f0c060]/60 bg-[#f0c060]/10 text-[#f0c060]",
  won: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300",
  lost: "border-[#ff6b6b]/25 text-[#ff8a8a]/70",
};

export const FUNDED_TONE =
  "border-[#f0c060]/45 bg-[#f0c060]/10 text-[#f0c060]";

/** Pilulă de status — aceeași formă în tabel și în panou. */
export const STATUS_PILL =
  "inline-flex items-center rounded-full border px-2.5 py-1 font-md-mono text-[10.5px] uppercase leading-none tracking-[0.14em]";

/** Câmpurile de formular din panou: aceleași în filtre, login și note. */
export const FIELD =
  "block w-full rounded-panel-sm border border-hair bg-ink/60 px-3.5 text-[14px] text-bone placeholder:text-dim transition-colors duration-150 focus:border-hair-strong";

/** Verdele WhatsApp — culoarea aplicației, nu a vreunei lumi. */
export const WHATSAPP_TONE =
  "!border-[#25d366]/50 !bg-[#25d366]/12 !text-[#5ee39a] hover:!bg-[#25d366]/20";

import type { Division } from "@/lib/division";
import type { LeadStatus } from "@/lib/validations/lead";

/**
 * Vocabularul vizual al panoului — un singur loc, ca tabelul, fișa și
 * indicatorii să spună același lucru cu aceleași mijloace.
 *
 * Culoarea codifică divizia: albastrul royal al lumii video și verdele
 * lumii software, exact nuanțele de pe site (`[data-scope]` din
 * globals.css). Etichetele sunt PLINE, nu contururi: într-o listă de
 * cincizeci de rânduri, o pată de culoare se vede de la un metru, un
 * contur nu.
 *
 * Statusurile spun altceva: cât de departe a ajuns lead-ul. Fiecare are
 * o culoare plină, cu text închis peste ea — „Nou” e alb, singurul care
 * cere o acțiune azi; verde pentru bani intrați, roșu pentru pierdut.
 * Chihlimbarul e rezervat fondurilor — cele mai valoroase lead-uri.
 */

export const DIVISION_LABEL: Record<Division, string> = {
  video: "Video",
  software: "Software",
};

export const DIVISION_TONE: Record<
  Division,
  {
    hex: string;
    text: string;
    /** Eticheta plină. */
    badge: string;
    /** Muchia rândului / a fișei. */
    bar: string;
    /** Fundalul rândului selectat. */
    tint: string;
    /** Accentul din stânga al mesajului. */
    glow: string;
  }
> = {
  video: {
    hex: "#2f5bff",
    text: "text-[#8fa8ff]",
    badge: "bg-[#2f5bff] text-white",
    bar: "bg-[#2f5bff]",
    tint: "bg-[#2f5bff]/12",
    glow: "border-l-[3px] !border-l-[#2f5bff]",
  },
  software: {
    hex: "#1fb583",
    text: "text-[#4fd6a5]",
    badge: "bg-[#1fb583] text-[#03291b]",
    bar: "bg-[#1fb583]",
    tint: "bg-[#1fb583]/12",
    glow: "border-l-[3px] !border-l-[#1fb583]",
  },
};

export const STATUS_TONE: Record<LeadStatus, string> = {
  new: "bg-bone text-ink",
  contacted: "bg-[#5b7cff]/90 text-white",
  qualified: "bg-[#f0b429] text-[#2a1a00]",
  proposal: "bg-[#a06bff] text-white",
  won: "bg-[#22c55e] text-[#052e16]",
  lost: "bg-[#ef4444]/85 text-white",
};

export const FUNDED_TONE = "bg-[#f0b429] text-[#2a1a00]";

/** Etichetă plină — divizie, fonduri, status. Aceeași formă peste tot. */
export const CHIP =
  "inline-flex items-center rounded-full px-3 py-1 font-md-body text-[12.5px] font-semibold normal-case leading-[1.15] tracking-[0.01em]";

/** Pilulă de status — aceeași formă în tabel și în fișă. */
export const STATUS_PILL = CHIP;

/** Câmpurile de formular din panou: aceleași în filtre, login și note. */
export const FIELD =
  "block w-full rounded-panel-sm border border-hair bg-ink/60 px-3.5 text-[15px] text-bone placeholder:text-dim transition-colors duration-150 focus:border-hair-strong";

/** Verdele WhatsApp — culoarea aplicației, nu a vreunei lumi. Plin. */
export const WHATSAPP_TONE =
  "!bg-[#25d366] !text-[#052e16] hover:!bg-[#3ee07c] !shadow-[0_12px_30px_-12px_rgb(37_211_102/0.7)]";

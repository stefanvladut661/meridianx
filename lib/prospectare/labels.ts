import type { Canal, Etapa, Rezultat, Utilizator } from "./types";

/**
 * Etichetele și culorile din prototip (lib/prospect.js), traduse pe tema
 * închisă a adminului: fiecare etapă are aceeași nuanță ca în prototip,
 * dar ca text deschis pe fundal transparent, nu ca fundal pastel pe alb.
 */

interface EtapaMeta {
  label: string;
  /** Pastila: bordură, fundal și text. */
  badge: string;
  /** Bara din stânga rândului din tabel. */
  bara: string;
  /** Punctul din pastilă și din pâlnie. */
  punct: string;
  /** Culoarea plină (pâlnia de pe Prezentare). */
  culoare: string;
}

export const ETAPE: Record<Etapa, EtapaMeta> = {
  cercetat: { label: "Cercetat", badge: "border-white/[0.12] bg-white/[0.05] text-foreground/70", bara: "border-l-[#A1A1AA]/60", punct: "bg-[#A1A1AA]", culoare: "#A1A1AA" },
  site_in_lucru: { label: "Site în lucru", badge: "border-[#F5C26B]/30 bg-[#F5C26B]/10 text-[#F7D59A]", bara: "border-l-[#F5C26B]", punct: "bg-[#F5C26B]", culoare: "#F5C26B" },
  site_gata: { label: "Site gata", badge: "border-[#B5E06B]/30 bg-[#B5E06B]/10 text-[#CDEB98]", bara: "border-l-[#B5E06B]", punct: "bg-[#B5E06B]", culoare: "#B5E06B" },
  email_trimis: { label: "Email trimis", badge: "border-mint/30 bg-mint/10 text-[#A7EFC3]", bara: "border-l-mint", punct: "bg-mint", culoare: "#8FE3B0" },
  whatsapp_trimis: { label: "WhatsApp trimis", badge: "border-lav/30 bg-lav/10 text-[#D8CCFF]", bara: "border-l-lav", punct: "bg-lav", culoare: "#C6B5FF" },
  sunat: { label: "Sunat", badge: "border-sky/30 bg-sky/10 text-[#AEE3FF]", bara: "border-l-sky", punct: "bg-sky", culoare: "#8FD3FF" },
  interesat: { label: "Interesat", badge: "border-apricot/30 bg-apricot/10 text-[#FFC79C]", bara: "border-l-apricot", punct: "bg-apricot", culoare: "#FFB27A" },
  client: { label: "Client", badge: "border-[#5FD38D]/45 bg-[#5FD38D]/15 text-[#9BEBB9]", bara: "border-l-[#5FD38D]", punct: "bg-[#5FD38D]", culoare: "#5FD38D" },
  nu_contacta: { label: "Nu contacta", badge: "border-rose/30 bg-rose/10 text-[#FFB0C0]", bara: "border-l-rose", punct: "bg-rose", culoare: "#FF8FA8" },
  respins: { label: "Respins", badge: "border-white/[0.16] bg-white/[0.08] text-foreground/60", bara: "border-l-[#71717A]", punct: "bg-[#71717A]", culoare: "#71717A" },
};

export const CANALE: Record<Canal, { label: string; badge: string }> = {
  email: { label: "Email", badge: "border-mint/25 bg-transparent text-[#A7EFC3]" },
  whatsapp: { label: "WhatsApp", badge: "border-lav/25 bg-transparent text-[#D8CCFF]" },
  telefon: { label: "Telefon", badge: "border-sky/25 bg-transparent text-[#AEE3FF]" },
};

export const REZULTATE: Record<Rezultat, { label: string; badge: string }> = {
  nu_raspunde: { label: "Nu răspunde", badge: "border-white/[0.12] bg-white/[0.05] text-foreground/70" },
  interesat: { label: "Interesat", badge: "border-apricot/30 bg-apricot/10 text-[#FFC79C]" },
  nu_vrea: { label: "Nu vrea", badge: "border-rose/30 bg-rose/10 text-[#FFB0C0]" },
  suna_inapoi: { label: "Sună înapoi", badge: "border-sky/30 bg-sky/10 text-[#AEE3FF]" },
  numar_gresit: { label: "Număr greșit", badge: "border-rose/40 bg-rose/15 text-[#FFB0C0]" },
  trimis: { label: "Trimis", badge: "border-lav/30 bg-lav/10 text-[#D8CCFF]" },
};

export const UTILIZATORI: Record<Utilizator, string> = { stefan: "Ștefan", vladut: "Vlăduț" };

export const ETAPE_ORDINE: Etapa[] = [
  "cercetat",
  "site_in_lucru",
  "site_gata",
  "email_trimis",
  "whatsapp_trimis",
  "sunat",
  "interesat",
  "client",
  "nu_contacta",
  "respins",
];

export function isEtapa(value: unknown): value is Etapa {
  return typeof value === "string" && value in ETAPE;
}

export function isCanal(value: unknown): value is Canal {
  return typeof value === "string" && value in CANALE;
}

export function isUtilizator(value: unknown): value is Utilizator {
  return value === "stefan" || value === "vladut";
}

/** Cookie-ul comutatorului Ștefan / Vlăduț: fiecare vede lista lui. */
export const COOKIE_UTILIZATOR = "prospectare_utilizator";

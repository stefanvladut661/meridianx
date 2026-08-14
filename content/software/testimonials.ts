import type { Testimonial } from "@/content/types";

/**
 * FAZA 4 — TOATE placeholder (CLAUDE.md §5).
 * Nu există încă testimoniale reale. `author` e o funcție, nu un nume
 * inventat, iar `company` e un descriptor de firmă. Nimic din ce scrie
 * aici nu e atribuit unei persoane reale.
 *
 * La înlocuire: nume real + acord scris de la client (vezi PLAN.md,
 * lista de verificat înainte de lansare).
 */
export const softwareTestimonials: Testimonial[] = [
  {
    id: "t-productie",
    division: "software",
    isPlaceholder: true,
    quote:
      "Am primit specificația înainte să plătim ceva și am înțeles-o fără să ne explice cineva. Asta a fost momentul în care ne-am hotărât.",
    author: "Director de producție",
    role: "Director de producție",
    company: "Producător de componente CNC",
    projectId: "planificare-productie-cnc",
  },
  {
    id: "t-administrativ",
    division: "software",
    isPlaceholder: true,
    quote:
      "Ne-au spus de la început ce nu intră în proiect. La final nu a apărut nicio linie în plus pe factură.",
    author: "Administrator",
    role: "Administrator",
    company: "Distribuitor de piese industriale",
    projectId: "magazin-piese-schimb",
  },
  {
    id: "t-it",
    division: "software",
    isPlaceholder: true,
    quote:
      "Codul a fost în repository-ul nostru din prima săptămână. Nu am avut niciodată senzația că suntem prinși în capcană.",
    author: "Responsabil IT",
    role: "Responsabil IT",
    company: "Firmă de distribuție alimentară",
    projectId: "automatizare-facturi",
  },
];

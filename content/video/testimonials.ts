import type { Testimonial } from "@/content/types";

/**
 * Testimoniale VIDEO — INTEGRAL PLACEHOLDER (FAZA 2).
 * Citate nescrise de clienți reali; se înlocuiesc cu testimoniale
 * cu acord scris (vezi PLAN.md → „De verificat înainte de lansare”).
 */
export const videoTestimonials: Testimonial[] = [
  {
    id: "testimonial-imobiliare",
    division: "video",
    isPlaceholder: true,
    quote:
      "Citat placeholder — aici va sta feedbackul real al unui client din imobiliare, cu acordul lui scris. Nu inventăm laude.",
    author: "Nume Prenume",
    role: "Director de vânzări",
    company: "Dezvoltator imobiliar (fictiv)",
    projectId: "imobiliare-01",
  },
  {
    id: "testimonial-corporate",
    division: "video",
    isPlaceholder: true,
    quote:
      "Citat placeholder — feedbackul unui client corporate despre proces și livrare va apărea aici, nu un text scris de noi în numele lui.",
    author: "Nume Prenume",
    role: "Marketing Manager",
    company: "Companie de servicii (fictivă)",
    projectId: "corporate-01",
  },
  {
    id: "testimonial-industrial",
    division: "video",
    isPlaceholder: true,
    quote:
      "Citat placeholder — vocea unui client industrial despre filmul lui de capabilități. Se completează după primul proiect real din segment.",
    author: "Nume Prenume",
    role: "Administrator",
    company: "Atelier CNC (fictiv)",
    projectId: "industrial-01",
  },
];

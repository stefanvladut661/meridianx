/**
 * Contractul de conținut (FAZA 0, ÎNGHEȚAT).
 * Tot conținutul editorial stă în fișiere TS tipate sub content/,
 * structurat ca migrarea spre un CMS să fie trivială: fiecare tip are
 * `id` stabil și `isPlaceholder` obligatoriu.
 *
 * REGULĂ (CLAUDE.md §5): orice item care nu e conținut real, verificat,
 * are `isPlaceholder: true`. Nu inventa clienți, cifre sau citate reale.
 */

import type { Division } from "@/lib/division";

export type { Division };

/** Segmentele de public ale diviziei video. */
export type VideoSegment =
  | "imobiliare"
  | "corporate"
  | "evenimente"
  | "personal-brand"
  | "industrial";

interface ContentBase {
  /** Slug stabil, unic în cadrul tipului — devine cheie de CMS la migrare. */
  id: string;
  division: Division;
  isPlaceholder: boolean;
}

export interface Service extends ContentBase {
  title: string;
  /** Promisiunea către client — ce obține, nu ce echipament/stack folosim. */
  promise: string;
  description: string;
  /** Ce primește concret la final (formate, durate, drepturi, livrabile). */
  deliverables: string[];
  /** Pentru cine e serviciul. */
  audience?: string;
  /** Durată orientativă, text liber („3–6 săptămâni"). */
  duration?: string;
  /** Tehnologii (software) sau echipament relevant pentru client (video). */
  stack?: string[];
}

export interface Project extends ContentBase {
  title: string;
  client: string;
  segment?: VideoSegment;
  /** Studiu de caz: context → provocare → soluție → rezultat. */
  context: string;
  challenge?: string;
  solution: string;
  /** Rezultat măsurabil. La placeholder-e: formulare generică, fără cifre „reale". */
  result: string;
  /** Metrici afișabile — locuri clare pentru cifre reale la înlocuire. */
  metrics?: Array<{ label: string; value: string }>;
  /** Media locală: video cu poster OBLIGATORIU, sau imagine. */
  media: {
    kind: "video" | "image";
    src: string;
    /** Obligatoriu pentru video (quality floor §7). Alt real, nu „image". */
    poster?: string;
    alt: string;
  };
  year?: number;
}

export interface Testimonial extends ContentBase {
  quote: string;
  author: string;
  role: string;
  company: string;
  projectId?: Project["id"];
}

export interface ProcessStep extends ContentBase {
  /** Ordinea reală în secvență — aici numerotarea 01/02 e legitimă. */
  order: number;
  title: string;
  description: string;
  /** Ce facem noi în etapa asta. */
  weDo: string[];
  /** Ce se cere de la client — detaliul care liniștește un IMM. */
  youDo: string[];
  /** Durată orientativă. */
  duration?: string;
}

export interface FAQItem extends ContentBase {
  question: string;
  answer: string;
}

export interface TeamMember extends ContentBase {
  name: string;
  role: string;
  bio?: string;
  photo?: { src: string; alt: string };
}

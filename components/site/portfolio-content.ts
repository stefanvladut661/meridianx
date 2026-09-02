import manifest from "./portfolio-manifest.json";
import type { PortfolioVideo } from "./video-player";

/* ============================================================
   Portofoliul, citit din manifestul generat.

   `portfolio-manifest.json` e produs de `scripts/portfolio-build.mjs`
   din materialele brute și NU se editează de mână: ține dimensiunile și
   duratele reale ale fișierelor convertite. Dacă un titlu trebuie
   schimbat, se schimbă în catalogul din script și se rulează din nou —
   altfel pagina ar promite un material, iar playerul ar servi altul.

   Prefixul A din numele fișierelor sursă înseamnă „merge pe prima
   pagină". Ordinea A1…A6 e ordinea în care apar acolo.
   ============================================================ */

export type PortfolioPhoto = {
  slug: string;
  alt: string;
  client: string;
  widths: number[];
  w: number;
  h: number;
  base: string;
  /** Cand a intrat materialul in site (mtime-ul fisierului livrat). */
  published: string;
};

/**
 * Playerul primește doar ce îi trebuie ca să redea (`PortfolioVideo`).
 * Rangul editorial — al câtelea material de prima pagină e — e treaba
 * paginii, nu a playerului, deci stă aici, nu acolo.
 */
export type PortfolioItem = PortfolioVideo & {
  featured: number;
  /** Cand a intrat materialul in site (mtime-ul fisierului livrat). */
  published: string;
};

export const VIDEOS = manifest.videos as PortfolioItem[];
export const PHOTOS = manifest.photos as PortfolioPhoto[];

/** Materialele de prima pagină, în ordinea dată de prefixul A. */
export const FEATURED: PortfolioItem[] = VIDEOS.filter(
  (v) => v.featured > 0
).sort((a, b) => a.featured - b.featured);

export type ClientGroup = {
  client: string;
  kind: string;
  videos: PortfolioItem[];
  photos: PortfolioPhoto[];
};

/**
 * Grupare pe client, nu pe tip de material: cine se uită la un
 * portofoliu vrea să vadă ce am făcut PENTRU CINEVA, cap-coadă. Un
 * restaurant cu două filmări și nouă fotografii spune mai mult despre
 * cum lucrăm decât aceleași materiale împrăștiate în două galerii.
 *
 * Ordinea clienților o dă cel mai bine cotat material al fiecăruia:
 * cine are un A1 stă înaintea cui n-are niciun A.
 */
export function groupByClient(): ClientGroup[] {
  const map = new Map<string, ClientGroup>();

  for (const v of VIDEOS) {
    const g = map.get(v.client) ?? {
      client: v.client,
      kind: v.kind,
      videos: [],
      photos: [],
    };
    g.videos.push(v);
    map.set(v.client, g);
  }

  for (const p of PHOTOS) {
    const g = map.get(p.client) ?? {
      client: p.client,
      kind: "Fotografie",
      videos: [],
      photos: [],
    };
    g.photos.push(p);
    map.set(p.client, g);
  }

  /* Ordinea: cine are cel mai mult de arătat stă primul, iar clienții cu
     un singur material cad la coadă de la sine. Trattoria BonaMi rămâne
     capul de afiș indiferent de socoteală — e materialul cu care se
     deschide și divizia. La egalitate decide rangul editorial (A1…A6),
     apoi alfabetic, ca ordinea să nu sară de la un build la altul. */
  const FIRST = "Trattoria BonaMi";
  const size = (g: ClientGroup) => g.videos.length + g.photos.length;
  const rank = (g: ClientGroup) => {
    const marked = g.videos.filter((v) => v.featured > 0).map((v) => v.featured);
    return marked.length ? Math.min(...marked) : 99;
  };

  return [...map.values()].sort((a, b) => {
    if (a.client === FIRST) return -1;
    if (b.client === FIRST) return 1;
    return (
      size(b) - size(a) ||
      rank(a) - rank(b) ||
      a.client.localeCompare(b.client, "ro")
    );
  });
}

/** `srcset` pentru o fotografie, din lățimile chiar generate. */
export function photoSrcSet(p: PortfolioPhoto): string {
  return p.widths.map((w) => `${p.base}-${w}.webp ${w}w`).join(", ");
}

export function photoSrc(p: PortfolioPhoto): string {
  return `${p.base}-${p.widths[p.widths.length - 1]}.webp`;
}

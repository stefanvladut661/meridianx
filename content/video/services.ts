import type { Service } from "@/content/types";

/**
 * Serviciile diviziei VIDEO (FAZA 2).
 * Copy de brand scris complet în RO — NU e placeholder (CLAUDE.md §5).
 * Fiecare serviciu e explicat prin ce obține clientul, nu prin echipament;
 * livrabilele concrete (formate, durate, drepturi) calmează clientul corporate.
 */
export const videoServices: Service[] = [
  {
    id: "filmare-comerciala",
    division: "video",
    isPlaceholder: false,
    title: "Filmare comercială",
    promise: "Filmul care îți vinde produsul înainte să apuci tu să-l explici.",
    description:
      "De la concept la master: scriem povestea, construim platoul, reglăm lumina la temperatura la care cumpără clientul tău și regizăm fiecare cadru cu un singur scop — să vândă. Nu venim „să tragem niște cadre”. Venim cu un plan de vânzare pe imagine, iar tu primești livrabile fixe la preț fix.",
    audience:
      "Imobiliare, corporate, evenimente, personal brand, producție industrială.",
    duration: "2–4 săptămâni de la brief la master.",
    deliverables: [
      "Film principal 60–90 s, master 4K",
      "Cutdown-uri de 30 s și 15 s pentru campanii",
      "Formate 16:9, 9:16 și 1:1 — cadrate la filmare, nu crop-uri oarbe",
      "Subtitrări RO/EN incluse",
      "Drepturi de utilizare comercială nelimitate: site, social, paid media",
      "Două runde de revizii incluse în preț",
    ],
    stack: [
      "Cameră cinema 4K 10-bit",
      "Iluminare tungsten + daylight",
      "Sunet captat pe platou",
    ],
  },
  {
    id: "editare-post",
    division: "video",
    isPlaceholder: false,
    title: "Editare & post-producție",
    promise:
      "Materialul tău brut, întors ca un film pe care chiar îl urmărești până la capăt.",
    description:
      "Ai deja material — filmat intern, la evenimente, din arhivă? Îl tăiem de tot ce plictisește și îl remontăm pe ritmul care ține degetul departe de scroll. Color grading de cinema, sound design, subtitrări: aceeași disciplină ca la filmările noastre, aplicată pe cadrele tale.",
    audience:
      "Companii cu material filmat intern, organizatori de evenimente, agenții care externalizează postul.",
    duration: "5–10 zile lucrătoare per livrabil.",
    deliverables: [
      "Master editat + versiuni pentru fiecare canal social",
      "Color grading cinematografic (DaVinci Resolve)",
      "Mix audio și muzică licențiată pentru difuzare comercială",
      "Subtitrări și grafice de titlu în limba campaniei",
      "Proiect arhivat 12 luni — revii oricând pentru versiuni noi",
      "Două runde de revizii incluse",
    ],
  },
  {
    id: "ugc-social",
    division: "video",
    isPlaceholder: false,
    title: "Conținut UGC & social",
    promise: "Clipuri care arată a om, nu a reclamă — și exact de-asta vând.",
    description:
      "Algoritmul pedepsește reclamele care arată a reclame. Scriem hook-uri, lucrăm cu creatori potriviți pe produsul tău și livrăm lunar un calendar întreg de clipuri native pentru Reels, TikTok și Shorts — cu drepturi de difuzare paid incluse, ca să le poți băga direct în campanii.",
    audience:
      "Branduri cu produs de volum, eCommerce, servicii care vând pe social.",
    duration: "Abonament lunar; primul batch în 10 zile lucrătoare.",
    deliverables: [
      "8–16 clipuri pe lună, 15–45 s fiecare",
      "Script + hook testabil pentru fiecare clip",
      "Format nativ 9:16 pentru Reels, TikTok, Shorts",
      "Drepturi de difuzare paid (whitelisting) incluse",
      "Raport lunar: ce a mers, ce oprim, ce scalăm",
    ],
  },
  {
    id: "drona",
    division: "video",
    isPlaceholder: false,
    title: "Filmări aeriene / dronă",
    promise: "Perspectiva pe care clientul tău n-o poate vedea de pe trotuar.",
    description:
      "Un ansamblu rezidențial se vinde din aer. O hală de producție impresionează din aer. Zburăm legal, cu autorizările și asigurarea la zi — actele sunt treaba noastră, nu a ta — și integrăm cadrele aeriene în filmul principal sau le livrăm ca pachet separat.",
    audience: "Imobiliare și dezvoltatori, industrial, evenimente în aer liber.",
    duration: "1 zi de filmare; livrare în 5 zile lucrătoare.",
    deliverables: [
      "Cadre aeriene 4K stabilizate",
      "Fotografii aeriene la rezoluție de print",
      "Zbor autorizat și asigurat — documentația e inclusă",
      "Integrare în filmul principal sau livrare ca pachet separat",
      "Drepturi de utilizare comercială nelimitate",
    ],
  },
];

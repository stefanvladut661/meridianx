import type { ProcessStep } from "@/content/types";

/**
 * Procesul diviziei VIDEO — de la brief la livrare (FAZA 2).
 * Copy de brand, NU placeholder. Ordinea e o secvență reală, deci
 * numerotarea e legitimă; pe pagină se afișează ca marcaje de timecode.
 */
export const videoProcess: ProcessStep[] = [
  {
    id: "brief-oferta",
    division: "video",
    isPlaceholder: false,
    order: 1,
    title: "Brief & ofertă",
    description:
      "Un call de 30 de minute în care ne spui ce vinzi, cui și unde va rula filmul. Îți răspundem cu o direcție creativă scurtă și o ofertă cu livrabile fixe la preț fix — nu „de la”, nu „depinde”.",
    weDo: [
      "Punem întrebările incomode despre cine cumpără de la tine",
      "Propunem direcția creativă și temperatura potrivită poveștii",
      "Trimitem oferta cu livrabile, termene și preț — toate fixe",
    ],
    youDo: [
      "30 de minute la telefon sau pe video call",
      "Ce vinzi, cui vinzi, unde va rula materialul",
    ],
    duration: "2–3 zile",
  },
  {
    id: "pre-productie",
    division: "video",
    isPlaceholder: false,
    order: 2,
    title: "Pre-producție",
    description:
      "Aici se câștigă filmarea. Scenariu sau shotlist cadru cu cadru, locații, oameni în cadru, program pe ore. În ziua filmării nu se improvizează — se execută.",
    weDo: [
      "Scriem scenariul / shotlist-ul, cadru cu cadru",
      "Rezolvăm locațiile, recuzita și oamenii din cadru",
      "Trimitem call sheet-ul: cine, unde, la ce oră",
    ],
    youDo: [
      "Aprobi scenariul — o singură rundă, clară",
      "Ne dai acces la locație și un om de contact",
    ],
    duration: "3–7 zile",
  },
  {
    id: "filmare",
    division: "video",
    isPlaceholder: false,
    order: 3,
    title: "Filmarea",
    description:
      "Echipa vine cu tot: cameră, lumini reglate pe temperatura stabilită, sunet, regie. Tu nu trebuie să știi ce e un stop de expunere — trebuie doar să-ți vezi afacerea arătând mai bine decât în realitate.",
    weDo: [
      "Aducem echipamentul și echipa completă",
      "Regizăm fiecare cadru din shotlist — plus cele pe care le vedem pe loc",
      "Captăm sunet curat direct pe platou",
    ],
    youDo: [
      "Un om de contact prezent pe platou",
      "Produsul / spațiul / oamenii, conform call sheet-ului",
    ],
    duration: "1–3 zile",
  },
  {
    id: "post-productie",
    division: "video",
    isPlaceholder: false,
    order: 4,
    title: "Post-producție",
    description:
      "Montaj pe ritm, color grading cinematografic, sound design, subtitrări. Primești prima versiune, ne spui ce simți, o rafinăm. Două runde de revizii sunt incluse — consolidate, nu picurate pe WhatsApp.",
    weDo: [
      "Montăm, gradăm culoarea și mixăm sunetul",
      "Exportăm toate formatele: 16:9, 9:16, 1:1",
      "Integrăm feedback-ul în două runde incluse",
    ],
    youDo: [
      "Feedback consolidat per rundă — un singur e-mail, toate observațiile",
    ],
    duration: "5–10 zile",
  },
  {
    id: "livrare-difuzare",
    division: "video",
    isPlaceholder: false,
    order: 5,
    title: "Livrare & difuzare",
    description:
      "Primești link de descărcare cu masterul și toate versiunile, plus drepturile de utilizare negru pe alb. Iar dacă vrei ca filmul să și lucreze, nu doar să existe — tot noi îl băgăm în campanii.",
    weDo: [
      "Livrăm masterul + toate formatele, organizate pe canale",
      "Arhivăm proiectul 12 luni — revii oricând pentru versiuni noi",
      "Preluăm difuzarea în paid: Meta, Google, TikTok, LinkedIn",
    ],
    youDo: ["Nimic. Descarci și publici — sau ne lași pe noi să difuzăm"],
    duration: "1 zi",
  },
];

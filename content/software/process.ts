import type { ProcessStep } from "@/content/types";

/**
 * Procesul diviziei SOFTWARE (FAZA 4).
 * Copy de brand real — NU placeholder.
 *
 * `weDo` / `youDo` sunt inima paginii: un IMM care n-a mai lucrat cu o
 * agenție are nevoie să vadă negru pe alb ce i se cere și când, ca să
 * știe dacă are omul disponibil. Numerotarea 01–06 e legitimă aici:
 * e o secvență reală, nu decor (CLAUDE.md §3).
 */
export const softwareProcess: ProcessStep[] = [
  {
    id: "descoperire",
    division: "software",
    isPlaceholder: false,
    order: 1,
    title: "Descoperire",
    description:
      "Înainte să estimăm ceva, înțelegem cum lucrezi acum. Stăm cu oamenii care fac munca, nu doar cu cine semnează. Din discuția asta iese lista de probleme ordonate după cât te costă, nu după cât sunt de interesante tehnic.",
    duration: "1–2 săptămâni",
    weDo: [
      "Un call de descoperire de 60 de minute, gratuit, fără angajament",
      "Interviuri cu 2–4 oameni care folosesc zilnic fluxul de lucru",
      "Harta procesului actual, cu punctele unde se pierde timp",
      "Lista de riscuri tehnice pe care le vedem de la început",
    ],
    youDo: [
      "Ne dai acces la o persoană care cunoaște fluxul în detaliu",
      "Ne arăți sistemele actuale, chiar dacă sunt fișiere Excel",
      "Ne spui bugetul aproximativ și termenul real, nu cel ideal",
    ],
  },
  {
    id: "propunere",
    division: "software",
    isPlaceholder: false,
    order: 2,
    title: "Propunere",
    description:
      "Primești un document care spune ce construim, ce nu construim, în cât timp și la ce preț fix. Ce rămâne în afara proiectului e scris explicit — acolo apar de obicei surprizele. Dacă propunerea nu e ce ai nevoie, o refacem o dată, fără cost.",
    duration: "3–5 zile lucrătoare",
    weDo: [
      "Specificație funcțională pe capitole, în limbaj de om",
      "Preț fix pe etape, cu ce e inclus și ce e explicit exclus",
      "Calendar cu date, nu cu „aproximativ două luni”",
      "Propunerea de arhitectură și motivul fiecărei alegeri",
    ],
    youDo: [
      "Citești specificația și marchezi ce lipsește sau ce ai înțeles altfel",
      "Confirmi cine decide și aprobă din partea firmei",
    ],
  },
  {
    id: "design",
    division: "software",
    isPlaceholder: false,
    order: 3,
    title: "Design",
    description:
      "Desenăm ecranele înainte să le construim, pentru că mutarea unui buton în design costă zece minute, iar în cod costă o zi. Vezi machetele pe care poți da click, pe telefon și pe calculator, și le aprobi ecran cu ecran.",
    duration: "2–4 săptămâni, în funcție de numărul de ecrane",
    weDo: [
      "Machete interactive pentru fluxurile principale, pe mobil și desktop",
      "Sistem de componente reutilizabile, ca ecranele viitoare să fie ieftine",
      "Verificare de accesibilitate: contrast, tastatură, cititoare de ecran",
      "Două runde de revizii incluse",
    ],
    youDo: [
      "Feedback pe machete în 3–5 zile lucrătoare per rundă",
      "Ne trimiți logo, culori și materialele de brand pe care le ai",
      "Aprobi în scris înainte de dezvoltare",
    ],
  },
  {
    id: "dezvoltare",
    division: "software",
    isPlaceholder: false,
    order: 4,
    title: "Dezvoltare",
    description:
      "Construim în etape de două săptămâni. La finalul fiecăreia primești un link funcțional pe care intri și verifici — nu aștepți până la final ca să vezi ceva. Codul stă în repository-ul tău de la primul commit.",
    duration: "4–14 săptămâni, în funcție de proiect",
    weDo: [
      "Livrare pe mediu de test la fiecare două săptămâni",
      "Raport scris cu ce s-a făcut și ce urmează",
      "Testare automată pe fluxurile critice",
      "Cod în repository-ul tău, cu istoric complet",
    ],
    youDo: [
      "Verifici livrarea de test și ne spui ce nu e în regulă, în 5 zile",
      "Ne dai datele reale de care avem nevoie: catalog, utilizatori, conturi",
      "Aloci o persoană de contact disponibilă săptămânal",
    ],
  },
  {
    id: "lansare",
    division: "software",
    isPlaceholder: false,
    order: 5,
    title: "Lansare",
    description:
      "Punem în producție după o listă de verificare pe care ți-o arătăm dinainte. Migrăm datele, instruim echipa și rămânem lângă tine în primele două săptămâni, când apar întrebările reale.",
    duration: "1–2 săptămâni",
    weDo: [
      "Migrarea datelor din sistemul vechi, verificată prin control încrucișat",
      "Listă de verificare pre-lansare parcursă împreună",
      "Două sesiuni de instruire, înregistrate și lăsate la tine",
      "Supraveghere activă și intervenție prioritară în primele 14 zile",
    ],
    youDo: [
      "Stabilești data de lansare și anunți echipa",
      "Participi la instruire cu oamenii care vor folosi zilnic aplicația",
      "Semnezi procesul-verbal de recepție",
    ],
  },
  {
    id: "mentenanta",
    division: "software",
    isPlaceholder: false,
    order: 6,
    title: "Mentenanță",
    description:
      "După garanție, poți continua cu abonament lunar sau te poți descurca singur — codul și documentația sunt ale tale, iar procedura de actualizare e scrisă. Nu construim dependență de noi ca model de business.",
    duration: "Lunar, fără perioadă minimă impusă",
    weDo: [
      "12 luni garanție pe funcționalitățile livrate, incluse în preț",
      "Actualizări de securitate și copii de siguranță verificate",
      "Raport lunar de funcționare și intervenții",
      "Buget de ore pentru dezvoltări mici, la cerere",
    ],
    youDo: [
      "Ne semnalezi problemele prin canalul de suport, nu pe WhatsApp personal",
      "Decizi trimestrial ce dezvoltări noi intră în buget",
    ],
  },
];

import type { Service } from "@/content/types";

/**
 * Serviciile diviziei SOFTWARE (FAZA 4).
 * Copy de brand scris integral în RO — NU e placeholder (CLAUDE.md §5).
 *
 * Ordinea e intenționată, nu alfabetică: aplicațiile la comandă stau
 * primele pentru că acolo e bugetul mare și acolo se decide divizia.
 * Fără prețuri nicăieri — brief-ul le cere explicit afară.
 *
 * Tonul: competent, calm, precis. Spune ce primești și cât durează,
 * nu cât de pasionați suntem.
 */
export const softwareServices: Service[] = [
  {
    id: "aplicatii-web",
    division: "software",
    isPlaceholder: false,
    title: "Aplicații web la comandă",
    promise:
      "Softul se mulează pe fluxul tău de lucru. Nu fluxul pe soft.",
    description:
      "Începem de la cum lucrezi acum: cine introduce datele, cine le verifică, unde se pierde timpul. Din asta iese o specificație funcțională pe care o citești și o aprobi înainte să scriem prima linie de cod. Livrăm în producție, cu utilizatori, roluri și date reale — nu un demo pe care trebuie să-l mai „ducem la final”.",
    audience:
      "Firme care au depășit Excel-ul și fișierele partajate, dar pentru care un ERP de raft ar însemna să-și rescrie modul de lucru ca să încapă în el.",
    duration: "8–16 săptămâni până la prima versiune în producție",
    deliverables: [
      "Specificație funcțională aprobată de tine înainte de dezvoltare",
      "Aplicație live pe domeniul tău, cu utilizatori, roluri și permisiuni",
      "Cod sursă predat integral, în repository-ul tău, de la prima zi",
      "Documentație tehnică + manual de utilizare în română",
      "Două sesiuni de instruire pentru echipă, înregistrate",
      "12 luni garanție scrisă pe funcționalitățile livrate",
    ],
    stack: [
      "TypeScript",
      "Next.js / React",
      "PostgreSQL",
      "API REST sau tRPC",
      "Hosting propriu sau gestionat",
    ],
  },
  {
    id: "aplicatii-mobile",
    division: "software",
    isPlaceholder: false,
    title: "Aplicații mobile",
    promise:
      "O singură bază de cod, două magazine de aplicații, aceeași echipă.",
    description:
      "Construim aplicații care ajung în App Store și Google Play, cu un singur cod pentru ambele. Ne ocupăm și de partea pe care majoritatea o descoperă târziu: conturile de developer, procesul de review, actualizările și notificările. Dacă ai deja o aplicație web, o extindem — nu o rescriem.",
    audience:
      "Firme cu clienți sau angajați care lucrează de pe teren și au nevoie de acces offline, cameră, GPS sau notificări.",
    duration: "10–20 săptămâni, inclusiv publicarea în magazine",
    deliverables: [
      "Aplicație publicată în App Store și Google Play, pe conturile tale",
      "Versiune de test pentru echipă înainte de publicare (TestFlight / internal testing)",
      "Notificări push configurate și testate",
      "Cod sursă și chei de semnare predate",
      "Procedura de actualizare documentată, ca să nu depinzi de noi",
      "12 luni garanție pe funcționalitățile livrate",
    ],
    stack: ["React Native / Expo", "TypeScript", "API partajat cu aplicația web"],
  },
  {
    id: "ecommerce",
    division: "software",
    isPlaceholder: false,
    title: "Magazine online",
    promise: "Magazin care vinde și după ce pleacă agenția.",
    description:
      "Construim magazinul în jurul a două lucruri: viteza paginii de produs și cât de ușor îți administrezi tu stocul. Integrăm plățile, curierii și facturarea cu furnizorii cu care lucrezi deja, nu cu cei mai comozi pentru noi. Predăm un panou de administrare pe care îl folosește cineva din firma ta fără să ne sune.",
    audience:
      "Producători și distribuitori care vând direct, magazine fizice care se mută online, firme care au depășit limitele unei platforme închiriate.",
    duration: "6–12 săptămâni în funcție de numărul de integrări",
    deliverables: [
      "Magazin live, cu catalog importat din sistemul tău actual",
      "Plăți online și ramburs, configurate pe contul tău de comerciant",
      "Integrare curieri și generare AWB",
      "Legătură cu programul de facturare pe care îl folosești",
      "Panou de administrare comenzi, stocuri și clienți",
      "Instruire pentru persoana care administrează magazinul",
    ],
    stack: [
      "Next.js Commerce sau Shopify Headless",
      "PostgreSQL",
      "Netopia / Stripe",
      "API curieri (Sameday, FAN, DPD)",
    ],
  },
  {
    id: "site-prezentare",
    division: "software",
    isPlaceholder: false,
    title: "Site-uri de prezentare",
    promise:
      "Site-ul pe care îl trimiți înaintea ta, la o licitație sau la un client nou.",
    description:
      "Un site de prezentare are o singură treabă: să te facă credibil în primele zece secunde și să spună clar ce faci. Scriem textele împreună cu tine, structurăm paginile după cum caută clientul tău, și îți lăsăm un panou din care schimbi singur conținutul. Fără teme cumpărate și fără plugin-uri care se strică la prima actualizare.",
    audience:
      "IMM-uri care se modernizează, firme de producție și servicii B2B, cabinete și birouri profesionale.",
    duration: "3–6 săptămâni",
    deliverables: [
      "Site complet, responsive, în română și opțional engleză",
      "Panou de administrare pentru texte, imagini și articole",
      "Structură optimizată pentru căutare, verificată tehnic",
      "Formular de contact conectat la emailul tău, cu notificări",
      "Configurare analytics și rapoarte lunare, dacă le vrei",
      "Găzduire și certificat SSL configurate",
    ],
    stack: ["Next.js", "CMS administrabil", "Vercel / găzduire dedicată"],
  },
  {
    id: "landing-pages",
    division: "software",
    isPlaceholder: false,
    title: "Landing pages de campanie",
    promise:
      "Pagina în care aterizează bugetul tău de reclamă, construită să nu-l risipească.",
    description:
      "O pagină, un singur obiectiv, măsurată de la primul click. O construim rapid, o conectăm la platformele de reclame și instalăm evenimentele de conversie corect — pentru că o campanie fără măsurare corectă e un buget cheltuit orb. Dacă rulezi și campanii video cu noi, creativul și pagina se scriu împreună.",
    audience:
      "Firme care rulează campanii plătite și trimit traficul într-un site general, unde se pierde.",
    duration: "1–2 săptămâni per pagină",
    deliverables: [
      "Pagină dedicată, încărcată sub 2 secunde pe 4G",
      "Formular conectat la CRM sau email, cu notificare instant",
      "Evenimente de conversie instalate și verificate în Meta și Google",
      "Variantă A/B pregătită pentru testare",
      "Raport de conversie la 30 de zile",
    ],
    stack: ["Next.js", "Google Tag Manager", "Meta Pixel / GA4"],
  },
  {
    id: "automatizari-ai",
    division: "software",
    isPlaceholder: false,
    title: "Automatizări și integrări AI",
    promise:
      "Munca repetitivă din firmă, mutată din mâinile oamenilor în cod.",
    description:
      "Ne uităm întâi unde se pierde timpul: comenzi copiate manual dintr-un email în alt program, oferte scrise de la zero de fiecare dată, rapoarte adunate cu mâna la final de lună. Automatizăm întâi ce e sigur și verificabil. Unde chiar are sens, adăugăm un model de limbaj — cu răspunsuri verificate, nu cu un chatbot pus să dea bine în homepage.",
    audience:
      "Firme cu volum mare de operațiuni repetitive și cu programe care nu vorbesc între ele.",
    duration: "2–8 săptămâni per flux automatizat",
    deliverables: [
      "Harta fluxului actual, cu timpul măsurat pe fiecare pas",
      "Automatizarea în producție, cu jurnal de execuție vizibil",
      "Alerte când ceva eșuează — nu descoperi la final de lună",
      "Estimare de ore economisite lunar, măsurată după 30 de zile",
      "Documentație de operare pentru echipa ta",
    ],
    stack: [
      "TypeScript",
      "API-uri și webhook-uri",
      "Claude / OpenAI unde e justificat",
      "Cozi de procesare",
    ],
  },
  {
    id: "mentenanta",
    division: "software",
    isPlaceholder: false,
    title: "Mentenanță și suport",
    promise: "Cineva răspunde. În scris, în intervalul convenit.",
    description:
      "Abonament lunar cu timp de răspuns garantat prin contract, actualizări de securitate, copii de siguranță verificate prin restaurare de probă și un raport lunar care spune ce s-a întâmplat. Preluăm și proiecte construite de altcineva, după o evaluare tehnică inițială pe care ți-o predăm indiferent dacă lucrăm sau nu împreună.",
    audience:
      "Firme care depind zilnic de o aplicație sau de un magazin online și nu-și permit o zi de oprire.",
    duration: "Contract lunar, fără perioadă minimă impusă",
    deliverables: [
      "Timp de răspuns garantat prin contract, pe intervale definite",
      "Actualizări de securitate și de dependențe, lunar",
      "Copii de siguranță zilnice, testate prin restaurare trimestrială",
      "Monitorizare de disponibilitate cu alertă în sub 5 minute",
      "Raport lunar: intervenții, incidente, timp de funcționare",
    ],
    stack: ["Monitorizare uptime", "Backup automat", "Canal de suport dedicat"],
  },
  {
    id: "seo-tehnic",
    division: "software",
    isPlaceholder: false,
    title: "SEO tehnic și vizibilitate",
    promise:
      "Site-ul devine găsibil pentru ce cumpără clientul, nu pentru ce sună bine.",
    description:
      "Începem cu partea tehnică, pentru că acolo se pierd cele mai multe poziții și acolo se repară cel mai repede: viteză, structură, date structurate, erori de indexare. Apoi construim harta de conținut pe intențiile reale de căutare din piața ta. Raportăm poziții și trafic lunar, cu ce s-a schimbat și de ce.",
    audience:
      "Firme cu site funcțional care nu apar în căutări, sau care apar pe termeni care nu aduc cereri.",
    duration: "Audit în 2 săptămâni, apoi lucru lunar",
    deliverables: [
      "Audit tehnic complet, cu problemele ordonate după impact",
      "Corecțiile tehnice implementate, nu doar recomandate",
      "Hartă de conținut pe intenții de căutare reale",
      "Date structurate și fișă Google Business configurate",
      "Raport lunar de poziții și trafic, cu explicații în română",
    ],
    stack: ["Google Search Console", "Date structurate schema.org", "Core Web Vitals"],
  },
];

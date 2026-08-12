import type { Project } from "@/content/types";

/**
 * Portofoliul diviziei VIDEO — INTEGRAL PLACEHOLDER (FAZA 2).
 *
 * Toate proiectele au isPlaceholder: true, clienți evident fictivi și
 * rezultate nemăsurate („—”). Structura e completă, ca înlocuirea cu
 * proiecte reale să fie un singur commit:
 *   1. pui fișierul video în /public/video/projects/<id>.mp4
 *   2. înlocuiești posterul din /public/video/posters/<id>.(svg|jpg)
 *   3. rescrii câmpurile de text + metrics și setezi isPlaceholder: false
 */
export const videoProjects: Project[] = [
  {
    id: "imobiliare-01",
    division: "video",
    isPlaceholder: true,
    title: "Tur cinematic — turn rezidențial",
    client: "Dezvoltator rezidențial (client fictiv)",
    segment: "imobiliare",
    context:
      "Placeholder: un turn rezidențial nou, cu apartamente premium, într-o piață în care toți concurenții publică aceleași slideshow-uri cu poze.",
    challenge:
      "Placeholder: cumpărătorul serios nu are timp de 40 de poze — are 60 de secunde și un telefon.",
    solution:
      "Placeholder: tur cinematic la lumina zilei (5600K), dronă la răsărit, steadicam prin apartamentul martor, sound design fără voice-over.",
    result:
      "Placeholder — aici stă rezultatul măsurat al proiectului real (vizionări, programări la vizionare, vânzări).",
    metrics: [
      { label: "Vizionări", value: "—" },
      { label: "Programări generate", value: "—" },
    ],
    media: {
      kind: "video",
      src: "/video/projects/imobiliare-01.mp4",
      poster: "/video/posters/imobiliare-01.svg",
      alt: "Poster placeholder pentru turul cinematic al unui turn rezidențial — gradient rece, temperatură daylight 5600K",
    },
    year: 2025,
  },
  {
    id: "imobiliare-02",
    division: "video",
    isPlaceholder: true,
    title: "Film de lansare — ansamblu de vile",
    client: "Ansamblu de vile (client fictiv)",
    segment: "imobiliare",
    context:
      "Placeholder: lansarea unui ansamblu de vile la marginea orașului, cu vânzare pe plan.",
    solution:
      "Placeholder: filmare la ora de aur (3200K), familie reală în cadru, dronă peste tot ansamblul, cutdown-uri pentru campania de pre-lansare.",
    result:
      "Placeholder — rezultatul real al campaniei de lansare se completează la înlocuire.",
    metrics: [
      { label: "Lead-uri din campanie", value: "—" },
      { label: "Cost per lead", value: "—" },
    ],
    media: {
      kind: "video",
      src: "/video/projects/imobiliare-02.mp4",
      poster: "/video/posters/imobiliare-02.svg",
      alt: "Poster placeholder pentru filmul de lansare al unui ansamblu de vile — gradient cald, ora de aur, 3200K",
    },
    year: 2025,
  },
  {
    id: "corporate-01",
    division: "video",
    isPlaceholder: true,
    title: "Film de recrutare — sediu central",
    client: "Companie de servicii financiare (client fictiv)",
    segment: "corporate",
    context:
      "Placeholder: companie care pierde candidați buni în fața multinaționalelor cu employer branding puternic.",
    challenge:
      "Placeholder: „oamenii sunt cea mai mare valoare a noastră” nu se mai poate spune cu voce gravă peste stock footage.",
    solution:
      "Placeholder: o zi pe birourile lor, interviuri fără prompter, lumină naturală, montaj pe declarațiile care sună a om, nu a HR.",
    result:
      "Placeholder — impactul pe pipeline-ul de recrutare se completează cu cifre reale.",
    metrics: [
      { label: "Aplicări în 30 de zile", value: "—" },
      { label: "Timp mediu de vizionare", value: "—" },
    ],
    media: {
      kind: "video",
      src: "/video/projects/corporate-01.mp4",
      poster: "/video/posters/corporate-01.svg",
      alt: "Poster placeholder pentru un film de recrutare corporate — tonuri reci, birou la lumină naturală",
    },
    year: 2024,
  },
  {
    id: "corporate-02",
    division: "video",
    isPlaceholder: true,
    title: "Film aniversar — 25 de ani",
    client: "Producător regional (client fictiv)",
    segment: "corporate",
    context:
      "Placeholder: un sfert de secol de istorie a firmei, arhivă foto prăfuită și un eveniment aniversar cu 400 de invitați.",
    solution:
      "Placeholder: arhiva scanată și animată, fondatorul filmat în hala veche, tranziție de temperatură de la tungsten (trecut) la daylight (prezent).",
    result:
      "Placeholder — recepția filmului la eveniment și utilizarea lui ulterioară se documentează la înlocuire.",
    media: {
      kind: "video",
      src: "/video/projects/corporate-02.mp4",
      poster: "/video/posters/corporate-02.svg",
      alt: "Poster placeholder pentru un film aniversar corporate — arhivă caldă spre prezent rece",
    },
    year: 2024,
  },
  {
    id: "evenimente-01",
    division: "video",
    isPlaceholder: true,
    title: "Aftermovie — conferință de business",
    client: "Conferință anuală de antreprenoriat (client fictiv)",
    segment: "evenimente",
    context:
      "Placeholder: conferință cu 800 de participanți care vinde biletele ediției următoare exclusiv pe baza reputației.",
    solution:
      "Placeholder: două camere + gimbal în sală, sound bites de la speakeri și participanți, aftermovie de 90 de secunde livrat în 72 de ore, cât încă arde entuziasmul.",
    result:
      "Placeholder — efectul aftermovie-ului asupra vânzării early-bird se completează cu date reale.",
    metrics: [
      { label: "Vizionări organice", value: "—" },
      { label: "Bilete early-bird", value: "—" },
    ],
    media: {
      kind: "video",
      src: "/video/projects/evenimente-01.mp4",
      poster: "/video/posters/evenimente-01.svg",
      alt: "Poster placeholder pentru aftermovie de conferință — lumini calde de scenă, 3200K",
    },
    year: 2025,
  },
  {
    id: "personal-brand-01",
    division: "video",
    isPlaceholder: true,
    title: "Serie personal brand — 12 episoade",
    client: "Consultant în business (client fictiv)",
    segment: "personal-brand",
    context:
      "Placeholder: expert cu substanță, dar cu un feed care arăta a filmări din mașină, la 3 luni distanță una de alta.",
    solution:
      "Placeholder: o zi de filmare pe lună, set propriu cu lumină caldă constantă, 12 episoade + 36 de shorts tăiate pe hook-uri, calendar de publicare inclus.",
    result:
      "Placeholder — creșterea audienței și lead-urile din inbound se raportează la înlocuire.",
    metrics: [
      { label: "Urmăritori noi / lună", value: "—" },
      { label: "Cereri de ofertă din social", value: "—" },
    ],
    media: {
      kind: "video",
      src: "/video/projects/personal-brand-01.mp4",
      poster: "/video/posters/personal-brand-01.svg",
      alt: "Poster placeholder pentru o serie de personal brand — portret la lumină tungsten caldă",
    },
    year: 2025,
  },
  {
    id: "industrial-01",
    division: "video",
    isPlaceholder: true,
    title: "Film de capabilități — hală CNC",
    client: "Atelier de prelucrări CNC (client fictiv)",
    segment: "industrial",
    context:
      "Placeholder: atelier care licitează contracte B2B internaționale și trimite oferte PDF cu poze făcute pe telefon.",
    challenge:
      "Placeholder: clientul german nu vizitează hala înainte de shortlist — hala trebuie să ajungă la el.",
    solution:
      "Placeholder: macro pe scule în lucru, slidere prin hală, span aerian peste linie, grading rece cu scântei calde — SF, nu inventar.",
    result:
      "Placeholder — efectul asupra ratei de calificare în licitații se completează cu date reale.",
    metrics: [
      { label: "Shortlist-uri în licitații", value: "—" },
      { label: "Utilizare în oferte", value: "—" },
    ],
    media: {
      kind: "video",
      src: "/video/projects/industrial-01.mp4",
      poster: "/video/posters/industrial-01.svg",
      alt: "Poster placeholder pentru un film de capabilități industriale — hală CNC în tonuri reci cu accente calde",
    },
    year: 2024,
  },
  {
    id: "industrial-02",
    division: "video",
    isPlaceholder: true,
    title: "Timelapse — instalare linie HVAC",
    client: "Integrator HVAC (client fictiv)",
    segment: "industrial",
    context:
      "Placeholder: instalare de 6 săptămâni a unei linii industriale de ventilație, invizibilă pentru clientul final după predare.",
    solution:
      "Placeholder: cameră de timelapse montată pe toată durata, filmări punctuale la etapele-cheie, film de 60 de secunde care comprimă 6 săptămâni de muncă.",
    result:
      "Placeholder — utilizarea filmului în vânzarea următoarelor contracte se documentează la înlocuire.",
    media: {
      kind: "video",
      src: "/video/projects/industrial-02.mp4",
      poster: "/video/posters/industrial-02.svg",
      alt: "Poster placeholder pentru un timelapse industrial — șantier HVAC în lumină rece de hală",
    },
    year: 2025,
  },
];

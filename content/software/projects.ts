import type { Project } from "@/content/types";

/**
 * Studiile de caz ale diviziei SOFTWARE (FAZA 4).
 *
 * TOATE sunt placeholder (CLAUDE.md §5): structura e completă și reală,
 * conținutul nu. Nu există nume de client, cifre de rezultat sau citate
 * atribuite — `client` conține un descriptor de tip de firmă, nu o firmă.
 *
 * `metrics[].value === PENDING_METRIC` înseamnă „slot rezervat, cifra
 * reală se pune la publicare”. Componenta le randează ca o citire de
 * instrument necalibrat, nu ca o cifră inventată. Înlocuirea unui proiect
 * real = editezi obiectul + pui media în public/software/cases/, un commit.
 */

/** Sentinel pentru metricile fără cifră reală încă. */
export const PENDING_METRIC = "—";

/** Tipul de proiect — folosit la filtrare. Nu poate sta în `Project`
 *  (content/types.ts e înghețat), deci extindem tipul local. */
export type SoftwareProjectKind =
  | "aplicatie"
  | "ecommerce"
  | "prezentare"
  | "automatizare";

export const SOFTWARE_PROJECT_KINDS: ReadonlyArray<{
  id: SoftwareProjectKind;
  label: string;
  /** Cod scurt, folosit în citirile mono. */
  code: string;
}> = [
  { id: "aplicatie", label: "Aplicații la comandă", code: "APP" },
  { id: "ecommerce", label: "Magazine online", code: "COM" },
  { id: "prezentare", label: "Site-uri de prezentare", code: "WEB" },
  { id: "automatizare", label: "Automatizări și AI", code: "AUT" },
];

export interface SoftwareProject extends Project {
  kind: SoftwareProjectKind;
  /** Domeniul firmei, nu numele ei. */
  industry: string;
}

export const softwareProjects: SoftwareProject[] = [
  {
    id: "planificare-productie-cnc",
    division: "software",
    isPlaceholder: true,
    kind: "aplicatie",
    title: "Planificare de producție pentru un atelier CNC",
    client: "Producător de componente CNC",
    industry: "Producție industrială",
    year: 2025,
    context:
      "Atelier cu 14 mașini și trei schimburi, planificat pe un fișier Excel deschis simultan de patru oameni. Comenzile intrau pe email, iar prioritizarea se făcea dimineața, verbal.",
    challenge:
      "Nimeni nu putea răspunde cu certitudine când iese o comandă. Termenele se promiteau din memorie, iar întârzierile se descopereau cu o zi înainte de livrare.",
    solution:
      "Aplicație de planificare cu vedere pe mașină și pe schimb, import automat al comenzilor din email și calcul de termen pe baza încărcării reale. Ecran mare în atelier, cu programul zilei.",
    result:
      "Termenul de livrare se calculează automat la introducerea comenzii, iar întârzierile se văd cu zile înainte, nu în ziua livrării.",
    metrics: [
      { label: "Timp de planificare zilnică", value: PENDING_METRIC },
      { label: "Comenzi livrate la termen", value: PENDING_METRIC },
      { label: "Utilizatori activi zilnic", value: PENDING_METRIC },
    ],
    media: {
      kind: "image",
      src: "/software/cases/planificare-productie-cnc.svg",
      alt: "Machetă a ecranului de planificare: coloane pe mașini, bare de comenzi pe schimburi, indicator de încărcare.",
    },
  },
  {
    id: "portal-service-hvac",
    division: "software",
    isPlaceholder: true,
    kind: "aplicatie",
    title: "Portal de service pentru echipe de teren",
    client: "Distribuitor de echipamente HVAC",
    industry: "Instalații și service",
    year: 2025,
    context:
      "Zece tehnicieni pe teren, fișe de intervenție pe hârtie, fotografiate și trimise pe WhatsApp. Facturarea se făcea la două săptămâni după intervenție, când se mai găseau pozele.",
    challenge:
      "Intervențiile se facturau târziu sau deloc, iar istoricul unui echipament nu putea fi reconstituit când clientul reclama aceeași defecțiune.",
    solution:
      "Aplicație mobilă cu fișă de intervenție completată pe telefon, semnătura clientului pe ecran și funcționare fără semnal, cu sincronizare la revenirea în acoperire. Istoricul se leagă de seria echipamentului.",
    result:
      "Fișa pleacă spre facturare în aceeași zi, iar istoricul complet al unui echipament e vizibil înainte de deplasare.",
    metrics: [
      { label: "Zile până la facturare", value: PENDING_METRIC },
      { label: "Intervenții documentate complet", value: PENDING_METRIC },
      { label: "Deplasări evitate", value: PENDING_METRIC },
    ],
    media: {
      kind: "image",
      src: "/software/cases/portal-service-hvac.svg",
      alt: "Machetă a fișei de intervenție pe telefon: câmpuri completate, zonă de semnătură, indicator de sincronizare offline.",
    },
  },
  {
    id: "magazin-piese-schimb",
    division: "software",
    isPlaceholder: true,
    kind: "ecommerce",
    title: "Magazin B2B de piese de schimb",
    client: "Distribuitor de piese industriale",
    industry: "Distribuție B2B",
    year: 2024,
    context:
      "Catalog de peste 12.000 de repere, vândut telefonic și pe email. Prețurile diferă pe client, în funcție de contract, iar stocul se verifica manual în programul de gestiune.",
    challenge:
      "Comenzile mici consumau tot timpul echipei de vânzări, iar clienții nu puteau verifica singuri disponibilitatea în afara programului.",
    solution:
      "Magazin cu autentificare pe cont de client, prețuri contractuale afișate per utilizator și stoc sincronizat cu programul de gestiune. Comenzile intră direct în sistemul intern, fără reintroducere.",
    result:
      "Clienții recurenți comandă singuri, inclusiv în afara programului, iar echipa de vânzări rămâne pe conturile mari.",
    metrics: [
      { label: "Comenzi plasate online", value: PENDING_METRIC },
      { label: "Timp de procesare per comandă", value: PENDING_METRIC },
      { label: "Valoare medie a coșului", value: PENDING_METRIC },
    ],
    media: {
      kind: "image",
      src: "/software/cases/magazin-piese-schimb.svg",
      alt: "Machetă a catalogului B2B: listă de repere cu cod, stoc pe depozite și preț contractual per client.",
    },
  },
  {
    id: "configurator-tamplarie",
    division: "software",
    isPlaceholder: true,
    kind: "aplicatie",
    title: "Configurator de ofertă pentru tâmplărie",
    client: "Producător de tâmplărie PVC și aluminiu",
    industry: "Producție la comandă",
    year: 2025,
    context:
      "Fiecare ofertă se calcula manual într-un fișier de calcul cu zeci de coeficienți, cunoscut de două persoane din firmă. O ofertă completă lua între o oră și o zi.",
    challenge:
      "Ofertarea era gâtul de sticlă al vânzărilor și depindea de disponibilitatea a doi oameni. Greșelile de coeficient se descopereau la producție.",
    solution:
      "Configurator care compune produsul pe dimensiuni, profil și accesorii, calculează consumul de material și generează oferta în PDF cu identitatea firmei. Coeficienții se administrează dintr-un panou, fără programator.",
    result:
      "Oferta se generează de către orice agent de vânzări, cu aceleași reguli de calcul pentru toată lumea.",
    metrics: [
      { label: "Timp până la ofertă trimisă", value: PENDING_METRIC },
      { label: "Oferte emise lunar", value: PENDING_METRIC },
      { label: "Erori de calcul raportate", value: PENDING_METRIC },
    ],
    media: {
      kind: "image",
      src: "/software/cases/configurator-tamplarie.svg",
      alt: "Machetă a configuratorului: schiță de tâmplărie cu cote, panou de opțiuni și rezumat de preț.",
    },
  },
  {
    id: "prezentare-cabinet",
    division: "software",
    isPlaceholder: true,
    kind: "prezentare",
    title: "Site de prezentare pentru un birou de proiectare",
    client: "Birou de proiectare structuri",
    industry: "Servicii profesionale",
    year: 2024,
    context:
      "Site vechi de opt ani, needitabil fără programator, cu proiectele de referință blocate într-un PDF descărcabil.",
    challenge:
      "Biroul era invitat la licitații pe baza recomandărilor, dar pierdea în faza de verificare online, unde nu se vedea nimic din portofoliu.",
    solution:
      "Site nou cu portofoliu structurat pe tip de structură și an, fișe de proiect cu planșe și date tehnice, și panou din care echipa publică un proiect nou în zece minute.",
    result:
      "Portofoliul se actualizează intern, fără agenție, iar fiecare proiect are pagină proprie, indexabilă.",
    metrics: [
      { label: "Proiecte publicate de echipă", value: PENDING_METRIC },
      { label: "Cereri primite prin site", value: PENDING_METRIC },
      { label: "Viteză de încărcare", value: PENDING_METRIC },
    ],
    media: {
      kind: "image",
      src: "/software/cases/prezentare-cabinet.svg",
      alt: "Machetă a paginii de portofoliu: grilă de fișe de proiect cu an, tip de structură și planșă de prezentare.",
    },
  },
  {
    id: "automatizare-facturi",
    division: "software",
    isPlaceholder: true,
    kind: "automatizare",
    title: "Preluare automată a facturilor de la furnizori",
    client: "Firmă de distribuție alimentară",
    industry: "Distribuție și logistică",
    year: 2025,
    context:
      "Peste 400 de facturi de intrare pe lună, primite pe email în formate diferite și introduse manual în programul de contabilitate de o persoană dedicată.",
    challenge:
      "Introducerea manuală consuma o normă întreagă și genera erori care se descopereau la închiderea lunii.",
    solution:
      "Flux automat care preia facturile din email, extrage furnizorul, articolele și totalurile, le compară cu comanda și le trimite spre contabilitate. Ce nu se potrivește ajunge într-o coadă de verificare umană, cu motivul afișat.",
    result:
      "Facturile care se potrivesc cu comanda intră singure; omul verifică doar excepțiile, cu motivul explicat.",
    metrics: [
      { label: "Facturi procesate automat", value: PENDING_METRIC },
      { label: "Ore economisite lunar", value: PENDING_METRIC },
      { label: "Erori la închiderea lunii", value: PENDING_METRIC },
    ],
    media: {
      kind: "image",
      src: "/software/cases/automatizare-facturi.svg",
      alt: "Diagramă a fluxului automat: email de intrare, extragere de date, comparare cu comanda, coadă de excepții.",
    },
  },
];

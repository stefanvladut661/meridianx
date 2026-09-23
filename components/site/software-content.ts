/* ============================================================
   Copy MERIDIAN SOFTWARE — scris de la zero pentru redesign.

   Poziționare: partener de implementare pentru firme care au
   obținut finanțare de digitalizare și trebuie să transforme banii
   în infrastructură care chiar se folosește. Livrare pe etape
   scurte, interfețe moderne, cod și date pe numele clientului.

   Reguli (CLAUDE.md §4, §5, §11):
   - fără prețuri; totul e „pe ofertă", după consultanță
   - NU inventăm detalii legislative despre programele de finanțare;
     vorbim generic despre „programe de digitalizare" și marcăm
     orice afirmație care ar avea nevoie de verificare juridică
   - zero clienți reali, zero rezultate inventate
   - ton software: competent, calm, precis (nu obraznic ca la video)
   ============================================================ */

export type Placeholderable = { isPlaceholder?: true };

/* ---------- Navigație ---------- */
export const SNAV = [
  { href: "#solutii", label: "Ce construim" },
  { href: "#proces", label: "Cum lucrăm" },
  { href: "#garantii", label: "Garanții" },
  { href: "#proiecte", label: "Proiecte" },
  { href: "#configurator", label: "Configurator" },
] as const;

/* ---------- Cine e clientul ---------- */
export const AUDIENCE = [
  { label: "Producție", short: "Flux de comenzi, stoc, planificare" },
  { label: "Distribuție", short: "Agenți, oferte, rute, facturare" },
  { label: "Retail & HORECA", short: "Fidelizare, comenzi, rapoarte" },
  { label: "Servicii B2B", short: "Proiecte, pontaj, rentabilitate" },
  { label: "Clinici & wellness", short: "Programări, fișe, comunicare" },
  { label: "eCommerce", short: "Integrări, automatizări, dashboard" },
] as const;

/* ---------- Durerile ----------
   Formulate ca simptom → cauză → ce facem. Fără cifre inventate. */
export const SPAINS = [
  {
    tag: "Finanțare",
    symptom: "Ai contractul de finanțare semnat și un termen care se apropie.",
    cause:
      "Programele de digitalizare cer livrabile și documentație, nu intenții. Un furnizor care începe încet îți consumă exact rezerva de timp de care ai nevoie la final.",
    fix: "Plan pe etape din prima săptămână, cu livrabile datate și documentația de care ai nevoie la raportare.",
  },
  {
    tag: "Potrivire",
    symptom: "Ai cumpărat un sistem și tot lucrezi în Excel pe lângă el.",
    cause:
      "Softul standard te obligă să-ți schimbi procesul. Când procesul e avantajul tău competitiv, ajungi să ții două evidențe în paralel.",
    fix: "Construim în jurul felului în care lucrezi deja, nu invers. Ce e bun rămâne, ce e manual dispare.",
  },
  {
    tag: "Adopție",
    symptom: "Ai plătit un dashboard pe care nu-l deschide nimeni.",
    cause:
      "Dacă un raport cere trei clicuri și o explicație, oamenii se întorc la telefon și la hârtie. Interfața nu e cosmetică, e condiția ca sistemul să fie folosit.",
    fix: "Ecrane care se învață în cincisprezece minute, cu cifra importantă sus și acțiunea la un singur clic.",
  },
  {
    tag: "Integrare",
    symptom: "Sistemele tale nu vorbesc între ele.",
    cause:
      "Contabilitatea, stocul, magazinul și CRM-ul țin fiecare altă versiune a adevărului. Cineva din firmă pierde ore pe săptămână doar copiind date dintr-o parte în alta.",
    fix: "Un strat de integrare care sincronizează automat și care spune clar când ceva nu s-a putut sincroniza.",
  },
  {
    tag: "Performanță",
    symptom: "Dimineața, când intră toată echipa, aplicația se împotmolește.",
    cause:
      "Multe aplicații interne sunt construite pentru demonstrație, nu pentru volum real. Diferența se vede exact în orele în care ai nevoie de ele.",
    fix: "Arhitectură gândită pentru încărcarea ta reală, cu măsurători înainte și după, nu cu promisiuni.",
  },
  {
    tag: "Dependență",
    symptom: "Dacă furnizorul dispare, rămâi blocat.",
    cause:
      "Codul stă la el, serverele sunt pe contul lui, documentația nu există. Orice modificare devine negociere, nu decizie de business.",
    fix: "Cod, conturi și documentație pe numele firmei tale, din prima zi. Poți continua cu oricine.",
  },
] as const;

/* ---------- Ce construim ----------
   Titlu de 1–3 cuvinte + un singur rând. Restul îl spune ecranul
   animat din `software-screens.tsx`, cheiat pe `key`. `demo` = slug-ul
   unui proiect livrat de același tip (app-demos/registry.ts): panoul
   trimite spre demo-ul lui, ca schița să aibă și o dovadă. */
export const SOLUTIONS = [
  {
    key: "business",
    title: "Aplicații interne",
    line: "Comenzi, producție, stoc și aprobări, exact cum lucrează echipa.",
    path: "comenzi",
    demo: "zof",
  },
  {
    key: "loyalty",
    title: "Fidelizare",
    line: "Puncte, niveluri și campanii care aduc clientul înapoi.",
    path: "card-client",
    demo: "prosperanta",
  },
  {
    key: "dash",
    title: "Dashboard-uri",
    line: "Toate cifrele firmei pe un singur ecran, actualizate singure.",
    path: "dashboard",
    demo: "zof",
  },
  {
    key: "sales",
    title: "Ofertare",
    line: "Oferte generate în minute, urmărite până la semnătură.",
    path: "oferte",
  },
  {
    key: "saas",
    title: "Produse SaaS",
    line: "Produsul tău, vândut pe abonament către alte firme.",
    path: "abonamente",
    demo: "tablex",
  },
  {
    key: "mobile",
    title: "Aplicații mobile",
    line: "iOS și Android, merg și fără semnal.",
    path: "mobil",
    demo: "elyssium",
  },
  {
    key: "web",
    title: "Site-uri care vând",
    line: "Construite să aducă cereri, nu doar vizite.",
    path: "site",
    demo: "art-install",
  },
  {
    key: "integrari",
    title: "Integrări",
    line: "Facturare, e-Factura, plăți, curieri și ERP, legate între ele.",
    path: "integrari",
    demo: "prosperanta",
  },
] as const;

export type SolutionKey = (typeof SOLUTIONS)[number]["key"];

/* ---------- Procesul ----------
   Secvență reală, deci numerotarea e legitimă (CLAUDE.md §3). */
export const SPROCESS = [
  { n: "01", title: "Consultanță", line: "30 de minute despre procesul care te încurcă." },
  { n: "02", title: "Fișa de proiect", line: "Scop, etape și ofertă fermă, în scris." },
  { n: "03", title: "Prima versiune", line: "Software funcțional la echipă, în câteva săptămâni." },
  { n: "04", title: "Predare", line: "Cod, conturi și documentație pe firma ta." },
  { n: "05", title: "Mentenanță", line: "Opțională, lunară, cât ai nevoie de noi." },
] as const;

/* ---------- Garanții ----------
   Titlu scurt pentru ce e evident; `line` doar unde merită explicat. */
export const GUARANTEES: { title: string; line?: string }[] = [
  {
    title: "Prima versiune în săptămâni",
    line: "Nu în trimestre. Corectezi devreme, când e ieftin.",
  },
  {
    title: "Codul e al tău",
    line: "Repository, servere și conturi pe firma ta, din prima zi.",
  },
  { title: "Ecrane învățate în minute" },
  {
    title: "Performanță măsurată",
    line: "Timpi stabiliți la început, verificați pe volumul tău real.",
  },
  {
    title: "Documente pentru raportare",
    // TODO: verificat juridic pe program — forma cerută în dosar.
    line: "La fiecare etapă, pentru dosarul de finanțare.",
  },
  { title: "Ofertă fermă, pe etape" },
];

/* ---------- Recenzii ----------
   Doar citate primite în scris, cuvânt cu cuvânt. Fiecare recenzie duce
   la demo-ul proiectului despre care vorbește (`project` = slug din
   app-demos/registry.ts), ca dovada să poată fi verificată pe loc. */
export const SREVIEWS: {
  quote: string;
  who: string;
  where: string;
  logo?: string;
  project?: string;
}[] = [
  {
    // verificat: primit în scris de la client (același citat ca pe /video)
    quote:
      "Nu am primit doar un produs. Am primit și asistență pe tot parcursul, iar totul s-a întâmplat exact așa cum am discutat de la început.",
    who: "Art Install Suppliers",
    where: "Site cu recomandare de pompe de căldură",
    logo: "/video/recenzii/logo-art-instal.webp",
    project: "art-install",
  },
];

/* Recenzia filmată de la Art Install. Fișierul nu e încă în proiect:
   când ajunge în public/software/recenzii/ (mp4 + poster webp), se
   completează aici și apare lângă citat, ca pe /video.
   TODO: clipul Art Install — cerut omului pe 2026-09-23. */
export const SREVIEW_VIDEO: {
  slug: string;
  client: string;
  title: string;
  kind: string;
  src: string;
  poster: string;
  w: number;
  h: number;
  seconds: number;
  audio: boolean;
} | null = null;

/* ---------- Întrebări ---------- */
export const SFAQ = [
  {
    q: "Cât costă un proiect?",
    a: "Lucrăm pe ofertă fermă, pe etape, pentru că prețul depinde de cât de complex e procesul pe care îl digitalizăm și de câte sisteme trebuie integrate. După consultanța de treizeci de minute primești o fișă de proiect cu scopul, etapele și oferta, ca să știi exact ce cumperi înainte să semnezi ceva.",
  },
  {
    q: "Lucrați cu firme care au finanțare de digitalizare?",
    a: "Da, e cea mai mare parte din ce facem. Ne organizăm livrarea pe etape datate și pregătim documentația tehnică și de proces la fiecare etapă, în forma în care e cerută în dosar. Nu suntem consultanți de finanțare și nu depunem dosarul în locul tău — construim partea de infrastructură și livrăm documentele care o însoțesc.",
  },
  {
    q: "Cât durează până am ceva funcțional?",
    a: "Prima versiune utilizabilă ajunge de regulă la echipa ta în câteva săptămâni de la semnare, pentru că nu construim tot deodată: începem cu felia care rezolvă durerea cea mai mare. Restul se adaugă pe etape, iar tu vezi progres real la fiecare, nu un singur moment de livrare la final.",
  },
  {
    q: "Al cui este codul?",
    a: "Al tău, din prima zi. Repository-ul, serverele și conturile de servicii sunt pe numele firmei tale, iar documentația se predă odată cu proiectul. Poți continua cu noi, cu altcineva sau cu o echipă internă — decizia rămâne una de business, nu una de acces.",
  },
  {
    q: "Ce se întâmplă dacă ne schimbăm cerințele pe parcurs?",
    a: "Se întâmplă la aproape orice proiect, tocmai pentru că vezi software real devreme. Schimbările din interiorul scopului le absorbim în etapa curentă; cele care extind scopul le estimăm separat, ca să vezi ce înseamnă înainte să decizi. Nimic nu se adaugă tacit la factură.",
  },
  {
    q: "Preluați și sisteme construite de altcineva?",
    a: "Da. Începem cu un audit tehnic: ce există, în ce stare e codul, ce se poate salva și ce e mai ieftin de reconstruit. Îți spunem sincer și când răspunsul e că nu merită să continuăm pe ce există — inclusiv atunci pleci cu auditul în mână.",
  },
  {
    q: "Aveți mentenanță după predare?",
    a: "Da, opțional și lunar. Include monitorizare, corecții prioritizate și dezvoltări noi la cerere. Nu e obligatorie și nu o legăm de accesul la propriul tău sistem — dacă vrei să o duci intern, te ajutăm să faci tranziția.",
  },
];

/* ---------- Ce primești după consultanță (lead magnet) ---------- */
export const CONSULT_OUTPUT = [
  {
    title: "Harta procesului tău",
    body: "Unde se pierde timp acum, desenat pe pași, nu descris în cuvinte.",
  },
  {
    title: "Fișa de proiect, în scris",
    body: "Scop, etape, estimare de timp și ce rămâne în afara scopului.",
  },
  {
    title: "Riscurile, spuse din start",
    body: "Ce poate întârzia proiectul și ce depinde de tine, nu de noi.",
  },
  {
    title: "Ofertă fermă, pe etape",
    body: "Ca să o poți compara cu oricare alta, punct cu punct.",
  },
] as const;

/* ---------- Contact ----------
   Vine din env (`components/site/contact.ts`). Reexportat sub numele
   vechi ca paginile să nu-și schimbe importurile. */
export { SOFTWARE_CONTACT as SCONTACT } from "./contact";

/* ---------- Filmul de prezentare ----------
   Același fișier ca pe divizia video (e filmul agenției), dar declarat
   aici ca lumile să nu-și importe conținut una alteia. */
export const SPRESENTATION = {
  slug: "prezentare",
  client: "MERIDIAN",
  title: "Filmul de prezentare",
  kind: "Prezentare",
  src: "/video/prezentare.mp4",
  poster: "/video/prezentare.webp",
  w: 1920,
  h: 1080,
  seconds: 22,
  audio: true,
} as const;

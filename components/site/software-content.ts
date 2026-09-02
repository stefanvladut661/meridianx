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
  { href: "#configurator", label: "Configurator" },
  { href: "#proces", label: "Cum lucrăm" },
  { href: "#garantii", label: "Garanții" },
  { href: "#intrebari", label: "Întrebări" },
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

/* ---------- Ce construim ---------- */
export const SOLUTIONS = [
  {
    key: "business",
    icon: "layers",
    title: "Aplicații de business la comandă",
    blurb:
      "Fluxul tău intern, digitalizat exact cum îl trăiește echipa: comenzi, producție, stoc, aprobări, documente. Fără module pe care nu le folosește nimeni.",
    bullets: ["Roluri și permisiuni", "Istoric și audit", "Rapoarte pe operațiuni"],
  },
  {
    key: "loyalty",
    icon: "spark",
    title: "Aplicații de fidelizare",
    blurb:
      "Puncte, niveluri, cupoane, campanii. Clientul revine pentru că are un motiv concret, iar tu vezi în sfârșit cine sunt clienții care contează.",
    bullets: ["Card digital și QR", "Campanii automate", "Segmentare pe comportament"],
  },
  {
    key: "dash",
    icon: "chart",
    title: "Dashboard-uri custom",
    blurb:
      "Datele din toate sursele tale, într-un singur ecran care răspunde la întrebările pe care le pui de fapt luni dimineața.",
    bullets: ["Date din surse multiple", "Actualizare în timp real", "Alerte pe praguri"],
  },
  {
    key: "sales",
    icon: "target",
    title: "Mecanisme de vânzare",
    blurb:
      "Configuratoare de produs, generare automată de oferte, pipeline, urmărire, relansări. Mai puțin timp pe ofertat, mai mult pe vândut.",
    bullets: ["Configurator și ofertare", "Pipeline și relansări", "Semnătură și aprobări"],
  },
  {
    key: "saas",
    icon: "cloud",
    title: "Produse SaaS",
    blurb:
      "Ai o idee de produs pe care să-l vinzi pe abonament. Construim varianta care poate fi vândută, nu prototipul care rămâne în sertar.",
    bullets: ["Multi-tenant", "Abonamente și facturare", "Panou de administrare"],
  },
  {
    key: "mobile",
    icon: "phone",
    title: "Aplicații mobile",
    blurb:
      "iOS și Android din aceeași bază de cod. Pentru echipa de teren, pentru clienți sau pentru amândoi, cu funcționare și fără semnal bun.",
    bullets: ["iOS + Android", "Lucru offline", "Notificări"],
  },
  {
    key: "web",
    icon: "search",
    title: "Site-uri de conversie mare",
    blurb:
      "Site care aduce cereri, nu doar vizite. Structură de argumentare, viteză de încărcare, formulare care se completează și pe telefon.",
    bullets: ["Structură de conversie", "Viteză și SEO tehnic", "Analitică pe obiective"],
  },
  {
    key: "integrari",
    icon: "link",
    title: "Integrări și automatizări",
    blurb:
      "Legăm ce ai deja: facturare, e-Factura, plăți, curieri, magazin, ERP. Datele circulă singure, iar tu vezi imediat unde s-a blocat ceva.",
    bullets: ["Facturare și e-Factura", "Plăți și curieri", "ERP și magazin online"],
  },
] as const;

/* ---------- Integrări frecvente ----------
   Nume de sisteme cu care se lucrează uzual în piața locală.
   TODO: verificat juridic — dacă afișăm logo-uri, avem nevoie de
   acordul fiecărui furnizor; textul simplu e sigur. */
export const INTEGRATIONS = [
  "Facturare",
  "e-Factura",
  "Plăți online",
  "Curieri",
  "Magazin online",
  "ERP existent",
  "Casă de marcat",
  "Semnătură electronică",
  "Email și SMS",
  "Analitică",
] as const;

/* ---------- Procesul ---------- */
export const SPROCESS = [
  {
    n: "01",
    title: "Consultanță",
    dur: "30 de minute",
    lead: "Punem întrebările incomode înainte să scriem cod.",
    body: "Ce proces te doare, cine îl folosește, ce sisteme există deja, ce termen ai. Ieșim cu o imagine clară a proiectului, nu cu o promisiune vagă.",
    out: ["Harta procesului", "Riscurile identificate", "Direcția tehnică"],
  },
  {
    n: "02",
    title: "Fișa de proiect",
    dur: "câteva zile",
    lead: "Scopul, scris astfel încât să nu se poată interpreta.",
    body: "Primești un document cu ce se construiește, în ce etape, ce livrăm la fiecare etapă și ce rămâne în afara scopului. E al tău, inclusiv ca să compari alte oferte.",
    out: ["Scop și etape", "Estimare de timp", "Ofertă fermă"],
  },
  {
    n: "03",
    title: "Prima versiune utilizabilă",
    dur: "primele săptămâni",
    lead: "Vezi software care merge, nu prezentări.",
    body: "Construim mai întâi felia care rezolvă durerea cea mai mare și o punem în mâinile echipei tale. De acolo, corectăm pe date reale, nu pe presupuneri.",
    out: ["Aplicație funcțională", "Testare cu echipa", "Ajustări pe feedback"],
  },
  {
    n: "04",
    title: "Extindere și predare",
    dur: "pe etape",
    lead: "Creștem sistemul, apoi ți-l dăm cu totul.",
    body: "Adăugăm etapele următoare, integrăm restul sistemelor, instruim echipa și predăm codul, conturile și documentația pe numele firmei tale.",
    out: ["Documentație tehnică", "Instruire echipă", "Predare cod și conturi"],
  },
  {
    n: "05",
    title: "Mentenanță și evoluție",
    dur: "lunar, opțional",
    lead: "Rămânem în spate, cât ai nevoie de noi.",
    body: "Monitorizare, corecții, îmbunătățiri cerute de echipă. Fără abonament obligatoriu: dacă vrei să continui cu altcineva sau intern, ai tot ce-ți trebuie.",
    out: ["Monitorizare", "Corecții prioritizate", "Dezvoltări noi la cerere"],
  },
] as const;

/* ---------- Garanții / de ce noi ---------- */
export const GUARANTEES = [
  {
    icon: "clock",
    title: "Prima versiune în săptămâni, nu în trimestre",
    body: "Lucrăm pe felii care produc valoare de la început. Vezi software real devreme, ceea ce înseamnă că poți corecta devreme — acolo unde corecțiile sunt ieftine.",
  },
  {
    icon: "check",
    title: "Cod și date pe numele tău",
    body: "Repository, servere, conturi de servicii: totul pe firma ta, din prima zi. Nu te ținem legați de noi prin acces, ci prin faptul că e mai bine cu noi.",
  },
  {
    icon: "spark",
    title: "Interfețe pe care le folosește lumea",
    body: "Design făcut de aceeași echipă care construiește. Ecranele se învață în minute, nu într-o zi de training — altfel sistemul rămâne neatins.",
  },
  {
    icon: "chart",
    title: "Performanță măsurată, nu promisă",
    body: "Stabilim de la început timpii acceptabili pentru operațiunile zilnice și îi verificăm pe volumul tău real, înainte de predare.",
  },
  {
    icon: "shield",
    title: "Documentație pentru raportare",
    body: "Livrăm documentele tehnice și de proces în forma cerută în dosarul de finanțare, la fiecare etapă. TODO: verificat juridic pe program.",
  },
  {
    icon: "target",
    title: "Preț competitiv, fără surprize",
    body: "Pornim de la o fundație internă pe care o refolosim, deci nu plătești construcția lucrurilor deja rezolvate. Oferta e fermă și pe etape.",
  },
] as const;

/* ---------- Ce primești ---------- */
export const SDELIVERABLES = [
  "Codul sursă, în repository pe numele firmei tale",
  "Conturile de infrastructură și servicii, tot pe firma ta",
  "Documentație tehnică și manual de utilizare",
  "Instruirea echipei, înregistrată, ca să o revadă oricine",
  "Documentele tehnice necesare la raportare",
  "O lună de corecții după predare, fără cost suplimentar",
] as const;

/* ---------- Cifre de capabilitate ----------
   Capacități de lucru, NU rezultate. Marcate placeholder până le
   confirmă clientul; nu se publică fără confirmare. */
export const SSTATS: (Placeholderable & {
  value: number;
  suffix?: string;
  label: string;
  note: string;
})[] = [
  {
    isPlaceholder: true,
    value: 4,
    suffix: "–6",
    label: "săptămâni până la prima versiune",
    note: "Felia care rezolvă durerea principală, în mâinile echipei",
  },
  {
    isPlaceholder: true,
    value: 8,
    label: "tipuri de proiecte acoperite",
    note: "De la aplicație internă la SaaS și mobil",
  },
  {
    isPlaceholder: true,
    value: 100,
    suffix: "%",
    label: "cod predat clientului",
    note: "Fără licențiere ascunsă, fără dependență de noi",
  },
  {
    isPlaceholder: true,
    value: 30,
    label: "minute de consultanță, gratuit",
    note: "Cu fișă de proiect scrisă după, indiferent de decizie",
  },
];

/* ---------- Testimoniale — STRUCTURĂ ILUSTRATIVĂ ----------
   Nu există încă recenzii reale. NU se publică live. */
export const STESTIMONIALS: (Placeholderable & {
  quote: string;
  who: string;
  where: string;
})[] = [
  {
    isPlaceholder: true,
    quote:
      "Aici va apărea o recenzie reală, după primele proiecte predate. Structura rămâne aceasta: procesul care se bloca, ce am construit, ce s-a schimbat în operațiune.",
    who: "Rol client",
    where: "Industrie, oraș",
  },
  {
    isPlaceholder: true,
    quote:
      "Spațiu rezervat pentru feedback dintr-un proiect cu finanțare de digitalizare. Se completează cu acordul scris al clientului.",
    who: "Rol client",
    where: "Producție",
  },
  {
    isPlaceholder: true,
    quote:
      "Spațiu rezervat pentru feedback de la un client de aplicație de fidelizare. Se completează cu acordul scris al clientului.",
    who: "Rol client",
    where: "Retail",
  },
];

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

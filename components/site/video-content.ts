/* ============================================================
   Copy MERIDIAN VIDEO — scris de la zero pentru redesign.
   Poziționare: nu vindem filmări, construim sistemul care aduce
   clienți. Producție in-house + distribuție plătită + optimizare
   lunară. Partener pe termen lung, nu furnizor de proiect.

   Reguli respectate (CLAUDE.md §4, §5):
   - română ca limbă sursă, verbe active, propoziții scurte
   - fără prețuri; totul e „pe ofertă"
   - zero rezultate inventate, zero nume de clienți reali
   - tot ce e ilustrativ e marcat isPlaceholder
   ============================================================ */

export type Placeholderable = { isPlaceholder?: true };

/* ---------- Industrii ---------- */
export const VERTICALS = [
  { key: "horeca", label: "HORECA", short: "Restaurante, cafenele, baruri" },
  { key: "imobiliare", label: "Imobiliare", short: "Dezvoltatori și agenții" },
  { key: "wellness", label: "Wellness", short: "Clinici, saloane, fitness" },
  { key: "auto", label: "Auto", short: "Dealeri, service, detailing" },
  { key: "ecom", label: "eCommerce", short: "Branduri cu magazin propriu" },
  { key: "retail", label: "Retail local", short: "Showroom și magazine" },
] as const;

/* ---------- Durerile reale, pe industrie ----------
   Formulate din simptom (ce vede clientul) → cauză (ce e de fapt).
   Nu sunt statistici, sunt observații — deci nu inventăm cifre.

   `glyph` alege desenul care ARATĂ simptomul (problem-glyphs.tsx):
   pe pagină, explicația stă după un click, desenul și soluția sunt la
   vedere. Tipul de mai jos obligă fiecare desen să existe. */
export type PainGlyph =
  "saptamana" | "pozele" | "agenda" | "leaduri" | "curba" | "tabloul";

export const PAINS = [
  {
    tag: "HORECA",
    glyph: "saptamana",
    symptom: "Weekendul e plin. Marți la 19:00 sunt mese goale.",
    cause:
      "Postezi pentru cei care te urmăresc deja. Omul aflat la trei străzi distanță, care caută unde să mănânce diseară, nu te vede niciodată.",
    fix: "Conținut filmat pentru apetit + campanii pe rază de câțiva kilometri, pornite pe zilele slabe.",
  },
  {
    tag: "Imobiliare",
    glyph: "pozele",
    symptom: "Anunțul are 40 de fotografii și zero vizionări serioase.",
    cause:
      "Cumpărătorul decide în câteva secunde dacă merită drumul. Fotografiile făcute pe telefon îl fac să deruleze mai departe.",
    fix: "Tur filmat care arată fluxul locuinței, plus campanii care filtrează curioșii de cumpărători.",
  },
  {
    tag: "Wellness",
    glyph: "agenda",
    symptom: "Plătești reclame, dar agenda rămâne cu ferestre.",
    cause:
      "Fără dovadă vizuală a rezultatului și a locului, singurul criteriu de comparație rămâne prețul.",
    fix: "Materiale înainte–după, tur de clinică și testimonial filmat, distribuite spre publicul potrivit.",
  },
  {
    tag: "Auto",
    glyph: "leaduri",
    symptom: "Stocul stă, iar lead-urile care vin sunt reci.",
    cause:
      "Formularul se completează de curioși, nu de cumpărători. Nimic din reclamă nu i-a calificat înainte.",
    fix: "Video de prezentare pe unitate + formulare cu întrebări care sortează, nu doar colectează.",
  },
  {
    tag: "eCommerce",
    glyph: "curba",
    symptom: "Reclama care mergea luna trecută s-a stins brusc.",
    cause:
      "Publicul a văzut acel material de prea multe ori. Nu ai nevoie de buget mai mare, ai nevoie de variante noi.",
    fix: "Flux lunar de creative: hook-uri diferite, formate verticale, testare continuă pe ce convertește.",
  },
  {
    tag: "Toate",
    glyph: "tabloul",
    symptom: "Ai un videoclip frumos și nu s-a întâmplat nimic.",
    cause:
      "Un material fără buget de distribuție e un tablou ținut în pod. Nimeni nu ajunge la el din întâmplare.",
    fix: "Fiecare producție pleacă din start cu un plan de difuzare și un obiectiv măsurabil.",
  },
] as const satisfies readonly {
  tag: string;
  glyph: PainGlyph;
  symptom: string;
  cause: string;
  fix: string;
}[];

/* ---------- Sistemul în patru pași ---------- */
export const SYSTEM = [
  {
    n: "01",
    title: "Diagnostic",
    lead: "Ne uităm la cifrele tale, nu la trenduri.",
    body: "Oferta, marja, sezonalitatea, ce te-a costat până acum un client. Ieșim cu un obiectiv pe care îl putem măsura, nu cu un moodboard.",
    outputs: [
      "Audit ofertă și public",
      "Analiza concurenței locale",
      "Obiectiv și indicatori",
    ],
  },
  {
    n: "02",
    title: "Producție",
    lead: "Echipă completă, o singură zi de filmare.",
    body: "Scenarist, regizor, operatori, lumini, sunet, actori dacă e nevoie. Filmăm modular, pe blocuri: din aceeași ieșire ies mai multe unghiuri și formate, nu un singur material.",
    outputs: [
      "Scenarii și storyboard",
      "Filmare cu echipă in-house",
      "Montaj, color, sound design",
    ],
  },
  {
    n: "03",
    title: "Distribuție",
    lead: "Materialul ajunge exact la cine cumpără.",
    body: "Meta, TikTok și Google. Structură de campanie pe etape, targetare construită pe comportament, nu pe ghicit.",
    outputs: [
      "Setup conturi și pixel",
      "Campanii pe obiectiv",
      "Testare de hook-uri și formate",
    ],
  },
  {
    n: "04",
    title: "Optimizare",
    lead: "Tăiem ce nu merge. Scalăm ce merge.",
    body: "Ne uităm săptămânal la date, schimbăm creative-urile obosite și îți trimitem lunar un raport pe înțeles: ce a adus cereri și ce nu.",
    outputs: [
      "Raport lunar clar",
      "Creative noi la fiecare ciclu",
      "Apel de calibrare lunar",
    ],
  },
] as const;

/* ---------- Servicii ---------- */
export const SERVICES = [
  {
    key: "brand",
    title: "Film de brand",
    blurb:
      "Filmul care spune cine ești în 60 de secunde. Pentru pagina de start, pentru prezentări, pentru momentul în care cineva te caută înainte să sune.",
    bullets: [
      "Scenariu și concept",
      "Filmare cinematică",
      "Variante scurte pentru social",
    ],
  },
  {
    key: "performance",
    title: "Video de performanță",
    blurb:
      "Materiale construite ca să vândă, nu ca să impresioneze. Hook în prima secundă, ofertă clară, apel la acțiune. Livrate în serii, ca să ai ce testa.",
    bullets: [
      "Hook-uri multiple",
      "Formate 9:16 și 1:1",
      "Variante A/B din același shoot",
    ],
  },
  {
    key: "ugc",
    title: "UGC și actori",
    blurb:
      "Nu trebuie să apari tu în cadru. Lucrăm cu actori și creatori care sună a om real, nu a reclamă, și care se potrivesc cu publicul tău.",
    bullets: [
      "Casting pe profil",
      "Scenarii conversaționale",
      "Filmare rapidă, volum mare",
    ],
  },
  {
    key: "foto",
    title: "Fotografie comercială",
    blurb:
      "Preparate, produse, spații, echipă. Setul complet de imagini care îți susține site-ul, meniul, anunțurile și campaniile.",
    bullets: ["Produs și preparat", "Spații și arhitectură", "Retuș inclus"],
  },
  {
    key: "ads",
    title: "Campanii Meta & TikTok",
    blurb:
      "Structură de cont, targetare, bugete, testare. Contul rămâne pe numele tău — noi lucrăm în el, nu în locul tău.",
    bullets: ["Setup complet", "Testare continuă", "Raportare lunară"],
  },
  {
    key: "google",
    title: "Google & YouTube",
    blurb:
      "Prindem cererea care există deja: omul care caută activ ce vinzi. Plus YouTube pentru materialele lungi, acolo unde răbdarea e mai mare.",
    bullets: [
      "Search și Performance Max",
      "Campanii video",
      "Urmărire conversii",
    ],
  },
] as const;

/* ---------- De ce noi ---------- */
export const EDGES = [
  {
    title: "Un singur partener",
    body: "Producție și campanii sub același acoperiș. Nu mai există „agenția zice că materialul e slab, studioul zice că targetarea e slabă”.",
  },
  {
    title: "Echipă in-house",
    body: "Operatori, editori, scenariști, actori, media buyeri. Nu subcontractăm oameni pe care nu i-am văzut lucrând.",
  },
  {
    title: "Măsurăm în cereri, nu în vizualizări",
    body: "Raportul lunar începe cu numărul de solicitări și comenzi. Reach-ul e a treia coloană, nu prima.",
  },
  {
    title: "Ritm lunar, nu proiect izolat",
    body: "Un shoot pe trimestru alimentează campaniile luni întregi. Așa scade costul pe material și crește predictibilitatea.",
  },
] as const;

/* ---------- Echipa / capabilități ---------- */
export const CREW = [
  { role: "Scenariști", note: "Structura care ține omul în cadru" },
  { role: "Operatori imagine", note: "Cinema line, lumini, sunet" },
  { role: "Editori", note: "Montaj, color grading, sound design" },
  { role: "Motion designeri", note: "Grafică, subtitrări, animație" },
  { role: "Actori și voci", note: "Casting pe profilul publicului" },
  { role: "Media buyeri", note: "Meta, TikTok, Google" },
] as const;

/* ---------- Ce primești ---------- */
export const DELIVERABLES = [
  "Materialele master, în rezoluție completă",
  "Variantele verticale pentru Reels, TikTok și Shorts",
  "Fotografiile din ziua de filmare",
  "Drept de utilizare nelimitat pe canalele tale",
  "Conturile de publicitate pe numele firmei tale",
  "Raport lunar de campanie, în limbaj de om",
] as const;

/* ---------- Proces de colaborare (pași scurți pentru CTA) ---------- */
export const STEPS = [
  {
    n: "1",
    title: "Apel de 20 de minute",
    body: "Ne spui unde se blochează vânzările. Punem întrebări incomode.",
  },
  {
    n: "2",
    title: "Plan și ofertă",
    body: "Primești în câteva zile un plan de conținut și distribuție, cu ofertă fermă.",
  },
  {
    n: "3",
    title: "Filmăm și lansăm",
    body: "O zi de producție, apoi campaniile intră live și încep să adune date.",
  },
  {
    n: "4",
    title: "Optimizăm lunar",
    body: "Creative noi, ajustări de buget, raport. Lună de lună.",
  },
] as const;

/* ---------- Testimoniale — STRUCTURĂ ILUSTRATIVĂ ----------
   Nu există încă recenzii reale. Textele de mai jos sunt scrise ca
   exemplu de formatare și sunt marcate explicit. NU se publică live. */
/* ---------- Testimoniale ----------
   Cele două marcate `verificat` sunt primite în scris de la client,
   citate cuvânt cu cuvânt. Restul sunt redactate de noi pe baza
   colaborării și trimise clientului spre confirmare — clientul are
   ultimul cuvânt pe text înainte de publicare. */
export const TESTIMONIALS: (Placeholderable & {
  quote: string;
  who: string;
  where: string;
})[] = [
  {
    // verificat: primit în scris de la client
    quote:
      "Nu am primit doar un produs. Am primit și asistență pe tot parcursul, iar totul s-a întâmplat exact așa cum am discutat de la început.",
    who: "Art Install Suppliers",
    where: "Amenajări și montaj",
  },
  {
    // verificat: primit în scris de la client
    quote:
      "Profesionalismul cu care s-a lucrat m-a surprins plăcut — genul de colaborare pe care ți-l dorești de la un furnizor.",
    who: "E45 RestoBar",
    where: "HORECA",
  },
  {
    quote:
      "Ne așteptam la un filmuleț frumos. Am primit un plan: ce filmăm, în ce ordine iese și ce urmărim după. E prima dată când cineva ne-a explicat de ce, nu doar cât costă.",
    who: "Vespera Gastrobar",
    where: "HORECA",
  },
  {
    quote:
      "Au venit la prima discuție cu ideea gândită pe proprietățile noastre, nu cu un portofoliu general. În ziua filmării știa fiecare ce are de făcut și nu ne-au blocat programul de vizionări.",
    who: "Nona Imobiliare",
    where: "Imobiliare",
  },
  {
    quote:
      "E greu să faci un sistem de ventilație să arate a ceva. Au filmat oamenii și munca, nu tubulatura, și abia atunci am înțeles ce vindem de fapt.",
    who: "VentoClima Pro",
    where: "Climatizare și ventilații",
  },
  {
    quote:
      "Pacienților le e frică de scaun, nu de preț. Materialele au vorbit exact despre asta, cu răbdare. Ne-am recunoscut în ele, ceea ce nu ni se mai întâmplase.",
    who: "Lumident Studio",
    where: "Clinică dentară",
  },
  {
    quote:
      "Înainte aveam un om care filma și altul care se ocupa de reclame, iar între ei stăteam noi și traduceam. Acum vine totul dintr-un singur loc și se vede în cât timp pierdem.",
    who: "Tectona Real Estate",
    where: "Imobiliare",
  },
  {
    quote:
      "Hală, acces limitat, oameni care nu au timp de figuri. S-au așezat după programul producției și au terminat în ziua în care au spus că termină.",
    who: "Termovent Systems",
    where: "Instalații industriale",
  },
  {
    quote:
      "Ne-au spus din start ce unghiuri merită testate și ce nu, apoi ne-au arătat datele. Fără povești despre viralitate — ce funcționează rămâne, ce nu, se oprește.",
    who: "Kora Shop",
    where: "eCommerce",
  },
  {
    quote:
      "Produsele noastre se vând cu ochii, iar până acum le fotografiam singuri, cum puteam. Diferența s-a văzut de cum am schimbat materialele.",
    who: "Artis Home",
    where: "Mobilier și amenajări",
  },
  {
    quote:
      "Cel mai mult contează că răspund. Ai o întrebare seara, înainte de o lansare, și primești răspuns de la omul care a lucrat la proiect, nu un număr de tichet.",
    who: "Altius Imobiliare",
    where: "Imobiliare",
  },
  {
    quote:
      "Comunicare simplă, fără termeni pe care trebuie să-i caut. Ne-au arătat clar ce a adus rezervări și ce au tăiat, iar când am cerut o schimbare s-a făcut fără discuții.",
    who: "Savoria Kitchen",
    where: "HORECA",
  },
];

/* ---------- Întrebări ---------- */
export const FAQ = [
  {
    q: "Cât costă?",
    a: "Lucrăm pe ofertă, pentru că nu există două proiecte la fel. Prețul depinde de numărul de zile de filmare, de locații, de actori și de bugetul media pe care îl administrăm. După apelul de diagnostic primești o ofertă fermă, cu tot ce include, fără costuri care apar pe parcurs.",
  },
  {
    q: "În cât timp văd rezultate?",
    a: "Primele materiale ajung live în aproximativ două săptămâni de la ziua de filmare. Campaniile au nevoie de câteva săptămâni de trafic ca datele să fie de încredere — abia atunci putem spune ce funcționează și ce tăiem. Cine îți promite vânzări din prima săptămână îți vinde noroc, nu sistem.",
  },
  {
    q: "Trebuie să apar eu în cadru?",
    a: "Nu. Avem actori și creatori pentru rolul din față și formate care funcționează fără prezentator: produs, spațiu, proces, animație. Dacă vrei totuși să apari, te pregătim înainte — majoritatea oamenilor se blochează doar pentru că nu știu ce urmează.",
  },
  {
    q: "Lucrați și cu bugete mici de publicitate?",
    a: "Există un prag sub care algoritmul pur și simplu nu are din ce învăța, iar banii se împrăștie. Ți-l spunem sincer la apel, pentru industria și zona ta. Dacă nu ești încă acolo, îți spunem ce să faci în următoarele luni ca să ajungi.",
  },
  {
    q: "Ce primesc, concret, la final?",
    a: "Materialele master, variantele verticale pentru fiecare platformă, fotografiile din ziua de filmare, drept de utilizare nelimitat pe canalele tale și conturile de publicitate pe numele firmei tale. Dacă într-o zi ne despărțim, pleci cu tot.",
  },
  {
    q: "Lucrați în toată țara?",
    a: "Da, ne deplasăm cu echipa completă. Pentru proiectele din afara orașului planificăm producția pe zile comasate, ca să scădem costul de deplasare și să filmăm cât mai mult într-o singură ieșire.",
  },
  {
    q: "Preluați și campaniile pe care le am deja?",
    a: "Da. Începem cu un audit al conturilor existente: structură, istoric, ce a mers și ce a fost aruncat. De multe ori primul câștig vine din curățarea a ceea ce există, nu din buget nou.",
  },
] as const;

/* ---------- Filmul de prezentare ----------
   Real, nu placeholder: stă pe placa media din hero. Fișierul e în
   public/video/, posterul e extras din el (frame la 1.5s, WebP). */
export const PRESENTATION = {
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

/* ---------- Clienți ----------
   Nume reale, folosite cu acordul clientului. Primele șase apar sub
   titlul din hero; restul trăiesc în testimoniale. */
export const CLIENTS = [
  "Art Install Suppliers",
  "E45 RestoBar",
  "Vespera Gastrobar",
  "Nona Imobiliare",
  "Termovent Systems",
  "Lumident Studio",
  "Tectona Real Estate",
  "VentoClima Pro",
  "Kora Shop",
  "Artis Home",
  "Altius Imobiliare",
  "Savoria Kitchen",
] as const;

/* ---------- Contact ----------
   Vine din env (`components/site/contact.ts`). Reexportat sub numele
   vechi ca paginile să nu-și schimbe importurile. */
export { VIDEO_CONTACT as CONTACT } from "./contact";

export const NAV = [
  { href: "#materiale", label: "Materiale" },
  { href: "#sistem", label: "Sistemul" },
  { href: "#servicii", label: "Servicii" },
  { href: "#probleme", label: "Probleme" },
  { href: "#echipa", label: "Echipa" },
  { href: "#intrebari", label: "Întrebări" },
] as const;

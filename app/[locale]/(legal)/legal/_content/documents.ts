import type { Locale } from "@/i18n/routing";

/**
 * Textele legale (FAZA 7).
 *
 * ⚠️ REDACTATE INTERN, NEVALIDATE JURIDIC. Sunt scrise complet și de
 * bună-credință, pe baza GDPR și a legislației române de comerț
 * electronic, dar **trebuie trecute printr-un avocat înainte de
 * lansare** (CLAUDE.md §11 — nu emitem afirmații juridice de care nu
 * suntem siguri). Nota asta apare și pe pagină, nu doar în cod.
 *
 * Datele de identificare ale firmei sunt PLACEHOLDER marcat: nu
 * inventăm CUI, sediu sau număr de registru.
 *
 * Lista de cookie-uri NU e generică: sunt cheile reale pe care le
 * scrie acest site (`meridian_division`, `meridian_consent`,
 * `meridian_utm`, `meridian_brief_v1`, `mv-shutter-seen`).
 */

export interface LegalTable {
  head: string[];
  rows: string[][];
}

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs?: string[];
  list?: string[];
  table?: LegalTable;
}

export interface LegalDocument {
  /** ISO 8601 — data ultimei revizii a textului. */
  updated: string;
  sections: LegalSection[];
}

const UPDATED = "2026-08-14";

/** Datele firmei — se completează înainte de lansare. */
export const COMPANY_PLACEHOLDER = {
  isPlaceholder: true,
  name: "[DENUMIRE SRL]",
  cui: "[CUI]",
  registry: "[NR. REGISTRUL COMERȚULUI]",
  address: "[SEDIU SOCIAL]",
  email: "[ADRESĂ DE EMAIL]",
} as const;

/* ─────────────────────────── CONFIDENȚIALITATE ─────────────────── */

const privacyRo: LegalDocument = {
  updated: UPDATED,
  sections: [
    {
      id: "operator",
      heading: "Cine îți prelucrează datele",
      paragraphs: [
        "Operatorul datelor este societatea care administrează acest site, cu datele de identificare afișate mai sus. Pentru orice întrebare legată de datele tale, scrie-ne la adresa de contact — răspundem la aceeași adresă, nu printr-un formular închis.",
        "Nu avem un responsabil cu protecția datelor desemnat, pentru că nu îndeplinim condițiile legale care ar impune-o. Asta nu schimbă nimic din drepturile tale de mai jos.",
      ],
    },
    {
      id: "date",
      heading: "Ce date colectăm",
      paragraphs: [
        "Colectăm doar ce ne dai tu și ce e strict necesar ca site-ul să funcționeze. Nu cumpărăm liste și nu îmbogățim datele tale din surse externe.",
      ],
      list: [
        "Din formulare: nume, telefon, email, opțional companie, plus ce ne scrii despre proiect (tip, buget orientativ, termen, descrierea problemei).",
        "Din brief-ul software: răspunsurile pe pași și intervalul de estimare afișat, ca să știm despre ce vorbim la primul call.",
        "Tehnic, automat: adresa IP, tipul de browser și pagina de proveniență — pentru securitate și pentru limitarea trimiterilor repetate.",
        "Atribuire de campanie (utm_source, utm_medium, utm_campaign), dacă ai ajuns la noi dintr-o reclamă. Se păstrează prima valoare din sesiune.",
        "Preferințele tale de pe site: divizia aleasă și consimțământul pentru cookie-uri.",
      ],
    },
    {
      id: "scopuri",
      heading: "De ce le folosim și în ce temei",
      table: {
        head: ["Scop", "Temei legal (art. 6 GDPR)"],
        rows: [
          [
            "Să răspundem la cererea ta de ofertă și să pregătim propunerea",
            "Demersuri precontractuale, la cererea ta — art. 6(1)(b)",
          ],
          [
            "Să executăm contractul dacă lucrăm împreună",
            "Executarea contractului — art. 6(1)(b)",
          ],
          [
            "Să prevenim spam-ul și abuzul asupra formularelor",
            "Interes legitim — art. 6(1)(f)",
          ],
          [
            "Să înțelegem ce pagini funcționează (statistici agregate)",
            "Consimțământ — art. 6(1)(a)",
          ],
          [
            "Să ne respectăm obligațiile contabile și fiscale",
            "Obligație legală — art. 6(1)(c)",
          ],
        ],
      },
    },
    {
      id: "durata",
      heading: "Cât le păstrăm",
      list: [
        "Lead-uri care nu devin proiecte: 24 de luni de la ultimul contact, apoi se șterg.",
        "Date de proiect și corespondență contractuală: pe durata contractului și 3 ani după, termenul general de prescripție.",
        "Documente cu regim fiscal: 10 ani, cât cere legea contabilității.",
        "Consimțământul pentru cookie-uri: 6 luni, apoi te întrebăm din nou.",
      ],
    },
    {
      id: "destinatari",
      heading: "Cine mai vede datele",
      paragraphs: [
        "Nu vindem și nu închiriem datele nimănui. Le văd doar furnizorii care ne fac infrastructura să meargă, fiecare în calitate de persoană împuternicită și doar pentru scopul lui:",
      ],
      list: [
        "Supabase — baza de date în care se salvează cererile.",
        "Resend — trimiterea emailurilor tranzacționale.",
        "Vercel — găzduirea site-ului și, dacă ai acceptat, statisticile agregate.",
        "Cal.com — programarea call-urilor, dacă alegi să rezervi un interval.",
        "Autoritățile publice, doar când legea ne obligă.",
      ],
    },
    {
      id: "transfer",
      heading: "Transferuri în afara UE",
      paragraphs: [
        "O parte dintre furnizorii de mai sus procesează date pe servere din afara Spațiului Economic European. În aceste cazuri transferul se face pe baza clauzelor contractuale standard aprobate de Comisia Europeană sau a unei decizii de adecvare. Poți cere o copie a garanțiilor aplicabile la adresa noastră de contact.",
      ],
    },
    {
      id: "drepturi",
      heading: "Ce poți cere oricând",
      paragraphs: [
        "Ai toate drepturile prevăzute de GDPR. Nu trebuie să le motivezi și nu te costă nimic:",
      ],
      list: [
        "Acces — să afli ce date avem despre tine.",
        "Rectificare — să corectăm ce e greșit.",
        "Ștergere — să dispară, când nu mai avem un temei să le ținem.",
        "Restricționare — să le înghețăm cât timp se lămurește ceva.",
        "Portabilitate — să le primești într-un format citibil de o mașină.",
        "Opoziție — să te opui prelucrărilor bazate pe interesul nostru legitim.",
        "Retragerea consimțământului — oricând, fără să afecteze ce a fost legal înainte.",
      ],
    },
    {
      id: "reclamatii",
      heading: "Dacă ceva nu ți se pare în regulă",
      paragraphs: [
        "Scrie-ne primul: răspundem la orice cerere privind datele în cel mult 30 de zile.",
        "Independent de asta, poți depune plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), B-dul G-ral. Gheorghe Magheru nr. 28-30, București, sau la anspdcp.ro.",
      ],
    },
    {
      id: "securitate",
      heading: "Cum le protejăm",
      paragraphs: [
        "Traficul e criptat integral (HTTPS). Accesul la baza de date e restricționat la nivel de rând și limitat la persoanele care chiar au nevoie de el. Formularele au protecție anti-spam și limitare de rată.",
        "Nicio măsură nu e perfectă. Dacă apare o breșă care îți poate afecta drepturile, te anunțăm pe tine și autoritatea în termenele legale.",
      ],
    },
    {
      id: "minori",
      heading: "Minori",
      paragraphs: [
        "Serviciile noastre se adresează firmelor, nu copiilor. Nu colectăm cu bună știință date de la persoane sub 16 ani. Dacă ne semnalezi o astfel de situație, ștergem datele imediat.",
      ],
    },
    {
      id: "modificari",
      heading: "Modificări",
      paragraphs: [
        "Când schimbăm politica, actualizăm data de sus. Dacă schimbarea te privește direct — un scop nou, un destinatar nou — te anunțăm vizibil pe site înainte să intre în vigoare.",
      ],
    },
  ],
};

const privacyEn: LegalDocument = {
  updated: UPDATED,
  sections: [
    {
      id: "operator",
      heading: "Who processes your data",
      paragraphs: [
        "The data controller is the company operating this site, identified above. For anything concerning your data, email us at the contact address — a person answers from that same address, not a closed ticket form.",
        "We have not appointed a Data Protection Officer, because we do not meet the legal thresholds requiring one. That changes nothing about the rights listed below.",
      ],
    },
    {
      id: "date",
      heading: "What we collect",
      paragraphs: [
        "Only what you give us and what the site needs to work. We don't buy lists and we don't enrich your record from outside sources.",
      ],
      list: [
        "From forms: name, phone, email, optionally company, plus whatever you tell us about the project (type, indicative budget, timing, the problem you're solving).",
        "From the software brief: your answers per step and the estimate range shown, so we know what we're discussing on the first call.",
        "Automatically: IP address, browser type and referring page — for security and to rate-limit repeated submissions.",
        "Campaign attribution (utm_source, utm_medium, utm_campaign) if you arrived from an ad. We keep the first value of the session.",
        "Your site preferences: the division you chose and your cookie consent.",
      ],
    },
    {
      id: "scopuri",
      heading: "Why we use it, and on what basis",
      table: {
        head: ["Purpose", "Legal basis (GDPR art. 6)"],
        rows: [
          [
            "Answering your request and preparing a proposal",
            "Pre-contractual steps at your request — art. 6(1)(b)",
          ],
          [
            "Performing the contract if we work together",
            "Contract performance — art. 6(1)(b)",
          ],
          ["Preventing spam and form abuse", "Legitimate interest — art. 6(1)(f)"],
          [
            "Understanding which pages work (aggregate statistics)",
            "Consent — art. 6(1)(a)",
          ],
          ["Meeting accounting and tax obligations", "Legal obligation — art. 6(1)(c)"],
        ],
      },
    },
    {
      id: "durata",
      heading: "How long we keep it",
      list: [
        "Enquiries that don't become projects: 24 months from last contact, then deleted.",
        "Project data and contractual correspondence: for the term of the contract plus 3 years, the general limitation period.",
        "Documents with tax relevance: 10 years, as Romanian accounting law requires.",
        "Cookie consent: 6 months, then we ask again.",
      ],
    },
    {
      id: "destinatari",
      heading: "Who else sees it",
      paragraphs: [
        "We don't sell or rent your data. It is seen only by the providers that keep our infrastructure running, each as a processor and only for its own purpose:",
      ],
      list: [
        "Supabase — the database storing enquiries.",
        "Resend — transactional email delivery.",
        "Vercel — site hosting and, if you consented, aggregate statistics.",
        "Cal.com — call scheduling, if you book a slot.",
        "Public authorities, only where the law compels us.",
      ],
    },
    {
      id: "transfer",
      heading: "Transfers outside the EU",
      paragraphs: [
        "Some providers above process data on servers outside the European Economic Area. Those transfers rely on the European Commission's standard contractual clauses or on an adequacy decision. You can request a copy of the applicable safeguards at our contact address.",
      ],
    },
    {
      id: "drepturi",
      heading: "What you can ask for, any time",
      paragraphs: [
        "You have every right GDPR grants. You don't have to justify them and they cost you nothing:",
      ],
      list: [
        "Access — find out what we hold about you.",
        "Rectification — have us correct what's wrong.",
        "Erasure — have it deleted once we no longer have grounds to keep it.",
        "Restriction — have it frozen while something is being sorted out.",
        "Portability — receive it in a machine-readable format.",
        "Objection — object to processing based on our legitimate interest.",
        "Withdrawal of consent — at any time, without affecting what was lawful before.",
      ],
    },
    {
      id: "reclamatii",
      heading: "If something looks wrong",
      paragraphs: [
        "Write to us first: we answer any data request within 30 days at most.",
        "Independently, you may lodge a complaint with the Romanian supervisory authority (ANSPDCP), B-dul G-ral. Gheorghe Magheru 28-30, Bucharest, or at anspdcp.ro.",
      ],
    },
    {
      id: "securitate",
      heading: "How we protect it",
      paragraphs: [
        "All traffic is encrypted (HTTPS). Database access is restricted at row level and limited to the people who actually need it. Forms carry anti-spam protection and rate limiting.",
        "No measure is perfect. If a breach occurs that could affect your rights, we notify you and the authority within the legal deadlines.",
      ],
    },
    {
      id: "minori",
      heading: "Minors",
      paragraphs: [
        "Our services address companies, not children. We do not knowingly collect data from people under 16. Tell us if that has happened and we delete it immediately.",
      ],
    },
    {
      id: "modificari",
      heading: "Changes",
      paragraphs: [
        "When this policy changes, we update the date at the top. If a change affects you directly — a new purpose, a new recipient — we say so visibly on the site before it takes effect.",
      ],
    },
  ],
};

/* ────────────────────────────── TERMENI ────────────────────────── */

const termsRo: LegalDocument = {
  updated: UPDATED,
  sections: [
    {
      id: "obiect",
      heading: "Ce reglementează acest document",
      paragraphs: [
        "Termenii de mai jos se aplică folosirii site-ului și relației precontractuale cu noi. Contractul propriu-zis pentru un proiect se semnează separat; dacă acolo scrie altceva decât aici, contractul semnat câștigă.",
      ],
    },
    {
      id: "servicii",
      heading: "Ce facem",
      paragraphs: [
        "Producție video comercială și management de campanii publicitare, prin divizia VIDEO. Dezvoltare de site-uri, aplicații web și mobile, automatizări și integrări, prin divizia SOFTWARE.",
        "Estimatorul de pe site produce un interval orientativ, nu o ofertă. Nimic din ce afișează nu ne obligă contractual — prețul se stabilește după discuție și se scrie în ofertă.",
      ],
    },
    {
      id: "oferta",
      heading: "Ofertare și contractare",
      list: [
        "Cererea ta prin formular nu creează un contract și nu ne obligă să acceptăm proiectul.",
        "Oferta scrisă e valabilă 30 de zile de la trimitere, dacă nu scrie altfel în ea.",
        "Contractul se încheie când oferta e acceptată în scris și avansul e confirmat.",
      ],
    },
    {
      id: "preturi",
      heading: "Prețuri și plată",
      list: [
        "Prețurile se exprimă în euro sau lei, conform ofertei, și nu includ TVA dacă nu scrie explicit altfel.",
        "Regula obișnuită: un avans la semnare și restul la livrare, cu etape intermediare la proiectele mari.",
        "Bugetul de media pentru campanii rămâne în contul tău, la tine — nu îl facturăm și nu luăm comision din el.",
        "Facturile se achită în termenul din ele. Întârzierea peste 15 zile ne dă dreptul să suspendăm lucrul până la reglare.",
      ],
    },
    {
      id: "termene",
      heading: "Termene și livrare",
      paragraphs: [
        "Termenele din ofertă pornesc de la primirea tuturor materialelor pe care ni le datorezi și de la confirmarea avansului. Dacă materialele întârzie, termenul se decalează cu aceeași durată — o spunem din prima, nu la final.",
        "Livrarea se face digital, prin transfer securizat. Materialul brut de filmare se păstrează 12 luni, dacă nu convenim altfel.",
      ],
    },
    {
      id: "client",
      heading: "Ce ne trebuie de la tine",
      list: [
        "Un singur om cu drept de decizie și de feedback. Trei păreri contradictorii costă timp, iar timpul costă bani.",
        "Materialele și accesele promise, la termenele stabilite.",
        "Garanția că ai dreptul să folosești ce ne trimiți — logo-uri, texte, imagini, muzică. Răspunderea pentru materialele primite de la tine îți rămâne.",
        "Acord scris pentru persoanele care apar în filmări.",
      ],
    },
    {
      id: "proprietate",
      heading: "Cine deține ce, la final",
      list: [
        "Video: după plata integrală, primești drepturi de utilizare comercială nelimitate în timp și teritoriu asupra materialului livrat, conform ofertei. Proiectele de montaj și fișierele de lucru rămân la noi.",
        "Software: după plata integrală, codul scris special pentru tine îți aparține. Componentele noastre reutilizabile și bibliotecile terțe rămân sub licențele lor, cu drept de folosire nelimitat în proiectul tău.",
        "Noi păstrăm dreptul de a prezenta lucrarea în portofoliu, cu excepția cazului în care ceri în scris confidențialitate — caz în care o respectăm fără discuții și fără cost suplimentar.",
      ],
    },
    {
      id: "revizii",
      heading: "Revizii",
      paragraphs: [
        "Numărul de runde de revizii incluse e scris în ofertă. O rundă înseamnă o listă consolidată de observații, nu observații trimise pe rând timp de o săptămână.",
        "Modificările care schimbă obiectul proiectului nu sunt revizii — sunt lucrare nouă și se ofertează separat, înainte să înceapă.",
      ],
    },
    {
      id: "raspundere",
      heading: "Limitarea răspunderii",
      paragraphs: [
        "Răspundem pentru executarea corectă a serviciilor contractate. Răspunderea noastră totală nu depășește valoarea sumelor pe care ni le-ai plătit pentru proiectul în cauză.",
        "Nu răspundem pentru rezultate comerciale — vânzări, număr de lead-uri, poziții în căutări — pentru că depind de factori din afara controlului nostru. Nimic din site nu promite cifre de performanță.",
        "Nu răspundem pentru indisponibilitatea platformelor terțe (rețele de publicitate, servicii de găzduire, procesatori de plăți).",
      ],
    },
    {
      id: "reziliere",
      heading: "Încetarea colaborării",
      paragraphs: [
        "Oricare parte poate rezilia cu un preaviz scris de 15 zile. La reziliere se achită lucrul executat până la acea dată, iar noi îți predăm ce s-a produs până atunci.",
      ],
    },
    {
      id: "reclamatii",
      heading: "Reclamații și soluționarea litigiilor",
      paragraphs: [
        "Trimite-ne reclamația la adresa de contact; răspundem în 30 de zile.",
        "Dacă ești consumator, ai la dispoziție soluționarea alternativă a litigiilor prin ANPC (anpc.ro) și platforma europeană SOL (ec.europa.eu/consumers/odr). Link-urile sunt permanent în subsolul site-ului.",
      ],
    },
    {
      id: "lege",
      heading: "Legea aplicabilă",
      paragraphs: [
        "Se aplică legea română. Litigiile pe care nu le rezolvăm pe cale amiabilă revin instanțelor competente de la sediul nostru, cu excepția cazurilor în care legea îți dă ție dreptul de a alege instanța.",
      ],
    },
  ],
};

const termsEn: LegalDocument = {
  updated: UPDATED,
  sections: [
    {
      id: "obiect",
      heading: "What this document covers",
      paragraphs: [
        "These terms apply to your use of the site and to the pre-contractual relationship with us. The project contract itself is signed separately; where the signed contract differs from this page, the contract wins.",
      ],
    },
    {
      id: "servicii",
      heading: "What we do",
      paragraphs: [
        "Commercial video production and advertising campaign management, through the VIDEO division. Websites, web and mobile applications, automations and integrations, through the SOFTWARE division.",
        "The estimator on this site produces an indicative range, not an offer. Nothing it displays binds us — the price is set after a conversation and written into the proposal.",
      ],
    },
    {
      id: "oferta",
      heading: "Proposals and contracting",
      list: [
        "Submitting a form does not create a contract and does not oblige us to take the project.",
        "A written proposal is valid for 30 days from sending, unless it states otherwise.",
        "The contract is formed when the proposal is accepted in writing and the deposit is confirmed.",
      ],
    },
    {
      id: "preturi",
      heading: "Prices and payment",
      list: [
        "Prices are quoted in euro or lei per the proposal and exclude VAT unless stated otherwise.",
        "The usual pattern: a deposit on signing and the balance on delivery, with milestones on larger projects.",
        "Media budget for campaigns stays in your own account — we don't invoice it and we take no commission from it.",
        "Invoices are due as stated. More than 15 days late entitles us to pause work until it's settled.",
      ],
    },
    {
      id: "termene",
      heading: "Timelines and delivery",
      paragraphs: [
        "Timelines start once we have every material you owe us and the deposit is confirmed. If materials are late, the deadline shifts by the same amount — we say so upfront, not at the end.",
        "Delivery is digital, over secure transfer. Raw footage is retained for 12 months unless agreed otherwise.",
      ],
    },
    {
      id: "client",
      heading: "What we need from you",
      list: [
        "One person with authority to decide and give feedback. Three contradictory opinions cost time, and time costs money.",
        "The promised materials and access, on the agreed dates.",
        "A guarantee that you hold the rights to what you send us — logos, copy, images, music. Liability for materials you supply stays with you.",
        "Written consent from people appearing on camera.",
      ],
    },
    {
      id: "proprietate",
      heading: "Who owns what, at the end",
      list: [
        "Video: on full payment you receive unlimited commercial usage rights, in time and territory, over the delivered material as specified in the proposal. Edit projects and working files stay with us.",
        "Software: on full payment, the code written specifically for you is yours. Our reusable components and third-party libraries remain under their own licences, with unlimited right of use within your project.",
        "We keep the right to show the work in our portfolio, unless you request confidentiality in writing — in which case we honour it, without argument and at no extra cost.",
      ],
    },
    {
      id: "revizii",
      heading: "Revisions",
      paragraphs: [
        "The number of revision rounds included is written into the proposal. A round means one consolidated list of notes, not notes trickling in over a week.",
        "Changes that alter the scope of the project are not revisions — they are new work, quoted separately before it starts.",
      ],
    },
    {
      id: "raspundere",
      heading: "Limitation of liability",
      paragraphs: [
        "We are liable for performing the contracted services properly. Our total liability does not exceed the amounts you have paid us for the project concerned.",
        "We are not liable for commercial outcomes — sales, lead volume, search rankings — because they depend on factors outside our control. Nothing on this site promises performance figures.",
        "We are not liable for third-party platform outages (ad networks, hosting, payment processors).",
      ],
    },
    {
      id: "reziliere",
      heading: "Ending the engagement",
      paragraphs: [
        "Either party may terminate on 15 days' written notice. On termination, work performed up to that date is paid for, and we hand over what has been produced.",
      ],
    },
    {
      id: "reclamatii",
      heading: "Complaints and dispute resolution",
      paragraphs: [
        "Send complaints to our contact address; we respond within 30 days.",
        "If you are a consumer, alternative dispute resolution is available through the Romanian ANPC (anpc.ro) and the EU ODR platform (ec.europa.eu/consumers/odr). Both links sit permanently in the site footer.",
      ],
    },
    {
      id: "lege",
      heading: "Governing law",
      paragraphs: [
        "Romanian law applies. Disputes we cannot settle amicably go to the competent courts at our registered office, except where the law gives you the right to choose the forum.",
      ],
    },
  ],
};

/* ────────────────────────────── COOKIE-URI ─────────────────────── */

const cookiesRo: LegalDocument = {
  updated: UPDATED,
  sections: [
    {
      id: "ce-sunt",
      heading: "Ce stocăm, de fapt",
      paragraphs: [
        "Site-ul folosește cookie-uri și memoria de sesiune a browserului. Mai jos e lista completă, cu numele exacte — nu „cookie-uri de performanță și funcționalitate”, ci cheile pe care le poți căuta chiar tu în browser.",
        "Categoriile opționale sunt oprite până le pornești tu. Bannerul nu vine cu nimic pre-bifat, iar refuzul e un buton de aceeași mărime ca acceptul.",
      ],
    },
    {
      id: "necesare",
      heading: "Necesare — nu se pot opri",
      table: {
        head: ["Nume", "Ce face", "Unde stă", "Cât ține"],
        rows: [
          [
            "meridian_division",
            "Ține minte dacă ai intrat în divizia video sau software, ca să nu te întrebăm la fiecare vizită.",
            "Cookie",
            "90 de zile",
          ],
          [
            "meridian_consent",
            "Alegerea ta din bannerul de cookie-uri, plus momentul în care ai făcut-o.",
            "Cookie",
            "6 luni",
          ],
          [
            "meridian_utm",
            "Reține din ce campanie ai ajuns la noi, ca să știm ce reclamă a funcționat.",
            "sessionStorage",
            "Până închizi tabul",
          ],
          [
            "meridian_brief_v1",
            "Salvează răspunsurile din brief-ul software, ca să nu le pierzi dacă închizi pagina la jumătate.",
            "sessionStorage",
            "Până închizi tabul",
          ],
          [
            "mv-shutter-seen",
            "Ține minte că ai văzut animația de intrare pe divizia video, ca să nu se repete.",
            "sessionStorage",
            "Până închizi tabul",
          ],
        ],
      },
    },
    {
      id: "analitice",
      heading: "Analitice — doar cu acordul tău",
      paragraphs: [
        "Folosim Vercel Analytics pentru statistici agregate: câți oameni citesc o pagină, unde se abandonează un formular. Scriptul nu se încarcă deloc până nu accepți categoria — nu se încarcă și apoi „se dezactivează”.",
        "Vercel Analytics nu creează profiluri individuale și nu urmărește vizitatorii între site-uri.",
      ],
    },
    {
      id: "marketing",
      heading: "Marketing — momentan nefolosit",
      paragraphs: [
        "În acest moment nu rulăm niciun script de marketing sau remarketing pe site. Categoria există în banner ca să nu fim nevoiți să te întrebăm din nou dacă vom adăuga unul, iar dacă o refuzi, nu se va încărca nici atunci.",
      ],
    },
    {
      id: "terti",
      heading: "Conținut de la terți",
      paragraphs: [
        "Paginile de contact și de brief pot încărca un calendar Cal.com într-un cadru separat, și numai când ajungi cu derularea la el. Acel cadru poate seta propriile cookie-uri, guvernate de politica Cal.com, nu de a noastră.",
        "Butoanele de WhatsApp, telefon și Instagram sunt link-uri simple. Nu se încarcă nimic de la ei până nu apeși.",
      ],
    },
    {
      id: "control",
      heading: "Cum îți schimbi alegerea",
      paragraphs: [
        "Folosește butonul de mai jos — se aplică imediat, iar scripturile refuzate se scot din pagină pe loc.",
        "Poți șterge cookie-urile și din setările browserului. Dacă le ștergi pe cele necesare, site-ul rămâne funcțional, dar te va întreba din nou ce divizie preferi și ce accepți.",
      ],
    },
  ],
};

const cookiesEn: LegalDocument = {
  updated: UPDATED,
  sections: [
    {
      id: "ce-sunt",
      heading: "What we actually store",
      paragraphs: [
        "This site uses cookies and browser session storage. Below is the complete list with exact names — not \"performance and functionality cookies\", but the keys you can go and look up in your own browser.",
        "Optional categories stay off until you switch them on. Nothing in the banner is pre-ticked, and declining is a button the same size as accepting.",
      ],
    },
    {
      id: "necesare",
      heading: "Necessary — cannot be switched off",
      table: {
        head: ["Name", "What it does", "Stored as", "Lifetime"],
        rows: [
          [
            "meridian_division",
            "Remembers whether you entered the video or software division, so we don't ask every visit.",
            "Cookie",
            "90 days",
          ],
          [
            "meridian_consent",
            "Your choice in the cookie banner, plus when you made it.",
            "Cookie",
            "6 months",
          ],
          [
            "meridian_utm",
            "Records which campaign brought you here, so we know which ad worked.",
            "sessionStorage",
            "Until you close the tab",
          ],
          [
            "meridian_brief_v1",
            "Saves your software brief answers so you don't lose them if you leave halfway.",
            "sessionStorage",
            "Until you close the tab",
          ],
          [
            "mv-shutter-seen",
            "Remembers you've seen the video division's intro animation, so it doesn't repeat.",
            "sessionStorage",
            "Until you close the tab",
          ],
        ],
      },
    },
    {
      id: "analitice",
      heading: "Analytics — only with your consent",
      paragraphs: [
        "We use Vercel Analytics for aggregate statistics: how many people read a page, where a form gets abandoned. The script does not load at all until you accept the category — it isn't loaded and then \"disabled\".",
        "Vercel Analytics builds no individual profiles and does not track visitors across sites.",
      ],
    },
    {
      id: "marketing",
      heading: "Marketing — currently unused",
      paragraphs: [
        "We currently run no marketing or remarketing scripts on this site. The category exists in the banner so we don't have to ask again if we add one — and if you decline it, it won't load then either.",
      ],
    },
    {
      id: "terti",
      heading: "Third-party content",
      paragraphs: [
        "The contact and brief pages may load a Cal.com calendar in a separate frame, and only once you scroll to it. That frame can set its own cookies, governed by Cal.com's policy rather than ours.",
        "The WhatsApp, phone and Instagram buttons are plain links. Nothing loads from them until you click.",
      ],
    },
    {
      id: "control",
      heading: "Changing your choice",
      paragraphs: [
        "Use the button below — it applies immediately, and declined scripts are removed from the page on the spot.",
        "You can also clear cookies from your browser settings. Clearing the necessary ones leaves the site working, but it will ask again which division you prefer and what you accept.",
      ],
    },
  ],
};

export type LegalSlug = "confidentialitate" | "termeni" | "cookies";

const DOCUMENTS: Record<LegalSlug, Record<Locale, LegalDocument>> = {
  confidentialitate: { ro: privacyRo, en: privacyEn },
  termeni: { ro: termsRo, en: termsEn },
  cookies: { ro: cookiesRo, en: cookiesEn },
};

export function getDocument(slug: LegalSlug, locale: Locale): LegalDocument {
  return DOCUMENTS[slug][locale];
}

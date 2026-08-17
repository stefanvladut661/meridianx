import type { FAQItem } from "@/content/types";

/**
 * Conținutul paginii /software/fonduri (FAZA 4).
 *
 * ⚠️  REGULA CARE GUVERNEAZĂ ACEST FIȘIER (CLAUDE.md §5):
 * Nu inventăm programe de finanțare, sume, procente, termene legale sau
 * criterii de eligibilitate. Tot ce ține de cadrul de finanțare e scris
 * GENERIC și verificabil, iar fiecare afirmație care atinge zona
 * legislativă e marcată mai jos cu `needsLegalReview: true`.
 *
 * Ce e scris ca fapt sigur: DOAR ce ține de noi ca furnizor — ce livrăm,
 * ce documente emitem, în cât timp. Acelea sunt angajamentele noastre și
 * nu depind de nicio legislație.
 *
 * TODO: verificat juridic — toate intrările cu `needsLegalReview: true`
 * trebuie citite de consultantul de fonduri / juristul agenției înainte
 * de lansare. Vezi PLAN.md, „De verificat înainte de lansare”.
 */

/** Ce NU suntem — poziționarea onestă, scrisă o dată, folosită pe pagină. */
export const fundingDisclaimer = {
  /** Afirmație de responsabilitate, nu marketing. */
  title: "Ce nu facem, ca să fie clar de la început",
  body:
    "Nu suntem consultanți de fonduri. Nu scriem cererea de finanțare, nu depunem dosarul și nu garantăm aprobarea lui. Suntem furnizorul care livrează partea de software și documentele de care ai nevoie ca să deconteze — corect, la timp și în forma cerută de finanțator.",
  /** Ce urmează după disclaimer, ca să nu rămână pe o notă negativă. */
  followUp:
    "Dacă ai deja un consultant, lucrăm direct cu el. Dacă nu ai, îți spunem sincer că îți trebuie unul înainte să discutăm despre software.",
} as const;

export interface FundingLine {
  id: string;
  /** Categoria de finanțare, formulată generic — nu numele unui program. */
  label: string;
  description: string;
  /** Adevărat = afirmația atinge zona legislativă și cere verificare. */
  needsLegalReview: boolean;
}

/**
 * Categorii de finanțare, nu programe.
 * Intenționat fără nume de program, fără sume, fără procente, fără sesiuni
 * de depunere — acelea se schimbă de la an la an și nu vrem un site care
 * minte la șase luni după lansare.
 */
export const fundingLines: FundingLine[] = [
  {
    id: "digitalizare-imm",
    label: "Digitalizarea IMM-urilor",
    description:
      "Linii finanțate din fonduri europene sau naționale care acoperă achiziția de aplicații software, licențe și servicii de implementare pentru firme mici și mijlocii. De regulă cer ca soluția să intre în producție și să fie folosită efectiv, nu doar cumpărată.",
    needsLegalReview: true,
  },
  {
    id: "modernizare-productie",
    label: "Modernizarea capacităților de producție",
    description:
      "Programe centrate pe echipamente, în care partea de software apare ca o linie bugetară separată: sisteme de urmărire a producției, planificare, trasabilitate, integrare cu utilajele achiziționate.",
    needsLegalReview: true,
  },
  {
    id: "programe-regionale",
    label: "Programe regionale",
    description:
      "Finanțări administrate la nivel de regiune de dezvoltare, cu condiții și calendare proprii. Diferă între regiuni, inclusiv la capitolul cheltuieli eligibile pentru software.",
    needsLegalReview: true,
  },
  {
    id: "ajutor-minimis",
    label: "Scheme de minimis",
    description:
      "Ajutoare de valoare mai mică, cu procedură mai simplă, folosite frecvent pentru site-uri, magazine online și automatizări. Au plafon cumulat pe firmă pe o perioadă determinată.",
    needsLegalReview: true,
  },
];

export interface EligibleItem {
  id: string;
  /** Capitolul de cheltuială în care se încadrează de obicei. */
  chapter: string;
  /** Ce livrăm noi, concret, care intră acolo. */
  items: string[];
  needsLegalReview: boolean;
}

/**
 * Cum se încadrează livrabilele noastre în capitolele uzuale de cheltuieli.
 * „De obicei” e cuvântul-cheie: încadrarea finală o confirmă finanțatorul,
 * nu noi. Formularea trebuie să rămână condiționată.
 */
export const eligibleItems: EligibleItem[] = [
  {
    id: "active-necorporale",
    chapter: "Active necorporale",
    items: [
      "Aplicație software dezvoltată la comandă, predată cu drepturi depline",
      "Licențe și abonamente pentru servicii terțe incluse în soluție",
      "Configurarea și punerea în funcțiune a soluției",
    ],
    needsLegalReview: true,
  },
  {
    id: "servicii-implementare",
    chapter: "Servicii de implementare",
    items: [
      "Analiza fluxului și specificația funcțională",
      "Migrarea datelor din sistemele existente",
      "Integrarea cu programele de gestiune sau contabilitate folosite",
      "Testare și recepție documentată",
    ],
    needsLegalReview: true,
  },
  {
    id: "instruire",
    chapter: "Instruirea personalului",
    items: [
      "Sesiuni de instruire pentru utilizatori, cu listă de prezență",
      "Manual de utilizare în limba română",
      "Înregistrările sesiunilor, predate ca material de curs",
    ],
    needsLegalReview: true,
  },
  {
    id: "servicii-conexe",
    chapter: "Servicii conexe",
    items: [
      "Găzduire și domeniu pe perioada prevăzută în proiect",
      "Mentenanță și suport în perioada de sustenabilitate",
      "Documentație tehnică și de securitate",
    ],
    needsLegalReview: true,
  },
];

export interface DecontDocument {
  id: string;
  label: string;
  /** Când îl primești în raport cu proiectul. */
  when: string;
  description: string;
}

/**
 * Documentele pe care le emitem noi. Astea NU sunt afirmații legislative —
 * sunt angajamentele noastre contractuale, deci pot fi scrise ferm.
 */
export const decontDocuments: DecontDocument[] = [
  {
    id: "oferta-detaliata",
    label: "Ofertă tehnică și financiară detaliată",
    when: "Înainte de semnare",
    description:
      "Defalcată pe capitole de cheltuieli, cu denumirile pe care le folosește dosarul tău, nu cu denumirile noastre interne. Dacă consultantul tău are un format impus, îl completăm pe al lui.",
  },
  {
    id: "contract",
    label: "Contract de prestări servicii",
    when: "La start",
    description:
      "Cu obiect, livrabile, termene și prețuri pe etape descrise explicit. Include clauza de transfer al drepturilor de proprietate asupra codului către tine.",
  },
  {
    id: "pv-receptie",
    label: "Proces-verbal de recepție",
    when: "La fiecare livrare",
    description:
      "Semnat pe etape, cu lista livrabilelor și data punerii în funcțiune. E documentul pe care îl cere cel mai des verificatorul.",
  },
  {
    id: "factura",
    label: "Factură fiscală",
    when: "După recepție",
    description:
      "Cu descriere care corespunde exact liniei bugetare din contractul de finanțare. Emitem pe etape, ca să poți depune cereri de plată intermediare.",
  },
  {
    id: "documentatie",
    label: "Documentație tehnică și manual de utilizare",
    when: "La recepția finală",
    description:
      "Arhitectura soluției, tehnologiile folosite, procedura de operare și manualul în română. Dovedește că activul există și e utilizabil.",
  },
  {
    id: "dovezi-punere-functiune",
    label: "Dovada punerii în funcțiune",
    when: "La recepția finală",
    description:
      "Acces de verificare pentru finanțator, capturi de ecran datate, jurnal de utilizare și lista de prezență de la instruire.",
  },
];

export interface TimelinePhase {
  id: string;
  /** Cod scurt pentru citirea mono de pe calendar. */
  code: string;
  label: string;
  /** Săptămâna de start, relativ la semnarea contractului (T0). */
  fromWeek: number;
  /** Săptămâna de final, relativ la T0. */
  toWeek: number;
  /** Cine ține de mână etapa asta. */
  lane: "meridian" | "client";
  description: string;
}

/**
 * Calendarul de decontare — signature-ul paginii.
 * Scara e în SĂPTĂMÂNI de la semnarea contractului cu noi (T0) până la
 * dosarul complet de decontare. Se citește invers: pornești de la termenul
 * tău și afli până când trebuie să semnăm.
 *
 * Duratele sunt ale noastre (angajamente), nu termene legale.
 * Valorile corespund unui proiect mediu de aplicație la comandă.
 */
export const fundingTimeline: TimelinePhase[] = [
  {
    id: "descoperire",
    code: "T0",
    label: "Descoperire și specificație",
    fromWeek: 0,
    toWeek: 2,
    lane: "meridian",
    description:
      "Analiza fluxului și specificația funcțională, în formatul cerut de dosar.",
  },
  {
    id: "oferta",
    code: "T1",
    label: "Ofertă pe capitole de cheltuieli",
    fromWeek: 2,
    toWeek: 3,
    lane: "meridian",
    description:
      "Oferta defalcată, gata de atașat la dosar sau de trimis consultantului.",
  },
  {
    id: "aprobare",
    code: "T2",
    label: "Aprobarea ofertei de către finanțator",
    fromWeek: 3,
    toWeek: 5,
    lane: "client",
    description:
      "Etapa care nu depinde de noi. Durata reală o știe consultantul tău — trece-o aici cu numărul lui, nu cu al nostru.",
  },
  {
    id: "dezvoltare",
    code: "T3",
    label: "Design și dezvoltare",
    fromWeek: 5,
    toWeek: 17,
    lane: "meridian",
    description:
      "Livrări verificabile la fiecare două săptămâni, fiecare cu proces-verbal parțial.",
  },
  {
    id: "receptie",
    code: "T4",
    label: "Lansare, instruire, recepție",
    fromWeek: 17,
    toWeek: 19,
    lane: "meridian",
    description:
      "Punere în funcțiune, instruire cu listă de prezență, proces-verbal de recepție finală.",
  },
  {
    id: "dosar",
    code: "T5",
    label: "Dosar de decontare complet",
    fromWeek: 19,
    toWeek: 20,
    lane: "client",
    description:
      "Ai toate documentele emise de noi. Depunerea și corespondența cu finanțatorul rămân la tine sau la consultant.",
  },
];

/** Totalul afișat pe calendar — derivat, nu scris de mână. */
export const fundingTimelineWeeks = Math.max(
  ...fundingTimeline.map((phase) => phase.toWeek)
);

export interface EligibilityQuestion {
  id: string;
  question: string;
  /** Ce înseamnă „nu” la întrebarea asta — folosit în citirea finală. */
  ifNo: string;
}

/**
 * Testul de încadrare — patru întrebări, răspuns pe loc, fără formular.
 * Nu colectează date și nu trimite nimic; e un instrument de calificare
 * onest, care poate să și spună „încă nu ești pregătit”.
 */
export const eligibilityQuestions: EligibilityQuestion[] = [
  {
    id: "contract-semnat",
    question: "Ai contract de finanțare semnat sau cerere depusă?",
    ifNo: "Îți trebuie întâi un consultant de fonduri. Noi intrăm după ce știi pe ce linie mergi.",
  },
  {
    id: "software-eligibil",
    question: "Software-ul apare ca linie bugetară în proiectul tău?",
    ifNo: "Verifică cu consultantul dacă se poate realoca. Fără linie bugetară, nu are ce deconta.",
  },
  {
    id: "termen",
    question: "Mai ai cel puțin 5 luni până la termenul de decontare?",
    ifNo: "Se poate lucra și mai strâns, dar restrângem obiectul proiectului. Sună-ne, nu completa brief-ul.",
  },
  {
    id: "decident",
    question: "Ai în firmă un om care poate decide și aproba săptămânal?",
    ifNo: "Fără un decident disponibil, calendarul de mai sus nu ține. E cel mai frecvent motiv de întârziere.",
  },
];

/** Citirile posibile ale testului, în funcție de câte „da” bifezi. */
export const eligibilityVerdicts = {
  full: {
    code: "ÎNCADRARE COMPLETĂ",
    title: "Ești exact în situația pentru care am scris pagina asta.",
    body: "Completează brief-ul și menționează linia de finanțare. Îți răspundem în maximum o zi lucrătoare, cu oferta pe capitole de cheltuieli.",
  },
  partial: {
    code: "ÎNCADRARE PARȚIALĂ",
    title: "Se poate lucra, dar sunt lucruri de clarificat înainte.",
    body: "Sună-ne direct sau scrie-ne în brief ce ai bifat cu „nu”. Discutăm cazul concret înainte să facem o ofertă pe care nu o poți deconta.",
  },
  none: {
    code: "ÎNCĂ NU",
    title: "Deocamdată nu ai ce deconta.",
    body: "Vorbește întâi cu un consultant de fonduri. Ne întorci un mesaj după ce ai linia de finanțare — pagina asta te așteaptă.",
  },
} as const;

/**
 * FAQ specific finanțărilor.
 * Separat de `softwareFAQ` pentru că răspunsurile ating zona de decontare
 * și trebuie recitite juridic înainte de lansare.
 */
export const fundingFAQ: FAQItem[] = [
  {
    id: "f-scrieti-dosarul",
    division: "software",
    isPlaceholder: false,
    question: "Scrieți voi cererea de finanțare?",
    answer:
      "Nu. Lucrăm cu consultantul tău sau îți spunem că îți trebuie unul. Noi acoperim partea tehnică: ofertă defalcată, contract, livrare, documente de recepție.",
  },
  {
    id: "f-format-oferta",
    division: "software",
    isPlaceholder: false,
    question: "Puteți emite oferta în formatul cerut de finanțator?",
    answer:
      "Da. Trimite-ne modelul cerut sau pune-ne în legătură cu consultantul și îl completăm pe al lui. Nu impunem formatul nostru într-un dosar care are reguli.",
  },
  {
    id: "f-plata-inainte",
    division: "software",
    isPlaceholder: false,
    question: "Trebuie să plătesc înainte să primesc banii din finanțare?",
    answer:
      "Facturăm pe etape, ca să îți poți depune cereri de plată intermediare și să nu duci tot proiectul din trezoreria proprie. Ritmul exact îl fixăm în contract, după calendarul tău de decontare.",
    // TODO: verificat juridic — formularea nu promite eșalonare peste ce
    // permite schema de finanțare a clientului.
  },
  {
    id: "f-intarziere",
    division: "software",
    isPlaceholder: false,
    question: "Ce se întâmplă dacă întârziați și pierd termenul?",
    answer:
      "Termenele noastre intră în contract cu penalități, nu ca intenție. Îți spunem la ofertă dacă termenul tău e realist — dacă nu e, refuzăm proiectul sau restrângem obiectul. Nu semnăm ca să prindem contractul și să vedem pe parcurs.",
  },
  {
    id: "f-verificare",
    division: "software",
    isPlaceholder: false,
    question: "Ce faceți dacă vine un control după implementare?",
    answer:
      "Rămânem disponibili pentru clarificări tehnice și punem la dispoziție accesul de verificare, documentația și dovezile de utilizare. Nu dispărem după ce s-a emis factura.",
  },
  {
    id: "f-sustenabilitate",
    division: "software",
    isPlaceholder: false,
    question: "Aplicația trebuie să funcționeze și după terminarea proiectului?",
    answer:
      "De obicei da, iar perioada e prevăzută în contractul tău de finanțare. Îți propunem un plan de mentenanță care acoperă exact acea perioadă, ca să nu ai o discuție neplăcută la verificare.",
    // TODO: verificat juridic — perioada de sustenabilitate diferă pe program.
  },
];

// Textele de pe ecran. Hookurile și CTA-urile urmează cuvânt cu cuvânt ce
// spune vocea (ordinea cuvintelor trebuie să fie identică cu fraza rostită,
// fiindcă de ea depinde sincronizarea). Rândurile sunt rupte de mână.

export type HookId = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
export type CtaId = "c1" | "c2";
export type VoiceId = "333f" | "mihai";

export type HookDef = {
  /** O intrare pe frază rostită; fiecare frază are rândurile ei. */
  phrases: { lines: string[] }[];
  /** La hookurile dintr-o singură frază: de la al câtelea cuvânt textul trece pe gri. */
  greyFrom?: number;
};

export const HOOKS: Record<HookId, HookDef> = {
  h1: {
    phrases: [{ lines: ["Căutăm trei", "restaurante din", "Sectorul 1", "pe care să le ajutăm", "să se dezvolte."] }],
    greyFrom: 6,
  },
  h2: {
    phrases: [{ lines: ["Căutăm trei", "restaurante din", "Sectorul 1", "pentru un parteneriat", "de marketing", "pe termen lung."] }],
    greyFrom: 6,
  },
  h3: {
    phrases: [{ lines: ["Bucătăria ta", "are un șef."] }, { lines: ["Imaginea ta", "online are?"] }],
  },
  h4: {
    phrases: [{ lines: ["Ai construit un", "restaurant bun."] }, { lines: ["Imaginea lui online", "ar trebui să arate", "la fel."] }],
  },
  h5: {
    phrases: [{ lines: ["Prezența online", "a restaurantului tău", "n-ar trebui să depindă", "de timpul tău liber."] }],
    greyFrom: 5,
  },
  h6: {
    phrases: [{ lines: ["Mâncarea bună", "nu se mai", "promovează", "singură."] }],
    greyFrom: 2,
  },
};

// Cuvintele CTA-ului, în ordinea rostită, se împart în: titlul panoului
// (primele cuvinte, pe rânduri), rândul secundar (următoarele) și restul,
// „...la numărul de telefon de pe ecran", care nu se scrie: îl arată numărul.
export type CtaDef = {
  phrases: string[];
  /** Câte cuvinte are fiecare rând al titlului. */
  titleLines: number[];
  subtitleWords: number;
  /** Semn adăugat după ultimul cuvânt de pe rândul secundar. */
  subtitleSuffix?: string;
};

export const CTAS: Record<CtaId, CtaDef> = {
  c1: {
    phrases: [
      "Totul începe cu o analiză a prezenței tale online și o ofertă de colaborare.",
      "Sună la numărul de telefon de pe ecran.",
    ],
    titleLines: [2, 3],
    subtitleWords: 9,
  },
  c2: {
    phrases: [
      "Căutăm parteneri pe termen lung.",
      "Dacă și tu cauți la fel, sună la numărul de telefon de pe ecran.",
    ],
    titleLines: [2, 3],
    subtitleWords: 7,
    subtitleSuffix: ":",
  },
};

export const B1 = [
  "Ne ocupăm de tot ce ține de imaginea online.",
  "Venim cu ideile și scriem scenariile.",
  "Facem cinematografie gastronomică, cu echipament profesional.",
  "Edităm, publicăm și administrăm campaniile de promovare care aduc oameni noi la masă.",
  "În fiecare lună primești o analiză de performanță și propuneri pentru luna următoare.",
];

export const PHONE = "0771 738 607";
export const DOMAIN = "meridianx.ro";

// Site-ul fictiv din animația de analiză. Domeniul nu există (verificat DNS).
export const DEMO = {
  domain: "restaurantultau.ro",
  name: "Restaurantul tău",
};

export const CLIPS: { voice: VoiceId; hook: HookId; cta: CtaId }[] = [
  { voice: "333f", hook: "h2", cta: "c1" },
  { voice: "333f", hook: "h3", cta: "c2" },
  { voice: "333f", hook: "h4", cta: "c1" },
  { voice: "333f", hook: "h5", cta: "c2" },
  { voice: "333f", hook: "h6", cta: "c1" },
  { voice: "mihai", hook: "h1", cta: "c2" },
  { voice: "mihai", hook: "h3", cta: "c1" },
  { voice: "mihai", hook: "h4", cta: "c2" },
  { voice: "mihai", hook: "h5", cta: "c1" },
  { voice: "mihai", hook: "h6", cta: "c2" },
];

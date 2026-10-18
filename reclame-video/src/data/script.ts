// Textele vocilor, pe bucăți și pe fraze, exact cum sunt rostite. De ordinea
// cuvintelor depinde sincronizarea textului de pe ecran.

export type HookId = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
export type CtaId = "c1" | "c2";
export type VoiceId = "333f" | "mihai";
export type StyleId = "larven" | "shopify";
export type PieceId = HookId | "b1" | CtaId;

export const PIECE_TEXT: Record<PieceId, string[]> = {
  h1: ["Căutăm trei restaurante din Sectorul 1 pe care să le ajutăm să se dezvolte."],
  h2: ["Căutăm trei restaurante din Sectorul 1 pentru un parteneriat de marketing pe termen lung."],
  h3: ["Bucătăria ta are un șef.", "Imaginea ta online are?"],
  h4: ["Ai construit un restaurant bun.", "Imaginea lui online ar trebui să arate la fel."],
  h5: ["Prezența online a restaurantului tău n-ar trebui să depindă de timpul tău liber."],
  h6: ["Mâncarea bună nu se mai promovează singură."],
  b1: [
    "Ne ocupăm de tot ce ține de imaginea online.",
    "Venim cu ideile și scriem scenariile.",
    "Facem cinematografie gastronomică, cu echipament profesional.",
    "Edităm, publicăm și administrăm campaniile de promovare care aduc oameni noi la masă.",
    "În fiecare lună primești o analiză de performanță și propuneri pentru luna următoare.",
  ],
  c1: [
    "Totul începe cu o analiză a prezenței tale online și o ofertă de colaborare.",
    "Sună la numărul de telefon de pe ecran.",
  ],
  c2: ["Căutăm parteneri pe termen lung.", "Dacă și tu cauți la fel, sună la numărul de telefon de pe ecran."],
};

/** Ce bucăți conține fiecare fișier de voce, în ordine (vezi scripts/segment-voices.mjs). */
export const FILE_PIECES: Record<string, PieceId[]> = {
  "voci/333f-hooks.mp3": ["h1", "h2", "h3", "h4", "h5", "h6"],
  "voci/333f-complet-h3-b1-c2.mp3": ["h3", "b1", "c2"],
  "voci/333f-cta.mp3": ["c1", "c2"],
  "voci/mihai-hooks.mp3": ["h1", "h2", "h3", "h4", "h5", "h6"],
  "voci/mihai-b1.mp3": ["b1"],
  "voci/mihai-cta.mp3": ["c1", "c2"],
};

export const PHONE = "0771 738 607";
export const DOMAIN = "meridianx.ro";

export type ClipDef = { voice: VoiceId; hook: HookId; cta: CtaId; style: StyleId; batch: 1 | 2 };

// Tabelul din prompt. Tranșa 1: 333f în stilul Larven, Mihai în stilul Shopify.
// Tranșa 2: aceleași combinații, cu stilurile inversate.
const COMBOS: { voice: VoiceId; hook: HookId; cta: CtaId }[] = [
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

const firstStyle = (v: VoiceId): StyleId => (v === "333f" ? "larven" : "shopify");
const other = (s: StyleId): StyleId => (s === "larven" ? "shopify" : "larven");

export const CLIPS: ClipDef[] = [
  ...COMBOS.map((c) => ({ ...c, style: firstStyle(c.voice), batch: 1 as const })),
  ...COMBOS.map((c) => ({ ...c, style: other(firstStyle(c.voice)), batch: 2 as const })),
];

export const clipId = (c: Pick<ClipDef, "voice" | "hook" | "cta" | "style">) => `${c.voice}-${c.hook}-${c.cta}-${c.style}`;
export const clipFile = (c: Pick<ClipDef, "voice" | "hook" | "cta" | "style">) => `${c.voice}_${c.hook}-${c.cta}_9x16_${c.style}.mp4`;

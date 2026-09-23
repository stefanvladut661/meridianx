import { rng } from "../kit";

/* ============================================================
   Datele demo-ului Elyssium — toate inventate, deterministe.

   Catalogul de abonamente, prețurile, programul și regulile de
   check-in sunt cele din specificația aplicației (plan.md). Clienții,
   scanările, vânzările și facturile sunt generate cu `rng`, ca să
   arate la fel la fiecare încărcare.
   ============================================================ */

/* ---------- paleta Elyssium (packages/shared/src/tokens.ts) ---------- */
export const C = {
  auriu: "#F5C518",
  mov: "#4A2B7A",
  albastru: "#6B8DEF",
  coral: "#E88B84",
  text: "#111827",
  text2: "#6B7280",
  fundal: "#FAFAF8",
  card: "#FFFFFF",
  contur: "#E5E7EB",
  dezactivat: "#F3F4F6",
  succes: "#0F766E",
  eroare: "#DC2626",
  avert: "#F59E0B",
  avertText: "#92400E",
  fAuriu: "#FDF4D5",
  auriuText: "#7A5D06",
  fSucces: "#E6F4F2",
  fActiv: "#ECFDF5",
  fEroare: "#FDECEC",
  fAvert: "#FEF3DD",
  fAvertRand: "#FFFBEB",
  fMov: "#EFEAF7",
  spaBg: "#EAF0FD",
  spaText: "#3F63C4",
  aerBg: "#FDF0EF",
  aerText: "#B85B54",
} as const;

export const UMBRA = "0 4px 12px rgba(17, 24, 39, 0.06)";
export const GRADIENT = `linear-gradient(135deg, ${C.mov} 0%, ${C.albastru} 55%, ${C.coral} 100%)`;

/* ---------- timp: „azi” e miercuri, 23 septembrie 2026 ---------- */
const TODAY = Date.UTC(2026, 8, 23);
export const ORA_START = 9 * 3600 + 41 * 60; // 09:41, ca bara de stare

export const LUNI = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];
const LUNI_SCURT = ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."];
export const LUNI_3 = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
const ZILE_SAPT = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"];
export const ZILE_SCURTE = ["L", "Ma", "Mi", "J", "V", "S", "D"];

const zi = (o: number) => new Date(TODAY + o * 86_400_000);
export const dataLunga = (o: number) => {
  const d = zi(o);
  return `${d.getUTCDate()} ${LUNI[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const dataScurta = (o: number) => {
  const d = zi(o);
  return `${d.getUTCDate()} ${LUNI_SCURT[d.getUTCMonth()]}`;
};
export const lunaAn = (o: number) => {
  const d = zi(o);
  return `${LUNI[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const ziSapt = (o: number) => ZILE_SAPT[zi(o).getUTCDay()];
export const ora = (sec: number) =>
  `${String(Math.floor(sec / 3600) % 24).padStart(2, "0")}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}`;

/** Plural românesc: 1 zi · 7 zile · 22 de zile. */
export function plural(n: number, unu: string, multe: string) {
  if (n === 1) return `1 ${unu}`;
  const r = n % 100;
  const de = n >= 20 && (r === 0 || r >= 20);
  return `${n} ${de ? "de " : ""}${multe}`;
}
export const pluralZile = (n: number) => plural(n, "zi", "zile");
export const pluralSedinte = (n: number) => plural(n, "ședință", "ședințe");
export const cuvantZile = (n: number) => (n === 1 ? "zi" : "zile");

/** „Valabil până pe X” = data_expirare − 1 zi (data_expirare e exclusivă). */
export const valabilPana = (exp: number) => dataLunga(exp - 1);
export const valabilPanaScurt = (exp: number) => dataScurta(exp - 1);

/** Ziua relativă, ca în listele din panou. */
export function candRelativ(o: number | null, sec?: number) {
  if (o === null) return "—";
  if (o === 0) return sec !== undefined ? `azi, ${ora(sec)}` : "azi";
  if (o === -1) return "ieri";
  if (o > -7) return `acum ${pluralZile(-o)}`;
  return dataScurta(o);
}

/* ---------- catalogul de abonamente (plan.md) ---------- */
export type Tip = "fitness" | "spa" | "aerobic";
export const ETICHETA_TIP: Record<Tip, string> = { fitness: "fitness", spa: "spa", aerobic: "aerobic" };
export const CULORI_TIP: Record<Tip, { bg: string; fg: string }> = {
  fitness: { bg: C.fMov, fg: C.mov },
  spa: { bg: C.spaBg, fg: C.spaText },
  aerobic: { bg: C.aerBg, fg: C.aerText },
};

export type CatId = "morning" | "anytime" | "spa" | "fs" | "as" | "elevi" | "redus";
export const CATEGORII: { id: CatId; nume: string; online: boolean }[] = [
  { id: "morning", nume: "Morning Gym", online: true },
  { id: "anytime", nume: "Any Time Gym", online: true },
  { id: "spa", nume: "SPA", online: true },
  { id: "fs", nume: "Fitness + SPA", online: true },
  { id: "as", nume: "Aerobic + SPA", online: true },
  { id: "elevi", nume: "Elevi / Studenți", online: false },
  { id: "redus", nume: "Redus MAI/MApN", online: false },
];

export type Plan = {
  id: string;
  cat: CatId;
  nume: string;
  pret: number;
  contoare: { tip: Tip; n: number | null }[];
  interval?: string;
};

const F = (n: number | null) => ({ tip: "fitness" as const, n });
const S = (n: number | null) => ({ tip: "spa" as const, n });
const A = (n: number | null) => ({ tip: "aerobic" as const, n });
const MORNING = "7:30–17:00 · luni–vineri";

export const PLANURI: Plan[] = [
  { id: "morning-8", cat: "morning", nume: "Morning Gym 8 ședințe", pret: 125, contoare: [F(8)], interval: MORNING },
  { id: "morning-12", cat: "morning", nume: "Morning Gym 12 ședințe", pret: 145, contoare: [F(12)], interval: MORNING },
  { id: "morning-u", cat: "morning", nume: "Morning Gym Unlimited", pret: 170, contoare: [F(null)], interval: MORNING },
  { id: "anytime-8", cat: "anytime", nume: "Any Time 8 ședințe", pret: 150, contoare: [F(8)] },
  { id: "anytime-12", cat: "anytime", nume: "Any Time 12 ședințe", pret: 170, contoare: [F(12)] },
  { id: "anytime-u", cat: "anytime", nume: "Any Time Unlimited", pret: 199, contoare: [F(null)] },
  { id: "spa-8", cat: "spa", nume: "SPA 8 ședințe", pret: 160, contoare: [S(8)] },
  { id: "spa-12", cat: "spa", nume: "SPA 12 ședințe", pret: 200, contoare: [S(12)] },
  { id: "fs-8", cat: "fs", nume: "8 Fitness + 4 SPA", pret: 200, contoare: [F(8), S(4)] },
  { id: "fs-12", cat: "fs", nume: "12 Fitness + 6 SPA", pret: 250, contoare: [F(12), S(6)] },
  { id: "fs-u", cat: "fs", nume: "Full Fitness + Full SPA", pret: 350, contoare: [F(null), S(null)] },
  { id: "as-8", cat: "as", nume: "8 Aerobic + 4 SPA", pret: 250, contoare: [A(8), S(4)] },
  { id: "as-12", cat: "as", nume: "12 Aerobic + 6 SPA", pret: 320, contoare: [A(12), S(6)] },
  { id: "elevi-8", cat: "elevi", nume: "Elevi 8 ședințe", pret: 95, contoare: [F(8)] },
  { id: "elevi-12", cat: "elevi", nume: "Elevi 12 ședințe", pret: 130, contoare: [F(12)] },
  { id: "elevi-u", cat: "elevi", nume: "Elevi Full Fitness", pret: 149, contoare: [F(null)] },
  { id: "redus-8", cat: "redus", nume: "Redus 8 ședințe", pret: 130, contoare: [F(8)] },
  { id: "redus-12", cat: "redus", nume: "Redus 12 ședințe", pret: 145, contoare: [F(12)] },
  { id: "redus-u", cat: "redus", nume: "Redus Unlimited", pret: 180, contoare: [F(null)] },
];
export const planDupaId = (id: string) => PLANURI.find((p) => p.id === id) ?? PLANURI[0];
export const numeCategorie = (cat: CatId) => CATEGORII.find((c) => c.id === cat)?.nume ?? "";

/* ---------- clienți ---------- */
export type Contor = { tip: Tip; total: number | null; ramase: number | null };
export type Metoda = "online" | "cash" | "card_fizic";
export const ETICHETA_METODA: Record<Metoda, string> = { online: "Online", cash: "Cash", card_fizic: "Card fizic" };

export type Sub = {
  id: string;
  planId: string;
  nume: string;
  cat: CatId;
  /** zile față de azi: start ≤ 0, exp > 0 pentru un abonament valabil */
  start: number;
  exp: number;
  contoare: Contor[];
  interval?: string;
  pret: number;
  metoda: Metoda;
};

export type Member = {
  id: string;
  prenume: string;
  nume: string;
  cod: string;
  tel: string;
  email: string;
  din: number;
  subs: Sub[];
  ultimulExpirat: { nume: string; exp: number } | null;
  nrAbonamente: number;
  vizite: number;
  ultima: number | null;
  ultimaOra?: number;
  tint: number;
};

export const numeComplet = (m: Member) => `${m.prenume} ${m.nume}`;
export const subsActive = (m: Member) => m.subs.filter((s) => s.exp > 0 && s.start <= 0);
export type Stare = "activ" | "expirat" | "nou";
export const stareClient = (m: Member): Stare =>
  subsActive(m).length > 0 ? "activ" : m.nrAbonamente > 0 ? "expirat" : "nou";

const PRENUME = [
  "Andrei", "Maria", "Ioana", "Alexandru", "Elena", "Mihai", "Cristina", "Radu", "Bianca", "Vlad",
  "Diana", "Ștefan", "Larisa", "Tudor", "Alina", "Cosmin", "Roxana", "Bogdan", "Denisa", "Sorin",
  "Irina", "Paul", "Oana", "George", "Teodora", "Cătălin", "Raluca", "Florin", "Adriana", "Marius",
  "Simona", "Darius", "Georgiana", "Victor", "Corina", "Iulian", "Monica", "Robert", "Sabina", "Lucian",
  "Andreea", "Gabriel", "Carmen", "Emil", "Delia", "Octavian", "Miruna", "Sebastian",
];
const NUME = [
  "Popescu", "Ionescu", "Dumitrescu", "Stan", "Stoica", "Gheorghe", "Rusu", "Munteanu", "Matei",
  "Constantin", "Marin", "Tudose", "Dobre", "Barbu", "Nistor", "Florea", "Ene", "Dinu", "Georgescu",
  "Lazăr", "Moldovan", "Preda", "Toma", "Ciobanu", "Oprea", "Voicu", "Neagu", "Mocanu", "Cojocaru",
  "Enache", "Iordache", "Vasile", "Pavel", "Zamfir", "Anghel", "Badea", "Sima", "Petrescu", "Manole",
  "Diaconu", "Surdu", "Tănase", "Bălan", "Crăciun",
];
const COD = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ascii = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[șş]/g, "s").replace(/[țţ]/g, "t").replace(/[ȘŞ]/g, "S").replace(/[ȚŢ]/g, "T");

/** Planul unui client activ, după ponderi plauzibile pentru o sală de cartier mare. */
function alegePlan(x: number): string {
  const tabel: [number, string][] = [
    [0.12, "anytime-u"], [0.22, "anytime-12"], [0.3, "anytime-8"],
    [0.37, "morning-u"], [0.43, "morning-12"], [0.48, "morning-8"],
    [0.55, "fs-12"], [0.6, "fs-8"], [0.64, "fs-u"],
    [0.69, "spa-8"], [0.72, "spa-12"],
    [0.76, "as-8"], [0.79, "as-12"],
    [0.85, "elevi-u"], [0.88, "elevi-12"], [0.9, "elevi-8"],
    [0.95, "redus-u"], [0.98, "redus-12"], [1.01, "redus-8"],
  ];
  return (tabel.find(([p]) => x < p) ?? tabel[0])[1];
}

export function subNou(planId: string, start: number, id: string, metoda: Metoda, uzura = 0): Sub {
  const p = planDupaId(planId);
  return {
    id,
    planId,
    nume: p.nume,
    cat: p.cat,
    start,
    exp: start + 30,
    interval: p.interval,
    pret: p.pret,
    metoda,
    contoare: p.contoare.map((c) => ({
      tip: c.tip,
      total: c.n,
      ramase: c.n === null ? null : Math.max(0, c.n - Math.round(c.n * uzura)),
    })),
  };
}

const TOTAL_CLIENTI = 4286;
const TINTE = 5;

function genereazaClient(i: number, stare: Stare): Member {
  const r = rng(90_001 + i * 7919);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const prenume = pick(PRENUME);
  const nume = pick(NUME);
  let cod = "";
  for (let k = 0; k < 5; k++) cod += COD[Math.floor(r() * COD.length)];
  const tel = `07${2 + Math.floor(r() * 8)}${Math.floor(r() * 10)} ••• ${String(Math.floor(r() * 1000)).padStart(3, "0")}`;
  const e = ascii(prenume).toLowerCase();
  const email = `${e.slice(0, 2)}•••@${pick(["gmail.com", "yahoo.com", "icloud.com", "gmail.com"])}`;
  const din = -Math.floor(20 + r() * 900);
  const metode: Metoda[] = ["online", "cash", "card_fizic", "online", "cash"];
  const m: Member = {
    id: `c${i}`,
    prenume,
    nume,
    cod,
    tel,
    email,
    din,
    subs: [],
    ultimulExpirat: null,
    nrAbonamente: 0,
    vizite: 0,
    ultima: null,
    tint: Math.floor(r() * TINTE),
  };
  if (stare === "activ") {
    const start = -Math.floor(r() * 29);
    const elapsed = -start / 30;
    const planId = alegePlan(r());
    // reducerile (elevi, MAI/MApN) se vând la recepție, cu legitimația în mână
    const redus = planId.startsWith("elevi") || planId.startsWith("redus");
    const metoda = pick(metode);
    m.subs.push(subNou(planId, start, `s${i}a`, redus && metoda === "online" ? "card_fizic" : metoda, Math.min(0.95, elapsed * (0.6 + r() * 0.7))));
    if (r() < 0.05) m.subs.push(subNou("spa-8", -Math.floor(r() * 20), `s${i}b`, pick(metode), r() * 0.5));
    m.nrAbonamente = 1 + Math.floor(r() * 14);
    m.vizite = Math.max(3, Math.round(m.nrAbonamente * (5 + r() * 9)));
    m.ultima = -1 - Math.floor(r() * r() * 6);
  } else if (stare === "expirat") {
    const acum = r() < 0.12 ? 1 + Math.floor(r() * 29) : 30 + Math.floor(r() * 380);
    const p = planDupaId(alegePlan(r()));
    m.ultimulExpirat = { nume: p.nume, exp: -acum };
    m.nrAbonamente = 1 + Math.floor(r() * 8);
    m.vizite = Math.max(1, Math.round(m.nrAbonamente * (4 + r() * 8)));
    m.ultima = -acum - Math.floor(r() * 5);
  }
  // vechimea se potrivește cu numărul de abonamente cumpărate
  m.din = m.nrAbonamente > 0 ? -(m.nrAbonamente * 31 + Math.floor(r() * 240) + (m.ultimulExpirat ? -m.ultimulExpirat.exp : 0)) : -(2 + Math.floor(r() * 50));
  return m;
}

export type Lume = {
  clienti: Member[];
  dupaId: Map<string, Member>;
  totaluri: Record<Stare, number>;
  categoriiActive: { cat: CatId; n: number }[];
  deSunat: Member[];
  expiraCurand: number;
};

let cache: Lume | null = null;

/** Toți cei 4.286 de clienți, generați o singură dată. */
export function lume(): Lume {
  if (cache) return cache;
  // stările, în proporții fixe, amestecate determinist
  const stari: Stare[] = [
    ...Array<Stare>(1910).fill("activ"),
    ...Array<Stare>(1837).fill("expirat"),
    ...Array<Stare>(536).fill("nou"),
  ];
  const r = rng(4242);
  for (let k = stari.length - 1; k > 0; k--) {
    const j = Math.floor(r() * (k + 1));
    [stari[k], stari[j]] = [stari[j], stari[k]];
  }
  const clienti: Member[] = [EROU(), RADU(), BIANCA()];
  for (let i = 3; i < TOTAL_CLIENTI; i++) clienti.push(genereazaClient(i, stari[i - 3]));

  const totaluri: Record<Stare, number> = { activ: 0, expirat: 0, nou: 0 };
  const perCat = new Map<CatId, number>();
  let expiraCurand = 0;
  for (const c of clienti) {
    const s = stareClient(c);
    totaluri[s]++;
    const a = subsActive(c);
    if (a[0]) {
      perCat.set(a[0].cat, (perCat.get(a[0].cat) ?? 0) + 1);
      if (a[0].exp <= 7) expiraCurand++;
    }
  }
  const categoriiActive = [...perCat.entries()].map(([cat, n]) => ({ cat, n })).sort((a, b) => b.n - a.n);
  const deSunat = clienti
    .filter((c) => stareClient(c) === "expirat" && c.ultimulExpirat && c.ultimulExpirat.exp > -30)
    .sort((a, b) => (b.ultimulExpirat?.exp ?? 0) - (a.ultimulExpirat?.exp ?? 0));

  cache = {
    clienti,
    dupaId: new Map(clienti.map((c) => [c.id, c])),
    totaluri,
    categoriiActive,
    deSunat,
    expiraCurand,
  };
  return cache;
}

/* ---------- personajele fixe ---------- */

/** Clientul din aplicația de telefon. */
function EROU(): Member {
  const s = subNou("fs-12", -8, "s0a", "online");
  s.contoare = [
    { tip: "fitness", total: 12, ramase: 7 },
    { tip: "spa", total: 6, ramase: 4 },
  ];
  return {
    id: "c0",
    prenume: "Andrei",
    nume: "Mocanu",
    cod: "K7Q2M",
    tel: "0745 ••• 318",
    email: "an•••@gmail.com",
    din: -560,
    subs: [s],
    ultimulExpirat: null,
    nrAbonamente: 18,
    vizite: 87,
    ultima: -1,
    tint: 0,
  };
}
function RADU(): Member {
  return {
    id: "c1",
    prenume: "Radu",
    nume: "Stoica",
    cod: "P4X9T",
    tel: "0722 ••• 540",
    email: "ra•••@yahoo.com",
    din: -310,
    subs: [subNou("anytime-u", -12, "s1a", "online")],
    ultimulExpirat: null,
    nrAbonamente: 9,
    vizite: 104,
    ultima: -1,
    tint: 1,
  };
}
function BIANCA(): Member {
  return {
    id: "c2",
    prenume: "Bianca",
    nume: "Neagu",
    cod: "H2W8R",
    tel: "0761 ••• 207",
    email: "bi•••@icloud.com",
    din: -140,
    subs: [],
    ultimulExpirat: { nume: "Morning Gym 12 ședințe", exp: -3 },
    nrAbonamente: 4,
    vizite: 38,
    ultima: -4,
    tint: 2,
  };
}

/* ---------- personal (inventat) ---------- */
export const STAFF_EU = "Ioana Radu";
export const STAFF_ALT = "Cristina Enache";

/* ---------- dashboard ---------- */
export const VANZARI_12 = [271_420, 259_830, 228_610, 336_240, 312_880, 318_450, 297_130, 284_320, 256_740, 241_180, 305_620, 342_180];
export const LUNI_12 = ["oct", "nov", "dec", "ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep"];
export const VANDUTE_LUNA = 1694;
export const VANDUTE_LUNA_TRECUTA = 1538;
export const NOI_LUNA = 164;

/** Check-in-urile pe zi, ultimele 30 de zile (azi = ultima). */
export const CHECKINS_30: { o: number; n: number }[] = (() => {
  const r = rng(303);
  const out: { o: number; n: number }[] = [];
  for (let o = -29; o <= 0; o++) {
    const dow = zi(o).getUTCDay();
    const baza = dow === 0 ? 262 : dow === 6 ? 384 : 566;
    const trend = 1 + (o + 29) * 0.0035;
    out.push({ o, n: Math.round(baza * trend * (0.93 + r() * 0.14)) });
  }
  return out;
})();

/** Ore aglomerate: 7 zile (luni…duminică) × orele 7–21; null = închis. */
export const ORE_HEATMAP = Array.from({ length: 15 }, (_, k) => 7 + k);
export const HEATMAP: (number | null)[][] = (() => {
  const r = rng(77);
  const zilnic = [0.42, 0.62, 0.55, 0.38, 0.3, 0.33, 0.36, 0.44, 0.52, 0.66, 0.9, 1, 0.94, 0.72, 0.44];
  return Array.from({ length: 7 }, (_, d) =>
    ORE_HEATMAP.map((h, k) => {
      if (d === 5 && (h < 9 || h >= 17)) return null;
      if (d === 6 && (h < 9 || h >= 15)) return null;
      const w = d === 5 ? [0, 0, 0.5, 0.72, 0.78, 0.7, 0.6, 0.52, 0.46, 0.4][h - 7] ?? 0.4 : d === 6 ? 0.34 + (h === 10 || h === 11 ? 0.12 : 0) : zilnic[k] * (d === 4 ? 0.86 : 1);
      return Math.min(1, Math.max(0.05, w * (0.9 + r() * 0.18)));
    })
  );
})();

/* ---------- anunțuri ---------- */
export type Anunt = { id: string; titlu: string; text: string; o: number; ora: string; trimise: number; citite: number; autor: string };
export const ANUNTURI: Anunt[] = [
  {
    id: "a3",
    titlu: "Aparate noi în zona de forță",
    text: "Au sosit două rack-uri și o presă de picioare. Le găsești lângă oglinda mare, de azi.",
    o: -1,
    ora: "18:05",
    trimise: 4281,
    citite: 2317,
    autor: STAFF_EU,
  },
  {
    id: "a2",
    titlu: "Sauna, în revizie joi dimineață",
    text: "Joi, între 7:30 și 12:00, sauna e închisă pentru revizia anuală. Restul zonei SPA rămâne deschisă.",
    o: -6,
    ora: "10:12",
    trimise: 4264,
    citite: 3398,
    autor: STAFF_ALT,
  },
  {
    id: "a1",
    titlu: "Abonamentul se cumpără și din aplicație",
    text: "Plătești cu cardul, abonamentul se activează pe loc, iar factura vine pe email.",
    o: -15,
    ora: "12:30",
    trimise: 4218,
    citite: 3702,
    autor: STAFF_EU,
  },
];

/* ---------- facturare și plăți ---------- */
export type StatusFactura = "emisa" | "emitere" | "esuata" | "de_verificat";
export type Factura = {
  id: string;
  numar: number | null;
  client: string;
  plan: string;
  suma: number;
  ora: string;
  o: number;
  status: StatusFactura;
  email: boolean;
  motiv?: string;
};

export const INCASARI: Record<"iul" | "aug" | "sep", { online: number; cash: number; card: number; plati: number; facturi: number; vandute: number }> = {
  iul: { online: 88_640, cash: 86_910, card: 65_630, plati: 437, facturi: 437, vandute: 1204 },
  aug: { online: 112_870, cash: 108_200, card: 84_550, plati: 559, facturi: 558, vandute: 1538 },
  sep: { online: 131_460, cash: 118_920, card: 91_800, plati: 648, facturi: 646, vandute: 1694 },
};

export const FACTURI_INITIALE: Factura[] = (() => {
  const r = rng(515);
  const L = lume();
  const out: Factura[] = [];
  let numar = 712;
  let sec = ORA_START - 140;
  let oz = 0;
  for (let k = 0; k < 14; k++) {
    const c = L.clienti[40 + Math.floor(r() * 3000)];
    const p = PLANURI.filter((x) => x.cat !== "elevi" && x.cat !== "redus")[Math.floor(r() * 13)];
    const f: Factura = {
      id: `f${k}`,
      numar,
      client: `${c.prenume} ${c.nume.charAt(0)}.`,
      plan: p.nume,
      suma: p.pret,
      ora: ora(sec),
      o: oz,
      status: "emisa",
      email: true,
    };
    if (k === 3) {
      f.status = "esuata";
      f.numar = null;
      f.motiv = "Lipsește CUI-ul firmei în datele de facturare";
      f.client = "Studio Arcadia SRL";
      numar++;
    } else if (k === 7) {
      f.status = "de_verificat";
      f.numar = null;
      f.motiv = "SmartBill n-a răspuns în 20 s — verifică în SmartBill Cloud";
      numar++;
    }
    out.push(f);
    numar--;
    sec -= 600 + Math.floor(r() * 2400);
    if (sec < 7.5 * 3600) {
      sec += 13 * 3600;
      oz = -1;
    }
  }
  return out;
})();
export const PRIMUL_NUMAR_NOU = 713;

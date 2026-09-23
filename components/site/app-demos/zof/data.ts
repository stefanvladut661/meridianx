import { rng } from "../kit";

/* ============================================================
   Zof Stoc Online — datele demo-ului.

   Totul e inventat și determinist: aceleași cifre la fiecare
   încărcare. Doar etichetele de dată urmează ziua reală, ca
   ferestrele „ultimele 7 / 30 de zile” să arate firesc.

   Ora simulată: demo-ul pornește la 18:24:10, cu magazinele
   deschise, apoi ceasul merge normal.
   ============================================================ */

export type Channel = "fizic" | "online";
export type Pay = "card" | "numerar" | "online";
export type LocStatus = "online" | "warning";

export type Loc = {
  id: string;
  name: string;
  city: string;
  /** cod scurt, pentru coloanele matricei de stoc */
  code: string;
  type: Channel;
  connector: string;
  /** sistemul de gestiune din magazin */
  source: string;
  /** cum citește agentul */
  method: string;
  agent: string;
  /** vânzări azi, la pornirea demo-ului */
  today: number;
  receipts: number;
  units: number;
  stockValue: number;
  stockUnits: number;
  /** card / numerar / online */
  pay: [number, number, number];
  /** înregistrări sincronizate azi */
  records: number;
  /** secunde de la ultima sincronizare, la pornire */
  syncAgo: number;
  status: LocStatus;
  file: string;
};

export const LOCS: Loc[] = [
  { id: "arges-mall", name: "Argeș Mall", city: "Pitești", code: "AM", type: "fizic", connector: "pc-arges-1", source: "DorSoft", method: "export JSON · citire", agent: "1.4.2", today: 34980, receipts: 29, units: 57, stockValue: 2184000, stockUnits: 5210, pay: [0.74, 0.26, 0], records: 1482, syncAgo: 4, status: "online", file: "ZOF-ArgesMall-219.json" },
  { id: "centru", name: "Centru", city: "Pitești", code: "CE", type: "fizic", connector: "pc-centru-1", source: "DorSoft", method: "export JSON · citire", agent: "1.4.2", today: 29460, receipts: 25, units: 49, stockValue: 1912000, stockUnits: 4580, pay: [0.69, 0.31, 0], records: 1296, syncAgo: 11, status: "online", file: "ZOF-Centru-214.json" },
  { id: "valcea", name: "Râmnicu Vâlcea", city: "Vâlcea", code: "RV", type: "fizic", connector: "pc-valcea-1", source: "Access", method: "bază .accdb · ODBC read-only", agent: "1.4.2", today: 24870, receipts: 21, units: 40, stockValue: 1655000, stockUnits: 3940, pay: [0.71, 0.29, 0], records: 1104, syncAgo: 7, status: "online", file: "valcea.accdb" },
  { id: "exercitiu", name: "Exercițiu", city: "Pitești", code: "EX", type: "fizic", connector: "pc-exercitiu-1", source: "DorSoft", method: "export JSON · citire", agent: "1.4.2", today: 19640, receipts: 17, units: 33, stockValue: 1388000, stockUnits: 3310, pay: [0.66, 0.34, 0], records: 873, syncAgo: 19, status: "online", file: "ZOF-Exercitiu-207.json" },
  { id: "bratianu", name: "I.C. Brătianu", city: "Pitești", code: "IB", type: "fizic", connector: "pc-bratianu-1", source: "DorSoft", method: "export JSON · citire", agent: "1.4.1", today: 16230, receipts: 14, units: 27, stockValue: 1204000, stockUnits: 2870, pay: [0.63, 0.37, 0], records: 742, syncAgo: 26, status: "online", file: "ZOF-Bratianu-198.json" },
  { id: "campulung", name: "Câmpulung", city: "Argeș", code: "CL", type: "fizic", connector: "pc-campulung-1", source: "Access", method: "bază .accdb · ODBC read-only", agent: "1.4.1", today: 13910, receipts: 12, units: 22, stockValue: 1046000, stockUnits: 2490, pay: [0.58, 0.42, 0], records: 611, syncAgo: 196, status: "warning", file: "campulung.accdb" },
  { id: "mioveni", name: "Mioveni", city: "Argeș", code: "MI", type: "fizic", connector: "pc-mioveni-1", source: "DorSoft", method: "export JSON · citire", agent: "1.4.2", today: 12780, receipts: 11, units: 21, stockValue: 958000, stockUnits: 2290, pay: [0.61, 0.39, 0], records: 566, syncAgo: 14, status: "online", file: "ZOF-Mioveni-176.json" },
  { id: "curtea", name: "Curtea de Argeș", city: "Argeș", code: "CA", type: "fizic", connector: "pc-curtea-1", source: "DorSoft", method: "export JSON · citire", agent: "1.4.2", today: 11350, receipts: 10, units: 18, stockValue: 872000, stockUnits: 2080, pay: [0.57, 0.43, 0], records: 498, syncAgo: 33, status: "online", file: "ZOF-Curtea-162.json" },
  { id: "zof-ro", name: "zof.ro", city: "Magazin online", code: "ON", type: "online", connector: "shopify-zof", source: "Shopify", method: "comenzi · webhook", agent: "1.2.0", today: 9820, receipts: 8, units: 11, stockValue: 0, stockUnits: 0, pay: [0, 0, 1], records: 412, syncAgo: 2, status: "online", file: "webhook orders/create" },
];

export const PHYSICAL = LOCS.filter((l) => l.type === "fizic");
export const locById = (id: string) => LOCS.find((l) => l.id === id) ?? LOCS[0];

export const TODAY_BASE = LOCS.reduce((s, l) => s + l.today, 0);
export const RECEIPTS_BASE = LOCS.reduce((s, l) => s + l.receipts, 0);
export const UNITS_BASE = LOCS.reduce((s, l) => s + l.units, 0);
/** cota fiecărei locații din vânzările grupului */
export const SHARE: Record<string, number> = Object.fromEntries(
  LOCS.map((l) => [l.id, l.today / TODAY_BASE])
);

export const STOCK = {
  units: LOCS.reduce((s, l) => s + l.stockUnits, 0),
  value: LOCS.reduce((s, l) => s + l.stockValue, 0),
  catalog: 3412,
  outOfStock: 43,
  critical: 67,
};

export const MARGIN = 0.479;

/* ---------- ceasul simulat ---------- */

export const SIM_H = 18;
export const SIM_M = 24;
export function simBase(): number {
  const d = new Date();
  d.setHours(SIM_H, SIM_M, 10, 0);
  return d.getTime();
}

/* ---------- ore: 9–21 ---------- */

export const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const HW = [3, 5, 7, 9, 10, 9, 10, 11, 12, 11, 9, 6, 3];
const HW_SUM = HW.reduce((a, b) => a + b, 0);

/** Cât din ziua de vânzări s-a consumat la ora h (fracționară). */
export function dayFraction(h: number) {
  let acc = 0;
  for (let i = 0; i < HOURS.length; i++) {
    const start = HOURS[i];
    if (h >= start + 1) acc += HW[i];
    else if (h > start) acc += HW[i] * (h - start);
  }
  return acc / HW_SUM;
}
const START_FRACTION = dayFraction(SIM_H + SIM_M / 60);
/** o zi întreagă, ca să iasă vânzările de azi la ora de pornire */
export const FULL_DAY = TODAY_BASE / START_FRACTION;

/**
 * Vânzările pe ore (9–21) pentru o valoare de „azi până acum”
 * (`sofar`), la ora simulată `hour` (fracționară). Orele viitoare → null.
 */
export function hourly(sofar: number, hour: number): (number | null)[] {
  const r = rng(77);
  const raw = HOURS.map((start, i) => {
    const wobble = 0.86 + r() * 0.28;
    if (hour >= start + 1) return HW[i] * wobble;
    if (hour > start) return HW[i] * (hour - start);
    return null;
  });
  const tot = raw.reduce<number>((s, v) => s + (v ?? 0), 0) || 1;
  // normalizat: suma orelor = exact vânzările de azi
  return raw.map((v) => (v === null ? null : (v / tot) * sofar));
}

/** aceeași zi, săptămâna trecută — pe ore, zi întreagă */
export function hourlyLastWeek(): number[] {
  const r = rng(91);
  const day = FULL_DAY / GROWTH.azi;
  return HW.map((w) => (day * w * (0.9 + r() * 0.2)) / HW_SUM);
}

/** Creșterea față de perioada anterioară comparabilă. */
export const GROWTH = { azi: 1.082, "7z": 1.064, "30z": 1.091, "12l": 1.131 } as const;

/* ---------- zile ---------- */

const WEEK = [1.06, 0.97, 0.93, 0.98, 1.02, 1.08, 0.96];

/** Vânzările grupului într-o zi întreagă, acum `k` zile (k ≥ 1). */
export function dayRevenue(k: number): number {
  const r = rng(5000 + k)();
  const trend = 1 - k * 0.00026;
  return FULL_DAY * 0.985 * WEEK[k % 7] * trend * (0.9 + r * 0.2);
}

export const AVG_UNIT = 612;
export const AVG_RECEIPT = TODAY_BASE / RECEIPTS_BASE;

/* ---------- etichete de dată ---------- */

const dShort = (d: Date) =>
  d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
const wShort = (d: Date) => d.toLocaleDateString("ro-RO", { weekday: "short" });
const mShort = (d: Date) => d.toLocaleDateString("ro-RO", { month: "short" });

export function daysAgo(k: number) {
  const d = new Date();
  d.setDate(d.getDate() - k);
  return d;
}

export function rangeLabel(fromK: number, toK = 0) {
  const a = daysAgo(fromK);
  const b = daysAgo(toK);
  const yb = b.getFullYear();
  if (fromK === toK) return b.toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
  return `${dShort(a)} – ${dShort(b)} ${yb}`;
}

export const todayLabel = () =>
  new Date().toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });

/* ---------- perioade ---------- */

export type Period = "azi" | "7z" | "30z" | "12l";
export const PERIODS: { id: Period; label: string; long: string }[] = [
  { id: "azi", label: "Azi", long: "azi" },
  { id: "7z", label: "7 zile", long: "ultimele 7 zile" },
  { id: "30z", label: "30 zile", long: "ultimele 30 de zile" },
  { id: "12l", label: "12 luni", long: "ultimele 12 luni" },
];

function sum(xs: (number | null)[]) {
  return xs.reduce<number>((a, b) => a + (b ?? 0), 0);
}

export const sumDays = (from: number, to: number) => {
  let s = 0;
  for (let k = from; k <= to; k++) s += dayRevenue(k);
  return s;
};

export function periodRange(p: Period) {
  if (p === "azi") return rangeLabel(0, 0);
  if (p === "7z") return rangeLabel(6);
  if (p === "30z") return rangeLabel(29);
  const a = new Date();
  a.setMonth(a.getMonth() - 11);
  return `${mShort(a)} ${a.getFullYear()} – ${mShort(new Date())} ${new Date().getFullYear()}`;
}

/** Seria graficului „Evoluție vânzări” pentru o perioadă. */
export function periodSeries(
  p: Period,
  todaySoFar: number,
  hour: number
): {
  values: (number | null)[];
  compare: number[];
  labels: string[];
  compareLabel: string;
  /** poziția (fracționară) a ultimului punct, pentru „acum” */
  lastX?: number;
  /** ultimul punct e o perioadă neîncheiată */
  partial?: boolean;
} {
  if (p === "azi") {
    // cumulat pe zi: linia crește pe măsură ce intră bonurile
    const h = hourly(todaySoFar, hour);
    const c = hourlyLastWeek();
    const values: (number | null)[] = [0];
    const compare: number[] = [0];
    let lastX = 0;
    h.forEach((v, i) => {
      values.push(v === null ? null : (values[i] ?? 0) + v);
      compare.push(compare[i] + c[i]);
      if (v !== null) lastX = Math.min(i + 1, Math.max(i, hour - HOURS[0]));
    });
    return {
      values,
      compare,
      labels: [...HOURS, 22].map((x) => `${String(x).padStart(2, "0")}:00`),
      compareLabel: "aceeași zi, săpt. trecută",
      lastX,
    };
  }
  if (p === "7z" || p === "30z") {
    const n = p === "7z" ? 7 : 30;
    const values: number[] = [];
    const compare: number[] = [];
    const labels: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      values.push(i === 0 ? FULL_DAY * 0.985 : dayRevenue(i));
      compare.push(dayRevenue(i + n));
      const d = daysAgo(i);
      labels.push(p === "7z" ? `${wShort(d)} ${d.getDate()}` : dShort(d));
    }
    // perioada anterioară, scalată la creșterea declarată
    const k = sum(values) / GROWTH[p] / sum(compare);
    values[n - 1] = todaySoFar;
    return { partial: true, values, compare: compare.map((v) => v * k), labels, compareLabel: p === "7z" ? "săptămâna anterioară" : "cele 30 de zile anterioare" };
  }
  return { ...monthly(todaySoFar), compareLabel: "aceeași lună, anul trecut", partial: true };
}

/** Ultimele 12 luni (luna curentă în curs) și aceleași luni de anul trecut. */
export function monthly(todaySoFar: number) {
  const now = new Date();
  const values: number[] = [];
  const compare: number[] = [];
  const labels: string[] = [];
  const r = rng(404);
  let k = 0; // zile în urmă, parcurse
  const buckets: number[] = new Array(12).fill(0);
  // mergem înapoi zi cu zi, 365 de zile, și punem fiecare zi în luna ei
  for (k = 0; k < 365; k++) {
    const d = daysAgo(k);
    const monthsBack = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (monthsBack > 11) break;
    buckets[11 - monthsBack] += k === 0 ? todaySoFar : dayRevenue(k);
  }
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    labels.push(mShort(d).replace(".", ""));
    values.push(buckets[i]);
    // luna întreagă de anul trecut: ~30 de zile, cu 11% mai puțin
    const full = i === 11 ? FULL_DAY * 30 * 0.93 : buckets[i];
    compare.push((full / GROWTH["12l"]) * (0.94 + r() * 0.1));
  }
  return { values: values as (number | null)[], compare, labels };
}

/* ---------- totaluri pe perioade ---------- */

const M0 = monthly(0);

/** Vânzările grupului fără ziua de azi, pe fiecare perioadă. */
export const PAST: Record<Period, number> = {
  azi: 0,
  "7z": sumDays(1, 6),
  "30z": sumDays(1, 29),
  "12l": sum(M0.values),
};
/** Perioada anterioară, comparabilă (azi: până la aceeași oră, săpt. trecută). */
export const PREV: Record<Period, number> = {
  azi: TODAY_BASE / GROWTH.azi,
  "7z": (PAST["7z"] + TODAY_BASE) / GROWTH["7z"],
  "30z": (PAST["30z"] + TODAY_BASE) / GROWTH["30z"],
  "12l": (PAST["12l"] + TODAY_BASE) / GROWTH["12l"],
};

/* ---------- produse ---------- */

export type Category = "rame" | "soare" | "lentile" | "contact" | "accesorii";
export const CATEGORIES: { id: Category | "toate"; label: string }[] = [
  { id: "toate", label: "Toate" },
  { id: "rame", label: "Rame" },
  { id: "soare", label: "Ochelari de soare" },
  { id: "lentile", label: "Lentile" },
  { id: "contact", label: "Lentile de contact" },
  { id: "accesorii", label: "Accesorii" },
];

export type Product = {
  sku: string;
  brand: string;
  name: string;
  category: Category;
  price: number;
  cost: number;
  /** stoc pe locațiile fizice, în ordinea PHYSICAL */
  stock: number[];
  sold30: number;
  trend: "up" | "down" | "stable";
};

type P = [string, string, string, Category, number, number];
const RAW: P[] = [
  ["RB3025-001", "Ray-Ban", "RB3025 Aviator Classic", "soare", 829, 0.52],
  ["TF5401-001", "Tom Ford", "FT5401 Optical", "rame", 1490, 0.5],
  ["ESS-VXS-167", "Essilor", "Varilux X Series 1.67", "lentile", 3890, 0.46],
  ["OO9102-E2", "Oakley", "OO9102 Holbrook", "soare", 790, 0.53],
  ["RB5154-2000", "Ray-Ban", "RX5154 Clubmaster Optics", "rame", 689, 0.51],
  ["ZEI-SLP-160", "Zeiss", "SmartLife Progressive 1.6", "lentile", 3450, 0.47],
  ["PR17WV-1AB", "Prada", "PR 17WV", "rame", 1290, 0.5],
  ["ACU-OAS1D-30", "Acuvue", "Oasys 1-Day · 30 buc", "contact", 219, 0.58],
  ["GG0027O-001", "Gucci", "GG0027O", "rame", 1590, 0.49],
  ["RB4171-622", "Ray-Ban", "RB4171 Erika", "soare", 719, 0.52],
  ["HOY-HLX-160BC", "Hoya", "Hilux 1.6 BlueControl", "lentile", 980, 0.45],
  ["SIL5529-7000", "Silhouette", "Momentum 5529", "rame", 1840, 0.48],
  ["PO0714-2431", "Persol", "PO0714 Steve McQueen", "soare", 1390, 0.5],
  ["RV-SV160-TR", "Rhein Vision", "Single Vision 1.6 Transitions", "lentile", 1097, 0.44],
  ["BIO-3", "CooperVision", "Biofinity · 3 buc", "contact", 159, 0.57],
  ["VE4361-GB1", "Versace", "VE4361 Medusa", "soare", 1120, 0.49],
  ["BOSS1402-807", "Hugo Boss", "BOSS 1402", "rame", 790, 0.52],
  ["LIN9704-U9", "Lindberg", "Strip 9704", "rame", 3250, 0.47],
  ["ESS-EZS-150", "Essilor", "Eyezen Start 1.5", "lentile", 690, 0.45],
  ["DT1-30", "Alcon", "Dailies Total1 · 30 buc", "contact", 249, 0.56],
  ["CA8856-003", "Carrera", "CA 8856", "rame", 540, 0.53],
  ["OX8046-01", "Oakley", "OX8046 Airdrop", "rame", 720, 0.52],
  ["PLD2086-807", "Polaroid", "PLD 2086", "soare", 349, 0.55],
  ["ACC-SOL360", "Zof", "Soluție multifuncțională 360 ml", "accesorii", 45, 0.6],
  ["ACC-TOC-PR", "Zof", "Toc rigid premium", "accesorii", 89, 0.62],
  ["ACC-SPR30", "Zof", "Spray curățare 30 ml", "accesorii", 25, 0.64],
  ["ACC-LAV", "Zof", "Lavetă microfibră", "accesorii", 15, 0.66],
  ["RB7047-5196", "Ray-Ban", "RX7047", "rame", 579, 0.52],
];

export const PRODUCTS: Product[] = RAW.map(([sku, brand, name, category, price, costK], i) => {
  const r = rng(300 + i * 13);
  const depth = category === "accesorii" ? 40 : category === "contact" ? 22 : category === "lentile" ? 9 : 7;
  const stock = PHYSICAL.map((l, j) => {
    const size = [1.5, 1.3, 1.15, 1, 0.9, 0.8, 0.75, 0.7][j];
    const v = Math.round(depth * size * (0.2 + r() * 1.1));
    // câteva goluri realiste
    if (r() < 0.1) return 0;
    return v;
  });
  // produse vedetă cu stoc critic într-o locație sau două
  if (sku === "TF5401-001") { stock[4] = 0; stock[6] = 0; stock[7] = 1; }
  if (sku === "RB3025-001") { stock[0] = 6; stock[6] = 1; stock[5] = 2; }
  if (sku === "ZEI-SLP-160") { stock[7] = 0; }
  const sold30 = Math.round(((depth * 9) / Math.max(1, i * 0.35 + 1)) * (0.8 + r() * 0.5) + 6);
  const t = r();
  return {
    sku,
    brand,
    name,
    category,
    price,
    cost: Math.round(price * costK),
    stock,
    sold30,
    trend: t > 0.55 ? "up" : t < 0.2 ? "down" : "stable",
  };
});

export const stockTotal = (p: Product) => p.stock.reduce((a, b) => a + b, 0);
export const stockLevel = (q: number) => (q === 0 ? "out" : q <= 2 ? "low" : "ok");

/** Topul pe venit (ultimele 30 de zile). */
export const TOP_PRODUCTS = [...PRODUCTS]
  .filter((p) => p.category !== "accesorii")
  .sort((a, b) => b.sold30 * b.price - a.sold30 * a.price)
  .slice(0, 8);

export const BRANDS = (() => {
  const m = new Map<string, { name: string; revenue: number; units: number; products: number }>();
  for (const p of PRODUCTS) {
    if (p.category === "accesorii") continue;
    const e = m.get(p.brand) ?? { name: p.brand, revenue: 0, units: 0, products: 0 };
    e.revenue += p.sold30 * p.price * 3.1;
    e.units += p.sold30 * 3;
    e.products += 1;
    m.set(p.brand, e);
  }
  const r = rng(808);
  return [...m.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 7)
    .map((b) => ({ ...b, trend: Math.round((r() * 30 - 8) * 10) / 10, products: b.products * 37 + Math.round(r() * 30) }));
})();

/** Categorii — cota din venit (30 de zile). */
export const CATEGORY_SPLIT = [
  { name: "Lentile", share: 0.41 },
  { name: "Rame", share: 0.29 },
  { name: "Ochelari de soare", share: 0.14 },
  { name: "Lentile de contact", share: 0.08 },
  { name: "Servicii (consultație, montaj)", share: 0.05 },
  { name: "Accesorii", share: 0.03 },
];

/* ---------- vânzări ---------- */

export type SaleItem = { sku: string; qty: number; price: number };
export type Sale = {
  id: string;
  at: number;
  loc: string;
  receipt: string;
  items: SaleItem[];
  value: number;
  pay: Pay;
  /** a stat în bufferul local până la sincronizare */
  buffered?: boolean;
};

export const productBySku = (sku: string) => PRODUCTS.find((p) => p.sku === sku) ?? PRODUCTS[0];

const FRAMES = PRODUCTS.filter((p) => p.category === "rame" || p.category === "soare");
const LENSES = PRODUCTS.filter((p) => p.category === "lentile");
const SMALL = PRODUCTS.filter((p) => p.category === "contact" || p.category === "accesorii");

function pickLoc(x: number, pool: Loc[]) {
  const tot = pool.reduce((s, l) => s + l.today, 0);
  let acc = 0;
  for (const l of pool) {
    acc += l.today / tot;
    if (x <= acc) return l;
  }
  return pool[pool.length - 1];
}

/** Vânzarea nr. `n` — deterministă. `at` = momentul (ora simulată). */
export function makeSale(n: number, at: number, only?: string): Sale {
  const r = rng(9000 + n * 7);
  const loc = only ? locById(only) : pickLoc(r(), LOCS);
  const kind = r();
  const items: SaleItem[] = [];
  if (loc.type === "online") {
    const f = kind < 0.6 ? FRAMES[Math.floor(r() * FRAMES.length)] : SMALL[Math.floor(r() * SMALL.length)];
    items.push({ sku: f.sku, qty: 1, price: f.price });
  } else if (kind < 0.32) {
    // ramă + pereche de lentile (regula R1: două lentile identice → cantitate 2)
    const f = FRAMES[Math.floor(r() * FRAMES.length)];
    const l = LENSES[Math.floor(r() * LENSES.length)];
    items.push({ sku: f.sku, qty: 1, price: f.price }, { sku: l.sku, qty: 2, price: Math.round(l.price / 2) });
  } else if (kind < 0.66) {
    const f = FRAMES[Math.floor(r() * FRAMES.length)];
    items.push({ sku: f.sku, qty: 1, price: f.price });
  } else {
    const s = SMALL[Math.floor(r() * SMALL.length)];
    items.push({ sku: s.sku, qty: 1 + Math.floor(r() * 3), price: s.price });
  }
  const value = items.reduce((s, it) => s + it.qty * it.price, 0);
  const pay: Pay = loc.type === "online" ? "online" : r() < loc.pay[0] ? "card" : "numerar";
  const li = LOCS.indexOf(loc);
  return {
    id: `s${n}-${loc.id}`,
    at,
    loc: loc.id,
    receipt: loc.type === "online" ? `ZOF-${4020 + n}` : `BON-${16020 + li * 1379 + n}`,
    items,
    value,
    pay,
  };
}

/** Istoricul de la pornire: vânzările din ultimele ~25 de minute. */
export function seedSales(base: number): Sale[] {
  const out: Sale[] = [];
  for (let i = 0; i < 34; i++) {
    const s = makeSale(1100 - i, base - (i * 47 + 9) * 1000);
    // Câmpulung nu mai trimite de ~3 min: ce e mai nou de atât stă în bufferul local
    if (s.loc === "campulung" && s.at > base - 196000) continue;
    out.push(s);
  }
  return out;
}

/** Ce așteaptă în bufferul local de la Câmpulung, la pornire. */
export function seedBuffered(base: number): Sale[] {
  return [0, 1, 2].map((i) => ({
    ...makeSale(1101 + i, base - (170 - i * 55) * 1000, "campulung"),
    buffered: true,
  }));
}

/* ---------- alerte ---------- */

export type Alert = {
  id: string;
  kind: "critic" | "epuizat" | "trend" | "agent" | "scadere";
  severity: "high" | "medium" | "info" | "low";
  text: string;
  minutes: number;
};

export const ALERTS: Alert[] = [
  { id: "a1", kind: "agent", severity: "medium", text: "Câmpulung: agentul nu a mai trimis date de 3 min. Vânzările așteaptă în bufferul local.", minutes: 3 },
  { id: "a2", kind: "critic", severity: "high", text: "Ray-Ban RB3025 Aviator: stoc critic la Mioveni (1 buc).", minutes: 12 },
  { id: "a3", kind: "epuizat", severity: "high", text: "Tom Ford FT5401: epuizat la I.C. Brătianu și Mioveni.", minutes: 38 },
  { id: "a4", kind: "trend", severity: "info", text: "Oakley Holbrook: vânzări +45% față de săptămâna trecută.", minutes: 64 },
  { id: "a5", kind: "scadere", severity: "low", text: "Gucci GG0027O: fără vânzări de 14 zile la Curtea de Argeș.", minutes: 190 },
];

import { rng } from "../kit";

/* ============================================================
   Date demonstrative pentru demo-ul Prosperanța.
   Totul e inventat și determinist: aceleași cifre la fiecare
   încărcare. Niciun nume, telefon sau email nu e real.
   ============================================================ */

/* ---------- culorile aplicației reale (index.css, HSL → hex) ---------- */
export const C = {
  red: "#E0061C", // --primary 354 95% 45%
  redDeep: "#C7051A", // gradient-campaign start
  redInk: "#B8051A",
  orange: "#F59E24", // --secondary 35 91% 55%
  flame: "#F95706", // gradient-campaign end
  fg: "#1A1A1A", // --foreground
  muted: "#F5F5F5", // --muted
  mutedFg: "#666666", // --muted-foreground
  soft: "#8A8A8A",
  border: "#E5E5E5", // --border
  bg: "#FFFFFF",
  green: "#12803A",
  greenBg: "#E7F5EC",
  heroGrad: "linear-gradient(135deg, #E0061C 0%, #F59E24 100%)",
  campGrad: "linear-gradient(120deg, #C7051A 0%, #F95706 100%)",
  shadow: "0 8px 24px -8px rgba(224, 6, 28, 0.25)",
};

export const FONT = 'var(--font-switzer), "Segoe UI", system-ui, -apple-system, sans-serif';

/* ---------- combustibil ---------- */
export type Fuel = "benzina" | "motorina" | "gpl";
export const FUELS: { id: Fuel; label: string; price: number }[] = [
  { id: "benzina", label: "Benzină", price: 7.49 },
  { id: "motorina", label: "Motorină", price: 7.58 },
  { id: "gpl", label: "GPL", price: 3.69 },
];
export const fuelLabel = (f: Fuel) => FUELS.find((x) => x.id === f)!.label;
export const fuelPrice = (f: Fuel) => FUELS.find((x) => x.id === f)!.price;
export const PPL_INIT: Record<Fuel, number> = { benzina: 1, motorina: 1, gpl: 2 };

/* ---------- stațiile (16, Pitești și împrejurimi) ----------
   x/y = poziția pe harta stilizată (viewBox 600×380). */
export type Station = {
  id: number;
  name: string;
  town: string;
  x: number;
  y: number;
  w: number;
  staff: string[];
};
export const STATIONS: Station[] = [
  { id: 0, name: "Calea Craiovei", town: "Pitești", x: 262, y: 236, w: 1.32, staff: ["Ionuț Dobre", "Raluca Stan", "Marius Enache"] },
  { id: 1, name: "Petrochimiștilor", town: "Pitești", x: 336, y: 250, w: 1.18, staff: ["Adrian Neagu", "Simona Preda"] },
  { id: 2, name: "Exercițiu", town: "Pitești", x: 283, y: 170, w: 1.04, staff: ["Cătălin Toma", "Oana Iordache"] },
  { id: 3, name: "Calea București", town: "Pitești", x: 352, y: 214, w: 1.24, staff: ["Sorin Lazăr", "Bianca Vasile", "Paul Dinu"] },
  { id: 4, name: "Trivale", town: "Pitești", x: 244, y: 198, w: 0.82, staff: ["Daniel Oprea", "Irina Barbu"] },
  { id: 5, name: "Găvana", town: "Pitești", x: 326, y: 178, w: 0.94, staff: ["Florin Anghel", "Carmen Diaconu"] },
  { id: 6, name: "Prundu", town: "Pitești", x: 297, y: 218, w: 0.88, staff: ["Radu Nistor", "Alina Moldovan"] },
  { id: 7, name: "Războieni", town: "Pitești", x: 300, y: 136, w: 0.9, staff: ["George Ene", "Laura Cojocaru"] },
  { id: 8, name: "Mioveni", town: "Mioveni", x: 444, y: 146, w: 1.02, staff: ["Vlad Marin", "Teodora Dobre"] },
  { id: 9, name: "Ștefănești", town: "Ștefănești", x: 402, y: 190, w: 0.86, staff: ["Lucian Voicu", "Ana Tudor"] },
  { id: 10, name: "Bascov", town: "Bascov", x: 206, y: 150, w: 0.9, staff: ["Costel Radu", "Mihaela Stoica"] },
  { id: 11, name: "Mărăcineni", town: "Mărăcineni", x: 312, y: 88, w: 0.78, staff: ["Gabriel Constantin", "Diana Mihăilă"] },
  { id: 12, name: "Bradu", town: "Bradu", x: 384, y: 282, w: 0.96, staff: ["Bogdan Dumitru", "Roxana Lazăr"] },
  { id: 13, name: "Topoloveni A1", town: "Topoloveni", x: 540, y: 306, w: 1.48, staff: ["Ștefan Popescu", "Andreea Neagu", "Cristian Barbu"] },
  { id: 14, name: "Costești", town: "Costești", x: 128, y: 330, w: 0.84, staff: ["Marian Toma", "Elena Ionescu"] },
  { id: 15, name: "Curtea de Argeș", town: "Curtea de Argeș", x: 96, y: 52, w: 1.06, staff: ["Alexandru Voicu", "Georgiana Ene"] },
];
const W_SUM = STATIONS.reduce((a, s) => a + s.w, 0);
export const stationShare = (id: number) => STATIONS[id].w / W_SUM;
export const stationName = (id: number) => STATIONS[id].name;

/* ---------- recompensele (catalogul din migrații) ---------- */
export type RewardIcon = "coffee" | "croissant" | "wash" | "drop" | "ticket" | "wrench" | "ticket50";
export type Reward = {
  id: number;
  title: string;
  description: string;
  points: number;
  prefix: string;
  icon: RewardIcon;
};
export const REWARDS: Reward[] = [
  { id: 1, title: "Cafea gratuită", description: "Un espresso la alegere din stație", points: 50, prefix: "CAFEA", icon: "coffee" },
  { id: 2, title: "Cafea și corn", description: "O cafea proaspătă și un corn la alegere", points: 100, prefix: "CAF", icon: "croissant" },
  { id: 3, title: "Spălare auto", description: "Program standard de spălare", points: 150, prefix: "WASH", icon: "wash" },
  { id: 4, title: "Lichid de parbriz", description: "Un bidon de lichid de parbriz", points: 200, prefix: "LPB", icon: "drop" },
  { id: 5, title: "Voucher 20 lei", description: "Reducere 20 lei la următoarea alimentare", points: 300, prefix: "V20", icon: "ticket" },
  { id: 6, title: "Service GPL −50 lei", description: "50 lei reducere la service GPL/GNL", points: 500, prefix: "GPL", icon: "wrench" },
  { id: 7, title: "Voucher 50 lei", description: "Reducere 50 lei la următoarea alimentare", points: 700, prefix: "V50", icon: "ticket50" },
];
export const rewardById = (id: number) => REWARDS.find((r) => r.id === id)!;

/* ---------- timp: „azi” e 23.09.2026, ora demo pornește la 09:41 ---------- */
const BASE = new Date(2026, 8, 23);
const p2 = (n: number) => String(n).padStart(2, "0");
/** offset 0 = azi, 1 = ieri … → „21.09.2026” */
export function dateLabel(offset: number, withYear = true) {
  const d = new Date(BASE);
  d.setDate(d.getDate() - offset);
  return withYear
    ? `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`
    : `${p2(d.getDate())}.${p2(d.getMonth() + 1)}`;
}
/** secunde de la miezul nopții → „09:41” */
export const clockLabel = (sec: number) => `${p2(Math.floor(sec / 3600) % 24)}:${p2(Math.floor(sec / 60) % 60)}`;
export const CLOCK_START = 9 * 3600 + 41 * 60;

/* ---------- oameni ---------- */
const FIRST = [
  "Elena", "Mihai", "Ioana", "Alexandru", "Maria", "Cristian", "Ana", "Gabriel", "Diana", "Florin",
  "Roxana", "Bogdan", "Laura", "Ionuț", "Simona", "Marius", "Andreea", "Radu", "Cristina", "Vlad",
  "Oana", "Adrian", "Raluca", "Sorin", "Georgiana", "Cătălin", "Mihaela", "Daniel", "Alina", "Ștefan",
  "Irina", "George", "Bianca", "Lucian", "Carmen", "Costel", "Teodora", "Paul", "Anca", "Dragoș",
];
const LAST = [
  "Popescu", "Ionescu", "Stan", "Dumitru", "Stoica", "Constantin", "Marin", "Tudor", "Dinu", "Radu",
  "Ene", "Niculescu", "Enache", "Voicu", "Barbu", "Neagu", "Preda", "Anghel", "Moldovan", "Toma",
  "Nistor", "Iordache", "Vasile", "Dobre", "Cojocaru", "Lazăr", "Oprea", "Diaconu", "Mihăilă", "Georgescu",
  "Pârvu", "Bălan", "Florea", "Matei", "Sandu", "Ilie", "Rusu", "Manole", "Ciobanu", "Zamfir",
];
export const short = (full: string) => {
  const [f, l] = full.split(" ");
  return l ? `${f} ${l[0]}.` : f;
};
export const initials = (full: string) =>
  full
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

/* ---------- clienți ---------- */
export type Customer = {
  id: number;
  name: string;
  tail: string; // ultimele 3 cifre ale telefonului
  mail: string; // mascat
  points: number;
  litres: number;
  visits: number;
  since: string;
  last: number; // zile de la ultima alimentare
  fav: number; // stația preferată
  fuel: Fuel;
  used: number; // vouchere folosite
};
export const phoneMask = (tail: string) => `07•• ••• ${tail}`;

const SINCE = ["mai 2026", "iun. 2026", "iul. 2026", "aug. 2026", "sept. 2026"];
function genCustomer(id: number): Customer {
  const r = rng(9100 + id * 13);
  const first = FIRST[(id * 7 + 3) % FIRST.length];
  const last = LAST[(id * 11 + 5) % LAST.length];
  const litres = Math.round(260 + r() * 4300);
  const fuelRoll = r();
  const fuel: Fuel = fuelRoll < 0.46 ? "benzina" : fuelRoll < 0.84 ? "motorina" : "gpl";
  const last30 = r();
  return {
    id,
    name: `${first} ${last}`,
    tail: String(100 + Math.floor(r() * 899)),
    mail: `${first[0].toLowerCase()}•••••${["@gmail.com", "@yahoo.com", "@gmail.com"][id % 3]}`,
    points: Math.round(r() * 1280 + 20),
    litres,
    visits: Math.max(3, Math.round(litres / (34 + r() * 12))),
    since: SINCE[Math.floor(r() * 4.6)],
    last: last30 < 0.7 ? Math.floor(r() * 12) : 30 + Math.floor(r() * 50),
    fav: Math.floor(r() * 16),
    fuel,
    used: Math.floor(r() * 9),
  };
}

/** Clientul din aplicația de telefon: contul „nostru”. */
export const ME_ID = 0;
export const CUSTOMERS_INIT: Customer[] = [
  {
    id: 0,
    name: "Andrei Munteanu",
    tail: "318",
    mail: "a•••••@gmail.com",
    points: 438,
    litres: 1846,
    visits: 41,
    since: "mai 2026",
    last: 2,
    fav: 0,
    fuel: "benzina",
    used: 4,
  },
  ...Array.from({ length: 47 }, (_, i) => genCustomer(i + 1)),
];

/* ---------- alimentări ---------- */
export type Fueling = {
  id: string;
  day: number; // offset față de azi
  time: string;
  station: number;
  fuel: Fuel;
  litres: number;
  points: number;
  note?: string; // pentru ajustări manuale
};

const ME_HISTORY: Fueling[] = [
  { id: "m1", day: 2, time: "18:12", station: 0, fuel: "benzina", litres: 42.3, points: 42 },
  { id: "m2", day: 6, time: "07:55", station: 2, fuel: "benzina", litres: 38.1, points: 38 },
  { id: "m3", day: 11, time: "19:40", station: 13, fuel: "benzina", litres: 51.6, points: 51 },
  { id: "m4", day: 15, time: "08:20", station: 0, fuel: "benzina", litres: 35, points: 35 },
  { id: "m5", day: 20, time: "17:05", station: 5, fuel: "benzina", litres: 40.7, points: 40 },
  { id: "m6", day: 25, time: "12:31", station: 0, fuel: "benzina", litres: 44.9, points: 44 },
  { id: "m7", day: 30, time: "09:14", station: 3, fuel: "benzina", litres: 39.2, points: 39 },
  { id: "m8", day: 34, time: "20:02", station: 13, fuel: "benzina", litres: 48.4, points: 48 },
];

export function baseHistory(c: Customer): Fueling[] {
  if (c.id === ME_ID) return ME_HISTORY;
  const r = rng(700 + c.id * 31);
  const out: Fueling[] = [];
  let day = c.last;
  for (let i = 0; i < 9; i++) {
    const litres = c.fuel === "gpl" ? 22 + r() * 24 : 26 + r() * 34;
    const hour = 6 + Math.floor(r() * 15);
    out.push({
      id: `h${c.id}-${i}`,
      day,
      time: `${p2(hour)}:${p2(Math.floor(r() * 60))}`,
      station: r() < 0.62 ? c.fav : Math.floor(r() * 16),
      fuel: c.fuel,
      litres: Math.round(litres * 10) / 10,
      points: Math.floor(litres * PPL_INIT[c.fuel]),
    });
    day += 3 + Math.floor(r() * 8);
  }
  return out;
}

/* ---------- vouchere ---------- */
export type VoucherStatus = "active" | "used" | "expired";
export type Voucher = {
  code: string;
  reward: number;
  customer: number;
  status: VoucherStatus;
  created: number; // offset zile
  expires: string;
  usedAt?: string;
};
export const VOUCHERS_INIT: Voucher[] = [
  { code: "WASH-7K3M9P2Q", reward: 3, customer: 0, status: "active", created: 9, expires: "14.12.2026" },
  { code: "CAFEA-H8R2TZ4N", reward: 1, customer: 0, status: "used", created: 21, expires: "01.12.2026", usedAt: "02.09.2026" },
  { code: "V20-M4XJ7Q9B", reward: 5, customer: 0, status: "used", created: 44, expires: "08.11.2026", usedAt: "19.08.2026" },
  { code: "CAF-2PLN8W6D", reward: 2, customer: 0, status: "expired", created: 118, expires: "21.08.2026" },
  { code: "V50-QZ7H3K2M", reward: 7, customer: 1, status: "active", created: 3, expires: "20.12.2026" },
  { code: "LPB-9D4TR8XA", reward: 4, customer: 2, status: "active", created: 5, expires: "18.12.2026" },
  { code: "CAFEA-5WN3JH7E", reward: 1, customer: 4, status: "active", created: 1, expires: "21.12.2026" },
];

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Același format ca generate_voucher_code(): PREFIX-XXXXXXXX. */
export function voucherCode(prefix: string, seq: number) {
  const r = rng(4200 + seq * 17);
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_CHARS[Math.floor(r() * CODE_CHARS.length)];
  return `${prefix}-${s}`;
}
export const expiryIn90 = () => dateLabel(-90);

/* ---------- campanii ---------- */
export type CampaignKind = "dublu" | "bonus" | "produs";
export type Campaign = {
  id: number;
  title: string;
  description: string;
  kind: CampaignKind;
  audience: string;
  reach: number;
  period: string;
  active: boolean;
  draft?: boolean;
  push?: boolean;
  sms?: boolean;
  joined: number;
  litres: number;
};
export const KIND_LABEL: Record<CampaignKind, string> = {
  dublu: "Puncte duble",
  bonus: "Puncte bonus",
  produs: "Produs gratuit",
};
export const CAMPAIGNS_INIT: Campaign[] = [
  {
    id: 4,
    title: "Puncte duble la weekend",
    description: "Sâmbătă și duminică primești dublu numărul de puncte la fiecare alimentare!",
    kind: "dublu",
    audience: "Toți membrii",
    reach: 48271,
    period: "Sâm.–Dum. · tot septembrie",
    active: true,
    joined: 9412,
    litres: 386450,
  },
  {
    id: 3,
    title: "Lichid de parbriz gratuit",
    description: "Lichid de parbriz GRATUIT la 150 L alimentați în septembrie.",
    kind: "produs",
    audience: "Activi în ultimele 30 de zile",
    reach: 31904,
    period: "01.09 – 30.09",
    active: true,
    joined: 4218,
    litres: 702300,
  },
  {
    id: 2,
    title: "GPL: 2 puncte pe litru",
    description: "Fiecare litru de GPL valorează dublu, la toate cele 16 stații.",
    kind: "dublu",
    audience: "Clienți GPL",
    reach: 12440,
    period: "Permanent",
    active: true,
    joined: 7730,
    litres: 511800,
  },
  {
    id: 1,
    title: "Cafea din partea casei",
    description: "La prima alimentare după înscriere, cafeaua e din partea noastră.",
    kind: "produs",
    audience: "Membri noi",
    reach: 5120,
    period: "01.08 – 31.08",
    active: false,
    joined: 2964,
    litres: 118200,
  },
];

export const AUDIENCES = [
  { id: "toti", label: "Toți membrii", reach: 48271 },
  { id: "activi", label: "Activi · 30 de zile", reach: 31904 },
  { id: "inactivi", label: "Inactivi · 60+ zile", reach: 7812 },
  { id: "gpl", label: "Clienți GPL", reach: 12440 },
];

/* ---------- cifrele rețelei (luna curentă, până azi la 09:41) ---------- */
export const TOTALS_INIT = {
  monthRevenue: 30_846_215,
  monthLitres: 4_412_380,
  todayRevenue: 486_310,
  todayLitres: 66_840,
  todayTx: 1_742,
  members: 48_271,
  newToday: 37,
  points: 9_642_118,
  vouchers: 61_384,
};
export type Totals = typeof TOTALS_INIT;

/* ---------- serii zilnice pentru grafice ---------- */
const WEEKDAY = [0.9, 1.0, 0.96, 0.98, 1.03, 1.14, 1.19]; // dum…sâm
/** Litri pe zi în toată rețeaua, pentru ultimele `n` zile (până ieri). */
export function networkDaily(n: number) {
  const r = rng(77);
  const all: { label: string; total: number; club: number; day: number }[] = [];
  for (let off = 120; off >= 1; off--) {
    const d = new Date(BASE);
    d.setDate(d.getDate() - off);
    const trend = 1 + (120 - off) * 0.0011;
    const total = 176_000 * trend * WEEKDAY[d.getDay()] * (1 + (r() - 0.5) * 0.1);
    const share = 0.36 + (120 - off) * 0.001 + (r() - 0.5) * 0.02;
    all.push({ label: dateLabel(off, false), total, club: total * share, day: off });
  }
  return all.slice(-n);
}

/** Litri pe zi pentru o stație, ultimele `n` zile. */
export function stationDaily(id: number, n: number) {
  const r = rng(300 + id * 19);
  return networkDaily(n).map((d) => {
    const litres = d.total * stationShare(id) * (1 + (r() - 0.5) * 0.18);
    const tx = Math.round(litres / (36 + r() * 5));
    return {
      label: d.label,
      day: d.day,
      litres,
      tx,
      points: Math.round(litres * 0.41 * (1 + (r() - 0.5) * 0.1)),
      vouchers: Math.round(tx * 0.028 * (1 + (r() - 0.5) * 0.5)),
    };
  });
}

/** Litri pe oră pentru o stație, azi (06:00 → ora curentă). */
export function stationHourly(id: number, uptoHour: number) {
  const r = rng(900 + id * 7);
  const curve = [0.55, 0.9, 1.25, 1.1, 0.95, 0.92, 1.0, 1.05, 0.98, 1.12, 1.3, 1.36, 1.2, 0.95, 0.72, 0.5, 0.36];
  const out: { label: string; litres: number }[] = [];
  for (let h = 6; h <= Math.min(22, uptoHour); h++) {
    out.push({
      label: `${p2(h)}`,
      litres: 820 * stationShare(id) * 16 * curve[h - 6] * (1 + (r() - 0.5) * 0.2),
    });
  }
  return out;
}

/* ---------- facturi (integrarea cu facturarea) ---------- */
export const COMPANIES = [
  "Nordic Trans Logistic SRL",
  "Agro Vitalis Argeș SRL",
  "Delta Construct Invest SRL",
  "Carpatic Distribuție SRL",
  "Sud Cargo Express SRL",
  "Vest Agregate SRL",
];
export type Invoice = { no: string; company: string; value: number; time: string; state: "trimisă" | "în lucru" };
export const INVOICES_INIT: Invoice[] = [
  { no: "PRS 2026/18342", company: COMPANIES[0], value: 1842.3, time: "09:38", state: "trimisă" },
  { no: "PRS 2026/18341", company: COMPANIES[1], value: 4120.75, time: "09:31", state: "trimisă" },
  { no: "PRS 2026/18340", company: COMPANIES[2], value: 986.4, time: "09:22", state: "trimisă" },
  { no: "PRS 2026/18339", company: COMPANIES[3], value: 2615.1, time: "09:10", state: "trimisă" },
  { no: "PRS 2026/18338", company: COMPANIES[4], value: 758.9, time: "08:57", state: "trimisă" },
];

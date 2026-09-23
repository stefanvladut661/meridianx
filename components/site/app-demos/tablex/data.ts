import { rng } from "../kit";
import type { StatusMasa } from "./theme";

/* ============================================================
   Datele demo-ului TableX. Toate inventate, toate deterministe.

   Planul sălii folosește aceeași geometrie ca harta demonstrativă
   din aplicația reală (zones.canvas_*, tables.pozitie_*), iar
   regulile de status sunt cele din produs: culoarea unei mese e o
   funcție de timp, calculată din rezervări — durată + buffer de
   15 minute, „se eliberează” în ultimele 20 de minute.
   ============================================================ */

export type ZonaId = "salon" | "terasa";
export type Forma = "rotunda" | "patrata" | "dreptunghiulara";

export type Zona = { id: ZonaId; nume: string; w: number; h: number; grid: number };

export type Masa = {
  id: string;
  zona: ZonaId;
  numar: string;
  cap: number;
  forma: Forma;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  indisponibila?: boolean;
  /** Mese unite pentru un grup mare (§28.6). */
  grup?: string;
};

export type TipStructura =
  | "perete"
  | "usa"
  | "bar"
  | "dj"
  | "vip"
  | "intrare"
  | "bucatarie"
  | "planta"
  | "piscina";

export type Element = {
  tip: TipStructura;
  x: number;
  y: number;
  w: number;
  h: number;
  eticheta?: string;
  z?: number;
};

export type StatusRez = "pending" | "confirmata" | "sosita" | "anulata" | "no_show" | "respinsa";
export type Sursa = "widget" | "manual" | "walk_in" | "telefon";

export type Rez = {
  id: string;
  nume: string;
  /** Telefon inventat, afișat mereu mascat. */
  tel?: string;
  pers: number;
  /** Ora de start, zecimal (19.5 = 19:30). */
  start: number;
  /** Durata, în ore. */
  dur: number;
  masa: string | null;
  /** Masa cerută din pagina publică — o cerere, nu o alocare. */
  masaDorita?: string | null;
  status: StatusRez;
  sursa: Sursa;
  nota?: string;
  noteInterne?: string;
  eveniment?: boolean;
  clientId?: string;
  /** Intrată în timpul demo-ului (evidențiată în liste). */
  nou?: boolean;
};

export const BUFFER = 0.25;
export const PRAG_EXPIRARE = 20 / 60;
export const DURATA_IMPLICITA = 2;
export const PROGRAM = { deLa: 10, panaLa: 23.5 };
/** „Acum”-ul demo-ului: vineri, 19:30 — ora de vârf. */
export const START_MINUT = 19 * 60 + 30;
export const ZI_AZI = "Vineri, 25 septembrie";
export const ZI_SCURTA = "vin. 25 sept.";

export const RESTAURANT = {
  nume: "Trattoria Nord",
  oras: "Cluj-Napoca",
  tip: "Restaurant italian",
  slug: "trattoria-nord",
};

/* ---------------- sala ---------------- */

export const ZONE: Zona[] = [
  { id: "salon", nume: "Salon interior", w: 1200, h: 800, grid: 20 },
  { id: "terasa", nume: "Terasă", w: 1000, h: 700, grid: 20 },
];

const PERETI_SALON: Element[] = [
  { tip: "perete", x: 0, y: 0, w: 1200, h: 14 },
  { tip: "perete", x: 0, y: 786, w: 1200, h: 14 },
  { tip: "perete", x: 0, y: 0, w: 14, h: 800 },
  { tip: "perete", x: 1186, y: 0, w: 14, h: 800 },
];

export const STRUCTURA: Record<ZonaId, Element[]> = {
  salon: [
    ...PERETI_SALON,
    { tip: "vip", x: 880, y: 540, w: 280, h: 220, eticheta: "Zona VIP", z: 0 },
    { tip: "bar", x: 60, y: 50, w: 340, h: 74, eticheta: "Bar", z: 1 },
    { tip: "bucatarie", x: 960, y: 40, w: 200, h: 150, eticheta: "Bucătărie", z: 1 },
    { tip: "dj", x: 60, y: 660, w: 130, h: 100, eticheta: "Scenă jazz", z: 1 },
    { tip: "intrare", x: 520, y: 740, w: 160, h: 46, eticheta: "Intrare", z: 1 },
    { tip: "usa", x: 960, y: 200, w: 90, h: 14, z: 1 },
    { tip: "planta", x: 440, y: 60, w: 44, h: 44, z: 2 },
    { tip: "planta", x: 760, y: 700, w: 44, h: 44, z: 2 },
    { tip: "planta", x: 250, y: 700, w: 44, h: 44, z: 2 },
  ],
  terasa: [
    { tip: "perete", x: 0, y: 0, w: 1000, h: 14 },
    { tip: "perete", x: 0, y: 0, w: 14, h: 700 },
    { tip: "piscina", x: 560, y: 300, w: 320, h: 220, eticheta: "Fântână", z: 0 },
    { tip: "bar", x: 80, y: 40, w: 260, h: 66, eticheta: "Bar terasă", z: 1 },
    { tip: "intrare", x: 40, y: 620, w: 150, h: 44, eticheta: "Acces salon", z: 1 },
    { tip: "planta", x: 500, y: 80, w: 46, h: 46, z: 2 },
    { tip: "planta", x: 900, y: 120, w: 46, h: 46, z: 2 },
    { tip: "planta", x: 480, y: 580, w: 46, h: 46, z: 2 },
    { tip: "planta", x: 920, y: 600, w: 46, h: 46, z: 2 },
  ],
};

function masa(
  zona: ZonaId,
  numar: string,
  x: number,
  y: number,
  o: Partial<Pick<Masa, "cap" | "forma" | "w" | "h" | "rot" | "indisponibila" | "grup">> = {}
): Masa {
  const forma = o.forma ?? "rotunda";
  const rot = forma === "rotunda";
  return {
    id: numar,
    zona,
    numar,
    cap: o.cap ?? 4,
    forma,
    x,
    y,
    w: o.w ?? (rot ? 84 : 130),
    h: o.h ?? (rot ? 84 : 74),
    rot: o.rot ?? 0,
    indisponibila: o.indisponibila,
    grup: o.grup,
  };
}

export const MESE: Masa[] = [
  masa("salon", "1", 110, 230, { cap: 2, w: 70, h: 70 }),
  masa("salon", "2", 280, 230),
  masa("salon", "3", 450, 230),
  masa("salon", "4", 620, 230),
  masa("salon", "5", 110, 380),
  masa("salon", "6", 280, 380, { cap: 6, forma: "dreptunghiulara" }),
  masa("salon", "7", 450, 380),
  masa("salon", "8", 620, 380, { cap: 2, w: 70, h: 70 }),
  masa("salon", "9", 110, 530, { forma: "patrata", w: 90, h: 90 }),
  masa("salon", "10", 280, 530),
  masa("salon", "11", 450, 530, { cap: 6, forma: "dreptunghiulara" }),
  masa("salon", "12", 700, 480, { cap: 8, forma: "dreptunghiulara", w: 150, h: 84, rot: 90 }),
  masa("salon", "V1", 920, 590, { cap: 6, forma: "dreptunghiulara", grup: "vip" }),
  masa("salon", "V2", 920, 672, { cap: 6, forma: "dreptunghiulara", grup: "vip" }),
  masa("salon", "13", 1040, 300, { cap: 2, w: 70, h: 70, indisponibila: true }),
  masa("terasa", "T1", 100, 180),
  masa("terasa", "T2", 260, 180),
  masa("terasa", "T3", 420, 180, { cap: 2, w: 70, h: 70 }),
  masa("terasa", "T4", 100, 340, { cap: 6, forma: "dreptunghiulara" }),
  masa("terasa", "T5", 280, 360),
  masa("terasa", "T6", 100, 500),
  masa("terasa", "T7", 280, 500, { cap: 2, w: 70, h: 70 }),
  masa("terasa", "T8", 700, 120, { cap: 8, forma: "dreptunghiulara", w: 160 }),
];

export const MASA_DUPA_ID: Record<string, Masa> = Object.fromEntries(MESE.map((m) => [m.id, m]));

export function numeZona(id: ZonaId) {
  return ZONE.find((z) => z.id === id)?.nume ?? "";
}

/** Mesele pe care le ocupă o rezervare: masa ei, plus grupul unit. */
export function meseRezervare(r: Pick<Rez, "masa">): string[] {
  if (!r.masa) return [];
  const m = MASA_DUPA_ID[r.masa];
  if (m?.grup) return MESE.filter((x) => x.grup === m.grup).map((x) => x.id);
  return [r.masa];
}

export function capacitate(masaId: string) {
  const m = MASA_DUPA_ID[masaId];
  if (!m) return 0;
  if (m.grup) return MESE.filter((x) => x.grup === m.grup).reduce((s, x) => s + x.cap, 0);
  return m.cap;
}

/* ---------------- timp ---------------- */

export function fmtOra(h: number) {
  const tot = Math.round(h * 60);
  const hh = Math.floor(tot / 60);
  const mm = tot % 60;
  return `${String(((hh % 24) + 24) % 24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export const activa = (r: Rez) =>
  r.status === "pending" || r.status === "confirmata" || r.status === "sosita";

/**
 * Statusul fiecărei mese la ora dată — același model ca `statusuriLaMoment`
 * din HartaPage: roșu cât ține rezervarea plus buffer-ul, amber în ultimele
 * 20 de minute și cât cererea e încă în așteptare, violet pentru eveniment.
 */
export function statusuriLa(h: number, rez: Rez[]) {
  const status: Record<string, StatusMasa> = {};
  const peMasa: Record<string, Rez> = {};
  for (const m of MESE) if (m.indisponibila) status[m.id] = "inactiv";
  for (const r of rez) {
    if (!activa(r) || !r.masa) continue;
    const sfarsit = r.start + r.dur;
    if (h < r.start || h >= sfarsit + BUFFER) continue;
    const s: StatusMasa = r.eveniment
      ? "eveniment"
      : r.status === "pending" || sfarsit - h <= PRAG_EXPIRARE
        ? "expirare"
        : "ocupat";
    for (const id of meseRezervare(r)) {
      status[id] = s;
      peMasa[id] = r;
    }
  }
  return { status, peMasa };
}

export const statusMasa = (st: Record<string, StatusMasa>, id: string): StatusMasa =>
  st[id] ?? "liber";

/**
 * Blocarea dură din §15.3: două rezervări active nu pot sta pe aceeași masă
 * în intervale care se suprapun, buffer-ul inclus. Fără forțare.
 */
export function conflict(rez: Rez[], masaId: string, start: number, dur: number, exceptId?: string) {
  const tinta = meseRezervare({ masa: masaId });
  const a0 = start;
  const a1 = start + dur + BUFFER;
  return (
    rez.find((r) => {
      if (r.id === exceptId || !activa(r) || !r.masa) return false;
      if (!meseRezervare(r).some((id) => tinta.includes(id))) return false;
      const b0 = r.start;
      const b1 = r.start + r.dur + BUFFER;
      return a0 < b1 && b0 < a1;
    }) ?? null
  );
}

/** Următoarea rezervare activă pe o masă, după ora dată. */
export function urmatoareaPeMasa(rez: Rez[], masaId: string, h: number) {
  return rez
    .filter((r) => activa(r) && r.masa && meseRezervare(r).includes(masaId) && r.start > h)
    .sort((a, b) => a.start - b.start)[0];
}

/* ---------------- telefoane (inventate, afișate mascat) ---------------- */

export function telMascat(tel?: string) {
  if (!tel) return "fără telefon";
  const d = tel.replace(/\D/g, "");
  return `${d.slice(0, 4)} ••• ${d.slice(-3)}`;
}

/* ---------------- rezervările zilei ---------------- */

let seq = 0;
function rz(
  nume: string,
  masaId: string | null,
  start: number,
  pers: number,
  status: StatusRez,
  sursa: Sursa,
  extra: Partial<Rez> = {}
): Rez {
  seq += 1;
  const r = rng(seq * 97 + 13);
  const tel = `07${2 + Math.floor(r() * 7)}${Math.floor(r() * 10)}${String(Math.floor(r() * 1e6)).padStart(6, "0")}`;
  return {
    id: `r${seq}`,
    nume,
    tel: sursa === "walk_in" ? undefined : tel,
    pers,
    start,
    dur: DURATA_IMPLICITA,
    masa: masaId,
    status,
    sursa,
    clientId: sursa === "walk_in" || extra.eveniment ? undefined : idClient(nume),
    ...extra,
  };
}

/** Semnele diacritice combinate (U+0300–U+036F), după normalizarea NFD. */
export const DIACRITICE = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

export function idClient(nume: string) {
  return (
    "c-" +
    nume
      .toLowerCase()
      .normalize("NFD")
      .replace(DIACRITICE, "")
      .replace(/[^a-z]+/g, "-")
  );
}

export const REZ_INITIALE: Rez[] = [
  // prânzul, încheiat
  rz("Grupul Ionescu", "6", 12, 6, "sosita", "telefon"),
  rz("Elena Marinescu", "10", 13, 4, "sosita", "widget"),
  rz("Victor Dinu", "3", 12.5, 2, "sosita", "widget"),
  rz("Ana Crișan", "T2", 13.5, 3, "sosita", "widget"),
  rz("Sorin Vlad", "9", 14, 4, "no_show", "widget"),
  rz("Bianca Tudor", "5", 13, 2, "anulata", "telefon"),
  rz("Walk-in masa 4", "4", 13.25, 2, "sosita", "walk_in", { dur: 1.5 }),
  rz("Horia Nistor", "T6", 14.5, 4, "sosita", "widget"),
  // seara, salon
  rz("Irina Pavel", "1", 18.75, 2, "sosita", "widget", { nota: "Masa de lângă bar, dacă se poate." }),
  rz("Familia Georgescu", "2", 18, 4, "sosita", "telefon"),
  rz("Radu Marin", "3", 20.5, 4, "confirmata", "widget", {
    nota: "Aniversare — aducem noi tortul, la desert.",
  }),
  rz("Cristina Ene", "4", 19, 4, "sosita", "telefon"),
  rz("Paul Stoica", "5", 22, 2, "confirmata", "widget"),
  rz("Dan Petrescu", "6", 19, 6, "confirmata", "telefon", {
    nota: "Venim cu un copil mic, avem nevoie de scaun înalt.",
    noteInterne: "A sunat la 19:10: întârzie 20 de minute.",
  }),
  rz("Laura Dobre", "7", 17.75, 2, "sosita", "widget"),
  rz("Andrei Popa", "2", 20.5, 4, "confirmata", "widget"),
  rz("Alexandra Neagu", "9", 19.25, 4, "sosita", "widget"),
  rz("Mihai Barbu", "10", 21.75, 3, "confirmata", "widget", { nota: "Alergie la nuci." }),
  rz("Oana Rusu", "11", 18.5, 5, "sosita", "widget"),
  rz("Bilete jazz · masa 12", "12", 19, 8, "sosita", "manual", { eveniment: true, dur: 4 }),
  rz("Bilete jazz · VIP", "V1", 19, 12, "sosita", "manual", { eveniment: true, dur: 4 }),
  rz("Ioana Sima", "1", 21, 2, "confirmata", "widget"),
  rz("Tudor Iliescu", "4", 21.25, 4, "confirmata", "telefon"),
  rz("Colegii de la birou", "11", 20.75, 6, "confirmata", "widget", { clientId: idClient("Cosmin Avram") }),
  rz("Mara Lungu", "7", 20.25, 2, "confirmata", "widget"),
  rz("Gabriel Lazăr", "8", 18, 2, "no_show", "widget"),
  rz("Monica Stan", "5", 20, 2, "anulata", "widget"),
  // cereri netratate, fără masă
  rz("Cezar Munteanu", null, 21.5, 4, "pending", "widget"),
  rz("Sorin Vlad", null, 20.5, 4, "pending", "widget"),
  rz("Delia Popovici", null, 22, 2, "pending", "widget", {
    masaDorita: "8",
    nota: "Dacă se poate, la geam.",
  }),
  // terasa
  rz("Ștefan Moraru", "T1", 19, 4, "sosita", "widget"),
  rz("Roxana Filip", "T2", 18.5, 3, "sosita", "widget"),
  rz("Grup Avram", "T4", 20, 6, "confirmata", "telefon", { clientId: idClient("Cosmin Avram") }),
  rz("Walk-in masa T5", "T5", 17 + 40 / 60, 4, "sosita", "walk_in"),
  rz("Walk-in masa T7", "T7", 19 + 20 / 60, 2, "sosita", "walk_in"),
  rz("Aniversare Mocanu", "T8", 18, 8, "sosita", "telefon", {
    nota: "Tortul îl aduce familia.",
    clientId: idClient("Corina Mocanu"),
  }),
  rz("Raluca Toma", "T3", 21.75, 2, "confirmata", "widget"),
  rz("Adrian Oprea", "T6", 21.75, 4, "confirmata", "widget"),
];

/**
 * Cererile care intră „live” din pagina publică, în timpul demo-ului.
 * Fără masă: personalul o alocă (§7.6). Unele cer o masă anume.
 */
export const CERERI_LIVE: Omit<Rez, "id">[] = [
  { nume: "Teodora Nistor", tel: telDin("Teodora Nistor"), pers: 2, start: 21.75, dur: 2, masa: null, status: "pending", sursa: "widget", nota: "Prima dată la voi." },
  { nume: "Matei Enache", tel: telDin("Matei Enache"), pers: 4, start: 22, dur: 2, masa: null, masaDorita: "10", status: "pending", sursa: "widget" },
  { nume: "Larisa Bălan", tel: telDin("Larisa Bălan"), pers: 3, start: 21.5, dur: 2, masa: null, status: "pending", sursa: "widget", nota: "Avem un cățel mic, stăm pe terasă." },
  { nume: "Rareș Suciu", tel: telDin("Rareș Suciu"), pers: 6, start: 22.25, dur: 2, masa: null, status: "pending", sursa: "widget" },
  { nume: "Denisa Florea", tel: telDin("Denisa Florea"), pers: 2, start: 21.25, dur: 2, masa: null, masaDorita: "T3", status: "pending", sursa: "widget" },
  { nume: "Octavian Ghiță", tel: telDin("Octavian Ghiță"), pers: 5, start: 22.5, dur: 2, masa: null, status: "pending", sursa: "widget", nota: "Zi de naștere, o lumânare la desert." },
];

/* ---------------- clienți (CRM) ---------------- */

export type Vizita = {
  data: string;
  ora: string;
  pers: number;
  masa: string;
  status: "sosita" | "no_show" | "anulata";
  sursa: Sursa;
};

export type Client = {
  id: string;
  nume: string;
  tel: string;
  email?: string;
  taguri: string[];
  vizite: number;
  noShow: number;
  /** Zile de la ultima vizită (0 = azi). */
  ultima: number;
  persMedii: number;
  note?: string;
  gdpr: string;
  clientDin: string;
};

const PRENUME = [
  "Andrei", "Ioana", "Mihai", "Elena", "Radu", "Cristina", "Alexandru", "Maria", "Bogdan", "Ana",
  "Vlad", "Irina", "Ștefan", "Oana", "Tudor", "Laura", "Paul", "Bianca", "Dan", "Roxana",
  "Sorin", "Delia", "Cezar", "Mara", "Victor", "Alina", "George", "Diana", "Florin", "Simona",
  "Adrian", "Raluca", "Cosmin", "Gabriela", "Lucian", "Andreea", "Marius", "Corina", "Octavian",
  "Teodora", "Horia", "Iulia", "Emil", "Carmen", "Sergiu", "Anca", "Rareș", "Denisa", "Matei", "Larisa",
];
const NUME = [
  "Popescu", "Ionescu", "Marin", "Ene", "Dinu", "Stoica", "Barbu", "Rusu", "Neagu", "Georgescu",
  "Pavel", "Lungu", "Petrescu", "Dobre", "Moraru", "Filip", "Cojocaru", "Avram", "Mocanu", "Vlad",
  "Popovici", "Munteanu", "Crișan", "Tudor", "Marinescu", "Sima", "Iliescu", "Lazăr", "Stan", "Popa",
  "Matei", "Toma", "Nistor", "Oprea", "Radu", "Constantin", "Dumitrescu", "Șerban", "Bălan", "Enache",
  "Florea", "Ghiță", "Manole", "Pop", "Suciu", "Voicu", "Zamfir", "Anghel", "Istrate", "Căpraru",
];
const TAGURI_POSIBILE = ["Fidel", "VIP", "Aniversare", "Business", "Terasă", "Vegetarian", "Copii", "Alergie nuci", "Vin roșu"];

const LUNI = ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."];
const ZILE_SAPT = ["dum.", "lun.", "mar.", "mie.", "joi", "vin.", "sâm."];
/** Azi, în demo: 25 septembrie 2026 (vineri). */
const AZI = Date.UTC(2026, 8, 25);

export function dataCuZile(zileInUrma: number, cuAn = false) {
  const d = new Date(AZI - zileInUrma * 86400000);
  const s = `${d.getUTCDate()} ${LUNI[d.getUTCMonth()]}`;
  return cuAn ? `${s} ${d.getUTCFullYear()}` : s;
}
export function ziSaptCuZile(zileInUrma: number) {
  return ZILE_SAPT[new Date(AZI - zileInUrma * 86400000).getUTCDay()];
}

/** Un număr inventat, stabil pentru un nume dat. */
function telDin(nume: string) {
  let h = 7;
  for (const ch of nume) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return tel(rng(h));
}

function tel(r: () => number) {
  return `07${2 + Math.floor(r() * 7)}${Math.floor(r() * 10)}${String(Math.floor(r() * 1e6)).padStart(6, "0")}`;
}

const DETALII_NUMITI: Record<string, Partial<Client>> = {
  "Irina Pavel": { taguri: ["VIP", "Vin roșu"], vizite: 23, ultima: 6, note: "Preferă masa 1, lângă bar. Bea Fetească Neagră." },
  "Radu Marin": { taguri: ["Aniversare", "Fidel"], vizite: 9, ultima: 13 },
  "Sorin Vlad": { taguri: [], vizite: 3, noShow: 2, ultima: 23, note: "De două ori a confirmat și n-a mai ajuns. Sunăm înainte să confirmăm." },
  "Dan Petrescu": { taguri: ["Copii"], vizite: 6, ultima: 20, note: "Vine cu un copil mic: scaun înalt pregătit." },
  "Cristina Ene": { taguri: ["Business"], vizite: 14, ultima: 8 },
  "Alexandra Neagu": { taguri: ["Fidel"], vizite: 11, ultima: 15 },
  "Oana Rusu": { taguri: ["Vegetarian"], vizite: 5, ultima: 27 },
  "Paul Stoica": { taguri: [], vizite: 2, ultima: 41 },
  "Mihai Barbu": { taguri: ["Alergie nuci"], vizite: 7, ultima: 19, note: "Alergie severă la nuci — anunțăm bucătăria la fiecare comandă." },
  "Ioana Sima": { taguri: ["VIP"], vizite: 18, ultima: 4 },
  "Laura Dobre": { taguri: [], vizite: 4, ultima: 33 },
  "Mara Lungu": { taguri: ["Terasă"], vizite: 3, ultima: 52 },
  "Andrei Popa": { taguri: ["Fidel"], vizite: 8, ultima: 11 },
  "Elena Marinescu": { taguri: ["Business", "Fidel"], vizite: 12, ultima: 0 },
  "Cezar Munteanu": { taguri: [], vizite: 1, ultima: 64 },
  "Delia Popovici": { taguri: [], vizite: 2, ultima: 38 },
  "Ștefan Moraru": { taguri: ["Terasă"], vizite: 10, ultima: 9 },
  "Roxana Filip": { taguri: [], vizite: 6, ultima: 22 },
  "Raluca Toma": { taguri: [], vizite: 3, ultima: 45 },
  "Adrian Oprea": { taguri: ["Fidel"], vizite: 5, ultima: 17 },
  "Tudor Iliescu": { taguri: ["Business"], vizite: 9, ultima: 12 },
  "Gabriel Lazăr": { taguri: [], vizite: 2, noShow: 1, ultima: 34 },
  "Grupul Ionescu": { taguri: ["Business"], vizite: 7, ultima: 0 },
  "Victor Dinu": { taguri: [], vizite: 4, ultima: 0 },
  "Ana Crișan": { taguri: [], vizite: 3, ultima: 0 },
  "Bianca Tudor": { taguri: [], vizite: 5, ultima: 29 },
  "Horia Nistor": { taguri: ["Terasă"], vizite: 6, ultima: 0 },
  "Familia Georgescu": { taguri: ["Copii", "Fidel"], vizite: 15, ultima: 0 },
  "Cosmin Avram": { taguri: ["Business"], vizite: 13, ultima: 10, note: "Organizează ieșirile echipei; cere factură pe firmă." },
  "Corina Mocanu": { taguri: ["Aniversare"], vizite: 4, ultima: 0 },
  "Monica Stan": { taguri: [], vizite: 1, ultima: 70 },
  "Teodora Nistor": { taguri: [], vizite: 0, ultima: 0 },
  "Matei Enache": { taguri: [], vizite: 3, ultima: 26 },
  "Larisa Bălan": { taguri: ["Terasă"], vizite: 2, ultima: 31 },
  "Rareș Suciu": { taguri: [], vizite: 1, ultima: 88 },
  "Denisa Florea": { taguri: [], vizite: 4, ultima: 16 },
  "Octavian Ghiță": { taguri: ["Aniversare"], vizite: 2, ultima: 120 },
};

export const TOTAL_CLIENTI = 2418;

function genClienti(): Client[] {
  const r = rng(2418);
  const out: Client[] = [];
  const vazuti = new Set<string>();
  for (const [nume, d] of Object.entries(DETALII_NUMITI)) {
    const rr = rng(nume.length * 131 + nume.charCodeAt(0));
    vazuti.add(nume);
    out.push({
      id: idClient(nume),
      nume,
      tel: tel(rr),
      email: rr() > 0.4 ? `${idClient(nume).slice(2).replace(/-/g, ".")}@exemplu.ro` : undefined,
      taguri: d.taguri ?? [],
      vizite: d.vizite ?? 1,
      noShow: d.noShow ?? 0,
      ultima: d.ultima ?? 30,
      persMedii: 2 + Math.round(rr() * 25) / 10,
      note: d.note,
      gdpr: dataCuZile(40 + Math.floor(rr() * 500), true),
      clientDin: dataCuZile(60 + Math.floor(rr() * 700), true),
    });
  }
  let i = 0;
  while (out.length < TOTAL_CLIENTI && i < 20000) {
    i++;
    const nume = `${PRENUME[Math.floor(r() * PRENUME.length)]} ${NUME[Math.floor(r() * NUME.length)]}`;
    if (vazuti.has(nume)) {
      // omonimi reali există; aici îi deosebim cu inițiala tatălui
      const alt = `${nume.split(" ")[0]} ${"ABCDEFGIMNPRST"[Math.floor(r() * 14)]}. ${nume.split(" ")[1]}`;
      if (vazuti.has(alt)) continue;
      vazuti.add(alt);
      out.push(clientGenerat(alt, r, out.length));
      continue;
    }
    vazuti.add(nume);
    out.push(clientGenerat(nume, r, out.length));
  }
  return out;
}

function clientGenerat(nume: string, r: () => number, idx: number): Client {
  const vizite = Math.max(1, Math.round(Math.pow(r(), 2.2) * 26));
  const taguri: string[] = [];
  if (vizite >= 10 && r() > 0.3) taguri.push("Fidel");
  if (r() > 0.93) taguri.push("VIP");
  if (r() > 0.88) taguri.push(TAGURI_POSIBILE[2 + Math.floor(r() * (TAGURI_POSIBILE.length - 2))]);
  const noShow = r() > 0.955 ? 2 + Math.floor(r() * 2) : r() > 0.85 ? 1 : 0;
  return {
    id: `${idClient(nume)}-${idx}`,
    nume,
    tel: tel(r),
    email: r() > 0.5 ? `${idClient(nume).slice(2).replace(/-/g, ".")}@exemplu.ro` : undefined,
    taguri,
    vizite,
    noShow,
    ultima: Math.floor(Math.pow(r(), 1.6) * 360) + 1,
    persMedii: 2 + Math.round(r() * 30) / 10,
    gdpr: dataCuZile(20 + Math.floor(r() * 700), true),
    clientDin: dataCuZile(30 + Math.floor(r() * 900), true),
  };
}

let cacheClienti: Client[] | null = null;
export function clienti(): Client[] {
  if (!cacheClienti) {
    cacheClienti = genClienti().sort((a, b) => a.ultima - b.ultima || b.vizite - a.vizite);
  }
  return cacheClienti;
}

/** Istoricul unui client, determinist pe id. */
export function istoric(c: Client): Vizita[] {
  const r = rng(c.id.length * 7919 + c.vizite * 31 + c.noShow);
  const total = Math.min(c.vizite + c.noShow, 12);
  const noShowIdx = new Set<number>();
  while (noShowIdx.size < Math.min(c.noShow, total)) noShowIdx.add(Math.floor(r() * total));
  const out: Vizita[] = [];
  let zile = c.ultima;
  const mese = MESE.filter((m) => !m.indisponibila);
  const ore = ["12:30", "13:00", "19:00", "19:30", "20:00", "20:30", "21:00"];
  for (let i = 0; i < total; i++) {
    const m = mese[Math.floor(r() * mese.length)];
    out.push({
      data: dataCuZile(zile, true),
      ora: ore[Math.floor(r() * ore.length)],
      pers: Math.max(1, Math.min(m.cap, Math.round(c.persMedii + (r() - 0.5) * 2))),
      masa: m.numar,
      status: noShowIdx.has(i) ? "no_show" : r() > 0.95 ? "anulata" : "sosita",
      sursa: (["widget", "widget", "widget", "telefon", "walk_in", "manual"] as Sursa[])[Math.floor(r() * 6)],
    });
    zile += 7 + Math.floor(r() * 30);
  }
  return out;
}

/* ---------------- ultimele 30 de zile (Acasă) ---------------- */

export function ultimele30() {
  const r = rng(30);
  const zile: { eticheta: string; zi: string; persoane: number; rezervari: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const zs = ziSaptCuZile(i);
    const baza = zs === "vin." || zs === "sâm." ? 232 : zs === "dum." ? 176 : zs === "joi" ? 158 : 126;
    const persoane = Math.round(baza * (0.86 + r() * 0.28) * (1 + (29 - i) * 0.006));
    zile.push({
      eticheta: dataCuZile(i).replace(" sept.", ".09").replace(" aug.", ".08"),
      zi: zs,
      persoane,
      rezervari: Math.round(persoane / (3.2 + r() * 0.5)),
    });
  }
  return zile;
}

/* ---------------- rețeaua TableX (panoul echipei) ---------------- */

export const RESTAURANTE_RETEA = [
  { nume: "Trattoria Nord", oras: "Cluj-Napoca" },
  { nume: "Bistro Aurora", oras: "Brașov" },
  { nume: "Casa cu Tei", oras: "Iași" },
  { nume: "Terasa Parcului", oras: "Timișoara" },
  { nume: "Pescăria Mică", oras: "Constanța" },
  { nume: "Grădina Veche", oras: "Sibiu" },
  { nume: "Cafeneaua Luminii", oras: "București" },
  { nume: "Osteria Bella", oras: "Oradea" },
  { nume: "Bucătăria de Cartier", oras: "București" },
  { nume: "Vinoteca 9", oras: "Cluj-Napoca" },
  { nume: "Bodega Sud", oras: "Craiova" },
  { nume: "Hanul din Deal", oras: "Bistrița" },
  { nume: "Ceainăria Albastră", oras: "Iași" },
  { nume: "Grill & Co", oras: "Timișoara" },
  { nume: "Mâncăruri de Casă", oras: "Ploiești" },
  { nume: "Bistro 1900", oras: "București" },
];

export const ORASE_RETEA = [
  { oras: "București", restaurante: 54 },
  { oras: "Cluj-Napoca", restaurante: 38 },
  { oras: "Iași", restaurante: 24 },
  { oras: "Timișoara", restaurante: 21 },
  { oras: "Brașov", restaurante: 19 },
  { oras: "Constanța", restaurante: 16 },
  { oras: "Sibiu", restaurante: 13 },
  { oras: "Alte 22 de orașe", restaurante: 51 },
];

let mapClienti: Map<string, Client> | null = null;
export function clientDupaId(id?: string): Client | undefined {
  if (!id) return undefined;
  if (!mapClienti) mapClienti = new Map(clienti().map((c) => [c.id, c]));
  return mapClienti.get(id);
}

/** Ora rotunjită în jos la 5 minute — începutul unui walk-in. */
export const oraWalkIn = (h: number) => Math.floor(h * 12 + 1e-6) / 12;

export const persoane = (n: number) => `${n} ${n === 1 ? "persoană" : "persoane"}`;

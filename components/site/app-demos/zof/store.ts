import { createContext, useContext } from "react";
import { rng } from "../kit";
import type { DemoDevice } from "../types";
import {
  LOCS,
  fileName,
  fileNo,
  locById,
  makeSale,
  seedBuffered,
  seedSales,
  type Loc,
  type LocStatus,
  type Period,
  type Sale,
} from "./data";
import { clock, plural } from "./ui";

/* ============================================================
   Starea demo-ului: importurile care vin din magazine, semnalele
   de viață ale agenților, sincronizarea manuală.

   Totul e un reducer pur: aceleași acțiuni → aceeași stare.
   ============================================================ */

export type LocLive = {
  rev: number;
  receipts: number;
  units: number;
  records: number;
  lastSync: number;
  lastBeat: number;
  status: LocStatus;
  /** numărul ultimului export DorSoft importat */
  fileNo: number;
  /** sincronizare manuală în curs */
  syncing: boolean;
  /** rezultatul ultimei sincronizări manuale, afișat câteva secunde */
  result?: string;
};

/** sale = import · beat = semnal de viață · sync = import manual · online = agent reconectat · buffer = agent tăcut */
export type EvType = "sale" | "beat" | "sync" | "online" | "buffer";
export type Ev = { id: string; type: EvType; loc: string; at: number; text: string; status: "ok" | "warning" };

export type Live = {
  n: number;
  beatTicks: number;
  sales: Sale[];
  /** bonurile care așteaptă la agent (agentul nu ajunge la server) */
  buffered: Sale[];
  locs: Record<string, LocLive>;
  events: Ev[];
  /** semnalele de viață, separat: ar acoperi importurile din jurnal */
  beats: Ev[];
};

export type Action =
  | { type: "import"; at: number }
  | { type: "beat"; at: number }
  | { type: "syncStart"; id: string }
  | { type: "syncDone"; id: string; at: number }
  | { type: "syncClear"; id: string };

const MAX_SALES = 90;
const MAX_EVENTS = 60;
const MAX_BEATS = 40;

const lines = (s: Sale) => s.items.length;
const units = (s: Sale) => s.items.reduce((a, it) => a + it.qty, 0);

function importText(l: Loc, no: number, recs: number) {
  return `${fileName(l, no)} · ${plural(recs, "înregistrare", "înregistrări")}`;
}

/** Jurnalul de la pornire: exporturile periodice din ultimele ~14 minute, plus agentul tăcut. */
function seedEvents(base: number, sales: Sale[]): Ev[] {
  const out: Ev[] = [];
  const r = rng(4242);
  LOCS.forEach((l, i) => {
    if (l.type === "online") return;
    const every = (140 + i * 17) * 1000;
    let at = base - l.syncAgo * 1000;
    let no = fileNo(l);
    for (let k = 0; at > base - 14 * 60_000; k++) {
      out.push({ id: `e0-${l.id}-${k}`, type: "sale", loc: l.id, at, text: importText(l, no, 4 + Math.floor(r() * 14)), status: "ok" });
      at -= every * (0.8 + r() * 0.4);
      no -= 1;
    }
  });
  // zof.ro: fiecare comandă vine separat, prin webhook
  for (const s of sales) {
    if (s.loc === "zof-ro") out.push({ id: `e0-${s.id}`, type: "sale", loc: s.loc, at: s.at, text: s.receipt, status: "ok" });
  }
  const cl = LOCS.find((l) => l.id === "campulung")!;
  // serverul trece agentul pe „tăcut” după 2 minute fără semnal
  out.push({
    id: "e0-silent",
    type: "buffer",
    loc: cl.id,
    at: base - cl.syncAgo * 1000 + 120_000,
    text: `ultimul semnal ${clock(base - cl.syncAgo * 1000)}`,
    status: "warning",
  });
  return out.sort((a, b) => b.at - a.at).slice(0, MAX_EVENTS);
}

export function initLive(base: number): Live {
  const sales = seedSales(base);
  const buffered = seedBuffered(base);
  const locs: Record<string, LocLive> = {};
  const beats: Ev[] = [];
  // zof.ro n-are export periodic: ultimul import e ultima comandă
  const lastOrder = sales.find((s) => s.loc === "zof-ro")?.at;
  for (const l of LOCS) {
    const lastSync = l.type === "online" && lastOrder ? lastOrder : base - l.syncAgo * 1000;
    const lastBeat = l.status === "warning" ? lastSync : base - Math.min(l.syncAgo, 9) * 1000;
    locs[l.id] = {
      rev: l.today,
      receipts: l.receipts,
      units: l.units,
      records: l.records,
      lastSync,
      lastBeat,
      status: l.status,
      fileNo: fileNo(l),
      syncing: false,
    };
    if (l.status === "online") beats.push({ id: `b0-${l.id}`, type: "beat", loc: l.id, at: lastBeat, text: "", status: "ok" });
  }
  beats.sort((a, b) => b.at - a.at);
  return { n: 0, beatTicks: 0, sales, buffered, locs, events: seedEvents(base, sales), beats };
}

function add(loc: LocLive, s: Sale, at: number, recs: number): LocLive {
  return {
    ...loc,
    rev: loc.rev + s.value,
    receipts: loc.receipts + 1,
    units: loc.units + units(s),
    records: loc.records + recs,
    lastSync: at,
    lastBeat: at,
  };
}

/** Un bon nou dintr-un import: intră în jurnal sau, dacă agentul tace, rămâne la el. */
function addSale(st: Live, s: Sale): Live {
  const loc = st.locs[s.loc];
  if (loc.status === "warning") return { ...st, n: st.n + 1, buffered: [{ ...s, buffered: true }, ...st.buffered] };
  const l = locById(s.loc);
  const recs = lines(s) * 2; // liniile bonului + pozițiile de stoc pe care le mișcă
  const online = l.type === "online";
  const no = online ? loc.fileNo : loc.fileNo + 1;
  const ev: Ev = {
    id: `e-${s.id}`,
    type: "sale",
    loc: s.loc,
    at: s.at,
    text: online ? s.receipt : importText(l, no, recs),
    status: "ok",
  };
  return {
    ...st,
    n: st.n + 1,
    sales: [s, ...st.sales].slice(0, MAX_SALES),
    locs: { ...st.locs, [s.loc]: { ...add(loc, s, s.at, recs), fileNo: no } },
    events: [ev, ...st.events].slice(0, MAX_EVENTS),
  };
}

export function reducer(st: Live, a: Action): Live {
  switch (a.type) {
    case "import": {
      // un import aduce 2–3 bonuri, nu câte unul
      const k = 2 + (st.n % 2);
      let next = st;
      for (let i = 0; i < k; i++) next = addSale(next, makeSale(1104 + next.n, a.at - (k - 1 - i) * 7000));
      return next;
    }
    case "beat": {
      // fiecare agent online trimite semnal; jurnalul îl păstrează pe toate, ascunse implicit
      const ok = LOCS.filter((l) => st.locs[l.id].status === "online");
      const locs = { ...st.locs };
      const fresh: Ev[] = ok.map((l) => {
        locs[l.id] = { ...locs[l.id], lastBeat: a.at };
        return { id: `b-${st.beatTicks}-${l.id}`, type: "beat" as const, loc: l.id, at: a.at, text: "", status: "ok" as const };
      });
      return { ...st, beatTicks: st.beatTicks + 1, locs, beats: [...fresh, ...st.beats].slice(0, MAX_BEATS) };
    }
    case "syncStart": {
      const loc = st.locs[a.id];
      if (loc.syncing) return st;
      return { ...st, locs: { ...st.locs, [a.id]: { ...loc, syncing: true, result: undefined } } };
    }
    case "syncDone": {
      let loc = st.locs[a.id];
      if (!loc.syncing) return st;
      const mine = st.buffered.filter((s) => s.loc === a.id);
      let sales = st.sales;
      if (mine.length) {
        for (const s of mine) loc = add(loc, s, a.at, lines(s) * 2);
        sales = [...st.sales, ...mine].sort((x, y) => y.at - x.at).slice(0, MAX_SALES);
      }
      const wasWarning = loc.status === "warning";
      const extra = 6 + ((st.n * 7 + a.id.length * 3) % 11);
      const result = mine.length ? plural(mine.length, "bon importat", "bonuri importate") : `La zi · ${plural(extra, "poziție de stoc", "poziții de stoc")}`;
      const events = [...st.events];
      events.unshift({
        id: `s-${a.id}-${a.at}`,
        type: "sync",
        loc: a.id,
        at: a.at,
        text: mine.length ? plural(mine.length, "bon", "bonuri") : plural(extra, "poziție de stoc", "poziții de stoc"),
        status: "ok",
      });
      if (wasWarning) events.unshift({ id: `o-${a.id}-${a.at}`, type: "online", loc: a.id, at: a.at, text: "", status: "ok" });
      return {
        ...st,
        sales,
        buffered: st.buffered.filter((s) => s.loc !== a.id),
        locs: {
          ...st.locs,
          [a.id]: {
            ...loc,
            records: loc.records + (mine.length ? 0 : extra),
            status: "online",
            syncing: false,
            lastSync: a.at,
            lastBeat: a.at,
            result,
          },
        },
        events: events.slice(0, MAX_EVENTS),
      };
    }
    case "syncClear": {
      const loc = st.locs[a.id];
      if (!loc.result || loc.syncing) return st;
      return { ...st, locs: { ...st.locs, [a.id]: { ...loc, result: undefined } } };
    }
  }
}

/* ---------- contextul comun al ecranelor ---------- */

export type Ctx = {
  live: Live;
  device: DemoDevice;
  mobile: boolean;
  reduced: boolean;
  /** ora simulată curentă */
  now: number;
  go: (screen: string) => void;
  notify: (msg: string) => void;
  sync: (id: string) => void;
  syncAll: () => void;
  loc: string;
  openLoc: (id: string) => void;
  period: Period;
  setPeriod: (p: Period) => void;
  paused: boolean;
  setPaused: (p: boolean) => void;
  openAlerts: () => void;
};

export const ZofCtx = createContext<Ctx | null>(null);

export function useZof(): Ctx {
  const c = useContext(ZofCtx);
  if (!c) throw new Error("ZofCtx lipsă");
  return c;
}

/* ---------- derivate ---------- */

export function totals(live: Live) {
  let rev = 0;
  let receipts = 0;
  let unitsSum = 0;
  let records = 0;
  let online = 0;
  let lastSync = 0;
  const pay = { card: 0, numerar: 0, online: 0 };
  for (const l of LOCS) {
    const x = live.locs[l.id];
    rev += x.rev;
    receipts += x.receipts;
    unitsSum += x.units;
    records += x.records;
    if (x.status === "online") online += 1;
    lastSync = Math.max(lastSync, x.lastSync);
    pay.card += x.rev * l.pay[0];
    pay.numerar += x.rev * l.pay[1];
    pay.online += x.rev * l.pay[2];
  }
  return { rev, receipts, units: unitsSum, records, online, lastSync, pay, avg: rev / Math.max(1, receipts) };
}

/** Locațiile care nu mai trimit semnal (în demo: Câmpulung, până la sincronizare). */
export function silent(live: Live) {
  return LOCS.filter((l) => live.locs[l.id].status === "warning");
}

import { createContext, useContext } from "react";
import type { DemoDevice } from "../types";
import {
  LOCS,
  makeSale,
  seedBuffered,
  seedSales,
  type LocStatus,
  type Period,
  type Sale,
} from "./data";

/* ============================================================
   Starea vie a demo-ului: vânzările care intră din magazine,
   sincronizările, heartbeat-urile agenților.

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
  /** pasul sincronizării manuale în curs (0–3) sau null */
  sync: number | null;
  /** rezultatul ultimei sincronizări manuale */
  result?: string;
};

export type EvType = "sale" | "beat" | "sync" | "online" | "buffer";
export type Ev = { id: string; type: EvType; loc: string; at: number; text: string; status: "ok" | "warning" };

export type Live = {
  n: number;
  beats: number;
  sales: Sale[];
  /** vânzări care stau în bufferul local (agentul nu a mai trimis) */
  buffered: Sale[];
  locs: Record<string, LocLive>;
  events: Ev[];
};

export type Action =
  | { type: "sale"; at: number }
  | { type: "beat"; at: number }
  | { type: "syncStart"; id: string }
  | { type: "syncStep"; id: string }
  | { type: "syncDone"; id: string; at: number };

const MAX_SALES = 90;
const MAX_EVENTS = 60;

const lines = (s: Sale) => s.items.length;
const units = (s: Sale) => s.items.reduce((a, it) => a + it.qty, 0);

export function initLive(base: number): Live {
  const sales = seedSales(base);
  const buffered = seedBuffered(base);
  const locs: Record<string, LocLive> = {};
  for (const l of LOCS) {
    locs[l.id] = {
      rev: l.today,
      receipts: l.receipts,
      units: l.units,
      records: l.records,
      lastSync: base - l.syncAgo * 1000,
      lastBeat: base - Math.min(l.syncAgo, 9) * 1000 - (l.status === "warning" ? 187000 : 0),
      status: l.status,
      sync: null,
    };
  }
  const events: Ev[] = sales.slice(0, 16).map((s, i) => ({
    id: `e0-${i}`,
    type: "sale" as const,
    loc: s.loc,
    at: s.at,
    text: `${s.receipt} · ${s.items.length} ${s.items.length === 1 ? "linie" : "linii"}`,
    status: "ok" as const,
  }));
  events.splice(3, 0, {
    id: "e0-buf",
    type: "buffer",
    loc: "campulung",
    at: base - 180000,
    text: "fără răspuns de la server · 3 loturi păstrate local",
    status: "warning",
  });
  return { n: 0, beats: 0, sales, buffered, locs, events };
}

function add(loc: LocLive, s: Sale, at: number): LocLive {
  return {
    ...loc,
    rev: loc.rev + s.value,
    receipts: loc.receipts + 1,
    units: loc.units + units(s),
    records: loc.records + lines(s),
    lastSync: at,
    lastBeat: at,
  };
}

export function reducer(st: Live, a: Action): Live {
  switch (a.type) {
    case "sale": {
      const s = makeSale(1104 + st.n, a.at);
      const loc = st.locs[s.loc];
      if (loc.status === "warning") {
        // agentul nu ajunge la server: vânzarea așteaptă în bufferul local
        return { ...st, n: st.n + 1, buffered: [{ ...s, buffered: true }, ...st.buffered] };
      }
      return {
        ...st,
        n: st.n + 1,
        sales: [s, ...st.sales].slice(0, MAX_SALES),
        locs: { ...st.locs, [s.loc]: add(loc, s, a.at) },
        events: [
          { id: `e-${s.id}`, type: "sale" as const, loc: s.loc, at: a.at, text: `${s.receipt} · ${lines(s)} ${lines(s) === 1 ? "linie" : "linii"}`, status: "ok" as const },
          ...st.events,
        ].slice(0, MAX_EVENTS),
      };
    }
    case "beat": {
      const ok = LOCS.filter((l) => st.locs[l.id].status === "online");
      const l = ok[(st.beats * 5) % ok.length];
      return {
        ...st,
        beats: st.beats + 1,
        locs: { ...st.locs, [l.id]: { ...st.locs[l.id], lastBeat: a.at } },
        events: [
          { id: `b-${st.beats}`, type: "beat" as const, loc: l.id, at: a.at, text: "heartbeat · agent activ", status: "ok" as const },
          ...st.events,
        ].slice(0, MAX_EVENTS),
      };
    }
    case "syncStart": {
      const loc = st.locs[a.id];
      if (loc.sync !== null) return st;
      return { ...st, locs: { ...st.locs, [a.id]: { ...loc, sync: 0, result: undefined } } };
    }
    case "syncStep": {
      const loc = st.locs[a.id];
      if (loc.sync === null) return st;
      return { ...st, locs: { ...st.locs, [a.id]: { ...loc, sync: Math.min(3, loc.sync + 1) } } };
    }
    case "syncDone": {
      let loc = st.locs[a.id];
      if (loc.sync === null) return st;
      const mine = st.buffered.filter((s) => s.loc === a.id);
      let sales = st.sales;
      const events = [...st.events];
      if (mine.length) {
        for (const s of mine) loc = add(loc, s, a.at);
        sales = [...st.sales, ...mine].sort((x, y) => y.at - x.at).slice(0, MAX_SALES);
      }
      const wasWarning = loc.status === "warning";
      const extra = 6 + ((st.n * 7 + a.id.length * 3) % 11);
      const result = mine.length
        ? `${mine.length} ${mine.length === 1 ? "vânzare recuperată" : "vânzări recuperate"} din buffer · 0 duplicate`
        : `la zi · ${extra} poziții de stoc actualizate · 0 duplicate`;
      events.unshift({
        id: `s-${a.id}-${a.at}`,
        type: "sync",
        loc: a.id,
        at: a.at,
        text: mine.length ? `sincronizare manuală · ${mine.length} vânzări din buffer` : `sincronizare manuală · ${extra} poziții`,
        status: "ok",
      });
      if (wasWarning)
        events.unshift({ id: `o-${a.id}-${a.at}`, type: "online", loc: a.id, at: a.at, text: "agent reconectat", status: "ok" });
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
            sync: null,
            lastSync: a.at,
            lastBeat: a.at,
            result,
          },
        },
        events: events.slice(0, MAX_EVENTS),
      };
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

"use client";

import { createContext, useContext, useMemo, useReducer, useRef } from "react";
import { rng, useInterval } from "../kit";
import type { DemoDevice } from "../types";
import {
  CAMPAIGNS_INIT,
  CLOCK_START,
  CUSTOMERS_INIT,
  FUELS,
  INVOICES_INIT,
  PPL_INIT,
  STATIONS,
  TOTALS_INIT,
  VOUCHERS_INIT,
  clockLabel,
  dateLabel,
  fuelPrice,
  rewardById,
  short,
  voucherCode,
  expiryIn90,
  COMPANIES,
  type Campaign,
  type Customer,
  type Fuel,
  type Fueling,
  type Invoice,
  type Totals,
  type Voucher,
} from "./data";

/* ============================================================
   Starea comună a demo-ului: un singur „backend” în memorie.
   Angajatul adaugă litri → clientul vede punctele → revendică
   o recompensă → angajatul validează voucherul → adminul vede
   totul în fluxul live. Toate ecranele citesc de aici.
   ============================================================ */

export type Tx = {
  id: string;
  kind: "fuel" | "voucher";
  name: string;
  station: number;
  fuel: Fuel;
  litres: number;
  points: number;
  time: string;
  reward?: string;
  mine?: boolean; // adăugată de vizitator
};

export type CustTab = "recompense" | "vouchere" | "istoric";

type State = {
  customers: Customer[];
  extra: Record<number, Fueling[]>;
  vouchers: Voucher[];
  campaigns: Campaign[];
  ppl: Record<Fuel, number>;
  feed: Tx[];
  shift: Tx[];
  shiftBase: { ops: number; litres: number; points: number; vouchers: number };
  totals: Totals;
  clock: number;
  seq: number;
  invoices: Invoice[];
  custTab: CustTab;
  repStation: number;
  pickCustomer: number | null;
  pickVoucher: string | null;
  lastSync: string;
  autoDone: boolean;
  toast: { id: number; points: number; litres: number; station: number; fuel: Fuel } | null;
};

type Action =
  | { type: "tick"; tx: Tx; dt: number; member: boolean; invoice?: Invoice }
  | { type: "fuel"; customer: number; fuel: Fuel; litres: number; points: number }
  | { type: "redeem"; reward: number; code: string }
  | { type: "useVoucher"; code: string }
  | { type: "adjust"; customer: number; delta: number; reason: string }
  | { type: "toggleCampaign"; id: number }
  | { type: "addCampaign"; c: Campaign }
  | { type: "ppl"; fuel: Fuel; value: number }
  | { type: "custTab"; tab: CustTab }
  | { type: "repStation"; id: number }
  | { type: "pickCustomer"; id: number | null }
  | { type: "pickVoucher"; code: string | null }
  | { type: "sync" }
  | { type: "autoDone" }
  | { type: "toast"; toast: State["toast"] };

const SHIFT_INIT: Tx[] = [
  { id: "s1", kind: "fuel", name: "Mihaela S.", station: 0, fuel: "motorina", litres: 48.2, points: 48, time: "09:36" },
  { id: "s2", kind: "fuel", name: "Paul D.", station: 0, fuel: "benzina", litres: 31.5, points: 31, time: "09:29" },
  { id: "s3", kind: "voucher", name: "Oana I.", station: 0, fuel: "benzina", litres: 0, points: 0, time: "09:24", reward: "Cafea gratuită" },
  { id: "s4", kind: "fuel", name: "Cristian B.", station: 0, fuel: "gpl", litres: 36.8, points: 73, time: "09:18" },
  { id: "s5", kind: "fuel", name: "Laura C.", station: 0, fuel: "benzina", litres: 40.1, points: 40, time: "09:07" },
];

function seedFeed(): Tx[] {
  const out: Tx[] = [];
  let sec = CLOCK_START;
  for (let i = 0; i < 12; i++) {
    out.push(makeTx(10_000 + i, sec));
    sec -= 23 + ((i * 37) % 41);
  }
  return out;
}

const init: State = {
  customers: CUSTOMERS_INIT,
  extra: {},
  vouchers: VOUCHERS_INIT,
  campaigns: CAMPAIGNS_INIT,
  ppl: PPL_INIT,
  feed: seedFeed(),
  shift: SHIFT_INIT,
  shiftBase: { ops: 146, litres: 5842, points: 5317, vouchers: 12 },
  totals: TOTALS_INIT,
  clock: CLOCK_START,
  seq: 1,
  invoices: INVOICES_INIT,
  custTab: "recompense",
  repStation: 0,
  pickCustomer: null,
  pickVoucher: null,
  lastSync: "09:38",
  autoDone: false,
  toast: null,
};

/** O tranzacție „din rețea”, deterministă după index. */
export function makeTx(i: number, sec: number): Tx {
  const r = rng(i * 131 + 7);
  const roll = r();
  // stație ponderată după volum
  let pick = r() * STATIONS.reduce((a, s) => a + s.w, 0);
  let station = 0;
  for (const s of STATIONS) {
    pick -= s.w;
    if (pick <= 0) {
      station = s.id;
      break;
    }
  }
  const first = CUSTOMERS_INIT[1 + Math.floor(r() * (CUSTOMERS_INIT.length - 1))];
  if (roll < 0.11) {
    const rw = rewardById(1 + Math.floor(r() * 5));
    return { id: `t${i}`, kind: "voucher", name: short(first.name), station, fuel: "benzina", litres: 0, points: 0, time: clockLabel(sec), reward: rw.title };
  }
  const f = r();
  const fuel: Fuel = f < 0.46 ? "benzina" : f < 0.85 ? "motorina" : "gpl";
  const litres = Math.round((fuel === "gpl" ? 20 + r() * 26 : 18 + r() * 52) * 100) / 100;
  return {
    id: `t${i}`,
    kind: "fuel",
    name: short(first.name),
    station,
    fuel,
    litres,
    points: Math.floor(litres * PPL_INIT[fuel]),
    time: clockLabel(sec),
  };
}

function addFuelTotals(t: Totals, litres: number, fuel: Fuel, points: number): Totals {
  const lei = litres * fuelPrice(fuel);
  return {
    ...t,
    monthLitres: t.monthLitres + litres,
    todayLitres: t.todayLitres + litres,
    monthRevenue: t.monthRevenue + lei,
    todayRevenue: t.todayRevenue + lei,
    todayTx: t.todayTx + 1,
    points: t.points + points,
  };
}

function bumpShift(b: State["shiftBase"], tx: Tx): State["shiftBase"] {
  return tx.kind === "fuel"
    ? { ...b, ops: b.ops + 1, litres: b.litres + tx.litres, points: b.points + tx.points }
    : { ...b, ops: b.ops + 1, vouchers: b.vouchers + 1 };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "tick": {
      const tx = a.tx;
      let totals = tx.kind === "fuel" ? addFuelTotals(s.totals, tx.litres, tx.fuel, tx.points) : { ...s.totals, vouchers: s.totals.vouchers + 1 };
      if (a.member) totals = { ...totals, members: totals.members + 1, newToday: totals.newToday + 1 };
      return {
        ...s,
        clock: s.clock + a.dt,
        feed: [tx, ...s.feed].slice(0, 30),
        shift: tx.station === 0 ? [tx, ...s.shift].slice(0, 30) : s.shift,
        shiftBase: tx.station === 0 ? bumpShift(s.shiftBase, tx) : s.shiftBase,
        totals,
        invoices: a.invoice ? [a.invoice, ...s.invoices].slice(0, 12) : s.invoices,
      };
    }
    case "fuel": {
      const c = s.customers.find((x) => x.id === a.customer)!;
      const time = clockLabel(s.clock);
      const tx: Tx = {
        id: `u${s.seq}`,
        kind: "fuel",
        name: short(c.name),
        station: 0,
        fuel: a.fuel,
        litres: a.litres,
        points: a.points,
        time,
        mine: true,
      };
      const f: Fueling = { id: `f${s.seq}`, day: 0, time, station: 0, fuel: a.fuel, litres: a.litres, points: a.points };
      return {
        ...s,
        seq: s.seq + 1,
        customers: s.customers.map((x) =>
          x.id === a.customer
            ? { ...x, points: x.points + a.points, litres: x.litres + a.litres, visits: x.visits + 1, last: 0 }
            : x
        ),
        extra: { ...s.extra, [a.customer]: [f, ...(s.extra[a.customer] ?? [])] },
        feed: [tx, ...s.feed].slice(0, 30),
        shift: [tx, ...s.shift].slice(0, 30),
        shiftBase: bumpShift(s.shiftBase, tx),
        totals: addFuelTotals(s.totals, a.litres, a.fuel, a.points),
        toast: a.customer === 0 ? { id: s.seq, points: a.points, litres: a.litres, station: 0, fuel: a.fuel } : s.toast,
        // o alimentare reală a clientului ține locul celei automate de pe ecranul de start
        autoDone: s.autoDone || a.customer === 0,
      };
    }
    case "redeem": {
      const rw = rewardById(a.reward);
      return {
        ...s,
        seq: s.seq + 1,
        customers: s.customers.map((x) => (x.id === 0 ? { ...x, points: Math.max(0, x.points - rw.points) } : x)),
        vouchers: [
          { code: a.code, reward: rw.id, customer: 0, status: "active", created: 0, expires: expiryIn90() },
          ...s.vouchers,
        ],
      };
    }
    case "useVoucher": {
      const v = s.vouchers.find((x) => x.code === a.code);
      if (!v) return s;
      const c = s.customers.find((x) => x.id === v.customer)!;
      const tx: Tx = {
        id: `u${s.seq}`,
        kind: "voucher",
        name: short(c.name),
        station: 0,
        fuel: "benzina",
        litres: 0,
        points: 0,
        time: clockLabel(s.clock),
        reward: rewardById(v.reward).title,
        mine: true,
      };
      return {
        ...s,
        seq: s.seq + 1,
        vouchers: s.vouchers.map((x) => (x.code === a.code ? { ...x, status: "used", usedAt: dateLabel(0) } : x)),
        customers: s.customers.map((x) => (x.id === v.customer ? { ...x, used: x.used + 1 } : x)),
        feed: [tx, ...s.feed].slice(0, 30),
        shift: [tx, ...s.shift].slice(0, 30),
        shiftBase: bumpShift(s.shiftBase, tx),
        totals: { ...s.totals, vouchers: s.totals.vouchers + 1 },
        pickVoucher: null,
      };
    }
    case "adjust": {
      const f: Fueling = {
        id: `a${s.seq}`,
        day: 0,
        time: clockLabel(s.clock),
        station: 0,
        fuel: "benzina",
        litres: 0,
        points: a.delta,
        note: a.reason,
      };
      return {
        ...s,
        seq: s.seq + 1,
        customers: s.customers.map((x) => (x.id === a.customer ? { ...x, points: Math.max(0, x.points + a.delta) } : x)),
        extra: { ...s.extra, [a.customer]: [f, ...(s.extra[a.customer] ?? [])] },
      };
    }
    case "toggleCampaign":
      return {
        ...s,
        campaigns: s.campaigns.map((c) => (c.id === a.id ? { ...c, active: !c.active, draft: false } : c)),
      };
    case "addCampaign":
      return { ...s, campaigns: [a.c, ...s.campaigns] };
    case "ppl":
      return { ...s, ppl: { ...s.ppl, [a.fuel]: a.value } };
    case "custTab":
      return { ...s, custTab: a.tab };
    case "repStation":
      return { ...s, repStation: a.id };
    case "pickCustomer":
      return { ...s, pickCustomer: a.id };
    case "pickVoucher":
      return { ...s, pickVoucher: a.code };
    case "sync":
      return { ...s, lastSync: clockLabel(s.clock) };
    case "autoDone":
      return { ...s, autoDone: true };
    case "toast":
      return { ...s, toast: a.toast };
  }
}

/* ---------- context ---------- */

type Ctx = {
  s: State;
  device: DemoDevice;
  mobile: boolean;
  rm: boolean;
  go: (screen: string) => void;
  notify: (m: string) => void;
  addFuel: (customer: number, fuel: Fuel, litres: number) => number;
  redeem: (reward: number) => string;
  consumeVoucher: (code: string) => void;
  adjust: (customer: number, delta: number, reason: string) => void;
  toggleCampaign: (id: number) => void;
  addCampaign: (c: Omit<Campaign, "id">) => void;
  setPpl: (fuel: Fuel, v: number) => void;
  setCustTab: (t: CustTab) => void;
  setRepStation: (id: number) => void;
  pickCustomer: (id: number | null) => void;
  pickVoucher: (code: string | null) => void;
  sync: () => void;
  autoDone: () => void;
  clearToast: () => void;
};

const DemoCtx = createContext<Ctx | null>(null);

export function useDemo() {
  const c = useContext(DemoCtx);
  if (!c) throw new Error("useDemo în afara <DemoProvider>");
  return c;
}

export function DemoProvider({
  device,
  go,
  notify,
  reducedMotion,
  children,
}: {
  device: DemoDevice;
  go: (s: string) => void;
  notify: (m: string) => void;
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  const [s, dispatch] = useReducer(reducer, init);
  const i = useRef(0);
  const sRef = useRef(s);
  sRef.current = s;

  /* Rețeaua trăiește: o tranzacție nouă la ~2,6 s. Sub reduced motion, nu. */
  useInterval(
    () => {
      const n = i.current++;
      const r = rng(n * 53 + 11);
      const dt = 9 + Math.floor(r() * 26);
      const tx = makeTx(n, sRef.current.clock + dt);
      const invoice: Invoice | undefined =
        n % 6 === 3
          ? {
              no: `PRS 2026/${18343 + Math.floor(n / 6)}`,
              company: COMPANIES[n % COMPANIES.length],
              value: Math.round((600 + r() * 3800) * 100) / 100,
              time: clockLabel(sRef.current.clock + dt),
              state: "trimisă",
            }
          : undefined;
      dispatch({ type: "tick", tx, dt, member: n % 7 === 4, invoice });
    },
    2600,
    !reducedMotion
  );

  /* Acțiunile sunt stabile (nu se schimbă la fiecare tick), ca efectele
     care depind de ele să nu-și repornească temporizatoarele. */
  const actions = useMemo(
    () => ({
      addFuel: (customer: number, fuel: Fuel, litres: number) => {
        const points = Math.floor(litres * sRef.current.ppl[fuel]);
        dispatch({ type: "fuel", customer, fuel, litres, points });
        return points;
      },
      redeem: (reward: number) => {
        const rw = rewardById(reward);
        const code = voucherCode(rw.prefix, sRef.current.seq);
        dispatch({ type: "redeem", reward, code });
        return code;
      },
      consumeVoucher: (code: string) => dispatch({ type: "useVoucher", code }),
      adjust: (customer: number, delta: number, reason: string) => dispatch({ type: "adjust", customer, delta, reason }),
      toggleCampaign: (id: number) => dispatch({ type: "toggleCampaign", id }),
      addCampaign: (c: Omit<Campaign, "id">) =>
        dispatch({ type: "addCampaign", c: { ...c, id: 100 + sRef.current.seq + sRef.current.campaigns.length } }),
      setPpl: (fuel: Fuel, v: number) => dispatch({ type: "ppl", fuel, value: v }),
      setCustTab: (tab: CustTab) => dispatch({ type: "custTab", tab }),
      setRepStation: (id: number) => dispatch({ type: "repStation", id }),
      pickCustomer: (id: number | null) => dispatch({ type: "pickCustomer", id }),
      pickVoucher: (code: string | null) => dispatch({ type: "pickVoucher", code }),
      sync: () => dispatch({ type: "sync" }),
      autoDone: () => dispatch({ type: "autoDone" }),
      clearToast: () => dispatch({ type: "toast", toast: null }),
    }),
    []
  );

  const value = useMemo<Ctx>(
    () => ({ s, device, mobile: device === "mobile", rm: reducedMotion, go, notify, ...actions }),
    [s, device, reducedMotion, go, notify, actions]
  );

  return <DemoCtx.Provider value={value}>{children}</DemoCtx.Provider>;
}

/* ---------- selectoare ---------- */
export const me = (s: State) => s.customers[0];
export const FUEL_IDS = FUELS.map((f) => f.id);

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { rng, useInterval } from "../kit";
import type { DemoDevice } from "../types";
import {
  ANUNTURI,
  FACTURI_INITIALE,
  ORA_START,
  PLANURI,
  PRIMUL_NUMAR_NOU,
  STAFF_ALT,
  STAFF_EU,
  lume,
  ora,
  subNou,
  subsActive,
  type Anunt,
  type Contor,
  type Factura,
  type Member,
  type Metoda,
  type Tip,
} from "./data";

/* ============================================================
   Starea comună a demo-ului: clienții modificați, scanările zilei,
   anunțurile, facturile. Motorul de check-in e o copie simplificată
   a regulilor din aplicația reală (un check-in pe zi, contoarele
   multiple le alege recepția, fără abonament valabil → refuz).
   ============================================================ */

export type StatusScan = "consumat" | "in_asteptare" | "refuzat" | "duplicat";
export type Motiv =
  | "abonament_expirat"
  | "fara_abonament"
  | "fara_sedinte"
  | "alegere_necesara"
  | "deja_intrat_azi"
  | "respinsa_de_receptie";

export const TEXT_MOTIV: Record<Motiv, string> = {
  abonament_expirat: "abonament expirat",
  fara_abonament: "fără abonament",
  fara_sedinte: "fără ședințe rămase",
  alegere_necesara: "recepția alege ce se consumă",
  deja_intrat_azi: "a intrat deja azi",
  respinsa_de_receptie: "respinsă de recepție",
};

export type Optiune = { subId: string; plan: string; exp: number; contoare: Contor[] };

export type Scan = {
  id: string;
  sec: number;
  memberId: string;
  metoda: "qr" | "manual";
  status: StatusScan;
  motiv?: Motiv;
  consum?: { plan: string; tip: Tip; ramase: number | null; exp: number };
  optiuni?: Optiune[];
  staff?: string;
  live?: boolean;
};

type Jurnal = { text: string; cine: string; ora: string };

export type State = {
  now: number;
  seq: number;
  over: Record<string, Member>;
  intrati: Record<string, number>;
  scans: Scan[];
  azi: { scanari: number; consumate: number; refuzate: number; tipuri: Record<Tip, number> };
  inSala: number;
  vanzariAzi: { suma: number; nr: number; online: number };
  openScan: string | null;
  profil: string | null;
  dialogSub: string | null;
  anunturi: Anunt[];
  facturi: Factura[];
  nextFact: number;
  jurnal: Record<string, Jurnal[]>;
  flash: { memberId: string; text: string } | null;
};

/* ---------- motorul ---------- */

type Analiza =
  | { status: "duplicat"; motiv: Motiv }
  | { status: "refuzat"; motiv: Motiv }
  | { status: "consumat"; subId: string; tip: Tip }
  | { status: "in_asteptare"; motiv: Motiv; optiuni: Optiune[] };

function analizeaza(m: Member, intrati: Record<string, number>): Analiza {
  if (intrati[m.id] !== undefined) return { status: "duplicat", motiv: "deja_intrat_azi" };
  const act = subsActive(m);
  if (act.length === 0)
    return { status: "refuzat", motiv: m.ultimulExpirat ? "abonament_expirat" : "fara_abonament" };
  const opt = act
    .map((s) => ({ s, disp: s.contoare.filter((c) => c.ramase === null || c.ramase > 0) }))
    .filter((o) => o.disp.length > 0);
  if (opt.length === 0) return { status: "refuzat", motiv: "fara_sedinte" };
  if (opt.length === 1 && opt[0].disp.length === 1)
    return { status: "consumat", subId: opt[0].s.id, tip: opt[0].disp[0].tip };
  return {
    status: "in_asteptare",
    motiv: "alegere_necesara",
    optiuni: opt.map((o) => ({ subId: o.s.id, plan: o.s.nume, exp: o.s.exp, contoare: o.s.contoare })),
  };
}

function consuma(m: Member, subId: string, tip: Tip, sec: number) {
  let consum: Scan["consum"];
  const subs = m.subs.map((s) => {
    if (s.id !== subId) return s;
    const contoare = s.contoare.map((c) =>
      c.tip === tip && c.ramase !== null ? { ...c, ramase: Math.max(0, c.ramase - 1) } : c
    );
    const c = contoare.find((x) => x.tip === tip);
    consum = { plan: s.nume, tip, ramase: c?.ramase ?? null, exp: s.exp };
    return { ...s, contoare };
  });
  return { m: { ...m, subs, vizite: m.vizite + 1, ultima: 0, ultimaOra: sec }, consum };
}

/* ---------- starea inițială ---------- */

function initial(): State {
  const L = lume();
  const r = rng(2026);
  const over: Record<string, Member> = {};
  const intrati: Record<string, number> = {};
  const get = (id: string) => over[id] ?? L.dupaId.get(id)!;

  const activi = L.clienti.filter((c, i) => i > 2 && subsActive(c).length > 0 && c.ultima !== 0);
  const expirati = L.clienti.filter((c, i) => i > 2 && c.ultimulExpirat && c.ultimulExpirat.exp > -20);
  const multiplu = activi.filter((c) => subsActive(c)[0].contoare.length > 1);
  const simplu = activi.filter((c) => subsActive(c).length === 1 && subsActive(c)[0].contoare.length === 1);

  // ordinea cronologică: de la cea mai veche la cea mai nouă
  const N = 22;
  const alesi: Member[] = [];
  const folositi = new Set<string>();
  const ia = (lista: Member[]) => {
    for (let k = 0; k < 50; k++) {
      const c = lista[Math.floor(r() * lista.length)];
      if (!folositi.has(c.id)) {
        folositi.add(c.id);
        return c;
      }
    }
    return lista[0];
  };
  for (let k = 0; k < N; k++) {
    if (k === N - 2) alesi.push(ia(multiplu));
    else if (k === N - 8) alesi.push(ia(expirati));
    else if (k === N - 11) alesi.push(alesi[3]);
    else alesi.push(ia(k % 5 === 2 ? multiplu : simplu));
  }

  let sec = ORA_START - 60;
  const secunde: number[] = [];
  for (let k = 0; k < N; k++) {
    secunde.unshift(sec);
    sec -= 50 + Math.floor(r() * 150);
  }

  const scans: Scan[] = [];
  alesi.forEach((m0, k) => {
    const s = secunde[k];
    const m = get(m0.id);
    const a = analizeaza(m, intrati);
    const scan: Scan = { id: `x${k}`, sec: s, memberId: m.id, metoda: k === N - 5 ? "manual" : "qr", status: a.status };
    if (a.status === "consumat" || (a.status === "in_asteptare" && k !== N - 2)) {
      const subId = a.status === "consumat" ? a.subId : a.optiuni[0].subId;
      const tip = a.status === "consumat" ? a.tip : a.optiuni[0].contoare.find((c) => c.ramase !== 0)!.tip;
      const res = consuma(m, subId, tip, s);
      over[m.id] = res.m;
      intrati[m.id] = s;
      scan.status = "consumat";
      scan.consum = res.consum;
      if (a.status === "in_asteptare" || scan.metoda === "manual") scan.staff = k % 2 ? STAFF_ALT : STAFF_EU;
    } else if (a.status === "in_asteptare") {
      scan.motiv = a.motiv;
      scan.optiuni = a.optiuni;
    } else {
      scan.motiv = a.motiv;
    }
    scans.unshift(scan);
  });

  return {
    now: ORA_START,
    seq: 1,
    over,
    intrati,
    scans,
    azi: { scanari: 131, consumate: 124, refuzate: 3, tipuri: { fitness: 101, spa: 17, aerobic: 6 } },
    inSala: 58,
    vanzariAzi: { suma: 2_310, nr: 12, online: 7 },
    openScan: null,
    profil: null,
    dialogSub: null,
    anunturi: ANUNTURI,
    facturi: FACTURI_INITIALE,
    nextFact: PRIMUL_NUMAR_NOU,
    jurnal: {},
    flash: null,
  };
}

/* ---------- contextul ---------- */

export type Demo = {
  st: State;
  device: DemoDevice;
  mobile: boolean;
  rm: boolean;
  go: (s: string) => void;
  notify: (m: string) => void;
  getM: (id: string) => Member;
  scaneaza: (memberId: string, metoda?: "qr" | "manual") => string;
  rezolva: (scanId: string, subId: string, tip: Tip, staff?: string) => void;
  respinge: (scanId: string) => void;
  vindeAbonament: (memberId: string, planId: string, metoda: Metoda) => void;
  reseteazaPersonaje: () => void;
  set: (p: Partial<Pick<State, "openScan" | "profil" | "dialogSub" | "flash">>) => void;
  publica: (titlu: string, text: string) => void;
  stergeAnunt: (id: string) => void;
  reincearcaFactura: (id: string) => void;
};

const Ctx = createContext<Demo | null>(null);

export function useDemo(): Demo {
  const d = useContext(Ctx);
  if (!d) throw new Error("useDemo în afara DemoProvider");
  return d;
}

const PERSONAJE = ["c0", "c1", "c2"];
const getRef = (s: State, id: string) => s.over[id] ?? lume().dupaId.get(id)!;

export function DemoProvider({
  children,
  device,
  rm,
  go,
  notify,
}: {
  children: ReactNode;
  device: DemoDevice;
  rm: boolean;
  go: (s: string) => void;
  notify: (m: string) => void;
}) {
  const [st, setSt] = useState<State>(initial);
  const ref = useRef(st);
  const timers = useRef<number[]>([]);

  const upd = useCallback((f: (s: State) => State) => {
    const next = f(ref.current);
    ref.current = next;
    setSt(next);
  }, []);

  const getM = useCallback((id: string) => st.over[id] ?? lume().dupaId.get(id)!, [st.over]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((x) => window.clearTimeout(x));
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  /** O scanare nouă, trecută prin motor. Întoarce id-ul evenimentului. */
  const scaneaza = useCallback(
    (memberId: string, metoda: "qr" | "manual" = "qr") => {
      const id = `n${ref.current.seq}`;
      upd((s) => {
        const m = getRef(s, memberId);
        const a = analizeaza(m, s.intrati);
        const sec = s.now;
        const scan: Scan = { id, sec, memberId, metoda, status: a.status, live: true };
        let over = s.over;
        let intrati = s.intrati;
        const azi = { ...s.azi, tipuri: { ...s.azi.tipuri }, scanari: s.azi.scanari + 1 };
        let inSala = s.inSala;
        if (a.status === "consumat") {
          const res = consuma(m, a.subId, a.tip, sec);
          over = { ...over, [m.id]: res.m };
          intrati = { ...intrati, [m.id]: sec };
          scan.consum = res.consum;
          if (metoda === "manual") scan.staff = STAFF_EU;
          azi.consumate++;
          azi.tipuri[a.tip]++;
          inSala++;
        } else if (a.status === "in_asteptare") {
          scan.motiv = a.motiv;
          scan.optiuni = a.optiuni;
        } else {
          scan.motiv = a.motiv;
          if (a.status === "refuzat") azi.refuzate++;
        }
        return { ...s, seq: s.seq + 1, over, intrati, azi, inSala, scans: [scan, ...s.scans].slice(0, 48) };
      });
      return id;
    },
    [upd]
  );

  const rezolva = useCallback(
    (scanId: string, subId: string, tip: Tip, staff = STAFF_EU) => {
      upd((s) => {
        const scan = s.scans.find((x) => x.id === scanId);
        if (!scan || scan.status !== "in_asteptare") return s;
        const m = getRef(s, scan.memberId);
        const res = consuma(m, subId, tip, scan.sec);
        return {
          ...s,
          over: { ...s.over, [m.id]: res.m },
          intrati: { ...s.intrati, [m.id]: scan.sec },
          inSala: s.inSala + 1,
          azi: { ...s.azi, consumate: s.azi.consumate + 1, tipuri: { ...s.azi.tipuri, [tip]: s.azi.tipuri[tip] + 1 } },
          scans: s.scans.map((x) =>
            x.id === scanId ? { ...x, status: "consumat", consum: res.consum, staff, optiuni: undefined, motiv: undefined } : x
          ),
        };
      });
    },
    [upd]
  );

  const respinge = useCallback(
    (scanId: string) => {
      upd((s) => ({
        ...s,
        azi: { ...s.azi, refuzate: s.azi.refuzate + 1 },
        scans: s.scans.map((x) =>
          x.id === scanId && x.status === "in_asteptare"
            ? { ...x, status: "refuzat", motiv: "respinsa_de_receptie", staff: STAFF_EU, optiuni: undefined }
            : x
        ),
      }));
    },
    [upd]
  );

  const vindeAbonament = useCallback(
    (memberId: string, planId: string, metoda: Metoda) => {
      upd((s) => {
        const m = getRef(s, memberId);
        const sub = subNou(planId, 0, `v${s.seq}`, metoda);
        const plan = PLANURI.find((p) => p.id === planId)!;
        const j: Jurnal = { text: `a creat abonamentul „${plan.nume}” · ${plan.pret} lei · ${metoda === "cash" ? "cash" : "card fizic"}`, cine: STAFF_EU, ora: ora(s.now) };
        return {
          ...s,
          seq: s.seq + 1,
          over: { ...s.over, [m.id]: { ...m, subs: [...m.subs, sub], nrAbonamente: m.nrAbonamente + 1 } },
          vanzariAzi: { ...s.vanzariAzi, suma: s.vanzariAzi.suma + plan.pret, nr: s.vanzariAzi.nr + 1 },
          jurnal: { ...s.jurnal, [m.id]: [j, ...(s.jurnal[m.id] ?? [])] },
          flash: { memberId: m.id, text: `„${plan.nume}” e activ din acest moment și a apărut deja pe telefonul clientului.` },
        };
      });
    },
    [upd]
  );

  const reseteazaPersonaje = useCallback(() => {
    upd((s) => {
      const over = { ...s.over };
      const intrati = { ...s.intrati };
      for (const id of PERSONAJE) {
        delete over[id];
        delete intrati[id];
      }
      const scoase = s.scans.filter((x) => PERSONAJE.includes(x.memberId));
      const consumate = scoase.filter((x) => x.status === "consumat").length;
      return {
        ...s,
        over,
        intrati,
        openScan: null,
        inSala: s.inSala - consumate,
        azi: { ...s.azi, scanari: s.azi.scanari - scoase.length, consumate: s.azi.consumate - consumate },
        scans: s.scans.filter((x) => !PERSONAJE.includes(x.memberId)),
      };
    });
  }, [upd]);

  const set = useCallback(
    (p: Partial<Pick<State, "openScan" | "profil" | "dialogSub" | "flash">>) => upd((s) => ({ ...s, ...p })),
    [upd]
  );

  const publica = useCallback(
    (titlu: string, text: string) => {
      upd((s) => ({
        ...s,
        seq: s.seq + 1,
        anunturi: [
          { id: `a${s.seq + 10}`, titlu, text, o: 0, ora: ora(s.now), trimise: 4286, citite: 0, autor: STAFF_EU },
          ...s.anunturi,
        ],
      }));
    },
    [upd]
  );

  const stergeAnunt = useCallback(
    (id: string) => upd((s) => ({ ...s, anunturi: s.anunturi.filter((a) => a.id !== id) })),
    [upd]
  );

  const reincearcaFactura = useCallback(
    (id: string) => {
      upd((s) => ({ ...s, facturi: s.facturi.map((f) => (f.id === id ? { ...f, status: "emitere", motiv: undefined } : f)) }));
      later(() => {
        upd((s) => ({
          ...s,
          nextFact: s.nextFact + 1,
          facturi: s.facturi.map((f) => (f.id === id ? { ...f, status: "emisa", numar: s.nextFact, email: true } : f)),
        }));
      }, 1400);
    },
    [upd, later]
  );

  /* ---------- viața: scanări și plăți care sosesc singure ---------- */
  const tickRef = useRef(0);
  useInterval(
    () => {
      const k = tickRef.current++;
      const r = rng(7000 + k * 31);
      const s0 = ref.current;
      const L = lume();
      // timpul demo-ului avansează cu 20–60 s la fiecare sosire
      upd((s) => ({ ...s, now: s.now + 20 + Math.floor(r() * 40) }));

      // o recepționeră de pe alt calculator rezolvă scanările rămase de mult în așteptare
      const vechi = s0.scans.filter((x) => x.status === "in_asteptare" && x.id !== s0.openScan && !PERSONAJE.includes(x.memberId));
      if (vechi.length >= 2) {
        const x = vechi[vechi.length - 1];
        const o = x.optiuni?.[0];
        const c = o?.contoare.find((cc) => cc.ramase === null || cc.ramase > 0);
        if (o && c) rezolva(x.id, o.subId, c.tip, STAFF_ALT);
      }

      // cine intră acum
      let cine: Member | undefined;
      const x = r();
      for (let t = 0; t < 30 && !cine; t++) {
        const c = L.clienti[3 + Math.floor(r() * (L.clienti.length - 3))];
        const m = getRef(ref.current, c.id);
        const st = subsActive(m);
        if (x < 0.05) {
          if (st.length === 0 && m.ultimulExpirat && m.ultimulExpirat.exp > -40) cine = m;
        } else if (st.length > 0 && ref.current.intrati[m.id] === undefined) {
          const multi = st.length > 1 || st[0].contoare.length > 1;
          if (multi === x < 0.2) cine = m;
        }
      }
      if (cine) scaneaza(cine.id);

      // oamenii mai și pleacă
      upd((s) => {
        const pleaca = s.inSala > 66 ? 2 : s.inSala > 54 ? (r() < 0.6 ? 1 : 0) : r() < 0.2 ? 1 : 0;
        return { ...s, inSala: Math.max(30, s.inSala - pleaca) };
      });

      // o plată online la câteva sosiri: Netopia → abonament → factură SmartBill
      if (k % 3 === 1) {
        const onl = PLANURI.filter((p) => p.cat !== "elevi" && p.cat !== "redus");
        const p = onl[Math.floor(r() * onl.length)];
        const c = L.clienti[3 + Math.floor(r() * 4000)];
        const fid = `fl${k}`;
        upd((s) => ({
          ...s,
          vanzariAzi: { suma: s.vanzariAzi.suma + p.pret, nr: s.vanzariAzi.nr + 1, online: s.vanzariAzi.online + 1 },
          facturi: [
            { id: fid, numar: null, client: `${c.prenume} ${c.nume.charAt(0)}.`, plan: p.nume, suma: p.pret, ora: ora(s.now), o: 0, status: "emitere" as const, email: false },
            ...s.facturi,
          ].slice(0, 30),
        }));
        later(() => {
          upd((s) => ({
            ...s,
            nextFact: s.nextFact + 1,
            facturi: s.facturi.map((f) => (f.id === fid ? { ...f, status: "emisa", numar: s.nextFact } : f)),
          }));
        }, 1500);
        later(() => {
          upd((s) => ({ ...s, facturi: s.facturi.map((f) => (f.id === fid ? { ...f, email: true } : f)) }));
        }, 2600);
      }
    },
    5200,
    !rm
  );

  const value = useMemo<Demo>(
    () => ({
      st,
      device,
      mobile: device === "mobile",
      rm,
      go,
      notify,
      getM,
      scaneaza,
      rezolva,
      respinge,
      vindeAbonament,
      reseteazaPersonaje,
      set,
      publica,
      stergeAnunt,
      reincearcaFactura,
    }),
    [st, device, rm, go, notify, getM, scaneaza, rezolva, respinge, vindeAbonament, reseteazaPersonaje, set, publica, stergeAnunt, reincearcaFactura]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { STAFF_EU, STAFF_ALT };

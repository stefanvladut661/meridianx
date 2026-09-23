"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInterval } from "../kit";
import type { DemoProps } from "../types";
import { Ctx, ECRANE, type DemoCtx, type Ecran, type Notificare } from "./ctx";
import {
  CERERI_LIVE,
  REZ_INITIALE,
  START_MINUT,
  fmtOra,
  idClient,
  persoane,
  type Client,
  type Rez,
  type StatusRez,
} from "./data";
import { EcranAcasa } from "./screens/acasa";
import { EcranClienti } from "./screens/clienti";
import { EcranEvenimente } from "./screens/evenimente";
import { EcranHarta } from "./screens/harta";
import { EcranRetea } from "./screens/retea";
import { EcranRezervari } from "./screens/rezervari";
import { EcranWidget } from "./screens/widget";
import { FONT, L } from "./theme";
import { StiluriDemo, Toasturi, type Toast } from "./ui";

/* ============================================================
   TableX — demo interactiv. Produsul MERIDIAN de rezervări pentru
   HoReCa: harta live a sălii, lista serii, pagina publică de
   rezervare, fișele de client, evenimentele și panoul echipei.

   Toate datele sunt inventate și deterministe. Ceasul pornește
   vineri la 19:30 și înaintează un minut la 4 secunde; cererile
   noi din pagina publică intră singure, ca prin Realtime.
   ============================================================ */

const NOTIFICARI_INITIALE: Notificare[] = [
  {
    id: 1,
    text: "3 cereri noi așteaptă răspuns",
    desc: "Din pagina publică · un număr are semnal roșu",
    ecran: "rezervari",
    citita: false,
    cand: "19:12",
  },
  {
    id: 2,
    text: "Masa 7 se eliberează în curând",
    desc: "Laura Dobre · următoarea: Mara Lungu, 20:15",
    ecran: "harta",
    citita: false,
    cand: "19:25",
  },
  {
    id: 3,
    text: "Revelion la Nord: 64 de bilete vândute",
    desc: "Seara de jazz de azi e aproape plină: 19 din 20 de locuri",
    ecran: "evenimente",
    citita: true,
    cand: "18:40",
  },
];

const TEXT_STATUS: Record<StatusRez, string> = {
  confirmata: "Rezervare confirmată.",
  sosita: "Client marcat ca sosit.",
  no_show: "Marcat ca neprezentat.",
  anulata: "Rezervare anulată.",
  respinsa: "Rezervare respinsă.",
  pending: "Rezervare trecută în așteptare.",
};

export default function Demo({ device, screen, go, notify, reducedMotion }: DemoProps) {
  const mobil = device === "mobile";
  const ecran: Ecran = (ECRANE as string[]).includes(screen) ? (screen as Ecran) : "harta";

  /* ---------- ceasul ---------- */
  const [minut, setMinut] = useState(START_MINUT);
  useInterval(() => setMinut((m) => Math.min(m + 1, 22 * 60 + 45)), 4000, !reducedMotion);
  const acum = minut / 60;

  /* ---------- rezervările ---------- */
  const [rez, setRezState] = useState<Rez[]>(REZ_INITIALE);
  const seq = useRef(1000);
  const setRez = useCallback((f: (r: Rez[]) => Rez[]) => setRezState(f), []);

  /* ---------- notificări în aplicație ---------- */
  const [toasturi, setToasturi] = useState<Toast[]>([]);
  const timere = useRef<number[]>([]);
  useEffect(() => {
    const t = timere.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);
  const inchideToast = useCallback((id: number) => setToasturi((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasturi((xs) => [...xs.slice(-2), { ...t, id }]);
      timere.current.push(window.setTimeout(() => inchideToast(id), t.tip === "eroare" ? 5200 : 4000));
    },
    [inchideToast]
  );

  const [notificari, setNotificari] = useState<Notificare[]>(NOTIFICARI_INITIALE);
  const [credite, setCredite] = useState(1264);
  const [bilete, setBilete] = useState(64);
  const [popupEveniment, setPopupEveniment] = useState(true);
  const [clientAles, setClientAles] = useState<string | null>(null);
  const [rezEvidentiata, setRezEvidentiata] = useState<string | null>(null);
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const [editari, setEditari] = useState<Record<string, Partial<Pick<Client, "taguri" | "note">>>>({});

  const adaugaRez = useCallback((r: Omit<Rez, "id">) => {
    seq.current += 1;
    const nou: Rez = { ...r, id: `n${seq.current}` };
    setRezState((xs) => [...xs, nou]);
    return nou;
  }, []);

  const schimbaStatus = useCallback(
    (id: string, s: StatusRez) => {
      const r = rez.find((x) => x.id === id);
      setRezState((xs) => xs.map((x) => (x.id === id ? { ...x, status: s, nou: false } : x)));
      const cuMesaj = s === "confirmata" && r?.tel;
      if (cuMesaj) setCredite((n) => n - 1);
      toast({
        tip: s === "anulata" || s === "respinsa" || s === "no_show" ? "info" : "succes",
        text: TEXT_STATUS[s],
        desc: cuMesaj
          ? "Oaspetele primește confirmarea pe WhatsApp (1 credit). În demo, mesajul nu pleacă."
          : r
            ? `${r.nume} · ${persoane(r.pers)} · ${fmtOra(r.start)}`
            : undefined,
      });
    },
    [rez, toast]
  );

  /* ---------- cereri noi din pagina publică, „live” ---------- */
  const [nLive, setNLive] = useState(0);
  const minutRef = useRef(minut);
  useEffect(() => {
    minutRef.current = minut;
  }, [minut]);
  useInterval(
    () => {
      const c = CERERI_LIVE[nLive];
      if (!c) return;
      setNLive((n) => n + 1);
      const r = adaugaRez({ ...c, nou: true, clientId: idClient(c.nume) });
      toast({ tip: "info", text: "Rezervare nouă din pagina publică", desc: `${c.nume} · ${persoane(c.pers)} · ${fmtOra(c.start)}` });
      setNotificari((xs) => [
        {
          id: Date.now(),
          text: `Cerere nouă: ${c.nume}`,
          desc: `${persoane(c.pers)} · azi, ${fmtOra(c.start)}${c.masaDorita ? ` · cere masa ${c.masaDorita}` : ""}`,
          ecran: "rezervari" as Ecran,
          rezId: r.id,
          citita: false,
          cand: fmtOra(minutRef.current / 60),
        },
        ...xs,
      ].slice(0, 12));
    },
    15000,
    !reducedMotion && nLive < CERERI_LIVE.length
  );

  /* ---------- biletele se mai vând, în timp ce te uiți ---------- */
  useInterval(() => setBilete((n) => Math.min(n + 1, 91)), 21000, !reducedMotion);

  const goEcran = useCallback((e: Ecran) => go(e), [go]);

  const valoare: DemoCtx = useMemo(
    () => ({
      mobil,
      reducedMotion,
      acum,
      rez,
      setRez,
      adaugaRez,
      schimbaStatus,
      toast,
      notify,
      go: goEcran,
      deschideClient: (id: string) => {
        setClientAles(id);
        go("client");
      },
      clientAles,
      rezEvidentiata,
      evidentiaza: setRezEvidentiata,
      notificari,
      citesteNotificari: () => setNotificari((xs) => xs.map((n) => ({ ...n, citita: true }))),
      credite,
      bilete,
      setBilete,
      popupEveniment,
      setPopupEveniment,
      editari,
      editeazaClient: (id, patch) => setEditari((e) => ({ ...e, [id]: { ...e[id], ...patch } })),
      portal,
    }),
    [
      mobil,
      reducedMotion,
      acum,
      rez,
      setRez,
      adaugaRez,
      schimbaStatus,
      toast,
      notify,
      goEcran,
      go,
      clientAles,
      rezEvidentiata,
      notificari,
      credite,
      bilete,
      popupEveniment,
      editari,
      portal,
    ]
  );

  return (
    <Ctx.Provider value={valoare}>
      <div
        ref={setPortal}
        className="tx-root relative h-full w-full overflow-hidden"
        style={{ background: L.bg, color: L.fg, fontFamily: FONT.sans, fontSize: 14, WebkitFontSmoothing: "antialiased" }}
      >
        <StiluriDemo />
        {ecran === "harta" && <EcranHarta />}
        {ecran === "rezervari" && <EcranRezervari />}
        {ecran === "acasa" && <EcranAcasa />}
        {ecran === "widget" && <EcranWidget />}
        {ecran === "client" && <EcranClienti />}
        {ecran === "evenimente" && <EcranEvenimente />}
        {ecran === "retea" && <EcranRetea />}
        <Toasturi
          lista={ecran === "widget" || ecran === "retea" ? [] : toasturi}
          pozitie={mobil ? "sus" : "jos-dreapta"}
          reducedMotion={reducedMotion}
          onInchide={inchideToast}
        />
      </div>
    </Ctx.Provider>
  );
}

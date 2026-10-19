"use client";

import { useRef, useState, type ReactNode } from "react";
import { Bell, Check, ChevronRight, CircleCheck, Clock, Lock, QrCode, Trophy } from "lucide-react";
import {
  C,
  CATEGORII,
  ETICHETA_TIP,
  HEATMAP,
  ORE_HEATMAP,
  PLANURI,
  cuvantPlural,
  cuvantZile,
  dataScurta,
  ora,
  plural,
  subsActive,
  valabilPana,
  type CatId,
} from "../data";
import { Bulina, ClientShell, NOTIFICARI } from "../shell";
import { useDemo } from "../store";
import { Btn, CIFRE, Card, DISPLAY, Dialog, Heatmap, Inel, LegendaHeatmap, Pastile, focus } from "../ui";

/* ============================================================
   Ecranul principal al membrului: cercul cu zilele rămase, butonul
   de scanare, cât de plină e sala acum, luna în curs, anunțurile.
   ============================================================ */

/** Ora demo-ului (10:17), pentru coloana „acum” din graficul zilei. */
const ORA_ACUM = 10;

const Titlu = ({ children, id }: { children: ReactNode; id?: string }) => (
  <h2 id={id} style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>
    {children}
  </h2>
);

/** O cifră mare cu unitatea lângă ea: „58 de oameni”. */
const Valoare = ({ n, unu, multe }: { n: number; unu: string; multe: string }) => (
  <p className="flex items-baseline gap-1.5">
    <span style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em", ...CIFRE }}>{n}</span>
    <span style={{ fontSize: 14, color: C.text2 }}>{cuvantPlural(n, unu, multe)}</span>
  </p>
);

export default function Acasa() {
  const { mobile, getM, go, notify, st } = useDemo();
  const [cumpara, setCumpara] = useState(false);
  const m = getM("c0");
  const sub = subsActive(m)[0];
  const intrat = st.intrati[m.id];

  const onTab = (k: string) => {
    if (k === "acasa") return;
    if (k === "abonament") setCumpara(true);
    else
      notify(
        k === "antrenamente"
          ? "Antrenamentele nu sunt incluse în demo."
          : k === "social"
            ? "Chat-ul nu e inclus în demo."
            : "Profilul nu e inclus în demo."
      );
  };

  const zile = sub ? sub.exp : 0;

  const cardAbonament = sub && (
    <Card className="flex flex-col items-center gap-3" style={{ padding: mobile ? "20px 20px 22px" : "24px 24px 26px" }}>
      <p className="text-center" style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}>
        {sub.nume}
      </p>
      <Inel procent={zile / 30} valoare={zile} eticheta={cuvantZile(zile)} size={mobile ? 176 : 184} />
      <p style={{ fontSize: 14, color: C.text2 }}>Valabil până pe {valabilPana(sub.exp)}</p>
      <Pastile contoare={sub.contoare} />
      {intrat !== undefined && (
        <p className="flex items-center gap-1.5" style={{ color: C.succes, fontSize: 13, fontWeight: 600, ...CIFRE }}>
          <CircleCheck size={15} aria-hidden /> Ai intrat azi la {ora(intrat)}
        </p>
      )}
    </Card>
  );

  const scanare = (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => go("scanare")}
        className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-[12px] transition-[filter] duration-150 hover:brightness-[0.97] active:brightness-[0.93] ${focus}`}
        style={{ background: C.auriu, color: C.text }}
      >
        <QrCode size={22} strokeWidth={2} aria-hidden />
        <span style={{ fontSize: 17, fontWeight: 600 }}>Scanează la intrare</span>
      </button>
      <button
        type="button"
        onClick={() => setCumpara(true)}
        className={`flex items-center gap-1 rounded-[8px] px-2 py-1.5 ${focus}`}
        style={{ fontSize: 14, fontWeight: 600, color: C.mov }}
      >
        Cumpără abonament <ChevronRight size={16} aria-hidden />
      </button>
    </div>
  );

  const azi = HEATMAP[2];
  const acumSala = (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <Titlu>Acum la sală</Titlu>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.avertCerneala }}>moderat</span>
      </div>
      <Valoare n={st.inSala} unu="om" multe="oameni" />
      <div aria-hidden>
        <div className="flex h-[44px] items-end gap-[3px]">
          {azi.map((v, k) => (
            <span
              key={k}
              className="flex-1 rounded-t-[2px]"
              style={{ height: `${Math.max(8, (v ?? 0) * 100)}%`, background: ORE_HEATMAP[k] === ORA_ACUM ? C.auriu : C.movStins }}
            />
          ))}
        </div>
        <div className="relative mt-1 h-4" style={{ fontSize: 11, color: C.text2, ...CIFRE }}>
          {[7, 12, 17, 21].map((h) => (
            <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h - ORE_HEATMAP[0] + 0.5) / ORE_HEATMAP.length) * 100}%` }}>
              {h}
            </span>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 13, color: C.text2 }}>Mai liber azi: 13:00–15:00</p>
    </Card>
  );

  const vizLuna = 11 + (intrat !== undefined ? 1 : 0);
  const luna = (
    <Card className="flex flex-col gap-3">
      <Titlu>Septembrie</Titlu>
      <Valoare n={vizLuna} unu="vizită" multe="vizite" />
      <p className="mt-auto flex items-center gap-1.5" style={{ fontSize: 13, color: C.text2 }}>
        <Trophy size={14} aria-hidden /> Încă {plural(100 - m.vizite, "vizită", "vizite")} până la insigna de 100
      </p>
    </Card>
  );

  const oreAglomerate = (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Titlu>Ore aglomerate</Titlu>
        <LegendaHeatmap />
      </div>
      <Heatmap celula={24} gap={4} oraCurenta={ORA_ACUM} />
    </Card>
  );

  const lista = st.anunturi.slice(0, mobile ? 3 : 2);
  const anunturi = (
    <Card>
      <Titlu id="anunturi-sala">Anunțuri</Titlu>
      <ul aria-labelledby="anunturi-sala">
        {lista.map((an, i) => (
          <li key={an.id} className={i === lista.length - 1 ? "pt-3" : "py-3"} style={{ borderTop: i ? `1px solid ${C.contur}` : undefined }}>
            <p style={{ fontSize: 14, fontWeight: 600 }}>{an.titlu}</p>
            <p style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.45, marginTop: 2 }}>{an.text}</p>
            <p style={{ fontSize: 12, color: C.text2, marginTop: 4, ...CIFRE }}>
              {an.o === 0 ? `azi, ${an.ora}` : an.o === -1 ? `ieri, ${an.ora}` : dataScurta(an.o)}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );

  const salut = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h1 style={{ fontFamily: DISPLAY, fontSize: mobile ? 22 : 24, fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.01em" }}>Bună, {m.prenume}</h1>
        <p style={{ fontSize: 13, color: C.text2, marginTop: 2, ...CIFRE }}>#{m.cod}</p>
      </div>
      {mobile && (
        <button
          type="button"
          aria-label="Notificări, 2 necitite"
          onClick={() => notify(NOTIFICARI)}
          className={`relative -mr-1 flex size-10 items-center justify-center rounded-full ${focus}`}
        >
          <Bell size={23} color={C.mov} fill={C.fMov} aria-hidden />
          <Bulina n={2} className="absolute right-0.5 top-0.5" />
        </button>
      )}
    </div>
  );

  return (
    <ClientShell onTab={onTab}>
      {mobile ? (
        <div className="flex flex-col gap-5 px-5 pb-8 pt-3">
          {salut}
          {cardAbonament}
          {scanare}
          {acumSala}
          {luna}
          {anunturi}
        </div>
      ) : (
        <div className="mx-auto flex max-w-[1140px] flex-col gap-6 px-8 pb-8 pt-7">
          {salut}
          <div className="grid grid-cols-[400px_1fr] items-start gap-8">
            <div className="flex flex-col gap-4">
              {cardAbonament}
              {scanare}
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                {acumSala}
                {luna}
              </div>
              {oreAglomerate}
              {anunturi}
            </div>
          </div>
        </div>
      )}
      {cumpara && <Cumpara onClose={() => setCumpara(false)} />}
    </ClientShell>
  );
}

/* ---------------- cumpărarea online ---------------- */

const mare = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Cumpara({ onClose }: { onClose: () => void }) {
  const { notify, getM, mobile, rm } = useDemo();
  const [cat, setCat] = useState<CatId>("anytime");
  const planuri = PLANURI.filter((p) => p.cat === cat);
  const [planId, setPlanId] = useState("anytime-u");
  const plan = planuri.find((p) => p.id === planId) ?? planuri[planuri.length - 1];
  const categorie = CATEGORII.find((c) => c.id === cat)!;
  const activ = subsActive(getM("c0")).find((s) => s.cat === cat);

  const eticheta = (n: number | null, tipuri: number) =>
    tipuri > 1 ? (n === null ? "Full" : `${n} + ${n / 2}`) : n === null ? "Nelimitat" : `${n} ședințe`;

  const taburi = useRef<HTMLDivElement>(null);
  const alegeCat = (c: CatId, el?: HTMLElement) => {
    setCat(c);
    const ps = PLANURI.filter((p) => p.cat === c);
    setPlanId(ps[ps.length - 1].id);
    // pe telefon, tab-ul ales vine în vedere în bara derulabilă
    const bara = taburi.current;
    if (bara && el) bara.scrollTo({ left: Math.max(0, el.offsetLeft - 24), behavior: rm ? "auto" : "smooth" });
  };

  return (
    <Dialog
      titlu="Cumpără abonament"
      onClose={onClose}
      footer={
        !categorie.online ? (
          <Btn lat mare v="mov" onClick={() => notify("Verificarea documentului e oprită în demo.")}>
            Trimite legitimația
          </Btn>
        ) : activ ? (
          <p className="rounded-[8px] px-3.5 py-3 text-center" style={{ background: C.fMov, color: C.mov, fontSize: 13.5, fontWeight: 500 }}>
            Ai deja „{activ.nume}”, valabil până pe {valabilPana(activ.exp)}.
          </p>
        ) : (
          <Btn lat mare onClick={() => notify("Plata Netopia e oprită în demo.")} style={{ fontSize: 16 }}>
            Plătește {plan.pret} lei
          </Btn>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <div
          ref={taburi}
          role="tablist"
          aria-label="Categorii"
          className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
          style={{ flexWrap: mobile ? "nowrap" : "wrap" }}
        >
          {CATEGORII.map((c) => {
            const on = c.id === cat;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={(e) => alegeCat(c.id, e.currentTarget)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors duration-150 ${on ? "" : "hover:text-[#111827]"} ${focus}`}
                style={{
                  fontSize: 13.5,
                  lineHeight: "20px",
                  fontWeight: on ? 600 : 500,
                  background: on ? C.mov : C.card,
                  color: on ? "#fff" : C.text2Tare,
                  boxShadow: on ? undefined : `inset 0 0 0 1px ${C.conturCamp}`,
                }}
              >
                {!c.online && <Lock size={13} aria-hidden />}
                {c.nume}
                {!c.online && <span className="sr-only">, după verificarea legitimației</span>}
              </button>
            );
          })}
        </div>

        <div role="tablist" aria-label="Ședințe" className="flex rounded-[10px]" style={{ background: C.dezactivat, padding: 3, gap: 2 }}>
          {planuri.map((p) => {
            const on = p.id === plan.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPlanId(p.id)}
                className={`flex-1 rounded-[7px] py-1.5 transition-colors duration-150 ${on ? "" : "hover:text-[#111827]"} ${focus}`}
                style={{
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: on ? 600 : 500,
                  background: on ? C.card : "transparent",
                  color: on ? C.text : C.text2Tare,
                  boxShadow: on ? `inset 0 0 0 1px ${C.contur}` : undefined,
                }}
              >
                {eticheta(p.contoare[0].n, p.contoare.length)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-1 py-1">
          <p style={{ fontSize: 14, fontWeight: 500, color: C.text2 }}>{plan.nume}</p>
          <p style={{ fontFamily: DISPLAY, fontSize: 48, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.02em", color: C.text, ...CIFRE }}>
            {plan.pret}
            <span style={{ fontSize: 20, fontWeight: 400, marginLeft: 6, letterSpacing: 0 }}>lei</span>
          </p>
          <p style={{ fontSize: 12.5, color: C.text2 }}>TVA inclus · {plural(30, "zi", "zile")}</p>
        </div>

        <ul className="flex flex-col gap-2.5" style={{ fontSize: 14 }}>
          {plan.contoare.map((c) => (
            <li key={c.tip} className="flex items-center gap-2.5">
              <Check size={16} color={C.text2} aria-hidden />
              <span>
                {c.n === null ? `${mare(ETICHETA_TIP[c.tip])} nelimitat` : `${c.n} ședințe ${ETICHETA_TIP[c.tip]}`}
                <span style={{ color: C.text2 }}> · 90 de minute</span>
              </span>
            </li>
          ))}
          <li className="flex items-center gap-2.5">
            <Clock size={16} color={C.text2} aria-hidden />
            {plan.interval ? `Acces ${plan.interval}` : "Acces oricând, în programul sălii"}
          </li>
          <li className="flex items-center gap-2.5">
            <Check size={16} color={C.text2} aria-hidden />
            Factură pe email
          </li>
        </ul>

        {!categorie.online && (
          <p className="rounded-[8px] px-3.5 py-3" style={{ background: C.fAvert, color: C.avertText, fontSize: 13.5, lineHeight: 1.5 }}>
            Online după verificarea legitimației. Până atunci, de la recepție.
          </p>
        )}
      </div>
    </Dialog>
  );
}

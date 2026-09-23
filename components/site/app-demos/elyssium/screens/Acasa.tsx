"use client";

import { useRef, useState } from "react";
import { Bell, Check, ChevronRight, Clock, Lock, Megaphone, QrCode, Trophy, CircleCheck } from "lucide-react";
import {
  C,
  CATEGORII,
  CULORI_TIP,
  HEATMAP,
  ORE_HEATMAP,
  PLANURI,
  UMBRA,
  cuvantZile,
  dataScurta,
  ETICHETA_TIP,
  ora,
  plural,
  pluralZile,
  subsActive,
  valabilPana,
  type CatId,
} from "../data";
import { ClientShell } from "../shell";
import { useDemo } from "../store";
import { Btn, Card, DISPLAY, Dialog, Heatmap, Inel, LegendaHeatmap, LiveDot, Pastile, focus, useAnim } from "../ui";

/* ============================================================
   Ecranul principal al clientului: cercul cu zilele rămase,
   butonul mare SCANARE, cât de plină e sala, anunțurile.
   ============================================================ */

const VIZITE_SAPT = [2, 3, 4, 3, 2, 3, 4, 2];

export default function Acasa() {
  const { mobile, getM, go, notify, st } = useDemo();
  const a = useAnim();
  const [cumpara, setCumpara] = useState(false);
  const m = getM("c0");
  const sub = subsActive(m)[0];
  const intrat = st.intrati[m.id];
  const ultimaScanare = st.scans.find((s) => s.memberId === m.id && s.status === "consumat");

  const onTab = (k: string) => {
    if (k === "acasa") return;
    if (k === "abonament") setCumpara(true);
    else
      notify(
        k === "antrenamente"
          ? "Jurnalul de antrenamente, recordurile și insignele sunt în aplicația reală; demo-ul arată abonamentul și intrarea în sală."
          : k === "social"
            ? "Chat-ul cu prietenii nu e inclus în demo. În aplicația reală, prietenii se adaugă după tag, ca Andrei#K7Q2M."
            : "Profilul nu e inclus în demo. În aplicația reală, aici se schimbă poza, datele de facturare și se poate șterge contul."
      );
  };

  const zile = sub ? sub.exp : 0;

  const cardAbonament = sub && (
    <Card className={`flex flex-col items-center gap-3 ${a("fadeUp")}`} style={{ padding: mobile ? "22px 20px" : "26px 24px" }}>
      <p className="text-center" style={{ fontSize: 20, fontWeight: 600 }}>
        {sub.nume}
      </p>
      <Inel procent={zile / 30} valoare={zile} eticheta={cuvantZile(zile)} size={mobile ? 216 : 232} />
      <p style={{ fontSize: 14, fontWeight: 500, color: C.text2 }}>Valabil până pe {valabilPana(sub.exp)}</p>
      <Pastile contoare={sub.contoare} />
      {intrat !== undefined && ultimaScanare?.consum && (
        <p className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${a("pop")}`} style={{ background: C.fSucces, color: C.succes, fontSize: 13, fontWeight: 600 }}>
          <CircleCheck size={15} /> Ai intrat azi la {ora(intrat)} · o ședință {ETICHETA_TIP[ultimaScanare.consum.tip]}
        </p>
      )}
    </Card>
  );

  const scanare = (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => go("scanare")}
        aria-label="Scanează codul QR de la recepție"
        className={`flex min-h-[68px] items-center justify-center gap-3 rounded-[16px] transition-[filter] hover:brightness-[0.97] active:brightness-[0.92] ${focus}`}
        style={{ background: C.auriu, color: C.text, boxShadow: "0 6px 16px rgba(17,24,39,0.16)" }}
      >
        <QrCode size={26} strokeWidth={2.2} />
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.075em" }}>SCANARE</span>
      </button>
      <p className="text-center" style={{ fontSize: 12.5, color: C.text2 }}>
        Scanează codul QR de la recepție ca să îți înregistrezi intrarea.
      </p>
    </div>
  );

  const azi = HEATMAP[2];
  const acumSala = (
    <Card className="flex flex-col gap-3" style={{ padding: "16px 18px" }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600 }}>
          <LiveDot size={7} /> Acum la sală
        </span>
        <span className="rounded-full px-2.5 py-0.5" style={{ background: C.fAvert, color: "#B45309", fontSize: 12, fontWeight: 700 }}>
          moderat
        </span>
      </div>
      <p style={{ fontSize: 13, color: C.text2 }}>
        <b style={{ fontSize: 26, color: C.text, fontFamily: DISPLAY, fontVariantNumeric: "tabular-nums" }}>{st.inSala}</b> de oameni înăuntru
      </p>
      <div className="flex h-[46px] items-end gap-[3px]" aria-hidden>
        {azi.map((v, k) => (
          <span
            key={k}
            className="flex-1 rounded-t-[3px]"
            style={{
              height: `${Math.max(8, (v ?? 0) * 100)}%`,
              background: ORE_HEATMAP[k] === 9 ? C.auriu : ORE_HEATMAP[k] < 9 ? "rgba(74,43,122,0.55)" : "rgba(74,43,122,0.16)",
            }}
          />
        ))}
      </div>
      <div className="flex justify-between" style={{ fontSize: 10.5, color: C.text2 }}>
        <span>7</span>
        <span>12</span>
        <span>17</span>
        <span>21</span>
      </div>
      <p style={{ fontSize: 12.5, color: C.text2 }}>Cel mai liniștit azi: între 13:00 și 15:00.</p>
    </Card>
  );

  const vizite = m.vizite;
  const lunaTa = (
    <Card className="flex flex-col gap-3" style={{ padding: "16px 18px" }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>Luna ta</span>
      <p style={{ fontSize: 13, color: C.text2 }}>
        <b style={{ fontSize: 26, color: C.text, fontFamily: DISPLAY }}>{11 + (intrat !== undefined ? 1 : 0)}</b> vizite în septembrie
      </p>
      <div className="flex h-[46px] items-end gap-1.5" aria-hidden>
        {VIZITE_SAPT.map((v, i) => {
          const val = i === VIZITE_SAPT.length - 1 && intrat !== undefined ? v + 1 : v;
          return <span key={i} className="flex-1 rounded-t-[4px]" style={{ height: `${(val / 5) * 100}%`, background: i === VIZITE_SAPT.length - 1 ? C.mov : C.fMov }} />;
        })}
      </div>
      <p className="flex items-center gap-1.5" style={{ fontSize: 12.5, color: C.text2 }}>
        <Trophy size={14} color="#B45309" /> Încă {plural(100 - vizite, "vizită", "vizite")} până la insigna de 100.
      </p>
    </Card>
  );

  const anunturi = (
    <section aria-labelledby="anunturi-sala" className="flex flex-col gap-2.5">
      <h2 id="anunturi-sala" style={{ fontSize: 17, fontWeight: 700 }}>
        Anunțuri de la sală
      </h2>
      {st.anunturi.slice(0, mobile ? 3 : 2).map((an) => (
        <Card key={an.id} className={`flex gap-3 ${an.o === 0 ? a("fadeUp") : ""}`} style={{ padding: "14px 16px" }}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full" style={{ background: C.fMov }}>
            <Megaphone size={17} color={C.mov} />
          </span>
          <span className="min-w-0">
            <span className="block" style={{ fontSize: 14.5, fontWeight: 600 }}>
              {an.titlu}
            </span>
            <span className="mt-0.5 block" style={{ fontSize: 13, color: C.text2, lineHeight: 1.45 }}>
              {an.text}
            </span>
            <span className="mt-1 block" style={{ fontSize: 11.5, color: C.text2 }}>
              {an.o === 0 ? `azi, ${an.ora}` : an.o === -1 ? `ieri, ${an.ora}` : dataScurta(an.o)}
            </span>
          </span>
        </Card>
      ))}
    </section>
  );

  const salut = (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <p style={{ fontSize: mobile ? 24 : 30, fontWeight: 700, lineHeight: 1.2 }}>Salut, {m.prenume}! 👋</p>
        <p style={{ fontSize: 14, fontWeight: 500, color: C.text2, marginTop: 2 }}>
          {m.prenume} {m.nume}
          <span style={{ color: C.mov, fontWeight: 600 }}>#{m.cod}</span>
        </p>
      </div>
      {mobile && (
        <button
          type="button"
          aria-label="Notificări, 2 necitite"
          onClick={() => notify("În demo, clopoțelul nu se deschide. În aplicația reală, aici apar anunțurile sălii și reamintirea cu 3 zile înainte de expirare.")}
          className={`relative -mr-1 flex size-10 items-center justify-center rounded-full ${focus}`}
        >
          <Bell size={24} color={C.mov} fill={C.fMov} />
          <span className="absolute right-0.5 top-0.5 flex size-[18px] items-center justify-center rounded-full text-[10px] font-bold" style={{ background: C.coral, color: "#fff" }}>
            2
          </span>
        </button>
      )}
    </div>
  );

  const linkCumpara = (
    <button
      type="button"
      onClick={() => setCumpara(true)}
      className={`mx-auto flex items-center gap-1 rounded-[8px] px-2 py-1 ${focus}`}
      style={{ fontSize: 14, fontWeight: 600, color: C.mov }}
    >
      Cumpără sau reînnoiește online <ChevronRight size={16} />
    </button>
  );

  return (
    <ClientShell onTab={onTab}>
      {mobile ? (
        <div className="flex flex-col gap-6 px-6 pb-8 pt-4">
          {salut}
          {cardAbonament}
          {scanare}
          {acumSala}
          {lunaTa}
          {linkCumpara}
          {anunturi}
        </div>
      ) : (
        <div className="mx-auto grid max-w-[1140px] grid-cols-[400px_1fr] gap-8 px-8 pb-8 pt-7">
          <div className="flex flex-col gap-5">
            {salut}
            {cardAbonament}
            {scanare}
            {linkCumpara}
          </div>
          <div className="flex min-w-0 flex-col gap-5 pt-[62px]">
            <div className="grid grid-cols-2 gap-5">
              {acumSala}
              {lunaTa}
            </div>
            <Card className="flex flex-col gap-3" style={{ padding: "16px 18px" }}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600 }}>
                  <Clock size={16} color={C.mov} /> Ore aglomerate
                </span>
                <LegendaHeatmap />
              </div>
              <Heatmap celula={25} gap={4} />
              <p style={{ fontSize: 12, color: C.text2 }}>Din intrările tuturor, pe ultimele 8 săptămâni. Datele sunt anonime.</p>
            </Card>
            {anunturi}
          </div>
        </div>
      )}
      {cumpara && <Cumpara onClose={() => setCumpara(false)} />}
    </ClientShell>
  );
}

/* ---------------- cumpărarea online ---------------- */

function Cumpara({ onClose }: { onClose: () => void }) {
  const { notify, getM, mobile, rm } = useDemo();
  const a = useAnim();
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
      titlu="Cumpără un abonament"
      subtitlu="Valabil 30 de zile de la plată"
      onClose={onClose}
      footer={
        !categorie.online ? (
          <Btn
            lat
            mare
            v="mov"
            onClick={() => notify("În demo, verificarea documentului e oprită. În aplicația reală trimiți o poză cu legitimația, iar recepția o aprobă din panou.")}
          >
            <Lock size={16} /> Verifică-te ca să deblochezi
          </Btn>
        ) : activ ? (
          <p className="rounded-[12px] px-3.5 py-3 text-center" style={{ background: C.fMov, color: C.mov, fontSize: 13.5, fontWeight: 500 }}>
            Ai deja „{activ.nume}” activ până pe {valabilPana(activ.exp)}. Poți cumpăra altă categorie oricând.
          </p>
        ) : (
          <Btn
            lat
            mare
            onClick={() =>
              notify(
                `În demo, plata de ${plan.pret} lei nu pornește. În aplicația reală, Netopia confirmă plata, abonamentul se activează pe loc și factura SmartBill pleacă pe email.`
              )
            }
            style={{ fontSize: 17, padding: "15px 18px", fontWeight: 700 }}
          >
            Plătesc {plan.pret} lei
          </Btn>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <div ref={taburi} role="tablist" aria-label="Categorii" className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" style={{ flexWrap: mobile ? "nowrap" : "wrap" }}>
          {CATEGORII.map((c) => {
            const on = c.id === cat;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={(e) => alegeCat(c.id, e.currentTarget)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 transition-colors ${focus}`}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  background: on ? C.mov : C.card,
                  color: on ? "#fff" : C.text2,
                  boxShadow: on ? undefined : `inset 0 0 0 1.5px ${C.contur}`,
                }}
              >
                {!c.online && <Lock size={13} />}
                {c.nume}
              </button>
            );
          })}
        </div>

        <div role="tablist" aria-label="Ședințe" className="flex rounded-[14px] p-1" style={{ background: C.dezactivat }}>
          {planuri.map((p) => {
            const on = p.id === plan.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPlanId(p.id)}
                className={`flex-1 rounded-[11px] py-2 transition-all ${focus}`}
                style={{ fontSize: 14, fontWeight: 600, background: on ? C.card : "transparent", color: on ? C.text : C.text2, boxShadow: on ? UMBRA : undefined }}
              >
                {eticheta(p.contoare[0].n, p.contoare.length)}
              </button>
            );
          })}
        </div>

        <div key={plan.id} className={`flex flex-col items-center gap-1 py-2 ${a("fadeUp")}`}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text2 }}>{plan.nume}</p>
          <p style={{ fontFamily: DISPLAY, fontSize: 68, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em", color: C.text }}>
            {plan.pret}
            <span style={{ fontSize: 26, fontWeight: 700, marginLeft: 6, letterSpacing: 0 }}>lei</span>
          </p>
          <p style={{ fontSize: 12.5, color: C.text2 }}>TVA 21% inclus · {pluralZile(30)} de la plată</p>
        </div>

        <ul className="flex flex-col gap-2.5">
          {plan.contoare.map((c) => (
            <li key={c.tip} className="flex items-center gap-2.5" style={{ fontSize: 14.5 }}>
              <span className="flex size-6 items-center justify-center rounded-full" style={{ background: CULORI_TIP[c.tip].bg }}>
                <Check size={14} color={CULORI_TIP[c.tip].fg} strokeWidth={3} />
              </span>
              {c.n === null ? `${ETICHETA_TIP[c.tip].charAt(0).toUpperCase()}${ETICHETA_TIP[c.tip].slice(1)} nelimitat` : `${c.n} ședințe ${ETICHETA_TIP[c.tip]}`}
              <span style={{ color: C.text2 }}>· 90 de minute</span>
            </li>
          ))}
          <li className="flex items-center gap-2.5" style={{ fontSize: 14.5 }}>
            <span className="flex size-6 items-center justify-center rounded-full" style={{ background: C.fAuriu }}>
              <Clock size={13} color="#86650A" strokeWidth={2.6} />
            </span>
            {plan.interval ? `Acces ${plan.interval}` : "Acces oricând, în programul sălii"}
          </li>
          <li className="flex items-center gap-2.5" style={{ fontSize: 14.5 }}>
            <span className="flex size-6 items-center justify-center rounded-full" style={{ background: C.fSucces }}>
              <Check size={14} color={C.succes} strokeWidth={3} />
            </span>
            Factura vine pe email, automat
          </li>
        </ul>

        {!categorie.online && (
          <p className="rounded-[12px] px-3.5 py-3" style={{ background: C.fAvert, color: C.avertText, fontSize: 13.5, lineHeight: 1.5 }}>
            {categorie.nume} se deblochează online după ce recepția îți verifică documentul. Până atunci, îl cumperi de la recepție.
          </p>
        )}
      </div>
    </Dialog>
  );
}

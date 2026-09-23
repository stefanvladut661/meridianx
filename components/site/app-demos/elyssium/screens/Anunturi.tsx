"use client";

import { useEffect, useState } from "react";
import { BellRing, Megaphone, Pencil, PhoneCall, Send, Smartphone, Trash2, Users } from "lucide-react";
import { num, pct, useInterval } from "../../kit";
import { C, GRADIENT, dataScurta, lume, ziSapt, dataLunga } from "../data";
import { useDemo } from "../store";
import { AntetPagina, StaffShell } from "../shell";
import { Btn, Card, Chip, H2, LogoMark, focus, useAnim } from "../ui";

/* ============================================================
   Anunțuri — unealta de marketing a sălii: un anunț publicat apare
   în aplicație, în clopoțelul fiecărui client și pleacă push la toți.
   Plus reamintirea automată de expirare și lista de recuperat.
   ============================================================ */

const SABLOANE = [
  {
    eticheta: "Reînnoire din telefon",
    titlu: "Abonamentul, reînnoit din telefon",
    text: "Dacă îți expiră abonamentul săptămâna asta, îl reînnoiești din aplicație în câteva secunde. Factura vine pe email.",
  },
  {
    eticheta: "Program de sărbătoare",
    titlu: "Program special de 1 Decembrie",
    text: "Luni, 1 decembrie, sala e deschisă între 9:00 și 15:00. Zona SPA, între 10:00 și 14:00.",
  },
  {
    eticheta: "Aerobic",
    titlu: "Locuri în plus la aerobic, joi seara",
    text: "Clasa de joi de la 19:00 are de acum 6 locuri în plus. Rezervarea rămâne pe platforma de aerobic.",
  },
];

const MAX_TITLU = 200;

export default function Anunturi() {
  const { st, publica, notify, mobile, rm } = useDemo();
  const a = useAnim();
  const [titlu, setTitlu] = useState("");
  const [text, setText] = useState("");
  const [citite, setCitite] = useState<Record<string, number>>({});
  const [anuntat, setAnuntat] = useState("");
  const total = lume().clienti.length;

  // anunțul abia publicat: citirile urcă pe măsură ce oamenii deschid notificarea
  const nou = st.anunturi.find((x) => x.o === 0 && x.citite === 0);
  useInterval(
    () => {
      if (!nou) return;
      setCitite((c) => {
        const v = c[nou.id] ?? 0;
        if (v > total * 0.38) return c;
        return { ...c, [nou.id]: v + 18 + Math.floor(Math.random() * 60) };
      });
    },
    900,
    !!nou && !rm
  );
  useEffect(() => {
    if (!anuntat) return;
    const t = window.setTimeout(() => setAnuntat(""), 4000);
    return () => window.clearTimeout(t);
  }, [anuntat]);

  const trimite = () => {
    if (!titlu.trim() || !text.trim()) return;
    publica(titlu.trim(), text.trim());
    setAnuntat(titlu.trim());
    setTitlu("");
    setText("");
    notify("Anunțul e publicat în aplicație. În demo, notificarea push nu pleacă pe telefoane; în aplicația reală ajunge la toți clienții în câteva secunde.");
  };

  const camp = "w-full rounded-[12px] px-3.5 py-2.5 outline-none focus:[border-color:#4A2B7A]";
  const compozitor = (
    <Card className="flex flex-col gap-3.5">
      <H2>Anunț nou</H2>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pornește de la un șablon">
        {SABLOANE.map((s) => (
          <button
            key={s.eticheta}
            type="button"
            onClick={() => {
              setTitlu(s.titlu);
              setText(s.text);
            }}
            className={`rounded-full px-3 py-1.5 transition-colors hover:[box-shadow:inset_0_0_0_1.5px_#4A2B7A] ${focus}`}
            style={{ fontSize: 12.5, fontWeight: 600, color: C.mov, background: C.fMov }}
          >
            {s.eticheta}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="flex justify-between" style={{ fontSize: 14, fontWeight: 500 }}>
          Titlu
          <span style={{ fontSize: 12, color: C.text2, fontVariantNumeric: "tabular-nums" }}>
            {titlu.length}/{MAX_TITLU}
          </span>
        </span>
        <input value={titlu} maxLength={MAX_TITLU} onChange={(e) => setTitlu(e.target.value)} placeholder="Ce s-a schimbat la sală?" className={camp} style={{ border: `1.5px solid ${C.contur}`, fontSize: 15, background: C.card, color: C.text }} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span style={{ fontSize: 14, fontWeight: 500 }}>Text</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={mobile ? 4 : 3}
          placeholder="Două-trei propoziții: ce, când, ce trebuie să facă omul."
          className={`${camp} resize-none`}
          style={{ border: `1.5px solid ${C.contur}`, fontSize: 15, background: C.card, color: C.text, lineHeight: 1.5 }}
        />
      </label>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" style={{ fontSize: 13, color: C.text2 }}>
        <span className="flex items-center gap-1.5">
          <Users size={15} color={C.mov} /> {num(total)} de clienți
        </span>
        <span className="flex items-center gap-1.5">
          <Smartphone size={15} color={C.mov} /> în aplicație
        </span>
        <span className="flex items-center gap-1.5">
          <BellRing size={15} color={C.mov} /> clopoțel + push
        </span>
        <Btn className="ml-auto" onClick={trimite} disabled={!titlu.trim() || !text.trim()}>
          <Send size={15} /> Publică anunțul
        </Btn>
      </div>
      {anuntat && (
        <p role="status" className={`rounded-[12px] px-3.5 py-2.5 ${a("fadeUp")}`} style={{ background: C.fSucces, color: C.succes, fontSize: 13.5, fontWeight: 500 }}>
          „{anuntat}” e publicat. Apare deja pe ecranul principal al aplicației.
        </p>
      )}
    </Card>
  );

  const previzualizare = (
    <div className="flex flex-col gap-2">
      <p style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>Cum arată pe telefon</p>
      <div
        className="relative overflow-hidden rounded-[30px] px-4 pb-5 pt-6"
        style={{ height: mobile ? 280 : 316, background: "linear-gradient(160deg, #2A1B46 0%, #4A2B7A 45%, #6B8DEF 80%, #E88B84 110%)", boxShadow: "inset 0 0 0 6px #0C0D0F" }}
        aria-label="Previzualizarea notificării push"
        role="img"
      >
        <p className="text-center" style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500 }}>
          {ziSapt(0).charAt(0).toUpperCase() + ziSapt(0).slice(1)}, {dataLunga(0).replace(" 2026", "")}
        </p>
        <p className="text-center" style={{ color: "#fff", fontSize: 58, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          9:41
        </p>
        <div className="mt-5 flex gap-2.5 rounded-[18px] px-3 py-2.5" style={{ background: "rgba(255,255,255,0.9)" }}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px]" style={{ background: C.card }}>
            <LogoMark size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex justify-between" style={{ fontSize: 12, color: "#3F3F46" }}>
              <b style={{ fontWeight: 600 }}>ELYSSIUM</b> acum
            </span>
            <span className="block truncate" style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {titlu || "Aparate noi în zona de forță"}
            </span>
            <span className="line-clamp-3 block" style={{ fontSize: 13, color: "#27272A", lineHeight: 1.35 }}>
              {text || "Au sosit două rack-uri și o presă de picioare. Le găsești lângă oglinda mare, de azi."}
            </span>
          </span>
        </div>
      </div>
    </div>
  );

  const lista = (
    <Card className="flex flex-col gap-1">
      <H2 right={<span style={{ fontSize: 13, color: C.text2 }}>{st.anunturi.length} publicate</span>}>Anunțuri publicate</H2>
      <ul className="mt-2 flex flex-col">
        {st.anunturi.map((an, i) => {
          const c = an.citite + (citite[an.id] ?? 0);
          const p = c / an.trimise;
          return (
            <li key={an.id} className={`flex ${mobile ? "flex-col gap-2" : "items-start gap-4"} py-3.5 ${an.o === 0 ? a("fadeUp") : ""}`} style={{ borderTop: i ? `1px solid ${C.contur}` : undefined }}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full" style={{ background: C.fMov, display: mobile ? "none" : undefined }}>
                <Megaphone size={17} color={C.mov} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2" style={{ fontSize: 15, fontWeight: 600 }}>
                  {an.titlu}
                  {an.o === 0 && <Chip ton="succes" mic>NOU</Chip>}
                </p>
                <p style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.45 }}>{an.text}</p>
                <p style={{ fontSize: 12.5, color: C.text2, marginTop: 4 }}>
                  {an.o === 0 ? `azi, ${an.ora}` : an.o === -1 ? `ieri, ${an.ora}` : `${dataScurta(an.o)}, ${an.ora}`} · {an.autor}
                </p>
              </div>
              <div className={`flex shrink-0 flex-col gap-1.5 ${mobile ? "" : "w-[210px]"}`}>
                <div className="flex justify-between" style={{ fontSize: 12.5, color: C.text2 }}>
                  <span>
                    citit de <b style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{num(c)}</b> din {num(an.trimise)}
                  </span>
                  <b style={{ color: C.mov }}>{pct(p * 100, 0)}</b>
                </div>
                <span className="h-2 overflow-hidden rounded-full" style={{ background: C.dezactivat }}>
                  <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${p * 100}%`, background: GRADIENT }} />
                </span>
                <span className="flex justify-end gap-1">
                  <Btn v="fantoma" mic onClick={() => notify("În demo, editarea e oprită. În aplicația reală, corectura se vede în aplicație, fără un push nou.")}>
                    <Pencil size={13} /> Editează
                  </Btn>
                  <Btn v="textPericulos" mic onClick={() => notify("În demo, anunțul nu se șterge. În aplicația reală, ștergerea cere confirmare și îl scoate din aplicație și din clopoțel.")}>
                    <Trash2 size={13} /> Șterge
                  </Btn>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );

  const automate = (
    <Card className="flex flex-col gap-3">
      <H2>Pe pilot automat</H2>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full" style={{ background: C.fAuriu }}>
          <BellRing size={17} color="#86650A" />
        </span>
        <div className="flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ fontSize: 14.5, fontWeight: 600 }}>
            Reamintire de expirare
            <Chip ton="succes" mic>
              ACTIVĂ
            </Chip>
          </p>
          <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.45 }}>Push cu 3 zile înainte să expire abonamentul. {num(lume().expiraCurand)} de clienți expiră în următoarele 7 zile.</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full" style={{ background: C.fEroare }}>
          <PhoneCall size={16} color={C.eroare} />
        </span>
        <div className="flex-1">
          <p style={{ fontSize: 14.5, fontWeight: 600 }}>Clienți de recuperat</p>
          <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.45 }}>{num(lume().deSunat.length)} au expirat în ultimele 30 de zile și n-au reînnoit. Lista cu telefoane e pe Dashboard.</p>
        </div>
      </div>
    </Card>
  );

  return (
    <StaffShell activ="anunturi">
      <div className={mobile ? "flex flex-col gap-4" : "flex flex-col gap-5 px-6 py-6"}>
        <AntetPagina titlu="Anunțuri" sub="Un anunț apare în aplicație, în clopoțelul fiecărui client și pleacă push la toți." />
        {mobile ? (
          <>
            {compozitor}
            {previzualizare}
            {lista}
            {automate}
          </>
        ) : (
          <>
            <div className="-mt-1 grid grid-cols-[1fr_300px] items-start gap-5">
              {compozitor}
              {previzualizare}
            </div>
            <div className="grid grid-cols-[1fr_300px] items-start gap-5">
              {lista}
              {automate}
            </div>
          </>
        )}
      </div>
    </StaffShell>
  );
}

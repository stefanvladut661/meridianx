"use client";

import { useEffect, useId, useState } from "react";
import { Check, Pencil, Send, Trash2 } from "lucide-react";
import { num, pct } from "../../kit";
import { C, dataLunga, dataScurta, lume, ora, plural, ziSapt, type Anunt } from "../data";
import { useDemo } from "../store";
import { AntetPagina, StaffShell } from "../shell";
import { Btn, CIFRE, Card, Comutator, H2, LogoMark, campCls, campStil } from "../ui";

/* ============================================================
   Anunțuri: un anunț publicat apare în aplicație și pleacă push la
   toți membrii. Lângă formular, notificarea așa cum o vede telefonul;
   dedesubt, ce s-a publicat și reamintirea automată de expirare.
   ============================================================ */

const MAX_TITLU = 200;
const EXEMPLU = {
  titlu: "Aparate noi în zona de forță",
  text: "Au sosit două rack-uri și o presă de picioare. Le găsești lângă oglinda mare, de azi.",
};

export default function Anunturi() {
  const { st, publica, stergeAnunt, notify, mobile } = useDemo();
  const [titlu, setTitlu] = useState("");
  const [text, setText] = useState("");
  const [publicat, setPublicat] = useState(false);
  const [reamintire, setReamintire] = useState(true);
  const idTitlu = useId();
  const idText = useId();
  const total = lume().clienti.length;
  const gata = titlu.trim() !== "" && text.trim() !== "";

  useEffect(() => {
    if (!publicat) return;
    const t = window.setTimeout(() => setPublicat(false), 4000);
    return () => window.clearTimeout(t);
  }, [publicat]);

  const trimite = () => {
    if (!gata) return;
    publica(titlu.trim(), text.trim());
    setTitlu("");
    setText("");
    setPublicat(true);
    notify("În demo, push-ul nu pleacă pe telefoane.");
  };

  const compozitor = (
    <Card className="flex flex-col gap-3.5">
      <H2>Anunț nou</H2>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between">
          <label htmlFor={idTitlu} style={{ fontSize: 13.5, fontWeight: 500 }}>
            Titlu
          </label>
          <span style={{ fontSize: 12, color: C.text2, ...CIFRE }} aria-live="off">
            {titlu.length}/{MAX_TITLU}
          </span>
        </div>
        <input
          id={idTitlu}
          value={titlu}
          maxLength={MAX_TITLU}
          onChange={(e) => setTitlu(e.target.value)}
          placeholder="Ex.: Program special de 1 Decembrie"
          className={`${campCls} px-3 py-2`}
          style={{ ...campStil, lineHeight: "22px" }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idText} style={{ fontSize: 13.5, fontWeight: 500 }}>
          Text
        </label>
        <textarea
          id={idText}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={mobile ? 4 : 3}
          placeholder="Ex.: Luni, sala e deschisă între 9:00 și 15:00."
          className={`${campCls} resize-none px-3 py-2`}
          style={{ ...campStil, lineHeight: 1.5 }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <span style={{ fontSize: 13, color: C.text2, ...CIFRE }}>
          {plural(total, "client", "clienți")} · aplicație și push
        </span>
        {publicat && (
          <span role="status" className="flex items-center gap-1.5" style={{ fontSize: 13.5, fontWeight: 500, color: C.succes }}>
            <Check size={16} strokeWidth={2.5} aria-hidden /> Anunț publicat
          </span>
        )}
        <Btn onClick={trimite} disabled={!gata} className={mobile ? "w-full" : "ml-auto"}>
          <Send size={15} aria-hidden /> Publică anunțul
        </Btn>
      </div>
    </Card>
  );

  // ecranul blocat al telefonului, cu notificarea de push; se schimbă pe măsură ce scrii
  const zi = ziSapt(0);
  const titluP = titlu.trim() || EXEMPLU.titlu;
  const textP = text.trim() || EXEMPLU.text;
  const previzualizare = (
    <div
      role="img"
      aria-label={`Notificarea pe telefon: ${titluP}. ${textP}`}
      className="overflow-hidden rounded-[28px] px-4 pb-5 pt-7"
      style={{ height: mobile ? 272 : 296, background: "#1E1B24", boxShadow: "inset 0 0 0 6px #0C0D0F" }}
    >
      <p className="text-center" style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 500 }}>
        {zi.charAt(0).toUpperCase() + zi.slice(1)}, {dataLunga(0).replace(" 2026", "")}
      </p>
      <p className="text-center" style={{ color: "#fff", fontSize: 44, fontWeight: 500, lineHeight: 1.15, letterSpacing: "-0.02em", ...CIFRE }}>
        {ora(st.now)}
      </p>
      <div className="mt-5 flex gap-2.5 rounded-[14px] px-3 py-2.5" style={{ background: C.card }}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px]" style={{ border: `1px solid ${C.contur}` }}>
          <LogoMark size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex justify-between" style={{ fontSize: 12, color: C.text2 }}>
            <span style={{ fontWeight: 600 }}>Elyssium</span>
            acum
          </span>
          <span className="block truncate" style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {titluP}
          </span>
          <span className="line-clamp-3 block" style={{ fontSize: 13, color: "#374151", lineHeight: 1.35 }}>
            {textP}
          </span>
        </span>
      </div>
    </div>
  );

  const lista = (
    <Card pad={false} className="overflow-hidden">
      <div style={{ padding: mobile ? "14px 16px 4px" : "16px 20px 6px" }}>
        <H2>Anunțuri publicate</H2>
      </div>
      {st.anunturi.length === 0 ? (
        <p style={{ padding: mobile ? "8px 16px 18px" : "8px 20px 20px", fontSize: 14, color: C.text2 }}>Niciun anunț publicat</p>
      ) : (
        <ul>
          {st.anunturi.map((an, i) => (
            <RandAnunt
              key={an.id}
              an={an}
              primul={i === 0}
              onSterge={() => stergeAnunt(an.id)}
              onEditeaza={() => notify("Editarea e oprită în demo.")}
            />
          ))}
        </ul>
      )}
    </Card>
  );

  const automatizari = (
    <Card className="flex flex-col gap-3">
      <H2>Automatizări</H2>
      <div className="flex items-start justify-between gap-3">
        <span style={{ fontSize: 14, lineHeight: "20px" }}>
          Reamintire de expirare
          <span className="mt-0.5 block" style={{ fontSize: 12.5, color: C.text2, ...CIFRE }}>
            {reamintire ? `Push cu 3 zile înainte · ${num(lume().expiraCurand)} expiră în 7 zile` : "Oprită"}
          </span>
        </span>
        <Comutator on={reamintire} onChange={setReamintire} eticheta="Reamintire de expirare" />
      </div>
    </Card>
  );

  return (
    <StaffShell activ="anunturi">
      {mobile ? (
        <div className="flex flex-col gap-4">
          <AntetPagina titlu="Anunțuri" />
          {compozitor}
          {previzualizare}
          {lista}
          {automatizari}
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-6 py-6">
          <AntetPagina titlu="Anunțuri" />
          <div className="grid grid-cols-[1fr_300px] items-start gap-5">
            {compozitor}
            {previzualizare}
          </div>
          <div className="grid grid-cols-[1fr_300px] items-start gap-5">
            {lista}
            {automatizari}
          </div>
        </div>
      )}
    </StaffShell>
  );
}

function RandAnunt({ an, primul, onSterge, onEditeaza }: { an: Anunt; primul: boolean; onSterge: () => void; onEditeaza: () => void }) {
  const { mobile } = useDemo();
  const [confirma, setConfirma] = useState(false);
  const nou = an.o === 0 && an.citite === 0;
  const cand = an.o === 0 ? `azi, ${an.ora}` : an.o === -1 ? `ieri, ${an.ora}` : `${dataScurta(an.o)}, ${an.ora}`;
  const p = an.citite / an.trimise;

  return (
    <li
      className={`flex ${mobile ? "flex-col gap-2.5" : "items-start gap-6"}`}
      style={{ borderTop: primul ? undefined : `1px solid ${C.contur}`, padding: mobile ? "12px 16px" : "14px 20px" }}
    >
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: 14.5, fontWeight: 600, lineHeight: "20px" }}>{an.titlu}</p>
        <p className="line-clamp-2" style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.45, marginTop: 2 }}>
          {an.text}
        </p>
        <p style={{ fontSize: 12.5, color: C.text2, marginTop: 4, ...CIFRE }}>
          {cand} · {an.autor}
        </p>
      </div>
      <div className={`flex shrink-0 flex-col gap-1.5 ${mobile ? "" : "w-[200px]"}`}>
        {nou ? (
          <p style={{ fontSize: 12.5, color: C.text2, ...CIFRE }}>Trimis la {plural(an.trimise, "client", "clienți")}</p>
        ) : (
          <>
            <div className="flex justify-between" style={{ fontSize: 12.5, color: C.text2, ...CIFRE }}>
              <span>
                <span style={{ color: C.text, fontWeight: 500 }}>{num(an.citite)}</span> din {num(an.trimise)} citite
              </span>
              <span style={{ color: C.text, fontWeight: 500 }}>{pct(p * 100, 0)}</span>
            </div>
            <span className="h-1.5 overflow-hidden rounded-full" style={{ background: C.dezactivat }} aria-hidden>
              <span className="block h-full rounded-full" style={{ width: `${p * 100}%`, background: C.mov }} />
            </span>
          </>
        )}
        <span className={`flex gap-1 ${mobile ? "" : "justify-end"}`}>
          {confirma ? (
            <>
              <Btn v="fantoma" mic onClick={() => setConfirma(false)}>
                Anulează
              </Btn>
              <Btn v="periculos" mic onClick={onSterge}>
                Șterge anunțul
              </Btn>
            </>
          ) : (
            <>
              <Btn v="fantoma" mic onClick={onEditeaza}>
                <Pencil size={13} aria-hidden /> Editează
              </Btn>
              <Btn v="textPericulos" mic onClick={() => setConfirma(true)}>
                <Trash2 size={13} aria-hidden /> Șterge
              </Btn>
            </>
          )}
        </span>
      </div>
    </li>
  );
}

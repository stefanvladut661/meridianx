"use client";

import { useState } from "react";
import { Phone, RefreshCw, TrendingUp } from "lucide-react";
import { compact, lei, num, useCountUp } from "../../kit";
import {
  C,
  CHECKINS_30,
  LUNI_12,
  NOI_LUNA,
  VANDUTE_LUNA,
  VANDUTE_LUNA_TRECUTA,
  VANZARI_12,
  dataScurta,
  lume,
  numeCategorie,
  ora,
  valabilPana,
} from "../data";
import { useDemo } from "../store";
import { AntetPagina, StaffShell } from "../shell";
import { Avatar, Btn, Card, Coloane, Eticheta, H2, Heatmap, LegendaHeatmap, LiveDot, MONO, focus } from "../ui";

/* ============================================================
   Dashboard (Faza 2D): vânzările lunii față de luna trecută, cele
   12 luni, check-in-urile pe 30 de zile, cine e în sală acum și lista
   de sunat — clienții care n-au reînnoit.
   ============================================================ */

function Indicator({ eticheta, valoare, detaliu, k }: { eticheta: string; valoare: (k: number) => string; detaliu: React.ReactNode; k: number }) {
  const { mobile } = useDemo();
  return (
    <Card className="flex flex-col gap-1" style={{ padding: mobile ? "14px 16px" : "16px 18px" }}>
      <Eticheta>{eticheta}</Eticheta>
      <strong style={{ fontSize: mobile ? 21 : 27, fontWeight: 700, color: C.mov, lineHeight: 1.2, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{valoare(k)}</strong>
      <span style={{ fontSize: 12.5, color: C.text2 }}>{detaliu}</span>
    </Card>
  );
}

function Indicatori() {
  const { st, rm, mobile } = useDemo();
  const k = useCountUp(1, 1000, !rm);
  const L = lume();
  const vanzari = VANZARI_12[11] + st.vanzariAzi.suma - 2310;
  const vandute = VANDUTE_LUNA + st.vanzariAzi.nr - 12;
  const pr = Math.round(((vanzari - VANZARI_12[10]) / VANZARI_12[10]) * 100);
  const vizite30 = CHECKINS_30.reduce((s, x) => s + x.n, 0);
  return (
    <div className={`grid gap-3 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
      <Indicator
        k={k}
        eticheta="Vânzări luna aceasta"
        valoare={(x) => (mobile ? `${compact(vanzari * x)} lei` : lei(vanzari * x))}
        detaliu={
          <span className="flex items-center gap-1" style={{ color: C.succes, fontWeight: 600 }}>
            <TrendingUp size={13} /> {pr}% față de luna trecută
          </span>
        }
      />
      <Indicator k={k} eticheta="Abonamente vândute" valoare={(x) => num(vandute * x)} detaliu={`luna trecută: ${num(VANDUTE_LUNA_TRECUTA)}`} />
      <Indicator
        k={k}
        eticheta="Clienți activi"
        valoare={(x) => num(L.totaluri.activ * x)}
        detaliu={`din ${num(L.clienti.length)} · ${num(L.clienti.length - L.totaluri.activ)} fără abonament valabil`}
      />
      <Indicator k={k} eticheta="Clienți noi luna asta" valoare={(x) => num(NOI_LUNA * x)} detaliu={`${num(vizite30)} de vizite în 30 de zile`} />
    </div>
  );
}

export default function Dashboard() {
  const { st, mobile, notify } = useDemo();
  const [runda, setRunda] = useState(0);
  const L = lume();

  const vanzari = (
    <Card className="flex flex-col gap-4">
      <H2 right={<span style={{ fontSize: 12.5, color: C.text2 }}>lei, cu TVA</span>}>Vânzări pe ultimele 12 luni</H2>
      <Coloane
        key={`v${runda}`}
        valori={VANZARI_12.map((v, i) => (i === 11 ? v + st.vanzariAzi.suma - 2310 : v))}
        etichete={LUNI_12}
        titluri={["oct. 2025", "nov. 2025", "dec. 2025", "ian. 2026", "feb. 2026", "mar. 2026", "apr. 2026", "mai 2026", "iun. 2026", "iul. 2026", "aug. 2026", "sept. 2026"]}
        culoare={C.mov}
        muted="#C9BEDD"
        evidentiat={11}
        inaltime={mobile ? 140 : 206}
        format={(v) => lei(v)}
      />
    </Card>
  );

  const checkins = (
    <Card className="flex flex-col gap-4">
      <H2 right={<span style={{ fontSize: 12.5, color: C.text2 }}>azi: {st.azi.consumate} până la {ora(st.now)}</span>}>Check-in-uri pe zi, ultimele 30 de zile</H2>
      <Coloane
        key={`c${runda}`}
        valori={CHECKINS_30.map((x, i) => (i === 29 ? st.azi.consumate : x.n))}
        etichete={CHECKINS_30.map((x) => dataScurta(x.o).replace(".", ""))}
        titluri={CHECKINS_30.map((x) => dataScurta(x.o))}
        culoare={C.albastru}
        muted="#C3D1F8"
        evidentiat={29}
        inaltime={mobile ? 120 : 214}
        format={(v) => `${num(v)} intrări`}
        arataEticheta={(i) => i % (mobile ? 10 : 5) === 4}
        gol={0.3}
      />
    </Card>
  );

  const sala = (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <Eticheta>Acum în sală</Eticheta>
          <p className="flex items-baseline gap-2">
            <b style={{ fontSize: 34, color: C.text, fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>{st.inSala}</b>
            <span style={{ fontSize: 13, color: C.text2 }}>de oameni</span>
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: C.fActiv, color: C.succes, fontSize: 12, fontWeight: 700 }}>
          <LiveDot size={7} /> LIVE
        </span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 600 }}>Ore aglomerate, săptămâna obișnuită</p>
      <Heatmap celula={mobile ? 16 : 16} gap={3} compact />
      <LegendaHeatmap />
    </Card>
  );

  const maxCat = L.categoriiActive[0]?.n ?? 1;
  const categorii = (
    <Card className="flex flex-col gap-3">
      <H2>Abonamente active, pe categorii</H2>
      <ul className="flex flex-col gap-2.5">
        {L.categoriiActive.map((c) => (
          <li key={c.cat} className="flex flex-col gap-1">
            <div className="flex justify-between" style={{ fontSize: 13.5 }}>
              <span style={{ color: C.text }}>{numeCategorie(c.cat)}</span>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{num(c.n)}</b>
            </div>
            <span className="h-2 overflow-hidden rounded-full" style={{ background: C.dezactivat }}>
              <span className="block h-full rounded-full" style={{ width: `${(c.n / maxCat) * 100}%`, background: C.mov }} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );

  // câte unul din fiecare „felie” a listei, ca datele să fie variate
  const deSunat = L.deSunat.filter((_, i) => i % 31 === 3).slice(0, 6);
  const suna = (nume: string) => notify(`În demo, apelul către ${nume} nu pornește. În aplicația reală, pe telefon se deschide direct apelarea.`);
  const retentie = (
    <Card className="flex flex-col gap-3">
      <H2 right={<span style={{ fontSize: 13, color: C.text2 }}>{num(L.deSunat.length)} de clienți</span>}>De sunat: au expirat și nu au reînnoit</H2>
      <p style={{ fontSize: 13.5, color: C.text2, marginTop: -6 }}>Abonament expirat în ultimele 30 de zile și niciun abonament valabil azi.</p>
      {mobile ? (
        <ul className="flex flex-col gap-2">
          {deSunat.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5" style={{ border: `1px solid ${C.contur}` }}>
              <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} />
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 600 }}>
                  {m.prenume} {m.nume}
                </span>
                <span className="block truncate" style={{ fontSize: 12.5, color: C.text2 }}>
                  {m.ultimulExpirat?.nume} · {m.ultimulExpirat && dataScurta(m.ultimulExpirat.exp - 1)}
                </span>
              </span>
              <Btn v="secundar" mic onClick={() => suna(m.prenume)} label={`Sună-l pe ${m.prenume}`}>
                <Phone size={14} />
              </Btn>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full border-collapse" style={{ fontSize: 14 }}>
          <thead>
            <tr>
              {["Client", "Ultimul abonament", "A expirat", "Telefon"].map((h) => (
                <th key={h} className="px-3 py-2 text-left" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: C.text2, borderBottom: `1px solid ${C.contur}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deSunat.map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2" style={{ borderBottom: `1px solid ${C.contur}` }}>
                  <span className="flex items-center gap-2.5">
                    <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={30} />
                    <b style={{ fontWeight: 600 }}>
                      {m.prenume} {m.nume}
                    </b>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: C.text2 }}>#{m.cod}</span>
                  </span>
                </td>
                <td className="px-3 py-2" style={{ borderBottom: `1px solid ${C.contur}` }}>
                  {m.ultimulExpirat?.nume}
                </td>
                <td className="px-3 py-2" style={{ borderBottom: `1px solid ${C.contur}`, color: C.text2 }}>
                  {m.ultimulExpirat && valabilPana(m.ultimulExpirat.exp)}
                </td>
                <td className="px-3 py-2" style={{ borderBottom: `1px solid ${C.contur}` }}>
                  <button type="button" onClick={() => suna(m.prenume)} className={`flex items-center gap-1.5 rounded-[8px] px-1 ${focus}`} style={{ color: C.mov, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    <Phone size={14} /> {m.tel}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );

  return (
    <StaffShell activ="dashboard">
      <div className={mobile ? "flex flex-col gap-4" : "flex flex-col gap-5 px-6 py-6"}>
        <AntetPagina titlu="Dashboard" sub={`Septembrie 2026 · actualizat la ${ora(st.now)}`}>
          <Btn v="secundar" onClick={() => setRunda((r) => r + 1)}>
            <RefreshCw size={15} /> Reîmprospătează
          </Btn>
        </AntetPagina>
        <div className="-mt-1 flex flex-col gap-5">
          <Indicatori key={runda} />
          {mobile ? (
            <>
              {vanzari}
              {sala}
              {checkins}
              {categorii}
              {retentie}
            </>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_356px] gap-5">
                {vanzari}
                {sala}
              </div>
              <div className="grid grid-cols-[1fr_356px] gap-5">
                {checkins}
                {categorii}
              </div>
              {retentie}
            </>
          )}
        </div>
      </div>
    </StaffShell>
  );
}

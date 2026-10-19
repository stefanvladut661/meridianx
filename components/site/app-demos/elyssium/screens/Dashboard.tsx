"use client";

import { useEffect, useState } from "react";
import { Phone, RefreshCw, TrendingUp } from "lucide-react";
import { compact, lei, num } from "../../kit";
import {
  C,
  CHECKINS_30,
  LUNI,
  LUNI_12,
  NOI_LUNA,
  VANDUTE_LUNA,
  VANDUTE_LUNA_TRECUTA,
  VANZARI_12,
  dataScurta,
  lume,
  numeCategorie,
  ora,
  plural,
  stareClient,
} from "../data";
import { useDemo } from "../store";
import { AntetPagina, StaffShell } from "../shell";
import { Avatar, Btn, CIFRE, Card, Coloane, H2, Heatmap, Indicatori, LegendaHeatmap, Spinner, focus } from "../ui";

/* ============================================================
   Dashboard: vânzările lunii față de august, cele 12 luni, intrările
   pe 30 de zile, orele aglomerate, abonamentele active pe categorii și
   lista de sunat: clienții care au expirat și n-au reînnoit.
   ============================================================ */

const TITLURI_12 = ["oct. 2025", "nov. 2025", "dec. 2025", "ian. 2026", "feb. 2026", "mar. 2026", "apr. 2026", "mai 2026", "iun. 2026", "iul. 2026", "aug. 2026", "sept. 2026"];

export default function Dashboard() {
  const { st, mobile, rm, notify } = useDemo();
  const L = lume();
  const [actualizat, setActualizat] = useState(st.now);
  const [incarca, setIncarca] = useState(false);

  // reîmprospătarea ține cât un apel la server; sub reduced motion, pe loc
  useEffect(() => {
    if (!incarca) return;
    const t = window.setTimeout(() => {
      setActualizat(st.now);
      setIncarca(false);
    }, 450);
    return () => window.clearTimeout(t);
  }, [incarca, st.now]);
  const reimprospateaza = () => {
    if (rm) setActualizat(st.now);
    else setIncarca(true);
  };

  // cifrele lunii, plus ce s-a vândut în demo
  const vanzari = VANZARI_12[11] + st.vanzariNoi.reduce((s, v) => s + v.suma, 0);
  const vandute = VANDUTE_LUNA + st.vanzariNoi.length;
  const crestere = Math.round(((vanzari - VANZARI_12[10]) / VANZARI_12[10]) * 100);
  // un client expirat care primește abonament nou devine activ
  let activi = L.totaluri.activ;
  for (const [id, m] of Object.entries(st.over)) {
    const inainte = stareClient(L.dupaId.get(id)!) === "activ";
    const acum = stareClient(m) === "activ";
    if (acum !== inainte) activi += acum ? 1 : -1;
  }

  const indicatori = (
    <Indicatori
      items={[
        {
          eticheta: "Vânzări",
          valoare: mobile ? `${compact(vanzari)} lei` : lei(vanzari),
          detaliu: (
            <span className="flex items-center gap-1" style={{ color: C.succes, fontWeight: 500 }}>
              <TrendingUp size={13} aria-hidden /> +{crestere}% față de august
            </span>
          ),
        },
        { eticheta: "Abonamente vândute", valoare: num(vandute), detaliu: `${num(VANDUTE_LUNA_TRECUTA)} în august` },
        { eticheta: "Clienți activi", valoare: num(activi), detaliu: `din ${num(L.clienti.length)}` },
        { eticheta: "Clienți noi", valoare: num(NOI_LUNA) },
      ]}
    />
  );

  const valori12 = VANZARI_12.map((v, i) => (i === 11 ? vanzari : v));
  const vanzariCard = (
    <Card className="flex flex-col gap-4">
      <H2 right="lei, cu TVA">Vânzări pe 12 luni</H2>
      <Coloane
        valori={valori12}
        etichete={LUNI_12}
        titluri={TITLURI_12}
        evidentiat={11}
        inaltime={mobile ? 140 : 196}
        format={lei}
        formatAx={(v) => (v === 0 ? "0" : compact(v))}
        descriere={`Vânzări lunare, octombrie 2025 – septembrie 2026. Septembrie: ${lei(vanzari)}, august: ${lei(VANZARI_12[10])}.`}
      />
    </Card>
  );

  const prima = CHECKINS_30[0].o;
  const ultima = CHECKINS_30[CHECKINS_30.length - 1].o;
  const intrariCard = (
    <Card className="flex flex-col gap-4">
      <H2 right="ultimele 30 de zile">Intrări pe zi</H2>
      <Coloane
        valori={CHECKINS_30.map((x) => x.n)}
        etichete={CHECKINS_30.map((x) => dataScurta(x.o).replace(".", ""))}
        titluri={CHECKINS_30.map((x) => dataScurta(x.o))}
        inaltime={mobile ? 120 : 196}
        format={(v) => plural(v, "intrare", "intrări")}
        formatAx={num}
        arataEticheta={(i) => i % (mobile ? 10 : 5) === (mobile ? 9 : 4)}
        gol={0.3}
        descriere={`Intrări pe zi, ${dataScurta(prima)} – ${dataScurta(ultima)}. Între ${num(Math.min(...CHECKINS_30.map((x) => x.n)))} și ${num(Math.max(...CHECKINS_30.map((x) => x.n)))} pe zi.`}
      />
    </Card>
  );

  const oreAglomerate = (
    <Card className="flex flex-col gap-3">
      <H2 right="săptămână tipică">Ore aglomerate</H2>
      <Heatmap celula={16} gap={3} compact />
      <LegendaHeatmap />
    </Card>
  );

  const maxCat = L.categoriiActive[0]?.n ?? 1;
  const categorii = (
    <Card className="flex flex-col gap-3">
      <H2>Abonamente active</H2>
      <ul className="flex flex-col gap-2.5">
        {L.categoriiActive.map((c) => (
          <li key={c.cat} className="flex flex-col gap-1">
            <div className="flex justify-between" style={{ fontSize: 13.5 }}>
              <span>{numeCategorie(c.cat)}</span>
              <span style={{ fontWeight: 600, ...CIFRE }}>{num(c.n)}</span>
            </div>
            <span className="h-1.5 overflow-hidden rounded-full" style={{ background: C.dezactivat }} aria-hidden>
              <span className="block h-full rounded-full" style={{ width: `${(c.n / maxCat) * 100}%`, background: C.mov }} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );

  // câte unul din fiecare „felie” a listei, ca datele să fie variate
  const deSunat = L.deSunat.filter((_, i) => i % 31 === 3).slice(0, 6);
  const suna = () => notify("Apelul nu pornește în demo.");
  const th = { fontSize: 12.5, fontWeight: 500, color: C.text2, borderBottom: `1px solid ${C.contur}` } as const;
  const td = { borderBottom: `1px solid ${C.contur}` } as const;
  const retentie = (
    <Card className="flex flex-col gap-3" pad={mobile ? false : true} style={mobile ? { paddingTop: 16 } : undefined}>
      <div className={mobile ? "px-4" : undefined}>
        <H2 right={`${num(L.deSunat.length)} · expirate în ultimele 30 de zile`}>De sunat</H2>
      </div>
      {mobile ? (
        <ul>
          {deSunat.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: `1px solid ${C.contur}` }}>
              <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>
                  {m.prenume} {m.nume}
                </span>
                <span className="block truncate" style={{ fontSize: 12.5, color: C.text2, ...CIFRE }}>
                  {m.ultimulExpirat?.nume} · {m.ultimulExpirat && dataScurta(m.ultimulExpirat.exp - 1)}
                </span>
              </span>
              <Btn v="secundar" mic onClick={suna} label={`Sună-l pe ${m.prenume} ${m.nume}`}>
                <Phone size={14} aria-hidden />
              </Btn>
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full border-collapse" style={{ fontSize: 14 }}>
          <thead>
            <tr>
              <th className="py-2 pr-3 text-left" style={th}>
                Client
              </th>
              <th className="px-3 py-2 text-left" style={th}>
                Ultimul abonament
              </th>
              <th className="px-3 py-2 text-left" style={th}>
                Valabil până
              </th>
              <th className="py-2 pl-3 text-left" style={th}>
                Telefon
              </th>
            </tr>
          </thead>
          <tbody>
            {deSunat.map((m, i) => {
              const ultim = i === deSunat.length - 1 ? { borderBottom: "none" } : td;
              return (
                <tr key={m.id}>
                  <td className="py-2 pr-3" style={ultim}>
                    <span className="flex items-center gap-2.5">
                      <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={28} />
                      <span style={{ fontWeight: 600 }}>
                        {m.prenume} {m.nume}
                      </span>
                      <span style={{ fontSize: 12.5, color: C.text2, ...CIFRE }}>#{m.cod}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2" style={ultim}>
                    {m.ultimulExpirat?.nume}
                  </td>
                  <td className="px-3 py-2" style={{ ...ultim, ...CIFRE }}>
                    {m.ultimulExpirat && dataScurta(m.ultimulExpirat.exp - 1)}
                  </td>
                  <td className="py-2 pl-3" style={ultim}>
                    <button
                      type="button"
                      onClick={suna}
                      aria-label={`Sună-l pe ${m.prenume} ${m.nume}, ${m.tel}`}
                      className={`-mx-1.5 flex items-center gap-1.5 rounded-[6px] px-1.5 py-0.5 hover:bg-[#EFEAF7] ${focus}`}
                      style={{ color: C.mov, fontWeight: 500, ...CIFRE }}
                    >
                      <Phone size={14} aria-hidden /> {m.tel}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );

  const antet = (
    <AntetPagina titlu="Dashboard" sub={`${LUNI[8].charAt(0).toUpperCase()}${LUNI[8].slice(1)} 2026 · actualizat la ${ora(actualizat)}`}>
      <Btn v="secundar" onClick={reimprospateaza} disabled={incarca}>
        {incarca ? <Spinner size={14} color={C.text2Tare} /> : <RefreshCw size={15} aria-hidden />} Reîmprospătează
      </Btn>
    </AntetPagina>
  );

  return (
    <StaffShell activ="dashboard">
      {mobile ? (
        <div className="flex flex-col gap-4">
          {antet}
          {indicatori}
          {vanzariCard}
          {oreAglomerate}
          {intrariCard}
          {categorii}
          {retentie}
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-6 py-6">
          {antet}
          {indicatori}
          <div className="grid grid-cols-[1fr_356px] items-start gap-5">
            {vanzariCard}
            {oreAglomerate}
          </div>
          <div className="grid grid-cols-[1fr_356px] items-start gap-5">
            {intrariCard}
            {categorii}
          </div>
          {retentie}
        </div>
      )}
    </StaffShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Check, Download, FileText, Mail, PlugZap, RefreshCw } from "lucide-react";
import { compact, lei, num, pct } from "../../kit";
import { C, INCASARI, plural, type Factura } from "../data";
import { useDemo } from "../store";
import { AntetPagina, StaffShell } from "../shell";
import { Btn, CIFRE, Card, Chip, Comutator, H2, Indicatori, Segmentat, Spinner } from "../ui";

/* ============================================================
   Rapoarte: încasările lunii, plățile online prin Netopia, facturile
   emise în SmartBill (seria APP, TVA 21%) cu cele care trebuie
   reîncercate, conexiunea SmartBill și raportul lunar pe email.
   ============================================================ */

type Luna = keyof typeof INCASARI;
const LUNI: { v: Luna; eticheta: string }[] = [
  { v: "iul", eticheta: "Iulie" },
  { v: "aug", eticheta: "August" },
  { v: "sep", eticheta: "Septembrie" },
];

const nrFactura = (n: number | null) => (n === null ? "—" : `APP ${String(n).padStart(4, "0")}`);
const problema = (f: Factura) => f.status === "esuata" || f.status === "de_verificat";

/** Starea apare doar când cere ceva de la recepție; factura emisă n-are etichetă. */
function StareFactura({ f }: { f: Factura }) {
  if (f.status === "emitere")
    return (
      <Chip ton="avert">
        <Spinner color={C.avertCerneala} size={10} /> Se emite
      </Chip>
    );
  if (f.status === "esuata") return <Chip ton="eroare">Eșuată</Chip>;
  if (f.status === "de_verificat") return <Chip ton="eroare">De verificat</Chip>;
  return null;
}

export default function Facturi() {
  const { st, notify, mobile, reincearcaFactura } = useDemo();
  const [luna, setLuna] = useState<Luna>("sep");
  const [verificare, setVerificare] = useState<"nu" | "merge" | "gata">("nu");
  const [automat, setAutomat] = useState(true);

  useEffect(() => {
    if (verificare !== "merge") return;
    const t = window.setTimeout(() => setVerificare("gata"), 900);
    return () => window.clearTimeout(t);
  }, [verificare]);

  /* ---------- indicatorii lunii ---------- */
  const d = INCASARI[luna];
  const noi = luna === "sep" ? st.vanzariNoi : [];
  const suma = (m: string) => noi.filter((v) => v.metoda === m).reduce((s, v) => s + v.suma, 0);
  const online = d.online + suma("online");
  const cash = d.cash + suma("cash");
  const card = d.card + suma("card_fizic");
  const total = online + cash + card;
  const plati = d.plati + noi.filter((v) => v.metoda === "online").length;
  // în septembrie, facturile cu problemă și cele în curs vin din lista de mai jos
  const deRezolvat = luna === "sep" ? st.facturi.filter(problema).length : d.plati - d.facturi;
  const inCurs = luna === "sep" ? st.facturi.filter((f) => f.status === "emitere").length : 0;
  const emise = plati - deRezolvat - inCurs;
  const bani = (v: number) => (mobile ? `${compact(v)} lei` : lei(v));
  const procent = (v: number) => pct((v / total) * 100, 0);

  const indicatori = (
    <Indicatori
      items={[
        { eticheta: "Încasări cu TVA", valoare: bani(total), detaliu: plural(d.vandute + noi.length, "abonament", "abonamente") },
        { eticheta: "Online (Netopia)", valoare: bani(online), detaliu: `${procent(online)} din total` },
        { eticheta: "La recepție", valoare: bani(cash + card), detaliu: `cash ${procent(cash)} · card ${procent(card)}` },
        {
          eticheta: "Facturi emise",
          valoare: num(emise),
          detaliu: deRezolvat > 0 ? <span style={{ color: C.avertCerneala, fontWeight: 500 }}>{deRezolvat} de rezolvat</span> : undefined,
        },
      ]}
    />
  );

  const antet = (
    <AntetPagina titlu="Rapoarte">
      <Segmentat<Luna> eticheta="Luna" valoare={luna} onChange={setLuna} optiuni={LUNI} />
      <Btn v="secundar" onClick={() => notify("Excel-ul nu se descarcă în demo.")}>
        <Download size={15} aria-hidden /> Excel
      </Btn>
    </AntetPagina>
  );

  /* ---------- facturile ---------- */
  const pdf = () => notify("PDF-ul nu se descarcă în demo.");
  const lista = st.facturi.slice(0, mobile ? 8 : 12);
  const facturi = (
    <Card pad={false} className="overflow-hidden">
      <div style={{ padding: mobile ? "14px 16px 10px" : "16px 20px 10px" }}>
        <H2 right="seria APP">Facturi</H2>
      </div>
      <ul>
        {lista.map((f) => {
          const pb = problema(f);
          return (
            <li key={f.id} className="flex flex-col gap-1" style={{ borderTop: `1px solid ${C.contur}`, padding: mobile ? "10px 16px" : "9px 20px" }}>
              <div className="flex items-center gap-3" style={{ fontSize: 14, minHeight: 34 }}>
                {!mobile && (
                  <>
                    <span className="w-[40px] shrink-0" style={{ fontSize: 13, color: C.text2, ...CIFRE }}>
                      {f.o === -1 ? "ieri" : f.ora}
                    </span>
                    <span className="w-[76px] shrink-0" style={{ fontSize: 13, fontWeight: 600, color: f.numar ? C.text : C.text2, ...CIFRE }}>
                      {nrFactura(f.numar)}
                    </span>
                  </>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate" style={{ fontWeight: 600, lineHeight: "20px" }}>
                    {f.client}
                  </span>
                  <span className="truncate" style={{ fontSize: 12.5, color: C.text2, lineHeight: "18px", ...CIFRE }}>
                    {mobile && f.numar ? `${nrFactura(f.numar)} · ` : ""}
                    {f.plan}
                  </span>
                </span>
                <span className="shrink-0 text-right" style={{ fontWeight: 600, width: mobile ? undefined : 64, ...CIFRE }}>
                  {f.suma} lei
                </span>
                {mobile ? (
                  <span className="shrink-0">
                    <StareFactura f={f} />
                  </span>
                ) : (
                  <>
                    <span className="flex w-[104px] shrink-0 justify-end">
                      <StareFactura f={f} />
                    </span>
                    <span className="flex w-[112px] shrink-0 items-center justify-end gap-1">
                      {pb ? (
                        <Btn v="secundar" mic onClick={() => reincearcaFactura(f.id)}>
                          <RefreshCw size={13} aria-hidden /> Reîncearcă
                        </Btn>
                      ) : f.status === "emisa" ? (
                        <>
                          <span
                            role="img"
                            aria-label={f.email ? "Trimisă pe email" : "Emailul pleacă în curând"}
                            title={f.email ? "Trimisă pe email" : "Emailul pleacă în curând"}
                            className="flex size-7 items-center justify-center"
                          >
                            <Mail size={15} color={f.email ? C.succes : C.text2} aria-hidden />
                          </span>
                          <Btn v="fantoma" mic onClick={pdf} label={`PDF-ul facturii ${nrFactura(f.numar)}`}>
                            <FileText size={13} aria-hidden /> PDF
                          </Btn>
                        </>
                      ) : null}
                    </span>
                  </>
                )}
              </div>
              {pb && (
                <div className="flex items-center gap-3" style={{ paddingLeft: mobile ? 0 : 40 + 12 + 76 + 12 }}>
                  <p className="min-w-0 flex-1" style={{ fontSize: 12.5, color: C.eroareText, lineHeight: "18px" }}>
                    {f.motiv}
                  </p>
                  {mobile && (
                    <Btn v="secundar" mic onClick={() => reincearcaFactura(f.id)}>
                      <RefreshCw size={13} aria-hidden /> Reîncearcă
                    </Btn>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );

  /* ---------- SmartBill ---------- */
  const smartbill = (
    <Card className="flex flex-col gap-3.5">
      <H2>SmartBill</H2>
      <div className="flex items-start justify-between gap-3">
        <span style={{ fontSize: 14, lineHeight: "20px" }}>
          Emite factura automat la fiecare plată
          <span className="mt-0.5 block" style={{ fontSize: 12.5, color: C.text2 }}>
            {automat ? "Pornit · seria APP, TVA 21%" : "Oprit · emiți manual din profil"}
          </span>
        </span>
        <Comutator on={automat} onChange={setAutomat} eticheta="Emite factura automat la fiecare plată" />
      </div>
      {verificare === "gata" && (
        <ul role="status" className="flex flex-col gap-1.5" style={{ fontSize: 13.5 }}>
          {["Cheia API e acceptată", "Seria APP există în cont", "Cota TVA 21% e definită"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check size={16} color={C.succes} strokeWidth={2.5} aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      )}
      <Btn
        v="secundar"
        className="self-start"
        disabled={verificare === "merge"}
        onClick={() => {
          setVerificare("merge");
          notify("Verificarea e simulată în demo.");
        }}
      >
        {verificare === "merge" ? <Spinner size={14} color={C.text2Tare} /> : <PlugZap size={15} aria-hidden />} Verifică conexiunea
      </Btn>
    </Card>
  );

  /* ---------- raportul lunar ---------- */
  const raport = (
    <Card className="flex flex-col gap-3">
      <H2>Raport lunar pe email</H2>
      <p style={{ fontSize: 13.5, ...CIFRE }}>
        Următorul: 30 sept., 23:59 <span style={{ color: C.text2 }}>· 2 destinatari</span>
      </p>
      <ul style={{ fontSize: 13.5 }}>
        {["31 aug., 23:59", "31 iul., 23:59", "30 iun., 23:59"].map((x) => (
          <li key={x} className="flex items-center justify-between py-1.5" style={{ borderTop: `1px solid ${C.contur}`, ...CIFRE }}>
            {x}
            <span style={{ fontSize: 13, color: C.text2 }}>Trimis</span>
          </li>
        ))}
      </ul>
    </Card>
  );

  return (
    <StaffShell activ="facturi">
      {mobile ? (
        <div className="flex flex-col gap-4">
          {antet}
          {indicatori}
          {facturi}
          {smartbill}
          {raport}
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-6 py-6">
          {antet}
          {indicatori}
          <div className="grid grid-cols-[1fr_320px] items-start gap-5">
            {facturi}
            <div className="flex flex-col gap-5">
              {smartbill}
              {raport}
            </div>
          </div>
        </div>
      )}
    </StaffShell>
  );
}

"use client";

import { useState } from "react";
import { BadgeCheck, CalendarClock, Check, CreditCard, Download, FileSpreadsheet, FileText, Mail, PlugZap, RefreshCw } from "lucide-react";
import { compact, lei, num, pct, useCountUp } from "../../kit";
import { C, INCASARI, type Factura } from "../data";
import { useDemo } from "../store";
import { AntetPagina, StaffShell } from "../shell";
import { Btn, Card, Chip, Eticheta, H2, MONO, Spinner, focus, useAnim } from "../ui";

/* ============================================================
   Rapoarte și facturare (Fazele 2D + 3A): încasările lunii, plățile
   online prin Netopia, facturile emise automat în SmartBill (seria
   APP, TVA 21%), coada de reîncercări și raportul lunar pe email.
   ============================================================ */

type Luna = keyof typeof INCASARI;
const LUNI: { k: Luna; eticheta: string }[] = [
  { k: "iul", eticheta: "Iulie" },
  { k: "aug", eticheta: "August" },
  { k: "sep", eticheta: "Septembrie" },
];

const nrFactura = (n: number | null) => (n === null ? "—" : `APP ${String(n).padStart(4, "0")}`);

function StatusFactura({ f }: { f: Factura }) {
  if (f.status === "emisa") return <Chip ton="succes">emisă</Chip>;
  if (f.status === "emitere")
    return (
      <Chip ton="avert">
        <Spinner color="#B45309" size={11} /> se emite
      </Chip>
    );
  if (f.status === "esuata") return <Chip ton="eroare">eșuată</Chip>;
  return <Chip ton="eroare">de verificat</Chip>;
}

function Kpi({ luna }: { luna: Luna }) {
  const { st, rm, mobile } = useDemo();
  const k = useCountUp(1, 900, !rm);
  const d = INCASARI[luna];
  const live = luna === "sep" ? st.vanzariAzi : null;
  const online = d.online + (live ? (live.online - 7) * 190 : 0);
  const total = d.online + d.cash + d.card + (live ? live.suma - 2310 : 0);
  const facturi = d.facturi + (live ? live.online - 7 : 0);
  const recep = d.cash + d.card;
  const bani = (v: number) => (mobile ? `${compact(v)} lei` : lei(v));
  const tiles: [string, string, string][] = [
    ["Încasări totale", bani(total * k), `${num(d.vandute)} de abonamente · TVA 21% inclus`],
    ["Online · Netopia", bani(online * k), `${pct((online / total) * 100, 0)} din total · ${num(d.plati + (live ? live.online - 7 : 0))} de plăți`],
    ["La recepție", bani(recep * k), mobile ? "cash și card fizic" : `cash ${lei(d.cash)} · card ${lei(d.card)}`],
    ["Facturi SmartBill", num(facturi * k), luna === "sep" ? `seria APP · 2 de rezolvat` : `seria APP · toate emise`],
  ];
  return (
    <div className={`grid gap-3 ${mobile ? "grid-cols-2" : "grid-cols-4"}`}>
      {tiles.map(([e, v, dd]) => (
        <Card key={e} className="flex flex-col gap-1" style={{ padding: "16px 18px" }}>
          <Eticheta>{e}</Eticheta>
          <strong style={{ fontSize: mobile ? 21 : 26, fontWeight: 700, color: C.mov, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{v}</strong>
          <span style={{ fontSize: 12.5, color: C.text2 }}>{dd}</span>
        </Card>
      ))}
    </div>
  );
}

function Impartire({ luna }: { luna: Luna }) {
  const d = INCASARI[luna];
  const tot = d.online + d.cash + d.card;
  const parti = [
    { e: "Online · Netopia", v: d.online, c: C.mov },
    { e: "Card fizic", v: d.card, c: C.albastru },
    { e: "Cash", v: d.cash, c: C.coral },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {parti.map((p) => (
          <span key={p.e} className="h-full transition-[flex-grow] duration-500" style={{ flexGrow: p.v, background: p.c }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: 12.5, color: C.text2 }}>
        {parti.map((p) => (
          <li key={p.e} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: p.c }} />
            {p.e} <b style={{ color: C.text }}>{pct((p.v / tot) * 100, 0)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Facturi() {
  const { st, notify, mobile, reincearcaFactura } = useDemo();
  const a = useAnim();
  const [luna, setLuna] = useState<Luna>("sep");
  const [verificare, setVerificare] = useState<"nu" | "merge" | "gata">("nu");
  const [automat, setAutomat] = useState(true);

  const ultima = st.facturi.find((f) => f.id.startsWith("fl")) ?? st.facturi[0];
  const pasFlux = ultima.status === "emitere" ? 2 : ultima.email ? 4 : 3;

  const pdf = () => notify("În demo, PDF-ul nu se descarcă. În aplicația reală se deschide factura din SmartBill Cloud.");

  const antet = (
    <AntetPagina titlu="Rapoarte și facturare" sub="Vânzările lunii, plățile online prin Netopia și facturile emise automat în SmartBill.">
      <div role="group" aria-label="Luna" className="flex rounded-[12px] p-1" style={{ background: C.dezactivat }}>
        {LUNI.map((l) => (
          <button
            key={l.k}
            type="button"
            aria-pressed={luna === l.k}
            onClick={() => setLuna(l.k)}
            className={`rounded-[9px] px-3 py-1.5 transition-colors ${focus}`}
            style={{ fontSize: 13.5, fontWeight: 600, background: luna === l.k ? C.card : "transparent", color: luna === l.k ? C.mov : C.text2, boxShadow: luna === l.k ? "0 1px 3px rgba(17,24,39,0.1)" : undefined }}
          >
            {l.eticheta}
          </button>
        ))}
      </div>
      <Btn v="secundar" onClick={() => notify("În demo, Excel-ul nu se descarcă. În aplicația reală primești fișierul lunii: Nume, Abonament, Data, Preț, Metodă de plată și TOTAL ÎNCASĂRI.")}>
        <Download size={15} /> Excel
      </Btn>
    </AntetPagina>
  );

  const listaFacturi = (
    <Card className="flex flex-col gap-2" pad={false} style={{ padding: mobile ? "16px 14px" : "18px 20px" }}>
      <H2 right={<span style={{ fontSize: 12.5, color: C.text2 }}>azi · se emit singure la plată</span>}>Facturi SmartBill · seria APP</H2>
      <ul className="mt-1 flex flex-col">
        {st.facturi.slice(0, mobile ? 8 : 12).map((f, i) => {
          const problema = f.status === "esuata" || f.status === "de_verificat";
          return (
            <li key={f.id} className={`flex flex-col gap-1.5 py-2.5 ${f.id.startsWith("fl") && f.status === "emitere" ? a("rowIn") : ""}`} style={{ borderTop: i ? `1px solid ${C.contur}` : undefined }}>
              <div className="flex items-center gap-3" style={{ fontSize: 14 }}>
                {!mobile && (
                  <span className="w-[40px] shrink-0" style={{ color: C.text2, fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
                    {f.o === -1 ? "ieri" : f.ora}
                  </span>
                )}
                {!mobile && (
                  <span className="w-[76px] shrink-0" style={{ fontFamily: MONO, fontWeight: 600, fontSize: 13, color: f.numar ? C.text : C.text2 }}>
                    {nrFactura(f.numar)}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate" style={{ fontWeight: 600 }}>
                    {f.client}
                  </b>
                  <span className="truncate" style={{ fontSize: 12.5, color: C.text2 }}>
                    {mobile && (
                      <span style={{ fontFamily: MONO, fontSize: 12, color: f.numar ? C.text : C.text2 }}>
                        {nrFactura(f.numar)} ·{" "}
                      </span>
                    )}
                    {f.plan}
                  </span>
                </span>
                <span className="shrink-0 text-right" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", width: mobile ? undefined : 64 }}>
                  {f.suma} lei
                </span>
                <span className={`${mobile ? "" : "w-[96px]"} shrink-0 text-right`}>
                  <StatusFactura f={f} />
                </span>
                {!mobile && (
                  <span className="flex w-[118px] shrink-0 items-center justify-end gap-1">
                    {problema ? (
                      <Btn v="secundar" mic onClick={() => reincearcaFactura(f.id)}>
                        <RefreshCw size={13} /> Reîncearcă
                      </Btn>
                    ) : f.status === "emisa" ? (
                      <>
                        <span title={f.email ? "trimisă pe email" : "email în coadă"} className="flex size-7 items-center justify-center" aria-label={f.email ? "Trimisă pe email" : "Email în coadă"}>
                          <Mail size={15} color={f.email ? C.succes : C.text2} />
                        </span>
                        <Btn v="fantoma" mic onClick={pdf}>
                          <FileText size={13} /> PDF
                        </Btn>
                      </>
                    ) : null}
                  </span>
                )}
              </div>
              {problema && (
                <div className="flex items-center gap-2" style={{ paddingLeft: mobile ? 0 : 128 }}>
                  <p className="flex-1" style={{ fontSize: 12.5, color: C.eroare }}>
                    {f.motiv} · abonamentul e activ, doar factura așteaptă
                  </p>
                  {mobile && (
                    <Btn v="secundar" mic onClick={() => reincearcaFactura(f.id)}>
                      <RefreshCw size={13} /> Reîncearcă
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

  const PASI = [
    { e: "Netopia confirmă plata", i: CreditCard },
    { e: "Abonamentul se activează", i: BadgeCheck },
    { e: "SmartBill emite factura", i: FileText },
    { e: "Factura pleacă pe email", i: Mail },
  ];
  const flux = (
    <Card className="flex flex-col gap-3">
      <H2>Ultima plată online</H2>
      <p style={{ fontSize: 13.5, color: C.text2, marginTop: -6 }}>
        <b style={{ color: C.text }}>{ultima.client}</b> · {ultima.plan} · {ultima.suma} lei · {ultima.ora}
      </p>
      <ol className="flex flex-col">
        {PASI.map((p, i) => {
          const gata = i < pasFlux;
          const lucru = i === pasFlux && pasFlux < PASI.length;
          const I = p.i;
          return (
            <li key={p.e} className="flex items-stretch gap-3">
              <span className="flex flex-col items-center">
                <span
                  className="flex size-8 items-center justify-center rounded-full transition-colors duration-300"
                  style={{ background: gata ? C.succes : lucru ? C.fAvert : C.dezactivat, color: gata ? "#fff" : lucru ? "#B45309" : C.text2 }}
                >
                  {lucru ? <Spinner color="#B45309" size={14} /> : gata ? <Check size={16} strokeWidth={3} /> : <I size={15} />}
                </span>
                {i < PASI.length - 1 && <span className="w-[2px] flex-1 transition-colors duration-300" style={{ background: i < pasFlux - 1 ? C.succes : C.contur, minHeight: 12 }} />}
              </span>
              <span className="pb-3 pt-1.5" style={{ fontSize: 14, fontWeight: gata || lucru ? 600 : 500, color: gata || lucru ? C.text : C.text2 }}>
                {p.e}
                {i === 2 && ultima.numar && gata && <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.text2, fontWeight: 500 }}> · {nrFactura(ultima.numar)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p style={{ fontSize: 12.5, color: C.text2 }}>Dacă SmartBill nu răspunde, abonamentul rămâne activ și factura intră în coada de reîncercări.</p>
    </Card>
  );

  const raport = (
    <Card className="flex flex-col gap-3">
      <H2>Raportul lunar automat</H2>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full" style={{ background: C.fSucces }}>
          <FileSpreadsheet size={17} color={C.succes} />
        </span>
        <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>
          Excel-ul lunii pleacă singur pe <b>30 septembrie, la 23:59</b>, către 2 destinatari.
        </p>
      </div>
      <ul className="flex flex-col gap-1.5" style={{ fontSize: 13 }}>
        {["31 august, 23:59", "31 iulie, 23:59", "30 iunie, 23:59"].map((d) => (
          <li key={d} className="flex items-center gap-2" style={{ color: C.text2 }}>
            <CalendarClock size={14} /> {d}
            <span className="ml-auto">
              <Chip ton="succes" mic>
                trimis
              </Chip>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );

  const smartbill = (
    <Card className="flex flex-col gap-3">
      <H2>Conexiunea SmartBill</H2>
      <label className="flex cursor-pointer items-center justify-between gap-3" style={{ fontSize: 14 }}>
        <span>
          Emite factura automat la fiecare plată
          <span className="block" style={{ fontSize: 12.5, color: C.text2 }}>{automat ? "Pornit · seria APP, TVA 21%" : "Oprit · factura se emite la cerere, din profil"}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={automat}
          onClick={() => setAutomat((x) => !x)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${focus}`}
          style={{ background: automat ? C.succes : "#D1D5DB" }}
        >
          <span className="absolute top-1 size-5 rounded-full bg-white shadow transition-[left] duration-200" style={{ left: automat ? 24 : 4 }} />
          <span className="sr-only">Emite factura automat</span>
        </button>
      </label>
      {verificare === "gata" ? (
        <ul className={`flex flex-col gap-1.5 ${a("fadeUp")}`} style={{ fontSize: 13.5 }}>
          {["Cheia API e acceptată", "Seria APP există în cont", "Cota TVA 21% e definită"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Chip ton="succes" mic>
                ok
              </Chip>
              {t}
            </li>
          ))}
        </ul>
      ) : null}
      <Btn
        v="secundar"
        disabled={verificare === "merge"}
        onClick={() => {
          setVerificare("merge");
          window.setTimeout(() => setVerificare("gata"), 900);
          notify("În demo, verificarea nu contactează SmartBill; rezultatul e simulat. În aplicația reală, testul nu emite nimic și nu arată niciun secret.");
        }}
      >
        {verificare === "merge" ? <Spinner size={14} /> : <PlugZap size={15} />} Verifică conexiunea
      </Btn>
    </Card>
  );

  return (
    <StaffShell activ="facturi">
      <div className={mobile ? "flex flex-col gap-4" : "flex flex-col gap-5 px-6 py-6"}>
        {antet}
        <div className="-mt-1 flex flex-col gap-5">
          <Kpi key={luna} luna={luna} />
          <Card className="flex flex-col gap-2.5" style={{ padding: "14px 18px" }}>
            <Eticheta>Cum s-a încasat în {LUNI.find((l) => l.k === luna)?.eticheta.toLowerCase()}</Eticheta>
            <Impartire luna={luna} />
          </Card>
          {mobile ? (
            <>
              {flux}
              {listaFacturi}
              {smartbill}
              {raport}
            </>
          ) : (
            <div className="grid grid-cols-[1fr_330px] items-start gap-5">
              {listaFacturi}
              <div className="flex flex-col gap-5">
                {flux}
                {smartbill}
                {raport}
              </div>
            </div>
          )}
        </div>
      </div>
    </StaffShell>
  );
}

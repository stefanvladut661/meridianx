"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, CheckCheck, Hourglass, Radio, RotateCcw, ScanLine, X } from "lucide-react";
import { FakeQR, StatusBar } from "../../kit";
import { C, CULORI_TIP, ETICHETA_TIP, STAFF_EU, ora, pluralSedinte, subsActive, valabilPana, type Member } from "../data";
import { useDemo, type Scan } from "../store";
import { Btn, Bifa, LiveDot, Spinner, Wordmark, focus, scrollY, useAnim } from "../ui";
import { CorpPopup, RandScanare, aCataAzi } from "./scan-ui";

/* ============================================================
   Intrarea cu QR, cap-coadă. Clientul scanează codul printat de la
   recepție (ca în scanare.tsx); motorul decide; recepția vede pop-up-ul
   instant (ScanariLive.tsx). Pe desktop, ambele ecrane stau alături.
   ============================================================ */

type Faza = "camera" | "trimitere" | "rezultat";

/* ---------------- ecranul de telefon ---------------- */

function Camera({ onScan, onInchide, trimite, manual }: { onScan: () => void; onInchide: () => void; trimite: boolean; manual: boolean }) {
  const a = useAnim();
  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: "#0B0A0E" }}>
      {/* „imaginea din cameră”: recepția, încețoșată, cu afișul QR în față */}
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(120% 70% at 50% 40%, #3B3446 0%, #1B1722 55%, #0B0A0E 100%)" }} />
      <div aria-hidden className="absolute inset-x-0 bottom-[10%] h-[34%]" style={{ background: "linear-gradient(180deg, rgba(106,82,63,0) 0%, rgba(106,82,63,0.7) 22%, rgba(58,44,34,0.8) 60%, rgba(28,21,16,0) 100%)" }} />
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(160px 160px at 18% 24%, rgba(245,197,24,0.2), transparent 70%), radial-gradient(200px 200px at 88% 14%, rgba(107,141,239,0.2), transparent 70%)" }} />

      <div className="relative z-10">
        <StatusBar tone="light" />
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <button
            type="button"
            aria-label="Închide scanarea"
            onClick={onInchide}
            className={`flex size-10 items-center justify-center rounded-full ${focus}`}
            style={{ background: "rgba(0,0,0,0.45)" }}
          >
            <X size={24} color="#fff" />
          </button>
          <p className="flex-1 text-center" style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>
            Scanează codul de la recepție
          </p>
          <span className="size-10" />
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center">
        <button
          type="button"
          onClick={onScan}
          disabled={trimite}
          aria-label="Scanează codul QR (în demo, atinge codul)"
          className={`relative size-[244px] rounded-[18px] ${focus}`}
        >
          {/* afișul printat de la recepție */}
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 flex w-[176px] flex-col items-center gap-2 rounded-[12px] px-3 pb-3 pt-3"
            style={{ background: "#fff", transform: "translate(-50%, -50%) rotate(-3deg)", boxShadow: "0 18px 40px rgba(0,0,0,0.45)", filter: trimite ? "none" : "blur(0.3px)" }}
          >
            <Wordmark size={13} mark={false} />
            <FakeQR size={124} color="#111827" seed={31} />
            <span style={{ fontSize: 9.5, color: "#6B7280", fontWeight: 600, letterSpacing: "0.04em" }}>SCANEAZĂ LA INTRARE</span>
          </span>
          {/* colțurile de vizare */}
          {(["tl", "tr", "bl", "br"] as const).map((k) => (
            <span
              key={k}
              aria-hidden
              className="absolute size-[46px]"
              style={{
                borderColor: trimite ? "#34D399" : C.auriu,
                borderStyle: "solid",
                borderWidth: 0,
                transition: "border-color 200ms",
                ...(k === "tl" && { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 }),
                ...(k === "tr" && { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 }),
                ...(k === "bl" && { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 }),
                ...(k === "br" && { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 }),
              }}
            />
          ))}
          {!trimite && (
            <span
              aria-hidden
              className={`absolute inset-x-3 h-[2px] rounded-full ${a("scanLine")}`}
              style={{ top: "48%", background: C.auriu, boxShadow: `0 0 14px 3px ${C.auriu}88` }}
            />
          )}
        </button>
      </div>

      <div className="relative z-10 flex min-h-[132px] flex-col items-center justify-start gap-3 px-6 pb-10">
        {trimite ? (
          <p className="flex items-center gap-3" style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>
            <Spinner color="#fff" /> Se verifică abonamentul…
          </p>
        ) : (
          <>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>Ține telefonul în dreptul codului QR</p>
            {manual && (
              <button
                type="button"
                onClick={onScan}
                className={`flex items-center gap-2 rounded-full px-4 py-2 ${focus}`}
                style={{ background: "rgba(255,255,255,0.14)", color: "#fff", fontSize: 13.5, fontWeight: 600 }}
              >
                <ScanLine size={16} /> Atinge codul ca să-l scanezi
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Panou({ fundal, children }: { fundal: string; children: React.ReactNode }) {
  const a = useAnim();
  return (
    <div className="flex h-full flex-col" style={{ background: fundal }}>
      <StatusBar tone="dark" />
      <div className={`flex flex-1 flex-col items-center justify-center gap-4 px-7 pb-12 text-center ${a("fade")}`}>{children}</div>
    </div>
  );
}

const Titlu = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1.25 }}>{children}</p>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 15, color: C.text2, lineHeight: 1.5, maxWidth: 300 }}>{children}</p>
);

function Rezultat({
  s,
  m,
  onGata,
  onReia,
  onScanDinNou,
  onRecepție,
}: {
  s: Scan;
  m: Member;
  onGata: () => void;
  onReia: () => void;
  onScanDinNou: () => void;
  onRecepție?: () => void;
}) {
  const a = useAnim();
  const { notify } = useDemo();
  const linkRecepție = onRecepție && (
    <button type="button" onClick={onRecepție} className={`flex items-center gap-1.5 rounded-[8px] px-2 py-1 ${focus}`} style={{ fontSize: 14, fontWeight: 600, color: C.mov }}>
      Vezi ce a apărut la recepție <ArrowRight size={15} />
    </button>
  );

  if (s.status === "consumat" && s.consum) {
    const t = s.consum.tip;
    return (
      <Panou fundal={C.fSucces}>
        <Bifa size={104} />
        <Titlu>Intrare înregistrată</Titlu>
        <Sub>
          {s.consum.plan} · s-a consumat o ședință {ETICHETA_TIP[t]}
        </Sub>
        <div className="flex flex-col items-center gap-2">
          <span style={{ fontSize: 13, color: C.text2 }}>Îți mai rămân</span>
          <span className={`rounded-full px-4 py-2 ${a("pop")}`} style={{ background: CULORI_TIP[t].bg, color: CULORI_TIP[t].fg, fontSize: 16, fontWeight: 700 }}>
            {s.consum.ramase === null ? `${ETICHETA_TIP[t]} nelimitat` : `${pluralSedinte(s.consum.ramase)} ${ETICHETA_TIP[t]}`}
          </span>
        </div>
        {s.staff && <p style={{ fontSize: 13, color: C.succes, fontWeight: 600 }}>Confirmată de recepție.</p>}
        <Btn lat mare onClick={onGata} className="mt-3 max-w-[320px]">
          Gata
        </Btn>
        {linkRecepție}
      </Panou>
    );
  }
  if (s.status === "in_asteptare") {
    const oOptiune = (s.optiuni?.length ?? 0) === 1;
    const tipuri = s.optiuni?.[0]?.contoare.map((c) => ETICHETA_TIP[c.tip]).join(" sau ");
    return (
      <Panou fundal={C.fAvert}>
        <span className={`flex size-[96px] items-center justify-center rounded-full ${a("pop")}`} style={{ background: C.avert }}>
          <Hourglass size={44} color="#fff" />
        </span>
        <Titlu>Așteaptă confirmarea de la recepție</Titlu>
        <Sub>{oOptiune ? `Abonamentul tău are două contoare. Recepția alege ce ți se consumă: ${tipuri}.` : "Recepția alege din ce abonament ți se scade ședința."}</Sub>
        <Spinner color={C.avert} size={22} />
        {linkRecepție}
      </Panou>
    );
  }
  if (s.status === "duplicat") {
    return (
      <Panou fundal={C.fMov}>
        <span className={`flex size-[96px] items-center justify-center rounded-full ${a("pop")}`} style={{ background: C.mov }}>
          <CheckCheck size={44} color="#fff" />
        </span>
        <Titlu>Ai intrat deja azi</Titlu>
        <Sub>Nu ți se scade nicio ședință în plus. Recepția a fost anunțată.</Sub>
        <Btn lat mare onClick={onGata} className="mt-3 max-w-[320px]">
          Gata
        </Btn>
        <Btn v="fantoma" onClick={onReia}>
          <RotateCcw size={15} /> Reia demonstrația de la zero
        </Btn>
      </Panou>
    );
  }
  // refuzat
  const areAcum = m.subs.some((x) => x.exp > 0);
  return (
    <Panou fundal={C.fEroare}>
      <span className={`flex size-[96px] items-center justify-center rounded-full ${a("pop")}`} style={{ background: C.eroare }}>
        <X size={48} color="#fff" strokeWidth={2.6} />
      </span>
      <Titlu>{s.motiv === "abonament_expirat" ? "Abonamentul tău a expirat" : s.motiv === "respinsa_de_receptie" ? "Recepția nu a aprobat intrarea" : "Nu ai un abonament activ"}</Titlu>
      <Sub>
        {m.ultimulExpirat && s.motiv === "abonament_expirat"
          ? `„${m.ultimulExpirat.nume}” a fost valabil până pe ${valabilPana(m.ultimulExpirat.exp)}.`
          : "Vorbește cu recepția."}
      </Sub>
      {areAcum ? (
        <Btn lat mare onClick={onScanDinNou} className="mt-3 max-w-[320px]">
          <Check size={18} /> Abonament nou activ · scanează din nou
        </Btn>
      ) : (
        <Btn
          lat
          mare
          className="mt-3 max-w-[320px]"
          onClick={() => notify("În demo, plata online nu pornește. Încearcă pe ecranul recepției: „Creează abonament”, în două clicuri.")}
        >
          Reînnoiește abonamentul
        </Btn>
      )}
      <Btn v="secundar" lat className="max-w-[320px]" onClick={onGata}>
        Închide
      </Btn>
    </Panou>
  );
}

/** Mașinăria scanării pentru un client: cameră → verificare → rezultat. */
function useFluxScanare(memberId: string, autoConfirma: boolean) {
  const { scaneaza, rezolva, st, rm } = useDemo();
  const [faza, setFaza] = useState<Faza>("camera");
  const [scanId, setScanId] = useState<string | null>(null);
  // doar prima scanare pornește singură; după aceea, clientul atinge codul
  const [auto, setAuto] = useState(!rm);
  const scan = scanId ? (st.scans.find((x) => x.id === scanId) ?? null) : null;

  const porneste = () => {
    if (faza !== "camera") return;
    setAuto(false);
    setFaza("trimitere");
  };

  useEffect(() => {
    if (faza !== "trimitere") return;
    const t = window.setTimeout(() => {
      setScanId(scaneaza(memberId));
      setFaza("rezultat");
    }, 950);
    return () => window.clearTimeout(t);
  }, [faza, memberId, scaneaza]);

  // scanarea pornește singură după o clipă (fără reduced motion)
  useEffect(() => {
    if (!auto || faza !== "camera") return;
    const t = window.setTimeout(() => {
      setAuto(false);
      setFaza("trimitere");
    }, 2300);
    return () => window.clearTimeout(t);
  }, [auto, faza]);

  // pe telefon, recepția confirmă singură după câteva secunde
  const pending = scan?.status === "in_asteptare";
  useEffect(() => {
    if (!autoConfirma || !pending || !scan) return;
    const t = window.setTimeout(() => {
      const o = scan.optiuni?.[0];
      const c = o?.contoare.find((x) => x.ramase === null || x.ramase > 0);
      if (o && c) rezolva(scan.id, o.subId, c.tip, STAFF_EU);
    }, 3000);
    return () => window.clearTimeout(t);
  }, [autoConfirma, pending, scan, rezolva]);

  const reiaCamera = () => {
    setScanId(null);
    setFaza("camera");
  };
  return { faza, scan, porneste, reiaCamera, manual: !auto };
}

/* ---------------- telefon (ecran întreg) ---------------- */
function ScanareTelefon() {
  const { go, set, getM, reseteazaPersonaje } = useDemo();
  const { faza, scan, porneste, reiaCamera, manual } = useFluxScanare("c0", true);
  const m = getM("c0");
  if (faza !== "rezultat" || !scan)
    return <Camera onScan={porneste} onInchide={() => go("acasa")} trimite={faza === "trimitere"} manual={manual} />;
  return (
    <Rezultat
      s={scan}
      m={m}
      onGata={() => go("acasa")}
      onReia={() => {
        reseteazaPersonaje();
        reiaCamera();
      }}
      onScanDinNou={reiaCamera}
      onRecepție={() => {
        set({ openScan: scan.id });
        go("receptie");
      }}
    />
  );
}

/* ---------------- desktop: telefonul și recepția, alături ---------------- */

const PERSONAJE = [
  { id: "c0", nume: "Andrei", caz: "Fitness + SPA · recepția alege" },
  { id: "c1", nume: "Radu", caz: "Any Time Unlimited · automat" },
  { id: "c2", nume: "Bianca", caz: "Morning Gym · expirat" },
];

function ScanareDesktop() {
  const { st, getM, reseteazaPersonaje, rm, set, go } = useDemo();
  const a = useAnim();
  const [cine, setCine] = useState("c0");
  const [inchis, setInchis] = useState<string | null>(null);
  const [runda, setRunda] = useState(0);
  return (
    <Scena
      key={`${cine}-${runda}`}
      cine={cine}
      setCine={(id) => {
        setCine(id);
        setInchis(null);
      }}
      reia={() => {
        reseteazaPersonaje();
        setInchis(null);
        setRunda((r) => r + 1);
      }}
      inchis={inchis}
      setInchis={setInchis}
      st={st}
      getM={getM}
      rm={rm}
      a={a}
      laRecepție={(id) => {
        set({ openScan: id });
        go("receptie");
      }}
    />
  );
}

function Scena({
  cine,
  setCine,
  reia,
  inchis,
  setInchis,
  st,
  getM,
  rm,
  a,
  laRecepție,
}: {
  cine: string;
  setCine: (id: string) => void;
  reia: () => void;
  inchis: string | null;
  setInchis: (id: string | null) => void;
  st: ReturnType<typeof useDemo>["st"];
  getM: (id: string) => Member;
  rm: boolean;
  a: (k: string) => string;
  laRecepție: (id: string | null) => void;
}) {
  const { faza, scan, porneste, reiaCamera, manual } = useFluxScanare(cine, false);
  const m = getM(cine);
  const popup = scan && inchis !== scan.id ? scan : null;
  const pas = !scan ? 1 : scan.status === "in_asteptare" || (scan.status === "refuzat" && !m.subs.some((x) => x.exp > 0)) ? 2 : 3;
  const lista = st.scans.slice(0, 7);
  const S = 0.69;

  return (
    <div className="flex h-full flex-col" style={{ background: C.fundal }}>
      <header className="flex h-[64px] shrink-0 items-center gap-4 px-6" style={{ background: C.card, borderBottom: `1px solid ${C.contur}` }}>
        <Wordmark size={19} />
        <span className="h-8 w-px" style={{ background: C.contur }} aria-hidden />
        <div>
          <p style={{ fontSize: 15, fontWeight: 700 }}>Intrarea cu cod QR</p>
          <p style={{ fontSize: 12.5, color: C.text2 }}>Telefonul clientului și ecranul recepției, în același timp</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span style={{ fontSize: 13, color: C.text2 }}>Cine scanează:</span>
          <div role="group" aria-label="Cine scanează" className="flex rounded-[12px] p-1" style={{ background: C.dezactivat }}>
            {PERSONAJE.map((p) => {
              const on = p.id === cine;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCine(p.id)}
                  className={`flex flex-col items-start rounded-[9px] px-3 py-1 text-left transition-colors ${focus}`}
                  style={{ background: on ? C.card : "transparent", boxShadow: on ? "0 1px 3px rgba(17,24,39,0.1)" : undefined }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: on ? C.mov : C.text }}>{p.nume}</span>
                  <span style={{ fontSize: 11, color: C.text2 }}>{p.caz}</span>
                </button>
              );
            })}
          </div>
          <Btn v="secundar" onClick={reia} label="Reia demonstrația de la zero">
            <RotateCcw size={15} /> Reia
          </Btn>
        </div>
      </header>

      <ol className="flex shrink-0 items-center gap-2 px-8 py-3" aria-label="Pașii intrării">
        {["Clientul scanează codul de la recepție", "Recepția vede pop-up-ul și decide", "Intrarea e înregistrată, ședința consumată"].map((t, i) => {
          const n = i + 1;
          const on = n === pas;
          const gata = n < pas || (n === 3 && pas === 3);
          return (
            <li key={t} className="flex flex-1 items-center gap-2.5" aria-current={on ? "step" : undefined}>
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: gata ? C.succes : on ? C.mov : C.card,
                  color: gata || on ? "#fff" : C.text2,
                  boxShadow: gata || on ? undefined : `inset 0 0 0 1.5px ${C.contur}`,
                  fontSize: 13,
                  fontWeight: 700,
                  transition: "background 250ms",
                }}
              >
                {gata ? <Check size={15} strokeWidth={3} /> : n}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: on ? 700 : 500, color: on || gata ? C.text : C.text2 }}>{t}</span>
              {i < 2 && <span className="mx-2 h-px flex-1" style={{ background: C.contur }} aria-hidden />}
            </li>
          );
        })}
      </ol>

      <div className="flex min-h-0 flex-1 gap-5 px-8 pb-6">
        {/* telefonul */}
        <div className="flex w-[300px] shrink-0 flex-col items-center gap-2.5">
          <div className="relative rounded-[44px] bg-[#0C0D0F] p-[9px] shadow-[0_30px_60px_-24px_rgba(17,24,39,0.45),inset_0_0_0_2px_#2A2C30]" style={{ width: 390 * S + 18, height: 844 * S + 18 }}>
            <div className="relative overflow-hidden rounded-[35px]" style={{ width: 390 * S, height: 844 * S }}>
              <div style={{ width: 390, height: 844, transform: `scale(${S})`, transformOrigin: "top left" }} className="relative">
                {faza !== "rezultat" || !scan ? (
                  <Camera onScan={porneste} onInchide={reia} trimite={faza === "trimitere"} manual={manual} />
                ) : (
                  <Rezultat s={scan} m={m} onGata={reiaCamera} onReia={reia} onScanDinNou={reiaCamera} />
                )}
              </div>
              <span aria-hidden className="pointer-events-none absolute left-1/2 top-[8px] h-[24px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
            </div>
          </div>
          <p className="text-center" style={{ fontSize: 13, color: C.text2 }}>
            Telefonul lui <b style={{ color: C.text }}>{m.prenume}</b> · {subsActive(m)[0]?.nume ?? m.ultimulExpirat?.nume}
          </p>
        </div>

        {/* canalul realtime */}
        <div className="relative flex w-[64px] shrink-0 flex-col items-center justify-center gap-2" aria-hidden>
          <div className="relative h-[2px] w-full" style={{ backgroundImage: `repeating-linear-gradient(90deg, ${C.contur} 0 6px, transparent 6px 11px)` }}>
            {scan && <span key={scan.id} className={`absolute -top-[5px] size-3 rounded-full ${a("travel")}`} style={{ background: C.mov, boxShadow: `0 0 0 4px ${C.fMov}`, left: rm ? "calc(100% - 12px)" : undefined }} />}
          </div>
          <Radio size={16} color={C.text2} />
          <span className="text-center" style={{ fontSize: 10.5, color: C.text2, lineHeight: 1.3 }}>
            canal
            <br />
            realtime
          </span>
        </div>

        {/* recepția */}
        <section aria-label="Ecranul recepției" className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[16px]" style={{ background: C.card, border: `1px solid ${C.contur}`, boxShadow: "0 18px 40px -20px rgba(17,24,39,0.25)" }}>
          <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: `1px solid ${C.contur}` }}>
            <p style={{ fontSize: 17, fontWeight: 700 }}>Scanări live</p>
            <span className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: C.succes }}>
              <LiveDot size={7} /> LIVE
            </span>
            <span className="ml-auto" style={{ fontSize: 13, color: C.text2 }}>
              {st.azi.scanari} scanări azi · {st.azi.consumate} consumate
            </span>
            <button
              type="button"
              onClick={() => laRecepție(popup?.id ?? null)}
              className={`flex items-center gap-1 rounded-[8px] px-2 py-1 ${focus}`}
              style={{ fontSize: 13, fontWeight: 600, color: C.mov }}
            >
              Deschide panoul <ArrowRight size={14} />
            </button>
          </div>
          <div className={`flex min-h-0 flex-1 flex-col gap-2 p-4 ${scrollY}`}>
            {!scan && (
              <p className="flex items-center justify-center gap-2 rounded-[12px] py-3.5" style={{ border: `1.5px dashed ${C.contur}`, fontSize: 13.5, color: C.text2 }}>
                <ScanLine size={16} /> Pop-up-ul apare aici în clipa în care {m.prenume} scanează.
              </p>
            )}
            {lista.map((s) => (
              <RandScanare key={s.id} s={s} m={getM(s.memberId)} onOpen={() => setInchis(null)} />
            ))}
          </div>

          {popup && (
            <div className={`absolute inset-0 z-10 flex items-center justify-center p-5 ${a("fade")}`} style={{ background: "rgba(17,24,39,0.38)" }}>
              <div role="dialog" aria-label={`Scanare QR · ${m.prenume} ${m.nume}`} className={`flex max-h-full w-[476px] flex-col rounded-[16px] ${a("modal")}`} style={{ background: C.card, boxShadow: "0 20px 50px rgba(17,24,39,0.25)" }}>
                <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${C.contur}` }}>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 700 }}>Scanare QR</p>
                    <p style={{ fontSize: 13, color: C.text2 }}>
                      azi la {ora(popup.sec)} · scanarea #{aCataAzi(st.scans, popup)} a clientului azi
                    </p>
                  </div>
                  <button type="button" aria-label="Închide pop-up-ul" onClick={() => setInchis(popup.id)} className={`flex size-8 items-center justify-center rounded-lg hover:bg-[#F3F4F6] ${focus}`}>
                    <X size={18} color={C.text2} />
                  </button>
                </div>
                <div className={`min-h-0 flex-1 px-5 py-4 ${scrollY}`}>
                  <CorpPopup key={popup.id} s={popup} indiciu={popup.status === "in_asteptare"} vanzareInline />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Scanare() {
  const { mobile } = useDemo();
  return mobile ? <ScanareTelefon /> : <ScanareDesktop />;
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, CheckCheck, Hourglass, RotateCcw, ScanLine, X } from "lucide-react";
import { FakeQR, StatusBar } from "../../kit";
import { C, CULORI_TIP, ETICHETA_TIP, STAFF_EU, ora, pluralSedinte, subsActive, valabilPana, type Member } from "../data";
import { useDemo, type Scan } from "../store";
import { Btn, ButonPauza, Bifa, CIFRE, DISPLAY, Segmentat, Spinner, Wordmark, focus, scrollY, useAnim } from "../ui";
import { CorpPopup, ListaScanari, momentScanare } from "./scan-ui";

/* ============================================================
   Intrarea cu QR, cap-coadă. Clientul scanează codul printat de la
   recepție (ca în scanare.tsx); motorul decide; recepția vede pop-up-ul
   (ScanariLive.tsx). Pe desktop, telefonul și lista recepției stau
   alături; bara de sus alege cine scanează.
   ============================================================ */

type Faza = "camera" | "trimitere" | "rezultat";

/* ---------------- ecranul de telefon ---------------- */

function Camera({ onScan, onInchide, trimite, manual }: { onScan: () => void; onInchide: () => void; trimite: boolean; manual: boolean }) {
  const { st } = useDemo();
  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: "#17161B" }}>
      <StatusBar tone="light" time={ora(st.now)} />
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <button
          type="button"
          aria-label="Închide scanarea"
          onClick={onInchide}
          className={`flex size-10 items-center justify-center rounded-full ${focus}`}
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <X size={22} color="#fff" aria-hidden />
        </button>
        <p className="flex-1 text-center" style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>
          Scanează codul de la recepție
        </p>
        <span className="size-10" />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <button type="button" onClick={onScan} disabled={trimite} aria-label="Scanează codul QR" className={`relative size-[244px] rounded-[18px] ${focus}`}>
          {/* afișul printat de la recepție */}
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 flex w-[176px] flex-col items-center gap-2 rounded-[12px] px-3 pb-3 pt-3"
            style={{ background: "#fff", transform: "translate(-50%, -50%) rotate(-3deg)", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
          >
            <Wordmark size={13} mark={false} />
            <FakeQR size={124} color="#111827" seed={31} />
            <span style={{ fontSize: 10, color: C.text2Tare, fontWeight: 600 }}>Scanează la intrare</span>
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
                transition: "border-color 200ms ease-out",
                ...(k === "tl" && { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 }),
                ...(k === "tr" && { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 }),
                ...(k === "bl" && { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 }),
                ...(k === "br" && { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 }),
              }}
            />
          ))}
        </button>
      </div>

      <div className="flex min-h-[132px] flex-col items-center justify-start gap-3 px-6 pb-10">
        {trimite ? (
          <p className="flex items-center gap-3" style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>
            <Spinner color="#fff" /> Se verifică abonamentul…
          </p>
        ) : (
          <>
            <p style={{ color: "rgba(255,255,255,0.88)", fontSize: 14, fontWeight: 500 }}>Ține telefonul în dreptul codului QR</p>
            {manual && (
              <button
                type="button"
                onClick={onScan}
                className={`flex items-center gap-2 rounded-full px-4 py-2 transition-colors duration-150 hover:bg-[rgba(255,255,255,0.2)] ${focus}`}
                style={{ background: "rgba(255,255,255,0.14)", color: "#fff", fontSize: 14, fontWeight: 600 }}
              >
                <ScanLine size={16} aria-hidden /> Scanează codul
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Panou({ fundal, children }: { fundal: string; children: ReactNode }) {
  const a = useAnim();
  const { st } = useDemo();
  return (
    <div className="flex h-full flex-col" style={{ background: fundal }}>
      <StatusBar tone="dark" time={ora(st.now)} />
      <div className={`flex flex-1 flex-col items-center justify-center gap-4 px-7 pb-12 text-center ${a("fade")}`}>{children}</div>
    </div>
  );
}

const Titlu = ({ children }: { children: ReactNode }) => (
  <p style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{children}</p>
);
const Sub = ({ children }: { children: ReactNode }) => (
  <p style={{ fontSize: 15, color: C.text2Tare, lineHeight: 1.5, maxWidth: 300 }}>{children}</p>
);
const Cerc = ({ culoare, children }: { culoare: string; children: ReactNode }) => (
  <span aria-hidden className="flex size-[88px] items-center justify-center rounded-full" style={{ background: culoare }}>
    {children}
  </span>
);

function Rezultat({ s, m, onGata, onReia, onScanDinNou }: { s: Scan; m: Member; onGata: () => void; onReia?: () => void; onScanDinNou: () => void }) {
  const { notify } = useDemo();

  if (s.status === "consumat" && s.consum) {
    const t = s.consum.tip;
    const n = s.consum.ramase;
    return (
      <Panou fundal={C.fSucces}>
        <Bifa size={88} />
        <Titlu>Intrare înregistrată</Titlu>
        <div className="flex flex-col items-center gap-2">
          {n !== null && <span style={{ fontSize: 13, color: C.text2Tare }}>{n === 1 ? "Îți mai rămâne" : "Îți mai rămân"}</span>}
          <span className="rounded-full px-4 py-2" style={{ background: CULORI_TIP[t].bg, color: CULORI_TIP[t].fg, fontSize: 16, fontWeight: 600, ...CIFRE }}>
            {n === null ? `${ETICHETA_TIP[t].charAt(0).toUpperCase()}${ETICHETA_TIP[t].slice(1)} nelimitat` : `${pluralSedinte(n)} ${ETICHETA_TIP[t]}`}
          </span>
        </div>
        {s.staff && <p style={{ fontSize: 13, color: C.succes, fontWeight: 600 }}>Confirmată de recepție</p>}
        <Btn lat mare onClick={onGata} className="mt-3 max-w-[320px]">
          Gata
        </Btn>
      </Panou>
    );
  }
  if (s.status === "in_asteptare") {
    const oOptiune = (s.optiuni?.length ?? 0) === 1;
    const tipuri = s.optiuni?.[0]?.contoare.map((c) => ETICHETA_TIP[c.tip]).join(" sau ");
    return (
      <Panou fundal={C.fAvert}>
        <Cerc culoare={C.avert}>
          <Hourglass size={40} color="#fff" />
        </Cerc>
        <Titlu>Așteaptă confirmarea de la recepție</Titlu>
        <Sub>{oOptiune ? `Recepția alege: ${tipuri}.` : "Recepția alege abonamentul."}</Sub>
        <Spinner color={C.avertCerneala} size={22} />
      </Panou>
    );
  }
  if (s.status === "duplicat") {
    return (
      <Panou fundal={C.fMov}>
        <Cerc culoare={C.mov}>
          <CheckCheck size={40} color="#fff" />
        </Cerc>
        <Titlu>Ai intrat deja azi</Titlu>
        <Sub>Nu se scade nicio ședință.</Sub>
        <Btn lat mare onClick={onGata} className="mt-3 max-w-[320px]">
          Gata
        </Btn>
        {onReia && (
          <Btn v="fantoma" onClick={onReia}>
            <RotateCcw size={15} aria-hidden /> Reia demo-ul
          </Btn>
        )}
      </Panou>
    );
  }
  // refuzat
  const nou = s.motiv !== "respinsa_de_receptie" ? subsActive(m)[0] : undefined;
  return (
    <Panou fundal={C.fEroare}>
      <Cerc culoare={C.eroare}>
        <X size={44} color="#fff" strokeWidth={2.5} />
      </Cerc>
      <Titlu>
        {s.motiv === "abonament_expirat" ? "Abonamentul tău a expirat" : s.motiv === "respinsa_de_receptie" ? "Recepția nu a aprobat intrarea" : "Nu ai un abonament activ"}
      </Titlu>
      <Sub>
        {nou
          ? `Abonament nou: „${nou.nume}”`
          : m.ultimulExpirat && s.motiv === "abonament_expirat"
            ? `„${m.ultimulExpirat.nume}” a fost valabil până pe ${valabilPana(m.ultimulExpirat.exp)}.`
            : "Vorbește cu recepția."}
      </Sub>
      {nou ? (
        <Btn lat mare onClick={onScanDinNou} className="mt-3 max-w-[320px]">
          Scanează din nou
        </Btn>
      ) : s.motiv !== "respinsa_de_receptie" ? (
        <Btn lat mare className="mt-3 max-w-[320px]" onClick={() => notify("Plata e oprită în demo. Vinde-l din recepție.")}>
          Reînnoiește abonamentul
        </Btn>
      ) : null}
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

  // pe telefon, recepția confirmă după câteva secunde
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
  const { go, getM, reseteazaPersonaje } = useDemo();
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
    />
  );
}

/* ---------------- desktop: telefonul și recepția, alături ---------------- */

const PERSONAJE = [
  { id: "c0", nume: "Andrei", caz: "2 contoare" },
  { id: "c1", nume: "Radu", caz: "nelimitat" },
  { id: "c2", nume: "Bianca", caz: "expirat" },
];

function ScanareDesktop() {
  const { set, go } = useDemo();
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
      inchis={inchis}
      setInchis={setInchis}
      reia={(reseteaza) => {
        reseteaza();
        setInchis(null);
        setRunda((r) => r + 1);
      }}
      laRecepție={(id) => {
        set({ openScan: id });
        go("receptie");
      }}
    />
  );
}

const S = 0.75;

function Scena({
  cine,
  setCine,
  reia,
  inchis,
  setInchis,
  laRecepție,
}: {
  cine: string;
  setCine: (id: string) => void;
  reia: (reseteaza: () => void) => void;
  inchis: string | null;
  setInchis: (id: string | null) => void;
  laRecepție: (id: string | null) => void;
}) {
  const { st, getM, reseteazaPersonaje } = useDemo();
  const a = useAnim();
  const { faza, scan, porneste, reiaCamera, manual } = useFluxScanare(cine, false);
  // un rând deschis din listă are întâietate față de scanarea de pe telefon
  const [ales, setAles] = useState<string | null>(null);
  const m = getM(cine);
  const popup = ales ? (st.scans.find((x) => x.id === ales) ?? null) : scan && inchis !== scan.id ? scan : null;
  const pm = popup ? getM(popup.memberId) : null;
  const inchide = () => {
    if (popup) setInchis(popup.id);
    setAles(null);
  };

  return (
    <div className="flex h-full flex-col" style={{ background: C.fundal }}>
      <div className="flex h-[52px] shrink-0 items-center gap-3 px-6" style={{ background: C.card, borderBottom: `1px solid ${C.contur}` }}>
        <span style={{ fontSize: 13, color: C.text2 }}>Cine scanează</span>
        <Segmentat
          eticheta="Cine scanează"
          valoare={cine}
          onChange={setCine}
          optiuni={PERSONAJE.map((p) => ({
            v: p.id,
            eticheta: (
              <span className="flex items-baseline gap-1.5">
                {p.nume}
                <span style={{ fontSize: 12.5, fontWeight: 400, color: C.text2Tare }}>{p.caz}</span>
              </span>
            ),
          }))}
        />
        <Btn v="secundar" className="ml-auto" onClick={() => reia(reseteazaPersonaje)} label="Reia demo-ul de la zero">
          <RotateCcw size={15} aria-hidden /> Reia
        </Btn>
      </div>

      <div className="flex min-h-0 flex-1 gap-6 px-8 py-6">
        {/* telefonul */}
        <div className="flex shrink-0 items-center justify-center" style={{ width: 390 * S + 18 }}>
          <div
            className="relative rounded-[46px] bg-[#0C0D0F] p-[9px]"
            style={{ width: 390 * S + 18, height: 844 * S + 18, boxShadow: "0 24px 48px -24px rgba(17,24,39,0.35), inset 0 0 0 2px #2A2C30" }}
          >
            <div className="relative overflow-hidden rounded-[37px]" style={{ width: 390 * S, height: 844 * S }}>
              <div style={{ width: 390, height: 844, transform: `scale(${S})`, transformOrigin: "top left" }} className="relative">
                {faza !== "rezultat" || !scan ? (
                  <Camera onScan={porneste} onInchide={() => reia(reseteazaPersonaje)} trimite={faza === "trimitere"} manual={manual} />
                ) : (
                  <Rezultat s={scan} m={m} onGata={reiaCamera} onScanDinNou={reiaCamera} />
                )}
              </div>
              <span aria-hidden className="pointer-events-none absolute left-1/2 top-[8px] h-[25px] w-[90px] -translate-x-1/2 rounded-full bg-black" />
            </div>
          </div>
        </div>

        {/* recepția */}
        <section
          aria-label="Ecranul recepției"
          className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[12px]"
          style={{ background: C.card, border: `1px solid ${C.contur}` }}
        >
          <div className="flex h-[56px] shrink-0 items-center gap-3 px-5" style={{ borderBottom: `1px solid ${C.contur}` }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Scanări</h2>
            <span style={{ fontSize: 13, color: C.text2, ...CIFRE }}>{st.azi.scanari} azi</span>
            <span className="ml-auto flex items-center gap-2">
              <ButonPauza mic />
              <button
                type="button"
                onClick={() => laRecepție(popup?.id ?? null)}
                className={`flex items-center gap-1 rounded-[8px] px-2 py-1 ${focus}`}
                style={{ fontSize: 13, fontWeight: 600, color: C.mov }}
              >
                Deschide panoul <ArrowRight size={14} aria-hidden />
              </button>
            </span>
          </div>
          <div className={`min-h-0 flex-1 ${scrollY}`}>
            <ListaScanari scans={st.scans.slice(0, 16)} onOpen={(id) => setAles(id)} />
          </div>

          {popup && pm && (
            <div className={`absolute inset-0 z-10 flex items-center justify-center p-5 ${a("fade")}`} style={{ background: "rgba(17,24,39,0.38)" }}>
              <div
                role="dialog"
                aria-label={`${popup.metoda === "manual" ? "Check-in manual" : "Scanare QR"} · ${pm.prenume} ${pm.nume}`}
                onKeyDown={(e) => e.key === "Escape" && inchide()}
                className={`flex max-h-full w-[468px] flex-col rounded-[16px] ${a("modal")}`}
                style={{ background: C.card, boxShadow: "0 16px 40px rgba(17,24,39,0.2)" }}
              >
                <div className="flex items-start justify-between gap-3 px-5 py-3.5" style={{ borderBottom: `1px solid ${C.contur}` }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{popup.metoda === "manual" ? "Check-in manual" : "Scanare QR"}</p>
                    <p style={{ fontSize: 13, color: C.text2, ...CIFRE }}>{momentScanare(st.scans, popup)}</p>
                  </div>
                  <button type="button" aria-label="Închide pop-up-ul" onClick={inchide} className={`-mr-1.5 flex size-8 items-center justify-center rounded-[8px] hover:bg-[#F3F4F6] ${focus}`}>
                    <X size={18} color={C.text2Tare} aria-hidden />
                  </button>
                </div>
                <div className={`min-h-0 flex-1 px-5 py-4 ${scrollY}`}>
                  <CorpPopup key={popup.id} s={popup} vanzareInline />
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

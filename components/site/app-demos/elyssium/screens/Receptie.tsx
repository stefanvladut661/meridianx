"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Search, UserCheck } from "lucide-react";
import { FakeQR } from "../../kit";
import { C, ETICHETA_TIP, lume, stareClient, subsActive, valabilPanaScurt, type Member, type Tip } from "../data";
import { useDemo } from "../store";
import { AntetPagina, StaffShell } from "../shell";
import { Avatar, Btn, ButonPauza, CIFRE, Card, Dialog, H2, campCls, campStil, focus, focusInterior, scrollY } from "../ui";
import { CapScanari, CorpPopup, ListaScanari, momentScanare } from "./scan-ui";

/* ============================================================
   Scanări: ecranul pe care recepția îl ține deschis toată ziua.
   Scanările noi intră în listă cât timp lista nu e pe pauză; pop-up-ul
   se deschide la clic sau când vine din ecranul de intrare cu QR;
   check-in-ul manual trece prin același motor.
   ============================================================ */

export default function Receptie() {
  const { st, set, mobile, notify } = useDemo();
  const [manual, setManual] = useState(false);
  const deschis = st.openScan ? (st.scans.find((s) => s.id === st.openScan) ?? null) : null;
  const inAsteptare = st.scans.filter((s) => s.status === "in_asteptare").length;

  const sedinte = (
    <Card className="flex flex-col gap-3">
      <H2>Ședințe consumate azi</H2>
      <ul className="flex flex-col gap-3">
        {(["fitness", "spa", "aerobic"] as Tip[]).map((t) => {
          const v = st.azi.tipuri[t];
          const tot = st.azi.consumate || 1;
          return (
            <li key={t} className="flex flex-col gap-1.5">
              <div className="flex justify-between" style={{ fontSize: 13.5 }}>
                <span className="capitalize">{ETICHETA_TIP[t]}</span>
                <span style={{ fontWeight: 600, ...CIFRE }}>{v}</span>
              </div>
              <span className="h-1.5 overflow-hidden rounded-full" style={{ background: C.dezactivat }} aria-hidden>
                <span className="block h-full rounded-full transition-[width] duration-200" style={{ width: `${(v / tot) * 100}%`, background: C.mov }} />
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );

  const codQr = (
    <Card className="flex items-center gap-4">
      <span className="shrink-0 rounded-[8px] p-1.5" style={{ border: `1px solid ${C.contur}` }}>
        <FakeQR size={64} color={C.text} seed={31} />
      </span>
      <div className="min-w-0">
        <H2>Codul de la intrare</H2>
        <button
          type="button"
          onClick={() => notify("Regenerarea codului e oprită în demo.")}
          className={`mt-1 flex items-center gap-1.5 rounded-[6px] ${focus}`}
          style={{ fontSize: 13, fontWeight: 600, color: C.mov }}
        >
          <RefreshCw size={13} aria-hidden /> Regenerează
        </button>
      </div>
    </Card>
  );

  const sumar = (
    <>
      {st.azi.scanari} azi
      {inAsteptare > 0 && <span style={{ color: C.avertCerneala, fontWeight: 500 }}> · {inAsteptare} în așteptare</span>}
    </>
  );

  const deschide = (id: string) => set({ openScan: id });

  return (
    <StaffShell activ="receptie">
      {mobile ? (
        <div className="flex flex-col gap-4">
          <AntetPagina titlu="Scanări" sub={sumar}>
            <Btn onClick={() => setManual(true)}>
              <UserCheck size={16} aria-hidden /> Check-in manual
            </Btn>
            <ButonPauza />
          </AntetPagina>
          <Card pad={false} className="overflow-hidden">
            <ListaScanari scans={st.scans} compact onOpen={deschide} />
          </Card>
        </div>
      ) : (
        <div className="flex h-full flex-col gap-5 px-6 pt-6">
          <AntetPagina titlu="Scanări" sub={sumar}>
            <ButonPauza />
            <Btn onClick={() => setManual(true)}>
              <UserCheck size={16} aria-hidden /> Check-in manual
            </Btn>
          </AntetPagina>
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_272px] gap-5 pb-6">
            <Card pad={false} className="flex max-h-full min-h-0 flex-col self-start overflow-hidden">
              <CapScanari />
              <div className={`min-h-0 flex-1 ${scrollY}`}>
                <ListaScanari scans={st.scans} onOpen={deschide} />
              </div>
            </Card>
            <div className={`flex min-h-0 flex-col gap-4 ${scrollY}`}>
              {sedinte}
              {codQr}
            </div>
          </div>
        </div>
      )}

      {deschis && (
        <Dialog
          titlu={deschis.metoda === "manual" ? "Check-in manual" : "Scanare QR"}
          subtitlu={momentScanare(st.scans, deschis)}
          onClose={() => set({ openScan: null })}
        >
          <CorpPopup key={deschis.id} s={deschis} />
        </Dialog>
      )}
      {manual && (
        <CheckinManual
          onClose={() => setManual(false)}
          onAles={(id) => {
            setManual(false);
            set({ openScan: id });
          }}
        />
      )}
    </StaffShell>
  );
}

/* ---------------- check-in manual ---------------- */

function StareRezultat({ m }: { m: Member }) {
  const s = stareClient(m);
  if (s === "activ")
    return (
      <span className="shrink-0" style={{ fontSize: 12.5, color: C.text2, ...CIFRE }}>
        până pe {valabilPanaScurt(subsActive(m)[0].exp)}
      </span>
    );
  if (s === "expirat")
    return (
      <span className="shrink-0" style={{ fontSize: 12.5, fontWeight: 600, color: C.eroareText }}>
        Expirat
      </span>
    );
  return (
    <span className="shrink-0" style={{ fontSize: 12.5, color: C.text2 }}>
      Fără abonament
    </span>
  );
}

function CheckinManual({ onClose, onAles }: { onClose: () => void; onAles: (scanId: string) => void }) {
  const { scaneaza, getM, st } = useDemo();
  const [q, setQ] = useState("");
  const rezultate = useMemo(() => {
    const L = lume();
    const t = q
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (!t) return L.clienti.filter((c) => subsActive(c).length > 0 && st.intrati[c.id] === undefined).slice(3, 8);
    return L.clienti
      .filter((c) =>
        `${c.prenume} ${c.nume} ${c.cod}`
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .includes(t)
      )
      .slice(0, 8);
  }, [q, st.intrati]);

  return (
    <Dialog titlu="Check-in manual" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">Caută clientul</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" color={C.text2} aria-hidden />
          <input
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută după nume sau tag"
            className={`${campCls} py-2 pl-9 pr-3`}
            style={{ ...campStil, lineHeight: "22px" }}
          />
        </label>
        {!q && <p style={{ fontSize: 12.5, color: C.text2 }}>Activi, fără intrare azi</p>}
        {rezultate.length > 0 ? (
          <ul className="overflow-hidden rounded-[8px]" style={{ border: `1px solid ${C.contur}` }}>
            {rezultate.map((c0, i) => {
              const c = getM(c0.id);
              const sub = subsActive(c)[0];
              return (
                <li key={c.id} style={{ borderTop: i ? `1px solid ${C.contur}` : undefined }}>
                  <button
                    type="button"
                    onClick={() => onAles(scaneaza(c.id, "manual"))}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[#FAFAF8] ${focusInterior}`}
                  >
                    <Avatar prenume={c.prenume} nume={c.nume} tint={c.tint} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ fontSize: 14, fontWeight: 600 }}>
                        {c.prenume} {c.nume}
                      </span>
                      <span className="block truncate" style={{ fontSize: 12.5, color: C.text2, ...CIFRE }}>
                        #{c.cod}
                        {sub ? ` · ${sub.nume}` : ""}
                      </span>
                    </span>
                    <StareRezultat m={c} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-6 text-center" style={{ fontSize: 14, color: C.text2 }}>
            Niciun client cu „{q}”
          </p>
        )}
      </div>
    </Dialog>
  );
}

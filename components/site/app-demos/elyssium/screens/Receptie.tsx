"use client";

import { useMemo, useState } from "react";
import { QrCode, RefreshCw, Search, UserCheck } from "lucide-react";
import { FakeQR, Sparkline } from "../../kit";
import { C, ETICHETA_TIP, lume, ora, stareClient, subsActive, type Member, type Tip } from "../data";
import { useDemo } from "../store";
import { AntetPagina, StaffShell } from "../shell";
import { Avatar, Btn, Card, Chip, Dialog, Eticheta, LiveDot, MONO, focus, scrollY } from "../ui";
import { CorpPopup, RandScanare, aCataAzi } from "./scan-ui";

/* ============================================================
   Scanări live — ecranul pe care recepția îl ține deschis toată ziua.
   Scanările sosesc singure; pop-up-ul se deschide la clic sau când
   vine din ecranul de check-in; check-in-ul manual trece prin motor.
   ============================================================ */

const OCUPARE_AZI = [4, 12, 26, 41, 52, 49, 55, 61, 58];

export default function Receptie() {
  const { st, getM, set, mobile, notify } = useDemo();
  const [manual, setManual] = useState(false);
  const deschis = st.openScan ? (st.scans.find((s) => s.id === st.openScan) ?? null) : null;
  const inAsteptare = st.scans.filter((s) => s.status === "in_asteptare").length;

  const statistici = (
    <>
      <Card className="flex flex-col gap-2" style={{ padding: "16px 18px" }}>
        <Eticheta>Acum în sală</Eticheta>
        <div className="flex items-end justify-between gap-3">
          <b style={{ fontSize: 36, lineHeight: 1, color: C.mov, fontVariantNumeric: "tabular-nums" }}>{st.inSala}</b>
          <div className="w-[130px]">
            <Sparkline values={[...OCUPARE_AZI, st.inSala]} color={C.mov} height={38} />
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: C.text2 }}>de la 7:30 · vârful de azi e așteptat după 17:00</p>
      </Card>
      <Card className="flex flex-col gap-3" style={{ padding: "16px 18px" }}>
        <Eticheta>Consumate azi, pe tipuri</Eticheta>
        {(["fitness", "spa", "aerobic"] as Tip[]).map((t) => {
          const v = st.azi.tipuri[t];
          const tot = st.azi.consumate || 1;
          return (
            <div key={t} className="flex flex-col gap-1">
              <div className="flex justify-between" style={{ fontSize: 13.5 }}>
                <span className="capitalize" style={{ color: C.text2, fontWeight: 600 }}>
                  {ETICHETA_TIP[t]}
                </span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{v}</b>
              </div>
              <span className="h-2 overflow-hidden rounded-full" style={{ background: C.dezactivat }}>
                <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${(v / tot) * 100}%`, background: C.mov }} />
              </span>
            </div>
          );
        })}
      </Card>
    </>
  );

  const codQr = (
    <Card className="flex items-center gap-4" style={{ padding: "14px 16px" }}>
      <span className="shrink-0 rounded-[8px] p-1.5" style={{ border: `1px solid ${C.contur}` }}>
        <FakeQR size={64} color={C.text} seed={31} />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 600 }}>
          <QrCode size={15} color={C.mov} /> Codul de la intrare
        </p>
        <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.45 }}>Printat la recepție. Se poate regenera oricând.</p>
        <button
          type="button"
          onClick={() => notify("În demo, codul nu se regenerează. În aplicația reală, codul vechi devine invalid pe loc, iar foaia de la recepție se reprintează.")}
          className={`mt-1 flex items-center gap-1 rounded-[6px] ${focus}`}
          style={{ fontSize: 13, fontWeight: 600, color: C.mov }}
        >
          <RefreshCw size={13} /> Regenerează
        </button>
      </div>
    </Card>
  );

  const sumar = (
    <>
      {st.azi.scanari} scanări azi (se arată ultimele {st.scans.length}) · {st.azi.consumate} consumate
      {inAsteptare > 0 && <b style={{ color: "#B45309", fontWeight: 600 }}> · {inAsteptare} în așteptare</b>}
    </>
  );

  const lista = (
    <ol className="flex flex-col gap-2" aria-label="Scanările de azi">
      {st.scans.map((s) => (
        <li key={s.id}>
          <RandScanare s={s} m={getM(s.memberId)} compact={mobile} onOpen={() => set({ openScan: s.id })} />
        </li>
      ))}
    </ol>
  );

  return (
    <StaffShell activ="receptie">
      {mobile ? (
        <div className="flex flex-col gap-4">
          <AntetPagina titlu="Scanări live" sub={sumar}>
            <span className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: C.succes }}>
              <LiveDot size={7} /> LIVE
            </span>
            <Btn onClick={() => setManual(true)}>
              <UserCheck size={16} /> Check-in manual
            </Btn>
          </AntetPagina>
          <div className="-mt-1 grid grid-cols-3 gap-2">
            {[
              ["în sală", st.inSala],
              ["intrări azi", st.azi.consumate],
              ["refuzate", st.azi.refuzate],
            ].map(([l, v]) => (
              <div key={l} className="rounded-[14px] px-3 py-2.5" style={{ background: C.card, border: `1px solid ${C.contur}` }}>
                <b style={{ fontSize: 22, color: C.mov, fontVariantNumeric: "tabular-nums" }}>{v}</b>
                <p style={{ fontSize: 12, color: C.text2 }}>{l}</p>
              </div>
            ))}
          </div>
          {lista}
        </div>
      ) : (
        <div className="flex h-full flex-col px-6 pt-6">
          <AntetPagina titlu="Scanări live" sub={sumar}>
            <span className="mr-2 flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.succes }}>
              <LiveDot size={7} /> LIVE
            </span>
            <Btn onClick={() => setManual(true)}>
              <UserCheck size={16} /> Check-in manual
            </Btn>
          </AntetPagina>
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_292px] gap-5">
            <div className={`min-h-0 pb-6 pr-1 ${scrollY}`}>{lista}</div>
            <div className={`flex min-h-0 flex-col gap-4 pb-6 ${scrollY}`}>
              {statistici}
              {codQr}
            </div>
          </div>
        </div>
      )}

      {deschis && (
        <Dialog
          titlu={deschis.metoda === "manual" ? "Check-in manual" : "Scanare QR"}
          subtitlu={`azi la ${ora(deschis.sec)} · scanarea #${aCataAzi(st.scans, deschis)} a clientului azi`}
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

function ChipStare({ m }: { m: Member }) {
  const s = stareClient(m);
  return s === "activ" ? <Chip ton="succes">ACTIV</Chip> : s === "expirat" ? <Chip ton="eroare">EXPIRAT</Chip> : <Chip ton="auriu">NOU</Chip>;
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
    <Dialog titlu="Check-in manual" subtitlu="Pentru clientul care și-a uitat telefonul sau are bateria descărcată" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">Caută clientul</span>
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" color={C.text2} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută după nume sau tag"
            className="w-full rounded-[12px] py-3 pl-10 pr-3 outline-none focus:[border-color:#4A2B7A]"
            style={{ border: `1.5px solid ${C.contur}`, fontSize: 15, background: C.card, color: C.text }}
          />
        </label>
        {!q && <p style={{ fontSize: 12.5, color: C.text2 }}>Clienți activi care n-au intrat încă azi:</p>}
        <ul className="flex flex-col gap-1.5">
          {rezultate.map((c0) => {
            const c = getM(c0.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onAles(scaneaza(c.id, "manual"))}
                  className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left hover:bg-[#FAFAF8] ${focus}`}
                  style={{ border: `1px solid ${C.contur}` }}
                >
                  <Avatar prenume={c.prenume} nume={c.nume} tint={c.tint} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 600 }}>
                      {c.prenume} {c.nume}
                    </span>
                    <span className="block truncate" style={{ fontSize: 12, color: C.text2 }}>
                      <span style={{ fontFamily: MONO }}>#{c.cod}</span>
                      {subsActive(c)[0] ? ` · ${subsActive(c)[0].nume}` : ""}
                    </span>
                  </span>
                  <ChipStare m={c} />
                </button>
              </li>
            );
          })}
          {rezultate.length === 0 && (
            <li className="rounded-[12px] px-4 py-6 text-center" style={{ border: `1px dashed ${C.contur}`, fontSize: 14, color: C.text2 }}>
              Niciun client cu „{q}”. Verifică scrierea sau caută după tag.
            </li>
          )}
        </ul>
      </div>
    </Dialog>
  );
}

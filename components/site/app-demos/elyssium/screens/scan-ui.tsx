"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import {
  C,
  ETICHETA_TIP,
  PLANURI,
  ora,
  pluralZile,
  subsActive,
  valabilPana,
  valabilPanaScurt,
  type Member,
  type Metoda,
} from "../data";
import { TEXT_MOTIV, useDemo, type Scan, type StatusScan } from "../store";
import { Avatar, Btn, CIFRE, Chip, ContorStaff, Segmentat, focus, focusInterior, type Ton } from "../ui";

/* ============================================================
   Piesele scanărilor, comune ecranului „Scanări” și ecranului de
   intrare cu QR: rândul din lista zilei și pop-up-ul recepției
   (PopupScanare.tsx din aplicația reală).
   ============================================================ */

const mare = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Etichetă colorată doar pentru excepții; „Consumat” rămâne text. */
const EXCEPTII: Partial<Record<StatusScan, [Ton, string]>> = {
  in_asteptare: ["avert", "În așteptare"],
  refuzat: ["eroare", "Refuzat"],
  duplicat: ["neutru", "Duplicat"],
};

export function StareScanare({ status }: { status: StatusScan }) {
  const e = EXCEPTII[status];
  if (!e) return <span style={{ fontSize: 13, color: C.text2 }}>Consumat</span>;
  return <Chip ton={e[0]}>{e[1]}</Chip>;
}

/** Detaliul din rând, ca date: „Fitness · 0 rămase”, „Fitness sau spa”. */
export function descriere(s: Scan, intrareAzi?: number) {
  const b: string[] = [];
  if (s.status === "consumat" && s.consum) {
    b.push(`${mare(ETICHETA_TIP[s.consum.tip])} · ${s.consum.ramase === null ? "nelimitat" : `${s.consum.ramase} rămase`}`);
  } else if (s.status === "in_asteptare") {
    const tipuri = Array.from(
      new Set((s.optiuni ?? []).flatMap((o) => o.contoare.filter((c) => c.ramase === null || c.ramase > 0).map((c) => ETICHETA_TIP[c.tip])))
    );
    b.push(mare(tipuri.join(" sau ")));
  } else if (s.status === "duplicat") {
    b.push(intrareAzi !== undefined ? `A intrat azi la ${ora(intrareAzi)}` : mare(TEXT_MOTIV.deja_intrat_azi));
  } else if (s.motiv) b.push(mare(TEXT_MOTIV[s.motiv]));
  if (s.metoda === "manual") b.push("manual");
  return b.join(" · ");
}

/** Lățimile coloanelor din lista de pe desktop, comune rândului și capului de tabel. */
const COL = { ora: 44, client: 184, stare: 112 };

export function CapScanari() {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center gap-3 px-4"
      style={{ height: 36, fontSize: 12.5, fontWeight: 500, color: C.text2, borderBottom: `1px solid ${C.contur}` }}
    >
      <span className="shrink-0" style={{ width: COL.ora }}>
        Ora
      </span>
      <span className="shrink-0" style={{ width: 32 + 12 + COL.client - 12 }}>
        Client
      </span>
      <span className="shrink-0" style={{ width: COL.stare }}>
        Stare
      </span>
      <span>Detalii</span>
    </div>
  );
}

export function RandScanare({ s, m, onOpen, compact }: { s: Scan; m: Member; onOpen: () => void; compact?: boolean }) {
  const { st } = useDemo();
  const asteapta = s.status === "in_asteptare";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 text-left transition-colors duration-150 ${asteapta ? "hover:bg-[#FEF3C7]" : "hover:bg-[#FAFAF8]"} ${focusInterior}`}
      style={{ padding: compact ? "10px 16px" : "8px 16px", minHeight: compact ? 60 : 52, background: asteapta ? C.fAvertRand : undefined }}
    >
      {!compact && (
        <span className="shrink-0" style={{ width: COL.ora, fontSize: 13, color: C.text2, ...CIFRE }}>
          {ora(s.sec)}
        </span>
      )}
      <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={compact ? 36 : 32} />
      <span className={`flex min-w-0 flex-col ${compact ? "flex-1" : "shrink-0"}`} style={compact ? undefined : { width: COL.client - 12 }}>
        <span className="truncate" style={{ fontSize: 14, fontWeight: 600, lineHeight: "20px" }}>
          {m.prenume} {m.nume}
        </span>
        <span className="truncate" style={{ fontSize: 12.5, color: C.text2, lineHeight: "18px", ...CIFRE }}>
          {compact ? `${ora(s.sec)} · ` : ""}#{m.cod}
        </span>
      </span>
      {compact ? (
        <span className="shrink-0">
          <StareScanare status={s.status} />
        </span>
      ) : (
        <>
          <span className="shrink-0" style={{ width: COL.stare }}>
            <StareScanare status={s.status} />
          </span>
          <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13, color: C.text2 }}>
            {descriere(s, st.intrati[s.memberId])}
          </span>
          {asteapta && (
            <span className="flex shrink-0 items-center" style={{ fontSize: 13, fontWeight: 600, color: C.avertCerneala }}>
              Rezolvă <ChevronRight size={15} aria-hidden />
            </span>
          )}
        </>
      )}
    </button>
  );
}

/** Lista zilei, într-o singură casetă cu linii între rânduri. */
export function ListaScanari({ scans, compact, onOpen }: { scans: Scan[]; compact?: boolean; onOpen: (id: string) => void }) {
  const { getM } = useDemo();
  return (
    <ol aria-label="Scanările de azi">
      {scans.map((s, i) => (
        <li key={s.id} style={{ borderTop: i ? `1px solid ${C.contur}` : undefined }}>
          <RandScanare s={s} m={getM(s.memberId)} compact={compact} onOpen={() => onOpen(s.id)} />
        </li>
      ))}
    </ol>
  );
}

/* ---------------- pop-up-ul recepției ---------------- */

function Banner({ ton, titlu, detaliu }: { ton: "activ" | "eroare"; titlu: string; detaliu?: string }) {
  const s = ton === "activ" ? { bg: C.fActiv, fg: C.succes } : { bg: C.fEroare, fg: C.eroareText };
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 rounded-[8px]" style={{ background: s.bg, color: s.fg, padding: "12px 16px" }}>
      <strong style={{ fontSize: 20, fontWeight: 600, lineHeight: "28px" }}>{titlu}</strong>
      {detaliu && <span style={{ fontSize: 14 }}>{detaliu}</span>}
    </div>
  );
}

/** „Azi, 10:18”, plus „a doua scanare” doar când omul a mai scanat azi. */
export function momentScanare(scans: Scan[], s: Scan) {
  const n = scans.filter((x) => x.memberId === s.memberId && x.sec <= s.sec).length;
  return `Azi, ${ora(s.sec)}${n === 2 ? " · a doua scanare" : n > 2 ? ` · a ${n}-a scanare` : ""}`;
}

const Sectiune = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-3 pt-4" style={{ borderTop: `1px solid ${C.contur}` }}>
    {children}
  </div>
);

const ALEGERI_INLINE = ["morning-12", "morning-u", "anytime-12", "anytime-u"];

/**
 * Conținutul pop-up-ului. `vanzareInline` = pe ecranul de intrare cu QR,
 * „Creează abonament” deschide alegerea pe loc, nu profilul.
 */
export function CorpPopup({ s, vanzareInline, onProfil }: { s: Scan; vanzareInline?: boolean; onProfil?: () => void }) {
  const { getM, rezolva, respinge, set, go, vindeAbonament, st } = useDemo();
  const m = getM(s.memberId);
  const [confirmaRespingere, setConfirmaRespingere] = useState(false);
  const [vanzare, setVanzare] = useState(false);
  const [plan, setPlan] = useState("morning-12");
  const [metoda, setMetoda] = useState<Metoda>("card_fizic");
  const [vandut, setVandut] = useState<string | null>(null);
  const activ = subsActive(m).length > 0;

  const deschideProfil = () => {
    if (onProfil) return onProfil();
    set({ openScan: null, profil: m.id });
    go("clienti");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={48} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ fontSize: 17, fontWeight: 600, lineHeight: "24px" }}>
            {m.prenume} {m.nume}
            {m.nrAbonamente === 0 && <Chip ton="auriu">Client nou</Chip>}
            {s.metoda === "manual" && <Chip>Manual</Chip>}
          </p>
          <p style={{ fontSize: 13, color: C.text2, ...CIFRE }}>#{m.cod}</p>
        </div>
        <Btn v="secundar" mic onClick={deschideProfil}>
          Profil
        </Btn>
      </div>

      {s.status === "consumat" && s.consum && (
        <>
          <Banner ton="activ" titlu="Activ" detaliu={`valabil până pe ${valabilPana(s.consum.exp)}`} />
          <div className="flex items-start gap-2.5">
            <Check size={18} color={C.succes} strokeWidth={2.5} className="mt-px shrink-0" aria-hidden />
            <div>
              <p style={{ fontSize: 14 }}>
                Ședință de {ETICHETA_TIP[s.consum.tip]} consumată · {s.consum.ramase === null ? "nelimitat" : `${s.consum.ramase} rămase`}
              </p>
              <p style={{ fontSize: 13, color: C.text2 }}>
                {s.consum.plan} · {s.staff ? (s.metoda === "manual" ? `check-in manual, ${s.staff}` : `confirmată de ${s.staff}`) : "automat"}
              </p>
            </div>
          </div>
        </>
      )}

      {s.status === "duplicat" && <Banner ton="activ" titlu="Activ" detaliu={`a intrat azi la ${ora(st.intrati[m.id] ?? s.sec)}`} />}

      {s.status === "in_asteptare" && (
        <>
          <Banner ton="activ" titlu="Activ" detaliu={TEXT_MOTIV.alegere_necesara} />
          {(s.optiuni ?? []).map((o) => (
            <Sectiune key={o.subId}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span style={{ fontSize: 15, fontWeight: 600 }}>{o.plan}</span>
                <span style={{ fontSize: 13, color: C.text2, ...CIFRE }}>
                  până pe {valabilPanaScurt(o.exp)} · {pluralZile(o.exp)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {o.contoare.map((c) => (
                  <ContorStaff key={c.tip} c={c} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {o.contoare
                  .filter((c) => c.ramase === null || c.ramase > 0)
                  .map((c) => (
                    <Btn key={c.tip} onClick={() => rezolva(s.id, o.subId, c.tip)}>
                      Consumă {ETICHETA_TIP[c.tip]}
                    </Btn>
                  ))}
              </div>
            </Sectiune>
          ))}
          <div className="flex justify-end gap-2">
            {confirmaRespingere ? (
              <>
                <Btn v="secundar" onClick={() => setConfirmaRespingere(false)}>
                  Anulează
                </Btn>
                <Btn v="periculos" onClick={() => respinge(s.id)}>
                  Respinge intrarea
                </Btn>
              </>
            ) : (
              <Btn v="textPericulos" onClick={() => setConfirmaRespingere(true)}>
                Respinge intrarea
              </Btn>
            )}
          </div>
        </>
      )}

      {s.status === "refuzat" && (
        <>
          <Banner
            ton="eroare"
            titlu={s.motiv === "abonament_expirat" ? "Expirat" : "Refuzat"}
            detaliu={
              s.motiv === "abonament_expirat" && m.ultimulExpirat
                ? `„${m.ultimulExpirat.nume}”, valabil până pe ${valabilPanaScurt(m.ultimulExpirat.exp)}`
                : s.motiv
                  ? TEXT_MOTIV[s.motiv]
                  : undefined
            }
          />
          {vandut ? (
            <p role="status" className="flex items-center gap-2" style={{ color: C.succes, fontSize: 14, fontWeight: 500 }}>
              <Check size={17} strokeWidth={2.5} aria-hidden /> Abonament creat: „{vandut}”
            </p>
          ) : activ ? null : vanzareInline && vanzare ? (
            <Sectiune>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text2 }}>Abonament</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Abonament">
                {ALEGERI_INLINE.map((id) => {
                  const p = PLANURI.find((x) => x.id === id)!;
                  const on = id === plan;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPlan(id)}
                      className={`rounded-[8px] px-3 py-1.5 transition-colors duration-150 ${focus}`}
                      style={{
                        fontSize: 13,
                        fontWeight: on ? 600 : 500,
                        background: on ? C.fMov : C.card,
                        color: on ? C.mov : C.text,
                        boxShadow: `inset 0 0 0 ${on ? 1.5 : 1}px ${on ? C.mov : C.conturCamp}`,
                      }}
                    >
                      {p.nume} · {p.pret} lei
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text2 }}>Plată</p>
              <Segmentat<Metoda>
                eticheta="Plată"
                className="self-start"
                valoare={metoda}
                onChange={setMetoda}
                optiuni={[
                  { v: "card_fizic", eticheta: "Card fizic" },
                  { v: "cash", eticheta: "Cash" },
                ]}
              />
              <Btn
                className="self-start"
                onClick={() => {
                  vindeAbonament(m.id, plan, metoda);
                  setVandut(PLANURI.find((x) => x.id === plan)!.nume);
                }}
              >
                Creează abonamentul · {PLANURI.find((x) => x.id === plan)!.pret} lei
              </Btn>
            </Sectiune>
          ) : (
            <div>
              <Btn
                onClick={() => {
                  if (vanzareInline) setVanzare(true);
                  else {
                    set({ openScan: null, profil: m.id, dialogSub: m.id });
                    go("clienti");
                  }
                }}
              >
                Creează abonament
              </Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

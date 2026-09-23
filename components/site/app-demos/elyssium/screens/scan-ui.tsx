"use client";

import { useState } from "react";
import { Check, ChevronRight, Hand } from "lucide-react";
import {
  C,
  ETICHETA_TIP,
  PLANURI,
  STAFF_EU,
  ora,
  pluralSedinte,
  pluralZile,
  stareClient,
  subsActive,
  valabilPana,
  type Member,
  type Metoda,
  type Tip,
} from "../data";
import { TEXT_MOTIV, useDemo, type Scan, type StatusScan } from "../store";
import { Avatar, Btn, Chip, ContorStaff, MONO, focus, useAnim, type Ton } from "../ui";

/* ============================================================
   Piesele scanărilor, comune ecranului „Scanări live” și ecranului
   de check-in cap-coadă: rândul din lista zilei și pop-up-ul
   recepției (PopupScanare.tsx din aplicația reală).
   ============================================================ */

const TON_STATUS: Record<StatusScan, Ton> = { in_asteptare: "avert", consumat: "succes", refuzat: "eroare", duplicat: "mov" };
const TEXT_STATUS: Record<StatusScan, string> = { in_asteptare: "În așteptare", consumat: "Consumat", refuzat: "Refuzat", duplicat: "Duplicat" };

export function ChipStatus({ status }: { status: StatusScan }) {
  return <Chip ton={TON_STATUS[status]}>{TEXT_STATUS[status]}</Chip>;
}

const mare = (t: Tip) => ETICHETA_TIP[t].charAt(0).toUpperCase() + ETICHETA_TIP[t].slice(1);

export function descriere(s: Scan) {
  const b: string[] = [];
  if (s.status === "consumat" && s.consum) {
    b.push(`${mare(s.consum.tip)} pe „${s.consum.plan}” · ${s.consum.ramase === null ? "nelimitat" : `au rămas ${pluralSedinte(s.consum.ramase)}`}`);
  } else if (s.motiv) b.push(TEXT_MOTIV[s.motiv]);
  if (s.metoda === "manual") b.push(`manual · ${s.staff ?? STAFF_EU}`);
  else if (s.staff) b.push(`de ${s.staff}`);
  return b.join(" · ");
}

export function RandScanare({ s, m, onOpen, compact }: { s: Scan; m: Member; onOpen: () => void; compact?: boolean }) {
  const a = useAnim();
  const asteapta = s.status === "in_asteptare";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-[12px] text-left transition-[border-color,box-shadow] duration-150 hover:[border-color:#6B8DEF] hover:shadow-[0_4px_12px_rgba(17,24,39,0.06)] ${s.live ? a("rowIn") : ""} ${focus}`}
      style={{
        padding: compact ? "10px 12px" : "10px 14px",
        background: asteapta ? C.fAvertRand : C.card,
        border: `1px solid ${asteapta ? C.avert : C.contur}`,
      }}
    >
      {!compact && (
        <span className="w-[44px] shrink-0" style={{ fontSize: 14, fontWeight: 600, color: C.text2, fontVariantNumeric: "tabular-nums" }}>
          {ora(s.sec)}
        </span>
      )}
      <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={compact ? 38 : 36} />
      <span className={`flex min-w-0 flex-col ${compact ? "flex-1" : "w-[178px] shrink-0"}`}>
        <span className="truncate" style={{ fontSize: 14.5, fontWeight: 600 }}>
          {m.prenume} {m.nume}
        </span>
        <span className="truncate" style={{ fontSize: 12, color: C.text2 }}>
          {compact ? `${ora(s.sec)} · ` : ""}
          <span style={{ fontFamily: MONO, fontSize: 11.5 }}>#{m.cod}</span>
        </span>
      </span>
      <span className="shrink-0">
        <ChipStatus status={s.status} />
      </span>
      {!compact && (
        <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13, color: C.text2 }}>
          {descriere(s)}
        </span>
      )}
      {asteapta && !compact && (
        <span className="flex shrink-0 items-center gap-0.5" style={{ fontSize: 13, fontWeight: 700, color: "#B45309" }}>
          Rezolvă <ChevronRight size={15} />
        </span>
      )}
    </button>
  );
}

/* ---------------- pop-up-ul recepției ---------------- */

function Banner({ ton, titlu, detaliu }: { ton: "activ" | "avert" | "eroare"; titlu: string; detaliu?: string }) {
  const s = {
    activ: { bg: C.fActiv, fg: C.succes, dot: C.succes },
    avert: { bg: C.fAvertRand, fg: C.avertText, dot: C.avert },
    eroare: { bg: C.fEroare, fg: C.eroare, dot: C.eroare },
  }[ton];
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-[12px]" style={{ background: s.bg, color: s.fg, padding: "13px 16px" }}>
      <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: s.dot }} />
      <strong style={{ fontSize: 20, letterSpacing: "0.03em", lineHeight: 1.2 }}>{titlu}</strong>
      {detaliu && <span style={{ fontSize: 14 }}>{detaliu}</span>}
    </div>
  );
}

export function aCataAzi(scans: Scan[], s: Scan) {
  return scans.filter((x) => x.memberId === s.memberId && x.sec <= s.sec).length;
}

/**
 * Conținutul pop-up-ului. `vanzareInline` = pe ecranul cap-coadă,
 * „Creează abonament” deschide alegerea pe loc, nu profilul.
 */
export function CorpPopup({
  s,
  indiciu,
  vanzareInline,
  onProfil,
}: {
  s: Scan;
  indiciu?: boolean;
  vanzareInline?: boolean;
  onProfil?: () => void;
}) {
  const { getM, rezolva, respinge, set, go, vindeAbonament, st } = useDemo();
  const a = useAnim();
  const m = getM(s.memberId);
  const [confirmaRespingere, setConfirmaRespingere] = useState(false);
  const [vanzare, setVanzare] = useState(false);
  const [plan, setPlan] = useState("morning-12");
  const [metoda, setMetoda] = useState<Metoda>("card_fizic");
  const recurent = m.nrAbonamente > 0;
  const vandut = vanzareInline && s.status === "refuzat" && subsActive(m).length > 0;

  const deschideProfil = () => {
    if (onProfil) return onProfil();
    set({ openScan: null, profil: m.id });
    go("clienti");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <Avatar prenume={m.prenume} nume={m.nume} tint={m.tint} size={64} />
        <div className="min-w-0 flex-1">
          <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>
            {m.prenume} {m.nume}
          </p>
          <p style={{ fontFamily: MONO, fontSize: 12.5, color: C.text2 }}>#{m.cod}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {recurent ? <Chip ton="mov">RECURENT</Chip> : <Chip ton="auriu">NOU</Chip>}
            {s.metoda === "manual" && <Chip ton="neutru">MANUAL</Chip>}
          </div>
        </div>
        <Btn v="secundar" mic onClick={deschideProfil}>
          Profil
        </Btn>
      </div>

      {s.status === "consumat" && s.consum && (
        <>
          <Banner ton="activ" titlu="ACTIV" detaliu={`valabil până pe ${valabilPana(s.consum.exp)}`} />
          <div className={`flex items-start gap-3 rounded-[12px] ${a("fadeUp")}`} style={{ background: C.fActiv, padding: "12px 14px" }}>
            <span className={`flex size-[26px] shrink-0 items-center justify-center rounded-full ${a("pop")}`} style={{ background: C.succes }}>
              <Check size={15} color="#fff" strokeWidth={3} />
            </span>
            <div style={{ fontSize: 14.5 }}>
              <p>
                S-a consumat o ședință <b>{ETICHETA_TIP[s.consum.tip]}</b> pe „{s.consum.plan}” ·{" "}
                {s.consum.ramase === null ? "nelimitat" : `au rămas ${pluralSedinte(s.consum.ramase)}`}
              </p>
              <p style={{ fontSize: 13, color: C.text2 }}>
                {s.staff ? `${s.metoda === "manual" ? "Check-in manual făcut de" : "Confirmată de"} ${s.staff}` : "Consumată automat: abonament simplu, în interval"}
              </p>
            </div>
          </div>
        </>
      )}

      {s.status === "duplicat" && (
        <>
          <Banner ton="activ" titlu="ACTIV" detaliu="a intrat deja astăzi — a doua scanare nu consumă" />
          <p className="rounded-[12px]" style={{ background: C.fundal, border: `1px solid ${C.contur}`, padding: "12px 14px", fontSize: 14, color: C.text2 }}>
            Clientul a intrat deja astăzi, la {ora(st.intrati[m.id] ?? s.sec)}. A doua scanare doar anunță recepția, nu consumă încă o ședință.
          </p>
        </>
      )}

      {s.status === "in_asteptare" && (
        <>
          <Banner ton="activ" titlu="ACTIV" detaliu="așteaptă decizia recepției" />
          <div className="flex flex-col gap-2.5">
            {(s.optiuni ?? []).map((o) => (
              <div key={o.subId} className="flex flex-col gap-2 rounded-[12px]" style={{ border: `1px solid ${C.contur}`, padding: "12px 14px" }}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <strong style={{ fontSize: 15 }}>{o.plan}</strong>
                  <span style={{ fontSize: 13, color: C.text2 }}>
                    până pe {valabilPana(o.exp)} · încă {pluralZile(o.exp)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {o.contoare.map((c) => (
                    <ContorStaff key={c.tip} c={c} />
                  ))}
                </div>
                <div className="relative flex flex-wrap gap-2 pt-0.5">
                  {o.contoare
                    .filter((c) => c.ramase === null || c.ramase > 0)
                    .map((c) => (
                      <Btn key={c.tip} onClick={() => rezolva(s.id, o.subId, c.tip)}>
                        Consumă {ETICHETA_TIP[c.tip].toUpperCase()}
                      </Btn>
                    ))}
                  {indiciu && (
                    <span
                      className={`pointer-events-none flex items-center gap-1.5 self-center rounded-full px-2.5 py-1 ${a("nudge")}`}
                      style={{ background: C.mov, color: "#fff", fontSize: 12, fontWeight: 600 }}
                    >
                      <Hand size={13} /> Alege tu, ca recepționera
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            {confirmaRespingere ? (
              <>
                <Btn v="secundar" onClick={() => setConfirmaRespingere(false)}>
                  Nu, înapoi
                </Btn>
                <Btn v="periculos" onClick={() => respinge(s.id)}>
                  Da, respinge intrarea
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
            titlu={s.motiv === "abonament_expirat" ? "EXPIRAT" : "INACTIV"}
            detaliu={
              s.motiv === "abonament_expirat" && m.ultimulExpirat
                ? `„${m.ultimulExpirat.nume}” a expirat pe ${valabilPana(m.ultimulExpirat.exp)}`
                : s.motiv
                  ? TEXT_MOTIV[s.motiv]
                  : undefined
            }
          />
          {vandut ? (
            <p className={`flex items-center gap-2 rounded-[12px] ${a("fadeUp")}`} style={{ background: C.fActiv, color: C.succes, padding: "12px 14px", fontSize: 14, fontWeight: 500 }}>
              <Check size={17} strokeWidth={3} /> „{subsActive(m)[0].nume}” e activ. Clientul poate scana din nou.
            </p>
          ) : vanzareInline && vanzare ? (
            <div className={`flex flex-col gap-3 rounded-[12px] ${a("fadeUp")}`} style={{ border: `1px solid ${C.contur}`, padding: "12px 14px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>1. Alege abonamentul</p>
              <div className="flex flex-wrap gap-2">
                {["morning-12", "morning-u", "anytime-12", "anytime-u"].map((id) => {
                  const p = PLANURI.find((x) => x.id === id)!;
                  const on = id === plan;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPlan(id)}
                      className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${focus}`}
                      style={{ background: on ? C.fMov : C.card, color: on ? C.mov : C.text2, boxShadow: `inset 0 0 0 1.5px ${on ? C.mov : C.contur}` }}
                    >
                      {p.nume} · {p.pret} lei
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>2. Plata la recepție</p>
              <div className="flex gap-2">
                {(["card_fizic", "cash"] as Metoda[]).map((mt) => (
                  <button
                    key={mt}
                    type="button"
                    aria-pressed={metoda === mt}
                    onClick={() => setMetoda(mt)}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${focus}`}
                    style={{ background: metoda === mt ? C.fMov : C.card, color: metoda === mt ? C.mov : C.text2, boxShadow: `inset 0 0 0 1.5px ${metoda === mt ? C.mov : C.contur}` }}
                  >
                    {mt === "cash" ? "Cash" : "Card fizic"}
                  </button>
                ))}
              </div>
              <Btn onClick={() => vindeAbonament(m.id, plan, metoda)}>
                Creează abonamentul · {PLANURI.find((x) => x.id === plan)!.pret} lei
              </Btn>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
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
              <span style={{ fontSize: 13, color: C.text2 }}>{stareClient(m) === "expirat" ? "Reînnoirea durează două clicuri." : ""}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

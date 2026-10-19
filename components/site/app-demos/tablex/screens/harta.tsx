import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, List, Maximize, Minus, PencilRuler, Plus, Users, X } from "lucide-react";
import { useDemo } from "../ctx";
import {
  BUFFER,
  MASA_DUPA_ID,
  MESE,
  ZONE,
  activa,
  capacitate,
  conflict,
  fmtOra,
  meseRezervare,
  persoane,
  statusuriLa,
  type Rez,
  type ZonaId,
} from "../data";
import { BaraOrara, HartaSala, Legenda } from "../map";
import { AlegeActiuneMasa, Confirmare, FormRezervare, SheetRezervare, WalkInRapid, useActiuni } from "../rez";
import { ShellPanou } from "../shell";
import { D, L, TITLU, UMBRA } from "../theme";
import { Btn, BtnInchide, Chip, Modal, cx } from "../ui";

/* ============================================================
   Harta sălii (§8.4, §28) — ecranul-vedetă.
   Planul e ecranul: zonele, legenda și bara orară plutesc peste el,
   pe foi albe opace; lista zilei stă alături, ca mobilier.
   ============================================================ */

/** Muchia din stânga a rândului: singurul semnal care rezistă privirii periferice. */
const MUCHIE: Record<string, string> = {
  pending: L.expirare,
  confirmata: L.primary,
  sosita: L.liber,
};

/** Panourile de peste plan: foaie albă opacă, umbră mică, fără sticlă. */
const PANOU = { background: L.card, border: `1px solid ${L.border}`, boxShadow: UMBRA.sm } as const;

function TaburiZone({ zona, onZona, mic = false }: { zona: ZonaId; onZona: (z: ZonaId) => void; mic?: boolean }) {
  return (
    <div role="tablist" aria-label="Zona" className={cx("flex rounded-[12px] p-[3px]", mic ? "h-9" : "h-10")} style={PANOU}>
      {ZONE.map((z) => {
        const on = z.id === zona;
        return (
          <button
            key={z.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onZona(z.id)}
            className={cx(
              "rounded-[9px] font-medium transition-colors duration-150",
              mic ? "px-3 text-[14px]" : "px-4 text-[15px]",
              on ? "bg-[#efeeea] text-[#141413]" : "text-[#141413]/60 hover:text-[#141413]"
            )}
          >
            {z.nume}
          </button>
        );
      })}
    </div>
  );
}

/** Lista zilei, grupată după ce contează în tură: cine e în sală, cine urmează. */
function ListaZi({
  rez,
  acum,
  selectata,
  onAlege,
}: {
  rez: Rez[];
  acum: number;
  selectata: string | null;
  onAlege: (id: string) => void;
}) {
  const c = useDemo();
  const active = rez.filter(activa).sort((a, b) => a.start - b.start);
  const inSala = active.filter((r) => r.start <= acum && acum < r.start + r.dur + BUFFER);
  const urmeaza = active.filter((r) => r.start > acum);
  const incheiate = active.filter((r) => r.start + r.dur + BUFFER <= acum);

  const grup = (titlu: string, lista: Rez[]) =>
    lista.length > 0 && (
      <li>
        <p
          className="sticky top-0 z-[1] flex items-baseline gap-1.5 border-b px-4 py-1.5 text-[12px] font-semibold"
          style={{ background: L.bg, borderColor: L.border, color: L.fg }}
        >
          {titlu}
          <span className="font-normal" style={{ color: L.mutedFg }}>
            {lista.length}
          </span>
        </p>
        <ul>
          {lista.map((r) => {
            const walkIn = r.sursa === "walk_in";
            const m = r.masa ? MASA_DUPA_ID[r.masa] : null;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onAlege(r.id)}
                  className={cx(
                    "relative flex min-h-16 w-full items-center gap-2.5 border-b py-2 pl-4 pr-3 text-left transition-colors duration-150",
                    selectata === r.id ? "bg-[#efeeea]" : "hover:bg-[#efeeea]/50",
                    r.nou && !c.reducedMotion && "tx-anim-nou"
                  )}
                  style={{ borderColor: L.border }}
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: MUCHIE[r.status] ?? L.border }} />
                  <span className="w-11 shrink-0 text-[14px] font-semibold">{fmtOra(r.start)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{r.nume}</span>
                    <span className="block truncate text-[12px]" style={{ color: L.mutedFg }}>
                      {walkIn
                        ? "Walk-in"
                        : r.status === "pending"
                          ? r.masaDorita
                            ? `În așteptare · cere masa ${MASA_DUPA_ID[r.masaDorita]?.numar}`
                            : "În așteptare"
                          : r.status === "sosita"
                            ? "A sosit"
                            : "Confirmată"}
                      {r.eveniment ? " · Seară de jazz" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {m && <Chip>{m.grup ? "V1+2" : m.numar}</Chip>}
                    <span className="flex items-center gap-0.5 text-[12px]" style={{ color: L.mutedFg }}>
                      <Users size={12} aria-hidden />
                      {r.pers}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </li>
    );

  if (active.length === 0)
    return (
      <p className="p-4 text-[14px]" style={{ color: L.mutedFg }}>
        Nicio rezervare activă azi
      </p>
    );

  return (
    <ul className="tx-scroll min-h-0 flex-1 overflow-y-auto">
      {grup("Acum", inSala)}
      {grup("Urmează", urmeaza)}
      {grup("Încheiate azi", incheiate)}
    </ul>
  );
}

export function EcranHarta() {
  const c = useDemo();
  const a = useActiuni();
  const [zona, setZona] = useState<ZonaId>("salon");
  const [oraFixata, setOraFixata] = useState<number | null>(null);
  const afisata = oraFixata ?? c.acum;
  const { status, peMasa } = useMemo(() => statusuriLa(afisata, c.rez), [afisata, c.rez]);

  const [rezSel, setRezSel] = useState<string | null>(null);
  const [masaLibera, setMasaLibera] = useState<string | null>(null);
  const [form, setForm] = useState<{ masa: string | null; ora?: number } | null>(null);
  const [mutare, setMutare] = useState<string | null>(null);
  const [deMutat, setDeMutat] = useState<{ rezId: string; masa: string } | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [listaMobil, setListaMobil] = useState(false);

  const zonaObj = ZONE.find((z) => z.id === zona)!;
  const rezMutata = mutare ? c.rez.find((r) => r.id === mutare) : null;

  const eligibile = useMemo(() => {
    if (!rezMutata) return null;
    const s = new Set<string>();
    const proprii = meseRezervare(rezMutata);
    for (const m of MESE) {
      if (m.indisponibila || proprii.includes(m.id)) continue;
      if (!conflict(c.rez, m.id, rezMutata.start, rezMutata.dur, rezMutata.id)) {
        for (const id of meseRezervare({ masa: m.id })) s.add(id);
      }
    }
    return s;
  }, [rezMutata, c.rez]);

  const selectataPeHarta = rezSel
    ? (c.rez.find((r) => r.id === rezSel)?.masa ?? null)
    : masaLibera ?? (deMutat?.masa ?? null);

  const laMasa = (id: string) => {
    if (rezMutata) {
      setDeMutat({ rezId: rezMutata.id, masa: MASA_DUPA_ID[id]?.grup ? "V1" : id });
      return;
    }
    const r = peMasa[id];
    if (r) {
      setRezSel(r.id);
      return;
    }
    if (afisata < c.acum - 0.25) {
      c.toast({ tip: "info", text: "Ora afișată a trecut", desc: "Revino la ora curentă ca să așezi un walk-in." });
      return;
    }
    if (oraFixata !== null && afisata > c.acum + 0.25) {
      setForm({ masa: MASA_DUPA_ID[id]?.grup ? "V1" : id, ora: afisata });
      return;
    }
    setMasaLibera(MASA_DUPA_ID[id]?.grup ? "V1" : id);
  };

  const pornesteMutare = (rezId: string) => {
    setRezSel(null);
    setMutare(rezId);
  };

  // ocuparea la ora afișată
  const meseActive = MESE.filter((m) => !m.indisponibila);
  const ocupate = meseActive.filter((m) => status[m.id] && status[m.id] !== "liber").length;
  const inSala = Array.from(new Set(Object.values(peMasa))).reduce((s, r) => s + r.pers, 0);

  const bannerMutare = rezMutata && (
    <div className="flex items-center gap-3 rounded-[12px] px-3 py-2" style={PANOU} role="status">
      <ArrowLeftRight size={16} aria-hidden className="shrink-0" color={L.mutedFg} />
      <p className="min-w-0 flex-1 text-[14px] leading-snug">
        <span className="font-semibold">Alege masa nouă</span> pentru {rezMutata.nume} · {persoane(rezMutata.pers)}
      </p>
      <Btn v="outline" m="sm" onClick={() => setMutare(null)}>
        <X size={14} aria-hidden />
        Renunță
      </Btn>
    </div>
  );

  const dialoguri = (
    <>
      {rezSel && <SheetRezervare rezId={rezSel} onClose={() => setRezSel(null)} onMuta={pornesteMutare} />}
      {masaLibera && (
        <AlegeActiuneMasa
          masaId={masaLibera}
          onClose={() => setMasaLibera(null)}
          onRezervare={() => {
            setForm({ masa: masaLibera });
            setMasaLibera(null);
          }}
        />
      )}
      {form && <FormRezervare masaId={form.masa} ora={form.ora} onClose={() => setForm(null)} />}
      {walkIn && <WalkInRapid onClose={() => setWalkIn(false)} />}
      {deMutat &&
        (() => {
          const r = c.rez.find((x) => x.id === deMutat.rezId);
          if (!r) return null;
          const cap = capacitate(deMutat.masa);
          const numar = MASA_DUPA_ID[deMutat.masa]?.grup ? "V1 + V2" : MASA_DUPA_ID[deMutat.masa]?.numar;
          return (
            <Confirmare
              titlu={`Muți rezervarea pe masa ${numar}?`}
              descriere={
                <>
                  {r.nume} · {persoane(r.pers)} · {fmtOra(r.start)}
                  {cap < r.pers && (
                    <span className="mt-1 block font-medium" style={{ color: L.expirareText }}>
                      Masa are doar {cap} locuri.
                    </span>
                  )}
                </>
              }
              confirma="Mută rezervarea"
              onClose={() => setDeMutat(null)}
              onConfirm={() => {
                if (a.muta(r.id, deMutat.masa)) {
                  setMutare(null);
                  const m = MASA_DUPA_ID[deMutat.masa];
                  if (m && m.zona !== zona) setZona(m.zona);
                }
                setDeMutat(null);
              }}
            />
          );
        })()}
      {listaMobil && (
        <Modal onClose={() => setListaMobil(false)} eticheta="Rezervările de azi" tip="jos" reducedMotion={c.reducedMotion}>
          <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full" style={{ background: L.input }} />
          <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: L.border }}>
            <h2 className="text-[16px] font-semibold" style={TITLU}>
              Azi
            </h2>
            <BtnInchide onClick={() => setListaMobil(false)} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col pb-5" style={{ height: 560 }}>
            <ListaZi
              rez={c.rez}
              acum={c.acum}
              selectata={rezSel}
              onAlege={(id) => {
                setListaMobil(false);
                setRezSel(id);
                const m = c.rez.find((r) => r.id === id)?.masa;
                if (m) setZona(MASA_DUPA_ID[m].zona);
              }}
            />
          </div>
        </Modal>
      )}
    </>
  );

  const harta = (
    <HartaSala
      zona={zonaObj}
      statusuri={status}
      peMasa={peMasa}
      selectata={selectataPeHarta}
      onMasa={laMasa}
      eligibile={eligibile}
      onMuta={
        oraFixata === null
          ? (masaId: string) => {
              const r = peMasa[masaId];
              if (r) pornesteMutare(r.id);
            }
          : undefined
      }
      reducedMotion={c.reducedMotion}
      style={{ width: "100%", height: "100%" }}
    />
  );

  const nrActive = c.rez.filter(activa).length;

  if (c.mobil) {
    return (
      <ShellPanou
        ecran="harta"
        josMobil={
          <div className="flex shrink-0 gap-2 border-t px-3 pb-7 pt-2.5" style={{ background: L.card, borderColor: L.border }}>
            <Btn v="outline" m="lg" className="h-12 px-4" onClick={() => setListaMobil(true)} aria-label={`Rezervările de azi, ${nrActive}`}>
              <List size={18} aria-hidden />
              Azi
              <span className="text-[13px] font-normal opacity-70">{nrActive}</span>
            </Btn>
            <Btn m="lg" className="h-12 flex-1 text-[16px]" onClick={() => setWalkIn(true)}>
              <Plus size={18} aria-hidden />
              Walk-in
            </Btn>
          </div>
        }
      >
        <div className="tx-dark flex min-h-0 flex-1 flex-col" style={{ background: D.exterior }}>
          <div className="flex items-center gap-2 px-3 pt-3">
            <TaburiZone zona={zona} onZona={setZona} mic />
            <span
              className="ml-auto rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium"
              style={{ background: D.card, color: D.fg, border: `1px solid ${D.border}` }}
            >
              {ocupate} din {meseActive.length} ocupate
            </span>
          </div>
          <div className="px-3 pt-2.5">
            <BaraOrara acum={c.acum} afisata={afisata} urmareste={oraFixata === null} onSchimba={setOraFixata} marime="sm" />
          </div>
          {bannerMutare && <div className="px-3 pt-2.5">{bannerMutare}</div>}
          <HartaMobil zona={zonaObj.id}>{harta}</HartaMobil>
          <div className="px-3 pb-2.5 pt-1.5">
            <Legenda culoareText={D.mutedFg} marime={12} wrap />
          </div>
        </div>
        {dialoguri}
      </ShellPanou>
    );
  }

  return (
    <ShellPanou ecran="harta">
      <div className="flex min-h-0 flex-1">
        <div className="tx-dark relative flex min-w-0 flex-1 flex-col" style={{ background: D.exterior }}>
          <div className="flex flex-col gap-3 p-3">
            <div className="flex items-start gap-3">
              <TaburiZone zona={zona} onZona={setZona} />
              <div className="ml-auto flex h-10 items-center rounded-[12px] px-3" style={PANOU}>
                <Legenda culoareText={L.mutedFg} />
              </div>
            </div>
            <BaraOrara acum={c.acum} afisata={afisata} urmareste={oraFixata === null} onSchimba={setOraFixata} />
            {bannerMutare}
          </div>
          <div className="relative min-h-0 flex-1 px-3 pb-[64px]">{harta}</div>
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
            <p className="pointer-events-auto flex h-10 items-center gap-1.5 rounded-[12px] px-3.5 text-[14px]" style={{ ...PANOU, color: L.mutedFg }}>
              {oraFixata !== null && <span className="font-medium text-[#141413]">La {fmtOra(afisata)}</span>}
              {oraFixata !== null && <span aria-hidden>·</span>}
              <span>
                <strong className="font-semibold text-[#141413]">{ocupate}</strong> din {meseActive.length} mese ocupate
              </span>
              <span aria-hidden>·</span>
              <span>
                <strong className="font-semibold text-[#141413]">{inSala}</strong> persoane
              </span>
            </p>
            <div className="pointer-events-auto flex gap-2">
              <Btn
                v="outline"
                m="lg"
                className="shadow-[0_1px_2px_rgba(20,20,19,.06),0_1px_1px_rgba(20,20,19,.04)]"
                onClick={() => c.notify("În demo, planul sălii nu se poate edita.")}
              >
                <PencilRuler size={16} aria-hidden />
                Editează planul
              </Btn>
              <Btn m="lg" onClick={() => setWalkIn(true)}>
                <Plus size={16} aria-hidden />
                Walk-in
              </Btn>
            </div>
          </div>
        </div>

        <aside className="flex w-72 shrink-0 flex-col border-l" style={{ background: L.card, borderColor: L.border }}>
          <div className="flex shrink-0 items-baseline justify-between gap-2 border-b px-4 py-3" style={{ borderColor: L.border }}>
            <h2 className="text-[14px] font-semibold" style={TITLU}>
              Azi
            </h2>
            <span className="text-[12px]" style={{ color: L.mutedFg }}>
              {nrActive} rezervări
            </span>
          </div>
          <ListaZi
            rez={c.rez}
            acum={c.acum}
            selectata={rezSel}
            onAlege={(id) => {
              setRezSel(id);
              const m = c.rez.find((r) => r.id === id)?.masa;
              if (m) setZona(MASA_DUPA_ID[m].zona);
            }}
          />
        </aside>
      </div>
      {dialoguri}
    </ShellPanou>
  );
}

/** Pe telefon, planul se derulează în ambele direcții, cu zoom din butoane. */
function HartaMobil({ zona, children }: { zona: ZonaId; children: React.ReactNode }) {
  const z = ZONE.find((x) => x.id === zona)!;
  const cadru = useRef<HTMLDivElement>(null);
  const [inaltime, setInaltime] = useState(0);
  const [scara, setScara] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = cadru.current;
    if (!el) return;
    const masoara = () => setInaltime(el.clientHeight);
    masoara();
    const ro = new ResizeObserver(masoara);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const potrivit = inaltime ? (inaltime - 20) / z.h : 0.6;
  const latimeUtila = 390 - 24;
  const incadrat = latimeUtila / z.w;
  const s = scara ?? potrivit;
  const setS = (v: number) => setScara(Math.min(1.2, Math.max(incadrat, v)));
  const buton =
    "inline-flex h-8 items-center justify-center rounded-[8px] transition-colors duration-150 hover:bg-[#f1f0ec] disabled:opacity-40";

  return (
    <div className="relative mt-2.5 min-h-0 flex-1">
      <div ref={cadru} className="tx-scroll-dark absolute inset-0 overflow-auto px-3 pb-2" key={zona}>
        {inaltime > 0 && (
          <div style={{ width: z.w * s, height: z.h * s }} className="rounded-md">
            {children}
          </div>
        )}
      </div>
      <div className="absolute bottom-3 left-4 flex items-center gap-0.5 rounded-[12px] p-1" style={{ ...PANOU, color: L.fg }}>
        <button type="button" aria-label="Depărtează" disabled={s <= incadrat + 0.001} onClick={() => setS(s / 1.25)} className={cx(buton, "w-8")}>
          <Minus size={16} aria-hidden />
        </button>
        <span className="min-w-11 text-center text-[12px]" style={{ color: L.mutedFg }}>
          {Math.round(s * 100)}%
        </span>
        <button type="button" aria-label="Apropie" disabled={s >= 1.199} onClick={() => setS(s * 1.25)} className={cx(buton, "w-8")}>
          <Plus size={16} aria-hidden />
        </button>
        <button type="button" onClick={() => setScara(incadrat)} className={cx(buton, "gap-1 px-2 text-[13px] font-[550]")}>
          <Maximize size={14} aria-hidden />
          Încadrează
        </button>
      </div>
    </div>
  );
}

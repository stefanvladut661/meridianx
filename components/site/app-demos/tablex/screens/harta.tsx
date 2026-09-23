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
import { D, FONT, L } from "../theme";
import { Btn, Chip, Modal, BtnInchide, cx } from "../ui";

/* ============================================================
   Harta sălii (§8.4, §28) — ecranul-vedetă.
   Planul e ecranul: zonele, legenda și bara orară plutesc peste el,
   lista zilei stă alături, ca mobilier. Totul pe tema închisă.
   ============================================================ */

const MUCHIE: Record<string, string> = {
  pending: L.expirare,
  confirmata: L.primary,
  sosita: L.liber,
};

function TaburiZone({ zona, onZona, mic = false }: { zona: ZonaId; onZona: (z: ZonaId) => void; mic?: boolean }) {
  return (
    <div
      role="tablist"
      aria-label="Zona"
      className="flex rounded-xl p-1"
      style={{ background: "rgba(241,245,249,.94)", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }}
    >
      {ZONE.map((z) => {
        const on = z.id === zona;
        return (
          <button
            key={z.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onZona(z.id)}
            className={cx("rounded-lg font-medium transition-colors", mic ? "h-8 px-3 text-[13.5px]" : "h-8 px-4 text-[15px]")}
            style={{
              background: on ? "#fff" : "transparent",
              color: on ? L.fg : L.mutedFg,
              boxShadow: on ? "0 1px 3px rgba(15,23,42,.15)" : undefined,
            }}
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
          className="sticky top-0 z-[1] border-b px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
          style={{ background: "#f8fafc", borderColor: L.border, color: L.mutedFg }}
        >
          {titlu} · {lista.length}
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
                    "relative flex min-h-[60px] w-full items-center gap-2.5 border-b py-2 pl-4 pr-3 text-left transition-colors",
                    selectata === r.id ? "bg-[#eff6ff]" : "hover:bg-[#eff6ff]/60",
                    r.nou && !c.reducedMotion && "tx-anim-nou"
                  )}
                  style={{ borderColor: L.border }}
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: MUCHIE[r.status] ?? L.border }} />
                  <span className="w-11 shrink-0 text-[14px] font-semibold tabular-nums">{fmtOra(r.start)}</span>
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
                    <span className="flex items-center gap-0.5 text-[12px] tabular-nums" style={{ color: L.mutedFg }}>
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
      c.toast({ tip: "info", text: "Ora aleasă a trecut.", desc: "Revino la ora curentă ca să așezi un walk-in." });
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

  // statistici pentru ora afișată
  const meseActive = MESE.filter((m) => !m.indisponibila);
  const ocupate = meseActive.filter((m) => status[m.id] && status[m.id] !== "liber").length;
  const inSala = Array.from(new Set(Object.values(peMasa))).reduce((s, r) => s + r.pers, 0);
  const ocupare = Math.round((ocupate / meseActive.length) * 100);

  const bannerMutare = rezMutata && (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: "#1e3a8a", color: "#dbeafe", border: "1px solid #3b82f6" }}
      role="status"
    >
      <ArrowLeftRight size={16} aria-hidden className="shrink-0" />
      <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
        <strong className="font-semibold text-white">Alege masa nouă</strong> pentru {rezMutata.nume} · {persoane(rezMutata.pers)}. Mesele
        încercuite sunt libere în intervalul lor.
      </p>
      <button
        type="button"
        onClick={() => setMutare(null)}
        className="tx-btn-dark flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium"
        style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
      >
        <X size={14} aria-hidden />
        Renunță
      </button>
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
      {deMutat && (() => {
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
                    Atenție, masa are doar {cap} locuri.
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
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full" style={{ background: "#cbd5e1" }} />
          <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: L.border }}>
            <h2 className="text-[16px] font-semibold">Azi</h2>
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
              <span className="rounded-md px-1.5 text-[12px] font-semibold tabular-nums" style={{ background: L.secondary }}>
                {nrActive}
              </span>
            </Btn>
            <Btn m="lg" className="h-12 flex-1 text-[16px]" onClick={() => setWalkIn(true)}>
              <Plus size={20} aria-hidden />
              Walk-in
            </Btn>
          </div>
        }
      >
        <div className="tx-dark flex min-h-0 flex-1 flex-col" style={{ background: D.exterior }}>
          <div className="flex items-center gap-2 px-3 pt-3">
            <TaburiZone zona={zona} onZona={setZona} mic />
            <span className="ml-auto rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium tabular-nums" style={{ background: D.card, color: D.fg, border: `1px solid ${D.border}` }}>
              {ocupare}% ocupat
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
              <div className="ml-auto flex items-center gap-2">
                <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,.92)" }}>
                  <Legenda culoareText={L.mutedFg} />
                </div>
              </div>
            </div>
            <BaraOrara acum={c.acum} afisata={afisata} urmareste={oraFixata === null} onSchimba={setOraFixata} />
            {bannerMutare}
          </div>
          <div className="relative min-h-0 flex-1 px-3 pb-[60px]">{harta}</div>
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
            <div
              className="pointer-events-auto flex items-center gap-4 rounded-xl px-3.5 py-2 text-[13px]"
              style={{ background: D.card, border: `1px solid ${D.border}`, color: D.mutedFg }}
            >
              <span>
                {oraFixata === null ? "Acum" : `La ${fmtOra(afisata)}`}:{" "}
                <strong className="font-semibold tabular-nums" style={{ color: D.fg }}>
                  {ocupare}%
                </strong>{" "}
                ocupat
              </span>
              <span className="tabular-nums">
                <strong className="font-semibold" style={{ color: D.fg }}>
                  {ocupate}
                </strong>{" "}
                din {meseActive.length} mese
              </span>
              <span className="tabular-nums">
                <strong className="font-semibold" style={{ color: D.fg }}>
                  {inSala}
                </strong>{" "}
                persoane în sală
              </span>
            </div>
            <div className="pointer-events-auto flex gap-2">
              <button
                type="button"
                onClick={() =>
                  c.notify(
                    "În demo, planul sălii e blocat. În aplicația reală, managerul mută, unește și redimensionează mesele direct pe hartă."
                  )
                }
                className="flex h-10 items-center gap-2 rounded-lg px-3.5 text-[14px] font-medium hover:bg-white"
                style={{ background: "rgba(255,255,255,.9)", color: L.fg }}
              >
                <PencilRuler size={16} aria-hidden />
                Editează planul
              </button>
              <Btn m="md" className="h-10" onClick={() => setWalkIn(true)}>
                <Plus size={17} aria-hidden />
                Walk-in
              </Btn>
            </div>
          </div>
        </div>

        <aside className="flex w-72 shrink-0 flex-col border-l" style={{ background: L.card, borderColor: L.border }}>
          <div className="flex shrink-0 items-baseline justify-between gap-2 border-b px-4 py-3" style={{ borderColor: L.border }}>
            <h2 className="text-[15px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
              Azi
            </h2>
            <span className="text-[12.5px] tabular-nums" style={{ color: L.mutedFg }}>
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

  return (
    <div className="relative mt-2.5 min-h-0 flex-1">
      <div ref={cadru} className="tx-scroll-dark absolute inset-0 overflow-auto px-3 pb-2" key={zona}>
        {inaltime > 0 && (
          <div style={{ width: z.w * s, height: z.h * s }} className="rounded-md">
            {children}
          </div>
        )}
      </div>
      <div
        className="absolute bottom-3 left-4 flex items-center gap-0.5 rounded-xl p-1"
        style={{ background: "rgba(255,255,255,.94)", boxShadow: "0 4px 14px rgba(0,0,0,.35)" }}
      >
        <button
          type="button"
          aria-label="Depărtează"
          disabled={s <= incadrat + 0.001}
          onClick={() => setS(s / 1.25)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#f1f5f9] disabled:opacity-35"
        >
          <Minus size={16} aria-hidden />
        </button>
        <span className="min-w-11 text-center text-[12px] tabular-nums" style={{ color: L.mutedFg }}>
          {Math.round(s * 100)}%
        </span>
        <button
          type="button"
          aria-label="Apropie"
          disabled={s >= 1.199}
          onClick={() => setS(s * 1.25)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#f1f5f9] disabled:opacity-35"
        >
          <Plus size={16} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setScara(incadrat)}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium hover:bg-[#f1f5f9]"
        >
          <Maximize size={13} aria-hidden />
          Încadrează
        </button>
      </div>
    </div>
  );
}

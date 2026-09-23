import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Ban,
  CalendarPlus,
  Check,
  Inbox,
  LogIn,
  Plus,
  Search,
  StickyNote,
  TriangleAlert,
  UserX,
} from "lucide-react";
import { useDemo } from "../ctx";
import {
  BUFFER,
  MASA_DUPA_ID,
  MESE,
  ZI_AZI,
  ZONE,
  activa,
  capacitate,
  clientDupaId,
  conflict,
  fmtOra,
  numeZona,
  persoane,
  telMascat,
  type Rez,
  type StatusRez,
  DIACRITICE,
} from "../data";
import { Confirmare, FormRezervare, SheetRezervare, WalkInRapid, useActiuni } from "../rez";
import { ShellPanou, TitluPagina } from "../shell";
import { FONT, L } from "../theme";
import { BadgeStatus, Btn, Card, ETICHETA_SURSA, Segmented, cx, stilInput } from "../ui";

/* ============================================================
   Lista rezervări (§8.2, §26) — registrul operativ al zilei.
   Carduri cu toate acțiunile la vedere, tab-urile din spec și,
   alături, seara desenată pe mese (vederea zilei din Calendar).
   ============================================================ */

type Tab = "pending" | "confirmata" | "sosita" | "inchise";

const TABURI: { id: Tab; text: string; statusuri: StatusRez[] }[] = [
  { id: "pending", text: "În așteptare", statusuri: ["pending"] },
  { id: "confirmata", text: "Confirmate", statusuri: ["confirmata"] },
  { id: "sosita", text: "Sosite", statusuri: ["sosita"] },
  { id: "inchise", text: "Anulate / Neprezentat", statusuri: ["anulata", "no_show", "respinsa"] },
];

const tabPentru = (s: StatusRez): Tab => TABURI.find((t) => t.statusuri.includes(s))?.id ?? "pending";

function SelectMasa({ r }: { r: Rez }) {
  const c = useDemo();
  const a = useActiuni();
  const optiuni = MESE.filter((m) => !m.indisponibila && (!m.grup || m.id === "V1"));
  return (
    <select
      aria-label={`Masa pentru ${r.nume}`}
      value={r.masa ?? ""}
      onChange={(e) => {
        const id = e.target.value;
        if (!id) return;
        if (r.masa) a.muta(r.id, id);
        else a.aloca(r.id, id);
      }}
      style={{ ...stilInput, height: 30, width: c.mobil ? 118 : 132, fontSize: 12.5, padding: "0 6px" }}
    >
      {!r.masa && <option value="">Alocă masa…</option>}
      {ZONE.map((z) => (
        <optgroup key={z.id} label={z.nume}>
          {optiuni
            .filter((m) => m.zona === z.id)
            .map((m) => {
              const ocupata = m.id !== r.masa && conflict(c.rez, m.id, r.start, r.dur, r.id);
              return (
                <option key={m.id} value={m.id} disabled={Boolean(ocupata)}>
                  Masa {m.grup ? "V1+V2" : m.numar} · {capacitate(m.id)} loc.{ocupata ? " (ocupată)" : ""}
                </option>
              );
            })}
        </optgroup>
      ))}
    </select>
  );
}

function CardRezervare({
  r,
  evidentiat,
  onDetalii,
  onConfirmare,
}: {
  r: Rez;
  evidentiat: boolean;
  onDetalii: () => void;
  onConfirmare: (tip: "anulata" | "respinsa" | "no_show") => void;
}) {
  const c = useDemo();
  const [note, setNote] = useState(false);
  const [text, setText] = useState(r.noteInterne ?? "");
  const client = clientDupaId(r.clientId);
  const steag = client && client.noShow >= 2;
  const dorita = r.masaDorita ? MASA_DUPA_ID[r.masaDorita] : null;
  const zona = r.masa ? numeZona(MASA_DUPA_ID[r.masa].zona) : null;
  const esteActiva = activa(r);

  return (
    <li
      id={`tx-rez-${r.id}`}
      className={cx("grid gap-2 rounded-lg border p-3", (evidentiat || r.nou) && !c.reducedMotion && "tx-anim-nou")}
      style={{ background: L.card, borderColor: evidentiat ? "#93c5fd" : L.border }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[16px] font-semibold tabular-nums">{fmtOra(r.start)}</span>
            <button
              type="button"
              onClick={onDetalii}
              className="truncate text-left text-[14.5px] font-medium underline-offset-2 hover:underline"
            >
              {r.nume}
            </button>
            <BadgeStatus s={r.status} />
            {steag && (
              <span
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold"
                style={{ background: L.ocupatSoft, color: L.ocupatText }}
                title="Două sau mai multe neprezentări în istoric"
              >
                <TriangleAlert size={12} aria-hidden />
                {client.noShow} neprezentări
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px]" style={{ color: L.mutedFg }}>
            <span className="tabular-nums">{r.pers} pers.</span>
            <span className="tabular-nums">{telMascat(r.tel)}</span>
            {zona && <span>{zona}</span>}
            <span>{ETICHETA_SURSA[r.sursa]}</span>
            {dorita && r.masaDorita !== r.masa && <span style={{ color: L.primary }}>cere masa {dorita.numar}</span>}
          </p>
        </div>
        {esteActiva && !c.mobil && <SelectMasa r={r} />}
      </div>

      {r.nota && (
        <p className="rounded-md px-2 py-1 text-[12.5px]" style={{ background: L.muted }}>
          <span style={{ color: L.mutedFg }}>Nota clientului: </span>
          {r.nota}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {r.status === "pending" && (
          <>
            <Btn m="xs" onClick={() => c.schimbaStatus(r.id, "confirmata")}>
              <Check size={14} aria-hidden />
              Acceptă
            </Btn>
            <Btn m="xs" v="outline" onClick={() => onConfirmare("respinsa")}>
              Respinge
            </Btn>
          </>
        )}
        {(r.status === "confirmata" || r.status === "pending") && (
          <Btn m="xs" v="secondary" onClick={() => c.schimbaStatus(r.id, "sosita")}>
            <LogIn size={14} aria-hidden />
            Sosit
          </Btn>
        )}
        {esteActiva && r.status !== "pending" && (
          <>
            <Btn m="xs" v="outline" onClick={() => onConfirmare("no_show")}>
              <UserX size={14} aria-hidden />
              Neprezentat
            </Btn>
            <Btn m="xs" v="ghost" onClick={() => onConfirmare("anulata")}>
              <Ban size={14} aria-hidden />
              Anulează
            </Btn>
          </>
        )}
        {esteActiva && r.masa && !c.mobil && (
          <Btn m="xs" v="ghost" onClick={onDetalii}>
            <ArrowLeftRight size={14} aria-hidden />
            Detalii
          </Btn>
        )}
        <Btn m="xs" v="ghost" aria-expanded={note} onClick={() => setNote((n) => !n)}>
          <StickyNote size={14} aria-hidden />
          Note{r.noteInterne ? " · 1" : ""}
        </Btn>
        {esteActiva && c.mobil && (
          <span className="ml-auto">
            <SelectMasa r={r} />
          </span>
        )}
      </div>

      {note && (
        <div className="grid gap-1.5 border-t pt-2" style={{ borderColor: L.border }}>
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Note interne — vizibile doar personalului."
            aria-label={`Note interne pentru ${r.nume}`}
            className="w-full resize-none rounded-lg border px-2.5 py-2 text-[13px]"
            style={{ borderColor: L.border }}
          />
          <div className="flex justify-end gap-2">
            <Btn
              m="xs"
              v="ghost"
              onClick={() => {
                setText(r.noteInterne ?? "");
                setNote(false);
              }}
            >
              Renunță
            </Btn>
            <Btn
              m="xs"
              disabled={text === (r.noteInterne ?? "")}
              onClick={() => {
                c.setRez((xs) => xs.map((x) => (x.id === r.id ? { ...x, noteInterne: text.trim() || undefined } : x)));
                c.toast({ tip: "succes", text: "Nota a fost salvată." });
                setNote(false);
              }}
            >
              Salvează nota
            </Btn>
          </div>
        </div>
      )}
    </li>
  );
}

/* ---------- seara pe mese (Gantt) ---------- */

const DE_LA = 17;
const PANA_LA = 24;
const STIL_BARA: Record<string, { bg: string; bd: string; fg: string }> = {
  pending: { bg: L.expirareSoft, bd: L.expirare, fg: L.fg },
  confirmata: { bg: L.liberSoft, bd: L.liber, fg: L.fg },
  sosita: { bg: L.liber, bd: L.liber, fg: L.liberFg },
  eveniment: { bg: L.evenimentSoft, bd: L.eveniment, fg: "#4c1d95" },
};

function SearaPeMese({ onAlege, inaltimeRand = 22 }: { onAlege: (id: string) => void; inaltimeRand?: number }) {
  const c = useDemo();
  const randuri = MESE.filter((m) => !m.indisponibila && (!m.grup || m.id === "V1"));
  const pct = (h: number) => `${((Math.min(Math.max(h, DE_LA), PANA_LA) - DE_LA) / (PANA_LA - DE_LA)) * 100}%`;
  const ore = Array.from({ length: PANA_LA - DE_LA + 1 }, (_, i) => DE_LA + i);
  const active = c.rez.filter((r) => activa(r) && r.masa && r.start + r.dur > DE_LA);
  const fara = c.rez.filter((r) => activa(r) && !r.masa && r.start + r.dur > c.acum).length;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center" style={{ height: 22, paddingLeft: 44 }}>
        <div className="relative h-full flex-1">
          {ore.map((h) => (
            <span
              key={h}
              className="absolute top-0 -translate-x-1/2 text-[11px] tabular-nums"
              style={{ left: pct(h), color: L.mutedFg }}
            >
              {h === 24 ? "" : `${h}`}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        {/* grila orelor + linia „acum” */}
        <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: 44 }} aria-hidden>
          {ore.map((h) => (
            <span key={h} className="absolute inset-y-0 w-px" style={{ left: pct(h), background: L.border }} />
          ))}
          <span className="absolute inset-y-0 z-[2] w-0.5" style={{ left: pct(c.acum), background: L.primary }} />
          <span
            className="absolute -top-[21px] z-[2] -translate-x-1/2 rounded px-1 text-[10.5px] font-semibold tabular-nums text-white"
            style={{ left: pct(c.acum), background: L.primary }}
          >
            {fmtOra(c.acum)}
          </span>
        </div>
        {randuri.map((m, i) => {
          const pe = active.filter((r) => r.masa === m.id || (m.grup && MASA_DUPA_ID[r.masa!]?.grup === m.grup));
          const primaTerasa = m.zona === "terasa" && randuri[i - 1]?.zona === "salon";
          return (
            <div
              key={m.id}
              className="flex items-center"
              style={{ height: inaltimeRand, borderTop: primaTerasa ? `1px dashed ${L.border}` : undefined }}
            >
              <span className="w-11 shrink-0 pr-2 text-right text-[12px] font-semibold tabular-nums" style={{ color: L.mutedFg }}>
                {m.grup ? "V1+2" : m.numar}
              </span>
              <div className="relative h-full flex-1">
                {pe.map((r) => {
                  const st = STIL_BARA[r.eveniment ? "eveniment" : r.status];
                  const w = ((Math.min(r.start + r.dur, PANA_LA) - Math.max(r.start, DE_LA)) / (PANA_LA - DE_LA)) * 100;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onAlege(r.id)}
                      title={`${r.nume} · ${fmtOra(r.start)}–${fmtOra(r.start + r.dur)}`}
                      aria-label={`${r.nume}, masa ${m.numar}, ${fmtOra(r.start)}–${fmtOra(r.start + r.dur)}`}
                      className="absolute top-[3px] z-[1] flex items-center overflow-hidden rounded-[5px] px-1.5 text-left text-[11px] font-medium hover:brightness-95"
                      style={{
                        left: pct(r.start),
                        width: `calc(${w}% - 2px)`,
                        height: inaltimeRand - 6,
                        background: st.bg,
                        color: st.fg,
                        border: `1px solid ${st.bd}`,
                      }}
                    >
                      <span className="truncate">{r.nume.replace("Walk-in masa ", "Walk-in ")}</span>
                    </button>
                  );
                })}
                {pe.map((r) => (
                  <span
                    key={`b-${r.id}`}
                    aria-hidden
                    className="absolute top-[3px]"
                    style={{
                      left: pct(r.start + r.dur),
                      width: `${(BUFFER / (PANA_LA - DE_LA)) * 100}%`,
                      height: inaltimeRand - 6,
                      backgroundImage: "repeating-linear-gradient(135deg, rgba(100,116,139,.22) 0 3px, transparent 3px 6px)",
                      borderRadius: 4,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px]" style={{ color: L.mutedFg, paddingLeft: 44 }}>
        {[
          ["În așteptare", STIL_BARA.pending],
          ["Confirmată", STIL_BARA.confirmata],
          ["Sosită", STIL_BARA.sosita],
          ["Eveniment", STIL_BARA.eveniment],
        ].map(([t, s]) => (
          <span key={t as string} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: (s as typeof STIL_BARA.pending).bg, border: `1px solid ${(s as typeof STIL_BARA.pending).bd}` }} />
            {t as string}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-sm"
            style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(100,116,139,.35) 0 3px, transparent 3px 6px)" }}
          />
          Debarasare
        </span>
        {fara > 0 && <span style={{ color: L.expirareText }}>· {fara} fără masă</span>}
      </div>
    </div>
  );
}

/* ---------- ecranul ---------- */

export function EcranRezervari() {
  const c = useDemo();
  const evidentiata = c.rezEvidentiata ? c.rez.find((r) => r.id === c.rezEvidentiata) : null;
  const [tab, setTab] = useState<Tab>(evidentiata ? tabPentru(evidentiata.status) : "pending");
  const [cauta, setCauta] = useState("");
  const [sort, setSort] = useState<"ora" | "nume">("ora");
  const [vedere, setVedere] = useState<"lista" | "mese">("lista");
  const [detalii, setDetalii] = useState<string | null>(null);
  const [confirmare, setConfirmare] = useState<{ id: string; tip: "anulata" | "respinsa" | "no_show" } | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [form, setForm] = useState(false);
  const lista = useRef<HTMLUListElement>(null);
  const idEvidentiat = useRef(c.rezEvidentiata);

  useEffect(() => {
    const id = idEvidentiat.current;
    if (!id) return;
    document.getElementById(`tx-rez-${id}`)?.scrollIntoView({ block: "center" });
    const t = window.setTimeout(() => c.evidentiaza(null), 2600);
    return () => window.clearTimeout(t);
    // doar la deschidere: evidențierea vine dintr-o notificare sau din pagina publică
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const numarPe = useMemo(() => {
    const n: Record<Tab, number> = { pending: 0, confirmata: 0, sosita: 0, inchise: 0 };
    for (const r of c.rez) n[tabPentru(r.status)] += 1;
    return n;
  }, [c.rez]);

  const vizibile = useMemo(() => {
    const t = TABURI.find((x) => x.id === tab)!;
    const q = cauta
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(DIACRITICE, "");
    const cifre = q.replace(/\D/g, "");
    return c.rez
      .filter((r) => t.statusuri.includes(r.status))
      .filter((r) => {
        if (!q) return true;
        const n = r.nume.toLowerCase().normalize("NFD").replace(DIACRITICE, "");
        return n.includes(q) || (cifre.length >= 3 && (r.tel ?? "").includes(cifre));
      })
      .sort((a, b) => (sort === "ora" ? a.start - b.start : a.nume.localeCompare(b.nume, "ro")));
  }, [c.rez, tab, cauta, sort]);

  const cautare = (
    <div className="relative" style={{ width: c.mobil ? "100%" : 240 }}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" color={L.mutedFg} aria-hidden />
      <input
        type="search"
        value={cauta}
        onChange={(e) => setCauta(e.target.value)}
        placeholder="Caută după nume sau telefon"
        aria-label="Caută după nume sau telefon"
        style={{ ...stilInput, height: 36, paddingLeft: 34, fontSize: 13.5 }}
      />
    </div>
  );

  const taburi = (
    <div role="tablist" aria-label="Filtru rezervări" className="tx-fara-bara flex min-h-[38px] shrink-0 gap-1 overflow-x-auto rounded-lg p-[3px]" style={{ background: L.muted }}>
      {TABURI.map((t) => {
        const on = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setTab(t.id)}
            className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-medium"
            style={{
              background: on ? L.card : "transparent",
              color: on ? L.fg : L.mutedFg,
              boxShadow: on ? "0 1px 2px rgba(15,23,42,.1)" : undefined,
            }}
          >
            {t.text}
            <span
              className="rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
              style={{
                lineHeight: "17px",
                background: t.id === "pending" && numarPe.pending ? L.expirare : on ? L.secondary : "rgba(15,23,42,.06)",
                color: t.id === "pending" && numarPe.pending ? L.expirareFg : L.secondaryFg,
              }}
            >
              {numarPe[t.id]}
            </span>
          </button>
        );
      })}
    </div>
  );

  const carduri =
    vizibile.length === 0 ? (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center" style={{ borderColor: L.border }}>
        <Inbox size={28} color={L.mutedFg} aria-hidden />
        <p className="text-[14.5px] font-medium">
          {cauta ? `Niciun rezultat pentru „${cauta}”.` : tab === "pending" ? "Nicio cerere în așteptare." : "Nimic aici încă."}
        </p>
        <p className="max-w-sm text-[13px]" style={{ color: L.mutedFg }}>
          {cauta
            ? "Caută după nume sau după ultimele cifre ale telefonului."
            : tab === "pending"
              ? "Cererile noi din pagina publică apar aici, live. Un oaspete venit pe ușă se înregistrează cu Walk-in."
              : "Rezervările trec aici pe măsură ce le marchezi."}
        </p>
        {!cauta && (
          <Btn m="sm" v="outline" className="mt-1" onClick={() => setWalkIn(true)}>
            <Plus size={15} aria-hidden />
            Adaugă un walk-in
          </Btn>
        )}
      </div>
    ) : (
      <ul ref={lista} className="grid gap-2">
        {vizibile.map((r) => (
          <CardRezervare
            key={r.id}
            r={r}
            evidentiat={r.id === c.rezEvidentiata}
            onDetalii={() => setDetalii(r.id)}
            onConfirmare={(tip) => setConfirmare({ id: r.id, tip })}
          />
        ))}
      </ul>
    );

  const deConfirmat = confirmare ? c.rez.find((r) => r.id === confirmare.id) : null;
  const dialoguri = (
    <>
      {detalii && <SheetRezervare rezId={detalii} onClose={() => setDetalii(null)} />}
      {walkIn && <WalkInRapid onClose={() => setWalkIn(false)} />}
      {form && <FormRezervare onClose={() => setForm(false)} />}
      {confirmare && deConfirmat && (
        <Confirmare
          titlu={
            confirmare.tip === "anulata"
              ? "Anulezi rezervarea?"
              : confirmare.tip === "respinsa"
                ? "Respingi cererea?"
                : "Marchezi ca neprezentat?"
          }
          descriere={
            confirmare.tip === "no_show"
              ? `${deConfirmat.nume} nu a ajuns. Neprezentarea intră în fișa clientului; de la două încolo, numărul primește semnalul roșu.`
              : `${deConfirmat.nume} · ${persoane(deConfirmat.pers)} · ${fmtOra(deConfirmat.start)}. Oaspetele e anunțat automat.`
          }
          confirma={confirmare.tip === "anulata" ? "Anulează" : confirmare.tip === "respinsa" ? "Respinge" : "Neprezentat"}
          distructiv={confirmare.tip !== "no_show"}
          onClose={() => setConfirmare(null)}
          onConfirm={() => {
            c.schimbaStatus(confirmare.id, confirmare.tip);
            setConfirmare(null);
          }}
        />
      )}
    </>
  );

  if (c.mobil) {
    return (
      <ShellPanou
        ecran="rezervari"
        josMobil={
          <div className="flex shrink-0 gap-2 border-t px-3 pb-7 pt-2.5" style={{ background: L.card, borderColor: L.border }}>
            <Btn v="outline" m="lg" className="h-12 flex-1" onClick={() => setForm(true)}>
              <CalendarPlus size={18} aria-hidden />
              Rezervare
            </Btn>
            <Btn m="lg" className="h-12 flex-1 text-[16px]" onClick={() => setWalkIn(true)}>
              <Plus size={20} aria-hidden />
              Walk-in
            </Btn>
          </div>
        }
      >
        <div className="tx-scroll grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-4">
          <TitluPagina titlu="Lista rezervări" sub={`${ZI_AZI} · se actualizează live`} />
          {cautare}
          <Segmented
            eticheta="Vedere"
            value={vedere}
            onChange={setVedere}
            optiuni={[
              { id: "lista", text: "Listă" },
              { id: "mese", text: "Seara pe mese" },
            ]}
            className="w-full"
          />
          {vedere === "lista" ? (
            <>
              {taburi}
              {carduri}
            </>
          ) : (
            <Card className="p-3">
              <SearaPeMese onAlege={setDetalii} inaltimeRand={24} />
            </Card>
          )}
        </div>
        {dialoguri}
      </ShellPanou>
    );
  }

  return (
    <ShellPanou ecran="rezervari">
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <TitluPagina titlu="Lista rezervări" sub={`${ZI_AZI} · se actualizează live`}>
          {cautare}
          <Segmented
            eticheta="Sortare"
            value={sort}
            onChange={setSort}
            optiuni={[
              { id: "ora", text: "Oră" },
              { id: "nume", text: "Nume" },
            ]}
          />
          <Btn v="outline" onClick={() => setForm(true)}>
            <CalendarPlus size={16} aria-hidden />
            Rezervare nouă
          </Btn>
          <Btn onClick={() => setWalkIn(true)}>
            <Plus size={17} aria-hidden />
            Walk-in
          </Btn>
        </TitluPagina>
        <div className="grid min-h-0 flex-1 gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 440px" }}>
          <div className="flex min-h-0 flex-col gap-3">
            {taburi}
            <div className="tx-scroll -mr-2 min-h-0 flex-1 overflow-y-auto pr-2">{carduri}</div>
          </div>
          <Card className="flex min-h-0 flex-col p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
                Seara pe mese
              </h2>
              <span className="text-[12px]" style={{ color: L.mutedFg }}>
                17:00 – 24:00 · clic pe o rezervare
              </span>
            </div>
            <div className="tx-scroll min-h-0 flex-1 overflow-y-auto">
              <SearaPeMese onAlege={setDetalii} />
            </div>
          </Card>
        </div>
      </div>
      {dialoguri}
    </ShellPanou>
  );
}

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Ban,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Clock,
  EyeOff,
  LayoutGrid,
  LogIn,
  MessageCircle,
  MessageSquare,
  Phone,
  Timer,
  TriangleAlert,
  UserX,
  Users,
  Zap,
} from "lucide-react";
import { useDemo } from "./ctx";
import {
  DURATA_IMPLICITA,
  MASA_DUPA_ID,
  MESE,
  ZI_AZI,
  ZONE,
  activa,
  capacitate,
  clientDupaId,
  conflict,
  fmtOra,
  idClient,
  meseRezervare,
  numeZona,
  oraWalkIn,
  persoane,
  statusuriLa,
  telMascat,
  urmatoareaPeMasa,
  type Rez,
  type ZonaId,
} from "./data";
import { HartaSala } from "./map";
import { D, FONT, L } from "./theme";
import {
  BadgeStatus,
  Btn,
  BtnInchide,
  ETICHETA_SURSA,
  Modal,
  Segmented,
  Stepper,
  cx,
  stilInput,
} from "./ui";

/* ============================================================
   Piesele comune ale rezervărilor: fișa din dreapta (SheetRezervare),
   cele două pătrate mari de pe masa liberă (AlegeActiuneMasa),
   formularul de rezervare și walk-in-ul cu harta în miniatură.
   ============================================================ */

/* ---------- acțiunile, cu regulile din produs ---------- */

export function useActiuni() {
  const c = useDemo();

  const eroareSuprapunere = (masaId: string, alta: Rez) => {
    c.toast({
      tip: "eroare",
      text: `Masa ${MASA_DUPA_ID[masaId]?.numar ?? masaId} este deja ocupată în intervalul ales.`,
      desc: `${alta.nume}, ${fmtOra(alta.start)}–${fmtOra(alta.start + alta.dur)} · buffer-ul de 15 minute inclus.`,
    });
  };

  return {
    walkIn(masaId: string, pers: number): Rez | null {
      const start = oraWalkIn(c.acum);
      const alta = conflict(c.rez, masaId, start, DURATA_IMPLICITA);
      if (alta) return alta;
      const numar = MASA_DUPA_ID[masaId]?.numar ?? masaId;
      c.adaugaRez({
        nume: `Walk-in masa ${numar}`,
        pers,
        start,
        dur: DURATA_IMPLICITA,
        masa: masaId,
        status: "sosita",
        sursa: "walk_in",
      });
      c.toast({ tip: "succes", text: `Masa ${numar} e ocupată.`, desc: `Walk-in · ${persoane(pers)} · de la ${fmtOra(start)}` });
      return null;
    },
    muta(rezId: string, masaId: string) {
      const r = c.rez.find((x) => x.id === rezId);
      if (!r) return false;
      const alta = conflict(c.rez, masaId, r.start, r.dur, r.id);
      if (alta) {
        eroareSuprapunere(masaId, alta);
        return false;
      }
      c.setRez((xs) => xs.map((x) => (x.id === rezId ? { ...x, masa: masaId } : x)));
      c.toast({ tip: "succes", text: `Rezervarea a trecut pe masa ${MASA_DUPA_ID[masaId]?.numar ?? masaId}.` });
      return true;
    },
    prelungeste(rezId: string) {
      const r = c.rez.find((x) => x.id === rezId);
      if (!r?.masa) return;
      const alta = conflict(c.rez, r.masa, r.start, r.dur + 0.5, r.id);
      if (alta) {
        c.toast({
          tip: "eroare",
          text: "Nu se poate prelungi: urmează altă rezervare.",
          desc: `${alta.nume} are masa de la ${fmtOra(alta.start)}. Mută una dintre rezervări pe altă masă.`,
        });
        return;
      }
      c.setRez((xs) => xs.map((x) => (x.id === rezId ? { ...x, dur: x.dur + 0.5 } : x)));
      c.toast({ tip: "succes", text: "Masa rămâne ocupată încă 30 de minute.", desc: `Până la ${fmtOra(r.start + r.dur + 0.5)}.` });
    },
    aloca(rezId: string, masaId: string) {
      const r = c.rez.find((x) => x.id === rezId);
      if (!r) return false;
      const alta = conflict(c.rez, masaId, r.start, r.dur, r.id);
      if (alta) {
        eroareSuprapunere(masaId, alta);
        return false;
      }
      c.setRez((xs) => xs.map((x) => (x.id === rezId ? { ...x, masa: masaId } : x)));
      c.toast({ tip: "succes", text: `Masa ${MASA_DUPA_ID[masaId]?.numar} alocată.`, desc: `${r.nume} · ${fmtOra(r.start)}` });
      return true;
    },
  };
}

/** Mesele libere pentru un interval, cele potrivite ca mărime primele. */
export function meseLibere(rez: Rez[], start: number, dur: number, pers: number, exceptId?: string) {
  return MESE.filter((m) => !m.indisponibila && (!m.grup || m.id === MESE.find((x) => x.grup === m.grup)?.id))
    .filter((m) => !conflict(rez, m.id, start, dur, exceptId))
    .map((m) => ({ m, cap: capacitate(m.id) }))
    .sort((a, b) => {
      const pa = a.cap >= pers ? 0 : 1;
      const pb = b.cap >= pers ? 0 : 1;
      return pa - pb || a.cap - b.cap || a.m.numar.localeCompare(b.m.numar, "ro", { numeric: true });
    });
}

/* ---------- dialog de confirmare (§24.7) ---------- */

export function Confirmare({
  titlu,
  descriere,
  confirma,
  distructiv = false,
  onConfirm,
  onClose,
}: {
  titlu: string;
  descriere: ReactNode;
  confirma: string;
  distructiv?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const c = useDemo();
  return (
    <Modal onClose={onClose} eticheta={titlu} latime={c.mobil ? 350 : 400} reducedMotion={c.reducedMotion}>
      <div className="grid gap-2 p-5">
        <h2 className="text-[17px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
          {titlu}
        </h2>
        <div className="text-[14px] leading-relaxed" style={{ color: L.mutedFg }}>
          {descriere}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-5 pb-5">
        <Btn v="outline" m="lg" onClick={onClose} data-autofocus>
          Renunță
        </Btn>
        <Btn v={distructiv ? "destructive" : "primary"} m="lg" onClick={onConfirm}>
          {confirma}
        </Btn>
      </div>
    </Modal>
  );
}

/* ---------- fișa rezervării (SheetRezervare) ---------- */

function Caseta({
  eticheta,
  icon,
  children,
  avertisment = false,
}: {
  eticheta: string;
  icon: ReactNode;
  children: ReactNode;
  avertisment?: boolean;
}) {
  return (
    <div
      className="min-w-0 rounded-xl p-3"
      style={{ background: L.muted, borderLeft: avertisment ? "2px solid rgba(15,23,42,.25)" : undefined }}
    >
      <h3 className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: L.mutedFg }}>
        {icon}
        {eticheta}
      </h3>
      <div className="mt-1.5 text-[14px]">{children}</div>
    </div>
  );
}

function Cifra({ eticheta, icon, valoare, detaliu }: { eticheta: string; icon: ReactNode; valoare: ReactNode; detaliu?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl px-3 py-2.5" style={{ background: L.muted }}>
      <p className="flex items-center gap-1.5 text-[12px]" style={{ color: L.mutedFg }}>
        {icon}
        {eticheta}
      </p>
      <p className="mt-0.5 truncate text-[18px] font-semibold leading-tight tabular-nums">{valoare}</p>
      {detaliu && (
        <p className="mt-0.5 truncate text-[12px]" style={{ color: L.mutedFg }}>
          {detaliu}
        </p>
      )}
    </div>
  );
}

export function SheetRezervare({
  rezId,
  onClose,
  onMuta,
}: {
  rezId: string;
  onClose: () => void;
  /** Pornește mutarea pe hartă (clic pe masa nouă). */
  onMuta?: (rezId: string) => void;
}) {
  const c = useDemo();
  const a = useActiuni();
  const r = c.rez.find((x) => x.id === rezId);
  const [note, setNote] = useState(r?.noteInterne ?? "");
  const [deConfirmat, setDeConfirmat] = useState<null | "anulata" | "no_show" | "respinsa">(null);
  const [masaNoua, setMasaNoua] = useState("");

  const libere = useMemo(() => (r ? meseLibere(c.rez, r.start, r.dur, r.pers, r.id) : []), [c.rez, r]);

  if (!r) return null;
  const client = clientDupaId(r.clientId);
  const editare = client ? c.editari[client.id] : undefined;
  const taguri = editare?.taguri ?? client?.taguri ?? [];
  const masa = r.masa ? MASA_DUPA_ID[r.masa] : null;
  const dorita = r.masaDorita ? MASA_DUPA_ID[r.masaDorita] : null;
  const esteActiva = activa(r);
  const iconSize = 14;

  const schimba = (s: "confirmata" | "sosita" | "anulata" | "no_show" | "respinsa") => {
    c.schimbaStatus(r.id, s);
  };

  return (
    <Modal
      onClose={onClose}
      eticheta={`Rezervarea ${r.nume}`}
      tip={c.mobil ? "jos" : "dreapta"}
      latime={420}
      reducedMotion={c.reducedMotion}
    >
      {c.mobil && <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full" style={{ background: "#cbd5e1" }} />}
      <div className="flex shrink-0 items-start gap-2 border-b px-4 pb-4 pt-3" style={{ borderColor: L.border }}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <BadgeStatus s={r.status} />
            <span className="text-[12px]" style={{ color: L.mutedFg }}>
              {ETICHETA_SURSA[r.sursa]}
            </span>
          </div>
          <h2 className="mt-1.5 break-words text-[20px] font-semibold leading-tight tracking-tight" style={{ fontFamily: FONT.display }}>
            {r.nume}
          </h2>
          <p className="text-[13px]" style={{ color: L.mutedFg }}>
            {ZI_AZI}
          </p>
        </div>
        <BtnInchide onClick={onClose} />
      </div>

      <div className={c.mobil ? "tx-scroll min-h-0 flex-1 overflow-y-auto" : "contents"}>
      <div className={c.mobil ? "flex flex-col gap-3 p-4" : "tx-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"}>
        <div className="rounded-xl px-3 py-2.5" style={{ background: L.muted }}>
          <p className="flex items-center gap-1.5 text-[12px]" style={{ color: L.mutedFg }}>
            <Clock size={iconSize} aria-hidden />
            Interval
          </p>
          <p className="mt-0.5 text-[24px] font-semibold leading-tight tabular-nums">
            {fmtOra(r.start)} – {fmtOra(r.start + r.dur)}
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: L.mutedFg }}>
            {r.dur.toLocaleString("ro-RO")} h, plus 15 minute de debarasare
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Cifra eticheta="Persoane" icon={<Users size={iconSize} aria-hidden />} valoare={r.pers} />
          <Cifra
            eticheta="Masa"
            icon={<LayoutGrid size={iconSize} aria-hidden />}
            valoare={masa ? (masa.grup ? "V1 + V2" : masa.numar) : "Nealocată"}
            detaliu={masa ? `${numeZona(masa.zona)} · ${capacitate(masa.id)} locuri` : dorita ? `cere masa ${dorita.numar}` : "o aloci din listă"}
          />
        </div>

        {r.tel ? (
          <button
            type="button"
            onClick={() =>
              c.notify("În demo nu se sună nicăieri. În aplicația reală, butonul deschide apelul direct de pe telefonul ospătarului.")
            }
            className="flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left hover:bg-[#f1f5f9]"
            style={{ borderColor: L.border }}
          >
            <Phone size={16} color={L.mutedFg} aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium tabular-nums">{telMascat(r.tel)}</span>
            <span className="text-[12px]" style={{ color: L.mutedFg }}>
              Sună
            </span>
          </button>
        ) : (
          <p
            className="flex items-center gap-2.5 rounded-xl border border-dashed px-3 py-2 text-[13.5px]"
            style={{ borderColor: L.border, color: L.mutedFg }}
          >
            <Phone size={16} aria-hidden />
            Fără telefon — {r.sursa === "walk_in" ? "a intrat de pe stradă" : "rezervare de grup"}
          </p>
        )}

        {client && (
          <div
            className="rounded-xl border p-3"
            style={{
              borderColor: client.noShow >= 2 ? "#fca5a5" : L.border,
              background: client.noShow >= 2 ? L.ocupatSoft : L.card,
            }}
          >
            {client.noShow >= 2 && (
              <p className="mb-2 flex items-start gap-2 text-[13px] font-medium" style={{ color: L.ocupatText }}>
                <TriangleAlert size={15} className="mt-px shrink-0" aria-hidden />
                {client.noShow} neprezentări în istoric. Decizia rămâne a ta — rezervarea nu se blochează automat.
              </p>
            )}
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px]" style={{ color: L.mutedFg }}>
                  Fișa clientului
                </p>
                <p className="text-[14px] font-medium tabular-nums">
                  {client.vizite} vizite · {client.noShow} {client.noShow === 1 ? "neprezentare" : "neprezentări"}
                </p>
                {taguri.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {taguri.map((t) => (
                      <span key={t} className="rounded-md px-1.5 py-0.5 text-[11.5px] font-medium" style={{ background: L.accent, color: L.accentFg }}>
                        {t}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              <Btn v="outline" m="sm" onClick={() => c.deschideClient(client.id)}>
                Deschide
                <ChevronRight size={14} aria-hidden />
              </Btn>
            </div>
          </div>
        )}

        {r.nota && (
          <Caseta eticheta="Nota clientului" icon={<MessageSquare size={iconSize} aria-hidden />}>
            {r.nota}
          </Caseta>
        )}

        {esteActiva && !r.masa && (
          <Caseta eticheta="Alocă o masă" icon={<LayoutGrid size={iconSize} aria-hidden />}>
            <div className="flex gap-2">
              <select
                aria-label="Masa de alocat"
                value={masaNoua || (dorita && libere.some((x) => x.m.id === dorita.id) ? dorita.id : "")}
                onChange={(e) => setMasaNoua(e.target.value)}
                style={{ ...stilInput, height: 36, fontSize: 13.5 }}
              >
                <option value="">Alege o masă liberă…</option>
                {libere.map(({ m, cap }) => (
                  <option key={m.id} value={m.id}>
                    Masa {m.grup ? "V1 + V2" : m.numar} · {cap} locuri · {numeZona(m.zona)}
                    {cap < r.pers ? " (prea mică)" : ""}
                    {dorita?.id === m.id ? " — cerută de client" : ""}
                  </option>
                ))}
              </select>
              <Btn
                m="sm"
                className="h-9"
                disabled={!(masaNoua || (dorita && libere.some((x) => x.m.id === dorita.id)))}
                onClick={() => {
                  const id = masaNoua || dorita?.id;
                  if (id && a.aloca(r.id, id)) setMasaNoua("");
                }}
              >
                Alocă
              </Btn>
            </div>
          </Caseta>
        )}

        <Caseta eticheta="Note interne — doar pentru personal" icon={<EyeOff size={iconSize} aria-hidden />}>
          <textarea
            aria-label="Note interne"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: preferă colțul liniștit, vine cu un scaun de copil."
            className="w-full resize-none rounded-lg border bg-white px-2.5 py-2 text-[13.5px]"
            style={{ borderColor: L.border }}
          />
          {note !== (r.noteInterne ?? "") && (
            <div className="mt-1.5 flex justify-end">
              <Btn
                m="xs"
                onClick={() => {
                  c.setRez((xs) => xs.map((x) => (x.id === r.id ? { ...x, noteInterne: note.trim() || undefined } : x)));
                  c.toast({ tip: "succes", text: "Nota a fost salvată." });
                }}
              >
                Salvează nota
              </Btn>
            </div>
          )}
        </Caseta>
      </div>

      {esteActiva && (
        <div
          className={cx("grid shrink-0 gap-2 border-t p-4", c.mobil && "pb-7")}
          style={{ borderColor: L.border }}
        >
          {r.status === "pending" && (
            <div className="grid grid-cols-2 gap-2">
              <Btn m="lg" onClick={() => schimba("confirmata")}>
                <Check size={16} aria-hidden />
                Confirmă
              </Btn>
              <Btn m="lg" v="outline" onClick={() => setDeConfirmat("respinsa")}>
                <Ban size={16} aria-hidden />
                Respinge
              </Btn>
            </div>
          )}
          {(r.status === "confirmata" || r.status === "pending") && (
            <Btn m="lg" v="secondary" onClick={() => schimba("sosita")}>
              <LogIn size={16} aria-hidden />
              Marchează sosit
            </Btn>
          )}
          {r.masa && (
            <div className="grid grid-cols-2 gap-2">
              {onMuta && (
                <Btn m="lg" v="outline" onClick={() => onMuta(r.id)}>
                  <ArrowLeftRight size={16} aria-hidden />
                  Mută pe altă masă
                </Btn>
              )}
              <Btn m="lg" v="outline" onClick={() => a.prelungeste(r.id)} className={onMuta ? undefined : "col-span-2"}>
                <Timer size={16} aria-hidden />
                Prelungește 30 min
              </Btn>
            </div>
          )}
          {r.status === "confirmata" && r.tel && (
            <Btn
              m="lg"
              v="outline"
              onClick={() =>
                c.notify("În demo, mesajul WhatsApp nu pleacă. În aplicația reală, oaspetele îl primește imediat și se consumă un credit.")
              }
            >
              <MessageCircle size={16} aria-hidden />
              Anunță întârziere scurtă
            </Btn>
          )}
          {r.status !== "pending" && (
            <div className="mt-1 grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: L.border }}>
              <Btn m="lg" v="ghost" onClick={() => setDeConfirmat("no_show")}>
                <UserX size={16} aria-hidden />
                Neprezentat
              </Btn>
              <Btn m="lg" v="destructive" onClick={() => setDeConfirmat("anulata")}>
                <Ban size={16} aria-hidden />
                Anulează
              </Btn>
            </div>
          )}
        </div>
      )}
      </div>

      {deConfirmat && (
        <Confirmare
          titlu={
            deConfirmat === "anulata"
              ? "Anulezi rezervarea?"
              : deConfirmat === "respinsa"
                ? "Respingi cererea?"
                : "Marchezi ca neprezentat?"
          }
          descriere={
            deConfirmat === "no_show"
              ? `${r.nume} nu a ajuns. Neprezentarea intră în fișa clientului; de la două încolo, numărul primește semnalul roșu.`
              : `${r.nume} · ${persoane(r.pers)} · ${fmtOra(r.start)}. Masa se eliberează imediat pe hartă.`
          }
          confirma={deConfirmat === "anulata" ? "Anulează" : deConfirmat === "respinsa" ? "Respinge" : "Neprezentat"}
          distructiv={deConfirmat !== "no_show"}
          onClose={() => setDeConfirmat(null)}
          onConfirm={() => {
            schimba(deConfirmat);
            setDeConfirmat(null);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

/* ---------- masa liberă: walk-in sau rezervare (AlegeActiuneMasa) ---------- */

export function AlegeActiuneMasa({
  masaId,
  onClose,
  onRezervare,
}: {
  masaId: string;
  onClose: () => void;
  onRezervare: () => void;
}) {
  const c = useDemo();
  const a = useActiuni();
  const m = MASA_DUPA_ID[masaId];
  const [pers, setPers] = useState(Math.min(capacitate(masaId), 4));
  const [eroare, setEroare] = useState<Rez | null>(null);
  const [agitare, setAgitare] = useState(0);
  const urm = urmatoareaPeMasa(c.rez, masaId, c.acum);
  const latura = c.mobil ? 158 : 208;

  const schimba = (d: number) => setPers((n) => Math.min(20, Math.max(1, n + d)));

  return (
    <Modal onClose={onClose} eticheta={`Masa ${m.numar}`} latime={c.mobil ? 366 : 520} reducedMotion={c.reducedMotion}>
      <div className="flex items-start justify-between gap-2 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-[21px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
            Masa {m.grup ? "V1 + V2" : m.numar}
            <span className="ml-2 text-[15px] font-normal" style={{ color: L.mutedFg }}>
              {capacitate(masaId)} locuri · {numeZona(m.zona)}
            </span>
          </h2>
          <p className="mt-0.5 text-[13px]" style={{ color: L.mutedFg }}>
            {urm
              ? `Următoarea rezervare: ${fmtOra(urm.start)} · ${urm.nume}, ${persoane(urm.pers)}`
              : "Liberă până la închidere."}
          </p>
        </div>
        <BtnInchide onClick={onClose} />
      </div>

      <div className="grid grid-cols-2 gap-4 p-5" style={{ gap: c.mobil ? 12 : 16 }}>
        <div
          className="relative flex select-none flex-col items-center justify-center gap-2 rounded-2xl p-3"
          style={{ height: latura, background: L.walkinSoft, color: L.walkinFg }}
        >
          {/* Pătratul întreg e ținta; reglajul de persoane stă deasupra lui,
              ca frați, nu în interior — un buton în alt buton nu e HTML valid. */}
          <button
            type="button"
            data-autofocus
            aria-label={`Așază walk-in la masa ${m.numar}, ${persoane(pers)}`}
            onClick={() => {
              const alta = a.walkIn(masaId, pers);
              if (alta) {
                setEroare(alta);
                setAgitare((n) => n + 1);
              } else onClose();
            }}
            className="absolute inset-0 rounded-2xl transition-colors hover:bg-[#10b981]/10 active:bg-[#10b981]/20"
          />
          <Zap size={c.mobil ? 32 : 42} aria-hidden className="pointer-events-none relative" />
          <span className="pointer-events-none relative text-[22px] font-bold tracking-tight" style={{ fontFamily: FONT.display }}>
            Walk-in
          </span>
          <span className="relative flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Mai puține persoane"
              onClick={() => schimba(-1)}
              className="grid place-content-center rounded-xl hover:bg-[#10b981]/35"
              style={{ width: 38, height: 38, background: "rgba(16,185,129,.2)" }}
            >
              <ChevronDown size={20} aria-hidden />
            </button>
            <span className="pointer-events-none min-w-8 text-center text-[28px] font-bold tabular-nums" aria-live="polite">
              {pers}
            </span>
            <button
              type="button"
              aria-label="Mai multe persoane"
              onClick={() => schimba(1)}
              className="grid place-content-center rounded-xl hover:bg-[#10b981]/35"
              style={{ width: 38, height: 38, background: "rgba(16,185,129,.2)" }}
            >
              <ChevronUp size={20} aria-hidden />
            </button>
          </span>
          <span className="pointer-events-none relative text-[13px] opacity-80">persoane</span>
        </div>

        <button
          type="button"
          onClick={onRezervare}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl p-3 transition-transform active:scale-[0.98]"
          style={{ height: latura, background: L.rezervareSoft, color: L.rezervareFg }}
        >
          <CalendarPlus size={c.mobil ? 32 : 42} aria-hidden />
          <span className="text-[22px] font-bold tracking-tight" style={{ fontFamily: FONT.display }}>
            Rezervare
          </span>
          <span className="max-w-40 text-center text-[13px] opacity-80">Cu nume, oră și număr de persoane</span>
        </button>
      </div>

      {eroare && (
        <p
          key={agitare}
          role="alert"
          className={cx("mx-5 -mt-1 mb-5 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px]", !c.reducedMotion && "tx-anim-shake")}
          style={{ background: L.ocupatSoft, color: L.ocupatText }}
        >
          <CircleAlert size={16} className="mt-px shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Masa este deja ocupată în intervalul ales.</strong> {eroare.nume} are masa de la{" "}
            {fmtOra(eroare.start)}, iar un walk-in ține 2 ore. Alege altă masă sau fă o rezervare mai scurtă.
          </span>
        </p>
      )}
    </Modal>
  );
}

/* ---------- formularul de rezervare (DialogRezervareTactil) ---------- */

export function FormRezervare({
  masaId: masaInitiala = null,
  ora: oraInitiala,
  numeInitial = "",
  telInitial = "",
  onClose,
}: {
  masaId?: string | null;
  ora?: number;
  /** Deschis din fișa unui client: numele și telefonul vin completate. */
  numeInitial?: string;
  telInitial?: string;
  onClose: () => void;
}) {
  const c = useDemo();
  const primaOra = Math.ceil((c.acum + 0.01) * 4) / 4;
  const ore: number[] = [];
  for (let h = primaOra; h <= 22.5; h += 0.25) ore.push(h);
  const [nume, setNume] = useState(numeInitial);
  const [tel, setTel] = useState(telInitial);
  const [ora, setOra] = useState(oraInitiala && oraInitiala >= primaOra ? Math.round(oraInitiala * 4) / 4 : Math.ceil(primaOra * 2) / 2);
  const [pers, setPers] = useState(masaInitiala ? Math.min(capacitate(masaInitiala), 4) : 2);
  const [dur, setDur] = useState<"1.5" | "2" | "2.5" | "3">("2");
  const [masaId, setMasaId] = useState<string>(masaInitiala ?? "");
  const [sursa, setSursa] = useState<"telefon" | "manual">("telefon");
  const [erori, setErori] = useState<{ nume?: string; tel?: string; masa?: string }>({});
  const [incercare, setIncercare] = useState(0);

  const durata = Number(dur);
  const optiuniMese = MESE.filter((m) => !m.indisponibila && (!m.grup || m.id === "V1"));

  const trimite = () => {
    const e: typeof erori = {};
    if (nume.trim().length < 2) e.nume = "Scrie numele clientului — așa îl găsești în listă.";
    const cifre = tel.replace(/\D/g, "");
    if (tel.trim() && !/^07\d{8}$/.test(cifre)) e.tel = "Numărul are 10 cifre și începe cu 07.";
    let alta: Rez | null = null;
    if (masaId) alta = conflict(c.rez, masaId, ora, durata);
    if (alta)
      e.masa = `Masa este deja ocupată în intervalul ales: ${alta.nume}, ${fmtOra(alta.start)}–${fmtOra(alta.start + alta.dur)} (buffer-ul de 15 minute inclus).`;
    setErori(e);
    setIncercare((n) => n + 1);
    if (Object.keys(e).length) return;
    c.adaugaRez({
      nume: nume.trim(),
      tel: cifre || undefined,
      pers,
      start: ora,
      dur: durata,
      masa: masaId || null,
      status: "confirmata",
      sursa,
      clientId: numeInitial && nume.trim() === numeInitial ? idClient(numeInitial) : idClient(nume.trim()),
    });
    c.toast({
      tip: "succes",
      text: "Rezervare creată.",
      desc: `${nume.trim()} · ${persoane(pers)} · ${fmtOra(ora)}${masaId ? ` · masa ${MASA_DUPA_ID[masaId].grup ? "V1 + V2" : MASA_DUPA_ID[masaId].numar}` : ""}`,
    });
    onClose();
  };

  const shake = !c.reducedMotion && incercare > 0 ? "tx-anim-shake" : undefined;

  return (
    <Modal
      onClose={onClose}
      eticheta="Rezervare nouă"
      tip={c.mobil ? "jos" : "centru"}
      latime={500}
      reducedMotion={c.reducedMotion}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b px-5 py-4" style={{ borderColor: L.border }}>
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
            Rezervare nouă
          </h2>
          <p className="text-[13px]" style={{ color: L.mutedFg }}>
            {ZI_AZI} · se confirmă direct
          </p>
        </div>
        <BtnInchide onClick={onClose} />
      </div>

      <form
        className="tx-scroll grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          trimite();
        }}
        noValidate
      >
        <div className={cx("grid gap-3", !c.mobil && "grid-cols-2")}>
          <div className="grid gap-1.5">
            <label htmlFor="tx-nume" className="text-[13px] font-medium">
              Numele clientului
            </label>
            <input
              id="tx-nume"
              data-autofocus
              value={nume}
              onChange={(e) => setNume(e.target.value)}
              placeholder="Ex.: Ioana Marin"
              aria-invalid={Boolean(erori.nume)}
              aria-describedby={erori.nume ? "tx-nume-err" : undefined}
              key={erori.nume ? `n${incercare}` : "n"}
              className={erori.nume ? shake : undefined}
              style={{ ...stilInput, borderColor: erori.nume ? L.destructive : L.border }}
            />
            {erori.nume && (
              <p id="tx-nume-err" className="flex items-center gap-1 text-[12.5px]" style={{ color: L.ocupatText }}>
                <TriangleAlert size={13} aria-hidden />
                {erori.nume}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="tx-tel" className="text-[13px] font-medium">
              Telefon <span style={{ color: L.mutedFg, fontWeight: 400 }}>(opțional)</span>
            </label>
            <input
              id="tx-tel"
              inputMode="tel"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              placeholder="07xx xxx xxx"
              aria-invalid={Boolean(erori.tel)}
              aria-describedby={erori.tel ? "tx-tel-err" : undefined}
              key={erori.tel ? `t${incercare}` : "t"}
              className={erori.tel ? shake : undefined}
              style={{ ...stilInput, borderColor: erori.tel ? L.destructive : L.border }}
            />
            {erori.tel && (
              <p id="tx-tel-err" className="flex items-center gap-1 text-[12.5px]" style={{ color: L.ocupatText }}>
                <TriangleAlert size={13} aria-hidden />
                {erori.tel}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-1.5">
          <p className="text-[13px] font-medium" id="tx-ora">
            Ora
          </p>
          <div role="group" aria-labelledby="tx-ora" className="tx-fara-bara -mx-1 flex min-h-[38px] gap-1.5 overflow-x-auto px-1 pb-0.5">
            {ore.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={h === ora}
                onClick={() => setOra(h)}
                className="h-9 shrink-0 rounded-lg px-3 text-[13.5px] font-medium tabular-nums"
                style={{
                  background: h === ora ? L.primary : L.muted,
                  color: h === ora ? "#fff" : L.fg,
                }}
              >
                {fmtOra(h)}
              </button>
            ))}
          </div>
        </div>

        <div className={cx("grid gap-4", !c.mobil && "grid-cols-2")}>
          <div className="grid gap-1.5">
            <p className="text-[13px] font-medium">Persoane</p>
            <Stepper value={pers} onChange={setPers} eticheta="Persoane" />
          </div>
          <div className="grid gap-1.5">
            <p className="text-[13px] font-medium">Durata</p>
            <Segmented
              eticheta="Durata"
              value={dur}
              onChange={setDur}
              optiuni={[
                { id: "1.5", text: "1,5 h" },
                { id: "2", text: "2 h" },
                { id: "2.5", text: "2,5 h" },
                { id: "3", text: "3 h" },
              ]}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="tx-masa" className="text-[13px] font-medium">
            Masa
          </label>
          <select
            id="tx-masa"
            value={masaId}
            onChange={(e) => setMasaId(e.target.value)}
            aria-invalid={Boolean(erori.masa)}
            style={{ ...stilInput, borderColor: erori.masa ? L.destructive : L.border }}
          >
            <option value="">Fără masă — o aloci mai târziu</option>
            {ZONE.map((z) => (
              <optgroup key={z.id} label={z.nume}>
                {optiuniMese
                  .filter((m) => m.zona === z.id)
                  .map((m) => {
                    const ocupata = conflict(c.rez, m.id, ora, durata);
                    return (
                      <option key={m.id} value={m.id}>
                        Masa {m.grup ? "V1 + V2" : m.numar} · {capacitate(m.id)} locuri
                        {ocupata ? ` — ocupată (${ocupata.nume}, ${fmtOra(ocupata.start)})` : ""}
                      </option>
                    );
                  })}
              </optgroup>
            ))}
          </select>
          {erori.masa && (
            <p
              key={`m${incercare}`}
              role="alert"
              className={cx("flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[12.5px]", shake)}
              style={{ color: L.ocupatText, background: L.ocupatSoft }}
            >
              <CircleAlert size={14} className="mt-px shrink-0" aria-hidden />
              {erori.masa}
            </p>
          )}
          {masaId && capacitate(masaId) < pers && !erori.masa && (
            <p className="text-[12.5px]" style={{ color: L.expirareText }}>
              Atenție: masa are doar {capacitate(masaId)} locuri.
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <p className="text-[13px] font-medium">Cum a venit rezervarea</p>
          <Segmented
            eticheta="Sursa rezervării"
            value={sursa}
            onChange={setSursa}
            optiuni={[
              { id: "telefon", text: "La telefon" },
              { id: "manual", text: "În persoană" },
            ]}
            className="w-full"
          />
        </div>
      </form>

      <div className={cx("grid shrink-0 grid-cols-2 gap-2 border-t px-5 py-4", c.mobil && "pb-7")} style={{ borderColor: L.border }}>
        <Btn v="outline" m="lg" onClick={onClose}>
          Renunță
        </Btn>
        <Btn m="lg" onClick={trimite}>
          Salvează rezervarea
        </Btn>
      </div>
    </Modal>
  );
}

/* ---------- butonul master „+ Walk-in” (§25.6): harta în miniatură ---------- */

export function WalkInRapid({ onClose }: { onClose: () => void }) {
  const c = useDemo();
  const a = useActiuni();
  const [pers, setPers] = useState(2);
  const [zona, setZona] = useState<ZonaId>("salon");
  const start = oraWalkIn(c.acum);
  const { status } = useMemo(() => statusuriLa(c.acum, c.rez), [c.acum, c.rez]);
  const eligibile = useMemo(() => {
    const s = new Set<string>();
    for (const m of MESE) {
      if (m.indisponibila || m.zona !== zona) continue;
      if (capacitate(m.id) < pers) continue;
      if (conflict(c.rez, m.id, start, DURATA_IMPLICITA)) continue;
      for (const id of meseRezervare({ masa: m.id })) s.add(id);
    }
    return s;
  }, [c.rez, pers, zona, start]);
  const zonaObj = ZONE.find((z) => z.id === zona)!;
  const totalLibere = MESE.filter(
    (m) => !m.indisponibila && capacitate(m.id) >= pers && !conflict(c.rez, m.id, start, DURATA_IMPLICITA)
  ).length;

  return (
    <Modal
      onClose={onClose}
      eticheta="Walk-in"
      tip={c.mobil ? "jos" : "centru"}
      latime={640}
      reducedMotion={c.reducedMotion}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 px-5 pt-4">
        <div>
          <h2 className="text-[19px] font-semibold tracking-tight" style={{ fontFamily: FONT.display }}>
            Walk-in
          </h2>
          <p className="text-[13px]" style={{ color: L.mutedFg }}>
            Câte persoane? Apoi atinge masa pe hartă.
          </p>
        </div>
        <BtnInchide onClick={onClose} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3">
        <Stepper value={pers} onChange={setPers} eticheta="Persoane" mare />
        <Segmented
          eticheta="Zona"
          value={zona}
          onChange={setZona}
          optiuni={ZONE.map((z) => ({ id: z.id, text: z.nume }))}
        />
      </div>
      <div className={cx("px-5 pt-3", c.mobil ? "pb-8" : "pb-5")}>
        <div className="tx-dark overflow-hidden rounded-lg" style={{ background: D.exterior, border: `1px solid ${D.border}` }}>
          <HartaSala
            zona={zonaObj}
            statusuri={status}
            eligibile={eligibile}
            onMasa={(id) => {
              if (!a.walkIn(id, pers)) onClose();
            }}
            reducedMotion={c.reducedMotion}
            style={{ width: "100%", height: "auto", aspectRatio: `${zonaObj.w} / ${zonaObj.h}` }}
          />
        </div>
        <p className="mt-2.5 text-[13px]" style={{ color: totalLibere ? L.mutedFg : L.ocupatText }}>
          {totalLibere
            ? eligibile.size
              ? `Mesele încercuite sunt libere pentru ${persoane(pers)}, de acum până la ${fmtOra(start + DURATA_IMPLICITA)}.`
              : `Nicio masă potrivită aici. Încearcă ${zona === "salon" ? "Terasa" : "Salonul"}.`
            : "Nu există mese libere momentan."}
        </p>
      </div>
    </Modal>
  );
}

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
import { D, L, TITLU, UMBRA } from "./theme";
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

const numarMasa = (id: string) => (MASA_DUPA_ID[id]?.grup ? "V1 + V2" : (MASA_DUPA_ID[id]?.numar ?? id));

/* ---------- acțiunile, cu regulile din produs ---------- */

export function useActiuni() {
  const c = useDemo();

  const eroareSuprapunere = (masaId: string, alta: Rez) => {
    c.toast({
      tip: "eroare",
      text: `Masa ${numarMasa(masaId)} e ocupată în intervalul ales`,
      desc: `${alta.nume} o are ${fmtOra(alta.start)}–${fmtOra(alta.start + alta.dur)}, plus 15 min debarasare. Alege altă masă.`,
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
      c.toast({ tip: "succes", text: `Masa ${numarMasa(masaId)} e ocupată`, desc: `Walk-in, ${persoane(pers)}, de la ${fmtOra(start)}` });
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
      c.toast({ tip: "succes", text: `Rezervare mutată pe masa ${numarMasa(masaId)}`, desc: `${r.nume}, ${fmtOra(r.start)}` });
      return true;
    },
    prelungeste(rezId: string) {
      const r = c.rez.find((x) => x.id === rezId);
      if (!r?.masa) return;
      const alta = conflict(c.rez, r.masa, r.start, r.dur + 0.5, r.id);
      if (alta) {
        c.toast({
          tip: "eroare",
          text: "Nu se poate prelungi",
          desc: `${alta.nume} are masa de la ${fmtOra(alta.start)}. Mută una dintre rezervări pe altă masă.`,
        });
        return;
      }
      c.setRez((xs) => xs.map((x) => (x.id === rezId ? { ...x, dur: x.dur + 0.5 } : x)));
      c.toast({ tip: "succes", text: "Rezervare prelungită", desc: `Masa ${numarMasa(r.masa)} rămâne ocupată până la ${fmtOra(r.start + r.dur + 0.5)}` });
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
      c.toast({ tip: "succes", text: `Masa ${numarMasa(masaId)} alocată`, desc: `${r.nume}, ${fmtOra(r.start)}` });
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
    <Modal onClose={onClose} eticheta={titlu} latime={c.mobil ? 350 : 384} reducedMotion={c.reducedMotion}>
      <div className="grid gap-2 p-5">
        <h2 className="text-[16px] font-semibold leading-snug" style={TITLU}>
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

/** Textele dialogurilor de confirmare, aceleași din listă și din fișă. */
export function textConfirmare(tip: "anulata" | "respinsa" | "no_show", r: Rez) {
  const rezumat = `${r.nume} · ${persoane(r.pers)} · ${fmtOra(r.start)}.`;
  if (tip === "no_show")
    return { titlu: "Marchezi ca neprezentat?", descriere: `${rezumat} Neprezentarea intră în fișa clientului.`, confirma: "Marchează neprezentat" };
  if (tip === "respinsa")
    return {
      titlu: "Respingi cererea?",
      descriere: r.tel ? `${rezumat} Oaspetele primește mesaj pe WhatsApp.` : rezumat,
      confirma: "Respinge cererea",
    };
  return {
    titlu: "Anulezi rezervarea?",
    descriere: r.tel ? `${rezumat} Oaspetele primește mesaj pe WhatsApp.` : `${rezumat} Masa se eliberează pe hartă.`,
    confirma: "Anulează rezervarea",
  };
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
  /** Nota internă: marcată cu muchie, ca nimeni s-o citească oaspetelui cu voce tare. */
  avertisment?: boolean;
}) {
  return (
    <section
      className="min-w-0 rounded-[12px] p-3"
      style={{ background: L.muted, borderLeft: avertisment ? "2px solid rgba(20,20,19,.25)" : undefined }}
    >
      <h3 className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color: L.mutedFg }}>
        {icon}
        {eticheta}
      </h3>
      <div className="mt-1.5 break-words text-[14px]">{children}</div>
    </section>
  );
}

function Cifra({ eticheta, icon, valoare, detaliu }: { eticheta: string; icon: ReactNode; valoare: ReactNode; detaliu?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[12px] px-3 py-2.5" style={{ background: L.muted }}>
      <p className="flex items-center gap-1.5 text-[12px]" style={{ color: L.mutedFg }}>
        {icon}
        {eticheta}
      </p>
      <p className="mt-0.5 truncate text-[18px] font-semibold leading-tight">{valoare}</p>
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
  const confirmare = deConfirmat ? textConfirmare(deConfirmat, r) : null;

  return (
    <Modal
      onClose={onClose}
      eticheta={`Rezervarea ${r.nume}`}
      tip={c.mobil ? "jos" : "dreapta"}
      latime={420}
      reducedMotion={c.reducedMotion}
    >
      {c.mobil && <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full" style={{ background: L.input }} />}
      <div className="flex shrink-0 items-start gap-2 border-b px-4 pb-4 pt-3" style={{ borderColor: L.border }}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <BadgeStatus s={r.status} />
            <span className="text-[12px]" style={{ color: L.mutedFg }}>
              {ETICHETA_SURSA[r.sursa]}
            </span>
          </div>
          <h2 className="mt-2 break-words text-[20px] font-semibold leading-tight" style={TITLU}>
            {r.nume}
          </h2>
          <p className="mt-0.5 text-[14px]" style={{ color: L.mutedFg }}>
            {ZI_AZI}
          </p>
        </div>
        <BtnInchide onClick={onClose} />
      </div>

      <div className={c.mobil ? "tx-scroll min-h-0 flex-1 overflow-y-auto" : "contents"}>
        <div className={c.mobil ? "flex flex-col gap-3 p-4" : "tx-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"}>
          <div className="rounded-[12px] px-3 py-2.5" style={{ background: L.muted }}>
            <p className="flex items-center gap-1.5 text-[12px]" style={{ color: L.mutedFg }}>
              <Clock size={iconSize} aria-hidden />
              Interval
            </p>
            <p className="mt-0.5 text-[24px] font-semibold leading-tight">
              {fmtOra(r.start)} – {fmtOra(r.start + r.dur)}
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: L.mutedFg }}>
              +15 min debarasare
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Cifra eticheta="Persoane" icon={<Users size={iconSize} aria-hidden />} valoare={r.pers} />
            <Cifra
              eticheta="Masa"
              icon={<LayoutGrid size={iconSize} aria-hidden />}
              valoare={masa ? numarMasa(masa.id) : "Nealocată"}
              detaliu={masa ? `${numeZona(masa.zona)} · ${capacitate(masa.id)} locuri` : dorita ? `cere masa ${dorita.numar}` : undefined}
            />
          </div>

          {r.tel ? (
            <button
              type="button"
              onClick={() => c.notify("În demo nu se sună.")}
              className="flex min-h-11 items-center gap-2.5 rounded-[12px] border px-3 py-2 text-left transition-colors duration-150 hover:bg-[#f1f0ec]"
              style={{ borderColor: L.border }}
            >
              <Phone size={16} color={L.mutedFg} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{telMascat(r.tel)}</span>
              <span className="text-[12px]" style={{ color: L.mutedFg }}>
                Sună
              </span>
            </button>
          ) : (
            <p
              className="flex min-h-11 items-center gap-2.5 rounded-[12px] border border-dashed px-3 py-2 text-[14px]"
              style={{ borderColor: L.input, color: L.mutedFg }}
            >
              <Phone size={16} aria-hidden />
              Fără telefon
            </p>
          )}

          {client && (
            <div
              className="rounded-[12px] border p-3"
              style={{
                borderColor: client.noShow >= 2 ? L.ocupatBorder : L.border,
                background: client.noShow >= 2 ? L.ocupatSoft : L.card,
              }}
            >
              {client.noShow >= 2 && (
                <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: L.ocupatText }}>
                  <TriangleAlert size={14} className="shrink-0" aria-hidden />
                  {client.noShow} neprezentări în istoric
                </p>
              )}
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px]" style={{ color: L.mutedFg }}>
                    Fișa clientului
                  </p>
                  <p className="text-[14px] font-medium">
                    {client.vizite} vizite · {client.noShow} {client.noShow === 1 ? "neprezentare" : "neprezentări"}
                  </p>
                  {taguri.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-1">
                      {taguri.map((t) => (
                        <span
                          key={t}
                          className="inline-flex h-5 items-center rounded-[5px] px-1.5 text-[12px] font-[550]"
                          style={{ background: client.noShow >= 2 ? L.card : L.secondary, color: L.fg }}
                        >
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
                  style={{ ...stilInput, height: 36 }}
                >
                  <option value="">Alege o masă liberă</option>
                  {libere.map(({ m, cap }) => (
                    <option key={m.id} value={m.id}>
                      Masa {numarMasa(m.id)} · {cap} locuri · {numeZona(m.zona)}
                      {cap < r.pers ? " · prea mică" : ""}
                      {dorita?.id === m.id ? " · cerută de client" : ""}
                    </option>
                  ))}
                </select>
                <Btn
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

          <Caseta eticheta="Note interne" icon={<EyeOff size={iconSize} aria-hidden />} avertisment>
            <textarea
              aria-label="Note interne"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: a sunat, întârzie 20 de minute"
              className="w-full resize-none rounded-[10px] border bg-white px-2.5 py-2 text-[14px]"
              style={{ borderColor: L.input, boxShadow: UMBRA.xs }}
            />
            {note !== (r.noteInterne ?? "") && (
              <div className="mt-1.5 flex justify-end">
                <Btn
                  m="xs"
                  onClick={() => c.setRez((xs) => xs.map((x) => (x.id === r.id ? { ...x, noteInterne: note.trim() || undefined } : x)))}
                >
                  Salvează nota
                </Btn>
              </div>
            )}
          </Caseta>
        </div>

        {esteActiva && (
          <div className={cx("grid shrink-0 gap-2 border-t p-4", c.mobil && "pb-7")} style={{ borderColor: L.border }}>
            {r.status === "pending" && (
              <div className="grid grid-cols-2 gap-2">
                <Btn m="lg" className="h-11" onClick={() => c.schimbaStatus(r.id, "confirmata")}>
                  <Check size={16} aria-hidden />
                  Confirmă
                </Btn>
                <Btn m="lg" v="outline" className="h-11" onClick={() => setDeConfirmat("respinsa")}>
                  <Ban size={16} aria-hidden />
                  Respinge
                </Btn>
              </div>
            )}
            {(r.status === "confirmata" || r.status === "pending") && (
              <Btn m="lg" v="secondary" className="h-11" onClick={() => c.schimbaStatus(r.id, "sosita")}>
                <LogIn size={16} aria-hidden />
                Marchează sosit
              </Btn>
            )}
            {r.masa && (
              <div className="grid grid-cols-2 gap-2">
                {onMuta && (
                  <Btn m="lg" v="outline" className="h-11" onClick={() => onMuta(r.id)}>
                    <ArrowLeftRight size={16} aria-hidden />
                    Mută pe altă masă
                  </Btn>
                )}
                <Btn m="lg" v="outline" onClick={() => a.prelungeste(r.id)} className={cx("h-11", !onMuta && "col-span-2")}>
                  <Timer size={16} aria-hidden />
                  Prelungește 30 min
                </Btn>
              </div>
            )}
            {r.status === "confirmata" && r.tel && (
              <Btn m="lg" v="outline" className="h-11" onClick={() => c.notify("În demo, mesajul WhatsApp nu pleacă.")}>
                <Clock size={16} aria-hidden />
                Anunță întârziere scurtă
              </Btn>
            )}
            {r.status !== "pending" && (
              <div className="mt-1 grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: L.border }}>
                <Btn m="lg" v="ghost" className="h-11" onClick={() => setDeConfirmat("no_show")}>
                  <UserX size={16} aria-hidden />
                  Neprezentat
                </Btn>
                <Btn m="lg" v="destructive" className="h-11" onClick={() => setDeConfirmat("anulata")}>
                  <Ban size={16} aria-hidden />
                  Anulează
                </Btn>
              </div>
            )}
          </div>
        )}
      </div>

      {deConfirmat && confirmare && (
        <Confirmare
          titlu={confirmare.titlu}
          descriere={confirmare.descriere}
          confirma={confirmare.confirma}
          distructiv={deConfirmat !== "no_show"}
          onClose={() => setDeConfirmat(null)}
          onConfirm={() => {
            c.schimbaStatus(r.id, deConfirmat);
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
  const pasPersoane =
    "grid h-10 w-10 place-content-center rounded-[12px] transition-colors duration-150 hover:bg-[rgba(31,157,105,.35)]";

  return (
    <Modal onClose={onClose} eticheta={`Masa ${m.numar}`} latime={c.mobil ? 366 : 520} reducedMotion={c.reducedMotion}>
      <div className="flex items-start justify-between gap-2 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold leading-tight" style={TITLU}>
            Masa {numarMasa(masaId)}
            <span className="ml-2 text-[16px] font-normal" style={{ color: L.mutedFg, letterSpacing: 0 }}>
              {capacitate(masaId)} locuri · {numeZona(m.zona)}
            </span>
          </h2>
          <p className="mt-1 text-[14px]" style={{ color: L.mutedFg }}>
            {urm ? `Rezervată de la ${fmtOra(urm.start)} pentru ${urm.nume}` : "Liberă până la închidere"}
          </p>
        </div>
        <BtnInchide onClick={onClose} />
      </div>

      <div className="grid grid-cols-2 p-5" style={{ gap: c.mobil ? 12 : 16 }}>
        <div
          className="relative flex select-none flex-col items-center justify-center gap-2 rounded-[16px] p-3"
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
            className="absolute inset-0 rounded-[16px] transition-colors duration-150 hover:bg-[rgba(31,157,105,.08)] active:bg-[rgba(31,157,105,.16)]"
          />
          <Zap size={c.mobil ? 30 : 40} aria-hidden className="pointer-events-none relative" />
          <span className="pointer-events-none relative text-[22px] font-semibold" style={TITLU}>
            Walk-in
          </span>
          <span className="relative flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Mai puține persoane"
              onClick={() => schimba(-1)}
              className={pasPersoane}
              style={{ background: "rgba(31,157,105,.2)" }}
            >
              <ChevronDown size={20} aria-hidden />
            </button>
            <span className="pointer-events-none min-w-8 text-center text-[28px] font-semibold" aria-live="polite">
              {pers}
            </span>
            <button
              type="button"
              aria-label="Mai multe persoane"
              onClick={() => schimba(1)}
              className={pasPersoane}
              style={{ background: "rgba(31,157,105,.2)" }}
            >
              <ChevronUp size={20} aria-hidden />
            </button>
          </span>
          <span className="pointer-events-none relative text-[14px] opacity-80">persoane</span>
        </div>

        <button
          type="button"
          onClick={onRezervare}
          className="flex flex-col items-center justify-center gap-2 rounded-[16px] p-3 transition-colors duration-150 hover:bg-[#f9e2d2]"
          style={{ height: latura, background: L.rezervareSoft, color: L.rezervareFg }}
        >
          <CalendarPlus size={c.mobil ? 30 : 40} aria-hidden />
          <span className="text-[22px] font-semibold" style={TITLU}>
            Rezervare
          </span>
          <span className="max-w-40 text-center text-[14px] opacity-80">Cu nume, oră și număr de persoane</span>
        </button>
      </div>

      {eroare && (
        <p
          key={agitare}
          role="alert"
          className={cx("mx-5 -mt-1 mb-5 flex items-start gap-2 rounded-[10px] px-3 py-2.5 text-[14px]", !c.reducedMotion && "tx-anim-shake")}
          style={{ background: L.ocupatSoft, color: L.ocupatText }}
        >
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Masa e rezervată de la {fmtOra(eroare.start)} pentru {eroare.nume}. Alege altă masă sau fă o rezervare mai scurtă.
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
    if (nume.trim().length < 2) e.nume = "Scrie numele clientului.";
    const cifre = tel.replace(/\D/g, "");
    if (tel.trim() && !/^07\d{8}$/.test(cifre)) e.tel = "Numărul are 10 cifre și începe cu 07.";
    let alta: Rez | null = null;
    if (masaId) alta = conflict(c.rez, masaId, ora, durata);
    if (alta)
      e.masa = `Masa e ocupată ${fmtOra(alta.start)}–${fmtOra(alta.start + alta.dur)} de ${alta.nume}, plus 15 min debarasare. Alege altă masă sau altă oră.`;
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
      text: "Rezervare salvată",
      desc: `${nume.trim()}, ${persoane(pers)}, ${fmtOra(ora)}${masaId ? `, masa ${numarMasa(masaId)}` : ""}`,
    });
    onClose();
  };

  const shake = !c.reducedMotion && incercare > 0 ? "tx-anim-shake" : undefined;
  const eticheta = "text-[14px] font-medium";
  const camp = { ...stilInput, height: 40 };

  return (
    <Modal onClose={onClose} eticheta="Rezervare nouă" tip={c.mobil ? "jos" : "centru"} latime={500} reducedMotion={c.reducedMotion}>
      <div className="flex shrink-0 items-start justify-between gap-2 border-b px-5 py-4" style={{ borderColor: L.border }}>
        <div>
          <h2 className="text-[18px] font-semibold leading-tight" style={TITLU}>
            Rezervare nouă
          </h2>
          <p className="mt-0.5 text-[14px]" style={{ color: L.mutedFg }}>
            {ZI_AZI}
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
            <label htmlFor="tx-nume" className={eticheta}>
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
              style={{ ...camp, borderColor: erori.nume ? L.destructive : L.input }}
            />
            {erori.nume && (
              <p id="tx-nume-err" className="flex items-center gap-1 text-[13px]" style={{ color: L.ocupatText }}>
                <TriangleAlert size={13} aria-hidden />
                {erori.nume}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="tx-tel" className={eticheta}>
              Telefon <span style={{ color: L.mutedFg, fontWeight: 400 }}>(opțional)</span>
            </label>
            <input
              id="tx-tel"
              inputMode="tel"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              placeholder="0722 123 456"
              aria-invalid={Boolean(erori.tel)}
              aria-describedby={erori.tel ? "tx-tel-err" : undefined}
              key={erori.tel ? `t${incercare}` : "t"}
              className={erori.tel ? shake : undefined}
              style={{ ...camp, borderColor: erori.tel ? L.destructive : L.input }}
            />
            {erori.tel && (
              <p id="tx-tel-err" className="flex items-center gap-1 text-[13px]" style={{ color: L.ocupatText }}>
                <TriangleAlert size={13} aria-hidden />
                {erori.tel}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-1.5">
          <p className={eticheta} id="tx-ora">
            Ora
          </p>
          <div role="group" aria-labelledby="tx-ora" className="tx-fara-bara -mx-1 flex min-h-[38px] gap-1.5 overflow-x-auto px-1 pb-0.5">
            {ore.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={h === ora}
                onClick={() => setOra(h)}
                className={cx(
                  "h-9 shrink-0 rounded-[10px] px-3 text-[14px] font-medium transition-colors duration-150",
                  h === ora ? "bg-[#141413] text-[#fafaf8]" : "bg-[#f1f0ec] text-[#141413] hover:bg-[#e8e6e1]"
                )}
              >
                {fmtOra(h)}
              </button>
            ))}
          </div>
        </div>

        <div className={cx("grid gap-4", !c.mobil && "grid-cols-2")}>
          <div className="grid gap-1.5">
            <p className={eticheta}>Persoane</p>
            <Stepper value={pers} onChange={setPers} eticheta="Persoane" />
          </div>
          <div className="grid gap-1.5">
            <p className={eticheta}>Durata</p>
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
          <label htmlFor="tx-masa" className={eticheta}>
            Masa
          </label>
          <select
            id="tx-masa"
            value={masaId}
            onChange={(e) => setMasaId(e.target.value)}
            aria-invalid={Boolean(erori.masa)}
            style={{ ...camp, borderColor: erori.masa ? L.destructive : L.input }}
          >
            <option value="">Fără masă</option>
            {ZONE.map((z) => (
              <optgroup key={z.id} label={z.nume}>
                {optiuniMese
                  .filter((m) => m.zona === z.id)
                  .map((m) => {
                    const ocupata = conflict(c.rez, m.id, ora, durata);
                    return (
                      <option key={m.id} value={m.id}>
                        Masa {numarMasa(m.id)} · {capacitate(m.id)} locuri
                        {ocupata ? ` · ocupată (${ocupata.nume}, ${fmtOra(ocupata.start)})` : ""}
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
              className={cx("flex items-start gap-1.5 rounded-[10px] px-2.5 py-2 text-[13px]", shake)}
              style={{ color: L.ocupatText, background: L.ocupatSoft }}
            >
              <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
              {erori.masa}
            </p>
          )}
          {masaId && capacitate(masaId) < pers && !erori.masa && (
            <p className="text-[13px]" style={{ color: L.expirareText }}>
              Masa are doar {capacitate(masaId)} locuri.
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <p className={eticheta}>Sursa</p>
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

  /** Mesele care pot primi grupul acum; mesele unite (V1 + V2) contează o dată. */
  const potrivite = (z?: ZonaId) =>
    MESE.filter(
      (m) =>
        !m.indisponibila &&
        (!m.grup || m.id === MESE.find((x) => x.grup === m.grup)?.id) &&
        (!z || m.zona === z) &&
        capacitate(m.id) >= pers &&
        !conflict(c.rez, m.id, start, DURATA_IMPLICITA)
    );

  const eligibile = useMemo(() => {
    const s = new Set<string>();
    for (const m of potrivite(zona)) for (const id of meseRezervare({ masa: m.id })) s.add(id);
    return s;
    // potrivite citește doar ce e în dependențe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.rez, pers, zona, start]);
  const zonaObj = ZONE.find((z) => z.id === zona)!;
  const nZona = potrivite(zona).length;
  const nTotal = potrivite().length;
  const alta = ZONE.find((z) => z.id !== zona)!;
  const pana = fmtOra(start + DURATA_IMPLICITA);

  return (
    <Modal onClose={onClose} eticheta="Walk-in" tip={c.mobil ? "jos" : "centru"} latime={640} reducedMotion={c.reducedMotion}>
      <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-4">
        <h2 className="text-[18px] font-semibold leading-tight" style={TITLU}>
          Walk-in
        </h2>
        <BtnInchide onClick={onClose} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3">
        <Stepper value={pers} onChange={setPers} eticheta="Persoane" mare />
        <Segmented eticheta="Zona" value={zona} onChange={setZona} optiuni={ZONE.map((z) => ({ id: z.id, text: z.nume }))} />
      </div>
      <div className={cx("px-5 pt-3", c.mobil ? "pb-8" : "pb-5")}>
        <div className="tx-dark overflow-hidden rounded-[10px]" style={{ background: D.exterior, border: `1px solid ${D.border}` }}>
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
        <p className="mt-2.5 text-[14px]" style={{ color: nTotal ? L.mutedFg : L.ocupatText }}>
          {nZona
            ? `${nZona} ${nZona === 1 ? "masă liberă" : "mese libere"} pentru ${persoane(pers)}, până la ${pana}`
            : nTotal
              ? `Nicio masă liberă aici pentru ${persoane(pers)}. Încearcă ${alta.nume}.`
              : `Nicio masă liberă pentru ${persoane(pers)} până la ${pana}`}
        </p>
      </div>
    </Modal>
  );
}

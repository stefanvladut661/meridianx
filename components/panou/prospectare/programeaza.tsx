"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { cautaProgramabile, programeaza } from "@/app/(admin)/admin/prospectare/actions";
import { InlineNote } from "@/components/panou/ui/actions";
import { Modal } from "@/components/panou/ui/modal";
import { btnClass } from "@/components/panou/ui/primitives";
import { Field, inputClass } from "@/components/panou/ui/states";
import { dayMonthRo, num } from "@/components/panou/ui/format";
import { useToast } from "@/components/panou/ui/toast";
import { UTILIZATORI } from "@/lib/prospectare/labels";
import type { CanalProgramare, ContWhatsapp, FiltreProgramare, FirmaProgramabila, OptiuniDistributie, RezultatProgramare, Utilizator } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/**
 * „Programează”: alegi firme din rezervă (cele mai vechi site-uri primele) și ziua, de mâine
 * încolo. Filtre: lot, calculatorul care le-a construit, nișă, oraș, intervalul în care s-au
 * terminat site-urile, căutare, sau firme bifate una câte una. La WhatsApp alegi contul (sau
 * „împarte egal”), la apeluri cine sună. Ce nu încape în limita zilei trece în zilele următoare,
 * pe același canal: avertismentul spune până când. Totul se verifică din nou în bază.
 */

const CANAL_TEXT: Record<CanalProgramare, { titlu: string; pe: string }> = {
  email: { titlu: "Programează emailuri", pe: "pe email" },
  whatsapp: { titlu: "Programează pe WhatsApp", pe: "pe WhatsApp" },
  telefon: { titlu: "Programează apeluri", pe: "la apeluri" },
};
const PAGINA = 100;
const MAX_ALESE = 500;

function plusZile(zi: string, n: number): string {
  const d = new Date(`${zi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const ziRo = (zi: string) => dayMonthRo(`${zi}T12:00:00Z`);

export function ProgrameazaButon({
  canal,
  azi,
  optiuni,
  conturi = [],
  utilizator = "stefan",
  className,
}: {
  canal: CanalProgramare;
  azi: string;
  optiuni: OptiuniDistributie | null;
  conturi?: ContWhatsapp[];
  utilizator?: Utilizator;
  className?: string;
}) {
  const [deschis, setDeschis] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setDeschis(true)} className={btnClass({ variant: "outline", size: "sm", className })}>
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        Programează
      </button>
      <Modal open={deschis} onOpenChange={setDeschis} label={CANAL_TEXT[canal].titlu} className="w-[min(46rem,calc(100vw-1.5rem))] p-0 sm:p-0">
        <DialogProgramare canal={canal} azi={azi} optiuni={optiuni} conturi={conturi.filter((c) => c.activ)} utilizator={utilizator} onInchide={() => setDeschis(false)} />
      </Modal>
    </>
  );
}

function DialogProgramare({
  canal,
  azi,
  optiuni,
  conturi,
  utilizator,
  onInchide,
}: {
  canal: CanalProgramare;
  azi: string;
  optiuni: OptiuniDistributie | null;
  conturi: ContWhatsapp[];
  utilizator: Utilizator;
  onInchide: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const { notify } = useToast();
  const maine = plusZile(azi, 1);
  const [zi, setZi] = useState(maine);
  const [cont, setCont] = useState<"egal" | number>("egal");
  const [cineSuna, setCineSuna] = useState<Utilizator>(utilizator);
  const [filtre, setFiltre] = useState<FiltreProgramare>({});
  const [firme, setFirme] = useState<FirmaProgramabila[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [incarc, setIncarc] = useState(true);
  const [eroare, setEroare] = useState<string | null>(null);
  const [alese, setAlese] = useState<Set<string>>(new Set());
  const [rezultat, setRezultat] = useState<{ mesaj: string; date?: RezultatProgramare } | null>(null);
  const [trimit, startTrimite] = useTransition();
  const cerere = useRef(0);

  // Lista se recitește la fiecare schimbare de filtru (cu o mică pauză la scris).
  useEffect(() => {
    const n = ++cerere.current;
    const t = setTimeout(async () => {
      setIncarc(true);
      setEroare(null);
      const r = await cautaProgramabile({ canal, filtre, pagina: 1 }).catch(() => ({ ok: false as const, message: "Conexiunea a căzut. Încearcă din nou." }));
      if (n !== cerere.current) return;
      setIncarc(false);
      if (!r.ok || !r.data) {
        setEroare(r.message || "Lista nu s-a încărcat.");
        setFirme([]);
        setTotal(0);
        return;
      }
      setFirme(r.data.firme);
      setTotal(r.data.total);
      setPagina(1);
      setAlese(new Set());
    }, 250);
    return () => clearTimeout(t);
  }, [canal, filtre]);

  const incarcaInca = async () => {
    setIncarc(true);
    const r = await cautaProgramabile({ canal, filtre, pagina: pagina + 1 }).catch(() => null);
    setIncarc(false);
    if (r?.ok && r.data) {
      setFirme((v) => [...v, ...r.data!.firme]);
      setPagina((p) => p + 1);
    } else {
      notify(r?.message || "Nu s-au încărcat mai multe firme.", "error");
    }
  };

  // „Alege toate”: toate cele filtrate (cel mult 500), încărcate pagină cu pagină.
  const alegeToate = async () => {
    let lista = firme;
    let p = pagina;
    setIncarc(true);
    while (lista.length < Math.min(total, MAX_ALESE)) {
      const r = await cautaProgramabile({ canal, filtre, pagina: p + 1 }).catch(() => null);
      if (!r?.ok || !r.data || r.data.firme.length === 0) break;
      lista = [...lista, ...r.data.firme];
      p += 1;
    }
    setIncarc(false);
    setFirme(lista);
    setPagina(p);
    setAlese(new Set(lista.slice(0, MAX_ALESE).map((f) => f.id)));
  };

  const comuta = (firmaId: string) =>
    setAlese((v) => {
      const n = new Set(v);
      if (n.has(firmaId)) n.delete(firmaId);
      else if (n.size < MAX_ALESE) n.add(firmaId);
      return n;
    });

  const trimite = () =>
    startTrimite(async () => {
      const r = await programeaza({
        canal,
        zi,
        firmaIds: [...alese],
        cont: canal === "whatsapp" ? cont : undefined,
        utilizator: canal === "telefon" ? cineSuna : undefined,
      }).catch(() => ({ ok: false as const, message: "Conexiunea a căzut: programarea nu s-a salvat. Încearcă din nou." }));
      if (!r.ok) {
        notify(r.message, "error");
        setRezultat({ mesaj: r.message });
        return;
      }
      notify(r.message, r.data?.avertisment ? "warn" : undefined);
      setRezultat({ mesaj: r.message, date: r.data });
      router.refresh();
    });

  const seteaza = (cheie: keyof FiltreProgramare, valoare: string) => setFiltre((f) => ({ ...f, [cheie]: valoare || undefined }));
  const filtrate = Object.values(filtre).some(Boolean);
  const toateAlese = firme.length > 0 && alese.size >= Math.min(total, MAX_ALESE);
  const loturi = useMemo(() => optiuni?.loturi ?? [], [optiuni]);

  if (rezultat?.date) {
    const d = rezultat.date;
    const zile = Object.entries(d.pe_zile).sort(([a], [b]) => a.localeCompare(b));
    return (
      <div className="space-y-4 p-5 sm:p-6">
        <h2 className="text-[18px] font-semibold">{CANAL_TEXT[canal].titlu}</h2>
        <p role="status" className="text-[14.5px] leading-relaxed">
          {num(d.programate)} {d.programate === 1 ? "firmă programată" : "firme programate"} {CANAL_TEXT[canal].pe}.
        </p>
        {d.avertisment ? <InlineNote tone="apricot">{d.avertisment}</InlineNote> : null}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[14px] sm:grid-cols-3">
          {zile.map(([z, n]) => (
            <div key={z} className="flex items-baseline justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <dt className="text-muted-foreground">{ziRo(z)}</dt>
              <dd className="pu-num font-medium">{num(n)}</dd>
            </div>
          ))}
        </dl>
        {d.refuzate.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[14px] font-medium">
              {num(d.refuzate.length)} {d.refuzate.length === 1 ? "firmă n-a putut fi programată" : "firme n-au putut fi programate"}:
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-[13.5px] text-muted-foreground">
              {d.refuzate.slice(0, 50).map((x) => (
                <li key={x.nr}>
                  <span className="pu-num text-foreground/80">#{x.nr}</span> {x.nume}: {x.motiv}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnClass({ variant: "outline", size: "sm" })} onClick={() => setRezultat(null)}>
            Programează altele
          </button>
          <button type="button" className={btnClass({ variant: "primary", size: "sm" })} onClick={onInchide}>
            Gata
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-h-[min(88vh,52rem)] flex-col">
      <div className="space-y-1 border-b border-border px-5 pb-4 pt-5 sm:px-6">
        <h2 className="text-[18px] font-semibold">{CANAL_TEXT[canal].titlu}</h2>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          Din rezervă, cele mai vechi site-uri primele. Cel mai devreme mâine; ce nu încape în limita zilei trece în zilele următoare, {CANAL_TEXT[canal].pe}. Se anulează până în ziua ei.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Ziua">
            <input type="date" className={inputClass()} value={zi} min={maine} max={plusZile(azi, 60)} onChange={(e) => setZi(e.target.value || maine)} required />
          </Field>
          {canal === "whatsapp" ? (
            <Field label="Contul" className="sm:col-span-2">
              <select className={inputClass()} value={String(cont)} onChange={(e) => setCont(e.target.value === "egal" ? "egal" : Number(e.target.value))}>
                <option value="egal">Împarte egal pe conturile active</option>
                {conturi.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nume} · {c.telefon} · {c.limita_zi}/zi
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {canal === "telefon" ? (
            <fieldset className="sm:col-span-2">
              <legend className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Cine sună</legend>
              <div className="mt-1.5 inline-flex rounded-lg border border-white/[0.12] p-0.5">
                {(Object.keys(UTILIZATORI) as Utilizator[]).map((u) => (
                  <label key={u} className={cn("cursor-pointer rounded-md px-3 py-1.5 text-[14px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lav", cineSuna === u ? "bg-white/[0.1] text-foreground" : "text-muted-foreground")}>
                    <input type="radio" name={`${id}-cine`} value={u} checked={cineSuna === u} onChange={() => setCineSuna(u)} className="sr-only" />
                    {UTILIZATORI[u]}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>

        <fieldset className="space-y-3">
          <legend className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Ce firme</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Lot">
              <select className={inputClass()} value={filtre.lot ?? ""} onChange={(e) => seteaza("lot", e.target.value)}>
                <option value="">Toate loturile</option>
                {loturi.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.v} ({num(o.n)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Construit de">
              <select className={inputClass()} value={filtre.construit_de ?? ""} onChange={(e) => seteaza("construit_de", e.target.value)}>
                <option value="">Orice calculator</option>
                {(optiuni?.constructori ?? []).map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.v} ({num(o.n)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nișă">
              <select className={inputClass()} value={filtre.nisa ?? ""} onChange={(e) => seteaza("nisa", e.target.value)}>
                <option value="">Toate nișele</option>
                {(optiuni?.nise ?? []).map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.v} ({num(o.n)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Oraș">
              <select className={inputClass()} value={filtre.oras ?? ""} onChange={(e) => seteaza("oras", e.target.value)}>
                <option value="">Toate orașele</option>
                {(optiuni?.orase ?? []).map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.v} ({num(o.n)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Site gata de la">
              <input type="date" className={inputClass()} value={filtre.gata_de ?? ""} max={filtre.gata_pana || undefined} onChange={(e) => seteaza("gata_de", e.target.value)} />
            </Field>
            <Field label="până la">
              <input type="date" className={inputClass()} value={filtre.gata_pana ?? ""} min={filtre.gata_de || undefined} onChange={(e) => seteaza("gata_pana", e.target.value)} />
            </Field>
          </div>
          <Field label="Caută după nume sau domeniu">
            <input type="search" className={inputClass()} value={filtre.cauta ?? ""} placeholder="ex. instal, rent a car" onChange={(e) => seteaza("cauta", e.target.value)} />
          </Field>
          {filtrate ? (
            <button type="button" className="rounded-sm text-[13.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setFiltre({})}>
              Șterge filtrele
            </button>
          ) : null}
        </fieldset>

        <section aria-labelledby={`${id}-lista`} className="rounded-xl border border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <h3 id={`${id}-lista`} className="text-[14px] font-medium" aria-live="polite">
              {incarc && firme.length === 0 ? "Caut în rezervă…" : `${num(total)} ${total === 1 ? "firmă poate merge" : "firme pot merge"} ${CANAL_TEXT[canal].pe}`}
            </h3>
            {total > 0 ? (
              <button
                type="button"
                className="rounded-sm text-[13.5px] font-medium text-lav underline-offset-2 hover:underline disabled:opacity-50"
                disabled={incarc}
                onClick={() => (toateAlese ? setAlese(new Set()) : void alegeToate())}
              >
                {toateAlese ? "Deselectează" : `Alege toate (${num(Math.min(total, MAX_ALESE))})`}
              </button>
            ) : null}
          </div>
          {eroare ? (
            <p role="alert" className="px-3 py-4 text-[14px] text-rose">
              {eroare}
            </p>
          ) : !incarc && total === 0 ? (
            <p className="px-3 py-4 text-[14px] text-muted-foreground">
              Nicio firmă din rezervă nu se potrivește. {filtrate ? "Schimbă filtrele sau șterge-le." : "Când roboții publică site-uri noi, apar aici."}
            </p>
          ) : (
            <ul className="max-h-[22rem] divide-y divide-border overflow-y-auto">
              {firme.map((f) => (
                <li key={f.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-white/[0.03]">
                    <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#C6B5FF]" checked={alese.has(f.id)} onChange={() => comuta(f.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">
                        <span className="pu-num text-muted-foreground">#{f.nr}</span> {f.nume}
                      </span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">
                        {[f.oras, f.lot, f.construit_de].filter(Boolean).join(" · ") || f.domeniu}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[12.5px] text-muted-foreground">
                      {f.site_gata_la ? <>gata {dayMonthRo(f.site_gata_la)}</> : "fără dată"}
                    </span>
                  </label>
                </li>
              ))}
              {firme.length < total ? (
                <li className="px-3 py-2">
                  <button type="button" className="rounded-sm text-[13.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50" disabled={incarc} onClick={() => void incarcaInca()}>
                    {incarc ? "Se încarcă…" : `Arată încă ${num(Math.min(PAGINA, total - firme.length))}`}
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </section>
        {rezultat && !rezultat.date ? (
          <p role="alert" className="text-[14px] text-rose">
            {rezultat.mesaj}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3.5 sm:px-6">
        <p className="text-[14px] text-muted-foreground" aria-live="polite">
          {alese.size === 0 ? "Bifează firmele sau „Alege toate”." : `${num(alese.size)} ${alese.size === 1 ? "firmă aleasă" : "firme alese"}, pentru ${ziRo(zi)}`}
        </p>
        <div className="flex gap-2">
          <button type="button" className={btnClass({ variant: "ghost", size: "sm" })} onClick={onInchide}>
            Renunță
          </button>
          <button type="button" className={btnClass({ variant: "primary", size: "sm" })} disabled={alese.size === 0 || trimit} onClick={trimite}>
            {trimit ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {trimit ? "Programez…" : `Programează ${alese.size > 0 ? num(alese.size) : ""}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}

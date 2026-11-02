"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CloudDownload, Loader2, Users } from "lucide-react";
import { importaLista } from "@/app/(admin)/admin/prospectare/actions";
import { InlineNote } from "@/components/panou/ui/actions";
import { num } from "@/components/panou/ui/format";
import { Btn, Card } from "@/components/panou/ui/primitives";
import { TextInput } from "@/components/panou/ui/select";
import { useToast } from "@/components/panou/ui/toast";
import { cn } from "@/lib/utils";
import { firmeText, TAP_SM } from "./apeluri-ui";

/**
 * Importul din rezervă în lista de apeluri a zilei (ImportPanel din prototip).
 * Doar telefon: lista de WhatsApp e continuă, firmele intră singure în ea.
 * Rezerva vine grupată de la server (`citesteRezerva`): firme cu site gata,
 * fără email și fără WhatsApp. „X firme disponibile” se numără aici, fără să
 * aducem firmele. Importul îl face baza, atomic: firmele primesc canalul
 * Telefon în aceeași tranzacție în care intră în listă.
 */

/** Un grup din rezervă (aceeași formă ca `GrupaRezerva` din lib/prospectare/citire). */
export interface GrupaRezervaUi {
  nisa: string | null;
  oras: string | null;
  judet: string | null;
  scor: number | null;
  este_mobil: boolean;
  n: number | string;
}

interface Filtre {
  nisa: string;
  judet: string;
  oras: string;
  scorMin: string;
  doarMobil: boolean;
}

type Dimensiune = "nisa" | "judet" | "oras";

const SCORURI = [50, 60, 70, 80, 85, 90];

function potriveste(g: GrupaRezervaUi, f: Filtre, ignora?: Dimensiune): boolean {
  if (ignora !== "nisa" && f.nisa && g.nisa !== f.nisa) return false;
  if (ignora !== "judet" && f.judet && g.judet !== f.judet) return false;
  if (ignora !== "oras" && f.oras && g.oras !== f.oras) return false;
  // Ca în bază: `scor >= minim`, iar firmele fără scor nu trec de un minim.
  if (f.scorMin && (g.scor === null || g.scor < Number(f.scorMin))) return false;
  if (f.doarMobil && !g.este_mobil) return false;
  return true;
}

/** Opțiunile unui filtru, cu câte firme are fiecare pe celelalte filtre alese. */
function optiuni(grupe: GrupaRezervaUi[], f: Filtre, dim: Dimensiune): { value: string; label: string }[] {
  const pe = new Map<string, number>();
  for (const g of grupe) {
    const v = g[dim];
    if (!v || !potriveste(g, f, dim)) continue;
    pe.set(v, (pe.get(v) ?? 0) + Number(g.n));
  }
  if (f[dim] && !pe.has(f[dim])) pe.set(f[dim], 0);
  return [...pe.entries()].sort(([a], [b]) => a.localeCompare(b, "ro")).map(([v, n]) => ({ value: v, label: `${v} · ${num(n)}` }));
}

/** SoftSelect din kit, cu ținta de 44 px și textul de 16 px pe telefon. */
function Alegere({
  label,
  value,
  onChange,
  options,
  toate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  toate: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none truncate rounded-lg border border-white/[0.1] bg-white/[0.04] pl-2.5 pr-7 text-base text-foreground outline-none transition-colors hover:bg-white/[0.07] focus:border-lav/50 sm:h-8 sm:text-[12.5px]"
        >
          <option value="" className="bg-[#14141A] text-foreground">
            {toate}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-[#14141A] text-foreground">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  );
}

const CANTITATI = [10, 20, 30, 50, 100];

export function PanouRezerva({
  rezerva,
  eroareRezerva,
  deschis,
  setDeschis,
  cerereFocus,
  onImportat,
}: {
  rezerva: GrupaRezervaUi[] | null;
  eroareRezerva: string | null;
  deschis: boolean;
  setDeschis: (deschis: boolean) => void;
  /** Crește când ecranul cere panoul deschis (din starea goală): mutăm focusul în el. */
  cerereFocus: number;
  onImportat: () => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [cantitate, setCantitate] = useState<number>(20);
  const [liber, setLiber] = useState("");
  const [filtre, setFiltre] = useState<Filtre>({ nisa: "", judet: "", oras: "", scorMin: "", doarMobil: false });
  const primul = useRef<HTMLButtonElement>(null);
  const regiune = useId();

  useEffect(() => {
    if (cerereFocus > 0 && deschis) primul.current?.focus();
  }, [cerereFocus, deschis]);

  const grupe = useMemo(() => rezerva ?? [], [rezerva]);
  const disponibile = useMemo(() => grupe.reduce((s, g) => (potriveste(g, filtre) ? s + Number(g.n) : s), 0), [grupe, filtre]);
  const opt = useMemo(
    () => ({ nisa: optiuni(grupe, filtre, "nisa"), judet: optiuni(grupe, filtre, "judet"), oras: optiuni(grupe, filtre, "oras") }),
    [grupe, filtre]
  );

  const cunoscuta = rezerva !== null;
  const valoare = liber ? Number(liber) || 0 : cantitate;
  const seAdauga = Math.min(valoare, cunoscuta ? disponibile : valoare);
  const preaMulte = valoare > 500;

  const seteaza = (patch: Partial<Filtre>) => setFiltre((f) => ({ ...f, ...patch }));

  const importa = () => {
    if (preaMulte || !valoare) return;
    startTransition(async () => {
      const result = await importaLista({
        canal: "telefon",
        numar: valoare,
        filtre: {
          nisa: filtre.nisa,
          oras: filtre.oras,
          judet: filtre.judet,
          scorMin: filtre.scorMin === "" ? "" : Number(filtre.scorMin),
          doarMobil: filtre.doarMobil,
        },
      });
      notify(result.message, result.ok ? undefined : "error");
      if (result.ok) onImportat();
      router.refresh();
    });
  };

  const subtitlu = cunoscuta ? `${firmeText(disponibile)} în rezervă, gata de sunat` : "Rezerva nu s-a putut număra acum";

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setDeschis(!deschis)}
        aria-expanded={deschis}
        aria-controls={regiune}
        className="flex w-full items-center justify-between gap-3 rounded-[22px] px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14px] font-semibold sm:text-[13px]">
            <CloudDownload className="h-4 w-4 shrink-0 text-lav" aria-hidden="true" />
            Importă pentru azi
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground sm:text-[11.5px]">{subtitlu}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", deschis && "rotate-180")} aria-hidden="true" />
      </button>

      <div id={regiune} hidden={!deschis}>
        {deschis ? (
          <div className="space-y-3 border-t border-white/[0.08] px-4 py-4">
            {eroareRezerva ? (
              <InlineNote tone="rose">
                Nu am putut număra rezerva: {eroareRezerva} Poți importa oricum; baza ia câte firme se potrivesc.
              </InlineNote>
            ) : null}

            <div>
              <p id={`${regiune}-cate`} className="mb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Câte firme
              </p>
              <div role="group" aria-labelledby={`${regiune}-cate`} className="flex flex-wrap items-center gap-1.5">
                {CANTITATI.map((c, i) => (
                  <button
                    key={c}
                    ref={i === 0 ? primul : undefined}
                    type="button"
                    aria-pressed={!liber && cantitate === c}
                    onClick={() => {
                      setCantitate(c);
                      setLiber("");
                    }}
                    className={cn(
                      "pu-num h-11 min-w-[52px] rounded-lg border px-2.5 text-[14px] transition-colors sm:h-auto sm:min-w-[46px] sm:py-1 sm:text-[12.5px]",
                      !liber && cantitate === c ? "border-lav bg-lav/10 text-lav" : "border-white/[0.1] text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {c}
                  </button>
                ))}
                <TextInput
                  value={liber}
                  onChange={(e) => setLiber(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="alt număr"
                  inputMode="numeric"
                  aria-label="Număr liber de firme"
                  className="h-11 w-28 text-base sm:h-8 sm:w-24 sm:text-[12.5px]"
                />
              </div>
              {preaMulte ? <p className="mt-1.5 text-[12px] text-[#FFB0C0]">Cel mult 500 de firme odată.</p> : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Alegere label="Nișă" value={filtre.nisa} onChange={(v) => seteaza({ nisa: v })} options={opt.nisa} toate="toate" />
              <Alegere label="Județ" value={filtre.judet} onChange={(v) => seteaza({ judet: v })} options={opt.judet} toate="toate" />
              <Alegere label="Oraș" value={filtre.oras} onChange={(v) => seteaza({ oras: v })} options={opt.oras} toate="toate" />
              <Alegere
                label="Scor minim"
                value={filtre.scorMin}
                onChange={(v) => seteaza({ scorMin: v })}
                options={SCORURI.map((s) => ({ value: String(s), label: `peste ${s}` }))}
                toate="orice scor"
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-0">
              <label className="flex min-h-11 items-center gap-2 text-[13px] sm:min-h-0 sm:text-[12px]">
                <input
                  type="checkbox"
                  checked={filtre.doarMobil}
                  onChange={(e) => seteaza({ doarMobil: e.target.checked })}
                  className="h-5 w-5 accent-[#C6B5FF] sm:h-3.5 sm:w-3.5"
                />
                doar mobil
              </label>
              <label className="flex min-h-11 items-center gap-2 text-[13px] text-muted-foreground sm:min-h-0 sm:text-[12px]" title="Importul ia doar firme cu site gata">
                <input type="checkbox" checked disabled className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                doar cu site gata
              </label>
              <label
                className="flex min-h-11 items-center gap-2 text-[13px] text-muted-foreground sm:min-h-0 sm:text-[12px]"
                title="Telefonul e separat: firmele care au primit email sau WhatsApp nu intră în lista de apeluri"
              >
                <input type="checkbox" checked disabled className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                fără email și fără WhatsApp
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
              <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground sm:text-[11.5px]" aria-live="polite">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {cunoscuta ? `Se adaugă ${num(seAdauga)} din ${firmeText(disponibile)} disponibile` : `Se cer ${firmeText(seAdauga)}`}
              </p>
              <Btn
                size="sm"
                variant="primary"
                icon={pending ? undefined : CloudDownload}
                disabled={pending || preaMulte || !valoare || (cunoscuta && !disponibile)}
                onClick={importa}
                className={cn(TAP_SM, "w-full sm:w-auto")}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Se importă…
                  </>
                ) : (
                  "Importă în lista mea"
                )}
              </Btn>
            </div>
            <p className="text-[12px] leading-relaxed text-muted-foreground sm:text-[11px]">
              Telefonul e separat: intră doar firme cu site gata care n-au primit nici email, nici WhatsApp. La import primesc canalul Telefon și nu mai primesc email
              sau WhatsApp. Excepția: după „Interesat” poți continua pe WhatsApp, iar asta apare doar în activitate.
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

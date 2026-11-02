"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CloudDownload, Loader2, Users } from "lucide-react";
import { importaLista } from "@/app/(admin)/admin/prospectare/actions";
import { InlineNote } from "@/components/panou/ui/actions";
import { isoDay, num } from "@/components/panou/ui/format";
import { Btn, Card } from "@/components/panou/ui/primitives";
import { TextInput } from "@/components/panou/ui/select";
import { useToast } from "@/components/panou/ui/toast";
import type { OptiuniDistributie, Utilizator } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { firmeText, TAP_SM } from "./apeluri-ui";
import { ProgrameazaButon } from "./programeaza";

/**
 * Importul din rezervă în lista de apeluri a zilei (ImportPanel din prototip), plus
 * „Programează” pentru zilele următoare. Doar telefon: emailul și WhatsApp-ul se
 * programează singure la 00:00 (distribuția). Rezerva vine grupată de la server
 * (`citesteRezerva`): firme cu site gata și publicat, fără niciun contact,
 * neprogramate pe alt canal, plus cele cu apel permis din fișă. „X firme
 * disponibile” se numără aici, fără să aducem firmele; cu filtrele distribuției
 * (lot, calculator, data site-ului), le numără baza. Importul îl face baza, atomic,
 * cele mai vechi site-uri primele: firmele rămân pe telefon până la 00:00, când
 * cele nesunate se întorc în distribuție.
 */

/** Un grup din rezervă (aceeași formă ca `GrupaRezerva` din lib/prospectare/citire). */
export interface GrupaRezervaUi {
  nisa: string | null;
  oras: string | null;
  judet: string | null;
  scor: number | null;
  este_mobil: boolean;
  lot?: string | null;
  construit_de?: string | null;
  /** Ziua site-ului gata (AAAA-LL-ZZ, ora României). */
  zi_gata?: string | null;
  n: number | string;
}

/**
 * Ce vine de la pagină pentru distribuție (filtrele noi și „Programează”). Prin context,
 * ca ecranul de apeluri să nu-și schimbe props-urile.
 */
export interface DistributieApeluri {
  azi: string;
  /** Cel ales în comutator: implicit „cine sună” la programare. */
  cine: Utilizator;
  optiuni: OptiuniDistributie | null;
}

const DistributieContext = createContext<DistributieApeluri | null>(null);

export function DistributieApeluriProvider({ value, children }: { value: DistributieApeluri; children: ReactNode }) {
  return <DistributieContext.Provider value={value}>{children}</DistributieContext.Provider>;
}

interface Filtre {
  nisa: string;
  judet: string;
  oras: string;
  scorMin: string;
  doarMobil: boolean;
  lot: string;
  construitDe: string;
  gataDe: string;
  gataPana: string;
}

const FARA_FILTRE: Filtre = { nisa: "", judet: "", oras: "", scorMin: "", doarMobil: false, lot: "", construitDe: "", gataDe: "", gataPana: "" };

type Dimensiune = "nisa" | "judet" | "oras";

const SCORURI = [50, 60, 70, 80, 85, 90];

function potriveste(g: GrupaRezervaUi, f: Filtre, ignora?: Dimensiune): boolean {
  if (ignora !== "nisa" && f.nisa && g.nisa !== f.nisa) return false;
  if (ignora !== "judet" && f.judet && g.judet !== f.judet) return false;
  if (ignora !== "oras" && f.oras && g.oras !== f.oras) return false;
  // Ca în bază: `scor >= minim`, iar firmele fără scor nu trec de un minim.
  if (f.scorMin && (g.scor === null || g.scor < Number(f.scorMin))) return false;
  if (f.doarMobil && !g.este_mobil) return false;
  if (f.lot && g.lot !== f.lot) return false;
  if (f.construitDe && g.construit_de !== f.construitDe) return false;
  // Ca în bază: o firmă fără dată nu trece de un interval ales.
  if (f.gataDe && (!g.zi_gata || g.zi_gata < f.gataDe)) return false;
  if (f.gataPana && (!g.zi_gata || g.zi_gata > f.gataPana)) return false;
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

const CAMP_ALEGERE =
  "h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] text-base text-foreground outline-none transition-colors hover:bg-white/[0.07] focus:border-lav/50 sm:h-8 sm:text-[12.5px]";
const ETICHETA = "mb-1 block text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground";

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
      <label htmlFor={id} className={ETICHETA}>
        {label}
      </label>
      <div className="relative">
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={cn(CAMP_ALEGERE, "appearance-none truncate pl-2.5 pr-7")}>
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

/** O zi (AAAA-LL-ZZ), cu aceleași mărimi ca `Alegere`. */
function Zi({ label, value, onChange, min, max }: { label: string; value: string; onChange: (value: string) => void; min?: string; max?: string }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={ETICHETA}>
        {label}
      </label>
      <input id={id} type="date" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className={cn(CAMP_ALEGERE, "px-2.5 [color-scheme:dark]")} />
    </div>
  );
}

const CANTITATI = [10, 20, 30, 50, 100];

/** Ziua (ora României) a unui moment din bază, pentru limitele câmpurilor de dată. */
const ziDin = (iso: string | null | undefined): string | undefined => (iso ? isoDay(iso) : undefined);

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
  const distributie = useContext(DistributieContext);
  const [pending, startTransition] = useTransition();
  const [cantitate, setCantitate] = useState<number>(20);
  const [liber, setLiber] = useState("");
  const [filtre, setFiltre] = useState<Filtre>(FARA_FILTRE);
  const primul = useRef<HTMLButtonElement>(null);
  const regiune = useId();

  useEffect(() => {
    if (cerereFocus > 0 && deschis) primul.current?.focus();
  }, [cerereFocus, deschis]);

  const grupe = useMemo(() => rezerva ?? [], [rezerva]);
  const dinGrupe = useMemo(() => grupe.reduce((s, g) => (potriveste(g, filtre) ? s + Number(g.n) : s), 0), [grupe, filtre]);
  const opt = useMemo(
    () => ({ nisa: optiuni(grupe, filtre, "nisa"), judet: optiuni(grupe, filtre, "judet"), oras: optiuni(grupe, filtre, "oras") }),
    [grupe, filtre]
  );

  // Grupele au și lotul, calculatorul și ziua site-ului gata: numărătoarea e exactă pe toate filtrele.
  const filtreBaza = false;
  const doarAici = false;
  const numarat: number | null | undefined = rezerva !== null ? dinGrupe : null;
  const seNumara = numarat === undefined;
  const cunoscuta = typeof numarat === "number";
  const disponibile = cunoscuta ? numarat : 0;
  const celMult = filtreBaza && doarAici;
  const valoare = liber ? Number(liber) || 0 : cantitate;
  const seAdauga = Math.min(valoare, cunoscuta ? disponibile : valoare);
  const preaMulte = valoare > 500;
  const filtrat = Object.entries(filtre).some(([, v]) => Boolean(v));

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
          lot: filtre.lot,
          construitDe: filtre.construitDe,
          gataDe: filtre.gataDe,
          gataPana: filtre.gataPana,
        },
      });
      notify(result.message, result.ok ? undefined : "error");
      if (result.ok) onImportat();
      router.refresh();
    });
  };

  const totalRezerva = rezerva !== null ? grupe.reduce((s, g) => s + Number(g.n), 0) : null;
  const subtitlu = totalRezerva !== null ? `${firmeText(totalRezerva)} în rezervă, cele mai vechi site-uri primele` : "Rezerva nu s-a putut număra acum";
  const gataMin = ziDin(distributie?.optiuni?.gata_de);
  const gataMax = ziDin(distributie?.optiuni?.gata_pana);

  return (
    <Card className="p-0">
      {/* Pe telefon, „Programează” stă sub antet, pe toată lățimea; de la `sm`, lângă el. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 sm:pr-4">
        <button
          type="button"
          onClick={() => setDeschis(!deschis)}
          aria-expanded={deschis}
          aria-controls={regiune}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-[22px] px-4 py-3 text-left"
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
        {distributie ? (
          // Cheia: la schimbarea comutatorului, dialogul pornește cu noul „cine sună”.
          <ProgrameazaButon
            key={distributie.cine}
            canal="telefon"
            azi={distributie.azi}
            optiuni={distributie.optiuni}
            utilizator={distributie.cine}
            className={cn(TAP_SM, "mx-4 mb-3 sm:mx-0 sm:mb-0")}
          />
        ) : null}
      </div>

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
              <Alegere
                label="Lot"
                value={filtre.lot}
                onChange={(v) => seteaza({ lot: v })}
                options={(distributie?.optiuni?.loturi ?? []).map((o) => ({ value: o.v, label: o.v }))}
                toate="toate loturile"
              />
              <Alegere
                label="Construit de"
                value={filtre.construitDe}
                onChange={(v) => seteaza({ construitDe: v })}
                options={(distributie?.optiuni?.constructori ?? []).map((o) => ({ value: o.v, label: o.v }))}
                toate="orice calculator"
              />
              <Zi label="Site gata de la" value={filtre.gataDe} onChange={(v) => seteaza({ gataDe: v })} min={gataMin} max={filtre.gataPana || gataMax} />
              <Zi label="Site gata până la" value={filtre.gataPana} onChange={(v) => seteaza({ gataPana: v })} min={filtre.gataDe || gataMin} max={gataMax} />
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
              <label className="flex min-h-11 items-center gap-2 text-[13px] text-muted-foreground sm:min-h-0 sm:text-[12px]" title="Importul ia doar firme cu site gata și link demo verificat">
                <input type="checkbox" checked disabled className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                doar cu site gata și publicat
              </label>
              <label
                className="flex min-h-11 items-center gap-2 text-[13px] text-muted-foreground sm:min-h-0 sm:text-[12px]"
                title="Cele care au primit email sau WhatsApp nu intră, decât cu apel permis din fișă; nici cele programate pe alt canal, până la 00:00"
              >
                <input type="checkbox" checked disabled className="h-5 w-5 sm:h-3.5 sm:w-3.5" />
                fără contact și neprogramate
              </label>
              {filtrat ? (
                <button
                  type="button"
                  onClick={() => setFiltre(FARA_FILTRE)}
                  className="min-h-11 rounded-sm text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground sm:min-h-0 sm:text-[12px]"
                >
                  Șterge filtrele
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
              <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground sm:text-[11.5px]" aria-live="polite">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {seNumara
                  ? "Număr firmele din rezervă…"
                  : !cunoscuta
                    ? `Se cer ${firmeText(seAdauga)}; baza ia câte se potrivesc`
                    : celMult
                      ? `Se adaugă cel mult ${num(seAdauga)}: ${firmeText(disponibile)} se potrivesc înainte de județ, scor și „doar mobil”`
                      : `Se adaugă ${num(seAdauga)} din ${firmeText(disponibile)} disponibile`}
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
            <div className="space-y-1 text-[12px] leading-relaxed text-muted-foreground sm:text-[11px]">
              <p>
                Intră firmele cu site gata și publicat, fără niciun contact și neprogramate azi pe email sau WhatsApp, plus cele cu apel permis din fișă. Cele mai vechi
                site-uri primele, nu scorul. Rămân pe telefon până la 00:00; atunci cele nesunate se întorc în distribuție.
              </p>
              <p>
                „Nu răspunde” nu e contact: firma se întoarce în distribuție, încercările rămân notate. „Interesat” și „Sună înapoi” rămân pe telefon. „Nu vrea” trece la „Nu
                contacta”. „Număr greșit” lasă firma doar pentru email. După „Interesat” poți continua pe WhatsApp: apare doar în activitate.
              </p>
              <p>Pentru zilele următoare folosește „Programează”: firmele intră în lista ta la 00:00, în ziua aleasă.</p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn, btnClass, Card } from "@/components/panou/ui/primitives";
import { SoftSelect, TextInput } from "@/components/panou/ui/select";
import { num } from "@/components/panou/ui/format";
import { useToast } from "@/components/panou/ui/toast";
import { ETAPE, ETAPE_ORDINE } from "@/lib/prospectare/labels";
import type { Optiune, Rezumat } from "@/lib/prospectare/citire";
import { firmeCuNumar } from "./firme-format";

/**
 * Filtrele tabelului de firme (prototip: FirmsPage.jsx). Stau în adresă, cu
 * aceleași chei pe care le citește `filtreDinAdresa` (și exportul CSV), deci
 * serverul recitește lista la fiecare schimbare. Controalele se mută pe loc
 * (useOptimistic), nu după răspunsul bazei.
 */

const CHEI_FILTRE = ["q", "etapa", "canal", "nisa", "oras", "lot", "scor", "mobil", "refacere"] as const;
type Cheie = (typeof CHEI_FILTRE)[number] | "ordine";
type Valori = Record<Cheie, string>;

interface Optiuni {
  nise: Optiune[];
  orase: Optiune[];
  loturi: Optiune[];
}

type Alegeri = { value: string; label: string }[];

const SCORURI: Alegeri = [
  { value: "", label: "orice scor" },
  { value: "85", label: "85 sau mai mult" },
  { value: "70", label: "70 sau mai mult" },
  { value: "50", label: "50 sau mai mult" },
];

const CANALE_OPTIUNI: Alegeri = [
  { value: "", label: "orice canal" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefon", label: "Telefon" },
  { value: "fara", label: "fără canal" },
];

const ORDINI: Alegeri = [
  { value: "", label: "după scor" },
  { value: "nr", label: "după număr (#)" },
  { value: "actualizat", label: "actualizate recent" },
  { value: "nume", label: "după nume (A–Z)" },
];

function valoriDin(params: { get(key: string): string | null }): Valori {
  const v = (k: Cheie) => params.get(k) ?? "";
  return {
    q: v("q"),
    etapa: v("etapa"),
    canal: v("canal"),
    nisa: v("nisa"),
    oras: v("oras"),
    lot: v("lot"),
    scor: v("scor"),
    mobil: v("mobil"),
    refacere: v("refacere"),
    ordine: v("ordine"),
  };
}

/** Valoarea din adresă rămâne aleasă și când lista de opțiuni n-o are (opțiunile n-au venit, link vechi). */
function cuCurenta(options: Alegeri, value: string): Alegeri {
  return !value || options.some((o) => o.value === value) ? options : [...options, { value, label: value }];
}

function useFiltreAdresa() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const actuala = params.toString();
  const [pending, startTransition] = useTransition();
  const dinAdresa = valoriDin(params);
  const [valori, aplicaOptimist] = useOptimistic(dinAdresa, (curente: Valori, patch: Partial<Valori>) => ({ ...curente, ...patch }));
  // Două schimbări rapide, înainte să răspundă serverul: a doua pornește de la adresa primei, nu de la cea veche.
  const urmatoare = useRef<string | null>(null);

  useEffect(() => {
    if (urmatoare.current === actuala) urmatoare.current = null;
  }, [actuala]);

  const aplica = (patch: Partial<Valori>) => {
    const next = new URLSearchParams(urmatoare.current ?? window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    // Alt filtru = altă listă: prima pagină, fără fișă deschisă.
    next.delete("pagina");
    next.delete("firma");
    const query = next.toString();
    urmatoare.current = query === new URLSearchParams(window.location.search).toString() ? null : query;
    startTransition(() => {
      aplicaOptimist(patch);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  return { valori, qAdresa: dinAdresa.q, aplica, pending };
}

function Chip({ activ, onClick, children, punct, numar }: { activ: boolean; onClick: () => void; children: ReactNode; punct?: string; numar?: number | null }) {
  return (
    <button
      type="button"
      aria-pressed={activ}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
        activ ? "border-lav/50 bg-lav/10 text-[#D8CCFF]" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {punct ? <span className={cn("h-1.5 w-1.5 rounded-full", punct)} aria-hidden="true" /> : null}
      {children}
      {typeof numar === "number" ? <span className={cn("pu-num", numar === 0 ? "text-muted-foreground/50" : "text-foreground/55")}>{num(numar)}</span> : null}
    </button>
  );
}

export function FirmeFiltre({
  optiuni,
  etape,
  totalBaza,
  gasite,
}: {
  /** Nișele, orașele și loturile din bază, cu câte firme are fiecare; `null` dacă citirea a căzut. */
  optiuni: Optiuni | null;
  /** Câte firme are fiecare etapă (toată baza, nu filtrul); `null` dacă rezumatul a căzut. */
  etape: Rezumat["etape"] | null;
  totalBaza: number | null;
  /** Câte firme are filtrul curent; `null` dacă tabelul nu s-a citit. */
  gasite: number | null;
}) {
  const { valori, qAdresa, aplica, pending } = useFiltreAdresa();
  const [text, setText] = useState(qAdresa);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Temporizatorul trebuie să vadă adresa de acum, nu pe cea de la tastarea literei.
  const aplicaRef = useRef(aplica);
  useEffect(() => {
    aplicaRef.current = aplica;
  });

  // Adresa s-a schimbat din afară („Curăță filtrele”, Înapoi): căsuța o urmează, dar nu cât omul tastează.
  useEffect(() => {
    if (timer.current) return;
    setText((curent) => (curent.trim() === qAdresa ? curent : qAdresa));
  }, [qAdresa]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const scrie = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      aplicaRef.current({ q: value.trim() });
    }, 320);
  };

  const trimite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    aplica({ q: text.trim() });
  };

  const areFiltre = CHEI_FILTRE.some((k) => Boolean(valori[k]));
  const rapid = valori.etapa === "site_gata" && valori.canal === "fara";

  const curata = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setText("");
    const gol: Partial<Valori> = {};
    for (const k of CHEI_FILTRE) gol[k] = "";
    aplica(gol);
  };

  const lista = (items: Optiune[] | undefined): Alegeri => (items ?? []).map((o) => ({ value: o.v, label: `${o.v} · ${num(o.n)}` }));

  return (
    <Card padded={false} className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <form role="search" onSubmit={trimite} className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <TextInput
            type="search"
            value={text}
            onChange={(event) => scrie(event.target.value)}
            placeholder="Caută după nume, domeniu, email, telefon sau #nr"
            className="pl-8"
            aria-label="Caută firme"
            maxLength={80}
            autoComplete="off"
          />
        </form>
        <Btn size="sm" variant="ghost" icon={RotateCcw} onClick={curata} disabled={!areFiltre}>
          Curăță
        </Btn>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <SoftSelect label="Nișă" value={valori.nisa} onChange={(v) => aplica({ nisa: v })} options={cuCurenta([{ value: "", label: "toate nișele" }, ...lista(optiuni?.nise)], valori.nisa)} />
        <SoftSelect label="Oraș" value={valori.oras} onChange={(v) => aplica({ oras: v })} options={cuCurenta([{ value: "", label: "toate orașele" }, ...lista(optiuni?.orase)], valori.oras)} />
        <SoftSelect label="Scor" value={valori.scor} onChange={(v) => aplica({ scor: v })} options={cuCurenta(SCORURI, valori.scor)} />
        <SoftSelect
          label="Etapă"
          value={valori.etapa}
          onChange={(v) => aplica({ etapa: v })}
          options={cuCurenta(
            [{ value: "", label: "toate etapele" }, ...ETAPE_ORDINE.map((e) => ({ value: e, label: etape ? `${ETAPE[e].label} · ${num(etape[e] ?? 0)}` : ETAPE[e].label }))],
            valori.etapa
          )}
        />
        <SoftSelect label="Canal" value={valori.canal} onChange={(v) => aplica({ canal: v })} options={cuCurenta(CANALE_OPTIUNI, valori.canal)} />
        <SoftSelect label="Lot" value={valori.lot} onChange={(v) => aplica({ lot: v })} options={cuCurenta([{ value: "", label: "toate loturile" }, ...lista(optiuni?.loturi)], valori.lot)} />
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[12px]">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={valori.mobil === "1"} onChange={(event) => aplica({ mobil: event.target.checked ? "1" : "" })} className="h-3.5 w-3.5 accent-[#C6B5FF]" />
          are mobil
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={valori.refacere === "1"} onChange={(event) => aplica({ refacere: event.target.checked ? "1" : "" })} className="h-3.5 w-3.5 accent-[#C6B5FF]" />
          de refăcut
        </label>
        <p className="ml-auto text-[11.5px] text-muted-foreground" aria-live="polite">
          {pending ? "Se actualizează…" : gasite === null ? "" : `${firmeCuNumar(gasite)} găsite`}
        </p>
      </div>

      <div className="border-t border-border pt-3">
        <div role="group" aria-label="Etapa firmelor" className="pu-no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <Chip activ={!valori.etapa} onClick={() => aplica({ etapa: "" })} numar={totalBaza}>
            Toate
          </Chip>
          <Chip activ={rapid} onClick={() => (rapid ? aplica({ etapa: "", canal: "" }) : aplica({ etapa: "site_gata", canal: "fara" }))}>
            Site gata, necontactate
          </Chip>
          <span className="mx-0.5 w-px shrink-0 self-stretch bg-border" aria-hidden="true" />
          {ETAPE_ORDINE.map((e) => (
            <Chip key={e} activ={valori.etapa === e} onClick={() => aplica({ etapa: valori.etapa === e ? "" : e })} punct={ETAPE[e].punct} numar={etape ? (etape[e] ?? 0) : null}>
              {ETAPE[e].label}
            </Chip>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** Ordinea tabelului, lângă titlul lui. Tot în adresă (`?ordine=`), ca exportul și linkul să o păstreze. */
export function FirmeOrdine() {
  const { valori, aplica } = useFiltreAdresa();
  const value = valori.ordine === "nr" || valori.ordine === "actualizat" || valori.ordine === "nume" ? valori.ordine : "";
  return <SoftSelect ariaLabel="Ordinea tabelului" value={value} onChange={(v) => aplica({ ordine: v })} options={ORDINI} className="w-[11.5rem]" />;
}

/**
 * „Export Excel”: ruta de server (toate paginile filtrului, nu doar cea de pe
 * ecran), deci un link adevărat, cu aceiași parametri. CSV cu BOM, deschis
 * direct de Excel.
 */
export function FirmeExport({ href, total }: { href: string; total: number | null }) {
  const { notify } = useToast();
  if (!total) {
    return (
      <Btn size="sm" variant="primary" icon={Download} disabled>
        Export Excel <span className="font-normal opacity-70">(CSV)</span>
      </Btn>
    );
  }
  return (
    <a
      href={href}
      className={btnClass({ variant: "primary", size: "sm" })}
      title="Exact firmele din filtre, toate paginile. CSV cu diacritice și „;” ca separator: se deschide direct în Excel."
      onClick={() => notify(`Export pornit: ${firmeCuNumar(total)}, exact ce e filtrat.`)}
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      Export Excel <span className="font-normal opacity-70">(CSV)</span>
    </a>
  );
}

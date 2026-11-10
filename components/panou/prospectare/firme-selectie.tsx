"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckSquare, Hammer, Send, X } from "lucide-react";
import { idsDinFiltru } from "@/app/(admin)/admin/prospectare/actions";
import { num } from "@/components/panou/ui/format";
import { Modal } from "@/components/panou/ui/modal";
import { Btn } from "@/components/panou/ui/primitives";
import { useToast } from "@/components/panou/ui/toast";
import type { CanalStare, ContWhatsapp, Terminal } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { DialogAloca } from "./firme-aloca";
import { DialogDistribuie } from "./firme-distribuie";

/**
 * Modul „Selectează” din tabelul Firme (migrarea 39): căsuțe pe rânduri, „Selectează tot (din filtrul curent)” în
 * antet (toate paginile), bara fixă de jos cu „Distribuie”, „Alocă pentru construcție” și „Anulează”. Selecția
 * se golește când se schimbă filtrele (alt filtru = altă listă) și după o distribuire sau o alocare reușită.
 */

export interface DateDistribuire {
  azi: string;
  canale: CanalStare[] | null;
  conturi: ContWhatsapp[];
  casute: { adresa: string; activa: boolean; limita: number | null }[];
  terminale: Terminal[];
}

interface Selectie {
  activ: boolean;
  alese: Set<string>;
  comuta: (id: string) => void;
  /** Antetul: toate firmele filtrului curent sunt alese. */
  totFiltrul: boolean;
  comutaTot: () => void;
  incarcTot: boolean;
  total: number | null;
  /** „Selectează” pornește modul; a doua apăsare (sau „Anulează”) îl oprește și golește selecția. */
  comutaModul: () => void;
}

const Ctx = createContext<Selectie | null>(null);

/** Selecția tabelului, sau `null` în afara paginii Firme. */
export const useSelectie = (): Selectie | null => useContext(Ctx);

const MAX = 5000;

export function SelectieProvider({
  children,
  total,
  filtru,
  date,
}: {
  children: ReactNode;
  /** Câte firme are filtrul curent (toate paginile); null dacă tabelul nu s-a citit. */
  total: number | null;
  /** Filtrele din adresă, fără pagină, fișă și ordine: o schimbare golește selecția. */
  filtru: string;
  date: DateDistribuire;
}) {
  const { notify } = useToast();
  const [activ, setActiv] = useState(false);
  const [alese, setAlese] = useState<Set<string>>(() => new Set());
  const [toateFiltrului, setToateFiltrului] = useState<string[] | null>(null);
  const [incarcTot, setIncarcTot] = useState(false);
  const [dialog, setDialog] = useState<"distribuie" | "aloca" | null>(null);
  const cerere = useRef(0);

  // Alt filtru = altă listă: selecția pornește de la zero (modul rămâne pornit).
  useEffect(() => {
    cerere.current += 1;
    setAlese(new Set());
    setToateFiltrului(null);
    setIncarcTot(false);
  }, [filtru]);

  const comuta = useCallback((id: string) => {
    setAlese((v) => {
      const n = new Set(v);
      if (n.has(id)) n.delete(id);
      else if (n.size < MAX) n.add(id);
      return n;
    });
  }, []);

  const totFiltrul = toateFiltrului !== null && toateFiltrului.length > 0 && toateFiltrului.every((id) => alese.has(id));

  const comutaTot = useCallback(() => {
    if (totFiltrul && toateFiltrului) {
      setAlese((v) => {
        const n = new Set(v);
        for (const id of toateFiltrului) n.delete(id);
        return n;
      });
      return;
    }
    const n = ++cerere.current;
    setIncarcTot(true);
    void idsDinFiltru(filtru)
      .catch(() => ({ ok: false as const, message: "Conexiunea a căzut: selecția nu s-a făcut. Încearcă din nou." }))
      .then((r) => {
        if (n !== cerere.current) return;
        setIncarcTot(false);
        if (!r.ok || !r.data) {
          notify(r.message || "Firmele filtrului nu s-au citit.", "error");
          return;
        }
        const ids = r.data.ids;
        setToateFiltrului(ids);
        setAlese((v) => new Set([...v, ...ids].slice(0, MAX)));
        if (total !== null && total > MAX) notify(`Se pot alege cel mult ${num(MAX)} de firme: primele ${num(MAX)} din ${num(total)}.`, "warn");
      });
  }, [filtru, notify, toateFiltrului, total, totFiltrul]);

  const gata = () => {
    setDialog(null);
    setAlese(new Set());
    setToateFiltrului(null);
  };

  const comutaModul = useCallback(() => {
    if (!activ) {
      setActiv(true);
      return;
    }
    cerere.current += 1;
    setAlese(new Set());
    setToateFiltrului(null);
    setIncarcTot(false);
    setActiv(false);
  }, [activ]);

  const valoare = useMemo<Selectie>(
    () => ({ activ, alese, comuta, totFiltrul, comutaTot, incarcTot, total, comutaModul }),
    [activ, alese, comuta, totFiltrul, comutaTot, incarcTot, total, comutaModul]
  );
  const ids = useMemo(() => [...alese], [alese]);

  return (
    <Ctx.Provider value={valoare}>
      {children}
      {activ ? <div aria-hidden="true" className="h-16" /> : null}
      {activ ? (
        <div
          role="region"
          aria-label="Firmele selectate"
          className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex flex-wrap items-center gap-2 rounded-2xl border border-lav/30 bg-[#16151F]/95 px-3.5 py-2.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)] backdrop-blur lg:bottom-5 lg:left-[calc(266px+2rem)] lg:right-8"
        >
          <p className="mr-auto text-[14.5px] font-medium" aria-live="polite">
            {incarcTot ? (
              "Se aleg firmele filtrului…"
            ) : (
              <>
                <span className="pu-num">{num(alese.size)}</span> {alese.size === 1 ? "firmă selectată" : "firme selectate"}
              </>
            )}
          </p>
          <Btn size="sm" variant="primary" icon={Send} disabled={alese.size === 0 || incarcTot} onClick={() => setDialog("distribuie")}>
            Distribuie
          </Btn>
          <Btn size="sm" variant="outline" icon={Hammer} disabled={alese.size === 0 || incarcTot} onClick={() => setDialog("aloca")}>
            Alocă pentru construcție
          </Btn>
          <Btn size="sm" variant="ghost" icon={X} onClick={comutaModul}>
            Anulează
          </Btn>
        </div>
      ) : null}

      <Modal
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        label={dialog === "aloca" ? "Alocă pentru construcție" : "Distribuie"}
        className="w-[min(44rem,calc(100vw-1.5rem))] p-0 sm:p-0"
      >
        {dialog === "distribuie" ? <DialogDistribuie firmaIds={ids} date={date} onGata={gata} onInchide={() => setDialog(null)} /> : null}
        {dialog === "aloca" ? <DialogAloca firmaIds={ids} terminale={date.terminale} onGata={gata} onInchide={() => setDialog(null)} /> : null}
      </Modal>
    </Ctx.Provider>
  );
}

/** „Selectează”, deasupra tabelului: pornește și oprește modul. */
export function SelecteazaButon() {
  const s = useSelectie();
  if (!s) return null;
  return (
    <Btn size="sm" variant={s.activ ? "primary" : "outline"} icon={CheckSquare} aria-pressed={s.activ} onClick={s.comutaModul}>
      Selectează
    </Btn>
  );
}

/** Căsuța unui rând (tabel sau card). */
export function CasutaFirma({ id, nume, className }: { id: string; nume: string; className?: string }) {
  const s = useSelectie();
  if (!s?.activ) return null;
  return (
    <input
      type="checkbox"
      className={cn("h-4 w-4 shrink-0 cursor-pointer accent-[#C6B5FF]", className)}
      checked={s.alese.has(id)}
      onChange={() => s.comuta(id)}
      onClick={(event) => event.stopPropagation()}
      aria-label={`Selectează ${nume}`}
    />
  );
}

/** „Selectează tot (din filtrul curent)”: toate paginile, nu doar cea vizibilă. */
export function CasutaTot({ className, cuText = false }: { className?: string; cuText?: boolean }) {
  const s = useSelectie();
  if (!s?.activ) return null;
  const eticheta = `Selectează tot (din filtrul curent${s.total !== null ? `: ${num(Math.min(s.total, MAX))}` : ""})`;
  const casuta = (
    <input
      type="checkbox"
      className="h-4 w-4 shrink-0 cursor-pointer accent-[#C6B5FF] disabled:cursor-wait"
      checked={s.totFiltrul}
      disabled={s.incarcTot}
      onChange={s.comutaTot}
      aria-label={cuText ? undefined : eticheta}
      title={eticheta}
    />
  );
  if (!cuText) return <span className={className}>{casuta}</span>;
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-[14px] font-medium", className)}>
      {casuta}
      {eticheta}
    </label>
  );
}

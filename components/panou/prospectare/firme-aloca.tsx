"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { alocaConstructie } from "@/app/(admin)/admin/prospectare/actions";
import { Info } from "@/components/panou/ui/info";
import { btnClass } from "@/components/panou/ui/primitives";
import { num, relativeRo } from "@/components/panou/ui/format";
import { inputClass } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import type { RezultatAlocare, Terminal } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/**
 * „Alocă pentru construcție”: firmele alese merg pe listele terminalelor (ex. stefan-1, vladut-2). „Împarte egal”
 * le dă alternativ după scor (1 la primul, 2 la al doilea…), ca fiecare să primească și firme bune, și slabe; sau
 * câte firme pe terminal. Firmele începute (rezervate acum de un robot) și cele cu site publicat se sar.
 */

const NUME = /^[A-Za-z0-9._-]{1,40}$/;

export function DialogAloca({ firmaIds, terminale, onGata, onInchide }: { firmaIds: string[]; terminale: Terminal[]; onGata: () => void; onInchide: () => void }) {
  const router = useRouter();
  const { notify } = useToast();
  const n = firmaIds.length;
  const [lista, setLista] = useState<Terminal[]>(terminale);
  const [alese, setAlese] = useState<string[]>([]);
  const [nou, setNou] = useState("");
  const [eroareNou, setEroareNou] = useState<string | null>(null);
  const [egal, setEgal] = useState(true);
  const [numere, setNumere] = useState<Record<string, string>>({});
  const [rezumat, setRezumat] = useState<RezultatAlocare | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);
  const [incarc, setIncarc] = useState(false);
  const [saritDeschis, setSaritDeschis] = useState(false);
  const [trimit, startTrimite] = useTransition();
  const cerere = useRef(0);

  const aleseInOrdine = lista.filter((t) => alese.includes(t.nume)).map((t) => t.nume);
  const suma = aleseInOrdine.reduce((s, k) => s + (Number(numere[k]) || 0), 0);
  const gata = aleseInOrdine.length > 0 && (egal || suma === n);

  useEffect(() => {
    const nr = ++cerere.current;
    if (!gata) {
      setRezumat(null);
      setIncarc(false);
      return;
    }
    setIncarc(true);
    const t = setTimeout(async () => {
      const r = await alocaConstructie({
        firmaIds,
        terminale: aleseInOrdine,
        numere: egal ? null : aleseInOrdine.map((k) => Number(numere[k]) || 0),
        proba: true,
      }).catch(() => ({ ok: false as const, message: "Conexiunea a căzut: rezumatul nu s-a calculat." }));
      if (nr !== cerere.current) return;
      setIncarc(false);
      if (!r.ok || !r.data) {
        setEroare(r.message);
        setRezumat(null);
        return;
      }
      setEroare(null);
      setRezumat(r.data);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gata, firmaIds, alese, lista, egal, numere]);

  const adauga = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const v = nou.trim();
    if (!NUME.test(v)) {
      setEroareNou("Un nume scurt, ex. stefan-3 (litere, cifre, punct, liniuță).");
      return;
    }
    if (!lista.some((t) => t.nume === v)) setLista((l) => [...l, { nume: v, robot: null, ultima_activitate: null, de_construit: 0 }]);
    setAlese((a) => (a.includes(v) ? a : [...a, v]));
    setNou("");
    setEroareNou(null);
  };

  const confirma = () =>
    startTrimite(async () => {
      const r = await alocaConstructie({
        firmaIds,
        terminale: aleseInOrdine,
        numere: egal ? null : aleseInOrdine.map((k) => Number(numere[k]) || 0),
        proba: false,
      }).catch(() => ({ ok: false as const, message: "Conexiunea a căzut: nu știm dacă s-a alocat. Verifică filtrul „Alocate lui”." }));
      if (!r.ok) {
        notify(r.message, "error");
        setEroare(r.message);
        return;
      }
      notify(r.message);
      router.refresh();
      onGata();
    });

  return (
    <div className="flex max-h-[min(90vh,50rem)] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-5 pb-4 pt-5 sm:px-6">
        <h2 className="text-[18px] font-semibold">
          Alocă pentru construcție <span className="pu-num text-muted-foreground">{num(n)}</span>
        </h2>
        <Info label="Cum se împart">
          Egal: alternativ după scor (1 la primul terminal, 2 la al doilea…), ca fiecare să primească și firme bune, și slabe. O firmă neîncepută se mută
          alocând-o din nou. Terminalul își ia lista din /lista-mea.
        </Info>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
        <fieldset className="space-y-2">
          <legend className="text-[14px] font-medium">Terminalele</legend>
          {lista.length ? (
            <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
              {lista.map((t) => {
                const ales = alese.includes(t.nume);
                const pe = rezumat?.pe_terminale.find((p) => p.terminal === t.nume);
                return (
                  <li key={t.nume} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-[14px]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-[#C6B5FF]"
                        checked={ales}
                        onChange={() => setAlese((a) => (a.includes(t.nume) ? a.filter((x) => x !== t.nume) : [...a, t.nume]))}
                      />
                      <span className="font-mono font-medium">{t.nume}</span>
                      <span className="min-w-0 truncate text-[13px] text-muted-foreground">
                        {[t.robot, t.ultima_activitate ? relativeRo(t.ultima_activitate) : null].filter(Boolean).join(" · ") || "nou"}
                      </span>
                    </label>
                    <span className="pu-num text-[13px] text-muted-foreground">{num(pe ? pe.deja : t.de_construit)} în listă</span>
                    {!egal && ales ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={n}
                        value={numere[t.nume] ?? ""}
                        placeholder="0"
                        onChange={(e) => setNumere((v) => ({ ...v, [t.nume]: e.target.value }))}
                        aria-label={`Câte firme la ${t.nume}`}
                        className={inputClass("pu-num h-8 w-20 text-right")}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[14px] text-muted-foreground">Niciun terminal raportat încă. Scrie numele lui mai jos.</p>
          )}
          <form onSubmit={adauga} className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <input
                value={nou}
                onChange={(e) => {
                  setNou(e.target.value);
                  setEroareNou(null);
                }}
                placeholder="terminal nou, ex. vladut-2"
                maxLength={40}
                aria-label="Terminal nou"
                aria-invalid={eroareNou ? true : undefined}
                className={inputClass(cn("h-8 font-mono", eroareNou && "border-rose/50"))}
              />
              {eroareNou ? (
                <span role="alert" className="mt-1 block text-[13px] text-rose">
                  {eroareNou}
                </span>
              ) : null}
            </div>
            <button type="submit" className={btnClass({ variant: "outline", size: "sm" })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adaugă
            </button>
          </form>
        </fieldset>

        <div className="space-y-1">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-[14px]">
            <input type="checkbox" className="h-4 w-4 accent-[#C6B5FF]" checked={egal} onChange={(e) => setEgal(e.target.checked)} />
            Împarte egal
          </label>
          {!egal ? (
            <p className={cn("pu-num text-[13.5px]", suma === n ? "text-muted-foreground" : "text-apricot")} aria-live="polite">
              Suma {num(suma)} / {num(n)}
              {suma !== n ? ` — trebuie să fie ${num(n)}` : ""}
            </p>
          ) : null}
        </div>

        <section aria-live="polite" className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3">
          {eroare ? (
            <p role="alert" className="text-[14px] text-rose">
              {eroare}
            </p>
          ) : !gata ? (
            <p className="text-[14px] text-muted-foreground">{aleseInOrdine.length === 0 ? "Alege cel puțin un terminal." : `Suma pe terminale trebuie să fie ${num(n)}.`}</p>
          ) : !rezumat ? (
            <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> Se calculează…
            </p>
          ) : (
            <div className={cn("space-y-2", incarc && "opacity-60")}>
              <p className="text-[14.5px] leading-relaxed">
                <span className="pu-num font-semibold">{num(rezumat.alocate)}</span> vor fi alocate
                {rezumat.alocate > 0 ? ": " : ""}
                {rezumat.pe_terminale
                  .filter((p) => p.n > 0)
                  .map((p) => `${p.terminal} = ${num(p.n)}`)
                  .join(", ")}
                {rezumat.sarite.length ? (
                  <>
                    ; <span className="pu-num font-semibold">{num(rezumat.sarite.length)}</span> sărite
                  </>
                ) : null}
                .
              </p>
              {rezumat.sarite.length ? (
                <div>
                  <button
                    type="button"
                    aria-expanded={saritDeschis}
                    onClick={() => setSaritDeschis((v) => !v)}
                    className="flex items-center gap-1 rounded-sm text-[13.5px] text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", saritDeschis && "rotate-180")} aria-hidden="true" />
                    De ce sunt sărite
                  </button>
                  {saritDeschis ? (
                    <ul className="mt-1.5 max-h-44 space-y-1 overflow-y-auto text-[13.5px]">
                      {rezumat.sarite.map((s) => (
                        <li key={s.id}>
                          <span className="pu-num text-muted-foreground">#{s.nr}</span> {s.nume}: <span className="text-foreground/75">{s.motiv}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3.5 sm:px-6">
        <button type="button" className={btnClass({ variant: "ghost", size: "sm" })} onClick={onInchide}>
          Renunță
        </button>
        <button
          type="button"
          className={btnClass({ variant: "primary", size: "sm" })}
          disabled={!gata || !rezumat || rezumat.alocate === 0 || incarc || trimit}
          onClick={confirma}
        >
          {trimit ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {trimit ? "Aloc…" : `Alocă ${rezumat && rezumat.alocate > 0 ? num(rezumat.alocate) : ""}`.trim()}
        </button>
      </div>
    </div>
  );
}

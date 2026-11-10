"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { distribuie } from "@/app/(admin)/admin/prospectare/actions";
import { Info } from "@/components/panou/ui/info";
import { btnClass } from "@/components/panou/ui/primitives";
import { dayMonthRo, num } from "@/components/panou/ui/format";
import { inputClass } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import type { CanalProgramare, OrdineDistribuire, RezultatDistribuire } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import type { DateDistribuire } from "./firme-selectie";

/**
 * „Distribuie”: canalul, conturile (împărțite egal sau câte firme pe fiecare), ordinea și ziua. Rezumatul vine din
 * bază (proba), la fiecare schimbare: câte merg pe fiecare cont, ce se sare și de ce, avertismentul limitei. Regulile
 * (același canal nu de două ori, „Nu contacta”, link verificat, mobil la WhatsApp) le aplică baza.
 */

interface Cont {
  cheie: string;
  nume: string;
  detaliu: string | null;
}

const CANALE: { canal: CanalProgramare; label: string }[] = [
  { canal: "whatsapp", label: "WhatsApp" },
  { canal: "email", label: "Email" },
  { canal: "telefon", label: "Apel" },
];

const ziRo = (zi: string) => dayMonthRo(`${zi}T12:00:00Z`);

function plusZile(zi: string, n: number): string {
  const d = new Date(`${zi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Pasul numerotat: e o secvență reală (canal → conturi → ordine). */
function Pas({ n, titlu, info, children }: { n: number; titlu: string; info?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <legend className="contents">
        <span className="flex items-center gap-2 pt-1.5 text-[14px] font-medium">
          <span className="pu-num flex h-5 w-5 items-center justify-center rounded-full bg-lav/15 text-[12.5px] text-lav" aria-hidden="true">
            {n}
          </span>
          {titlu}
          {info ? <Info>{info}</Info> : null}
        </span>
      </legend>
      <div className="min-w-0">{children}</div>
    </fieldset>
  );
}

export function DialogDistribuie({ firmaIds, date, onGata, onInchide }: { firmaIds: string[]; date: DateDistribuire; onGata: () => void; onInchide: () => void }) {
  const id = useId();
  const router = useRouter();
  const { notify } = useToast();
  const n = firmaIds.length;
  const stare = (c: CanalProgramare) => date.canale?.find((x) => x.canal === c) ?? null;
  const activ = (c: CanalProgramare) => stare(c)?.activ !== false;
  const [canal, setCanal] = useState<CanalProgramare>(() => CANALE.find((c) => activ(c.canal))?.canal ?? "whatsapp");

  const conturi: Cont[] = useMemo(() => {
    if (canal === "whatsapp")
      return date.conturi.filter((c) => c.activ).map((c) => ({ cheie: String(c.id), nume: c.nume, detaliu: c.titular }));
    if (canal === "email") return date.casute.filter((c) => c.activa).map((c) => ({ cheie: c.adresa, nume: c.adresa, detaliu: null }));
    return [
      { cheie: "stefan", nume: "Ștefan", detaliu: null },
      { cheie: "vladut", nume: "Vlăduț", detaliu: null },
    ];
  }, [canal, date.conturi, date.casute]);

  const [alese, setAlese] = useState<string[]>(() => conturi.map((c) => c.cheie));
  const [egal, setEgal] = useState(true);
  const [numere, setNumere] = useState<Record<string, string>>({});
  const [ordine, setOrdine] = useState<OrdineDistribuire>("scor");
  const [zi, setZi] = useState(date.azi);
  const [avansat, setAvansat] = useState(false);
  const [alocari, setAlocari] = useState<Record<string, string>>({});
  const [rezumat, setRezumat] = useState<RezultatDistribuire | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);
  const [incarc, setIncarc] = useState(false);
  const [saritDeschis, setSaritDeschis] = useState(false);
  const [trimit, startTrimite] = useTransition();
  const cerere = useRef(0);

  // Alt canal = alte conturi: toate alese, împărțite egal, fără alegerile avansate.
  useEffect(() => {
    setAlese(conturi.map((c) => c.cheie));
    setNumere({});
    setAlocari({});
  }, [conturi]);

  const aleseInOrdine = conturi.filter((c) => alese.includes(c.cheie)).map((c) => c.cheie);
  const suma = aleseInOrdine.reduce((s, k) => s + (Number(numere[k]) || 0), 0);
  const numereBune = egal || (suma === n && aleseInOrdine.every((k) => /^\d+$/.test(numere[k] ?? "0")));
  const canalActiv = activ(canal);
  const gata = canalActiv && aleseInOrdine.length > 0 && numereBune && Boolean(zi);

  // Rezumatul (proba), după fiecare schimbare, cu o mică pauză.
  useEffect(() => {
    const nr = ++cerere.current;
    if (!gata) {
      setRezumat(null);
      setIncarc(false);
      return;
    }
    setIncarc(true);
    const t = setTimeout(async () => {
      const r = await distribuie({
        canal,
        zi,
        firmaIds,
        conturi: aleseInOrdine,
        numere: egal ? null : aleseInOrdine.map((k) => Number(numere[k]) || 0),
        ordine,
        alocari,
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
    // aleseInOrdine e derivat din `alese` și `conturi`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gata, canal, zi, firmaIds, alese, conturi, egal, numere, ordine, alocari]);

  const confirma = () =>
    startTrimite(async () => {
      const r = await distribuie({
        canal,
        zi,
        firmaIds,
        conturi: aleseInOrdine,
        numere: egal ? null : aleseInOrdine.map((k) => Number(numere[k]) || 0),
        ordine,
        alocari,
        proba: false,
      }).catch(() => ({ ok: false as const, message: "Conexiunea a căzut: nu știm dacă s-a programat. Verifică pagina canalului." }));
      if (!r.ok) {
        notify(r.message, "error");
        setEroare(r.message);
        return;
      }
      notify(r.message, r.data?.avertismente.length ? "warn" : undefined);
      router.refresh();
      onGata();
    });

  const comutaCont = (cheie: string) => setAlese((v) => (v.includes(cheie) ? v.filter((x) => x !== cheie) : [...v, cheie]));
  const numeCont = (cheie: string) => conturi.find((c) => c.cheie === cheie)?.nume ?? cheie;

  return (
    <div className="flex max-h-[min(90vh,54rem)] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-5 pb-4 pt-5 sm:px-6">
        <h2 className="text-[18px] font-semibold">
          Distribuie <span className="pu-num text-muted-foreground">{num(n)}</span>
        </h2>
        <Info label="Regulile">
          Același canal nu se folosește de două ori pe o firmă. Se sar firmele „Nu contacta”, respinse sau duplicate. WhatsApp și email: doar cu link demo verificat;
          WhatsApp: doar cu mobil 07xx. Emailul pleacă de pe căsuța domeniului din linkul demo. Limita zilnică a unui cont e doar avertisment.
        </Info>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
        <Pas n={1} titlu="Canalul">
          <div role="radiogroup" aria-label="Canalul" className="inline-flex flex-wrap gap-1 rounded-xl border border-white/[0.1] p-1">
            {CANALE.map((c) => {
              const s = stare(c.canal);
              const oprit = s?.activ === false;
              return (
                <label
                  key={c.canal}
                  title={oprit ? `Suspendat${s?.motiv ? `: ${s.motiv}` : ""}` : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lav",
                    oprit ? "cursor-not-allowed text-muted-foreground/50" : "cursor-pointer",
                    canal === c.canal && !oprit ? "bg-white/[0.1] text-foreground" : !oprit && "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <input type="radio" name={`${id}-canal`} value={c.canal} checked={canal === c.canal} disabled={oprit} onChange={() => setCanal(c.canal)} className="sr-only" />
                  {c.label}
                  {oprit ? <span className="text-[12.5px]">· suspendat</span> : null}
                </label>
              );
            })}
          </div>
        </Pas>

        <Pas n={2} titlu="Conturile" info={canal === "email" ? "Fiecare firmă pleacă de pe căsuța domeniului din linkul ei demo; numerele scrise sunt plafoane." : undefined}>
          {conturi.length === 0 ? (
            <p className="text-[14px] text-muted-foreground">Niciun cont activ pe acest canal. Le activezi din Setări.</p>
          ) : (
            <div className="space-y-2">
              <label className="flex w-fit cursor-pointer items-center gap-2 text-[14px]">
                <input type="checkbox" className="h-4 w-4 accent-[#C6B5FF]" checked={egal} onChange={(e) => setEgal(e.target.checked)} />
                Împarte egal
              </label>
              <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
                {conturi.map((c) => {
                  const ales = alese.includes(c.cheie);
                  const pe = rezumat?.pe_conturi.find((p) => p.cheie === c.cheie);
                  return (
                    <li key={c.cheie} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-[14px]">
                        <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#C6B5FF]" checked={ales} onChange={() => comutaCont(c.cheie)} />
                        <span className="min-w-0 truncate font-medium">{c.nume}</span>
                        {c.detaliu ? <span className="shrink-0 text-muted-foreground">· {c.detaliu}</span> : null}
                      </label>
                      {pe && ales ? (
                        <span className={cn("pu-num text-[13px]", pe.peste_limita ? "text-apricot" : "text-muted-foreground")}>
                          {num(pe.deja)} deja · limită {num(pe.limita)}
                        </span>
                      ) : null}
                      {!egal && ales ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={n}
                          value={numere[c.cheie] ?? ""}
                          placeholder="0"
                          onChange={(e) => setNumere((v) => ({ ...v, [c.cheie]: e.target.value }))}
                          aria-label={`Câte firme pe ${c.nume}`}
                          className={inputClass("pu-num h-8 w-20 text-right")}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {!egal ? (
                <p className={cn("pu-num text-[13.5px]", suma === n ? "text-muted-foreground" : "text-apricot")} aria-live="polite">
                  Suma {num(suma)} / {num(n)}
                  {suma !== n ? ` — trebuie să fie ${num(n)}` : ""}
                </p>
              ) : null}
            </div>
          )}
        </Pas>

        <Pas n={3} titlu="Ordinea" info="Primul cont primește primele firme din ordinea aleasă, al doilea următoarele.">
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Ordinea" className="inline-flex rounded-xl border border-white/[0.1] p-1">
              {(
                [
                  ["scor", "După scor"],
                  ["recente", "Cele mai recente"],
                ] as [OrdineDistribuire, string][]
              ).map(([v, label]) => (
                <label
                  key={v}
                  className={cn(
                    "cursor-pointer rounded-lg px-3 py-1.5 text-[14px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lav",
                    ordine === v ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <input type="radio" name={`${id}-ordine`} value={v} checked={ordine === v} onChange={() => setOrdine(v)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[14px]">
              <span className="text-muted-foreground">Ziua</span>
              <input
                type="date"
                value={zi}
                min={date.azi}
                max={plusZile(date.azi, 60)}
                onChange={(e) => setZi(e.target.value || date.azi)}
                className={inputClass("h-8 w-auto")}
              />
              {zi === date.azi ? <span className="text-muted-foreground">azi</span> : null}
            </label>
          </div>
        </Pas>

        <section aria-live="polite" className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3">
          {!canalActiv ? (
            <p className="text-[14px] text-rose">Canalul e suspendat din Setări.</p>
          ) : eroare ? (
            <p role="alert" className="text-[14px] text-rose">
              {eroare}
            </p>
          ) : !gata ? (
            <p className="text-[14px] text-muted-foreground">{aleseInOrdine.length === 0 ? "Alege cel puțin un cont." : `Suma pe conturi trebuie să fie ${num(n)}.`}</p>
          ) : !rezumat ? (
            <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> Se calculează…
            </p>
          ) : (
            <div className={cn("space-y-2", incarc && "opacity-60")}>
              <p className="text-[14.5px] leading-relaxed">
                <span className="pu-num font-semibold">{num(rezumat.programate)}</span> vor fi programate {zi === date.azi ? "azi" : `pe ${ziRo(zi)}`}
                {rezumat.programate > 0 ? ": " : ""}
                {rezumat.pe_conturi
                  .filter((p) => p.n > 0)
                  .map((p) => `${p.nume} = ${num(p.n)}`)
                  .join(", ")}
                {rezumat.sarite.length ? (
                  <>
                    ;{" "}
                    <span className="pu-num font-semibold">{num(rezumat.sarite.length)}</span> sărite
                  </>
                ) : null}
                .
              </p>
              {rezumat.avertismente.map((a) => (
                <p key={a} className="flex items-start gap-1.5 text-[13.5px] text-apricot">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {a}
                </p>
              ))}
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
                          <span className="pu-num text-muted-foreground">{s.nr_site ? `site ${s.nr_site}` : `#${s.nr}`}</span> {s.nume}: <span className="text-foreground/75">{s.motiv}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <div>
          <button
            type="button"
            aria-expanded={avansat}
            onClick={() => setAvansat((v) => !v)}
            className="rounded-sm text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Opțiuni avansate
          </button>
          {avansat ? (
            rezumat && rezumat.firme.length ? (
              <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-white/[0.08]">
                <table className="w-full border-collapse text-left text-[13.5px]">
                  <caption className="sr-only">Contul fiecărei firme</caption>
                  <thead className="sticky top-0 bg-[#1A1A22] text-[12px] uppercase tracking-[0.08em] text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Site
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Firmă
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Scor
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Cont
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rezumat.firme.map((f) => (
                      <tr key={f.id} className="border-t border-white/[0.05]">
                        <td className="pu-num px-3 py-1.5 text-muted-foreground">{f.nr_site ?? "—"}</td>
                        <td className="max-w-[16rem] truncate px-3 py-1.5">{f.nume}</td>
                        <td className="pu-num px-3 py-1.5 text-right">{f.scor ?? "—"}</td>
                        <td className="px-3 py-1">
                          <select
                            value={alocari[f.id] ?? f.cont}
                            onChange={(e) =>
                              setAlocari((v) => {
                                const nou = { ...v };
                                if (e.target.value === f.cont && !f.fixat) delete nou[f.id];
                                else nou[f.id] = e.target.value;
                                return nou;
                              })
                            }
                            aria-label={`Contul pentru ${f.nume}`}
                            className={inputClass("h-8 py-0 text-[13.5px]")}
                          >
                            {aleseInOrdine.map((k) => (
                              <option key={k} value={k} className="bg-[#14141A]">
                                {numeCont(k)}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-[13.5px] text-muted-foreground">Tabelul apare după rezumat.</p>
            )
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3.5 sm:px-6">
        <button type="button" className={btnClass({ variant: "ghost", size: "sm" })} onClick={onInchide}>
          Renunță
        </button>
        <button
          type="button"
          className={btnClass({ variant: "primary", size: "sm" })}
          disabled={!gata || !rezumat || rezumat.programate === 0 || incarc || trimit}
          onClick={confirma}
        >
          {trimit ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {trimit ? "Programez…" : `Programează ${rezumat && rezumat.programate > 0 ? num(rezumat.programate) : ""}`.trim()}
        </button>
      </div>
    </div>
  );
}

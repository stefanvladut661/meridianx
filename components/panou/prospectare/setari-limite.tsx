"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Mail, Save } from "lucide-react";
import { salveazaLimite, seteazaCasuta } from "@/app/(admin)/admin/prospectare/actions";
import { timeRo } from "@/components/panou/ui/format";
import { Btn, Card, SectionTitle } from "@/components/panou/ui/primitives";
import { inputClass } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import type { Casuta, Setari } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { EroareCitire } from "./prezentare-eroare";

/**
 * „Limite” din Setări, ca în prototip: încercările la „Nu răspunde” și
 * plafonul fiecărei căsuțe; plus ce are baza și prototipul nu: scorul minim al
 * cozii comune de construcție, ora rezervării, cererile pe minut și oprirea
 * unei căsuțe. Limitele pe cont WhatsApp stau acum la „Conturi WhatsApp”.
 * Un singur buton salvează tot ce s-a schimbat.
 */

type Limite = Pick<Setari, "incercari_max" | "rezervare_ore" | "cereri_pe_minut" | "scor_minim_constructie">;
type Stare = { ton: "ok" | "eroare"; text: string } | null;

const intreg = (s: string, min: number, max: number): boolean => /^\d+$/.test(s.trim()) && Number(s) >= min && Number(s) <= max;

const limitaDin = (c: Casuta): string => (c.limita_zi === null ? "" : String(c.limita_zi));

/** Mesajul acțiunii spune câmpul: îl punem sub el. */
function campDinMesaj(message: string): string | null {
  if (message.startsWith("Încercări")) return "incercari";
  if (message.startsWith("Rezervarea")) return "rezervare";
  if (message.startsWith("Cereri pe minut")) return "cereri";
  if (message.startsWith("Scorul minim")) return "scor";
  return null;
}

function Eroare({ id, text }: { id: string; text: string | undefined }) {
  if (!text) return null;
  return (
    <span id={id} role="alert" className="mt-1 block text-[11.5px] text-rose">
      {text}
    </span>
  );
}

function Camp({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  max,
  eroare,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  eroare?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={eroare ? true : undefined}
        aria-describedby={eroare ? `${id}-e` : hint ? `${id}-h` : undefined}
        className={inputClass(cn("mt-1.5", eroare && "border-rose/50"))}
      />
      {eroare ? (
        <Eroare id={`${id}-e`} text={eroare} />
      ) : hint ? (
        <span id={`${id}-h`} className="mt-1 block text-[11.5px] text-muted-foreground/80">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function SetariLimite({ setari, casute, eroareCasute }: { setari: Limite; casute: Casuta[] | null; eroareCasute: string | null }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  const [incercari, setIncercari] = useState(String(setari.incercari_max));
  const [rezervare, setRezervare] = useState(String(setari.rezervare_ore));
  const [cereri, setCereri] = useState(String(setari.cereri_pe_minut));
  const [scor, setScor] = useState(String(setari.scor_minim_constructie));
  const [limite, setLimite] = useState<Record<string, string>>(() => Object.fromEntries((casute ?? []).map((c) => [c.adresa, limitaDin(c)])));
  const [active, setActive] = useState<Record<string, boolean>>(() => Object.fromEntries((casute ?? []).map((c) => [c.adresa, c.activa])));
  const [erori, setErori] = useState<Record<string, string>>({});
  const [stare, setStare] = useState<Stare>(null);

  const limiteSchimbate =
    incercari.trim() !== String(setari.incercari_max) ||
    rezervare.trim() !== String(setari.rezervare_ore) ||
    cereri.trim() !== String(setari.cereri_pe_minut) ||
    scor.trim() !== String(setari.scor_minim_constructie);

  const casuteSchimbate = useMemo(
    () => (casute ?? []).filter((c) => (limite[c.adresa] ?? limitaDin(c)).trim() !== limitaDin(c) || (active[c.adresa] ?? c.activa) !== c.activa),
    [casute, limite, active]
  );
  const schimbat = limiteSchimbate || casuteSchimbate.length > 0;

  const curata = (cheie: string) => {
    setStare(null);
    if (erori[cheie]) setErori((e) => ({ ...e, [cheie]: "" }));
  };

  const valideaza = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!intreg(incercari, 1, 10)) e.incercari = "Încercări: între 1 și 10.";
    if (!intreg(rezervare, 1, 24)) e.rezervare = "Rezervarea: între 1 și 24 de ore.";
    if (!intreg(cereri, 10, 6000)) e.cereri = "Cereri pe minut: între 10 și 6000.";
    if (!intreg(scor, 0, 1000)) e.scor = "Scorul minim: între 0 și 1000.";
    for (const c of casute ?? []) {
      const v = (limite[c.adresa] ?? limitaDin(c)).trim();
      if (v !== "" && !intreg(v, 0, 2000)) e[`c:${c.adresa}`] = "Limita: între 0 și 2000, sau gol.";
    }
    return e;
  };

  const salveaza = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e = valideaza();
    setErori(e);
    if (Object.keys(e).length) {
      setStare({ ton: "eroare", text: "Corectează câmpurile marcate cu roșu." });
      return;
    }
    setStare(null);
    startTransition(async () => {
      const mesaje: string[] = [];
      if (limiteSchimbate) {
        const result = await salveazaLimite({
          incercariMax: Number(incercari),
          rezervareOre: Number(rezervare),
          cereriPeMinut: Number(cereri),
          scorMinimConstructie: Number(scor),
        });
        if (!result.ok) {
          const camp = campDinMesaj(result.message);
          if (camp) setErori({ [camp]: result.message });
          setStare({ ton: "eroare", text: result.message });
          notify(result.message, "error");
          router.refresh();
          return;
        }
        mesaje.push(result.message);
      }
      for (const c of casuteSchimbate) {
        const v = (limite[c.adresa] ?? limitaDin(c)).trim();
        const result = await seteazaCasuta({ adresa: c.adresa, limitaZi: v === "" ? "" : Number(v), activa: active[c.adresa] ?? c.activa });
        if (!result.ok) {
          setErori({ [`c:${c.adresa}`]: result.message });
          setStare({ ton: "eroare", text: `${c.adresa}: ${result.message}` });
          notify(`${c.adresa}: ${result.message}`, "error");
          router.refresh();
          return;
        }
        mesaje.push(casuteSchimbate.length === 1 ? `${c.adresa}: ${result.message}` : "");
      }
      if (casuteSchimbate.length > 1) mesaje.push(`${casuteSchimbate.length} căsuțe actualizate.`);
      notify(mesaje.filter(Boolean).join(" ") || "Limitele sunt salvate.");
      setStare({ ton: "ok", text: `Salvat la ${timeRo(new Date())}.` });
      router.refresh();
    });
  };

  return (
    <Card>
      <SectionTitle title="Limite" hint="Se aplică de la următoarea rulare a zilei" />
      <form onSubmit={salveaza} noValidate aria-busy={pending}>
        <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-4">
          <fieldset className="min-w-0 space-y-3">
            <legend className="flex items-center gap-1.5 text-[12.5px] font-medium">
              <Bot className="h-3.5 w-3.5 text-lav" aria-hidden="true" />
              Roboți și apeluri
            </legend>

            <Camp
              id="scor"
              label="Scor minim pentru coada de construcție"
              hint="Roboții construiesc doar firme cu cel puțin acest scor și cu email sau mobil."
              value={scor}
              onChange={(v) => {
                setScor(v);
                curata("scor");
              }}
              min={0}
              max={1000}
              eroare={erori.scor}
            />

            <Camp
              id="incercari"
              label="Încercări la „Nu răspunde”"
              hint="La atingerea limitei, firma iese din listă și revine în rezervă."
              value={incercari}
              onChange={(v) => {
                setIncercari(v);
                curata("incercari");
              }}
              min={1}
              max={10}
              eroare={erori.incercari}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Camp
                id="rezervare"
                label="Rezervarea, în ore"
                hint="Cât ține un robot o firmă până o poate lua altul."
                value={rezervare}
                onChange={(v) => {
                  setRezervare(v);
                  curata("rezervare");
                }}
                min={1}
                max={24}
                eroare={erori.rezervare}
              />
              <Camp
                id="cereri"
                label="Cereri pe minut, pe robot"
                hint="Peste ea, robotul primește 429 și așteaptă un minut."
                value={cereri}
                onChange={(v) => {
                  setCereri(v);
                  curata("cereri");
                }}
                min={10}
                max={6000}
                eroare={erori.cereri}
              />
            </div>
          </fieldset>

          <fieldset className="min-w-0 space-y-2">
            <legend className="flex items-center gap-1.5 text-[12.5px] font-medium">
              <Mail className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
              Plafon email pe căsuță
            </legend>
            {casute === null ? (
              <EroareCitire title="Căsuțele nu s-au putut citi" message={eroareCasute ?? "Căsuțele nu s-au putut citi."} className="py-6" />
            ) : casute.length === 0 ? (
              <p className="pt-1 text-[12px] leading-relaxed text-muted-foreground">Nicio căsuță încă. O căsuță apare aici după primul email trimis de pe ea; apoi îi poți pune plafonul.</p>
            ) : (
              <ul className="space-y-2 pt-1">
                {casute.map((c, i) => {
                  const id = `casuta-${i}`;
                  const eroare = erori[`c:${c.adresa}`];
                  const activa = active[c.adresa] ?? c.activa;
                  const auto = c.limita_zi === null && c.limita_azi !== null ? `auto · ${c.limita_azi}` : "auto";
                  return (
                    <li key={c.adresa}>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <label htmlFor={id} className={cn("col-span-2 min-w-0 truncate text-[11.5px] sm:col-span-1", activa ? "text-muted-foreground" : "text-muted-foreground/60 line-through")} title={c.adresa}>
                          {c.adresa}
                          <span className="sr-only">: plafon pe zi</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={activa}
                            onChange={(e) => {
                              const v = e.target.checked;
                              setActive((a) => ({ ...a, [c.adresa]: v }));
                              setStare(null);
                            }}
                            className="h-3.5 w-3.5 accent-[#C6B5FF]"
                          />
                          trimite
                          <span className="sr-only"> de pe {c.adresa}</span>
                        </label>
                        <input
                          id={id}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={2000}
                          step={1}
                          value={limite[c.adresa] ?? limitaDin(c)}
                          placeholder={auto}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLimite((l) => ({ ...l, [c.adresa]: v }));
                            curata(`c:${c.adresa}`);
                          }}
                          aria-invalid={eroare ? true : undefined}
                          aria-describedby={eroare ? `${id}-e` : "casute-h"}
                          className={inputClass(cn("h-8 w-24 text-right", eroare && "border-rose/50"))}
                        />
                      </div>
                      <Eroare id={`${id}-e`} text={eroare} />
                    </li>
                  );
                })}
              </ul>
            )}
            <p id="casute-h" className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
              O căsuță atinsă nu mai trimite până a doua zi. Gol = limita o dă încălzirea robotului; 0 = nu trimite azi. Fără bifa „trimite”, căsuța e oprită din admin.
            </p>
          </fieldset>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
          <p aria-live="polite" className={cn("text-[11.5px]", stare?.ton === "eroare" ? "text-rose" : "text-muted-foreground")}>
            {pending ? "Se salvează…" : (stare?.text ?? (schimbat ? "Modificări nesalvate." : ""))}
          </p>
          <Btn type="submit" size="sm" variant="primary" icon={pending ? Loader2 : Save} disabled={!schimbat || pending}>
            Salvează limitele
          </Btn>
        </div>
      </form>
    </Card>
  );
}

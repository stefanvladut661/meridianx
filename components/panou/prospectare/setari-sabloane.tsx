"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { salveazaSablon } from "@/app/(admin)/admin/prospectare/actions";
import { timeRo } from "@/components/panou/ui/format";
import { Btn, Card, SectionTitle } from "@/components/panou/ui/primitives";
import { inputClass } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import { umpleSablon } from "@/lib/prospectare/contact";
import type { Setari } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/**
 * „Șabloane de mesaj” din Setări, ca în prototip, plus previzualizarea pe o
 * firmă inventată (cu `umpleSablon`, aceeași funcție ca în Apeluri și
 * WhatsApp) și avertismentul pentru variabilele scrise greșit.
 */

type Cheie = "sablon_whatsapp_primul" | "sablon_whatsapp_dupa_apel" | "sablon_script_apel";
type Stare = { ton: "ok" | "eroare"; text: string } | null;

const VARIABILE: { v: string; ce: string }[] = [
  { v: "{nume_firma}", ce: "numele firmei" },
  { v: "{persoana_contact}", ce: "persoana de contact (lipsă: salut fără nume)" },
  { v: "{link_demo}", ce: "linkul site-ului demo" },
  { v: "{oras}", ce: "orașul firmei" },
  { v: "{nume_titular}", ce: "titularul contului WhatsApp de pe care pleacă (Setări → Conturi)" },
  { v: "{problema}", ce: "problema site-ului vechi (de la robot); lipsă: rândul dispare" },
  { v: "{puncte}", ce: "cele 3 schimbări, pe rânduri cu „* ” (de la robot); lipsă: rândurile dispar" },
  { v: "{utilizator}", ce: "cine sună, din comutatorul de la Apeluri (gol în primul mesaj WhatsApp)" },
];
const CUNOSCUTE = new Set(VARIABILE.map((x) => x.v));

const SABLOANE: { cheie: Cheie; label: string; hint: string }[] = [
  { cheie: "sablon_whatsapp_primul", label: "WhatsApp — primul mesaj", hint: "Din „WhatsApp azi”, o dată pe firmă." },
  { cheie: "sablon_whatsapp_dupa_apel", label: "WhatsApp — după apel „Interesat”", hint: "Se deschide singur la „Interesat”." },
  { cheie: "sablon_script_apel", label: "Script de apel", hint: "Pe fiecare card din „Apeluri azi”." },
];

const MIN = 10;
const MAX = 2000;

/** Firmă inventată, doar pentru previzualizare. */
const EXEMPLU = {
  nume: "Tâmplăria Exemplu",
  persoana_contact: "Ana Popescu",
  link_demo: "https://demo-exemplu.meridianx.ro",
  oras: "Cluj-Napoca",
  date_extra: {
    problema: "numărul de telefon nu se poate apăsa de pe mobil",
    puncte: ["clienții vă sună dintr-o atingere", "cererea de ofertă e pe prima pagină", "lucrările voastre se văd din prima"],
  },
};
/** Aceeași firmă, fără datele robotului: varianta scurtă a mesajului WhatsApp. */
const EXEMPLU_SCURT = { ...EXEMPLU, date_extra: {} };

/** În lista de WhatsApp se trimite de pe un cont, nu în numele cuiva: acolo {utilizator} rămâne gol. */
const faraUtilizator = (cheie: Cheie): boolean => cheie === "sablon_whatsapp_primul";

const necunoscute = (text: string): string[] => [...new Set(text.match(/\{[^{}\s]{1,40}\}/g) ?? [])].filter((v) => !CUNOSCUTE.has(v));

export function SetariSabloane({ sabloane, utilizator }: { sabloane: Pick<Setari, Cheie>; utilizator: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState<Record<Cheie, string>>({ ...sabloane });
  const [erori, setErori] = useState<Partial<Record<Cheie, string>>>({});
  const [stare, setStare] = useState<Stare>(null);

  const schimbate = SABLOANE.filter((s) => text[s.cheie].trim() !== sabloane[s.cheie].trim());

  const salveaza = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const e: Partial<Record<Cheie, string>> = {};
    for (const s of schimbate) {
      const t = text[s.cheie].trim();
      if (t.length < MIN) e[s.cheie] = "Șablonul e prea scurt.";
      else if (t.length > MAX) e[s.cheie] = "Șablonul: cel mult 2000 de caractere.";
    }
    setErori(e);
    if (Object.keys(e).length) {
      setStare({ ton: "eroare", text: "Corectează șabloanele marcate cu roșu." });
      return;
    }
    setStare(null);
    startTransition(async () => {
      for (const s of schimbate) {
        const result = await salveazaSablon({ cheie: s.cheie, text: text[s.cheie] });
        if (!result.ok) {
          const camp: Partial<Record<Cheie, string>> = {};
          camp[s.cheie] = result.message;
          setErori(camp);
          setStare({ ton: "eroare", text: `${s.label}: ${result.message}` });
          notify(`${s.label}: ${result.message}`, "error");
          router.refresh();
          return;
        }
      }
      notify(schimbate.length === 1 ? "Șablon salvat." : "Șabloane salvate.");
      setStare({ ton: "ok", text: `Salvat la ${timeRo(new Date())}.` });
      router.refresh();
    });
  };

  return (
    <Card>
      <SectionTitle title="Șabloane de mesaj" info="Variabilele se înlocuiesc pentru fiecare firmă. Mesajele pleacă manual, din telefonul vostru: portalul doar pregătește textul." />
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Variabile">
        {VARIABILE.map((x) => (
          <li key={x.v}>
            <code className="rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[13px] text-muted-foreground" title={x.ce}>
              {x.v}
            </code>
            <span className="sr-only">: {x.ce}</span>
          </li>
        ))}
      </ul>

      <form onSubmit={salveaza} noValidate aria-busy={pending}>
        <div className="mt-4 space-y-5">
          {SABLOANE.map((s) => {
            const id = `sablon-${s.cheie}`;
            const valoare = text[s.cheie];
            const eroare = erori[s.cheie];
            const gresite = necunoscute(valoare);
            const lungime = valoare.trim().length;
            return (
              <div key={s.cheie}>
                <label htmlFor={id} className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {s.label}
                </label>
                <textarea
                  id={id}
                  value={valoare}
                  onChange={(e) => {
                    const v = e.target.value;
                    setText((t) => ({ ...t, [s.cheie]: v }));
                    setStare(null);
                    if (erori[s.cheie]) {
                      setErori((x) => {
                        const rest = { ...x };
                        delete rest[s.cheie];
                        return rest;
                      });
                    }
                  }}
                  rows={faraUtilizator(s.cheie) ? 9 : 3}
                  maxLength={MAX + 200}
                  aria-invalid={eroare ? true : undefined}
                  aria-describedby={`${id}-h${eroare ? ` ${id}-e` : ""}`}
                  className={inputClass(cn("mt-1.5 h-auto resize-y py-2 leading-relaxed", eroare && "border-rose/50"))}
                />
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px] text-muted-foreground/80">
                  <span id={`${id}-h`}>{s.hint}</span>
                  <span className={cn("pu-num", lungime > MAX && "text-rose")}>
                    {lungime}/{MAX}
                  </span>
                </div>
                {eroare ? (
                  <span id={`${id}-e`} role="alert" className="mt-1 block text-[13px] text-rose">
                    {eroare}
                  </span>
                ) : null}
                {faraUtilizator(s.cheie) && valoare.includes("{utilizator}") ? (
                  <p className="mt-1 text-[13px] text-apricot">
                    {"{utilizator}"} rămâne gol aici. Scoate-l din mesaj.
                  </p>
                ) : null}
                {gresite.length ? (
                  <p className="mt-1 text-[13px] text-apricot">
                    {gresite.length === 1 ? "Variabilă necunoscută" : "Variabile necunoscute"}: {gresite.join(", ")}. Rămân ca text în mesaj.
                  </p>
                ) : null}
                <div className={cn("mt-2 grid gap-2", faraUtilizator(s.cheie) && "lg:grid-cols-2")}>
                  <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground">Exemplu · {EXEMPLU.nume}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground/85">
                      {umpleSablon(valoare, EXEMPLU, faraUtilizator(s.cheie) ? "" : utilizator, "Ștefan") || <span className="text-muted-foreground">Șablonul e gol.</span>}
                    </p>
                  </div>
                  {faraUtilizator(s.cheie) ? (
                    <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-3 py-2.5">
                      <p className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground">Varianta scurtă · fără problemă și puncte</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground/85">
                        {umpleSablon(valoare, EXEMPLU_SCURT, "", "Ștefan") || <span className="text-muted-foreground">Șablonul e gol.</span>}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
          <p aria-live="polite" className={cn("text-[13px]", stare?.ton === "eroare" ? "text-rose" : "text-muted-foreground")}>
            {pending ? "Se salvează…" : (stare?.text ?? (schimbate.length ? (schimbate.length === 1 ? "Un șablon nesalvat." : `${schimbate.length} șabloane nesalvate.`) : ""))}
          </p>
          <Btn type="submit" size="sm" variant="primary" icon={pending ? Loader2 : Save} disabled={!schimbate.length || pending}>
            Salvează șabloanele
          </Btn>
        </div>
      </form>
    </Card>
  );
}

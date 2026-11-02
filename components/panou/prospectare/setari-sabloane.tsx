"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone, Save } from "lucide-react";
import { salveazaSablon } from "@/app/(admin)/admin/prospectare/actions";
import { InlineNote } from "@/components/panou/ui/actions";
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
  { v: "{persoana_contact}", ce: "persoana de contact (dacă lipsește, salutul rămâne fără nume)" },
  { v: "{link_demo}", ce: "linkul site-ului demo" },
  { v: "{oras}", ce: "orașul firmei" },
  { v: "{utilizator}", ce: "cine lucrează: Ștefan sau Vlăduț, din comutator" },
];
const CUNOSCUTE = new Set(VARIABILE.map((x) => x.v));

const SABLOANE: { cheie: Cheie; label: string; hint: string }[] = [
  { cheie: "sablon_whatsapp_primul", label: "WhatsApp — primul mesaj", hint: "Mesajul din lista de WhatsApp. Fiecare firmă îl primește o singură dată." },
  { cheie: "sablon_whatsapp_dupa_apel", label: "WhatsApp — după apel „Interesat”", hint: "Se deschide automat când marchezi o firmă interesată la telefon." },
  { cheie: "sablon_script_apel", label: "Script de apel", hint: "Se vede pliabil pe fiecare card din Apeluri azi." },
];

const MIN = 10;
const MAX = 2000;

/** Firmă inventată, doar pentru previzualizare. */
const EXEMPLU = { nume: "Tâmplăria Exemplu", persoana_contact: "Ana Popescu", link_demo: "https://demo-exemplu.meridianx.ro", oras: "Cluj-Napoca" };

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
      notify(schimbate.length === 1 ? "Șablonul e salvat." : "Șabloanele sunt salvate.");
      setStare({ ton: "ok", text: `Salvat la ${timeRo(new Date())}.` });
      router.refresh();
    });
  };

  return (
    <Card>
      <SectionTitle title="Șabloane de mesaj" hint="Variabilele se înlocuiesc automat pentru fiecare firmă" />
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Variabile">
        {VARIABILE.map((x) => (
          <li key={x.v}>
            <code className="rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground" title={x.ce}>
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
                <label htmlFor={id} className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
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
                  rows={3}
                  maxLength={MAX + 200}
                  aria-invalid={eroare ? true : undefined}
                  aria-describedby={`${id}-h${eroare ? ` ${id}-e` : ""}`}
                  className={inputClass(cn("mt-1.5 h-auto resize-y py-2 leading-relaxed", eroare && "border-rose/50"))}
                />
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground/80">
                  <span id={`${id}-h`}>{s.hint}</span>
                  <span className={cn("pu-num", lungime > MAX && "text-rose")}>
                    {lungime}/{MAX}
                  </span>
                </div>
                {eroare ? (
                  <span id={`${id}-e`} role="alert" className="mt-1 block text-[11.5px] text-rose">
                    {eroare}
                  </span>
                ) : null}
                {gresite.length ? (
                  <p className="mt-1 text-[11.5px] text-apricot">
                    {gresite.length === 1 ? "Variabilă necunoscută" : "Variabile necunoscute"}: {gresite.join(", ")}. Rămân așa, ca text, în mesaj.
                  </p>
                ) : null}
                <div className="mt-2 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-3 py-2.5">
                  <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Exemplu · firmă inventată ({EXEMPLU.nume})</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-foreground/85">
                    {umpleSablon(valoare, EXEMPLU, utilizator) || <span className="text-muted-foreground">Șablonul e gol.</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <InlineNote tone="neutral" className="mt-4 flex items-start gap-2">
          <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Mesajele pleacă manual, din telefonul vostru. Portalul doar pregătește textul și linkul, nu trimite singur.
        </InlineNote>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
          <p aria-live="polite" className={cn("text-[11.5px]", stare?.ton === "eroare" ? "text-rose" : "text-muted-foreground")}>
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

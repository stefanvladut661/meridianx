"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Pencil, Plus, Power, PowerOff, Save } from "lucide-react";
import { salveazaContWhatsapp } from "@/app/(admin)/admin/prospectare/actions";
import { InlineNote } from "@/components/panou/ui/actions";
import { num } from "@/components/panou/ui/format";
import { Modal } from "@/components/panou/ui/modal";
import { Btn, Card, Pill, SectionTitle } from "@/components/panou/ui/primitives";
import { inputClass } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import { numarScurt } from "@/lib/prospectare/contact";
import type { ContWhatsapp } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { CAMP, TAP_SM } from "./apeluri-ui";
import { EroareCitire } from "./prezentare-eroare";
import { telefonCont } from "./whatsapp-card";

/**
 * „Conturi WhatsApp” din Setări: numerele de pe care se trimite din „WhatsApp
 * azi”, cu numele și limita pe zi (doar avertisment). Se adaugă, se editează și
 * se dezactivează; nu se șterg, ca firmele trimise de pe ele să-și păstreze contul.
 */

type Camp = "nume" | "telefon" | "limita";
type Erori = Partial<Record<Camp | "general", string>>;

const LIMITA_IMPLICITA = 30;
const TELEFON_RO = /^(40|0)?7\d{8}$/;

const intreg = (s: string, min: number, max: number): boolean => /^\d+$/.test(s.trim()) && Number(s) >= min && Number(s) <= max;

/** Mesajul acțiunii (sau al bazei) spune câmpul: îl punem sub el. */
function campDinMesaj(message: string): Camp | "general" {
  if (message.startsWith("Contul are nevoie") || message.startsWith("Numele")) return "nume";
  if (message.startsWith("Numărul contului")) return "telefon";
  if (message.startsWith("Limita")) return "limita";
  return "general";
}

function CampCont({
  id,
  label,
  hint,
  eroare,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  eroare?: string;
  children: (descriere: string | undefined) => ReactNode;
}) {
  const descriere = eroare ? `${id}-e` : hint ? `${id}-h` : undefined;
  return (
    <div>
      <label htmlFor={id} className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      {children(descriere)}
      {eroare ? (
        <span id={`${id}-e`} role="alert" className="mt-1 block text-[12px] text-rose sm:text-[11.5px]">
          {eroare}
        </span>
      ) : hint ? (
        <span id={`${id}-h`} className="mt-1 block text-[12px] text-muted-foreground/80 sm:text-[11.5px]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Formularul din dialog: cont nou (fără `cont`) sau editarea unuia existent. Se montează la fiecare deschidere. */
function FormularCont({ cont, toate, onGata }: { cont: ContWhatsapp | null; toate: ContWhatsapp[]; onGata: () => void }) {
  const router = useRouter();
  const { notify } = useToast();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const urmatorul = toate.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  const [nume, setNume] = useState(cont?.nume ?? `Cont ${urmatorul}`);
  const [telefon, setTelefon] = useState(cont?.telefon ?? "");
  const [limita, setLimita] = useState(String(cont?.limita_zi ?? LIMITA_IMPLICITA));
  const [erori, setErori] = useState<Erori>({});

  const curata = (camp: Camp) => {
    if (erori[camp] || erori.general) setErori((e) => ({ ...e, [camp]: undefined, general: undefined }));
  };

  const valideaza = (): Erori => {
    const e: Erori = {};
    const n = nume.trim();
    if (!n) e.nume = "Contul are nevoie de un nume.";
    else if (n.length > 60) e.nume = "Numele: cel mult 60 de caractere.";
    const cifre = telefon.replace(/\D/g, "");
    if (!TELEFON_RO.test(cifre)) e.telefon = "Numărul contului: un mobil românesc, ex. +40 771 464 310.";
    else {
      const dublura = toate.find((c) => c.id !== cont?.id && numarScurt(c.telefon) === numarScurt(telefon));
      if (dublura) e.telefon = `Numărul e deja pe „${dublura.nume}”.`;
    }
    if (!intreg(limita, 0, 1000)) e.limita = "Limita pe zi: între 0 și 1000.";
    const numeDublura = n ? toate.find((c) => c.id !== cont?.id && c.nume.trim().toLowerCase() === n.toLowerCase()) : undefined;
    if (!e.nume && numeDublura) e.nume = `Există deja un cont „${numeDublura.nume}”: alege alt nume, ca să le deosebești pe telefon.`;
    return e;
  };

  const salveaza = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const e = valideaza();
    setErori(e);
    if (Object.keys(e).length) return;
    startTransition(async () => {
      const result = await salveazaContWhatsapp({
        id: cont?.id ?? null,
        nume: nume.trim(),
        telefon: telefon.trim(),
        limita: Number(limita),
        activ: cont?.activ ?? true,
      }).catch(() => ({ ok: false as const, message: "Conexiunea a căzut și nu știm dacă s-a salvat. Închide dialogul și verifică lista." }));
      if (!result.ok) {
        setErori({ [campDinMesaj(result.message)]: result.message });
        return;
      }
      notify(cont ? result.message : `${result.message} Apare acum în „WhatsApp azi”.`);
      router.refresh();
      onGata();
    });
  };

  return (
    <form onSubmit={salveaza} noValidate aria-busy={pending}>
      <h2 className="text-[17px] font-semibold">{cont ? `Editează ${cont.nume}` : "Adaugă un cont WhatsApp"}</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
        {cont
          ? "Numele și numărul se schimbă și pe telefoanele care l-au ales. Firmele trimise deja de pe el rămân pe el."
          : "Contul apare imediat în „WhatsApp azi”, ca buton de ales."}
      </p>

      <div className="mt-4 space-y-3">
        <CampCont id={`${id}-nume`} label="Nume" hint="Cum îl recunoașteți pe telefon, ex. „Cont 4” sau „Telefonul de birou”." eroare={erori.nume}>
          {(descriere) => (
            <input
              id={`${id}-nume`}
              value={nume}
              onChange={(e) => {
                setNume(e.target.value);
                curata("nume");
              }}
              maxLength={80}
              autoComplete="off"
              aria-invalid={erori.nume ? true : undefined}
              aria-describedby={descriere}
              className={inputClass(cn("mt-1.5", CAMP, erori.nume && "border-rose/50"))}
            />
          )}
        </CampCont>

        <CampCont id={`${id}-telefon`} label="Număr" hint="Mobilul pe care e instalat WhatsApp-ul contului." eroare={erori.telefon}>
          {(descriere) => (
            <input
              id={`${id}-telefon`}
              type="tel"
              inputMode="tel"
              value={telefon}
              onChange={(e) => {
                setTelefon(e.target.value);
                curata("telefon");
              }}
              placeholder="+40 7xx xxx xxx"
              maxLength={40}
              autoComplete="off"
              aria-invalid={erori.telefon ? true : undefined}
              aria-describedby={descriere}
              className={inputClass(cn("pu-num mt-1.5", CAMP, erori.telefon && "border-rose/50"))}
            />
          )}
        </CampCont>

        <CampCont id={`${id}-limita`} label="Limită pe zi" hint="Doar avertisment: la limită, contorul se face portocaliu, dar mesajul pleacă oricum." eroare={erori.limita}>
          {(descriere) => (
            <input
              id={`${id}-limita`}
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              step={1}
              value={limita}
              onChange={(e) => {
                setLimita(e.target.value);
                curata("limita");
              }}
              aria-invalid={erori.limita ? true : undefined}
              aria-describedby={descriere}
              className={inputClass(cn("mt-1.5 sm:w-32", CAMP, erori.limita && "border-rose/50"))}
            />
          )}
        </CampCont>
      </div>

      {erori.general ? (
        <div role="alert" className="mt-4">
          <InlineNote tone="rose">{erori.general}</InlineNote>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Btn variant="ghost" className={TAP_SM} onClick={onGata}>
          Renunță
        </Btn>
        <Btn type="submit" variant="primary" icon={pending ? Loader2 : cont ? Save : Plus} disabled={pending} className={TAP_SM}>
          {pending ? "Se salvează…" : cont ? "Salvează contul" : "Adaugă contul"}
        </Btn>
      </div>
    </form>
  );
}

/** Un rând din listă: numele, starea, numărul, limita și cele două acțiuni. */
function RandCont({ cont, lucreaza, onEditeaza, onComuta }: { cont: ContWhatsapp; lucreaza: boolean; onEditeaza: () => void; onComuta: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("min-w-0 break-words text-[14px] font-medium sm:text-[13px]", !cont.activ && "text-muted-foreground")}>{cont.nume}</p>
          {cont.activ ? (
            <Pill tone="mint" dot>
              Activ
            </Pill>
          ) : (
            <Pill tone="neutral">Dezactivat</Pill>
          )}
        </div>
        <p className="pu-num mt-0.5 text-[12.5px] text-muted-foreground sm:text-[11.5px]">
          {telefonCont(cont.telefon)} · {num(cont.limita_zi)} pe zi
        </p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <Btn size="sm" variant="ghost" icon={Pencil} className={cn(TAP_SM, "flex-1 sm:flex-none")} disabled={lucreaza} onClick={onEditeaza}>
          Editează<span className="sr-only"> {cont.nume}</span>
        </Btn>
        <Btn
          size="sm"
          variant="outline"
          icon={lucreaza ? Loader2 : cont.activ ? PowerOff : Power}
          className={cn(TAP_SM, "flex-1 sm:flex-none")}
          disabled={lucreaza}
          onClick={onComuta}
        >
          {lucreaza ? "Se salvează…" : cont.activ ? "Dezactivează" : "Activează"}
          <span className="sr-only"> {cont.nume}</span>
        </Btn>
      </div>
    </li>
  );
}

export function SetariConturi({ conturi, eroare }: { conturi: ContWhatsapp[] | null; eroare: string | null }) {
  const router = useRouter();
  const { notify } = useToast();
  // undefined: dialog închis; null: cont nou; altfel contul editat.
  const [dialog, setDialog] = useState<ContWhatsapp | null | undefined>(undefined);
  const [lucru, setLucru] = useState<number | null>(null);
  const toate = conturi ?? [];
  const active = toate.filter((c) => c.activ).length;

  const comuta = async (cont: ContWhatsapp) => {
    if (lucru !== null) return;
    setLucru(cont.id);
    const activ = !cont.activ;
    const result = await salveazaContWhatsapp({ id: cont.id, nume: cont.nume, telefon: cont.telefon, limita: cont.limita_zi, activ }).catch(() => ({
      ok: false as const,
      message: "Conexiunea a căzut și nu știm dacă s-a salvat. Lista se reîncarcă: verifică starea contului.",
    }));
    setLucru(null);
    if (!result.ok) notify(`${cont.nume}: ${result.message}`, "error");
    else if (activ) notify(`${cont.nume} e activ: apare din nou în „WhatsApp azi”.`);
    else notify(`${cont.nume} e dezactivat: nu mai apare în „WhatsApp azi”. Firmele trimise de pe el rămân pe el.`, "warn");
    router.refresh();
  };

  return (
    <Card id="conturi-whatsapp" className="scroll-mt-24">
      <SectionTitle
        title="Conturi WhatsApp"
        hint="Numerele de pe care trimiteți din „WhatsApp azi”. Fiecare cont e un buton acolo, cu contorul lui de azi."
        action={
          conturi !== null ? (
            <Btn size="sm" variant="outline" icon={Plus} className={TAP_SM} onClick={() => setDialog(null)}>
              Adaugă cont
            </Btn>
          ) : null
        }
      />

      {conturi === null ? (
        <EroareCitire title="Conturile nu s-au putut citi" message={eroare ?? "Citirea a căzut."} className="py-8" />
      ) : conturi.length === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed border-white/[0.1] px-4 py-5">
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-lav" aria-hidden="true" />
            Niciun cont încă. Adaugă primul număr de pe care trimiteți WhatsApp: fără cont, nicio firmă nu se poate marca în „WhatsApp azi”.
          </p>
          <Btn size="sm" variant="primary" icon={Plus} className={TAP_SM} onClick={() => setDialog(null)}>
            Adaugă primul cont
          </Btn>
        </div>
      ) : (
        <>
          <p className="mt-3 text-[12px] text-muted-foreground sm:text-[11.5px]">
            {active === toate.length ? `${num(active)} ${active === 1 ? "cont activ" : "conturi active"}.` : `${num(active)} active din ${num(toate.length)}.`}{" "}
            Limita pe zi e doar un avertisment. Un cont dezactivat dispare din „WhatsApp azi”; nu se șterge, ca firmele trimise de pe el să-și păstreze contul.
          </p>
          {active === 0 ? (
            <InlineNote tone="apricot" className="mt-3">
              Niciun cont activ: în „WhatsApp azi” nicio firmă nu se poate marca până nu activezi unul.
            </InlineNote>
          ) : null}
          <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.07]">
            {toate.map((c) => (
              <RandCont key={c.id} cont={c} lucreaza={lucru === c.id} onEditeaza={() => setDialog(c)} onComuta={() => void comuta(c)} />
            ))}
          </ul>
        </>
      )}

      <Modal
        open={dialog !== undefined}
        onOpenChange={(open) => {
          if (!open) setDialog(undefined);
        }}
        label={dialog ? `Editează ${dialog.nume}` : "Adaugă un cont WhatsApp"}
      >
        {dialog !== undefined ? <FormularCont cont={dialog} toate={toate} onGata={() => setDialog(undefined)} /> : null}
      </Modal>
    </Card>
  );
}

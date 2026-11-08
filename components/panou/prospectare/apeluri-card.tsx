"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, ExternalLink, Flag, Phone, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { salveazaNotaLista } from "@/app/(admin)/admin/prospectare/actions";
import { ConfirmDialog, CopyButton } from "@/components/panou/ui/actions";
import { Modal } from "@/components/panou/ui/modal";
import { Btn, btnClass, Card } from "@/components/panou/ui/primitives";
import { Field, inputClass, Spinner } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import { linkTelefon, numarAfisat, numarScurt } from "@/lib/prospectare/contact";
import type { ListaCuFirma } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { CAMP, Dezvaluire, TAP_MD, TAP_SM, TextPregatit } from "./apeluri-ui";

/** CallCard din prototip: o firmă de sunat, cu numărul mare, scriptul și rezultatele apelului. */

export type RezultatApel = "nu_raspunde" | "interesat" | "nu_vrea" | "suna_inapoi" | "numar_gresit";
export interface ExtraRezultat {
  nota?: string;
  /** ISO cu decalaj (ora României), obligatoriu la „Sună înapoi”. */
  sunaInapoiLa?: string;
}

// ---------------------------------------------------------------------------
// Ora României pentru „Sună înapoi”: câmpul `datetime-local` nu are fus orar,
// deci îl citim ca oră a României și trimitem ISO cu decalajul ei (+02/+03).
// ---------------------------------------------------------------------------

const RO = "Europe/Bucharest";
const pad = (n: number): string => String(n).padStart(2, "0");

function partiRo(ts: number): { an: number; luna: number; zi: number; ora: number; minut: number; secunda: number } {
  const parti = new Intl.DateTimeFormat("en-US", {
    timeZone: RO,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const v = (tip: Intl.DateTimeFormatPartTypes): number => Number(parti.find((p) => p.type === tip)?.value ?? 0);
  return { an: v("year"), luna: v("month"), zi: v("day"), ora: v("hour") % 24, minut: v("minute"), secunda: v("second") };
}

/** Cu câte minute e ora României înaintea UTC la momentul dat (120 iarna, 180 vara). */
function decalajRo(ts: number): number {
  const p = partiRo(ts);
  return Math.round((Date.UTC(p.an, p.luna - 1, p.zi, p.ora, p.minut, p.secunda) - Math.floor(ts / 1000) * 1000) / 60000);
}

/** Momentul dat, ca valoare de `datetime-local` în ora României („2026-11-02T16:30”). */
function localRo(ts: number): string {
  const p = partiRo(ts);
  return `${p.an}-${pad(p.luna)}-${pad(p.zi)}T${pad(p.ora)}:${pad(p.minut)}`;
}

/** „2026-11-02T16:30”, citit ca oră a României → „2026-11-02T16:30:00+02:00”. */
export function isoDinLocalRo(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const perete = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // Decalajul de la momentul real, nu de la ora citită ca UTC: prinde și noaptea schimbării orei.
  const decalaj = decalajRo(perete - decalajRo(perete) * 60000);
  const abs = Math.abs(decalaj);
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00${decalaj < 0 ? "-" : "+"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Rotunjit în sus la 5 minute. */
const rotunjit = (ts: number): number => Math.ceil(ts / 300000) * 300000;

function variante(acum: number): { label: string; value: string }[] {
  const p = partiRo(acum);
  const maine = new Date(Date.UTC(p.an, p.luna - 1, p.zi + 1));
  const out = [
    { label: "Peste o oră", value: localRo(rotunjit(acum + 3600000)) },
    { label: "Peste 3 ore", value: localRo(rotunjit(acum + 3 * 3600000)) },
  ];
  if (p.ora < 16) out.push({ label: "Azi la 17:00", value: `${p.an}-${pad(p.luna)}-${pad(p.zi)}T17:00` });
  out.push({ label: "Mâine la 10:00", value: `${maine.getUTCFullYear()}-${pad(maine.getUTCMonth() + 1)}-${pad(maine.getUTCDate())}T10:00` });
  return out;
}

/** Conținutul dialogului „Când sunăm înapoi?”; se montează la deschidere, deci pornește mereu de la ora curentă. */
function AlegeOra({ onSalveaza, onRenunta }: { onSalveaza: (iso: string) => void; onRenunta: () => void }) {
  const [acum] = useState(() => Date.now());
  const [cand, setCand] = useState(() => localRo(rotunjit(acum + 30 * 60000)));
  const [eroare, setEroare] = useState<string | null>(null);
  const id = useId();

  const salveaza = () => {
    const iso = isoDinLocalRo(cand);
    if (!iso) return setEroare("Alege data și ora.");
    if (Date.parse(iso) < Date.now() - 60000) return setEroare("Ora aleasă a trecut: alege una din viitor.");
    onSalveaza(iso);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        salveaza();
      }}
    >
      <h2 className="text-[17px] font-semibold">Când sunăm înapoi?</h2>
      <p className="mt-1 text-[14px] text-muted-foreground sm:text-[13.5px]">Alege data și ora. Firma apare în tabul „Sună înapoi” până atunci.</p>
      <div className="mt-4">
        <Field label="Data și ora" hint="Ora României.">
          <input
            type="datetime-local"
            value={cand}
            min={localRo(acum)}
            onChange={(event) => {
              setCand(event.target.value);
              setEroare(null);
            }}
            aria-invalid={eroare ? true : undefined}
            aria-describedby={eroare ? `${id}-eroare` : undefined}
            className={inputClass(CAMP)}
          />
        </Field>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Variante rapide">
          {variante(acum).map((v) => (
            <button
              key={v.label}
              type="button"
              aria-pressed={cand === v.value}
              onClick={() => {
                setCand(v.value);
                setEroare(null);
              }}
              className={cn(
                "h-11 rounded-lg border px-3 text-[14.5px] transition-colors sm:h-8 sm:text-[13.5px]",
                cand === v.value ? "border-lav bg-lav/10 text-lav" : "border-white/[0.1] text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {eroare ? (
          <p id={`${id}-eroare`} role="alert" className="mt-2 text-[14px] text-[#FFB0C0]">
            {eroare}
          </p>
        ) : null}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onRenunta} className={TAP_MD}>
          Renunță
        </Btn>
        <Btn type="submit" variant="primary" className={TAP_MD}>
          Salvează
        </Btn>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

const REZULTAT_BTN = "h-auto min-h-12 justify-start py-1.5 text-left text-[15px] sm:h-10 sm:min-h-0 sm:py-0 sm:text-[15px]";

export function CallCard({
  linie,
  script,
  mesajDupaApel,
  onRezultat,
}: {
  linie: ListaCuFirma;
  /** Vechi (încercările de la Setări): „Nu răspunde” nu mai scoate firma după N încercări, deci nu se mai folosește. */
  limita?: number;
  /** Scriptul de apel, completat pentru firmă și utilizator. */
  script: string;
  /** Mesajul WhatsApp de după apel, completat. */
  mesajDupaApel: string;
  onRezultat: (linie: ListaCuFirma, rezultat: RezultatApel, extra: ExtraRezultat) => Promise<void>;
}) {
  const firma = linie.firma;
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  // Nota are tranziția ei: salvarea la blur nu blochează butonul de rezultat apăsat imediat după.
  const [salvareNota, startNota] = useTransition();
  const [nota, setNota] = useState(linie.nota ?? "");
  const salvata = useRef((linie.nota ?? "").trim());
  const [dialog, setDialog] = useState(false);
  const [confirmGresit, setConfirmGresit] = useState(false);

  const incercari = linie.incercari || 0;
  const urmatoarea = incercari + 1;
  const telefon = firma.telefon;
  const whatsapp = Boolean(telefon && firma.este_mobil);

  /** Nota nesalvată pleacă odată cu rezultatul. */
  const notaNesalvata = (): string | undefined => {
    const text = nota.trim();
    if (text === salvata.current) return undefined;
    salvata.current = text;
    return text;
  };

  const trimite = (rezultat: RezultatApel, extra: ExtraRezultat = {}) => {
    const n = notaNesalvata();
    startTransition(async () => {
      await onRezultat(linie, rezultat, { ...extra, nota: n });
    });
  };

  const salveazaNota = () => {
    const text = nota.trim();
    if (text === salvata.current) return;
    const inainte = salvata.current;
    salvata.current = text;
    startNota(async () => {
      const result = await salveazaNotaLista({ listaId: linie.id, nota: text });
      if (!result.ok) salvata.current = inainte;
      notify(result.message, result.ok ? undefined : "error");
      router.refresh();
    });
  };

  const loc = firma.oras && firma.judet && firma.oras !== firma.judet ? `${firma.oras}, ${firma.judet}` : firma.oras || firma.judet;
  const meta = [loc, firma.nisa, firma.scor !== null ? `scor ${firma.scor}` : null].filter(Boolean).join(" · ");

  return (
    <Card className={cn("p-0 transition-opacity", pending && "opacity-70")} aria-busy={pending || undefined}>
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="break-words text-[17px] font-semibold leading-tight sm:text-[16px]">{firma.nume}</h3>
            {meta ? <p className="mt-0.5 text-[14px] text-muted-foreground sm:text-[13px]">{meta}</p> : null}
            {firma.persoana_contact ? (
              <p className="mt-0.5 text-[14px] text-muted-foreground sm:text-[13px]">Persoană de contact: {firma.persoana_contact}</p>
            ) : null}
          </div>
          {incercari > 0 ? (
            <span className="pu-num shrink-0 rounded-full border border-white/[0.1] px-2 py-0.5 text-[12.5px] text-muted-foreground">
              {incercari === 1 ? "1 încercare" : `${incercari} încercări`}
            </span>
          ) : null}
        </div>

        {telefon ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="pu-num mr-auto text-[22px] font-medium leading-none tracking-tight sm:mr-0">{numarAfisat(telefon)}</span>
            <CopyButton value={numarScurt(telefon)} label="Copiază numărul" className="h-11 px-3 text-[14.5px] sm:h-8 sm:text-[14px]" />
            {/* Pe telefon: grilă cu butoane mari; de la `sm`, în același rând cu numărul, ca în prototip. */}
            <div className="grid w-full grid-cols-2 gap-2 sm:contents">
              <a
                href={linkTelefon(telefon)}
                aria-label={`Sună ${firma.nume} la ${numarAfisat(telefon)}`}
                className={btnClass({ variant: "solid", size: "sm", className: "col-span-2 h-12 gap-2 text-[16px] sm:h-8 sm:text-[14px]" })}
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                Sună
              </a>
              {firma.link_demo ? (
                <a
                  href={firma.link_demo}
                  target="_blank"
                  rel="noreferrer"
                  className={btnClass({ variant: "outline", size: "sm", className: cn(TAP_SM, "col-span-2 gap-1.5") })}
                >
                  Deschide site-ul demo
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
            {!firma.este_mobil ? <p className="w-full text-[13.5px] text-muted-foreground sm:text-[12.5px]">Număr fix: după „Interesat” nu se poate continua pe WhatsApp.</p> : null}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-rose/25 bg-rose/[0.07] px-3 py-2 text-[14px] text-[#FFC2CE]">
            Firma nu are telefon în fișă. Marchează „Număr greșit”: iese din listă și rămâne doar pentru email.
          </p>
        )}

        <div className="mt-2 sm:mt-3 sm:space-y-1.5">
          <Dezvaluire titlu="Script scurt">
            {script ? (
              <TextPregatit>{script}</TextPregatit>
            ) : (
              <p className="text-[14px] text-muted-foreground sm:text-[13px]">Scriptul de apel e gol: scrie-l în Setări, la șabloane.</p>
            )}
          </Dezvaluire>
          {whatsapp ? (
            <Dezvaluire titlu="Mesaj WhatsApp după „Interesat”">
              {mesajDupaApel ? (
                <>
                  <TextPregatit>{mesajDupaApel}</TextPregatit>
                  <p className="mt-2 text-[14px] leading-snug text-muted-foreground sm:text-[13px]">
                    Se deschide pe WhatsApp când apeși „Interesat”. Firma rămâne pe canalul Telefon; în activitate apare „Continuare apel pe WhatsApp”.
                  </p>
                </>
              ) : (
                <p className="text-[14px] text-muted-foreground sm:text-[13px]">Șablonul de după apel e gol: scrie-l în Setări, la șabloane.</p>
              )}
            </Dezvaluire>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn variant="outline" size="md" icon={RotateCcw} disabled={pending} onClick={() => trimite("nu_raspunde")} className={REZULTAT_BTN}>
            <span className="flex min-w-0 flex-col items-start leading-tight sm:flex-row sm:items-center">
              <span>Nu răspunde</span>
              <span className="pu-num text-[13px] font-normal text-muted-foreground sm:text-[15px] sm:font-medium sm:text-foreground">
                <span className="hidden sm:inline" aria-hidden="true">
                  {" · "}
                </span>
                încercarea {urmatoarea}
              </span>
            </span>
          </Btn>
          <Btn variant="primary" size="md" icon={ThumbsUp} disabled={pending} onClick={() => trimite("interesat")} className={REZULTAT_BTN}>
            Interesat
          </Btn>
          <Btn variant="outline" size="md" icon={ThumbsDown} disabled={pending} onClick={() => trimite("nu_vrea")} className={REZULTAT_BTN}>
            Nu vrea
          </Btn>
          <Btn variant="outline" size="md" icon={Clock} disabled={pending} onClick={() => setDialog(true)} className={REZULTAT_BTN}>
            Sună înapoi
          </Btn>
        </div>

        {linie.rezultat === "nu_raspunde" ? (
          <p className="mt-2 text-[14px] leading-snug text-[#FFD0AC] sm:text-[13px]">
            N-a răspuns: firma e înapoi în distribuție, încercările rămân notate. O poți suna din nou azi; dacă răspunde, rămâne pe telefon.
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 sm:mt-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmGresit(true)}
            className="inline-flex min-h-11 items-center gap-1 text-[14px] text-muted-foreground underline-offset-2 hover:text-rose hover:underline disabled:opacity-45 sm:min-h-0 sm:text-[12.5px]"
          >
            <Flag className="h-3 w-3" aria-hidden="true" /> Număr greșit
          </button>
          {pending ? <Spinner label="Se salvează rezultatul" /> : null}
        </div>

        <div className="mt-2 sm:mt-3">
          <Field label="Notă pentru firmă" hint={salvareNota ? "Se salvează nota…" : undefined}>
            <textarea
              value={nota}
              onChange={(event) => setNota(event.target.value)}
              onBlur={salveazaNota}
              rows={2}
              maxLength={2000}
              placeholder="ex. revin după 16:00, secretara cere pe email"
              className={inputClass("h-auto resize-y py-2 text-base leading-relaxed sm:text-[14px]")}
            />
          </Field>
        </div>
      </div>

      <Modal open={dialog} onOpenChange={setDialog} label="Când sunăm înapoi?" className="w-[min(24rem,calc(100vw-2rem))] p-5">
        <AlegeOra
          onRenunta={() => setDialog(false)}
          onSalveaza={(iso) => {
            setDialog(false);
            trimite("suna_inapoi", { sunaInapoiLa: iso });
          }}
        />
      </Modal>

      <ConfirmDialog
        open={confirmGresit}
        onOpenChange={setConfirmGresit}
        title="Număr greșit?"
        description={telefon ? `${firma.nume}, ${numarAfisat(telefon)}.` : firma.nume}
        consequence="Firma iese din listă și se întoarce în distribuție doar pentru email: nu mai primește WhatsApp și nu mai intră la apeluri. Fără un email valid, nu mai primește nimic."
        confirmLabel="Da, număr greșit"
        onConfirm={() => onRezultat(linie, "numar_gresit", { nota: notaNesalvata() })}
      />
    </Card>
  );
}

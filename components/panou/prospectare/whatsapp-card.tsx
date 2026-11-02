"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, MessageCircle } from "lucide-react";
import { schimbaEtapa, trimiteWhatsapp } from "@/app/(admin)/admin/prospectare/actions";
import { ConfirmDialog, CopyButton, InlineNote } from "@/components/panou/ui/actions";
import { dayMonthRo, num, timeRo } from "@/components/panou/ui/format";
import { Btn, btnClass, Card, Pill } from "@/components/panou/ui/primitives";
import { useToast } from "@/components/panou/ui/toast";
import { linkWhatsApp, numarAfisat, numarScurt } from "@/lib/prospectare/contact";
import type { FirmaRand } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { TAP_SM } from "./apeluri-ui";
import { CanaleBadge } from "./stage-badge";

/**
 * WhatsAppCard din prototip, pe lista continuă: firma, numărul fără 0, mesajul
 * pregătit și trimiterea. Firma se marchează ÎNAINTE de deschiderea
 * conversației (ca emailul): baza pune WhatsApp-ul o singură dată, deci dacă
 * celălalt a luat-o între timp, cererea e refuzată și nimeni nu scrie de două ori.
 */

/** Copierile mici din prototip (xs), cu 44 px pe telefon. */
const COPIE = "h-11 px-3 text-[13px] sm:h-7 sm:px-2.5 sm:text-[12px]";
/** Butoanele mari ale cardului: toată lățimea pe telefon. */
const MARE = "h-12 w-full gap-2 text-[15px] sm:h-11 sm:w-auto sm:text-sm";

const mic = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
const momentScurt = (iso: string): string => `${dayMonthRo(iso)}, ${timeRo(iso)}`;

const CONEXIUNE =
  "Conexiunea a căzut și nu știm dacă firma s-a marcat. Lista se reîncarcă: dacă firma e tot aici, încearcă din nou.";

/** O firmă marcată din ecranul ăsta care rămâne vizibilă până termină omul cu ea. */
export interface FirmaLuata {
  firma: FirmaRand;
  mesaj: string;
  cont: number;
  /** blocat: browserul n-a deschis WhatsApp singur; manual: omul trimite din alt telefon sau din altă aplicație. */
  motiv: "blocat" | "manual";
}

/** Fereastra deschisă în clic, cât așteptăm baza: un text, nu o pagină albă goală. */
function pregatesteFereastra(fereastra: Window): void {
  try {
    fereastra.opener = null;
    fereastra.document.title = "Se deschide WhatsApp…";
    fereastra.document.body.style.cssText = "margin:0;padding:24px;font:16px/1.5 system-ui,sans-serif;background:#0C0C10;color:#EDEDF0";
    fereastra.document.body.textContent = "Se deschide WhatsApp…";
  } catch {
    /* unele browsere nu lasă scrierea în fereastra nouă; nu contează */
  }
}

/** Numele, numărul și mesajul, cu butoanele de copiere: la fel în cardul de trimis și în cel marcat. */
function CorpFirma({ firma, mesaj, faraMesaj, eticheta }: { firma: FirmaRand; mesaj: string; faraMesaj: string; eticheta?: ReactNode }) {
  const meta = [`#${firma.nr}`, firma.oras, firma.nisa, firma.scor !== null ? `scor ${num(firma.scor)}` : null].filter(Boolean).join(" · ");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {eticheta}
          <h3 className="break-words text-[16px] font-semibold leading-tight sm:text-[15px]">{firma.nume}</h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground sm:text-[11.5px]">{meta}</p>
        </div>
        <CopyButton value={firma.nume} label="Copiază numele" size="xs" className={COPIE} />
      </div>

      {firma.email_la ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground sm:text-[11.5px]">
          <CanaleBadge firma={firma} />
          <span aria-hidden="true">a primit emailul pe {momentScurt(firma.email_la)}</span>
        </p>
      ) : null}

      {firma.telefon ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="pu-num mr-auto text-[21px] font-medium leading-none tracking-tight sm:mr-0">{numarAfisat(firma.telefon)}</span>
          <CopyButton value={numarScurt(firma.telefon)} label="Copiază numărul" size="xs" className={COPIE} />
        </div>
      ) : (
        <p className="mt-2.5 text-[12.5px] text-[#FFB0C0]">Firma nu are telefon în fișă.</p>
      )}

      <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
        {mesaj ? (
          <>
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground/85 sm:text-[12px]">{mesaj}</p>
            <div className="mt-2">
              <CopyButton value={mesaj} label="Copiază mesajul" size="xs" className={COPIE} />
            </div>
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-muted-foreground sm:text-[12px]">{faraMesaj}</p>
            {firma.link_demo ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="min-w-0 break-all font-mono text-[12.5px] text-foreground/85 sm:text-[12px]">{firma.link_demo}</span>
                <CopyButton value={firma.link_demo} label="Copiază linkul demo" size="xs" className={COPIE} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

/**
 * O firmă din listă. „Trimite pe WhatsApp” deschide fereastra chiar în clic
 * (după `await` browserul ar bloca-o), marchează firma pe contul ales și abia
 * apoi trimite fereastra la WhatsApp, cu mesajul gata. „Marchează și trimit
 * manual” doar marchează: pentru WhatsApp-ul de pe alt telefon sau din altă aplicație.
 */
export function WhatsAppCard({
  firma,
  mesaj,
  faraMesaj,
  cont,
  faraCont,
  onLuata,
  onEroare,
}: {
  firma: FirmaRand;
  mesaj: string;
  /** Ce scrie în locul mesajului când acesta lipsește (șablon gol, setări necitite). */
  faraMesaj: string;
  /** Contul ales; null: încă neales (sau niciun cont în Setări). */
  cont: number | null;
  /** De ce nu se poate trimite fără cont. */
  faraCont: string;
  onLuata: (luata: FirmaLuata) => void;
  onEroare: (firma: FirmaRand, text: string) => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [lucru, setLucru] = useState<"deschide" | "manual" | null>(null);
  // Marcată cu succes: cardul pleacă la reîncărcare; până atunci, butoanele stau oprite.
  const [marcata, setMarcata] = useState(false);
  const [eroare, setEroare] = useState<string | null>(null);
  const [confirmare, setConfirmare] = useState(false);
  // Două atingeri rapide ar ajunge amândouă aici înainte de randare: a doua se oprește.
  const inCurs = useRef(false);

  const motivBlocare = !firma.telefon ? "Firma nu are telefon în fișă." : cont === null ? faraCont : null;
  const blocat = lucru !== null || marcata || motivBlocare !== null;

  const esec = (text: string) => {
    setEroare(text);
    onEroare(firma, text);
    notify(`${firma.nume}: ${text}`, "error");
    router.refresh();
  };

  const trimite = async (deschide: boolean) => {
    if (blocat || inCurs.current || cont === null || !firma.telefon) return;
    inCurs.current = true;
    // Fereastra se deschide acum, cât suntem încă în clic; primește adresa după ce baza a marcat firma.
    const fereastra = deschide ? window.open("", "_blank") : null;
    if (fereastra) pregatesteFereastra(fereastra);
    setEroare(null);
    setLucru(deschide ? "deschide" : "manual");
    const result = await trimiteWhatsapp({ firmaId: firma.id, cont }).catch(() => ({ ok: false as const, message: CONEXIUNE }));
    setLucru(null);
    inCurs.current = false;

    if (!result.ok) {
      fereastra?.close();
      esec(result.message);
      return;
    }

    setMarcata(true);
    const ton = result.data?.pesteLimita ? "warn" : "default";
    const text = `${firma.nume}: ${mic(result.message)}`;
    if (fereastra && !fereastra.closed) {
      fereastra.location.href = linkWhatsApp(firma.telefon, mesaj);
      notify(text, ton);
    } else if (deschide) {
      // Browserul a blocat fereastra (sau a fost închisă): firma rămâne sus, cu butonul de deschis.
      onLuata({ firma, mesaj, cont, motiv: "blocat" });
      notify(`${text} WhatsApp nu s-a deschis singur: apasă „Deschide WhatsApp” la firmă, sus.`, "warn");
    } else {
      onLuata({ firma, mesaj, cont, motiv: "manual" });
      notify(text, ton);
    }
    router.refresh();
  };

  const nuContacta = async () => {
    const result = await schimbaEtapa({ firmaId: firma.id, etapa: "nu_contacta", motiv: "Marcată din lista de WhatsApp" }).catch(() => ({
      ok: false as const,
      message: "Conexiunea a căzut și nu știm dacă firma s-a marcat „Nu contacta”. Lista se reîncarcă: verifică dacă e tot aici.",
    }));
    if (!result.ok) {
      esec(result.message);
      return;
    }
    notify(`${firma.nume}. ${result.message}`, "warn");
    router.refresh();
  };

  return (
    <Card padded={false} className="p-4 sm:p-5" aria-busy={lucru !== null || undefined}>
      <CorpFirma firma={firma} mesaj={mesaj} faraMesaj={faraMesaj} />

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Btn variant="primary" size="lg" icon={MessageCircle} className={MARE} disabled={blocat} onClick={() => void trimite(true)}>
          {lucru === "deschide" ? "Se marchează…" : marcata ? "Marcată" : "Trimite pe WhatsApp"}
        </Btn>
        <Btn variant="outline" size="lg" className={MARE} disabled={blocat} onClick={() => void trimite(false)}>
          {lucru === "manual" ? "Se marchează…" : "Marchează și trimit manual"}
        </Btn>
        <Btn
          variant="ghost"
          size="sm"
          icon={Ban}
          className={cn(TAP_SM, "self-start sm:ml-auto sm:self-auto")}
          disabled={lucru !== null || marcata}
          onClick={() => setConfirmare(true)}
        >
          Nu contacta
        </Btn>
      </div>

      {motivBlocare ? <p className="mt-2 text-[12.5px] text-muted-foreground sm:text-[11.5px]">{motivBlocare}</p> : null}
      {eroare ? (
        <InlineNote tone="rose" className="mt-3">
          {eroare}
        </InlineNote>
      ) : null}

      <ConfirmDialog
        open={confirmare}
        onOpenChange={setConfirmare}
        title="Marchezi firma „Nu contacta”?"
        description={[firma.nume, firma.oras].filter(Boolean).join(" · ")}
        consequence="Firma iese din lista de WhatsApp și nu mai primește nimic, pe niciun canal: nici email, nici WhatsApp, nici apel. Etapa nu se mai schimbă după asta."
        confirmLabel="Marchează „Nu contacta”"
        onConfirm={nuContacta}
      />
    </Card>
  );
}

/**
 * Firma marcată acum, care încă are nevoie de un pas: WhatsApp-ul nu s-a
 * deschis singur (browserul a blocat fereastra) sau omul trimite manual.
 * Stă sus, deasupra listei, până o deschide sau apasă „Gata”.
 */
export function WhatsAppLuata({ luata, faraMesaj, onGata }: { luata: FirmaLuata; faraMesaj: string; onGata: (firmaId: string) => void }) {
  const { firma, mesaj, cont, motiv } = luata;
  const ref = useRef<HTMLDivElement>(null);

  // Cardul de la care a plecat omul a dispărut din listă: focusul și privirea vin aici.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const deschide = firma.telefon ? (
    <a
      href={linkWhatsApp(firma.telefon, mesaj)}
      target="_blank"
      rel="noreferrer"
      // Odată deschisă, conversația are mesajul; a doua deschidere l-ar pune din nou.
      onClick={() => setTimeout(() => onGata(firma.id), 400)}
      className={btnClass({ variant: motiv === "blocat" ? "primary" : "outline", size: "lg", className: MARE })}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      Deschide WhatsApp
      <span className="sr-only"> către {firma.nume}, cu mesajul pregătit (filă nouă)</span>
    </a>
  ) : null;

  return (
    <div ref={ref} tabIndex={-1} className="rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-mint/50">
      <Card padded={false} className="border-mint/25 p-4 sm:p-5">
        <CorpFirma
          firma={firma}
          mesaj={mesaj}
          faraMesaj={faraMesaj}
          eticheta={
            <Pill tone="mint" className="mb-1.5">
              <Check className="h-3 w-3" aria-hidden="true" />
              Marcată trimisă · contul {cont}
            </Pill>
          }
        />

        <p className="mt-3 text-[13px] leading-relaxed text-foreground/85 sm:text-[12.5px]">
          {motiv === "blocat"
            ? "Browserul n-a deschis WhatsApp singur. Firma e deja marcată: apasă „Deschide WhatsApp” și trimite mesajul."
            : `Firma e marcată pe contul ${cont}. Copiază numărul și mesajul în WhatsApp-ul contului ${cont}, trimite, apoi apasă „Gata”.`}
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {motiv === "blocat" ? (
            <>
              {deschide}
              <Btn variant="ghost" size="sm" className={cn(TAP_SM, "self-start sm:self-auto")} onClick={() => onGata(firma.id)}>
                Ascunde
              </Btn>
            </>
          ) : (
            <>
              <Btn variant="mint" size="lg" icon={Check} className={MARE} onClick={() => onGata(firma.id)}>
                Gata, l-am trimis
              </Btn>
              {deschide}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState, type Ref } from "react";
import Link from "next/link";
import { Check, Copy, MessageCircle } from "lucide-react";
import { timeRo } from "@/components/panou/ui/format";
import { btnClass } from "@/components/panou/ui/primitives";
import { linkWhatsApp, numarAfisat, numarScurt } from "@/lib/prospectare/contact";
import type { FirmaRand } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";

/**
 * Rândurile compacte din „WhatsApp azi”: un rând pe firmă (nume, număr fără 0,
 * oraș, cont), mesajul pe o singură linie cu „vezi tot”, „Trimite”
 * și copierile mici. La 360 px un rând are ~92 px: pe un telefon de 800 px
 * încap 6–7 firme între bara de sus și meniul de jos.
 */

/** Numărul unui cont, ca în Setări: „+40 771 464 310” (un număr care nu e mobil românesc rămâne cum e scris). */
export function telefonCont(telefon: string): string {
  const scurt = numarScurt(telefon);
  return /^7\d{8}$/.test(scurt) ? `+40 ${scurt.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3")}` : telefon.trim();
}

/** Fișa firmei: tabelul Firme o deschide din `?firma=<id>`. */
const linkFisa = (id: string): string => `/admin/prospectare/firme?firma=${encodeURIComponent(id)}`;

/**
 * Fereastra deschisă chiar în clic, cât așteptăm baza: un text, nu o pagină
 * albă. Legătura cu pagina noastră se taie (`opener`), dar referința rămâne
 * la noi: o trimitem la WhatsApp după marcare sau o închidem la refuz.
 */
export function pregatesteFereastra(fereastra: Window): void {
  try {
    fereastra.opener = null;
    fereastra.document.title = "Se deschide WhatsApp…";
    fereastra.document.body.style.cssText = "margin:0;padding:24px;font:16px/1.5 system-ui,sans-serif;background:#0C0C10;color:#EDEDF0";
    fereastra.document.body.textContent = "Se deschide WhatsApp…";
  } catch {
    /* unele browsere nu lasă scrierea în fereastra nouă; nu contează */
  }
}

/** Copiere secundară, mică: eticheta vizibilă e prima parte din numele accesibil. */
function CopiazaMic({
  valoare,
  eticheta,
  descriere,
  anunt,
  onCopiat,
}: {
  valoare: string;
  eticheta: string;
  descriere: string;
  /** Ce aude cititorul de ecran după copiere. */
  anunt: string;
  onCopiat: (text: string) => void;
}) {
  const [copiat, setCopiat] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copiaza = async () => {
    try {
      await navigator.clipboard.writeText(valoare);
      onCopiat(anunt);
    } catch {
      onCopiat("Browserul n-a lăsat copierea: ține apăsat pe text și copiază-l manual.");
      return;
    }
    setCopiat(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiat(false), 2000);
  };

  const Icon = copiat ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copiaza}
      title={descriere}
      className={btnClass({
        variant: "outline",
        size: "xs",
        className: cn("h-8 gap-1 border-white/[0.09] px-2 text-[13px] font-normal text-muted-foreground hover:text-foreground", copiat && "text-mint"),
      })}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {copiat ? "Copiat" : eticheta}
      <span className="sr-only">: {descriere}</span>
    </button>
  );
}

/**
 * O firmă de trimis. Pe telefon: numele și numărul cu „Trimite” în
 * dreapta, apoi mesajul pe o linie cu „vezi tot” și copierile. De la `sm`, tot
 * rândul pe o singură linie, cu butonul principal la capăt.
 */
export function WhatsAppRand({
  firma,
  mesaj,
  contNume,
  limita,
  lucru,
  eroare,
  motivBlocare,
  butonRef,
  onTrimite,
  onCopiat,
}: {
  firma: FirmaRand;
  /** Șablonul umplut; gol când șablonul lipsește din Setări. */
  mesaj: string;
  contNume: string;
  /** Contul e la limita zilei sau peste: doar avertisment, mesajul pleacă oricum. */
  limita: "la" | "peste" | null;
  /** „anulare”: firma tocmai s-a întors din „Trimise azi” și așteaptă baza. */
  lucru: "anulare" | null;
  eroare: string | null;
  /** De ce nu se poate trimite (fără telefon, cont dezactivat); null: se poate. */
  motivBlocare: string | null;
  butonRef: Ref<HTMLButtonElement>;
  onTrimite: () => void;
  onCopiat: (text: string) => void;
}) {
  const [deschis, setDeschis] = useState(false);
  const idMesaj = useId();
  const ocupat = lucru !== null;
  const deCopiat = mesaj || firma.link_demo || "";

  return (
    <li className="px-3 py-2 sm:px-4 sm:py-2.5" aria-busy={ocupat || undefined}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap">
        <div className="min-w-0 flex-1 sm:w-60 sm:flex-none lg:w-72">
          <Link
            href={linkFisa(firma.id)}
            className="inline-block max-w-full truncate align-top text-[15px] font-medium leading-5 underline-offset-2 hover:underline"
          >
            {firma.nume}
          </Link>
          <p className="truncate text-[13.5px] leading-4 text-muted-foreground">
            {firma.telefon ? <span className="pu-num text-foreground/85">{numarAfisat(firma.telefon)}</span> : <span className="text-[#FFB0C0]">fără telefon</span>}
            {firma.oras ? ` · ${firma.oras}` : ""}
            {` · ${contNume}`}
            {limita ? <span className="text-[#FFC79C]"> · {limita === "peste" ? "peste limită" : "la limită"}</span> : null}
          </p>
        </div>

        <button
          ref={butonRef}
          type="button"
          onClick={onTrimite}
          disabled={ocupat || motivBlocare !== null}
          className={btnClass({
            variant: "primary",
            size: "sm",
            className:
              "h-10 w-[6.75rem] shrink-0 whitespace-normal px-2 text-center text-[14px] leading-[1.15] sm:order-last sm:h-9 sm:w-auto sm:whitespace-nowrap sm:px-3.5 sm:text-[14.5px]",
          })}
        >
          <MessageCircle className="hidden h-4 w-4 sm:block" aria-hidden="true" />
          {lucru === "anulare" ? "Se anulează…" : "Trimite"}
          <span className="sr-only"> către {firma.nume}</span>
        </button>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-1 sm:w-auto sm:flex-1">
          {mesaj ? (
            <>
              <p
                id={idMesaj}
                className={cn(
                  "text-[14px] leading-5 text-foreground/75",
                  deschis ? "basis-full whitespace-pre-wrap break-words rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-2" : "min-w-0 flex-1 truncate"
                )}
              >
                {mesaj}
              </p>
              <button
                type="button"
                aria-expanded={deschis}
                aria-controls={idMesaj}
                onClick={() => setDeschis((v) => !v)}
                className="h-8 shrink-0 rounded-md px-1.5 text-[13.5px] text-lav/90 underline-offset-2 hover:text-lav hover:underline"
              >
                {deschis ? "ascunde" : "vezi tot"}
                <span className="sr-only"> mesajul pentru {firma.nume}</span>
              </button>
            </>
          ) : (
            <p className="min-w-0 flex-1 truncate text-[14px] leading-5 text-muted-foreground">Fără mesaj pregătit.</p>
          )}
          <span className="ml-auto flex shrink-0 gap-1">
            {firma.telefon ? <CopiazaMic valoare={numarScurt(firma.telefon)} eticheta="Nr." descriere={`copiază numărul ${numarAfisat(firma.telefon)}, fără 0`} anunt="Numărul copiat, fără 0 în față." onCopiat={onCopiat} /> : null}
            {deCopiat ? (
              <CopiazaMic
                valoare={deCopiat}
                eticheta={mesaj ? "Mesaj" : "Link"}
                descriere={mesaj ? `copiază mesajul pentru ${firma.nume}` : `copiază linkul demo al firmei ${firma.nume}`}
                anunt={mesaj ? "Mesajul copiat." : "Linkul demo copiat."}
                onCopiat={onCopiat}
              />
            ) : null}
          </span>
        </div>
      </div>

      {motivBlocare ? <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">{motivBlocare}</p> : null}
      {eroare ? <p className="mt-1.5 rounded-lg border border-rose/25 bg-rose/[0.07] px-2.5 py-1.5 text-[13.5px] leading-snug text-[#FFC2CE]">{eroare}</p> : null}
    </li>
  );
}

/**
 * O firmă din „Trimise azi”: ora, contul, numărul; „Anulează” cât mai merge
 * (2 minute de la trimitere) și conversația, redeschisă fără mesajul pregătit,
 * ca să nu-l trimiți de două ori.
 */
export function WhatsAppTrimisaRand({
  firma,
  contNume,
  la,
  lucru,
  poateAnula,
  onAnuleaza,
}: {
  firma: FirmaRand;
  contNume: string;
  la: string | null;
  /** „trimitere”: se marchează chiar acum. */
  lucru: "trimitere" | null;
  poateAnula: boolean;
  onAnuleaza: () => void;
}) {
  return (
    <li className="flex items-center gap-2 px-3 py-2 sm:px-4" aria-busy={lucru !== null || undefined}>
      <div className="min-w-0 flex-1">
        <Link href={linkFisa(firma.id)} className="inline-block max-w-full truncate align-top text-[15px] font-medium leading-5 underline-offset-2 hover:underline">
          {firma.nume}
        </Link>
        <p className="truncate text-[13.5px] leading-4 text-muted-foreground">
          <span className={cn("pu-num", lucru ? "text-lav" : "text-foreground/85")}>{lucru ? "Se marchează…" : la ? timeRo(la) : "azi"}</span>
          {` · ${contNume}`}
          {firma.telefon ? <span className="pu-num"> · {numarAfisat(firma.telefon)}</span> : null}
        </p>
      </div>
      {poateAnula && !lucru ? (
        <button type="button" onClick={onAnuleaza} className={btnClass({ variant: "outline", size: "xs", className: "h-9 px-2.5 text-[13.5px] sm:h-8" })}>
          Anulează
          <span className="sr-only"> marcarea pentru {firma.nume}</span>
        </button>
      ) : null}
      {firma.telefon ? (
        <a
          href={linkWhatsApp(firma.telefon)}
          target="_blank"
          rel="noreferrer"
          title="Deschide conversația, fără mesaj"
          className={btnClass({ variant: "ghost", size: "xs", className: "h-9 w-9 shrink-0 px-0 sm:h-8 sm:w-8" })}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Deschide conversația cu {firma.nume}, fără mesaj (filă nouă)</span>
        </a>
      ) : null}
    </li>
  );
}

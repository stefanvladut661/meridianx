"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, Check, MessageCircle, Send, X } from "lucide-react";
import { InlineNote } from "@/components/panou/ui/actions";
import { num, timeRo } from "@/components/panou/ui/format";
import { btnClass, Card } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState } from "@/components/panou/ui/states";
import type { ListaWhatsapp } from "@/lib/prospectare/citire";
import { linkWhatsApp, numarAfisat, umpleSablon } from "@/lib/prospectare/contact";
import type { ContWhatsapp, FirmaRand } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { firmeText, Taburi, TAP_SM } from "./apeluri-ui";
import { PageHead } from "./page-head";
import { EroareCitire } from "./prezentare-eroare";
import { VcfButton } from "./vcf-button";
import { telefonCont, WhatsAppCard, WhatsAppLuata, type FirmaLuata } from "./whatsapp-card";

/**
 * „WhatsApp azi”: lista continuă și comună. O firmă intră singură când are
 * site-ul demo gata, cu link, număr de mobil și n-a fost contactată pe niciun
 * canal; o firmă deja contactată intră doar cu WhatsApp permis din fișă (și stă
 * prima). Se trimite de pe conturile din Setări: fiecare telefon își alege
 * contul, iar contorul „trimise azi / limită” e doar avertisment.
 */

type Tab = "de_trimis" | "trimise";

/** Contul ales se ține minte pe dispozitiv: fiecare telefon trimite, de obicei, de pe același cont. */
const CHEIE_CONT = "prospectare_whatsapp_cont";
const SETARI_CONTURI = "/admin/prospectare/setari#conturi-whatsapp";

/**
 * Un cont din rândul de alegere, în stilul comutatorului din fundație: numele,
 * numărul și contorul de azi. La limită, contorul se face portocaliu; trimiterea
 * nu se blochează niciodată.
 */
function ContButon({ cont, ales, trimise, onAlege }: { cont: ContWhatsapp; ales: boolean; trimise: number | null; onAlege: (id: number) => void }) {
  const laLimita = trimise !== null && trimise >= cont.limita_zi;
  const procent = trimise === null ? 0 : cont.limita_zi > 0 ? Math.min(100, (trimise / cont.limita_zi) * 100) : 100;

  return (
    <button
      type="button"
      data-cont={cont.id}
      aria-pressed={ales}
      onClick={() => onAlege(cont.id)}
      className={cn(
        "flex min-h-11 w-[9.75rem] shrink-0 snap-start flex-col items-stretch rounded-[14px] px-3 py-2.5 text-left transition-colors focus-visible:outline-offset-[-2px] sm:w-auto",
        ales ? "bg-white/[0.11] text-foreground shadow-[0_1px_0_rgba(255,255,255,0.07)_inset]" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-tight sm:text-[13.5px]">{cont.nume}</span>
        {ales ? <Check className="h-4 w-4 shrink-0 text-lav" aria-hidden="true" /> : null}
      </span>
      <span className="pu-num mt-0.5 truncate text-[12.5px] text-muted-foreground sm:text-[11.5px]">{telefonCont(cont.telefon)}</span>
      <span
        className={cn(
          "pu-num mt-2 inline-flex items-center gap-1 text-[12px] sm:text-[11.5px]",
          laLimita ? "text-[#FFC79C]" : ales ? "text-foreground/80" : "text-muted-foreground"
        )}
      >
        {laLimita ? <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
        trimise azi {trimise === null ? "—" : num(trimise)} / {num(cont.limita_zi)}
        {laLimita ? <span className="sr-only">, limita e atinsă</span> : null}
      </span>
      <span aria-hidden="true" className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <span className={cn("block h-full rounded-full", laLimita ? "bg-apricot" : "bg-lav/70")} style={{ width: `${procent}%` }} />
      </span>
    </button>
  );
}

export function WhatsAppScreen({
  azi,
  lista,
  eroareLista,
  conturi,
  eroareConturi,
  sablon,
  eroareSetari,
}: {
  azi: string;
  lista: ListaWhatsapp | null;
  eroareLista: string | null;
  /** Toate conturile din Setări (și cele dezactivate, pentru numele din „Trimise azi”); null: nu s-au citit. */
  conturi: ContWhatsapp[] | null;
  eroareConturi: string | null;
  /** `sablon_whatsapp_primul` din Setări. */
  sablon: string;
  eroareSetari: string | null;
}) {
  const router = useRouter();
  const rand = useRef<HTMLDivElement>(null);
  const [ales, setAles] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("de_trimis");
  const [luate, setLuate] = useState<FirmaLuata[]>([]);
  // Eroarea unei firme care a dispărut din listă la reîncărcare (a luat-o alt telefon, a ieșit din listă).
  const [anunt, setAnunt] = useState<{ firmaId: string; text: string } | null>(null);

  const active = (conturi ?? []).filter((c) => c.activ);
  const chei = active.map((c) => c.id).join(",");

  useEffect(() => {
    // Citit după hidratare: serverul nu știe ce cont e ales pe telefonul ăsta.
    let salvat = Number.NaN;
    try {
      salvat = Number(window.localStorage.getItem(CHEIE_CONT));
    } catch {
      /* stocarea poate fi blocată (navigare privată) */
    }
    if (!Number.isInteger(salvat) || salvat < 1 || !chei.split(",").map(Number).includes(salvat)) return;
    setAles(salvat);
    // Pe telefon, rândul se derulează până la contul ales, fără să miște pagina.
    const r = rand.current;
    const buton = r?.querySelector<HTMLElement>(`[data-cont="${salvat}"]`);
    if (r && buton && r.scrollWidth > r.clientWidth) r.scrollLeft = Math.max(0, buton.offsetLeft - 4);
  }, [chei]);

  useEffect(() => {
    // Înapoi din WhatsApp: lista se recitește, ca firmele trimise între timp de pe alt telefon să dispară.
    let ultima = 0;
    const laRevenire = () => {
      if (document.visibilityState !== "visible" || Date.now() - ultima < 5000) return;
      ultima = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", laRevenire);
    return () => document.removeEventListener("visibilitychange", laRevenire);
  }, [router]);

  const trimiseCont = (id: number): number | null => (lista ? (lista.peCont[String(id)] ?? 0) : null);
  const plin = (c: ContWhatsapp): boolean => {
    const trimise = trimiseCont(c.id);
    return trimise !== null && trimise >= c.limita_zi;
  };
  const contAles = active.length === 1 ? active[0] : (active.find((c) => c.id === ales) ?? null);
  const numeCont = new Map((conturi ?? []).map((c) => [c.id, c.nume]));

  const idLuate = new Set(luate.map((l) => l.firma.id));
  const firme = (lista?.firme ?? []).filter((f) => !idLuate.has(f.id));
  const total = lista?.total ?? 0;
  const permise = firme.filter((f) => f.canal_permis === "whatsapp").length;
  const trimiseAzi = lista?.trimiseAzi ?? [];
  const anuntVizibil = anunt && !firme.some((f) => f.id === anunt.firmaId) ? anunt : null;

  const faraMesaj = eroareSetari
    ? "Mesajul pregătit lipsește: setările nu s-au citit. Scrie-l tu în WhatsApp, cu linkul demo de mai jos."
    : "Șablonul primului mesaj e gol: scrie-l în Setări, la șabloane. Până atunci, scrie mesajul tu, cu linkul demo de mai jos.";
  const faraCont =
    conturi === null
      ? "Conturile WhatsApp nu s-au citit: firma nu se poate marca până nu reîncarci pagina."
      : active.length === 0
        ? "Niciun cont WhatsApp activ: activează unul în Setări."
        : "Alege mai sus contul de pe care trimiți.";

  const alegeCont = (id: number) => {
    setAles(id);
    try {
      window.localStorage.setItem(CHEIE_CONT, String(id));
    } catch {
      /* fără stocare, alegerea ține până la reîncărcare */
    }
  };

  const laLuata = (luata: FirmaLuata) => setLuate((vechi) => [luata, ...vechi.filter((l) => l.firma.id !== luata.firma.id)]);
  const laGata = (firmaId: string) => setLuate((vechi) => vechi.filter((l) => l.firma.id !== firmaId));
  const laEroare = (firma: FirmaRand, text: string) => setAnunt({ firmaId: firma.id, text: `${firma.nume}: ${text}` });

  // Contul ales la limită: avertismentul și, dacă există, un cont care mai are loc.
  const trimiseAles = contAles ? trimiseCont(contAles.id) : null;
  const plinAles = contAles !== null && plin(contAles);
  const peste = plinAles && trimiseAles !== null && contAles !== null && trimiseAles > contAles.limita_zi;
  const altCont = contAles && plinAles ? active.find((c) => c.id !== contAles.id && trimiseCont(c.id) !== null && !plin(c)) : undefined;

  return (
    <div className="space-y-4">
      <PageHead
        title="WhatsApp azi"
        pill={contAles?.nume}
        subtitle="Intră singure firmele cu site demo gata și număr de mobil, necontactate pe niciun canal. Primele stau cele cu WhatsApp permis din fișa firmei. Fiecare firmă primește un singur mesaj pe WhatsApp."
        actions={firme.length ? <VcfButton firme={firme} numeFisier={`whatsapp-${azi}.vcf`} /> : null}
      />

      {eroareSetari ? (
        <InlineNote tone="rose">Setările nu s-au citit: {eroareSetari} Până se rezolvă, mesajul pregătit lipsește: scrie-l tu, cu linkul demo.</InlineNote>
      ) : sablon.includes("{utilizator}") ? (
        <InlineNote tone="apricot" className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1">
            Șablonul primului mesaj conține {"{utilizator}"}, care aici rămâne gol: pe WhatsApp trimiți de pe un cont, nu în numele cuiva. Scoate-l din șablon.
          </p>
          <Link href="/admin/prospectare/setari" className={btnClass({ variant: "outline", size: "sm", className: TAP_SM })}>
            Deschide șabloanele
          </Link>
        </InlineNote>
      ) : null}

      {conturi === null ? (
        <Card padded={false}>
          <EroareCitire
            title="Conturile WhatsApp nu s-au citit"
            message={`${eroareConturi ?? "Citirea a căzut."} Fără cont ales, nicio firmă nu se poate marca.`}
            className="py-8"
          />
        </Card>
      ) : active.length === 0 ? (
        <InlineNote tone="apricot" className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1">
            {conturi.length ? "Toate conturile WhatsApp sunt dezactivate." : "Niciun cont WhatsApp în Setări."} Adaugă sau activează unul: până atunci, nicio
            firmă nu se poate marca.
          </p>
          <Link href={SETARI_CONTURI} className={btnClass({ variant: "outline", size: "sm", className: TAP_SM })}>
            Deschide conturile
          </Link>
        </InlineNote>
      ) : (
        <Card padded={false} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <p id="conturi-whatsapp" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Trimiți de pe
            </p>
            <Link
              href={SETARI_CONTURI}
              className="-my-2 inline-flex min-h-11 items-center text-[12.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:min-h-0 sm:text-[11.5px]"
            >
              Conturile, în Setări
            </Link>
          </div>
          <div
            ref={rand}
            role="group"
            aria-labelledby="conturi-whatsapp"
            className="relative mt-2 flex snap-x snap-mandatory scroll-px-1 gap-1 overflow-x-auto overscroll-x-contain rounded-[18px] border border-white/[0.07] bg-white/[0.03] p-1 sm:grid sm:snap-none sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] sm:overflow-visible"
          >
            {active.map((c) => (
              <ContButon key={c.id} cont={c} ales={c.id === contAles?.id} trimise={trimiseCont(c.id)} onAlege={alegeCont} />
            ))}
          </div>

          {contAles === null ? (
            <p className="mt-3 text-[12.5px] text-muted-foreground">Alege contul de pe care trimiți acum. Telefonul ăsta îl ține minte.</p>
          ) : plinAles ? (
            <InlineNote tone="apricot" className="mt-3 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1">
                {peste
                  ? `${contAles.nume} e peste limita de azi: ${num(trimiseAles ?? 0)} trimise, limita e ${num(contAles.limita_zi)}.`
                  : `${contAles.nume} a ajuns la limita de azi (${num(contAles.limita_zi)}).`}{" "}
                Mesajele pleacă în continuare, dar fiecare în plus crește riscul ca WhatsApp să blocheze numărul.
                {altCont ? ` ${altCont.nume} mai are loc (${num(trimiseCont(altCont.id) ?? 0)} / ${num(altCont.limita_zi)}).` : ""}
              </p>
            </InlineNote>
          ) : (
            <p className="mt-3 text-[12px] text-muted-foreground sm:text-[11.5px]">Limita pe zi e doar un avertisment: nimic nu se blochează.</p>
          )}
        </Card>
      )}

      {luate.length ? (
        <section aria-labelledby="whatsapp-luate" className="space-y-2">
          <h2 id="whatsapp-luate" className="px-1 text-[13px] font-medium">
            Marcate acum: trimite mesajul
          </h2>
          <ul className="space-y-3">
            {luate.map((l) => (
              <li key={l.firma.id}>
                <WhatsAppLuata luata={l} faraMesaj={faraMesaj} onGata={laGata} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {anuntVizibil ? (
        <InlineNote tone="rose" className="flex items-start gap-2">
          <p className="min-w-0 flex-1">{anuntVizibil.text}</p>
          <button
            type="button"
            onClick={() => setAnunt(null)}
            aria-label="Închide anunțul"
            className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg opacity-70 hover:opacity-100 sm:h-8 sm:w-8"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </InlineNote>
      ) : null}

      <Taburi<Tab>
        ariaLabel="Lista de WhatsApp"
        value={tab}
        onChange={setTab}
        controls="lista-whatsapp"
        options={[
          { value: "de_trimis", label: "De trimis", count: total },
          { value: "trimise", label: "Trimise azi", count: trimiseAzi.length },
        ]}
      />

      <div id="lista-whatsapp">
        {lista === null ? (
          <Card>
            <ErrorState title="Lista nu s-a încărcat" text={eroareLista ?? undefined} onRetry={() => router.refresh()} />
          </Card>
        ) : tab === "de_trimis" ? (
          firme.length === 0 ? (
            <Card>
              <EmptyState
                icon={MessageCircle}
                title="Nicio firmă de scris acum"
                text="Lista se umple singură, fără import: o firmă intră când robotul îi publică site-ul demo, are număr de mobil și n-a primit încă email, WhatsApp sau apel. O firmă deja contactată intră doar dacă îi permiți WhatsApp din fișa ei."
                action={
                  <Link href="/admin/prospectare/roboti" className={btnClass({ variant: "outline", size: "sm", className: cn(TAP_SM, "gap-1.5") })}>
                    <Bot className="h-4 w-4" aria-hidden="true" />
                    Vezi ce lucrează roboții
                  </Link>
                }
              />
            </Card>
          ) : (
            <>
              <div className="mb-3 space-y-1 px-1">
                <p className="text-[13px] sm:text-[12.5px]">
                  <span className="font-medium">{firmeText(total)} în listă</span>
                  {permise > 0 ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {firmeText(permise)} cu recontactare permisă, primele
                    </span>
                  ) : null}
                </p>
                <p className="text-[12px] leading-relaxed text-muted-foreground sm:text-[11.5px]">
                  {total > firme.length ? `Vezi primele ${num(firme.length)}, după scor. ` : ""}
                  „Trimite pe WhatsApp” marchează firma pe contul ales și deschide conversația cu mesajul gata; tu apeși trimite în aplicație. Marcarea vine
                  prima, ca nimeni să nu-i scrie de două ori. Trimiți din alt telefon? „Marchează și trimit manual”: firma rămâne sus, cu numărul și mesajul
                  de copiat.
                </p>
              </div>
              <ul className="space-y-3">
                {firme.map((firma) => (
                  <li key={firma.id}>
                    <WhatsAppCard
                      firma={firma}
                      // Pe WhatsApp se trimite de pe un cont, nu în numele cuiva: {utilizator} rămâne gol.
                      mesaj={umpleSablon(sablon, firma, "")}
                      faraMesaj={faraMesaj}
                      cont={contAles}
                      faraCont={faraCont}
                      onLuata={laLuata}
                      onEroare={laEroare}
                    />
                  </li>
                ))}
              </ul>
            </>
          )
        ) : trimiseAzi.length === 0 ? (
          <Card>
            <EmptyState
              icon={Send}
              title="Niciun mesaj trimis azi"
              text="Ce marchezi din listă apare aici, cu ora și contul. De aici redeschizi conversația, fără mesajul pregătit."
            />
          </Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <p className="border-b border-white/[0.06] px-4 py-2.5 text-[12px] text-muted-foreground sm:text-[11.5px]">
              Conversația se redeschide fără mesajul pregătit, ca să nu-l trimiți de două ori.
            </p>
            <ul className="divide-y divide-white/[0.06]">
              {trimiseAzi.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium sm:text-[13px]">{f.nume}</p>
                    <p className="pu-num text-[12px] text-muted-foreground sm:text-[11.5px]">
                      {[
                        f.whatsapp_la ? timeRo(f.whatsapp_la) : null,
                        f.whatsapp_cont ? (numeCont.get(f.whatsapp_cont) ?? `contul ${f.whatsapp_cont}`) : null,
                        f.telefon ? numarAfisat(f.telefon) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {f.telefon ? (
                    <a
                      href={linkWhatsApp(f.telefon)}
                      target="_blank"
                      rel="noreferrer"
                      className={btnClass({ variant: "outline", size: "sm", className: cn(TAP_SM, "w-full gap-1.5 sm:w-auto") })}
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      Deschide conversația
                      <span className="sr-only"> cu {f.nume} (filă nouă)</span>
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

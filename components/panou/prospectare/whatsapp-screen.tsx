"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, MessageCircle, Send, X } from "lucide-react";
import { InlineNote } from "@/components/panou/ui/actions";
import { num, timeRo } from "@/components/panou/ui/format";
import { btnClass, Card } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState, ProgressBar } from "@/components/panou/ui/states";
import type { ListaWhatsapp } from "@/lib/prospectare/citire";
import { linkWhatsApp, numarAfisat, umpleSablon } from "@/lib/prospectare/contact";
import { UTILIZATORI } from "@/lib/prospectare/labels";
import type { FirmaRand, Utilizator } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { COMUTATOR_TAP, firmeText, Taburi, TAP_SM } from "./apeluri-ui";
import { PageHead } from "./page-head";
import { UserSwitch } from "./user-switch";
import { VcfButton } from "./vcf-button";
import { WhatsAppCard, WhatsAppLuata, type FirmaLuata } from "./whatsapp-card";

/**
 * „WhatsApp azi”: lista continuă și comună. O firmă intră singură când are
 * site-ul demo gata, cu link, și număr de mobil; dacă are și adresă de email,
 * abia la o zi după ce a plecat emailul. Fiecare firmă primește WhatsApp o
 * singură dată (regula e în bază). Contorul „trimise azi / limită” pe cont e
 * doar avertisment: nimic nu se blochează din cauza lui.
 */

type Tab = "de_trimis" | "trimise";

export interface ContWhatsApp {
  cont: number;
  /** Mesaje pe zi, din Setări (`whatsapp_pe_cont`); null: valoarea nu e număr. */
  limita: number | null;
}

/** Contul ales se ține minte pe dispozitiv: fiecare telefon trimite, de obicei, de pe același cont. */
const CHEIE_CONT = "prospectare_whatsapp_cont";

export function WhatsAppScreen({
  cine,
  azi,
  lista,
  eroareLista,
  conturi,
  sablon,
  eroareSetari,
}: {
  /** Cine trimite acum (cookie-ul comutatorului): apare ca autor în activitate. */
  cine: Utilizator;
  azi: string;
  lista: ListaWhatsapp | null;
  eroareLista: string | null;
  conturi: ContWhatsApp[];
  /** `sablon_whatsapp_primul` din Setări. */
  sablon: string;
  eroareSetari: string | null;
}) {
  const router = useRouter();
  const [ales, setAles] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("de_trimis");
  const [luate, setLuate] = useState<FirmaLuata[]>([]);
  // Eroarea unei firme care a dispărut din listă la reîncărcare (a luat-o celălalt, a ieșit din listă).
  const [anunt, setAnunt] = useState<{ firmaId: string; text: string } | null>(null);

  const chei = conturi.map((c) => c.cont).join(",");
  useEffect(() => {
    // Citit după hidratare: serverul nu știe ce cont e ales pe telefonul ăsta.
    let salvat = Number.NaN;
    try {
      salvat = Number(window.localStorage.getItem(CHEIE_CONT));
    } catch {
      /* stocarea poate fi blocată (navigare privată) */
    }
    if (Number.isInteger(salvat) && salvat >= 1 && chei.split(",").map(Number).includes(salvat)) setAles(salvat);
  }, [chei]);

  useEffect(() => {
    // Înapoi din WhatsApp: lista se recitește, ca firmele trimise între timp de celălalt să dispară.
    let ultima = 0;
    const laRevenire = () => {
      if (document.visibilityState !== "visible" || Date.now() - ultima < 5000) return;
      ultima = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", laRevenire);
    return () => document.removeEventListener("visibilitychange", laRevenire);
  }, [router]);

  const nume = UTILIZATORI[cine];
  const cont = conturi.length === 1 ? conturi[0].cont : conturi.some((c) => c.cont === ales) ? ales : null;
  const info = conturi.find((c) => c.cont === cont) ?? null;
  const trimiseCont = (k: number): number | null => (lista ? (lista.peCont[String(k)] ?? 0) : null);
  const plinCont = (c: ContWhatsApp): boolean => {
    const trimise = trimiseCont(c.cont);
    return trimise !== null && c.limita !== null && trimise >= c.limita;
  };

  const idLuate = new Set(luate.map((l) => l.firma.id));
  const firme = (lista?.firme ?? []).filter((f) => !idLuate.has(f.id));
  const total = lista?.total ?? 0;
  const dupaEmail = lista?.dupaEmail ?? 0;
  const trimiseAzi = lista?.trimiseAzi ?? [];
  const anuntVizibil = anunt && !firme.some((f) => f.id === anunt.firmaId) ? anunt : null;

  const faraMesaj = eroareSetari
    ? "Mesajul pregătit lipsește: setările nu s-au citit. Scrie-l tu în WhatsApp, cu linkul demo de mai jos."
    : "Șablonul primului mesaj e gol: scrie-l în Setări, la șabloane. Până atunci, scrie mesajul tu, cu linkul demo de mai jos.";
  const faraCont = conturi.length === 0 ? "Niciun cont WhatsApp în Setări: firma nu se poate marca." : "Alege mai sus contul de pe care trimiți.";

  const alegeCont = (k: number) => {
    setAles(k);
    try {
      window.localStorage.setItem(CHEIE_CONT, String(k));
    } catch {
      /* fără stocare, alegerea ține până la reîncărcare */
    }
  };

  const laLuata = (luata: FirmaLuata) => setLuate((vechi) => [luata, ...vechi.filter((l) => l.firma.id !== luata.firma.id)]);
  const laGata = (firmaId: string) => setLuate((vechi) => vechi.filter((l) => l.firma.id !== firmaId));
  const laEroare = (firma: FirmaRand, text: string) => setAnunt({ firmaId: firma.id, text: `${firma.nume}: ${text}` });

  // Contul ales: contorul de azi și, la limită, un cont care mai are loc.
  const trimiseAles = cont !== null ? trimiseCont(cont) : null;
  const limitaAles = info?.limita ?? null;
  const plin = info !== null && plinCont(info);
  const peste = plin && trimiseAles !== null && limitaAles !== null && trimiseAles > limitaAles;
  const altCont = plin ? conturi.find((c) => c.cont !== cont && trimiseCont(c.cont) !== null && c.limita !== null && !plinCont(c)) : undefined;

  return (
    <div className="space-y-4">
      <PageHead
        title="WhatsApp azi"
        pill={nume}
        subtitle="Firmele intră singure în listă când site-ul demo e gata (cele cu adresă de email, la o zi după ce a plecat emailul), iar fiecare firmă primește WhatsApp o singură dată."
        actions={firme.length ? <VcfButton firme={firme} numeFisier={`whatsapp-${azi}.vcf`} /> : null}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <UserSwitch value={cine} className={COMUTATOR_TAP} ariaLabel="Cine trimite" />
        <span className="text-[12px] text-muted-foreground sm:text-[11.5px]">Lista e aceeași pentru amândoi. Comutatorul spune cine trimite: numele apare în activitatea firmei.</span>
      </div>

      {eroareSetari ? (
        <InlineNote tone="rose">
          Setările nu s-au citit: {eroareSetari} Până se rezolvă, pagina arată conturile 1–3 cu limita de 30 pe zi și fără mesaj pregătit. La marcare, baza
          folosește conturile din Setări.
        </InlineNote>
      ) : null}

      {conturi.length === 0 ? (
        <InlineNote tone="apricot" className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1">Niciun cont WhatsApp în Setări. Pune conturile și câte mesaje trimite fiecare pe zi, la limite; până atunci, nicio firmă nu se poate marca.</p>
          <Link href="/admin/prospectare/setari" className={btnClass({ variant: "outline", size: "sm", className: TAP_SM })}>
            Deschide Setările
          </Link>
        </InlineNote>
      ) : (
        <Card padded={false} className="p-4 sm:p-5">
          <p id="conturi-whatsapp" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Trimiți de pe contul
          </p>
          <div role="group" aria-labelledby="conturi-whatsapp" className="mt-2 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
            {conturi.map((c) => {
              const activ = c.cont === cont;
              const trimise = trimiseCont(c.cont);
              const laLimita = plinCont(c);
              return (
                <button
                  key={c.cont}
                  type="button"
                  aria-pressed={activ}
                  onClick={() => alegeCont(c.cont)}
                  className={cn(
                    "flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-1.5 transition-colors sm:min-h-0 sm:flex-row sm:gap-2 sm:rounded-full sm:px-3.5",
                    activ ? "border-lav bg-lav/10 text-lav" : "border-white/[0.1] text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-[14px] font-medium sm:text-[12.5px]">Contul {c.cont}</span>
                  <span className={cn("pu-num inline-flex items-center gap-1 text-[12px] sm:text-[11.5px]", laLimita && "text-[#FFC79C]")}>
                    {laLimita ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : null}
                    <span className="sr-only">, trimise azi: </span>
                    {trimise === null ? "—" : num(trimise)}/{c.limita === null ? "—" : num(c.limita)}
                    {laLimita ? <span className="sr-only">, limita e atinsă</span> : null}
                  </span>
                </button>
              );
            })}
          </div>

          {cont === null ? (
            <p className="mt-3 text-[12.5px] text-muted-foreground">Alege contul de pe care trimiți acum. Browserul ăsta îl ține minte.</p>
          ) : (
            <div className="mt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[13px]">
                  <span className="pu-num text-[17px] font-medium">{trimiseAles === null ? "—" : num(trimiseAles)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    din {limitaAles === null ? "—" : num(limitaAles)} trimise azi de pe contul {cont}
                  </span>
                </p>
                <p className="text-[12px] text-muted-foreground sm:text-[11.5px]">Limita e doar un avertisment: nimic nu se blochează.</p>
              </div>
              <div aria-hidden="true">
                <ProgressBar
                  className="mt-2"
                  value={trimiseAles !== null && limitaAles ? (trimiseAles / limitaAles) * 100 : plin ? 100 : 0}
                  tone={plin ? "apricot" : "lav"}
                />
              </div>
              {plin ? (
                <InlineNote tone="apricot" className="mt-3 flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <p className="min-w-0 flex-1">
                    {peste
                      ? `Contul ${cont} e peste limita de azi: ${num(trimiseAles ?? 0)} trimise, limita e ${num(limitaAles ?? 0)}.`
                      : `Contul ${cont} a ajuns la limita de azi (${num(limitaAles ?? 0)}).`}{" "}
                    Mesajele pleacă în continuare, dar fiecare în plus crește riscul ca WhatsApp să blocheze contul.
                    {altCont ? ` Contul ${altCont.cont} mai are loc (${num(trimiseCont(altCont.cont) ?? 0)}/${num(altCont.limita ?? 0)}).` : ""}
                  </p>
                </InlineNote>
              ) : null}
            </div>
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
                text="Lista se umple singură, fără import: o firmă apare aici când robotul îi publică site-ul demo și are număr de mobil. Firmele cu adresă de email vin la o zi după ce a plecat emailul."
                hint={dupaEmail > 0 ? `${firmeText(dupaEmail)} ${dupaEmail === 1 ? "a primit" : "au primit"} emailul și intră în următoarele 24 de ore.` : undefined}
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
                  {dupaEmail > 0 ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {firmeText(dupaEmail)} intră în următoarele 24 de ore ({dupaEmail === 1 ? "a primit" : "au primit"} emailul)
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
                      mesaj={umpleSablon(sablon, firma, nume)}
                      faraMesaj={faraMesaj}
                      cont={cont}
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
                      {[f.whatsapp_la ? timeRo(f.whatsapp_la) : null, f.whatsapp_cont ? `contul ${f.whatsapp_cont}` : null, f.telefon ? numarAfisat(f.telefon) : null]
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

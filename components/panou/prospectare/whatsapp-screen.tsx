"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, MessageCircle, Send, Settings } from "lucide-react";
import { marcheazaWhatsapp } from "@/app/(admin)/admin/prospectare/actions";
import { InlineNote } from "@/components/panou/ui/actions";
import { num } from "@/components/panou/ui/format";
import { Btn, btnClass, Card } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState, ProgressBar } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import { umpleSablon } from "@/lib/prospectare/contact";
import { UTILIZATORI } from "@/lib/prospectare/labels";
import type { ListaCuFirma, Utilizator } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { PanouRezerva, type GrupaRezervaUi } from "./apeluri-import";
import { COMUTATOR_TAP, firmeText, NepotrivireUtilizator, Taburi, TAP_SM } from "./apeluri-ui";
import { PageHead } from "./page-head";
import { UserSwitch } from "./user-switch";
import { VcfButton } from "./vcf-button";
import { WhatsAppCard } from "./whatsapp-card";

/**
 * „WhatsApp azi”. Pagina lipsește din exportul prototipului (App.jsx o cere,
 * fișierul nu există): e refăcută din WhatsAppCard, GeneratePanel și
 * ProspectStore (genereazaWhatsapp, marcheazaTrimis), în stilul CallsPage.
 * Lista e pe cont: fiecare cont WhatsApp are limita lui pe zi, din Setări.
 */

type Tab = "de_trimis" | "trimise";

export interface ContWhatsApp {
  cont: number;
  /** Mesaje pe zi, din Setări (null: setările nu s-au citit). */
  limita: number | null;
  /** Rânduri de azi pe cont, de la toți utilizatorii (null: necunoscut). */
  folosite: number | null;
}

const mic = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

export function WhatsAppScreen({
  cine,
  salvat,
  azi,
  randuri,
  eroareLista,
  rezerva,
  eroareRezerva,
  conturi,
  contInitial,
  sablon,
  eroareSetari,
}: {
  cine: Utilizator;
  /** Cel din cookie: pe el salvează acțiunile. */
  salvat: Utilizator;
  azi: string;
  randuri: ListaCuFirma[] | null;
  eroareLista: string | null;
  rezerva: GrupaRezervaUi[] | null;
  eroareRezerva: string | null;
  conturi: ContWhatsApp[];
  contInitial: number | null;
  /** `sablon_whatsapp_primul` din Setări. */
  sablon: string;
  eroareSetari: string | null;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [ales, setAles] = useState<number | null>(contInitial);
  const [tab, setTab] = useState<Tab>("de_trimis");
  const [deschis, setDeschis] = useState(false);
  const [cerereFocus, setCerereFocus] = useState(0);

  const nume = UTILIZATORI[cine];
  const toate = randuri ?? [];
  const cont = conturi.some((c) => c.cont === ales) ? ales : (conturi[0]?.cont ?? null);
  const info = conturi.find((c) => c.cont === cont) ?? null;
  const peCont = toate.filter((r) => r.cont_whatsapp === cont);
  const deTrimis = peCont.filter((r) => r.rezultat !== "trimis");
  const trimise = peCont.filter((r) => r.rezultat === "trimis");
  const ramase = info && info.limita !== null ? Math.max(0, info.limita - (info.folosite ?? 0)) : null;

  const alegeCont = (k: number) => {
    setAles(k);
    setTab("de_trimis");
    // Contul ales rămâne în adresă (refresh, link), fără o nouă citire pe server.
    const url = new URL(window.location.href);
    url.searchParams.set("cont", String(k));
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const deschideGenerare = () => {
    setDeschis(true);
    setCerereFocus((c) => c + 1);
  };

  const laTrimis = async (linie: ListaCuFirma): Promise<void> => {
    const result = await marcheazaWhatsapp(linie.id);
    notify(result.ok ? `${linie.firma.nume}: ${mic(result.message)}` : result.message, result.ok ? undefined : "error");
    router.refresh();
  };

  const genereaza = (
    <Btn size="sm" variant="primary" icon={MessageCircle} onClick={deschideGenerare} className={TAP_SM}>
      Generează lista
    </Btn>
  );

  return (
    <div className="space-y-4">
      <PageHead
        title="WhatsApp azi"
        pill={nume}
        subtitle="Mesaje pregătite, trimise manual din telefon, cont cu cont. La generare, firmele primesc canalul WhatsApp și rămân așa."
        actions={cont && peCont.length ? <VcfButton firme={peCont.map((r) => r.firma)} numeFisier={`whatsapp-cont-${cont}-${azi}.vcf`} /> : null}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <UserSwitch value={cine} className={COMUTATOR_TAP} />
        <span className="text-[12px] text-muted-foreground sm:text-[11.5px]">Fiecare vede doar lista lui.</span>
      </div>

      <NepotrivireUtilizator cine={cine} salvat={salvat} />

      {eroareSetari ? (
        <InlineNote tone="rose">Setările nu s-au citit: {eroareSetari} Fără limitele conturilor nu se pot genera liste noi; ce e deja în listă se poate trimite.</InlineNote>
      ) : null}

      {conturi.length === 0 || cont === null ? (
        <Card>
          <EmptyState
            icon={Settings}
            title="Niciun cont WhatsApp în Setări"
            text="Pune conturile și câte mesaje trimite fiecare pe zi în Setări, la limite. Apoi generezi lista pe cont."
            action={
              <Link href="/admin/prospectare/setari" className={btnClass({ variant: "primary", size: "sm", className: TAP_SM })}>
                Deschide Setările
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div>
            <p id="conturi-whatsapp" className="mb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              Contul WhatsApp
            </p>
            <div role="group" aria-labelledby="conturi-whatsapp" className="flex flex-wrap gap-1.5">
              {conturi.map((c) => {
                const activ = c.cont === cont;
                const deFacut = toate.filter((r) => r.cont_whatsapp === c.cont && r.rezultat !== "trimis").length;
                return (
                  <button
                    key={c.cont}
                    type="button"
                    aria-pressed={activ}
                    onClick={() => alegeCont(c.cont)}
                    className={cn(
                      "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[14px] font-medium transition-colors sm:h-8 sm:px-3 sm:text-[12.5px]",
                      activ ? "border-lav bg-lav/10 text-lav" : "border-white/[0.1] text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Cont {c.cont}
                    <span className="pu-num text-[12px] font-normal opacity-80">
                      <span aria-hidden="true">· </span>
                      <span className="sr-only">, de trimis: </span>
                      {num(deFacut)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Trimise azi · contul {cont}</p>
                <p className="pu-num mt-1 text-[19px] font-medium leading-none">
                  {num(trimise.length)} <span className="text-[13px] font-normal text-muted-foreground">/ {num(peCont.length)} trimise</span>
                </p>
              </div>
              <p className="text-[12px] text-muted-foreground sm:text-[11.5px]" title="Folosite: rândurile de azi pe acest cont, ale tuturor">
                limită {info?.limita ?? "—"}/zi, folosite {info?.folosite ?? "—"} · ce nu e trimis rămâne pentru mâine
              </p>
            </div>
            <ProgressBar className="mt-2.5" value={peCont.length ? (trimise.length / peCont.length) * 100 : 0} tone="lav" />
          </Card>

          <PanouRezerva
            canal="whatsapp"
            cont={cont}
            limita={info?.limita ?? null}
            folosite={info?.folosite ?? null}
            rezerva={rezerva}
            eroareRezerva={eroareRezerva}
            deschis={deschis}
            setDeschis={setDeschis}
            cerereFocus={cerereFocus}
            onImportat={() => {
              setDeschis(false);
              setTab("de_trimis");
            }}
          />

          <Taburi<Tab>
            ariaLabel="Starea listei"
            value={tab}
            onChange={setTab}
            controls="lista-whatsapp"
            options={[
              { value: "de_trimis", label: "De trimis", count: deTrimis.length },
              { value: "trimise", label: "Trimise", count: trimise.length },
            ]}
          />

          <div id="lista-whatsapp">
            {randuri === null ? (
              <Card>
                <ErrorState title="Lista nu s-a încărcat" text={eroareLista ?? undefined} onRetry={() => router.refresh()} />
              </Card>
            ) : tab === "de_trimis" ? (
              deTrimis.length === 0 ? (
                <Card>
                  {peCont.length === 0 ? (
                    <EmptyState
                      icon={MessageCircle}
                      title={`Nicio firmă pe contul ${cont} azi`}
                      text="Generează lista din rezervă: firmele cu site gata și număr de mobil primesc canalul WhatsApp și rămân doar la tine."
                      action={genereaza}
                    />
                  ) : (
                    <EmptyState
                      icon={CircleCheck}
                      title={`Toate mesajele de pe contul ${cont} sunt trimise`}
                      text={
                        ramase === null || ramase > 0
                          ? `Mai poți genera ${ramase === null ? "o listă" : firmeText(ramase)} azi pe acest cont.`
                          : "Contul și-a atins limita de azi. Mâine pornește de la zero."
                      }
                      action={ramase === null || ramase > 0 ? genereaza : undefined}
                    />
                  )}
                </Card>
              ) : (
                <ul className="space-y-3">
                  {deTrimis.map((linie) => (
                    <li key={linie.id}>
                      <WhatsAppCard linie={linie} mesaj={umpleSablon(sablon, linie.firma, nume)} onTrimis={laTrimis} />
                    </li>
                  ))}
                </ul>
              )
            ) : trimise.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Send}
                  title="Niciun mesaj trimis încă"
                  text="După ce trimiți din telefon, apasă „Marchează trimis”: firma trece la WhatsApp trimis."
                />
              </Card>
            ) : (
              <ul className="space-y-3">
                {trimise.map((linie) => (
                  <li key={linie.id}>
                    <WhatsAppCard linie={linie} mesaj={umpleSablon(sablon, linie.firma, nume)} onTrimis={laTrimis} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

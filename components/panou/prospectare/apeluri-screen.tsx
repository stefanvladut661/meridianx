"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CircleCheck, CloudDownload, MessageCircle, Phone, X } from "lucide-react";
import { continuaPeWhatsapp, seteazaRezultat } from "@/app/(admin)/admin/prospectare/actions";
import { InlineNote } from "@/components/panou/ui/actions";
import { dateRo, num, timeRo } from "@/components/panou/ui/format";
import { Btn, btnClass, Card, Pill } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState, ProgressBar } from "@/components/panou/ui/states";
import { useToast } from "@/components/panou/ui/toast";
import { linkWhatsApp, numarAfisat, umpleSablon } from "@/lib/prospectare/contact";
import { REZULTATE, UTILIZATORI } from "@/lib/prospectare/labels";
import type { ListaCuFirma, Utilizator } from "@/lib/prospectare/types";
import { cn } from "@/lib/utils";
import { CallCard, type ExtraRezultat, type RezultatApel } from "./apeluri-card";
import { PanouRezerva, type GrupaRezervaUi } from "./apeluri-import";
import { COMUTATOR_TAP, NepotrivireUtilizator, Taburi, TAP_SM } from "./apeluri-ui";
import { PageHead } from "./page-head";
import { UserSwitch } from "./user-switch";
import { VcfButton } from "./vcf-button";

/** CallsPage din prototip, pe datele reale: lista de telefon a zilei, a celui ales în comutator. */

type Tab = "de_sunat" | "inapoi" | "terminate";

export interface SetariApeluri {
  incercariMax: number;
  scriptApel: string;
  dupaApel: string;
}

const mic = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
const momentRo = (iso: string): string => `${dateRo(iso)}, ${timeRo(iso)}`;

export function ApeluriScreen({
  cine,
  salvat,
  azi,
  acum,
  randuri,
  eroareLista,
  rezerva,
  eroareRezerva,
  setari,
  eroareSetari,
}: {
  cine: Utilizator;
  /** Cel din cookie: pe el salvează acțiunile. */
  salvat: Utilizator;
  azi: string;
  /** Momentul randării pe server: ce „Sună înapoi” a ajuns la oră (fără Date.now la hidratare). */
  acum: number;
  randuri: ListaCuFirma[] | null;
  eroareLista: string | null;
  rezerva: GrupaRezervaUi[] | null;
  eroareRezerva: string | null;
  setari: SetariApeluri;
  eroareSetari: string | null;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>("de_sunat");
  const [importDeschis, setImportDeschis] = useState(false);
  const [cerereFocus, setCerereFocus] = useState(0);
  // Firmele care ies din listă (ultima încercare, număr greșit) dispar din ecran: spunem de ce, până închide omul.
  const [anunt, setAnunt] = useState<{ text: string; ton: "apricot" | "rose" } | null>(null);

  const nume = UTILIZATORI[cine];
  const limita = setari.incercariMax || 3;
  const toate = randuri ?? [];
  const deSunat = toate.filter((r) => r.rezultat === null || r.rezultat === "nu_raspunde");
  const inapoi = toate
    .filter((r) => r.rezultat === "suna_inapoi")
    .sort((a, b) => (a.suna_inapoi_la ? Date.parse(a.suna_inapoi_la) : Infinity) - (b.suna_inapoi_la ? Date.parse(b.suna_inapoi_la) : Infinity));
  const terminate = toate.filter((r) => r.rezultat === "interesat" || r.rezultat === "nu_vrea" || r.rezultat === "numar_gresit");
  // Sunată = are un rezultat sau măcar o încercare (un „Interesat” din prima nu crește încercările).
  const sunate = toate.filter((r) => r.rezultat !== null || r.incercari > 0).length;

  const deschideImport = () => {
    setImportDeschis(true);
    setCerereFocus((c) => c + 1);
  };

  const laRezultat = async (linie: ListaCuFirma, rezultat: RezultatApel, extra: ExtraRezultat): Promise<void> => {
    const firma = linie.firma;
    const result = await seteazaRezultat({ listaId: linie.id, rezultat, nota: extra.nota, sunaInapoiLa: extra.sunaInapoiLa });
    if (!result.ok) {
      notify(result.message, "error");
      router.refresh();
      return;
    }
    const data = result.data;
    if (data?.revenit) {
      const text = `${firma.nume}: ${mic(result.message)}`;
      setAnunt({ text, ton: "apricot" });
      notify(text, "warn");
    } else if (rezultat === "numar_gresit") {
      const text = `${firma.nume}: număr greșit. Firma e marcată „Nu contacta” și a ieșit din listă.`;
      setAnunt({ text, ton: "rose" });
      notify(text, "warn");
    } else if (rezultat === "interesat") {
      const mesaj = umpleSablon(setari.dupaApel, firma, nume);
      if (!firma.telefon || !firma.este_mobil) {
        notify(`${firma.nume} e marcată interesată. Numărul e fix, fără WhatsApp: trimite-i site-ul demo pe altă cale.`);
      } else if (!mesaj) {
        notify(`${firma.nume} e marcată interesată. Șablonul de WhatsApp după apel e gol: scrie-l în Setări.`, "warn");
      } else {
        // Ca în prototip: WhatsApp se deschide singur cu mesajul de după apel.
        // Întâi fereastra (browserul o permite doar imediat după clic), apoi activitatea.
        const fereastra = window.open(linkWhatsApp(firma.telefon, mesaj), "_blank");
        if (fereastra) {
          fereastra.opener = null;
          const scris = await continuaPeWhatsapp(linie.id);
          if (scris.ok) {
            notify(`${firma.nume} e marcată interesată. WhatsApp s-a deschis cu mesajul pregătit; în activitate: continuare apel pe WhatsApp.`);
          } else {
            notify(`${firma.nume}: WhatsApp s-a deschis, dar continuarea nu s-a scris în activitate. ${scris.message}`, "error");
          }
        } else {
          notify(`${firma.nume} e marcată interesată. Browserul n-a deschis WhatsApp singur: apasă „WhatsApp după apel” la firmă, în Terminate.`, "warn");
        }
      }
    } else if (rezultat === "nu_raspunde") {
      notify(`Încercarea ${data?.incercari ?? linie.incercari + 1}/${data?.limita ?? limita} notată pentru ${firma.nume}.`);
    } else if (rezultat === "suna_inapoi") {
      notify(extra.sunaInapoiLa ? `${firma.nume} e la „Sună înapoi”: ${momentRo(extra.sunaInapoiLa)}.` : "Adăugată la „Sună înapoi” cu data aleasă.");
    } else {
      notify(`${firma.nume}: refuz notat. Firma trece la Respins.`);
    }
    router.refresh();
  };

  /** Butonul din Terminate: linkul deschide WhatsApp, iar activitatea primește continuarea (o singură dată pe apel). */
  const dupaApel = async (linie: ListaCuFirma): Promise<void> => {
    const scris = await continuaPeWhatsapp(linie.id);
    if (!scris.ok) {
      notify(`${linie.firma.nume}: continuarea pe WhatsApp nu s-a scris în activitate. ${scris.message}`, "error");
    } else if (!scris.data?.deja) {
      notify(`${linie.firma.nume}: ${mic(scris.message)}`);
    }
  };

  const card = (linie: ListaCuFirma) => (
    <CallCard
      linie={linie}
      limita={limita}
      script={umpleSablon(setari.scriptApel, linie.firma, nume)}
      mesajDupaApel={umpleSablon(setari.dupaApel, linie.firma, nume)}
      onRezultat={laRezultat}
    />
  );

  return (
    <div className="space-y-4">
      <PageHead
        title="Apeluri azi"
        pill={nume}
        subtitle="Lista de telefon a zilei. Telefonul e separat: intră doar firme cu site gata, fără email și fără WhatsApp. La import primesc canalul Telefon și rămân așa."
        actions={toate.length ? <VcfButton firme={toate.map((r) => r.firma)} numeFisier={`apeluri-${cine}-${azi}.vcf`} /> : null}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <UserSwitch value={cine} className={COMUTATOR_TAP} />
        <span className="text-[12px] text-muted-foreground sm:text-[11.5px]">Fiecare vede doar lista lui.</span>
      </div>

      <NepotrivireUtilizator cine={cine} salvat={salvat} />

      {eroareSetari ? (
        <InlineNote tone="rose">
          Setările nu s-au citit: {eroareSetari} Până se rezolvă, lista merge cu {limita} încercări și fără script sau mesaj pregătit.
        </InlineNote>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Progres azi</p>
            <p className="pu-num mt-1 text-[19px] font-medium leading-none">
              {num(sunate)} <span className="text-[13px] font-normal text-muted-foreground">/ {num(toate.length)} sunate</span>
            </p>
          </div>
          <p className="text-[12px] text-muted-foreground sm:text-[11.5px]">
            {deSunat.length === 0 ? "Lista e golită" : `rămân ${num(deSunat.length)} de sunat`} · ce nu e sunat rămâne pentru mâine
          </p>
        </div>
        <ProgressBar className="mt-2.5" value={toate.length ? (sunate / toate.length) * 100 : 0} tone="sky" />
      </Card>

      <PanouRezerva
        rezerva={rezerva}
        eroareRezerva={eroareRezerva}
        deschis={importDeschis}
        setDeschis={setImportDeschis}
        cerereFocus={cerereFocus}
        onImportat={() => {
          setImportDeschis(false);
          setTab("de_sunat");
        }}
      />

      {anunt ? (
        <InlineNote tone={anunt.ton} className="flex items-start gap-2">
          <p className="flex-1">{anunt.text}</p>
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
        ariaLabel="Starea listei"
        value={tab}
        onChange={setTab}
        controls="lista-apeluri"
        options={[
          { value: "de_sunat", label: "De sunat", count: deSunat.length },
          { value: "inapoi", label: "Sună înapoi", count: inapoi.length },
          { value: "terminate", label: "Terminate", count: terminate.length },
        ]}
      />

      <div id="lista-apeluri">
        {randuri === null ? (
          <Card>
            <ErrorState title="Lista nu s-a încărcat" text={eroareLista ?? undefined} onRetry={() => router.refresh()} />
          </Card>
        ) : tab === "de_sunat" ? (
          deSunat.length === 0 ? (
            <Card>
              <EmptyState
                icon={Phone}
                title="Nicio firmă de sunat azi"
                text="Importă din rezervă firmele cu site gata care n-au primit email sau WhatsApp. La import primesc canalul Telefon și rămân doar la tine."
                action={
                  <Btn size="sm" variant="primary" icon={CloudDownload} onClick={deschideImport} className={TAP_SM}>
                    Importă din rezervă
                  </Btn>
                }
              />
            </Card>
          ) : (
            <ul className="space-y-3">
              {deSunat.map((linie) => (
                <li key={linie.id}>{card(linie)}</li>
              ))}
            </ul>
          )
        ) : tab === "inapoi" ? (
          inapoi.length === 0 ? (
            <Card>
              <EmptyState icon={CalendarClock} title="Nimeni nu așteaptă să fie sunat înapoi" text="Când alegi „Sună înapoi”, firma apare aici, cu data și ora alese." />
            </Card>
          ) : (
            <ul className="space-y-3">
              {inapoi.map((linie) => {
                const ora = linie.suna_inapoi_la;
                const eOra = ora ? Date.parse(ora) <= acum : false;
                return (
                  <li key={linie.id} className="space-y-1.5">
                    <p className="flex flex-wrap items-center gap-1.5 px-1 text-[12px] text-muted-foreground sm:text-[11.5px]">
                      <CalendarClock className="h-3 w-3" aria-hidden="true" />
                      programat {ora ? `${dateRo(ora)} · ${timeRo(ora)}` : "fără oră"}
                      {eOra ? <Pill tone="apricot">e ora</Pill> : null}
                    </p>
                    {card(linie)}
                  </li>
                );
              })}
            </ul>
          )
        ) : terminate.length === 0 ? (
          <Card>
            <EmptyState
              icon={CircleCheck}
              title="Nicio firmă terminată încă"
              text="Aici apar firmele cu rezultat: interesat sau nu vrea. Cele cu număr greșit ies din listă și devin „Nu contacta”."
            />
          </Card>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-white/[0.06]">
              {terminate.map((linie) => {
                const firma = linie.firma;
                const meta = REZULTATE[linie.rezultat ?? "nu_vrea"] ?? REZULTATE.nu_vrea;
                const mesaj = umpleSablon(setari.dupaApel, firma, nume);
                const whatsapp = linie.rezultat === "interesat" && firma.telefon && firma.este_mobil && mesaj;
                return (
                  <li key={linie.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium sm:text-[12.5px]">{firma.nume}</p>
                      <p className="text-[12px] text-muted-foreground sm:text-[11px]">
                        {[firma.telefon ? numarAfisat(firma.telefon) : null, firma.oras, `încercări ${linie.incercari}/${limita}`].filter(Boolean).join(" · ")}
                      </p>
                      {linie.nota ? <p className="mt-0.5 break-words text-[12px] text-muted-foreground sm:text-[11px]">„{linie.nota}”</p> : null}
                    </div>
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px]", meta.badge)}>{meta.label}</span>
                    {whatsapp && firma.telefon ? (
                      <a
                        href={linkWhatsApp(firma.telefon, mesaj)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => void dupaApel(linie)}
                        aria-label={`WhatsApp după apel către ${firma.nume}`}
                        className={btnClass({ variant: "mint", size: "sm", className: cn(TAP_SM, "w-full gap-1.5 sm:w-auto") })}
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        WhatsApp după apel
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

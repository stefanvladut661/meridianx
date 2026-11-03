"use client";

import { useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Bot, Building2, CalendarClock, CalendarDays, Check, ExternalLink, Files, ImageIcon, Loader2, Lock, LockOpen, Mail, MapPin, MessageCircle, Phone, StickyNote, Star, User, X, type LucideIcon } from "lucide-react";
import { permiteRecontactare, salveazaNota, schimbaEtapa } from "@/app/(admin)/admin/prospectare/actions";
import { cn } from "@/lib/utils";
import { ConfirmDialog, CopyButton, InlineNote } from "@/components/panou/ui/actions";
import { Modal } from "@/components/panou/ui/modal";
import { Btn, btnClass, Pill } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState, Field, inputClass } from "@/components/panou/ui/states";
import { dateRo, dateTimeRo, isoDay, num, relativeRo, untilRo } from "@/components/panou/ui/format";
import { useToast } from "@/components/panou/ui/toast";
import { CANALE, ETAPE, REZULTATE, UTILIZATORI } from "@/lib/prospectare/labels";
import { numarAfisat, numarScurt } from "@/lib/prospectare/contact";
import { CANALE_IDS, REZULTATE_IDS, type Canal, type Firma, type Rezultat } from "@/lib/prospectare/types";
import type { FisaFirma } from "@/lib/prospectare/citire";
import { CanaleBadge, StageBadge } from "./stage-badge";
import { ActivitateFirma } from "./firme-activitate";
import { faraProtocol, linkWeb } from "./firme-format";

/**
 * Fișa unei firme (prototip: FirmDrawer.jsx), ca panou lateral pe `<dialog>`:
 * focusul rămâne înăuntru, Esc sau clic pe fundal o închid. Se deschide din
 * adresă (`?firma=<id>`), deci se poate trimite ca link și Înapoi o închide.
 */

export type StareFisa = { tip: "ok"; fisa: FisaFirma } | { tip: "lipsa" } | { tip: "eroare"; mesaj: string };

const FOAIE =
  "m-0 ml-auto h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain rounded-none border-0 border-l border-white/[0.09] p-0 sm:max-w-[560px] sm:rounded-l-[22px]";

export function FirmeFisa({ stare, inchideHref, acum }: { stare: StareFisa; inchideHref: string; acum: number }) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(true);
  const inchis = useRef(false);

  const inchide = () => {
    if (inchis.current) return;
    inchis.current = true;
    setDeschis(false);
    router.replace(inchideHref, { scroll: false });
  };

  return (
    <Modal
      open={deschis}
      onOpenChange={(open) => {
        if (!open) inchide();
      }}
      label={stare.tip === "ok" ? stare.fisa.firma.nume : "Fișa firmei"}
      className={FOAIE}
    >
      {/* Conținutul acoperă tot panoul: clicul pe un loc gol din fișă nu e „clic pe fundal”, deci n-o închide. */}
      <div className="min-h-full">
        {stare.tip === "ok" ? (
          <Fisa fisa={stare.fisa} acum={acum} onInchide={inchide} />
        ) : (
          <>
            <div className="flex justify-end px-5 pt-4">
              <ButonInchide onClick={inchide} />
            </div>
            {stare.tip === "lipsa" ? (
              <EmptyState
                icon={Building2}
                title="Firma nu mai e în bază"
                text="Linkul e vechi sau firma a fost scoasă. Închide fișa și caut-o în tabel după nume sau domeniu."
                action={
                  <Btn size="sm" variant="outline" onClick={inchide}>
                    Închide fișa
                  </Btn>
                }
              />
            ) : (
              <ErrorState title="Fișa firmei nu s-a încărcat" text={stare.mesaj} onRetry={() => router.refresh()} />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function ButonInchide({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Închide fișa" className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground">
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function Detaliu({ eticheta, icon: Icon, children }: { eticheta: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{eticheta}</dt>
      <dd className="mt-0.5 flex min-w-0 items-center gap-1.5">
        {Icon ? <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
        <span className="min-w-0 break-words">{children}</span>
      </dd>
    </div>
  );
}

/** Telefonul sau emailul din fișă: text de citit și de copiat, nu link de apel sau de email. */
function Contact({
  icon: Icon,
  eticheta,
  valoare,
  detaliu,
  copie,
  labelCopie,
}: {
  icon: LucideIcon;
  eticheta: string;
  valoare: string;
  detaliu?: string;
  copie: string;
  labelCopie: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-white/[0.03] px-3.5 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          {eticheta}
          {detaliu ? <span className="normal-case tracking-normal"> · {detaliu}</span> : null}
        </p>
        <p className="pu-num mt-0.5 select-all break-all text-[14px] font-medium leading-snug">{valoare}</p>
      </div>
      <CopyButton value={copie} label={labelCopie} size="xs" className="h-9 shrink-0 px-2.5 text-[12px] sm:h-8" />
    </div>
  );
}

const rezultatLista = (v: string | null) => (v && (REZULTATE_IDS as readonly string[]).includes(v) ? REZULTATE[v as Rezultat] : null);

const ICON_CANAL: Record<Canal, LucideIcon> = { email: Mail, whatsapp: MessageCircle, telefon: Phone };

/** Canalul în mijlocul unei propoziții („a primit email”, „blocat de WhatsApp”). */
const CANAL_MIC: Record<Canal, string> = { email: "email", whatsapp: "WhatsApp", telefon: "telefon" };

/** Unde ajunge firma după ce un admin îi permite canalul (în distribuție, firmele cu canal permis trec primele). */
const UNDE_PERMIS: Record<Canal, string> = {
  email: "intră prima în distribuția de email de la 00:00",
  whatsapp: "intră prima în distribuția de WhatsApp de la 00:00",
  telefon: "intră prima în rezerva pentru apeluri",
};

const laCanal = (f: Firma, c: Canal): string | null => (c === "email" ? f.email_la : c === "whatsapp" ? f.whatsapp_la : f.telefon_la);

/** Canalele pe care firma le-a primit deja. */
const canaleFolosite = (f: Firma): Canal[] => CANALE_IDS.filter((c) => Boolean(laCanal(f, c)));

/** Email bun pentru distribuție: verificat „bun” (sau neverificat), nu „doar WhatsApp”, fără trimiterea oprită. Ca prospectare_email_valid. */
function emailBun(f: Firma): boolean {
  const d = (f.date_extra ?? {}) as Record<string, unknown>;
  const oprita = d.trimitere_oprita;
  return (
    Boolean(f.email) &&
    (d.email_verificat ?? "bun") === "bun" &&
    String(d.doar_whatsapp ?? "false") !== "true" &&
    (oprita === undefined || oprita === null || oprita === "" || String(oprita) === "false")
  );
}

/** De ce firma nu poate primi canalul (îi lipsesc datele), sau null dacă îl poate primi. Aceleași verificări ca în bază. */
function lipsaPentru(f: Firma, c: Canal): string | null {
  if (c === "email") return f.email ? null : "fără adresă de email";
  // „Număr greșit” la apel: firma merge doar pe email.
  if (f.telefon_gresit) return "număr greșit: doar email";
  if (c === "whatsapp") return !f.telefon ? "fără telefon" : !f.este_mobil ? "număr fix: fără WhatsApp" : null;
  return f.telefon ? null : "fără număr";
}

// ---------------------------------------------------------------------------
// Distribuția pe canale: programarea activă și de ce firma intră (sau nu) la 00:00
// ---------------------------------------------------------------------------

type ProgramareFisa = NonNullable<FisaFirma["programari"]>[number];

/** Canalul programării în mijlocul propoziției („programată pe email”, „la apeluri”). */
const PE_CANAL: Record<Canal, string> = { email: "pe email", whatsapp: "pe WhatsApp", telefon: "la apeluri" };
/** Pagina pe care se vede (și se anulează) programarea. */
const PAGINA_CANAL: Record<Canal, { href: string; label: string }> = {
  email: { href: "/admin/prospectare/email", label: "Email" },
  whatsapp: { href: "/admin/prospectare/whatsapp", label: "WhatsApp" },
  telefon: { href: "/admin/prospectare/apeluri", label: "Apeluri azi" },
};

const ddll = (zi: string): string => `${zi.slice(8, 10)}.${zi.slice(5, 7)}`;

function plusZi(zi: string, n: number): string {
  const d = new Date(`${zi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** „azi”, „mâine” sau „pe 05.11”. */
const ziText = (zi: string, azi: string): string => (zi === azi ? "azi" : zi === plusZi(azi, 1) ? "mâine" : `pe ${ddll(zi)}`);

/** De pe ce căsuță, de pe ce cont sau cine sună. */
function undeText(p: ProgramareFisa): string | null {
  if (p.canal === "email") return p.casuta ? `de pe ${p.casuta}` : null;
  if (p.canal === "whatsapp") return p.cont_nume ?? (p.cont_whatsapp ? `contul ${p.cont_whatsapp}` : null);
  return p.utilizator ? `pentru ${UTILIZATORI[p.utilizator]}` : null;
}

/** „Programată pe email azi, de pe stefan@…”, „pe WhatsApp mâine, Cont 2”, „la apeluri pe 05.11, pentru Vlăduț”. */
const programareText = (p: ProgramareFisa, azi: string): string => [`Programată ${PE_CANAL[p.canal]} ${ziText(p.zi, azi)}`, undeText(p)].filter(Boolean).join(", ");

/** Fără programare activă: de ce firma intră sau nu în distribuția de la 00:00. Null = spun deja alte rânduri din fișă. */
function stareDistributie(f: Firma): { ton: "neutral" | "apricot"; text: string } | null {
  if (f.etapa === "nu_contacta" || f.etapa === "client" || f.etapa === "respins" || f.date_extra?.duplicat_de) return null;
  if (!f.link_demo) return { ton: "neutral", text: "Fără site demo publicat: intră în distribuție după ce robotul îl termină și îl publică." };
  if (!f.demo_verificat) return { ton: "apricot", text: "Linkul demo nu e verificat (site nepublicat): firma nu intră în distribuție până nu e verificat." };
  if (f.canal_permis) return { ton: "neutral", text: `Recontactare permisă ${PE_CANAL[f.canal_permis]}: ${UNDE_PERMIS[f.canal_permis]}.` };
  if (f.telefon_la) return { ton: "neutral", text: "E pe telefon, într-o listă de apeluri: nu intră în distribuție cât timp rămâne acolo." };
  if (f.email_la && f.whatsapp_la) return { ton: "neutral", text: "A primit email și WhatsApp: nu mai intră în distribuție (niciun canal de două ori)." };
  if (f.email_la || f.whatsapp_la) {
    const primit: Canal = f.email_la ? "email" : "whatsapp";
    const urmator: Canal = f.email_la ? "whatsapp" : "email";
    if (!["site_gata", "email_trimis", "whatsapp_trimis"].includes(f.etapa)) return { ton: "neutral", text: `Etapa „${ETAPE[f.etapa].label}”: continuă omul, nu distribuția.` };
    const lipsa = urmator === "email" ? (emailBun(f) ? null : f.email ? "emailul nu e verificat ca bun" : "fără adresă de email") : lipsaPentru(f, "whatsapp");
    if (lipsa) return { ton: "neutral", text: `A primit ${CANAL_MIC[primit]}; pe ${CANAL_MIC[urmator]} nu poate (${lipsa}): nu mai intră în distribuție.` };
    return {
      ton: "neutral",
      text: `A primit ${CANAL_MIC[primit]}: intră și pe ${CANAL_MIC[urmator]}, după vechimea site-ului, cel mai devreme a doua zi și doar dacă n-a răspuns între timp.`,
    };
  }
  if (f.etapa !== "site_gata") return { ton: "neutral", text: `Etapa „${ETAPE[f.etapa].label}”: în distribuție intră doar firmele cu site gata.` };
  return {
    ton: "neutral",
    text: f.telefon_gresit
      ? "În rezervă, doar pentru email: la 00:00 poate fi programată pe căsuța domeniului din linkul demo, după vechimea site-ului."
      : "În rezervă: la 00:00 poate fi programată pe email sau WhatsApp, după vechimea site-ului. La apeluri ajunge doar prin import sau programare.",
  };
}

function Distributie({ firma, programari, acum }: { firma: Firma; programari: FisaFirma["programari"]; acum: number }) {
  const azi = isoDay(acum);
  const activa = programari?.find((p) => p.stare === "programata") ?? null;
  const stare = activa ? null : stareDistributie(firma);
  const pagina = activa ? PAGINA_CANAL[activa.canal] : null;
  const gata = firma.site_gata_la;

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-white/[0.03] px-3.5 py-3 text-[12px] leading-relaxed">
      <h3 className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        <CalendarClock className="h-3 w-3" aria-hidden="true" />
        Distribuție
      </h3>

      {activa && pagina ? (
        <div className="rounded-lg border border-lav/25 bg-lav/[0.07] px-3 py-2.5 text-[#D8CCFF]">
          <p className="font-medium">{programareText(activa, azi)}.</p>
          <p className="mt-1 text-[11.5px] text-foreground/70">
            {activa.sursa === "automat" ? "Din distribuția de la 00:00." : `Programată manual de ${activa.creat_de}.`}
            {activa.zi_ceruta ? ` Cerută pe ${ddll(activa.zi_ceruta)}: ziua era plină.` : ""}{" "}
            {activa.zi <= azi
              ? "Celelalte canale sunt blocate azi; dacă nu pleacă până la 00:00, se întoarce în distribuție."
              : `Celelalte canale sunt blocate până atunci. Se anulează din pagina ${pagina.label}, până în ziua ei.`}
          </p>
          <Link href={pagina.href} className="mt-1 inline-block rounded-sm text-[11.5px] text-foreground/80 underline underline-offset-2 hover:text-foreground">
            Deschide {pagina.label}
          </Link>
        </div>
      ) : stare ? (
        <p className={stare.ton === "apricot" ? "text-[#FFD0AC]" : "text-muted-foreground"}>{stare.text}</p>
      ) : null}
      {programari === null ? <p className="text-muted-foreground">Programările nu s-au putut citi acum: redeschide fișa peste câteva secunde.</p> : null}

      <dl className="space-y-1.5">
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3">
          <dt className="text-muted-foreground">Site gata</dt>
          <dd className="min-w-0">
            {gata ? <time dateTime={gata}>{dateTimeRo(gata)}</time> : <span className="text-muted-foreground">fără dată</span>}
            {firma.construit_de ? <span className="text-muted-foreground">, construit de </span> : null}
            {firma.construit_de ? <span className="break-words">{firma.construit_de}</span> : null}
          </dd>
        </div>
        {firma.link_demo ? (
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3">
            <dt className="text-muted-foreground">Link demo</dt>
            <dd className={firma.demo_verificat ? undefined : "text-[#FFD0AC]"}>{firma.demo_verificat ? "verificat, publicat" : "neverificat: firma nu intră în distribuție"}</dd>
          </div>
        ) : null}
        {firma.telefon_gresit ? (
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3">
            <dt className="text-muted-foreground">Telefon</dt>
            <dd className="text-[#FFC2CE]">Număr greșit: doar email</dd>
          </div>
        ) : null}
        {firma.apel_incercari > 0 ? (
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3">
            <dt className="text-muted-foreground">Apeluri</dt>
            <dd>
              <span className="pu-num">{num(firma.apel_incercari)}</span> {firma.apel_incercari === 1 ? "încercare" : "încercări"} fără răspuns
              <span className="text-muted-foreground"> · nu e contact: firma se întoarce în distribuție</span>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

const listaCanale = (canale: Canal[]): string => canale.map((c) => CANAL_MIC[c]).join(" și ");

/** Un rând din „Canale”: folosit (bifă, cu data), permis din fișă sau liber, cu motivul pentru care nu se poate folosi. */
function RandCanal({
  canal,
  la,
  inainte,
  dupa,
  liber,
  motiv,
  permis = false,
}: {
  canal: Canal;
  la: string | null;
  inainte: string;
  dupa?: string;
  liber: string;
  motiv: string | null;
  permis?: boolean;
}) {
  const Icon = ICON_CANAL[canal];
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {CANALE[canal].label}
      </dt>
      <dd className="min-w-0">
        {la ? (
          <span>
            <Check className="mr-1 inline h-3 w-3 -translate-y-px text-mint" aria-hidden="true" />
            {inainte} <time dateTime={la}>{dateTimeRo(la)}</time>
            {dupa ?? ""}
          </span>
        ) : permis ? (
          <span className="text-[#D8CCFF]">
            <LockOpen className="mr-1 inline h-3 w-3 -translate-y-px" aria-hidden="true" />
            permis din fișă, încă nefolosit
          </span>
        ) : (
          <span className="text-muted-foreground">
            {liber}
            {motiv ? ` · ${motiv}` : ""}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * Cele trei canale ale firmei. Regula e în bază (migrarea 36): emailul și
 * WhatsApp-ul merg amândouă, câte o dată, în zile diferite; telefonul rămâne
 * separat, iar alt canal lângă el îl dă doar un admin, de aici, cu motiv
 * (permisiunea se consumă când canalul e folosit). „Nu contacta” le blochează
 * pe toate.
 */
function Canale({ firma }: { firma: Firma }) {
  const router = useRouter();
  const { notify } = useToast();
  const [dialog, setDialog] = useState(false);
  // Toast-urile stau sub fișă, deci rezultatul se vede și aici.
  const [raspuns, setRaspuns] = useState<string | null>(null);

  const blocata = firma.etapa === "nu_contacta";
  const folosite = canaleFolosite(firma);
  const permis = blocata ? null : firma.canal_permis;
  // Telefonul le blochează pe celelalte (și invers); emailul și WhatsApp-ul nu se blochează între ele.
  const blocatDe = (c: Canal): Canal[] => {
    const altele = folosite.filter((x) => x !== c);
    return c === "telefon" || altele.includes("telefon") ? altele : [];
  };
  const posibile = CANALE_IDS.filter((c) => !laCanal(firma, c) && !lipsaPentru(firma, c) && blocatDe(c).length > 0);
  const poatePermite = !blocata && folosite.length > 0 && posibile.length > 0;

  const motivLiber = (c: Canal): string | null => {
    if (blocata) return "blocat";
    const lipsa = lipsaPentru(firma, c);
    if (lipsa) return lipsa;
    const blocante = blocatDe(c);
    return blocante.length ? `blocat de ${listaCanale(blocante)}` : null;
  };

  const gata = (mesaj: string) => {
    setDialog(false);
    setRaspuns(mesaj);
    notify(`${firma.nume}. ${mesaj}`);
    router.refresh();
  };

  return (
    <>
      <div className="space-y-2.5 rounded-xl border border-border bg-white/[0.03] px-3.5 py-3 text-[12px] leading-relaxed">
        <h3 className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Canale
        </h3>
        <dl className="space-y-1.5">
          <RandCanal canal="email" la={firma.email_la} inainte="trimis" liber="netrimis" motiv={motivLiber("email")} permis={permis === "email"} />
          <RandCanal
            canal="whatsapp"
            la={firma.whatsapp_la}
            inainte="trimis"
            dupa={firma.whatsapp_cont ? `, contul ${firma.whatsapp_cont}` : undefined}
            liber="netrimis"
            motiv={motivLiber("whatsapp")}
            permis={permis === "whatsapp"}
          />
          <RandCanal canal="telefon" la={firma.telefon_la} inainte="în lista de apeluri din" liber="nu" motiv={motivLiber("telefon")} permis={permis === "telefon"} />
        </dl>

        {permis ? (
          <div className="rounded-lg border border-lav/25 bg-lav/[0.07] px-3 py-2.5 text-[#D8CCFF]">
            <p>
              <span className="font-medium">Recontactare permisă: {CANALE[permis].label}</span> · {UNDE_PERMIS[permis]}
              {firma.link_demo ? "" : " după ce site-ul demo e gata"}.
            </p>
            {firma.canal_permis_motiv ? <p className="mt-1 break-words border-l-2 border-lav/30 pl-2 italic text-foreground/80">„{firma.canal_permis_motiv}”</p> : null}
            <p className="mt-1 text-[11px] text-foreground/65">
              {firma.canal_permis_de ?? "Un admin"}
              {firma.canal_permis_la ? (
                <>
                  {" "}
                  · <time dateTime={firma.canal_permis_la}>{dateTimeRo(firma.canal_permis_la)}</time>
                </>
              ) : null}
              . Se consumă când canalul e folosit.
            </p>
          </div>
        ) : null}

        <p className="text-muted-foreground">
          {blocata ? (
            <span className="text-[#FFB0C0]">„Nu contacta”: firma nu mai primește nimic, pe niciun canal.</span>
          ) : (
            <>
              {folosite.length ? `A primit deja ${listaCanale(folosite)}.` : "Încă necontactată."} Emailul și WhatsApp-ul merg amândouă, câte o dată, niciodată
              în aceeași zi. Telefonul rămâne separat: alt canal lângă el îl permite doar un admin, de aici, cu motiv. „Nu contacta” le blochează pe toate.
            </>
          )}
        </p>

        {poatePermite ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-2.5">
            <Btn
              size="sm"
              variant="outline"
              icon={LockOpen}
              className="h-10 w-full sm:h-8 sm:w-auto"
              onClick={() => {
                setRaspuns(null);
                setDialog(true);
              }}
            >
              Permite recontactare pe alt canal
            </Btn>
            {/* Toast-ul stă sub fișă: confirmarea se vede (și se anunță) și aici. */}
            <span className="text-[11.5px] text-[#B4F2CD]" aria-live="polite">
              {raspuns}
            </span>
          </div>
        ) : null}
      </div>

      <Modal open={dialog} onOpenChange={setDialog} label="Permite recontactare pe alt canal" className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6">
        <DialogRecontactare firma={firma} folosite={folosite} onGata={gata} onRenunta={() => setDialog(false)} />
      </Modal>
    </>
  );
}

/** Dialogul „Permite recontactare”: canalul (doar cele nefolosite și posibile) și motivul, obligatoriu. */
function DialogRecontactare({ firma, folosite, onGata, onRenunta }: { firma: Firma; folosite: Canal[]; onGata: (mesaj: string) => void; onRenunta: () => void }) {
  const id = useId();
  const { notify } = useToast();
  const posibile = CANALE_IDS.filter((c) => !laCanal(firma, c) && !lipsaPentru(firma, c));
  const permisAcum = firma.canal_permis;
  const [canal, setCanal] = useState<Canal | null>(posibile.length === 1 ? posibile[0] : null);
  const [motiv, setMotiv] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [trimit, startTrimitere] = useTransition();
  const lungime = motiv.trim().length;
  const gata = Boolean(canal) && lungime >= 5 && lungime <= 500;

  const trimite = (event: FormEvent) => {
    event.preventDefault();
    if (!canal || lungime < 5) {
      setEroare(!canal ? "Alege canalul." : "Scrie motivul recontactării (cel puțin 5 caractere).");
      return;
    }
    setEroare(null);
    startTrimitere(async () => {
      const result = await permiteRecontactare({ firmaId: firma.id, canal, motiv: motiv.trim() });
      if (!result.ok) {
        setEroare(result.message);
        notify(result.message, "error");
        return;
      }
      onGata(result.message);
    });
  };

  return (
    <form onSubmit={trimite} className="space-y-4 text-left">
      <div className="space-y-1.5">
        <h2 className="text-[17px] font-semibold leading-tight">Permite recontactare pe alt canal</h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {firma.nume} a primit deja {listaCanale(folosite)}. Alege pe ce canal o mai contactăm o dată și scrie de ce. Motivul rămâne în cronologie.
        </p>
      </div>

      {permisAcum ? (
        <InlineNote tone="neutral" className="text-[12px]">
          Firma are deja recontactare permisă pe {CANALE[permisAcum].label}, încă nefolosită. Dacă alegi alt canal, permisiunea veche se înlocuiește.
        </InlineNote>
      ) : null}

      <fieldset className="space-y-2" disabled={trimit}>
        <legend className="mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Canalul</legend>
        {CANALE_IDS.map((c) => {
          const Icon = ICON_CANAL[c];
          const folosit = laCanal(firma, c);
          const lipsa = lipsaPentru(firma, c);
          const oprit = Boolean(folosit || lipsa);
          const ales = canal === c;
          const nota = folosit
            ? `folosit pe ${dateRo(folosit)}`
            : lipsa
              ? lipsa
              : permisAcum === c
                ? "permis deja; motivul se înlocuiește"
                : `${UNDE_PERMIS[c]}${firma.link_demo ? "" : " după ce site-ul demo e gata"}`;
          return (
            <label
              key={c}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                oprit ? "cursor-not-allowed border-white/[0.06] opacity-60" : "cursor-pointer hover:border-white/20",
                ales ? "border-lav/40 bg-lav/[0.08]" : oprit ? "" : "border-white/[0.09]"
              )}
            >
              <input
                type="radio"
                name={`${id}-canal`}
                value={c}
                checked={ales}
                disabled={oprit}
                onChange={() => {
                  setCanal(c);
                  setEroare(null);
                }}
                className="mt-1 h-4 w-4 shrink-0 accent-[#C6B5FF]"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {CANALE[c].label}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">{nota}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <div>
        <label htmlFor={`${id}-motiv`} className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Motivul
        </label>
        <textarea
          id={`${id}-motiv`}
          value={motiv}
          onChange={(event) => {
            setMotiv(event.target.value);
            setEroare(null);
          }}
          rows={3}
          maxLength={500}
          required
          readOnly={trimit}
          aria-describedby={`${id}-motiv-ajutor`}
          aria-invalid={eroare && lungime < 5 ? true : undefined}
          placeholder="ex. a cerut la telefon să-i trimitem și pe email linkul"
          className={inputClass("mt-1.5 h-auto resize-y py-2 leading-relaxed read-only:opacity-60")}
        />
        <p id={`${id}-motiv-ajutor`} className="mt-1 flex justify-between gap-3 text-[11.5px] text-muted-foreground">
          <span>{lungime < 5 ? `Cel puțin 5 caractere${lungime ? `: mai scrie ${5 - lungime}` : ""}.` : "Se vede în cronologia firmei."}</span>
          <span className="pu-num shrink-0">{motiv.length}/500</span>
        </p>
      </div>

      {eroare ? (
        <p className="rounded-xl border border-rose/25 bg-rose/[0.07] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#FFC2CE]" role="alert">
          {eroare}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Btn variant="ghost" onClick={onRenunta} className="h-11 sm:h-10">
          Renunță
        </Btn>
        <Btn type="submit" variant="primary" icon={trimit ? Loader2 : LockOpen} disabled={!gata || trimit} aria-busy={trimit || undefined} className="h-11 sm:h-10">
          {trimit ? "Se permite…" : canal ? `Permite ${CANAL_MIC[canal]}` : "Permite"}
        </Btn>
      </div>
    </form>
  );
}

const textExtra = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function Fisa({ fisa, acum, onInchide }: { fisa: FisaFirma; acum: number; onInchide: () => void }) {
  const { firma, activitate, liste, rezervare, original, programari } = fisa;
  const router = useRouter();
  const { notify } = useToast();
  const salvata = firma.nota ?? "";
  const [nota, setNota] = useState(salvata);
  const [notaBaza, setNotaBaza] = useState(salvata);
  // Nota s-a schimbat în bază (după salvare sau refresh): editorul pornește de la ea.
  if (salvata !== notaBaza) {
    setNotaBaza(salvata);
    setNota(salvata);
  }
  const [salvez, startSalvare] = useTransition();
  const [confirmare, setConfirmare] = useState(false);
  // Toast-urile stau sub fișă (fișa e în stratul de sus al <dialog>), deci rezultatul se vede și aici.
  const [raspunsNota, setRaspunsNota] = useState<{ ok: boolean; text: string } | null>(null);
  const [eroareEtapa, setEroareEtapa] = useState<string | null>(null);

  const modificata = nota.trim() !== salvata.trim();
  const blocata = firma.etapa === "nu_contacta";
  const programataAcum = programari?.find((p) => p.stare === "programata") ?? null;
  const demo = linkWeb(firma.link_demo);
  const siteVechi = linkWeb(firma.site_vechi);
  const statusRobot = textExtra(firma.date_extra?.status_robot);
  const terminatLa = textExtra(firma.date_extra?.terminat_la);
  const evaluatDe = textExtra(firma.date_extra?.evaluat_de);

  const salveaza = () =>
    startSalvare(async () => {
      const result = await salveazaNota({ firmaId: firma.id, nota });
      notify(result.message, result.ok ? undefined : "error");
      setRaspunsNota({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });

  const nuContacta = async () => {
    const result = await schimbaEtapa({ firmaId: firma.id, etapa: "nu_contacta" });
    if (!result.ok) {
      notify(result.message, "error");
      setEroareEtapa(result.message);
      return;
    }
    notify(`${firma.nume}: ${result.message}`, "warn");
    // Ca în prototip: fișa se închide, tabelul se recitește la închidere.
    onInchide();
  };

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-border bg-[#121216]/95 px-5 py-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1 text-left">
            <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
              <span className="pu-num shrink-0">#{firma.nr}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate font-mono">{firma.domeniu}</span>
            </div>
            <h2 className="break-words text-[19px] font-semibold leading-tight">{firma.nume}</h2>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <StageBadge etapa={firma.etapa} />
              <CanaleBadge firma={firma} />
              {firma.de_refacut ? <Pill tone="apricot">de refăcut</Pill> : null}
              {original ? <Pill tone="neutral">duplicat al #{original.nr}</Pill> : null}
              {programataAcum ? <Pill tone="lav">programată {PE_CANAL[programataAcum.canal]}, {ziText(programataAcum.zi, isoDay(acum))}</Pill> : null}
              {firma.telefon_gresit ? <Pill tone="rose">număr greșit</Pill> : null}
              {firma.link_demo && !firma.demo_verificat ? <Pill tone="apricot">demo neverificat</Pill> : null}
            </div>
          </div>
          <ButonInchide onClick={onInchide} />
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        {original ? <NotaDuplicat original={original} /> : null}

        {/* Fără tel: și mailto: aici: apelurile pleacă doar din „Apeluri azi”, unde firma intră pe telefon. */}
        {firma.telefon || firma.email ? (
          <div className="space-y-2">
            {firma.telefon ? (
              <Contact
                icon={Phone}
                eticheta="Telefon"
                detaliu={`${firma.este_mobil ? "mobil" : "fix"}${firma.telefon_gresit ? " · greșit la apel, doar email" : ""}`}
                valoare={numarAfisat(firma.telefon)}
                copie={numarScurt(firma.telefon)}
                labelCopie="Copiază numărul"
              />
            ) : null}
            {firma.email ? <Contact icon={Mail} eticheta="Email" valoare={firma.email} copie={firma.email} labelCopie="Copiază emailul" /> : null}
            <p className="text-[11px] leading-relaxed text-muted-foreground">Suni doar din „Apeluri azi”. Emailul îl trimite robotul și WhatsApp-ul pleacă din lista zilei, doar în ziua în care firma e programată.</p>
          </div>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">Fișa nu are telefon sau email. Robotul le adaugă când le găsește pe site-ul vechi sau pe hartă.</p>
        )}

        {demo ? (
          <a href={demo} target="_blank" rel="noreferrer" className={btnClass({ variant: "primary", size: "sm" })}>
            Deschide demo
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only"> (se deschide într-o filă nouă)</span>
          </a>
        ) : null}

        <Captura firma={firma} demo={demo} />

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
          <Detaliu eticheta="Nișă" icon={Building2}>
            {firma.nisa ?? "—"}
          </Detaliu>
          <Detaliu eticheta="Localitate" icon={MapPin}>
            {[firma.oras, firma.judet].filter(Boolean).join(", ") || "—"}
          </Detaliu>
          <Detaliu eticheta="Persoană de contact" icon={User}>
            {firma.persoana_contact ?? "—"}
          </Detaliu>
          <div className="min-w-0">
            <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Scor</dt>
            <dd className="mt-0.5 flex items-center gap-2">
              <span className="pu-num font-medium">{firma.scor === null ? "—" : num(firma.scor)}</span>
              {firma.scor !== null ? (
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
                  <span className="block h-full rounded-full bg-lav" style={{ width: `${Math.min(100, Math.max(0, firma.scor))}%` }} />
                </span>
              ) : null}
            </dd>
          </div>
          <Detaliu eticheta="Lot">{firma.lot ?? "—"}</Detaliu>
          <Detaliu eticheta="Adăugată" icon={CalendarDays}>
            {dateRo(firma.creat_la)}
          </Detaliu>
          {firma.evaluare ? (
            <div className="col-span-2 min-w-0">
              <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Evaluarea robotului</dt>
              <dd className="mt-1 space-y-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Pill tone={firma.evaluare === "eligibila" ? "mint" : "rose"}>{firma.evaluare === "eligibila" ? "eligibilă" : "respinsă"}</Pill>
                  {firma.scor !== null ? <span className="pu-num">scor {num(firma.scor)}</span> : null}
                  {firma.evaluat_la || evaluatDe ? (
                    <span className="text-muted-foreground">
                      {firma.evaluat_la ? <time dateTime={firma.evaluat_la}>{dateTimeRo(firma.evaluat_la)}</time> : null}
                      {firma.evaluat_la && evaluatDe ? " · " : null}
                      {evaluatDe}
                    </span>
                  ) : null}
                </p>
                {firma.evaluare_motiv ? <p className="break-words leading-relaxed text-foreground/75">{firma.evaluare_motiv}</p> : null}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="space-y-1.5 rounded-xl border border-border bg-white/[0.03] px-3.5 py-3 text-[12px]">
          <p className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Site vechi</span>
            {siteVechi ? (
              <a href={siteVechi} target="_blank" rel="noreferrer" className="truncate text-lav hover:underline">
                {faraProtocol(siteVechi)}
              </a>
            ) : (
              <span className="text-muted-foreground">nu are site</span>
            )}
          </p>
          <p className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-muted-foreground">Site demo</span>
            {demo ? (
              <a href={demo} target="_blank" rel="noreferrer" className="truncate text-lav hover:underline">
                {faraProtocol(demo)}
              </a>
            ) : (
              <span className="text-muted-foreground">încă nu există</span>
            )}
          </p>
        </div>

        <Canale firma={firma} />

        <Distributie firma={firma} programari={programari} acum={acum} />

        {rezervare || statusRobot || firma.de_refacut ? (
          <div className="flex gap-2.5 rounded-xl border border-lav/20 bg-lav/[0.06] px-3.5 py-3 text-[12px] leading-relaxed text-[#D8CCFF]">
            <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              {rezervare ? (
                <p>
                  <span className="font-medium">{rezervare.dispozitiv}</span> {rezervare.tip_lucru === "refacere" ? "reface" : "construiește"} site-ul acum. Rezervarea expiră{" "}
                  <time dateTime={rezervare.expira_la} title={dateTimeRo(rezervare.expira_la)}>
                    {untilRo(rezervare.expira_la, acum)}
                  </time>
                  .
                </p>
              ) : null}
              {statusRobot ? (
                <p>
                  Ultima stare de la robot: <span className="font-medium">{statusRobot === "gata" ? "site gata" : statusRobot}</span>
                  {terminatLa ? ` · ${relativeRo(terminatLa, acum)}` : ""}.
                </p>
              ) : null}
              {firma.de_refacut && !rezervare ? <p>Marcată de refăcut: un robot o ia înaintea firmelor noi, la următoarea rezervare.</p> : null}
            </div>
          </div>
        ) : null}

        <div>
          <Field label="Notă internă" hint="Se salvează în cronologia firmei.">
            <textarea
              value={nota}
              onChange={(event) => {
                setNota(event.target.value);
                setRaspunsNota(null);
              }}
              rows={3}
              maxLength={2000}
              readOnly={salvez}
              aria-busy={salvez || undefined}
              placeholder="ex. are două puncte de lucru, cere factură pe firmă"
              className={inputClass("h-auto resize-y py-2 leading-relaxed read-only:opacity-60")}
            />
          </Field>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className={cn("text-[11px]", raspunsNota && !raspunsNota.ok ? "text-rose" : "text-muted-foreground")} aria-live="polite">
              {salvez ? "Se salvează…" : raspunsNota && (!raspunsNota.ok || !modificata) ? raspunsNota.text : modificata ? "Modificări nesalvate" : "Nicio modificare"}
            </span>
            <Btn size="sm" variant="primary" icon={salvez ? Loader2 : StickyNote} disabled={!modificata || salvez} onClick={salveaza}>
              Salvează nota
            </Btn>
          </div>
        </div>

        {liste.length ? (
          <div>
            <h3 className="mb-2.5 text-[13px] font-semibold">În listele de apeluri</h3>
            <ul className="divide-y divide-white/[0.05] rounded-xl border border-border text-[12px]">
              {liste.map((l) => {
                const rez = rezultatLista(l.rezultat);
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                    <span className="pu-num text-muted-foreground">{dateRo(l.data)}</span>
                    <span aria-hidden="true" className="text-muted-foreground">·</span>
                    <span>{UTILIZATORI[l.utilizator] ?? l.utilizator}</span>
                    <span className="ml-auto flex items-center gap-2">
                      {l.incercari ? <span className="pu-num text-muted-foreground">{l.incercari === 1 ? "1 încercare" : `${l.incercari} încercări`}</span> : null}
                      {rez ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${rez.badge}`}>{rez.label}</span>
                      ) : (
                        <span className="text-muted-foreground">fără rezultat</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div>
          <h3 className="mb-2.5 text-[13px] font-semibold">Cronologie</h3>
          <ActivitateFirma activitate={activitate} acum={acum} />
          {activitate.length >= 200 ? <p className="mt-3 text-[11px] text-muted-foreground">Ultimele 200 de întâmplări.</p> : null}
        </div>

        <div className="border-t border-border pt-4">
          <Btn variant="danger" icon={Ban} className="w-full" disabled={blocata} onClick={() => {
              setEroareEtapa(null);
              setConfirmare(true);
            }}>
            {blocata ? "Firma e deja marcată „Nu contacta”" : "Nu contacta firma"}
          </Btn>
          {eroareEtapa ? (
            <p className="mt-2 text-[11.5px] leading-relaxed text-rose" role="alert">
              {eroareEtapa}
            </p>
          ) : null}
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Firma iese din listele de apeluri, programările ei se anulează și nu mai primește niciun mesaj. Rămâne în tabel, cu filtrul „Nu contacta”.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmare}
        onOpenChange={setConfirmare}
        title="Marchezi firma „Nu contacta”?"
        description={[firma.nume, firma.oras].filter(Boolean).join(" · ")}
        consequence="Firma iese din listele de apeluri, programările ei se anulează și nu mai primește nimic, pe niciun canal. Etapa nu se mai poate schimba după asta. O regăsești în tabel, cu filtrul „Nu contacta”."
        confirmLabel="Nu contacta"
        onConfirm={nuContacta}
      />
    </>
  );
}

/**
 * Captura site-ului demo (prototip: CapturaPreview.jsx). Robotul o urcă în
 * Drive și trimite linkul, deci aici e un buton spre ea, nu o imagine. Fără
 * captură, schițăm ecranul, ca în prototip.
 */
/**
 * Duplicatul (aceeași firmă cu alt site sau alt domeniu, marcat de robot cu `duplicat_de`): nu se contactează
 * separat, deci stă la „Nu contacta”. Linkul deschide fișa firmei originale, pe care merge contactul.
 */
function NotaDuplicat({ original }: { original: NonNullable<FisaFirma["original"]> }) {
  const o = original.firma;
  return (
    <InlineNote tone="neutral" className="flex items-start gap-2.5">
      <Files className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium text-foreground">
          Duplicat al{" "}
          {o ? (
            <Link href={`/admin/prospectare/firme?firma=${encodeURIComponent(o.id)}`} className="rounded-sm underline underline-offset-2 hover:text-foreground/80">
              #{o.nr} {o.nume}
            </Link>
          ) : (
            <>#{original.nr}</>
          )}
        </p>
        <p>
          {o
            ? `Aceeași firmă, cu alt site (${o.domeniu}). Contactul merge doar prin firma originală, așa că fișa asta stă la „Nu contacta”.`
            : `Firma originală (#${original.nr}) nu e încă în admin. Contactul merge doar prin ea, așa că fișa asta stă la „Nu contacta”.`}
        </p>
      </div>
    </InlineNote>
  );
}

function Captura({ firma, demo }: { firma: Firma; demo: string | null }) {
  const captura = linkWeb(firma.captura_url);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white/[0.02]">
      <div className="flex items-center gap-2 border-b border-border bg-white/[0.04] px-3 py-2">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          <Lock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{demo ? faraProtocol(demo) : `${firma.domeniu} — fără demo`}</span>
        </span>
      </div>

      {captura ? (
        <div className="flex flex-col items-center gap-3 px-4 py-7 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
            <ImageIcon className="h-4 w-4 text-lav" aria-hidden="true" />
          </span>
          <p className="text-[12.5px] text-muted-foreground">Captura site-ului demo e în Drive.</p>
          <a href={captura} target="_blank" rel="noreferrer" className={btnClass({ variant: "outline", size: "sm" })}>
            Deschide captura
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only"> (se deschide într-o filă nouă)</span>
          </a>
        </div>
      ) : (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-lav/[0.10] via-transparent to-mint/[0.06]" aria-hidden="true" />
          <div className="relative p-4" aria-hidden="true">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
              <span className="pu-display truncate text-[13px] tracking-[0.1em]">{firma.nume}</span>
              <span className="hidden gap-2 text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:flex">
                <span>Servicii</span>
                <span>Despre</span>
                <span>Contact</span>
              </span>
            </div>
            <p className="pu-display mt-4 max-w-[24ch] text-[19px] leading-tight">
              {firma.nisa ?? "Servicii"}
              {firma.oras ? ` în ${firma.oras}` : ""}
            </p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
              Programați o discuție, primiți oferta în aceeași zi.{firma.telefon ? ` Telefon: ${firma.telefon}` : ""}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-foreground px-2.5 py-1 text-[9.5px] font-medium text-[#0C0C10]">Cere ofertă</span>
              <span className="rounded-full border border-white/[0.16] px-2.5 py-1 text-[9.5px] text-foreground/75">Vezi serviciile</span>
            </div>
            <div className="mt-4 flex items-center gap-1 text-[9.5px] text-muted-foreground">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-2.5 w-2.5 fill-apricot text-apricot" />
              ))}
              <span className="ml-1">recenzii inventate pentru demonstrație</span>
            </div>
          </div>
          <p className="relative border-t border-white/[0.06] px-4 py-2 text-[11px] text-muted-foreground">Schiță: captura apare aici după ce robotul o urcă în Drive.</p>
        </div>
      )}
    </div>
  );
}

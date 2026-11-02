"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, Bot, Building2, CalendarDays, ExternalLink, ImageIcon, Loader2, Lock, Mail, MapPin, Phone, StickyNote, Star, User, X, type LucideIcon } from "lucide-react";
import { salveazaNota, schimbaEtapa } from "@/app/(admin)/admin/prospectare/actions";
import { cn } from "@/lib/utils";
import { ConfirmDialog, CopyButton } from "@/components/panou/ui/actions";
import { Modal } from "@/components/panou/ui/modal";
import { Btn, btnClass, Pill } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState, Field, inputClass } from "@/components/panou/ui/states";
import { dateRo, dateTimeRo, num, relativeRo, untilRo } from "@/components/panou/ui/format";
import { useToast } from "@/components/panou/ui/toast";
import { REZULTATE, UTILIZATORI } from "@/lib/prospectare/labels";
import { numarAfisat, numarScurt } from "@/lib/prospectare/contact";
import { REZULTATE_IDS, type Firma, type Rezultat } from "@/lib/prospectare/types";
import type { FisaFirma } from "@/lib/prospectare/citire";
import { CanalBadge, StageBadge } from "./stage-badge";
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

/** „Setat 2 nov. 2026, 14:20 de Ștefan. ” — fără propoziție dacă baza nu știe nici când, nici cine. */
function canalSetat(firma: Firma): string {
  if (!firma.canal_setat_la && !firma.canal_setat_de) return "";
  return `Setat${firma.canal_setat_la ? ` ${dateTimeRo(firma.canal_setat_la)}` : ""}${firma.canal_setat_de ? ` de ${firma.canal_setat_de}` : ""}. `;
}

const textExtra = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function Fisa({ fisa, acum, onInchide }: { fisa: FisaFirma; acum: number; onInchide: () => void }) {
  const { firma, activitate, liste, rezervare } = fisa;
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
  const demo = linkWeb(firma.link_demo);
  const siteVechi = linkWeb(firma.site_vechi);
  const statusRobot = textExtra(firma.date_extra?.status_robot);
  const terminatLa = textExtra(firma.date_extra?.terminat_la);

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
              <CanalBadge canal={firma.canal} />
              {firma.de_refacut ? <Pill tone="apricot">de refăcut</Pill> : null}
            </div>
          </div>
          <ButonInchide onClick={onInchide} />
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        {/* Fără tel: și mailto: aici: apelurile pleacă doar din „Apeluri azi”, unde firma primește canalul. */}
        {firma.telefon || firma.email ? (
          <div className="space-y-2">
            {firma.telefon ? (
              <Contact icon={Phone} eticheta="Telefon" detaliu={firma.este_mobil ? "mobil" : "fix"} valoare={numarAfisat(firma.telefon)} copie={numarScurt(firma.telefon)} labelCopie="Copiază numărul" />
            ) : null}
            {firma.email ? <Contact icon={Mail} eticheta="Email" valoare={firma.email} copie={firma.email} labelCopie="Copiază emailul" /> : null}
            <p className="text-[11px] leading-relaxed text-muted-foreground">Suni din „Apeluri azi”, unde firma primește canalul Telefon. Emailul îl trimite robotul.</p>
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

        <div className="space-y-1.5 rounded-xl border border-border bg-white/[0.03] px-3.5 py-3 text-[12px] leading-relaxed">
          <p className="flex flex-wrap items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">Canal</span>
            <CanalBadge canal={firma.canal} />
          </p>
          <p className="text-muted-foreground">
            {firma.canal
              ? `${canalSetat(firma)}Canalul se alege o singură dată și nu se schimbă din admin${firma.canal === "telefon" ? "; Telefon se golește singur doar după prea multe apeluri fără răspuns" : ""}.`
              : blocata
                ? "„Nu contacta”: firma nu mai primește niciun canal."
                : "Fără canal încă. Îl primește o singură dată: când intră într-o listă de apeluri sau WhatsApp ori când robotul îi trimite primul email."}
          </p>
        </div>

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
            <h3 className="mb-2.5 text-[13px] font-semibold">În listele zilei</h3>
            <ul className="divide-y divide-white/[0.05] rounded-xl border border-border text-[12px]">
              {liste.map((l) => {
                const rez = rezultatLista(l.rezultat);
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                    <span className="pu-num text-muted-foreground">{dateRo(l.data)}</span>
                    <span aria-hidden="true" className="text-muted-foreground">·</span>
                    <span>{UTILIZATORI[l.utilizator] ?? l.utilizator}</span>
                    <span aria-hidden="true" className="text-muted-foreground">·</span>
                    <span>{l.canal === "telefon" ? "Telefon" : "WhatsApp"}</span>
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
            Firma dispare din toate listele de apeluri și WhatsApp și nu mai primește niciun mesaj. Rămâne în tabel, cu filtrul „Nu contacta”.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmare}
        onOpenChange={setConfirmare}
        title="Marchezi firma „Nu contacta”?"
        description={[firma.nume, firma.oras].filter(Boolean).join(" · ")}
        consequence="Firma dispare din toate listele de apeluri și WhatsApp, iar canalul rămâne blocat. Etapa nu se mai poate schimba după asta. O regăsești în tabel, cu filtrul „Nu contacta”."
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

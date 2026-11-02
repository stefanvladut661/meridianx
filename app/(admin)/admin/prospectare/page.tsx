import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Cpu, LockOpen, Mail, MapPinned, MessageCircle, Phone, Sparkles, Users } from "lucide-react";
import { dateTimeRo, num, relativeRo } from "@/components/panou/ui/format";
import { btnClass, Card, SectionTitle } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { ActivitateFeed } from "@/components/panou/prospectare/activitate-feed";
import { MailboxTable } from "@/components/panou/prospectare/email-casute";
import { PageHead } from "@/components/panou/prospectare/page-head";
import { cate, linkFirma, RobotStare, stareRobot } from "@/components/panou/prospectare/prezentare-comun";
import { EroareCitire } from "@/components/panou/prospectare/prezentare-eroare";
import { aziBucuresti, citesteActivitateRecenta, citesteCasute, citesteDispozitive, citesteRezumat, type Rezumat } from "@/lib/prospectare/citire";
import { ETAPE, ETAPE_ORDINE } from "@/lib/prospectare/labels";
import type { Dispozitiv, Etapa } from "@/lib/prospectare/types";

export const metadata: Metadata = { title: "Prezentare — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const EYEBROW = "text-[11px] uppercase tracking-[0.14em] text-muted-foreground";
/** Etapele din care firma nu mai e contactată: în pâlnie stau separat, sub o linie. */
const IESITE: Etapa[] = ["nu_contacta", "respins"];

const linkMic = "rounded-sm text-[11.5px] text-muted-foreground hover:text-foreground";

/**
 * Câte firme au primit fiecare canal. Implicit, un singur canal pe firmă;
 * „email + WhatsApp” sunt firmele din regula veche (istoric) și cele cu al
 * doilea canal permis din fișă.
 */
function Canale({ canale }: { canale: Rezumat["canale"] }) {
  const randuri: { cheie: string; label: string; n: number; punct?: string }[] = [
    { cheie: "email", label: "Email", n: canale.email, punct: "bg-mint" },
    { cheie: "whatsapp", label: "WhatsApp", n: canale.whatsapp, punct: "bg-lav" },
    { cheie: "telefon", label: "Telefon", n: canale.telefon, punct: "bg-sky" },
    { cheie: "email_si_whatsapp", label: "email + WhatsApp", n: canale.email_si_whatsapp },
    { cheie: "fara", label: "necontactate", n: canale.fara },
  ];
  return (
    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
      {randuri.map((c) => (
        <div key={c.cheie} className="flex items-baseline gap-1.5">
          <dt className="flex items-center gap-1.5 text-[12.5px] text-foreground/80">
            {c.punct ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.punct}`} aria-hidden="true" /> : null}
            {c.label}
          </dt>
          <dd className="pu-num text-[12.5px] font-medium">{num(c.n)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Palnie({ rezumat }: { rezumat: Rezumat }) {
  const total = Math.max(rezumat.total, 1);
  const rand = (etapa: Etapa) => {
    const n = rezumat.etape[etapa] ?? 0;
    const procent = Math.round((n / total) * 100);
    return (
      <li key={etapa}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[12.5px] text-foreground/80">{ETAPE[etapa].label}</span>
          <span className="pu-num text-[12.5px] font-medium">
            {num(n)}
            <span className="sr-only">, {procent}% din total</span>
          </span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <div className="h-full rounded-full" style={{ width: n > 0 ? `${Math.max((n / total) * 100, 3)}%` : "0%", background: ETAPE[etapa].culoare }} />
        </div>
      </li>
    );
  };
  return (
    <Card>
      <SectionTitle title="Pâlnia prospectării" hint="De la firmă cercetată la client" />
      <ul className="mt-4 space-y-3">{ETAPE_ORDINE.filter((e) => !IESITE.includes(e)).map(rand)}</ul>
      <p className={`${EYEBROW} mt-4 border-t border-border pt-3`}>Ieșite din prospectare</p>
      <ul className="mt-3 space-y-3">{ETAPE_ORDINE.filter((e) => IESITE.includes(e)).map(rand)}</ul>
      <p className={`${EYEBROW} mt-4 border-t border-border pt-3`}>Canale folosite</p>
      <Canale canale={rezumat.canale} />
      <p className="mt-4 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
        Roboții construiesc, oamenii contactează. Fiecare firmă primește un singur canal: email, WhatsApp sau apel. Primul canal le blochează pe celelalte; al doilea se
        permite doar din fișa firmei, cu motiv.
        {rezumat.de_refacut > 0 ? ` ${cate(rezumat.de_refacut, "site e marcat", "site-uri sunt marcate")} de refăcut.` : null}
      </p>
    </Card>
  );
}

function Roboti({ dispozitive, acum }: { dispozitive: Dispozitiv[]; acum: number }) {
  if (dispozitive.length === 0) {
    return (
      <p className="py-4 text-[12.5px] text-muted-foreground">
        Niciun robot conectat.{" "}
        <Link href="/admin/prospectare/roboti" className="rounded-sm font-medium text-foreground underline underline-offset-2">
          Adaugă unul din Roboți
        </Link>
        , cu tokenul lui de acces.
      </p>
    );
  }
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {dispozitive.map((d) => (
        <li key={d.id} className="min-w-0 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{d.nume}</span>
            </span>
            <RobotStare stare={stareRobot(d, acum)} />
          </div>
          <p className="mt-1.5 truncate text-[11.5px] text-muted-foreground">
            {d.firma_curenta ? (
              <>
                {d.firma_curenta.tip_lucru === "refacere" ? "reface" : "construiește"}:{" "}
                <Link href={linkFirma(d.firma_curenta.id)} className="rounded-sm text-foreground/85 underline-offset-2 hover:underline">
                  {d.firma_curenta.nume}
                </Link>
              </>
            ) : (
              "fără firmă în lucru"
            )}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
            <span title={d.ultima_activitate ? dateTimeRo(d.ultima_activitate) : undefined}>{d.ultima_activitate ? relativeRo(d.ultima_activitate, acum) : "niciodată activ"}</span>
            <span aria-hidden="true">·</span>
            <span>{cate(d.site_uri_azi, "site azi", "site-uri azi")}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** /admin/prospectare — rezumatul prospectării: cifrele zilei, pâlnia, căsuțele, roboții, ultimele schimbări. */
export default async function PrezentarePage() {
  const { azi } = aziBucuresti();
  const [rezumat, activitate, casute, dispozitive] = await Promise.all([citesteRezumat(), citesteActivitateRecenta(20), citesteCasute(azi), citesteDispozitive()]);
  const acum = Date.now();

  const head = (
    <PageHead
      title="Prospectare"
      pill="un singur canal"
      subtitle="Firmele cercetate de roboți, site-urile demo gata de arătat și contactul: un singur canal pe firmă (email, WhatsApp sau apel). Al doilea canal îl permite doar un admin, din fișa firmei."
      actions={
        <Link href="/admin/prospectare/firme" className={btnClass({ variant: "primary", size: "sm" })}>
          Deschide Firme
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      }
    />
  );

  if (!rezumat.ok) {
    return (
      <div className="space-y-4">
        {head}
        <Card>
          <EroareCitire title="Nu am putut citi prospectarea" message={rezumat.message} />
        </Card>
      </div>
    );
  }

  const r = rezumat.data;

  if (r.total === 0) {
    return (
      <div className="space-y-4">
        {head}
        <Card>
          <EmptyState
            icon={Building2}
            title="Nicio firmă în baza de prospectare"
            text="Roboții nu au adus încă firme. Pornește un robot din secțiunea Roboți sau rulează importul din auto-web-rebuilder."
            action={
              <Link href="/admin/prospectare/roboti" className={btnClass({ variant: "primary", size: "sm" })}>
                Vezi roboții
              </Link>
            }
            hint={
              <>
                Importul, din repo: <code className="break-all font-mono text-foreground/80">node scripts/prospectare-import.mjs --env &lt;fișier&gt; --proba</code>. Cu{" "}
                <code className="font-mono text-foreground/80">--proba</code> spune doar ce ar adăuga; fără el, scrie. Fișierul cu cheia stă în afara repo-ului.
              </>
            }
          />
        </Card>
      </div>
    );
  }

  const clienti = r.etape.client ?? 0;
  // Câmpurile din migrarea 34: cu o bază încă nemigrată, pagina arată zero, nu cade.
  const evaluate = r.evaluate ?? { eligibile: 0, respinse: 0 };
  const nise = r.nise ?? { libere: 0, rezervate: 0, terminate: 0 };
  // „contul 1: 12 · contul 2: 8”: limita pe cont e doar avertisment, aici doar se vede câte au plecat.
  const peConturi = Object.entries(r.azi.whatsapp_pe_cont ?? {})
    .filter(([, n]) => Number(n) > 0)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([cont, n]) => `contul ${cont}: ${num(Number(n))}`)
    .join(" · ");

  return (
    <div className="space-y-4">
      {head}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className={EYEBROW}>Firme cercetate</p>
          <p className="pu-num mt-2 text-[28px] font-medium leading-none">{num(r.total)}</p>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            {num(r.etape.site_gata ?? 0)} cu site gata · {num(r.in_lucru)} în lucru la roboți
          </p>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Evaluate: {num(evaluate.eligibile)} eligibile · {num(evaluate.respinse)} respinse
            {(r.azi.evaluate ?? 0) > 0 ? ` · ${num(r.azi.evaluate)} azi` : ""}
          </p>
        </Card>

        <Card className="p-4">
          <p className={EYEBROW}>Contactate azi</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <span className="flex items-baseline gap-1" title={`${num(r.azi.apeluri_facute)} apeluri cu rezultat, din ${num(r.azi.apeluri)} în listele de azi`}>
              <Phone className="h-3.5 w-3.5 text-sky" aria-hidden="true" />
              <span className="pu-num text-[22px] font-medium leading-none">{num(r.azi.apeluri_facute)}</span>
              <span className="sr-only">apeluri</span>
            </span>
            <span className="flex items-baseline gap-1" title={`${num(r.azi.whatsapp_trimise)} mesaje WhatsApp trimise azi${peConturi ? ` (${peConturi})` : ""}`}>
              <MessageCircle className="h-3.5 w-3.5 text-lav" aria-hidden="true" />
              <span className="pu-num text-[22px] font-medium leading-none">{num(r.azi.whatsapp_trimise)}</span>
              <span className="sr-only">mesaje WhatsApp</span>
            </span>
            <span className="flex items-baseline gap-1" title={`${num(r.azi.emailuri)} emailuri trimise azi de roboți`}>
              <Mail className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
              <span className="pu-num text-[22px] font-medium leading-none">{num(r.azi.emailuri)}</span>
              <span className="sr-only">emailuri</span>
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground" aria-hidden="true">
            telefon · WhatsApp · email
          </p>
          {peConturi ? <p className="mt-1 text-[11.5px] text-muted-foreground">WhatsApp pe conturi: {peConturi}</p> : null}
        </Card>

        <Card className="p-4">
          <p className={EYEBROW}>Gata de contactat</p>
          <p className="pu-num mt-2 text-[28px] font-medium leading-none">{num(r.rezerva_telefon)}</p>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">în rezerva de apeluri: site gata, niciun contact până acum</p>
          <Link href="/admin/prospectare/whatsapp" className={`${linkMic} mt-1.5 flex items-start gap-1.5`}>
            <MessageCircle className="mt-0.5 h-3 w-3 shrink-0 text-lav" aria-hidden="true" />
            <span>
              <span className="pu-num font-medium text-foreground/85">{num(r.whatsapp_lista)}</span> în lista de WhatsApp →
            </span>
          </Link>
          {(r.recontactari_permise ?? 0) > 0 ? (
            <p className="mt-1 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
              <LockOpen className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                {cate(r.recontactari_permise, "recontactare permisă", "recontactări permise")} din fișă, {r.recontactari_permise === 1 ? "încă nefolosită" : "încă nefolosite"}
              </span>
            </p>
          ) : null}
        </Card>

        <Card className="p-4">
          <p className={EYEBROW}>Interesați</p>
          <p className="pu-num mt-2 text-[28px] font-medium leading-none">{num(r.etape.interesat ?? 0)}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Users className="h-3 w-3" aria-hidden="true" /> {num(r.azi.interesati)} noi azi · {cate(clienti, "client", "clienți")}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Palnie rezumat={r} />

        <Card className="min-w-0">
          <SectionTitle
            title="Căsuțe de email"
            hint="Câte mesaje au plecat azi din fiecare adresă"
            action={
              <Link href="/admin/prospectare/email" className={linkMic}>
                Deschide Email →
              </Link>
            }
          />
          <div className="mt-3">{casute.ok ? <MailboxTable casute={casute.data} compact /> : <EroareCitire title="Căsuțele nu s-au putut citi" message={casute.message} className="py-8" />}</div>
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="Roboți"
          hint={`${cate(r.roboti_activi, "robot activ", "roboți activi")} acum, din ${cate(r.roboti, "pornit", "porniți")} · ${cate(r.in_lucru, "firmă", "firme")} în lucru · ${num(r.coada_constructie)} în coada de construcție`}
          action={
            <Link href="/admin/prospectare/roboti" className={linkMic}>
              Toți roboții →
            </Link>
          }
        />
        <div className="mt-3">{dispozitive.ok ? <Roboti dispozitive={dispozitive.data} acum={acum} /> : <EroareCitire title="Roboții nu s-au putut citi" message={dispozitive.message} className="py-8" />}</div>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
          <MapPinned className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            Nișe: <span className="pu-num font-medium text-foreground/85">{num(nise.rezervate)}</span> rezervate ·{" "}
            <span className="pu-num font-medium text-foreground/85">{num(nise.libere)}</span> libere ·{" "}
            <span className="pu-num font-medium text-foreground/85">{num(nise.terminate)}</span> terminate
          </span>
          <Link href="/admin/prospectare/nise" className={`${linkMic} ml-auto`}>
            Tabla de nișe →
          </Link>
        </p>
      </Card>

      <Card>
        <SectionTitle
          title="Activitate recentă"
          hint="Ultimii 20 de pași, de la roboți și de la voi"
          action={
            <Link href="/admin/prospectare/firme" className={linkMic}>
              Toate firmele →
            </Link>
          }
        />
        <div className="mt-4">{activitate.ok ? <ActivitateFeed activitate={activitate.data} acum={acum} /> : <EroareCitire title="Activitatea nu s-a putut citi" message={activitate.message} className="py-8" />}</div>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Etapele se colorează la fel în tot modulul:{" "}
        {ETAPE_ORDINE.slice(0, 3)
          .map((e) => ETAPE[e].label)
          .join(" · ")}{" "}
        … și așa mai departe.
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Cpu, LayoutTemplate, LockOpen, Mail, MapPinned, MessageCircle, Phone, Sparkles, Users, type LucideIcon } from "lucide-react";
import { dateTimeRo, num, relativeRo, timeRo } from "@/components/panou/ui/format";
import { btnClass, Card, SectionTitle } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { ActivitateFeed } from "@/components/panou/prospectare/activitate-feed";
import { MailboxTable } from "@/components/panou/prospectare/email-casute";
import { PageHead } from "@/components/panou/prospectare/page-head";
import { cate, linkFirma, RobotStare, stareRobot } from "@/components/panou/prospectare/prezentare-comun";
import { EroareCitire } from "@/components/panou/prospectare/prezentare-eroare";
import {
  aziBucuresti,
  citesteActivitateRecenta,
  citesteCasute,
  citesteDispozitive,
  citesteRezumat,
  citesteRezumatDistributie,
  citesteSiteuriConstruite,
  type Rezumat,
} from "@/lib/prospectare/citire";
import { ETAPE, ETAPE_ORDINE } from "@/lib/prospectare/labels";
import type { Dispozitiv, Etapa, RezumatDistributie } from "@/lib/prospectare/types";

export const metadata: Metadata = { title: "Prezentare — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const EYEBROW = "text-[12.5px] uppercase tracking-[0.14em] text-muted-foreground";
/** Etapele din care firma nu mai e contactată: în pâlnie stau separat, sub o linie. */
const IESITE: Etapa[] = ["nu_contacta", "respins"];

const linkMic = "rounded-sm text-[13px] text-muted-foreground hover:text-foreground";

/**
 * Câte firme au primit fiecare canal. Din migrarea 36, firmele cu email și
 * mobil le primesc pe amândouă, câte o dată, în zile diferite: „email +
 * WhatsApp” sunt cele care le-au primit deja pe amândouă.
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
          <dt className="flex items-center gap-1.5 text-[14px] text-foreground/80">
            {c.punct ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.punct}`} aria-hidden="true" /> : null}
            {c.label}
          </dt>
          <dd className="pu-num text-[14px] font-medium">{num(c.n)}</dd>
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
          <span className="text-[14px] text-foreground/80">{ETAPE[etapa].label}</span>
          <span className="pu-num text-[14px] font-medium">
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
      <p className="mt-4 border-t border-border pt-3 text-[13px] text-muted-foreground">
        Roboții construiesc, oamenii contactează. Firmele cu email și mobil primesc și email, și WhatsApp: câte o dată, niciodată în aceeași zi, și doar dacă n-au
        răspuns între timp. Telefonul rămâne separat: alt canal lângă el se permite doar din fișa firmei, cu motiv.
        {rezumat.de_refacut > 0 ? ` ${cate(rezumat.de_refacut, "site e marcat", "site-uri sunt marcate")} de refăcut.` : null}
      </p>
    </Card>
  );
}

function Roboti({ dispozitive, acum }: { dispozitive: Dispozitiv[]; acum: number }) {
  if (dispozitive.length === 0) {
    return (
      <p className="py-4 text-[14px] text-muted-foreground">
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
            <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-medium">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{d.nume}</span>
            </span>
            <RobotStare stare={stareRobot(d, acum)} />
          </div>
          <p className="mt-1.5 truncate text-[13px] text-muted-foreground">
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
          <p className="mt-1 flex flex-wrap gap-x-2 text-[12.5px] text-muted-foreground">
            <span title={d.ultima_activitate ? dateTimeRo(d.ultima_activitate) : undefined}>{d.ultima_activitate ? relativeRo(d.ultima_activitate, acum) : "niciodată activ"}</span>
            <span aria-hidden="true">·</span>
            <span>{cate(d.site_uri_azi, "site azi", "site-uri azi")}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Un canal din „Distribuția pe canale”: azi, mâine, rezerva și ce s-a întors la 00:00. */
interface RandDistributie {
  cheie: string;
  label: string;
  Icon: LucideIcon;
  ton: string;
  href: string;
  azi: number;
  aziDetaliu: string;
  maine: number;
  maineDetaliu: string;
  rezerva: number;
  intoarse: number;
  intoarseDetaliu: string;
}

function randuriDistributie(d: RezumatDistributie): RandDistributie[] {
  return [
    {
      cheie: "email",
      label: "Email",
      Icon: Mail,
      ton: "text-mint",
      href: "/admin/prospectare/email",
      azi: d.programate_azi.email,
      aziDetaliu: `din ${num(d.capacitate.email)} posibile · ${num(d.programate_azi.email_ramase)} de trimis`,
      maine: d.programate_maine.email,
      maineDetaliu: "manuale; restul la 00:00",
      rezerva: d.rezerva.email,
      intoarse: d.intoarse_la_00.email,
      intoarseDetaliu: "neplecate ieri",
    },
    {
      cheie: "whatsapp",
      label: "WhatsApp",
      Icon: MessageCircle,
      ton: "text-lav",
      href: "/admin/prospectare/whatsapp",
      azi: d.programate_azi.whatsapp,
      aziDetaliu: `din ${num(d.capacitate.whatsapp)} posibile · ${num(d.programate_azi.whatsapp_ramase)} de trimis`,
      maine: d.programate_maine.whatsapp,
      maineDetaliu: "manuale; restul la 00:00",
      rezerva: d.rezerva.whatsapp,
      intoarse: d.intoarse_la_00.whatsapp,
      intoarseDetaliu: "netrimise ieri",
    },
    {
      cheie: "telefon",
      label: "Apeluri",
      Icon: Phone,
      ton: "text-sky",
      href: "/admin/prospectare/apeluri",
      azi: d.apeluri_azi.total,
      aziDetaliu: `în listele de azi · ${num(d.apeluri_azi.sunate)} sunate`,
      maine: d.programate_maine.telefon,
      maineDetaliu: "programate manual",
      rezerva: d.rezerva.telefon,
      intoarse: d.intoarse_la_00.telefon,
      intoarseDetaliu: "nesunate ieri",
    },
  ];
}

/**
 * Distribuția de la 00:00, pe canale: emailul și WhatsApp-ul se programează singure (cât permit
 * căsuțele și conturile), apelurile doar prin import sau programare manuală. Tabel de la 768 în sus, carduri sub.
 */
function Distributie({ d }: { d: RezumatDistributie }) {
  const randuri = randuriDistributie(d);
  const c = d.ciclu;
  const laZeroZero = [
    c.mutate > 0 ? `${cate(c.mutate, "programare manuală mutată", "programări manuale mutate")} pe mâine (ziua era plină)` : null,
    c.anulate > 0 ? `${cate(c.anulate, "programare anulată", "programări anulate")} (firma nu mai putea merge pe canal)` : null,
    c.suna_inapoi > 0 ? `${cate(c.suna_inapoi, "„Sună înapoi” trecut", "„Sună înapoi” trecute")} pe azi` : null,
  ].filter(Boolean);
  return (
    <Card>
      <SectionTitle
        title="Distribuția pe canale"
        hint={`${c.zi === d.azi ? `A rulat azi la ${timeRo(c.rulat_la)}` : `Ultima rulare: ${dateTimeRo(c.rulat_la)}`} · ${cate(d.rezerva.total, "firmă", "firme")} în rezervă, neprogramate`}
      />

      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Programate azi și mâine, rezerva și ce s-a întors la 00:00, pe fiecare canal</caption>
          <thead>
            <tr className="border-b border-border text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                Canal
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Azi
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Mâine
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                În rezervă
              </th>
              <th scope="col" className="py-2 font-medium">
                Întoarse la 00:00
              </th>
            </tr>
          </thead>
          <tbody>
            {randuri.map((r) => (
              <tr key={r.cheie} className="border-b border-border/70 align-top last:border-0">
                <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                  <Link href={r.href} className="inline-flex items-center gap-1.5 rounded-sm text-[14px] font-medium hover:underline">
                    <r.Icon className={`h-3.5 w-3.5 shrink-0 ${r.ton}`} aria-hidden="true" />
                    {r.label}
                  </Link>
                </th>
                <td className="py-2.5 pr-3">
                  <p className="pu-num text-[19px] font-medium leading-none">{num(r.azi)}</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">{r.aziDetaliu}</p>
                </td>
                <td className="py-2.5 pr-3">
                  <p className="pu-num text-[19px] font-medium leading-none">{num(r.maine)}</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">{r.maineDetaliu}</p>
                </td>
                <td className="py-2.5 pr-3">
                  <p className="pu-num text-[19px] font-medium leading-none">{num(r.rezerva)}</p>
                </td>
                <td className="py-2.5">
                  <p className="pu-num text-[19px] font-medium leading-none">{num(r.intoarse)}</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">{r.intoarseDetaliu}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 space-y-2.5 md:hidden">
        {randuri.map((r) => (
          <li key={r.cheie} className="rounded-xl border border-border p-3">
            <Link href={r.href} className="inline-flex items-center gap-1.5 rounded-sm text-[14px] font-medium hover:underline">
              <r.Icon className={`h-3.5 w-3.5 shrink-0 ${r.ton}`} aria-hidden="true" />
              {r.label}
            </Link>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2.5">
              {[
                { label: "Azi", n: r.azi, detaliu: r.aziDetaliu },
                { label: "Mâine", n: r.maine, detaliu: r.maineDetaliu },
                { label: "În rezervă", n: r.rezerva, detaliu: null },
                { label: "Întoarse la 00:00", n: r.intoarse, detaliu: r.intoarseDetaliu },
              ].map((x) => (
                <div key={x.label} className="min-w-0">
                  <dt className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground">{x.label}</dt>
                  <dd className="pu-num mt-0.5 text-[17px] font-medium leading-tight">{num(x.n)}</dd>
                  {x.detaliu ? <dd className="text-[12.5px] leading-snug text-muted-foreground">{x.detaliu}</dd> : null}
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-border pt-3 text-[13px] leading-relaxed text-muted-foreground">
        La 00:00, firmele cu site gata și publicat se programează de la cele mai vechi site-uri: întâi pe email (pe căsuța domeniului din linkul demo), apoi
        pe WhatsApp, cât permit căsuțele și conturile; cele care au primit unul dintre ele într-o zi de dinainte intră și pe celălalt. Ziua se completează și peste zi,
        când crește o limită sau apar site-uri noi. Apelurile nu se programează singure: rezerva lor se importă în „Apeluri azi” sau se programează manual. O firmă poate
        merge pe mai multe canale, deci rezervele se suprapun; totalul de sus o numără o singură dată.
        {laZeroZero.length ? ` Tot la 00:00: ${laZeroZero.join(" · ")}.` : null}
      </p>
    </Card>
  );
}

/** /admin/prospectare — rezumatul prospectării: cifrele zilei, distribuția pe canale, pâlnia, căsuțele, roboții, ultimele schimbări. */
export default async function PrezentarePage() {
  const { azi } = aziBucuresti();
  const [rezumat, activitate, casute, dispozitive, construite, distributie] = await Promise.all([
    citesteRezumat(),
    citesteActivitateRecenta(20),
    citesteCasute(azi),
    citesteDispozitive(),
    citesteSiteuriConstruite(),
    citesteRezumatDistributie(),
  ]);
  const acum = Date.now();

  const head = (
    <PageHead
      title="Prospectare"
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4">
          <p className={EYEBROW}>Firme cercetate</p>
          <p className="pu-num mt-2 text-[28px] font-medium leading-none">{num(r.total)}</p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{num(r.in_lucru)} în lucru la roboți acum</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Evaluate: {num(evaluate.eligibile)} eligibile · {num(evaluate.respinse)} respinse
            {(r.azi.evaluate ?? 0) > 0 ? ` · ${num(r.azi.evaluate)} azi` : ""}
          </p>
        </Card>

        <Card className="p-4">
          <p className={EYEBROW}>Site-uri construite (total)</p>
          {construite.ok ? (
            <>
              <p className="pu-num mt-2 flex items-baseline gap-1.5 text-[28px] font-medium leading-none">
                <LayoutTemplate className="h-4 w-4 self-center text-muted-foreground" aria-hidden="true" />
                {num(construite.data.total)}
              </p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                <span className="pu-num font-medium text-foreground/85">{num(construite.data.gata)}</span> gata, necontactate ·{" "}
                <span className="pu-num font-medium text-foreground/85">{num(construite.data.contactate)}</span> trimise
              </p>
              {construite.data.de_refacut > 0 || construite.data.oprite > 0 ? (
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {construite.data.de_refacut > 0 ? (
                    <>
                      <span className="pu-num font-medium text-foreground/85">{num(construite.data.de_refacut)}</span> de refăcut
                    </>
                  ) : null}
                  {construite.data.de_refacut > 0 && construite.data.oprite > 0 ? " · " : null}
                  {construite.data.oprite > 0 ? (
                    <span title="Site construit, dar firma e la „Nu contacta” (ex. duplicat) sau respinsă">
                      <span className="pu-num font-medium text-foreground/85">{num(construite.data.oprite)}</span> oprite
                    </span>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">Nu am putut număra site-urile: {construite.message}</p>
          )}
        </Card>

        <Card className="p-4">
          <p className={EYEBROW}>Trimise (total)</p>
          <dl className="mt-2 space-y-1.5">
            {[
              { cheie: "email", label: "pe email", n: r.canale.email, azi: r.azi.emailuri, Icon: Mail, ton: "text-mint" },
              { cheie: "whatsapp", label: "pe WhatsApp", n: r.canale.whatsapp, azi: r.azi.whatsapp_trimise, Icon: MessageCircle, ton: "text-lav" },
              { cheie: "telefon", label: "prin apel", n: r.canale.telefon, azi: r.azi.apeluri_facute, Icon: Phone, ton: "text-sky" },
            ].map(({ cheie, label, n, azi: nAzi, Icon, ton }) => (
              <div key={cheie} className="flex items-baseline justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-[14px] text-foreground/80">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${ton}`} aria-hidden="true" />
                  {label}
                </dt>
                <dd className="text-right">
                  <span className="pu-num text-[19px] font-medium leading-none">{num(n)}</span>
                  {nAzi > 0 ? <span className="pu-num ml-1.5 text-[12.5px] text-muted-foreground">+{num(nAzi)} azi</span> : null}
                </dd>
              </div>
            ))}
          </dl>
          {peConturi ? <p className="mt-1.5 text-[13px] text-muted-foreground">WhatsApp azi pe conturi: {peConturi}</p> : null}
        </Card>

        <Card className="p-4">
          <p className={EYEBROW}>Gata de contactat</p>
          {distributie.ok ? (
            <>
              <p className="pu-num mt-2 text-[28px] font-medium leading-none">{num(distributie.data.rezerva.total)}</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">în rezervă: site gata și publicat, niciun contact, neprogramate</p>
              <Link href="/admin/prospectare/email" className={`${linkMic} mt-1.5 flex items-start gap-1.5`}>
                <Mail className="mt-0.5 h-3 w-3 shrink-0 text-mint" aria-hidden="true" />
                <span>
                  <span className="pu-num font-medium text-foreground/85">{num(distributie.data.programate_azi.email_ramase)}</span> programate azi pe email, încă netrimise →
                </span>
              </Link>
              <Link href="/admin/prospectare/whatsapp" className={`${linkMic} mt-1 flex items-start gap-1.5`}>
                <MessageCircle className="mt-0.5 h-3 w-3 shrink-0 text-lav" aria-hidden="true" />
                <span>
                  <span className="pu-num font-medium text-foreground/85">{num(distributie.data.programate_azi.whatsapp_ramase)}</span> programate azi pe WhatsApp, încă
                  netrimise →
                </span>
              </Link>
            </>
          ) : (
            <>
              <p className="pu-num mt-2 text-[28px] font-medium leading-none">{num(r.rezerva_telefon)}</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">pot merge la apeluri: site gata și publicat, niciun contact, neprogramate</p>
              <Link href="/admin/prospectare/whatsapp" className={`${linkMic} mt-1.5 flex items-start gap-1.5`}>
                <MessageCircle className="mt-0.5 h-3 w-3 shrink-0 text-lav" aria-hidden="true" />
                <span>
                  <span className="pu-num font-medium text-foreground/85">{num(r.whatsapp_lista)}</span> programate azi pe WhatsApp, încă netrimise →
                </span>
              </Link>
            </>
          )}
          {(r.recontactari_permise ?? 0) > 0 ? (
            <p className="mt-1 flex items-start gap-1.5 text-[13px] text-muted-foreground">
              <LockOpen className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                {cate(r.recontactari_permise, "recontactare permisă", "recontactări permise")} din fișă, {r.recontactari_permise === 1 ? "încă nefolosită" : "încă nefolosite"}
              </span>
            </p>
          ) : null}
        </Card>

        <Card className="p-4 sm:col-span-2 xl:col-span-1">
          <p className={EYEBROW}>Interesați</p>
          <p className="pu-num mt-2 text-[28px] font-medium leading-none">{num(r.etape.interesat ?? 0)}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Users className="h-3 w-3" aria-hidden="true" /> {num(r.azi.interesati)} noi azi · {cate(clienti, "client", "clienți")}
          </p>
        </Card>
      </div>

      {distributie.ok ? (
        <Distributie d={distributie.data} />
      ) : (
        <Card>
          <SectionTitle title="Distribuția pe canale" />
          <EroareCitire title="Distribuția nu s-a putut citi" message={distributie.message} className="py-8" />
        </Card>
      )}

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
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-[13px] text-muted-foreground">
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

      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
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

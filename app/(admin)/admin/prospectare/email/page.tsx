import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { dateTimeRo, timeRo } from "@/components/panou/ui/format";
import { Card, SectionTitle } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { PageHead } from "@/components/panou/prospectare/page-head";
import { StageBadge } from "@/components/panou/prospectare/stage-badge";
import { MailboxTable } from "@/components/panou/prospectare/email-casute";
import { EmailGrafic } from "@/components/panou/prospectare/email-grafic";
import { EmailRaspunsuri } from "@/components/panou/prospectare/email-raspunsuri";
import { EroareCitire } from "@/components/panou/prospectare/prezentare-eroare";
import { cate, linkFirma } from "@/components/panou/prospectare/prezentare-comun";
import { aziBucuresti, citesteCasute, citesteEmailuriAzi, citesteIstoricCasute, citesteRaspunsuri } from "@/lib/prospectare/citire";

export const metadata: Metadata = { title: "Email — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ZILE = 14;

/** /admin/prospectare/email — căsuțele, ultimele 14 zile, emailurile de azi și răspunsurile. */
export default async function EmailPage() {
  const { azi, inceputAzi } = aziBucuresti();
  const acum = Date.now();
  const de = new Date(acum - ZILE * 24 * 60 * 60 * 1000).toISOString();
  const [casute, istoric, emailuri, raspunsuri] = await Promise.all([
    citesteCasute(azi),
    citesteIstoricCasute(azi, ZILE),
    citesteEmailuriAzi(inceputAzi),
    citesteRaspunsuri(de),
  ]);

  const nrCasute = casute.ok ? casute.data.length : 0;
  const pozitive = raspunsuri.ok ? raspunsuri.data.filter((r) => r.tip === "pozitiv").length : 0;

  return (
    <div className="space-y-4">
      <PageHead
        title="Email"
        pill="căsuțe separate"
        subtitle={`${nrCasute > 0 ? `${cate(nrCasute, "căsuță care se încălzește", "căsuțe care se încălzesc")} separat` : "Căsuțele se încălzesc separat"}. O firmă contactată pe email nu mai intră în listele de telefon sau WhatsApp.`}
      />

      <Card>
        <SectionTitle
          title="Căsuțe de email"
          hint="Trimise azi, limita fiecărei adrese și starea încălzirii"
          action={
            <Link href="/admin/prospectare/setari" className="rounded-sm text-[11.5px] text-muted-foreground hover:text-foreground">
              Plafoane în Setări →
            </Link>
          }
        />
        <div className="mt-3">{casute.ok ? <MailboxTable casute={casute.data} /> : <EroareCitire title="Căsuțele nu s-au putut citi" message={casute.message} className="py-8" />}</div>
      </Card>

      <Card>
        <SectionTitle title="Ultimele 14 zile" hint="Mesaje trimise și răspunsuri primite, pe toate căsuțele" />
        <div className="mt-3">{istoric.ok ? <EmailGrafic zile={istoric.data} /> : <EroareCitire title="Istoricul nu s-a putut citi" message={istoric.message} className="py-8" />}</div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <SectionTitle title="Emailuri trimise azi" hint={emailuri.ok ? cate(emailuri.data.length, "mesaj", "mesaje") : undefined} />
          </div>
          {!emailuri.ok ? (
            <EroareCitire title="Jurnalul nu s-a încărcat" message={emailuri.message} />
          ) : emailuri.data.length === 0 ? (
            <EmptyState icon={Mail} title="Niciun email trimis azi" text="Când roboții trimit, mesajele apar aici cu ora și căsuța folosită." />
          ) : (
            <div className="max-h-[560px] overflow-y-auto" tabIndex={0} role="region" aria-label="Emailuri trimise azi">
              <ul className="divide-y divide-border">
                {emailuri.data.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                    <time dateTime={e.la} className="pu-num w-12 shrink-0 text-[12px] text-muted-foreground">
                      {timeRo(e.la)}
                    </time>
                    <div className="min-w-0 flex-1">
                      <Link href={linkFirma(e.firma.id)} className="block truncate rounded-sm text-[12.5px] font-medium underline-offset-2 hover:underline">
                        <span className="pu-num text-muted-foreground">#{e.firma.nr}</span> {e.firma.nume}
                      </Link>
                      <p className="truncate text-[11px] text-muted-foreground">{e.casuta ?? "căsuță necunoscută"}</p>
                    </div>
                    <StageBadge etapa={e.firma.etapa} className="px-2 py-0 text-[10.5px]" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <SectionTitle
              title="Răspunsuri"
              hint={raspunsuri.ok ? `${cate(raspunsuri.data.length, "răspuns primit", "răspunsuri primite")} în ultimele 14 zile${pozitive ? ` · ${cate(pozitive, "pozitiv", "pozitive")}` : ""}` : undefined}
            />
          </div>
          {raspunsuri.ok ? (
            <div className="max-h-[720px] overflow-y-auto" tabIndex={0} role="region" aria-label="Răspunsuri la email">
              <EmailRaspunsuri raspunsuri={raspunsuri.data} acum={acum} />
            </div>
          ) : (
            <EroareCitire title="Răspunsurile nu s-au putut citi" message={raspunsuri.message} />
          )}
          <p className="border-t border-border px-4 py-2.5 text-[10.5px] text-muted-foreground">
            Răspunsurile le raportează roboții din căsuțe. Un „NU” mută firma singur la „Nu contacta”. Ultima actualizare: {dateTimeRo(acum)}.
          </p>
        </Card>
      </div>
    </div>
  );
}

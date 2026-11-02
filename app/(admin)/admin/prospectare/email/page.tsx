import type { Metadata } from "next";
import Link from "next/link";
import { dateTimeRo, num } from "@/components/panou/ui/format";
import { Card, SectionTitle } from "@/components/panou/ui/primitives";
import { PageHead } from "@/components/panou/prospectare/page-head";
import { MailboxTable } from "@/components/panou/prospectare/email-casute";
import { EmailGrafic } from "@/components/panou/prospectare/email-grafic";
import { EmailPeZile } from "@/components/panou/prospectare/email-pe-zile";
import { EmailRaspunsuri } from "@/components/panou/prospectare/email-raspunsuri";
import { EmailTrimise, FiltruCasute } from "@/components/panou/prospectare/email-trimise";
import { EroareCitire } from "@/components/panou/prospectare/prezentare-eroare";
import { cate } from "@/components/panou/prospectare/prezentare-comun";
import { aziBucuresti, citesteCasute, citesteCasutePeZile, citesteEmailuriTrimise, citesteIstoricCasute, citesteRaspunsuri } from "@/lib/prospectare/citire";

export const metadata: Metadata = { title: "Email — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ZILE = 14;

/**
 * /admin/prospectare/email — căsuțele azi, ce a trimis fiecare căsuță în total și pe fiecare zi,
 * lista tuturor emailurilor trimise (filtrabilă pe căsuță), ultimele 14 zile și răspunsurile.
 */
export default async function EmailPage({ searchParams }: { searchParams: Promise<{ casuta?: string | string[] }> }) {
  const params = await searchParams;
  const { azi } = aziBucuresti();
  const acum = Date.now();
  const de = new Date(acum - ZILE * 24 * 60 * 60 * 1000).toISOString();
  const [casute, peZile, istoric, raspunsuri] = await Promise.all([citesteCasute(azi), citesteCasutePeZile(azi), citesteIstoricCasute(azi, ZILE), citesteRaspunsuri(de)]);

  // Filtrul acceptă doar o căsuță cunoscută; altfel arată toate emailurile.
  const ceruta = typeof params.casuta === "string" ? params.casuta.trim().toLowerCase() : undefined;
  const aleasa = peZile.ok && ceruta && peZile.data.casute.some((c) => c.adresa === ceruta) ? ceruta : undefined;
  const emailuri = await citesteEmailuriTrimise(aleasa);

  const nrCasute = casute.ok ? casute.data.length : 0;
  const pozitive = raspunsuri.ok ? raspunsuri.data.filter((r) => r.tip === "pozitiv").length : 0;

  return (
    <div className="space-y-4">
      <PageHead
        title="Email"
        pill="căsuțe separate"
        subtitle={`${nrCasute > 0 ? `${cate(nrCasute, "căsuță care se încălzește", "căsuțe care se încălzesc")} separat` : "Căsuțele se încălzesc separat"}. Un singur canal pe firmă: cine primește email nu mai intră în WhatsApp sau la apeluri, iar firmele contactate deja nu primesc email. Al doilea canal se permite doar din fișa firmei.`}
      />

      <Card>
        <SectionTitle
          title="Căsuțe de email azi"
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
        <SectionTitle
          title="Trimise pe fiecare căsuță"
          hint={peZile.ok ? `${cate(peZile.data.total, "email trimis", "emailuri trimise")} în total, de la primul până azi` : "Totalul și fiecare zi, pe căsuță"}
        />
        <div className="mt-3">
          {peZile.ok ? (
            <EmailPeZile zile={peZile.data.zile} casute={peZile.data.casute} total={peZile.data.total} azi={azi} casutaAleasa={aleasa} />
          ) : (
            <EroareCitire title="Trimiterile pe zile nu s-au putut citi" message={peZile.message} className="py-8" />
          )}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div id="trimise" className="scroll-mt-20 space-y-3 border-b border-border px-4 py-3">
            <SectionTitle
              title="Emailuri trimise"
              hint={emailuri.ok ? `${cate(emailuri.data.length, "mesaj", "mesaje")}${aleasa ? ` de pe ${aleasa}` : ", de pe toate căsuțele"} · cele mai noi primele` : undefined}
            />
            {peZile.ok && peZile.data.casute.length > 0 ? <FiltruCasute casute={peZile.data.casute} total={peZile.data.total} aleasa={aleasa} /> : null}
          </div>
          {emailuri.ok ? (
            <div className="max-h-[640px] overflow-y-auto" tabIndex={0} role="region" aria-label={aleasa ? `Emailuri trimise de pe ${aleasa}` : "Emailuri trimise"}>
              <EmailTrimise emailuri={emailuri.data} aleasa={aleasa} />
            </div>
          ) : (
            <EroareCitire title="Lista emailurilor nu s-a încărcat" message={emailuri.message} />
          )}
          {emailuri.ok && peZile.ok && !aleasa && emailuri.data.length !== peZile.data.total ? (
            <p className="border-t border-border px-4 py-2.5 text-[10.5px] text-muted-foreground">
              Lista are {cate(emailuri.data.length, "mesaj", "mesaje")}, contoarele căsuțelor {num(peZile.data.total)}: contoarele vin de la căsuțe, lista din activitatea firmelor.
            </p>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle title="Ultimele 14 zile" hint="Mesaje trimise și răspunsuri primite, pe toate căsuțele" />
            <div className="mt-3">{istoric.ok ? <EmailGrafic zile={istoric.data} /> : <EroareCitire title="Istoricul nu s-a putut citi" message={istoric.message} className="py-8" />}</div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3">
              <SectionTitle
                title="Răspunsuri"
                hint={raspunsuri.ok ? `${cate(raspunsuri.data.length, "răspuns primit", "răspunsuri primite")} în ultimele 14 zile${pozitive ? ` · ${cate(pozitive, "pozitiv", "pozitive")}` : ""}` : undefined}
              />
            </div>
            {raspunsuri.ok ? (
              <div className="max-h-[520px] overflow-y-auto" tabIndex={0} role="region" aria-label="Răspunsuri la email">
                <EmailRaspunsuri raspunsuri={raspunsuri.data} acum={acum} />
              </div>
            ) : (
              <EroareCitire title="Răspunsurile nu s-au putut citi" message={raspunsuri.message} />
            )}
            <p className="border-t border-border px-4 py-2.5 text-[10.5px] text-muted-foreground">
              Răspunsurile le raportează roboții din căsuțe. Un „NU” mută firma singur la „Nu contacta” și o oprește pe toate canalele. Ultima actualizare: {dateTimeRo(acum)}.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

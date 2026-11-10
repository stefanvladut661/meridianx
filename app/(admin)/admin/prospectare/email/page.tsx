import type { Metadata } from "next";
import Link from "next/link";
import { InlineNote } from "@/components/panou/ui/actions";
import { num, timeRo } from "@/components/panou/ui/format";
import { Card, SectionTitle } from "@/components/panou/ui/primitives";
import { PageHead } from "@/components/panou/prospectare/page-head";
import { MailboxTable } from "@/components/panou/prospectare/email-casute";
import { EmailGrafic } from "@/components/panou/prospectare/email-grafic";
import { EmailPeZile } from "@/components/panou/prospectare/email-pe-zile";
import { EmailProgramate, randuriProgramate } from "@/components/panou/prospectare/email-programate";
import { EmailRaspunsuri } from "@/components/panou/prospectare/email-raspunsuri";
import { EmailTrimise, FiltruCasute } from "@/components/panou/prospectare/email-trimise";
import { EroareCitire } from "@/components/panou/prospectare/prezentare-eroare";
import { cate } from "@/components/panou/prospectare/prezentare-comun";
import { ProgramariViitoare } from "@/components/panou/prospectare/programari-viitoare";
import { ProgrameazaButon } from "@/components/panou/prospectare/programeaza";
import { RestanteBanda } from "@/components/panou/prospectare/restante-banda";
import {
  asiguraCiclu,
  aziBucuresti,
  citesteCanale,
  citesteRestante,
  citesteCasute,
  citesteCasutePeZile,
  citesteEmailuriTrimise,
  citesteIstoricCasute,
  citesteOptiuniDistributie,
  citesteProgramari,
  citesteProgramariViitoare,
  citesteRaspunsuri,
  citesteSetari,
  maineBucuresti,
} from "@/lib/prospectare/citire";
import { requireAdmin } from "../../_components/require-admin";

export const metadata: Metadata = { title: "Email — MERIDIAN Prospectare", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ZILE = 14;

/**
 * /admin/prospectare/email — căsuțele azi, ce e programat azi și mâine pe fiecare căsuță (distribuția
 * de la 00:00), programările de mâine încolo, ce a trimis fiecare căsuță în total și pe fiecare zi,
 * lista tuturor emailurilor trimise (filtrabilă pe căsuță), ultimele 14 zile și răspunsurile.
 */
export default async function EmailPage({ searchParams }: { searchParams: Promise<{ casuta?: string | string[] }> }) {
  await requireAdmin();
  const params = await searchParams;
  const { azi } = aziBucuresti();
  const maine = maineBucuresti(azi);
  const acum = Date.now();
  const de = new Date(acum - ZILE * 24 * 60 * 60 * 1000).toISOString();
  // Ciclul de azi (00:00) înainte de programări: dacă cronul n-a rulat, îl pornește citirea asta.
  const ciclu = await asiguraCiclu();
  const [casute, peZile, istoric, raspunsuri, programari, viitoare, optiuni, setari, canale, restante] = await Promise.all([
    citesteCasute(azi),
    citesteCasutePeZile(azi),
    citesteIstoricCasute(azi, ZILE),
    citesteRaspunsuri(de),
    citesteProgramari("email", [azi, maine], ["programata", "folosita"]),
    citesteProgramariViitoare("email", maine),
    citesteOptiuniDistributie(),
    citesteSetari(),
    citesteCanale(),
    citesteRestante("email", azi),
  ]);
  const canalEmail = canale.ok ? canale.data.find((c) => c.canal === "email") : undefined;
  const suspendat = canalEmail ? !canalEmail.activ : false;

  // Filtrul acceptă doar o căsuță cunoscută; altfel arată toate emailurile.
  const ceruta = typeof params.casuta === "string" ? params.casuta.trim().toLowerCase() : undefined;
  const aleasa = peZile.ok && ceruta && peZile.data.casute.some((c) => c.adresa === ceruta) ? ceruta : undefined;
  const emailuri = await citesteEmailuriTrimise(aleasa);

  const pozitive = raspunsuri.ok ? raspunsuri.data.filter((r) => r.tip === "pozitiv").length : 0;
  const plafon = setari.ok ? setari.data.email_plafon_casuta : null;
  const programate = casute.ok && programari.ok ? randuriProgramate(casute.data, programari.data, azi, maine, plafon) : null;
  const t = programate?.total;
  const optiuniProgramare = optiuni.ok ? optiuni.data : null;

  return (
    <div className="space-y-4">
      <PageHead
        title="Email"
        actions={<ProgrameazaButon canal="email" azi={azi} optiuni={optiuniProgramare} suspendat={suspendat} />}
      />

      {suspendat ? (
        <InlineNote tone="rose" className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1">
            Emailul e suspendat{canalEmail?.motiv ? ` (${canalEmail.motiv})` : ""}: robotul primește o listă goală. Firmele programate așteaptă.
          </p>
          <Link href="/admin/prospectare/setari#canale" className="rounded-sm text-[13.5px] underline underline-offset-2">
            Setări
          </Link>
        </InlineNote>
      ) : null}

      {restante.ok ? <RestanteBanda key={restante.data.map((r) => r.id).join(",")} restante={restante.data} azi={azi} ce="pe email" /> : null}

      {!ciclu.ok ? (
        <InlineNote tone="rose">
          Lista zilei nu s-a verificat: {ciclu.message} Reîncarcă peste un minut.
        </InlineNote>
      ) : null}

      <Card>
        <SectionTitle
          title="Căsuțe de email azi"
          action={
            <Link href="/admin/prospectare/setari" className="rounded-sm text-[13px] text-muted-foreground hover:text-foreground">
              Plafoane →
            </Link>
          }
        />
        <div className="mt-3">{casute.ok ? <MailboxTable casute={casute.data} /> : <EroareCitire title="Căsuțele nu s-au putut citi" message={casute.message} className="py-8" />}</div>
      </Card>

      <Card>
        <SectionTitle
          title="Programate azi și mâine, pe căsuțe"
          info={
            <>
              Trimise = cerute azi de robot. Nimic nu se mai programează singur: firmele vin din Firme („Selectează” → „Distribuie”). Netrimisele rămân
              pe căsuța lor ca restanțe, până pleacă sau le scoți din coadă{plafon === null ? null : <>. Limita fără valoare proprie: plafonul de încălzire, {num(plafon)} pe zi</>}.
            </>
          }
          hint={
            t
              ? `azi ${num(t.azi)}${t.capacitate === null ? "" : ` din ${num(t.capacitate)}`} · ${num(t.trimise)} trimise · ${num(t.ramase)} rămase · mâine ${num(t.maine)}${ciclu.ok ? ` · rulat la ${timeRo(ciclu.data.rulat_la)}` : ""}`
              : undefined
          }
        />
        <div className="mt-3">
          {programate ? (
            <EmailProgramate randuri={programate.randuri} total={programate.total} />
          ) : !programari.ok ? (
            <EroareCitire title="Programările nu s-au putut citi" message={programari.message} className="py-8" />
          ) : (
            <EroareCitire title="Fără căsuțe, programările nu se pot împărți" message={casute.ok ? "" : casute.message} className="py-8" />
          )}
        </div>
        {!setari.ok ? <p className="mt-3 border-t border-border pt-3 text-[13.5px] text-muted-foreground">Plafonul de încălzire nu s-a citit: {setari.message}</p> : null}
      </Card>

      <Card>
        <SectionTitle
          title="Programate de mâine încolo"
          hint={viitoare.ok ? cate(viitoare.data.length, "programare", "programări") : undefined}
        />
        <div className="mt-3">
          {viitoare.ok ? (
            <ProgramariViitoare
              canal="email"
              programari={viitoare.data}
              gol="Nimic programat manual."
            />
          ) : (
            <EroareCitire title="Programările viitoare nu s-au putut citi" message={viitoare.message} className="py-8" />
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle
          title="Trimise pe fiecare căsuță"
          hint={peZile.ok ? `${cate(peZile.data.total, "email", "emailuri")} în total` : undefined}
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
              hint={emailuri.ok ? `${cate(emailuri.data.length, "mesaj", "mesaje")}${aleasa ? ` de pe ${aleasa}` : ""}` : undefined}
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
            <p className="border-t border-border px-4 py-2.5 text-[13px] text-muted-foreground">
              Lista: {num(emailuri.data.length)} · contoarele căsuțelor: {num(peZile.data.total)} (surse diferite)
            </p>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle title="Ultimele 14 zile" />
            <div className="mt-3">{istoric.ok ? <EmailGrafic zile={istoric.data} /> : <EroareCitire title="Istoricul nu s-a putut citi" message={istoric.message} className="py-8" />}</div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3">
              <SectionTitle
                title="Răspunsuri"
                info="Le raportează roboții din căsuțe. Un „NU” mută firma singur la „Nu contacta”."
                hint={raspunsuri.ok ? `${cate(raspunsuri.data.length, "răspuns", "răspunsuri")} în 14 zile${pozitive ? ` · ${cate(pozitive, "pozitiv", "pozitive")}` : ""}` : undefined}
              />
            </div>
            {raspunsuri.ok ? (
              <div className="max-h-[520px] overflow-y-auto" tabIndex={0} role="region" aria-label="Răspunsuri la email">
                <EmailRaspunsuri raspunsuri={raspunsuri.data} acum={acum} />
              </div>
            ) : (
              <EroareCitire title="Răspunsurile nu s-au putut citi" message={raspunsuri.message} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

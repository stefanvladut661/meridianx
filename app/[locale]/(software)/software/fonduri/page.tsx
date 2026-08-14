import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import {
  decontDocuments,
  eligibleItems,
  fundingDisclaimer,
  fundingFAQ,
  fundingLines,
  fundingTimelineWeeks,
} from "@/content/software/funding";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { SoftwareMotionStyles } from "@/components/software/motion-styles";
import { MeridianRail } from "@/components/software/meridian-rail";
import { SectionHead } from "@/components/software/section-head";
import { FundingTimeline } from "@/components/software/funding-timeline";
import { EligibilityCheck } from "@/components/software/eligibility-check";
import { CountUp } from "@/components/software/count-up";
import { CtaPanel } from "@/components/software/cta";

// i18n: metadata hardcodată RO — F7 localizează
export const metadata: Metadata = {
  title: "Software pentru firme cu fonduri de modernizare",
  description:
    "Furnizor de software pentru firme cu finanțare de digitalizare sau modernizare: ofertă defalcată pe capitole de cheltuieli, livrare pe etape cu procese-verbale și documentele necesare la decontare.",
};

/**
 * /software/fonduri (FAZA 4) — pagina cea mai importantă a diviziei.
 *
 * Publicul: firme cu buget alocat, termen de decontare și nevoie de
 * documentație corectă. Nu are nevoie să fie convins că digitalizarea e
 * bună — are nevoie de un furnizor care nu-i strică dosarul.
 *
 * Signature: CALENDARUL DE DECONTARE, citit invers, de la termenul lor.
 *
 * ⚠️ Tonul: consultant care a mai făcut asta, nu vânzător. Și, mai
 * important, ONESTITATE despre ce nu facem — nu scriem dosarul, nu
 * garantăm aprobarea. Toate afirmațiile care ating zona legislativă stau
 * în `content/software/funding.ts`, marcate `needsLegalReview`, și sunt
 * scrise generic: fără nume de program, fără sume, fără procente.
 *
 * TODO: verificat juridic — vezi PLAN.md, „De verificat înainte de lansare”.
 */

const RAIL_SECTIONS = [
  { id: "ce-nu-facem", label: "Ce nu facem" },
  { id: "linii", label: "Linii" },
  { id: "eligibil", label: "Eligibil" },
  { id: "calendar", label: "Calendar" },
  { id: "documente", label: "Documente" },
  { id: "incadrare", label: "Încadrare" },
  { id: "intrebari", label: "Întrebări" },
  { id: "contact", label: "Contact" },
];

export default async function SoftwareFundingPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SoftwareMotionStyles />
      <MeridianRail sections={RAIL_SECTIONS} />

      {/* ---------- HERO ---------- */}
      <Section spacing="md" className="border-b border-line">
        <Container>
          <SectionHead
            as="h1"
            // i18n:
            code="Finanțări · Digitalizare și modernizare"
            title="Ai bugetul aprobat. Îți trebuie un furnizor care nu-ți strică dosarul."
            lead="Dacă ai contract de finanțare pentru digitalizare sau modernizare, problema ta nu mai e prețul. E termenul de decontare, forma documentelor și un furnizor care înțelege că o factură scrisă greșit poate bloca o cerere de plată."
          />

          {/* citirea-cheie: câte săptămâni îți trebuie, cu totul */}
          <Reveal duration={320} className="mt-10">
            <div className="grid gap-6 rounded-lg border border-line bg-surface p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10 sm:p-8">
              <p className="font-mono text-5xl font-medium leading-none tabular-nums text-accent-2 sm:text-6xl">
                <CountUp to={fundingTimelineWeeks} />
                <span className="ml-2 text-base uppercase tracking-[0.16em] text-muted">
                  {/* i18n: */}
                  săptămâni
                </span>
              </p>
              <p className="max-w-xl text-pretty leading-relaxed text-fg/75">
                {/* i18n: */}
                Atât durează, pentru un proiect mediu de aplicație la comandă,
                de la semnarea contractului cu noi până la dosarul complet de
                decontare. Scade numărul ăsta din termenul tău și afli până
                când trebuie să ne dăm mâna.
              </p>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ---------- CE NU FACEM ---------- */}
      <Section id="ce-nu-facem" spacing="md">
        <Container>
          <Reveal duration={320}>
            <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent-2">
                  {/* i18n: */}
                  Limitele rolului nostru
                </p>
                <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  {fundingDisclaimer.title}
                </h2>
              </div>
              <div className="border-l-2 border-accent pl-6">
                <p className="text-pretty text-lg leading-relaxed text-fg">
                  {fundingDisclaimer.body}
                </p>
                <p className="mt-4 text-pretty leading-relaxed text-fg/70">
                  {fundingDisclaimer.followUp}
                </p>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* ---------- LINII DE FINANȚARE ---------- */}
      <Section id="linii" spacing="md" className="border-t border-line">
        <Container>
          <SectionHead
            // i18n:
            code="Cadrul de finanțare"
            title="Categoriile în care apare de obicei software-ul."
            lead="Scriem categorii, nu nume de programe. Sesiunile, plafoanele și criteriile se schimbă de la an la an, iar un site care le enumeră ajunge să mintă la șase luni după lansare. Detaliile liniei tale le știe consultantul tău sau ghidul solicitantului."
          />

          <dl className="mt-12 grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {fundingLines.map((line, index) => (
              <div key={line.id} className="border-t border-line pt-5">
                <Reveal duration={300} delay={Math.min(index, 3) * 60}>
                  <dt className="font-display text-lg font-semibold tracking-tight">
                    {line.label}
                  </dt>
                  <dd className="mt-3 text-sm leading-relaxed text-fg/70">
                    {line.description}
                  </dd>
                </Reveal>
              </div>
            ))}
          </dl>

          <p className="mt-10 max-w-3xl border-l-2 border-line pl-5 text-sm leading-relaxed text-muted">
            {/* i18n: */}
            Nu confirmăm eligibilitatea proiectului tău și nu interpretăm
            ghidul solicitantului — nu e rolul și nu e răspunderea noastră.
            Verificarea finală o face finanțatorul, pe baza documentelor tale.
          </p>
        </Container>
      </Section>

      {/* ---------- CHELTUIELI ELIGIBILE ---------- */}
      <Section id="eligibil" spacing="md" className="border-t border-line">
        <Container>
          <SectionHead
            // i18n:
            code="Încadrarea livrabilelor"
            title="Ce livrăm și în ce capitol de cheltuieli intră de obicei."
            lead="„De obicei” e cuvântul important. Structurăm oferta pe capitolele din bugetul tău, cu denumirile pe care le folosește dosarul — dar încadrarea finală o confirmă finanțatorul, nu noi."
          />

          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {eligibleItems.map((item, index) => (
              <div key={item.id} className="bg-bg p-6 sm:p-8">
                <Reveal duration={300} delay={Math.min(index, 3) * 60}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                    {/* i18n: */}
                    Capitol
                  </p>
                  <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
                    {item.chapter}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {item.items.map((entry) => (
                      <li
                        key={entry}
                        className="grid grid-cols-[1.25rem_1fr] items-baseline text-sm leading-relaxed text-fg/75"
                      >
                        <span aria-hidden="true" className="font-mono text-accent-2">
                          ▸
                        </span>
                        {entry}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------- CALENDARUL DE DECONTARE (signature) ---------- */}
      <Section id="calendar" spacing="md" className="border-t border-line">
        <Container size="wide">
          <SectionHead
            // i18n:
            code="Calendarul de decontare"
            title="Citește-l de la dreapta la stânga."
            lead="Marginea din dreapta e termenul tău, nu lansarea noastră. Scara arată câte săptămâni înainte de el trebuie semnat contractul — și care dintre etape depind de noi, care de tine sau de consultantul tău."
          />

          <div className="mt-12">
            <FundingTimeline />
          </div>

          <p className="mt-8 max-w-3xl border-l-2 border-line pl-5 text-sm leading-relaxed text-muted">
            {/* i18n: */}
            Duratele din banda noastră sunt angajamente și intră în contract.
            Cele din banda ta depind de finanțator — pune acolo numerele reale
            din calendarul tău, sunt singurele care contează. Un proiect mai
            mic se comprimă; unul cu integrări multiple se lungește. Îți spunem
            care e cazul la ofertă, nu pe parcurs.
          </p>
        </Container>
      </Section>

      {/* ---------- DOCUMENTE ---------- */}
      <Section id="documente" spacing="md" className="border-t border-line">
        <Container>
          <SectionHead
            // i18n:
            code="Dosarul de decontare"
            title="Documentele pe care le primești de la noi."
            lead="Astea nu sunt afirmații despre legislație, sunt obligațiile noastre contractuale. Le emitem indiferent de programul pe care ești, iar dacă finanțatorul cere alt format, îl completăm pe al lui."
          />

          <ol className="mt-12 border-t border-line">
            {decontDocuments.map((doc, index) => (
              <li key={doc.id}>
                <Reveal duration={280} delay={Math.min(index, 5) * 45}>
                  <div className="grid gap-x-8 gap-y-2 border-b border-line py-5 lg:grid-cols-[3rem_18rem_1fr_11rem]">
                    <p className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="text-balance font-display text-base font-semibold tracking-tight">
                      {doc.label}
                    </h3>
                    <p className="text-sm leading-relaxed text-fg/70">
                      {doc.description}
                    </p>
                    <p className="font-mono text-[10px] uppercase leading-snug tracking-[0.14em] text-accent-2 lg:text-right">
                      {doc.when}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ---------- TEST DE ÎNCADRARE ---------- */}
      <Section id="incadrare" spacing="md" className="border-t border-line">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
            <SectionHead
              // i18n:
              code="Calificare"
              title="Verifică în treizeci de secunde dacă are rost să vorbim."
              lead="Testul poate să-ți spună și „încă nu”. Preferăm asta unei discuții de o oră după care descoperim că nu ai încă linia de finanțare."
            />
            <Reveal duration={320}>
              <EligibilityCheck />
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* ---------- ÎNTREBĂRI ---------- */}
      <Section id="intrebari" spacing="md" className="border-t border-line">
        <Container>
          <SectionHead
            // i18n:
            code="Întrebări despre decontare"
            title="Ce ne întreabă firmele cu finanțare."
          />

          <div className="mt-10 border-t border-line">
            {fundingFAQ.map((item, index) => (
              <details key={item.id} className="group border-b border-line py-5">
                <summary className="flex cursor-pointer list-none items-baseline gap-4 [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-pretty font-display text-lg font-semibold tracking-tight">
                    {item.question}
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-accent transition-transform duration-150 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl text-pretty pl-[calc(1.5rem+11px)] leading-relaxed text-fg/75">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </Container>
      </Section>

      <CtaPanel
        id="contact"
        // i18n:
        code="Pasul următor"
        title="Spune-ne linia de finanțare și termenul. Restul îl calculăm noi."
        lead="Completează brief-ul și menționează la ce program ești și până când trebuie decontat. Îți răspundem cu o ofertă defalcată pe capitole de cheltuieli, în forma pe care o poate atașa consultantul tău la dosar."
        primary={{ label: "Completează brief-ul", href: "/software/brief" }}
        secondary={{ label: "Vezi ce construim", href: "/software/servicii" }}
        aside="Răspundem în maximum o zi lucrătoare. Dacă termenul tău e mai scurt decât calendarul de mai sus, spune-ne — restrângem obiectul sau te anunțăm sincer că nu prindem."
      />
    </>
  );
}

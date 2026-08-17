import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { softwareProcess } from "@/content/software/process";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { SoftwareMotionStyles } from "@/components/software/motion-styles";
import { MeridianRail } from "@/components/software/meridian-rail";
import { SectionHead } from "@/components/software/section-head";
import { ResponsibilityChart } from "@/components/software/responsibility-chart";
import { CtaPanel } from "@/components/software/cta";

// i18n: metadata hardcodată RO — F7 localizează
export const metadata: Metadata = {
  title: "Cum lucrăm — procesul",
  description:
    "Descoperire, propunere, design, dezvoltare, lansare, mentenanță. Fiecare etapă cu ce facem noi, ce ți se cere ție și cât durează.",
};

/**
 * /software/proces (FAZA 4).
 *
 * Signature: graficul de responsabilitate — două benzi, o linie care țese
 * între ele, un nod la fiecare predare.
 *
 * Numerotarea 01–06 e legitimă aici: e o secvență reală (CLAUDE.md §3).
 * Diferit de rail-ul de peliculă din /video/proces (F2): acolo secvența e
 * o bandă de film, aici e o diagramă de responsabilitate.
 */

const RAIL_SECTIONS = [
  { id: "predari", label: "Predări" },
  { id: "etape", label: "Etape" },
  { id: "intarzieri", label: "Întârzieri" },
  { id: "start", label: "Start" },
];

/** Cauzele reale de întârziere, spuse înainte să se întâmple. */
const DELAY_CAUSES = [
  {
    cause: "Aprobarea stă la o persoană care nu e disponibilă",
    fix: "Stabilim la start cine aprobă și cine îl înlocuiește când e plecat. Termenul de răspuns e în contract, în ambele sensuri.",
  },
  {
    cause: "Datele reale vin târziu sau vin dezordonate",
    fix: "Îți spunem la descoperire ce date ne trebuie și în ce format. Dacă e nevoie, le curățăm noi — dar atunci e o linie separată în ofertă, nu o surpriză.",
  },
  {
    cause: "Cerințe noi apărute la jumătatea dezvoltării",
    fix: "Le primim cu plăcere, dar intră în etapa următoare, cu estimare separată. Nu împingem termenul curent ca să încapă ceva ce nu era în specificație.",
  },
  {
    cause: "Accesele la sistemele existente întârzie",
    fix: "Lista de accese o primești în prima săptămână, cu termen. Fără ele, integrările nu pot nici măcar fi evaluate corect.",
  },
];

export default async function SoftwareProcessPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SoftwareMotionStyles />
      <MeridianRail sections={RAIL_SECTIONS} />

      <Section spacing="md" className="border-b border-line">
        <Container>
          <SectionHead
            as="h1"
            // i18n:
            code="Proces"
            title="Șase etape, și la fiecare știi ce ți se cere."
            lead="Majoritatea paginilor de proces descriu ce face agenția. Partea utilă e cealaltă: ce trebuie să faci tu, când, și cât timp îți ia. Am scris-o la fiecare etapă, ca să știi înainte de semnare dacă ai omul disponibil."
          />
        </Container>
      </Section>

      {/* ---------- GRAFICUL DE RESPONSABILITATE (signature) ---------- */}
      <Section id="predari" spacing="md">
        <Container size="wide">
          <SectionHead
            // i18n:
            code="Predările"
            title="Un proiect e un șir de predări, nu o linie dreaptă."
          />
          <div className="mt-10">
            <ResponsibilityChart />
          </div>
        </Container>
      </Section>

      {/* ---------- ETAPELE ---------- */}
      <div id="etape">
        {softwareProcess.map((step) => (
          <Section
            key={step.id}
            id={step.id}
            spacing="md"
            className="scroll-mt-24 border-t border-line"
          >
            <Container>
              <div className="grid gap-10 lg:grid-cols-[1fr_1.35fr] lg:gap-16">
                <Reveal duration={320}>
                  <p className="font-mono text-[11px] tabular-nums tracking-[0.2em] text-accent">
                    {/* i18n: */}
                    Etapa {String(step.order).padStart(2, "0")} din{" "}
                    {String(softwareProcess.length).padStart(2, "0")}
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    {step.title}
                  </h2>
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-accent-2">
                    {step.duration}
                  </p>
                  <p className="mt-5 text-pretty leading-relaxed text-fg/75">
                    {step.description}
                  </p>
                </Reveal>

                <Reveal duration={320} delay={80}>
                  <div className="grid gap-8 sm:grid-cols-2">
                    <div className="border-t-2 border-accent pt-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                        {/* i18n: */}
                        Ce facem noi
                      </p>
                      <ul className="mt-4 space-y-3">
                        {step.weDo.map((item) => (
                          <li
                            key={item}
                            className="grid grid-cols-[1.25rem_1fr] items-baseline text-sm leading-relaxed text-fg/80"
                          >
                            <span
                              aria-hidden="true"
                              className="font-mono text-accent"
                            >
                              ▸
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border-t-2 border-accent-2 pt-4">
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-2">
                        {/* i18n: */}
                        Ce îți cerem ție
                      </p>
                      <ul className="mt-4 space-y-3">
                        {step.youDo.map((item) => (
                          <li
                            key={item}
                            className="grid grid-cols-[1.25rem_1fr] items-baseline text-sm leading-relaxed text-fg/80"
                          >
                            <span
                              aria-hidden="true"
                              className="font-mono text-accent-2"
                            >
                              ▸
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Reveal>
              </div>
            </Container>
          </Section>
        ))}
      </div>

      {/* ---------- DE CE ÎNTÂRZIE PROIECTELE ---------- */}
      <Section id="intarzieri" spacing="md" className="border-t border-line">
        <Container>
          <SectionHead
            // i18n:
            code="Riscuri de calendar"
            title="Patru motive pentru care întârzie proiectele. Niciunul nu e tehnic."
            lead="Le spunem înainte, nu după. Dacă recunoști vreunul din firma ta, hai să-l rezolvăm la descoperire, când mai costă zero."
          />

          <dl className="mt-12 border-t border-line">
            {DELAY_CAUSES.map((item, index) => (
              <div
                key={item.cause}
                className="grid gap-x-10 gap-y-2 border-b border-line py-6 lg:grid-cols-[3rem_1fr_1.3fr]"
              >
                <Reveal duration={280} delay={Math.min(index, 3) * 55}>
                  <p className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-muted">
                    R{String(index + 1).padStart(2, "0")}
                  </p>
                </Reveal>
                <Reveal duration={280} delay={Math.min(index, 3) * 55}>
                  <dt className="text-balance font-display text-lg font-semibold tracking-tight">
                    {item.cause}
                  </dt>
                </Reveal>
                <Reveal duration={280} delay={Math.min(index, 3) * 55}>
                  <dd className="text-sm leading-relaxed text-fg/70">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                      {/* i18n: */}
                      Cum îl prevenim:{" "}
                    </span>
                    {item.fix}
                  </dd>
                </Reveal>
              </div>
            ))}
          </dl>
        </Container>
      </Section>

      <CtaPanel
        id="start"
        // i18n:
        code="Etapa 01"
        title="Descoperirea e gratuită și nu te obligă la nimic."
        lead="Un call de o oră în care ne spui cum lucrezi acum. Ieși de acolo cu lista problemelor ordonate după cât te costă — indiferent dacă lucrăm împreună sau nu."
        primary={{ label: "Completează brief-ul", href: "/software/brief" }}
        secondary={{ label: "Vezi serviciile", href: "/software/servicii" }}
        aside="Descoperirea o facem la tine, pe teren, dacă e vorba de un flux de producție. Un apel video nu îți arată unde se blochează munca."
      />
    </>
  );
}

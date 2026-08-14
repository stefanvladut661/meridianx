import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { softwareServices } from "@/content/software/services";
import { softwareFAQ } from "@/content/software/faq";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { SoftwareMotionStyles } from "@/components/software/motion-styles";
import { MeridianRail } from "@/components/software/meridian-rail";
import { SectionHead } from "@/components/software/section-head";
import { CtaPanel } from "@/components/software/cta";

// i18n: metadata hardcodată RO — F7 localizează
export const metadata: Metadata = {
  title: "Servicii software",
  description:
    "Aplicații web și mobile la comandă, magazine online, site-uri de prezentare, landing pages, automatizări și AI, mentenanță și SEO tehnic. Pentru cine e, ce include, ce tehnologii, cât durează.",
};

/**
 * /software/servicii (FAZA 4).
 *
 * Signature: INDEXUL. Pagina se deschide cu un tabel de intrare — opt
 * rânduri, fiecare cu durata și publicul — din care sari direct la fișa
 * care te privește. Un instrument începe cu scala, nu cu o poveste.
 *
 * Fișele au altă geometrie decât „fișele de producție” video (F2): acolo
 * narativ + panou de livrabile; aici o declarație lată și dedesubt o grilă
 * de specificație pe trei axe. Aceeași funcție, dialect diferit
 * (CLAUDE.md §2).
 *
 * Fără prețuri, conform brief-ului.
 */

const RAIL_SECTIONS = [
  { id: "index", label: "Index" },
  { id: "fise", label: "Fișe" },
  { id: "faq", label: "Întrebări" },
  { id: "oferta", label: "Ofertă" },
];

/** Cod de index per serviciu, stabil și derivat din poziție. */
function serviceCode(index: number) {
  return `S${String(index + 1).padStart(2, "0")}`;
}

export default async function SoftwareServicesPage({
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
            code="Servicii"
            title="Ce facem, pentru cine, în cât timp."
            lead="Fiecare serviciu de mai jos are aceeași fișă: cui i se potrivește, ce include concret, pe ce tehnologii îl construim și cât durează orientativ. Prețul îl afli la ofertă, după ce știm obiectul — o listă de prețuri pe site ar fi o cifră inventată pentru un proiect pe care nu-l cunoaștem."
          />
        </Container>
      </Section>

      {/* ---------- INDEX ---------- */}
      <Section id="index" spacing="sm">
        <Container>
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent-2">
              {/* i18n: */}
              Index de servicii
            </p>
            <p className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-muted">
              {String(softwareServices.length).padStart(2, "0")}
              {/* i18n: */}
              &nbsp;intrări
            </p>
          </div>

          <ol>
            {softwareServices.map((service, index) => (
              <li key={service.id} className="border-b border-line">
                <a
                  href={`#${service.id}`}
                  className="group grid items-baseline gap-x-6 gap-y-1 py-4 sm:grid-cols-[3.5rem_1fr_9rem] lg:grid-cols-[3.5rem_18rem_1fr_11rem]"
                >
                  <span className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-muted transition-colors duration-150 group-hover:text-accent">
                    {serviceCode(index)}
                  </span>
                  <span className="font-display text-base font-semibold tracking-tight transition-colors duration-150 group-hover:text-accent sm:text-lg">
                    {service.title}
                  </span>
                  <span className="hidden text-sm leading-snug text-fg/60 lg:block">
                    {service.audience}
                  </span>
                  <span className="font-mono text-[10px] uppercase leading-snug tracking-[0.14em] text-muted sm:text-right">
                    {service.duration}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ---------- FIȘELE ---------- */}
      <div id="fise">
        {softwareServices.map((service, index) => (
          <Section
            key={service.id}
            id={service.id}
            spacing="md"
            className="scroll-mt-24 border-t border-line"
          >
            <Container>
              <Reveal duration={320}>
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                  <p className="font-mono text-[11px] tabular-nums tracking-[0.2em] text-accent">
                    {serviceCode(index)}
                  </p>
                  <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                    {service.title}
                  </h2>
                </div>

                <p className="mt-6 max-w-4xl text-balance font-display text-xl leading-snug text-fg sm:text-2xl">
                  {service.promise}
                </p>
                <p className="mt-5 max-w-3xl text-pretty leading-relaxed text-fg/75">
                  {service.description}
                </p>
              </Reveal>

              {/* grila de specificație — trei axe, hairline, fără chenare */}
              <div className="mt-10 grid gap-x-10 gap-y-8 border-t border-line pt-8 lg:grid-cols-[1fr_1.4fr_1fr]">
                <Reveal duration={300}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-2">
                    {/* i18n: */}
                    Pentru cine
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-fg/80">
                    {service.audience}
                  </p>
                  <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-2">
                    {/* i18n: */}
                    Durată orientativă
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-fg/80">
                    {service.duration}
                  </p>
                </Reveal>

                <Reveal duration={300} delay={70}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-2">
                    {/* i18n: */}
                    Ce primești la final
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {service.deliverables.map((item) => (
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
                </Reveal>

                <Reveal duration={300} delay={140}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-2">
                    {/* i18n: */}
                    Tehnologii
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {(service.stack ?? []).map((tech) => (
                      <li
                        key={tech}
                        className="rounded-xs border border-line px-2 py-1 font-mono text-[10px] tracking-wide text-fg/70"
                      >
                        {tech}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#index"
                    className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted hover:text-fg"
                  >
                    <span aria-hidden="true">↑</span>
                    {/* i18n: */}
                    Înapoi la index
                  </a>
                </Reveal>
              </div>
            </Container>
          </Section>
        ))}
      </div>

      {/* ---------- FAQ ---------- */}
      <Section id="faq" spacing="md" className="border-t border-line">
        <Container>
          <SectionHead
            // i18n:
            code="Înainte să semnezi"
            title="Întrebările care se pun oricum la primul call."
            lead="Le răspundem aici ca să nu pierzi o oră pe telefon aflând lucruri pe care le puteai citi."
          />

          <div className="mt-10 border-t border-line">
            {softwareFAQ.map((item, index) => (
              <details
                key={item.id}
                className="group border-b border-line py-5"
              >
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
        id="oferta"
        // i18n:
        code="Pasul următor"
        title="Nu ești sigur care serviciu ți se potrivește?"
        lead="Atunci descrie problema, nu serviciul. La descoperire îți spunem ce îți trebuie — inclusiv dacă răspunsul e „un produs gata făcut, nu noi”."
        primary={{ label: "Completează brief-ul", href: "/software/brief" }}
        secondary={{ label: "Vezi procesul", href: "/software/proces" }}
        aside="Descoperirea inițială e gratuită. Dacă ai finanțare, spune-ne de la început — calendarul se schimbă."
      />
    </>
  );
}

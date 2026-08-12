import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { videoServices } from "@/content/video/services";
import { videoFAQ } from "@/content/video/faq";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { VideoMotionStyles } from "@/components/video/motion-styles";
import { VideoLenis } from "@/components/video/lenis-provider";
import { WordReveal } from "@/components/video/word-reveal";
import { SectionSlate } from "@/components/video/section-slate";
import { CtaBand } from "@/components/video/cta-band";

// i18n: metadata hardcodată RO — F7 localizează
export const metadata: Metadata = {
  title: "Servicii video",
  description:
    "Filmare comercială, editare și post-producție, conținut UGC pentru social și filmări cu dronă. Fiecare serviciu cu livrabile concrete: formate, durate, drepturi de utilizare.",
};

/**
 * /video/servicii (FAZA 2).
 * Signature: „fișa de producție” — fiecare serviciu e un spec sheet cu
 * livrabilele negru pe alb (formate, durate, drepturi), în mono.
 * Vinde ce obține clientul, nu echipamentul.
 */
export default async function VideoServicesPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <VideoMotionStyles />
      <VideoLenis />

      <Section spacing="sm" className="pt-28 sm:pt-36">
        <Container>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
            {/* i18n: */}
            SERVICII · FIȘE DE PRODUCȚIE
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-5xl tracking-tight sm:text-7xl">
            {/* i18n: */}
            <WordReveal text="Ce primești, negru pe alb." />
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-fg/70">
            {/* i18n: */}
            Patru servicii, fiecare cu fișa lui: ce obții, în cât timp și cu ce
            drepturi de utilizare. Ca să știi exact ce cumperi înainte să dai
            mâna — nu după.
          </p>
        </Container>
      </Section>

      {videoServices.map((service, index) => (
        <Section key={service.id} id={service.id}>
          <Container>
            <div className="grid gap-10 border-t border-line pt-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
              <Reveal>
                <p className="font-mono text-xs tracking-[0.25em] text-muted">
                  SRV.{String(index + 1).padStart(2, "0")}
                  {service.duration
                    ? ` · ${service.duration.toUpperCase()}`
                    : null}
                </p>
                <h2 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">
                  {service.title}
                </h2>
                <p className="mt-4 text-pretty text-xl font-medium text-fg">
                  {service.promise}
                </p>
                <p className="mt-4 text-pretty text-fg/70">
                  {service.description}
                </p>
                {service.audience ? (
                  <p className="mt-5 text-sm text-fg/60">
                    <span className="font-mono text-xs tracking-[0.25em] text-accent-2">
                      {/* i18n: */}
                      PENTRU:{" "}
                    </span>
                    {service.audience}
                  </p>
                ) : null}
                {service.stack && service.stack.length > 0 ? (
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {service.stack.map((item) => (
                      <li
                        key={item}
                        className="rounded-xs border border-line px-2.5 py-1 font-mono text-[11px] tracking-wider text-muted"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Reveal>
              <Reveal delay={120}>
                <div className="overflow-hidden rounded-md border border-line bg-surface/50">
                  <p className="border-b border-line px-5 py-3 font-mono text-xs tracking-[0.3em] text-accent-2">
                    {/* i18n: */}
                    LIVRABILE
                  </p>
                  <ul className="divide-y divide-line">
                    {service.deliverables.map((deliverable) => (
                      <li
                        key={deliverable}
                        className="flex gap-3 px-5 py-3.5 text-sm text-fg/80"
                      >
                        <span aria-hidden="true" className="text-accent">
                          —
                        </span>
                        {deliverable}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </Container>
        </Section>
      ))}

      <Section id="faq">
        <Container size="narrow">
          <Reveal>
            <SectionSlate
              // i18n:
              code="FAQ · ÎNAINTE SĂ SEMNEZI"
              title="Întrebările care se pun oricum la primul call"
            />
          </Reveal>
          <Reveal delay={100} className="mt-10">
            <div className="divide-y divide-line border-y border-line">
              {videoFAQ.map((item) => (
                <details key={item.id} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl tracking-tight [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <span
                      aria-hidden="true"
                      className="font-mono text-muted transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-pretty text-fg/70">{item.answer}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </Container>
      </Section>

      <CtaBand
        // i18n:
        slate="NU GĂSEȘTI SERVICIUL?"
        title="Descrie problema. Serviciul îl alegem noi."
        lead="Jumătate din proiectele bune încep cu „nu știu exact ce-mi trebuie”. E un început perfect valid."
        cta={{ label: "Cere ofertă", href: "/video/contact" }}
        secondary={{ label: "sau vezi cum lucrăm", href: "/video/proces" }}
      />
    </>
  );
}

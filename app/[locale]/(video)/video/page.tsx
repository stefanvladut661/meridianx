import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pageSeo } from "@/lib/seo";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { VideoMotionStyles } from "@/components/video/motion-styles";
import { ShutterIntro } from "@/components/video/shutter-intro";
import { VideoLenis } from "@/components/video/lenis-provider";
import { FocusCursor } from "@/components/video/focus-cursor";
import { VideoHero } from "@/components/video/video-hero";
import { SectionSlate } from "@/components/video/section-slate";
import { SegmentScenes } from "@/components/video/segment-scenes";
import { Showreel } from "@/components/video/showreel";
import { TestimonialStrip } from "@/components/video/testimonial-strip";
import { CtaBand } from "@/components/video/cta-band";

// i18n: metadata hardcodată RO — F7 localizează
const TITLE = "Producție video comercială";
const DESCRIPTION =
  "MERIDIAN VIDEO: filmare comercială, editare, UGC și dronă pentru imobiliare, corporate, evenimente, personal brand și industrie. Filmul care vinde — plus campaniile care îl difuzează.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: TITLE,
    description: DESCRIPTION,
    ...pageSeo({
      route: "/video",
      locale: locale as Locale,
      division: "video",
      title: TITLE,
      description: DESCRIPTION,
      ogTitle: "Filmul care vinde. Campania care îl duce acolo.",
    }),
  };
}

/**
 * /video — home-ul diviziei (FAZA 2).
 * Signature: „Balansul de alb” — hero interactiv tungsten↔daylight.
 * Fără <main> propriu: shell-ul F1 îl pune în layout-ul de grup.
 */
export default async function VideoHomePage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <VideoMotionStyles />
      <ShutterIntro />
      <VideoLenis />
      <FocusCursor />

      <VideoHero />

      <Section id="segmente">
        <Container>
          <Reveal>
            <SectionSlate
              // i18n: (tot copy-ul de mai jos)
              code="SC.01–05 · PENTRU CINE FILMĂM"
              title="Cinci clienți. Cinci feluri de a cumpăra. Cinci feluri de a filma."
              lead="Nu există „video de prezentare” universal. Există filmul care vinde un apartament și filmul care convinge un candidat — și nu seamănă deloc."
            />
          </Reveal>
          <div className="mt-12">
            <SegmentScenes />
          </div>
        </Container>
      </Section>

      <Section id="showreel">
        <Container size="wide">
          <Reveal>
            <SectionSlate
              // i18n:
              code="SHOWREEL · 90 SEC"
              title="Dovada, în 90 de secunde."
              lead="Dacă după showreel mai ai nevoie de argumente, îți dăm și argumente. De obicei nu mai e nevoie."
            />
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <Showreel />
          </Reveal>
          <Reveal delay={180} className="mt-6">
            <div className="flex justify-end">
              <Link
                href="/video/portofoliu"
                className="font-mono text-sm tracking-wider text-fg/70 underline-offset-4 transition-colors hover:text-fg hover:underline"
              >
                {/* i18n: */}
                Vezi tot portofoliul →
              </Link>
            </div>
          </Reveal>
        </Container>
      </Section>

      <Section id="dovezi">
        <Container>
          <Reveal>
            <SectionSlate
              // i18n:
              code="VOCI · ÎN CURÂND REALE"
              title="Ce spun clienții"
              lead="Nu publicăm laude scrise de noi. Aici apar testimoniale reale, cu acord scris — până atunci, locurile sunt marcate cinstit."
            />
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <TestimonialStrip />
          </Reveal>
        </Container>
      </Section>

      {/* Puntea spre managementul de campanii (pagina F3) */}
      <Section id="difuzare" spacing="lg">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-fg/60">
                {/* i18n: */}
                PRODUCȚIE + DIFUZARE
              </p>
              <h2 className="mt-5 text-balance font-display text-4xl tracking-tight sm:text-5xl">
                {/* i18n: */}
                Filmul fără difuzare e un screensaver scump.
              </h2>
              <p className="mt-5 max-w-xl text-pretty text-lg text-fg/70">
                {/* i18n: */}
                Producem creativul și tot noi îl rulăm. O singură echipă, un
                singur responsabil pentru rezultat — nu o agenție care filmează
                și alta care dă vina pe material.
              </p>
              <div className="mt-8">
                <Link
                  href="/video/reclame"
                  className={buttonClasses({ variant: "secondary", size: "lg" })}
                >
                  {/* i18n: */}
                  Vezi managementul de campanii
                </Link>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <ul className="space-y-3 font-mono text-sm tracking-[0.15em] text-fg/75">
                <li className="flex items-baseline justify-between border-b border-line pb-3">
                  <span>META ADS</span>
                  <span className="text-v-tungsten">CREATIV + MEDIA</span>
                </li>
                <li className="flex items-baseline justify-between border-b border-line pb-3">
                  <span>GOOGLE / YOUTUBE</span>
                  <span className="text-v-tungsten">CREATIV + MEDIA</span>
                </li>
                <li className="flex items-baseline justify-between border-b border-line pb-3">
                  <span>TIKTOK</span>
                  <span className="text-v-daylight">UGC NATIV</span>
                </li>
                <li className="flex items-baseline justify-between border-b border-line pb-3">
                  <span>LINKEDIN</span>
                  <span className="text-v-daylight">B2B / EMPLOYER</span>
                </li>
              </ul>
            </Reveal>
          </div>
        </Container>
      </Section>

      <CtaBand
        // i18n:
        slate="CADRUL URMĂTOR"
        title="Camera e pregătită. Spune-ne ce vinzi."
        lead="Ne spui ce vinzi și cui. Îți spunem cum arată pe cameră, cât durează și cât costă — fix, nu „de la”."
        cta={{ label: "Cere ofertă", href: "/video/contact" }}
        secondary={{ label: "sau vezi întâi procesul", href: "/video/proces" }}
      />
    </>
  );
}

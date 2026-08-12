import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { videoProcess } from "@/content/video/process";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { VideoMotionStyles } from "@/components/video/motion-styles";
import { VideoLenis } from "@/components/video/lenis-provider";
import { WordReveal } from "@/components/video/word-reveal";
import { ProcessRail } from "@/components/video/process-rail";
import { CtaBand } from "@/components/video/cta-band";

// i18n: metadata hardcodată RO — F7 localizează
export const metadata: Metadata = {
  title: "Procesul de producție",
  description:
    "De la brief la livrare în cinci etape cu marcaje clare: ce facem noi, ce aduci tu, cât durează. Fără improvizație în ziua filmării.",
};

/**
 * /video/proces (FAZA 2).
 * Signature: rail de peliculă cu marcaje de timecode — aici numerotarea
 * e legitimă (secvență reală) și arată a bandă, nu a template.
 */
export default async function VideoProcessPage({
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
            PROCES · TC 01:00 → 05:00
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-5xl tracking-tight sm:text-7xl">
            {/* i18n: */}
            <WordReveal text="De la brief la livrare, fără improvizație." />
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-fg/70">
            {/* i18n: */}
            Cinci etape, fiecare cu marcajul ei pe bandă. Știi mereu unde e
            proiectul tău și ce avem nevoie de la tine ca să meargă mai
            departe — de obicei, foarte puțin.
          </p>
        </Container>
      </Section>

      <Section spacing="lg">
        <Container>
          <ProcessRail steps={videoProcess} />
        </Container>
      </Section>

      <CtaBand
        // i18n:
        slate="TC 00:00:00:00"
        title="Pornim numărătoarea?"
        lead="Primul pas durează 30 de minute la telefon și nu te costă nimic. Al doilea vine cu preț fix."
        cta={{ label: "Cere ofertă", href: "/video/contact" }}
        secondary={{ label: "sau vezi întâi portofoliul", href: "/video/portofoliu" }}
      />
    </>
  );
}

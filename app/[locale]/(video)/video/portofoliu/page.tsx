import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { pageSeo } from "@/lib/seo";
import type { VideoSegment } from "@/content/types";
import { videoProjects } from "@/content/video/projects";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { VideoMotionStyles } from "@/components/video/motion-styles";
import { VideoLenis } from "@/components/video/lenis-provider";
import { FocusCursor } from "@/components/video/focus-cursor";
import { WordReveal } from "@/components/video/word-reveal";
import { PortfolioReel } from "@/components/video/portfolio-reel";
import { VIDEO_SEGMENTS } from "@/components/video/segments";
import { CtaBand } from "@/components/video/cta-band";

// i18n: metadata hardcodată RO — F7 localizează
const TITLE = "Portofoliu video";
const DESCRIPTION =
  "Reel-ul MERIDIAN VIDEO: proiecte pe imobiliare, corporate, evenimente, personal brand și industrial. Fiecare proiect cu context, execuție și rezultat.";

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
      route: "/video/portofoliu",
      locale: locale as Locale,
      division: "video",
      title: TITLE,
      description: DESCRIPTION,
    }),
  };
}

/**
 * /video/portofoliu (FAZA 2).
 * Signature: reel orizontal scroll-driven (desktop); listă verticală pe
 * mobil și sub reduced-motion. Filtrare pe segment, case study în overlay.
 * Tot conținutul e placeholder marcat — se înlocuiește cu un commit.
 */
export default async function VideoPortfolioPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { segment } = await searchParams;
  const initialSegment =
    typeof segment === "string" &&
    (VIDEO_SEGMENTS as string[]).includes(segment)
      ? (segment as VideoSegment)
      : undefined;

  return (
    <>
      <VideoMotionStyles />
      <VideoLenis />
      <FocusCursor />

      <Section spacing="sm" className="pt-28 sm:pt-36">
        <Container size="wide">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-fg/60">
            {/* i18n: */}
            PORTOFOLIU · {String(videoProjects.length).padStart(2, "0")} CADRE ·
            INTEGRAL PLACEHOLDER
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-5xl tracking-tight sm:text-7xl">
            {/* i18n: */}
            <WordReveal text="Dovada, cadru cu cadru." />
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-fg/70">
            {/* i18n: */}
            Banda de mai jos se derulează cu scroll, ca o peliculă. Fiecare
            proiect e deocamdată un placeholder marcat — structura e gata, iar
            munca reală o înlocuiește cu un singur commit, nu cu un redesign.
          </p>
        </Container>
      </Section>

      <div className="pb-20 sm:pb-28">
        <PortfolioReel projects={videoProjects} initialSegment={initialSegment} />
      </div>

      <CtaBand
        // i18n:
        slate="CADRUL LIPSĂ"
        title="Locul ăsta așteaptă proiectul tău."
        lead="Primele proiecte publicate aici primesc toată atenția noastră — avem un portofoliu de umplut și un standard de setat."
        cta={{ label: "Cere ofertă", href: "/video/contact" }}
        secondary={{ label: "sau vezi serviciile", href: "/video/servicii" }}
      />
    </>
  );
}

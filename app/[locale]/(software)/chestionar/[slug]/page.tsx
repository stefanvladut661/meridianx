import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Questionnaire } from "@/components/site/questionnaire/questionnaire";
import {
  QUESTIONNAIRE_SLUGS,
  getQuestionnaire,
} from "@/components/site/questionnaire/registry";

/**
 * Chestionarele de descoperire: /chestionar/<slug>.
 *
 * Pagini private, trimise clientului pe link: nu intră în sitemap și
 * cer explicit să nu fie indexate. Un slug necunoscut dă 404.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    QUESTIONNAIRE_SLUGS.map((slug) => ({ locale, slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const config = getQuestionnaire(slug);
  if (!config) return {};

  const title = `Chestionar pentru ${config.subject}`;
  const description = "Câteva întrebări înainte de ofertă: ce vreți să construim, pe site și în secțiunea de cursuri.";

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
    openGraph: {
      type: "website",
      siteName: "MERIDIAN",
      locale: "ro_RO",
      title: `${title} — MERIDIAN`,
      description,
      images: [
        {
          url: "/og.png?division=software&title=Chestionar",
          width: 1200,
          height: 630,
          alt: "MERIDIAN — chestionar",
        },
      ],
    },
  };
}

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const config = getQuestionnaire(slug);
  if (!config) notFound();

  return <Questionnaire config={config} />;
}

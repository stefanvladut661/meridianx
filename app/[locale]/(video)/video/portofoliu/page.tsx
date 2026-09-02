import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import {
  breadcrumbSchema,
  imageGallerySchema,
  pageSeo,
  videoObjectSchema,
} from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { PHOTOS, VIDEOS } from "@/components/site/portfolio-content";
import { PortfolioScreen } from "@/components/site/pages/portfolio";

/**
 * Portofoliul diviziei VIDEO.
 *
 * Materialele marcate A în folderul sursă stau pe /video; aici sunt
 * toate, împărțite pe client. Ruta rămâne un înveliș subțire, ca și
 * landing-ul: metadata pe server, ecranul într-o componentă de client,
 * fiindcă playerul are nevoie de browser.
 */

const TITLE = "Portofoliu — filmări și fotografie";
const DESCRIPTION =
  "Materiale filmate, montate și fotografiate de MERIDIAN pentru restaurante, cluburi, evenimente și cabinete. Așezate pe client, cu sunet, la apăsare.";

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
      ogTitle: "PORTOFOLIU MERIDIAN",
    }),
  };
}

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  /* Fiecare clip și fiecare fotografie primesc propria fișă: pentru un
     crawler, un <video> fără VideoObject e un dreptunghi mut, iar o
     galerie fără ImageObject e o pagină fără imagini. */
  const schema = [
    breadcrumbSchema(
      [
        { name: "MERIDIAN", route: "/" },
        { name: "Video", route: "/video" },
        { name: "Portofoliu", route: "/video/portofoliu" },
      ],
      locale as Locale
    ),
    ...VIDEOS.map((video) =>
      videoObjectSchema(video, "/video/portofoliu", locale as Locale)
    ),
    imageGallerySchema(PHOTOS, "/video/portofoliu", locale as Locale),
  ];

  return (
    <>
      <JsonLd schema={schema} />
      <PortfolioScreen />
    </>
  );
}

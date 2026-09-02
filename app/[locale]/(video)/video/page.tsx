import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { faqSchema, pageSeo, serviceSchema } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { FAQ } from "@/components/site/video-content";
import { VideoScreen } from "@/components/site/pages/video";

/**
 * Landing-ul diviziei VIDEO (redesign 2026-08).
 *
 * Ruta e un înveliș subțire: metadata pe server, ecranul propriu-zis
 * într-o componentă de client, fiindcă tot ce ține pagina în viață —
 * reveal-uri la scroll, contoare, meniul, comutatorul de divizii — are
 * nevoie de browser. Pagina rămâne prerandată static; hidratarea doar
 * pornește mișcarea.
 */

const TITLE = "Producție video și campanii care aduc clienți";
const DESCRIPTION =
  "Filmăm, montăm și distribuim pe Meta, TikTok și Google. Pentru afaceri din HORECA, imobiliare, wellness, auto și eCommerce care vor cereri și comenzi, nu vizualizări.";

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
      ogTitle: "MERIDIAN VIDEO",
    }),
  };
}

export default async function VideoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  /* Întrebările de pe pagină, declarate și pentru Google: sunt aceleași
     texte, nu o listă paralelă care poate rămâne în urmă. */
  const schema = [
    serviceSchema({
      name: "Producție video și campanii",
      description: DESCRIPTION,
      division: "video",
      route: "/video",
      locale: locale as Locale,
    }),
    faqSchema(FAQ),
  ];

  return (
    <>
      <JsonLd schema={schema} />
      <VideoScreen />
    </>
  );
}

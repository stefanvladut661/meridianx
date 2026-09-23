import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { breadcrumbSchema, pageSeo } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { ProjectsIndexScreen } from "@/components/site/pages/software-projects";

/**
 * Portofoliul diviziei SOFTWARE: aplicațiile livrate, fiecare cu demo.
 * Pereche cu /video/portofoliu. Metadata pe server, ecranul în client.
 */

const TITLE = "Proiecte — aplicații livrate, cu demo interactiv";
const DESCRIPTION =
  "Fidelizare pentru stații de carburant, rezervări pentru restaurante, management centralizat pentru rețele de magazine, aplicație de sală, site cu recomandare de pompe de căldură. Fiecare cu demo pe desktop și telefon.";

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
      route: "/software/proiecte",
      locale: locale as Locale,
      division: "software",
      title: TITLE,
      description: DESCRIPTION,
      ogTitle: "PROIECTE MERIDIAN",
    }),
  };
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema(
            [
              { name: "Software", route: "/software" },
              { name: "Proiecte", route: "/software/proiecte" },
            ],
            locale as Locale
          ),
        ]}
      />
      <ProjectsIndexScreen />
    </>
  );
}

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { faqSchema, pageSeo, serviceSchema } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { SFAQ } from "@/components/site/software-content";
import { SoftwareScreen } from "@/components/site/pages/software";

/**
 * Landing-ul diviziei SOFTWARE (redesign 2026-08).
 *
 * Același tipar ca la video: metadata pe server, ecranul în client.
 * Aici componenta de client e obligatorie și dintr-un al doilea motiv:
 * configuratorul de proiect e lead magnet-ul paginii și trăiește în
 * starea din browser.
 */

const TITLE = "Software la comandă pentru firme care digitalizează";
const DESCRIPTION =
  "Aplicații de business, dashboard-uri, fidelizare, mecanisme de vânzare, SaaS și mobil. Pentru firme cu finanțare de digitalizare: livrare pe etape scurte, cod și conturi pe numele tău.";

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
      route: "/software",
      locale: locale as Locale,
      division: "software",
      title: TITLE,
      description: DESCRIPTION,
      ogTitle: "MERIDIAN SOFTWARE",
    }),
  };
}

export default async function SoftwarePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const schema = [
    serviceSchema({
      name: "Dezvoltare software la comanda",
      description: DESCRIPTION,
      division: "software",
      route: "/software",
      locale: locale as Locale,
    }),
    faqSchema(SFAQ),
  ];

  return (
    <>
      <JsonLd schema={schema} />
      <SoftwareScreen />
    </>
  );
}

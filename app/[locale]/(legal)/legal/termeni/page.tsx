import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { alternatesFor } from "@/lib/seo";
import { getDocument } from "../_content/documents";
import { LegalDocumentView } from "../_content/legal-document";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.terms" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: alternatesFor("/legal/termeni", locale as Locale),
  };
}

export default async function TermsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal.terms");

  return (
    <LegalDocumentView
      document={getDocument("termeni", locale as Locale)}
      title={t("title")}
      lead={t("lead")}
    />
  );
}

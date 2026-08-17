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
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: alternatesFor("/legal/confidentialitate", locale as Locale),
  };
}

export default async function PrivacyPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal.privacy");

  return (
    <LegalDocumentView
      document={getDocument("confidentialitate", locale as Locale)}
      title={t("title")}
      lead={t("lead")}
    />
  );
}

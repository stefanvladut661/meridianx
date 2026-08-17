import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { ConsentPreferences } from "@/components/consent/consent-preferences";
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
  const t = await getTranslations({ locale, namespace: "legal.cookies" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: alternatesFor("/legal/cookies", locale as Locale),
  };
}

export default async function CookiesPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal.cookies");

  return (
    <>
      <LegalDocumentView
        document={getDocument("cookies", locale as Locale)}
        title={t("title")}
        lead={t("lead")}
      />
      {/* butonul de retragere stă imediat sub secțiunea „cum îți schimbi
          alegerea”, nu într-un subsol pe care nu-l citește nimeni */}
      <Container size="narrow" className="pb-16">
        <ConsentPreferences />
      </Container>
    </>
  );
}

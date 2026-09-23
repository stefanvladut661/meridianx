import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { breadcrumbSchema, pageSeo } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { DEMO_SLUGS, getDemo } from "@/components/site/app-demos/registry";
import { DemoViewer } from "@/components/site/app-demos/viewer";

/**
 * Demo-ul interactiv al unei aplicații din portofoliu.
 *
 * Ruta e un înveliș subțire: metadata pe server, vizualizatorul în
 * client. Componenta demo-ului se încarcă leneș, doar aici — pagina
 * /software nu plătește nimic pentru ea.
 */

export function generateStaticParams() {
  return DEMO_SLUGS.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const meta = getDemo(slug);
  if (!meta) return {};
  const title = `${meta.name} — demo interactiv`;
  const description = `${meta.headline} ${meta.summary}`.slice(0, 300);
  return {
    title,
    description,
    ...pageSeo({
      route: `/software/proiecte/${slug}`,
      locale: locale as Locale,
      division: "software",
      title,
      description,
      ogTitle: meta.name,
    }),
  };
}

export default async function DemoPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const meta = getDemo(slug);
  if (!meta) notFound();

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema(
            [
              { name: "Software", route: "/software" },
              { name: "Proiecte", route: "/software/proiecte" },
              { name: meta.name, route: `/software/proiecte/${slug}` },
            ],
            locale as Locale
          ),
        ]}
      />
      <div data-scope="software" className="md-root min-h-dvh">
        <DemoViewer meta={meta} />
      </div>
    </>
  );
}

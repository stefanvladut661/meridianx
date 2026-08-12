import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

/**
 * PLACEHOLDER FAZA 0 — pagina reală de gateway (split-screen
 * VIDEO | SOFTWARE) e livrabilul FAZEI 1, care rescrie complet
 * acest fișier. Există doar ca build-ul să treacă și ca cheile
 * i18n din namespace-ul `gateway` să aibă un consumator.
 */
export default async function GatewayPlaceholder({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("gateway");

  return (
    <main className="grid min-h-dvh grid-rows-2 md:grid-cols-2 md:grid-rows-1">
      <section
        data-world="video"
        className="flex items-center justify-center bg-bg text-fg"
      >
        <h1 className="font-display text-3xl tracking-tight">
          {t("video.title")}
        </h1>
      </section>
      <section
        data-world="software"
        className="flex items-center justify-center border-t border-line bg-bg text-fg md:border-l md:border-t-0"
      >
        <h1 className="font-display text-3xl tracking-tight">
          {t("software.title")}
        </h1>
      </section>
    </main>
  );
}

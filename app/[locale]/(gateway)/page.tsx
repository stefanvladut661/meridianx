import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { GatewayScreen } from "@/components/site/pages/gateway";
import { ClearDivision } from "@/components/gateway/clear-division";
import { alternatesFor, neutralSocial } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";

/**
 * Gateway-ul MERIDIAN (FAZA 1) — split-screen VIDEO | SOFTWARE.
 *
 * PAGINA ASTA TREBUIE SĂ RĂMÂNĂ STATICĂ. E rădăcina site-ului, adică
 * exact adresa pe care cade tot traficul din reclame. Orice API
 * dinamic folosit aici — `cookies()`, `headers()`, `searchParams` —
 * o scoate din prerender și o transformă în randare pe funcție la
 * fiecare cerere, cu tot ce înseamnă asta pentru TTFB. S-a și
 * întâmplat: până la reparația asta, `/` era singura pagină publică
 * fără HTML pregătit în build.
 *
 * Memoria diviziei (redirect server-side spre divizia salvată) a stat
 * aici și a fost scoasă din motivul de mai sus. Nu se pierde nimic:
 * cookie-ul `meridian_division` nu mai e scris de nimeni de la
 * lansare (`setDivision` din lib/hooks/use-division.ts n-are niciun
 * apelant — handler-ele au dispărut în commit-ul f578248), deci
 * redirectul nu s-a declanșat niciodată pentru un vizitator real.
 *
 * `?stay` se tratează în <ClearDivision>, pe client. Astăzi niciun
 * link din site nu îl produce — cheia `seeBothDivisions` din
 * messages/*.json a rămas fără consumator după ștergerea vechilor
 * header-e — dar componenta rămâne ca ieșire pentru cine are
 * cookie-ul setat manual.
 */

const TITLE = "MERIDIAN — Video & Software";
const DESCRIPTION =
  "Producție video comercială și dezvoltare software la comandă. Două divizii, un singur punct zero.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    // Titlul portii e si titlul implicit al site-ului: fara `template`,
    // altfel ar iesi "MERIDIAN — Video & Software — MERIDIAN".
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: alternatesFor("/", locale as Locale),
    ...neutralSocial(TITLE, DESCRIPTION),
  };
}

export default async function GatewayPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <ClearDivision />
      <GatewayScreen />
    </>
  );
}

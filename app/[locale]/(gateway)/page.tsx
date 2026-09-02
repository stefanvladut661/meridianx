import type { Metadata } from "next";
import { cookies } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDivisionFromCookies } from "@/lib/division";
import { GatewayScreen } from "@/components/site/pages/gateway";
import { ClearDivision } from "@/components/gateway/clear-division";
import { alternatesFor, neutralSocial } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";

/**
 * Gateway-ul MERIDIAN (FAZA 1) — split-screen VIDEO | SOFTWARE.
 *
 * Memoria diviziei (server, NU în middleware — înghețat):
 * - cookie `meridian_division` prezent și fără `?stay` → redirect
 *   server-side spre divizia salvată, cu locale-ul curent păstrat;
 * - `?stay=1` (link-ul „Vezi ambele divizii" din header-e/footer)
 *   sare peste redirect; <ClearDivision> șterge cookie-ul la mount
 *   și curăță query-ul din URL. Cookie-ul se șterge și la click pe
 *   link, în client — dublă asigurare.
 * - redirectul există DOAR aici, pe `/` — link-urile directe spre
 *   orice altă rută nu sunt atinse.
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
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const stay = sp.stay !== undefined;

  if (!stay) {
    const division = getDivisionFromCookies(await cookies());
    if (division) {
      redirect({ href: `/${division}`, locale });
    }
  }

  return (
    <>
      {stay && <ClearDivision />}
      <GatewayScreen />
    </>
  );
}

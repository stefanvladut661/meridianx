import { cookies } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDivisionFromCookies } from "@/lib/division";
import { GatewaySplit } from "@/components/gateway/gateway-split";
import { ClearDivision } from "@/components/gateway/clear-division";

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
      <GatewaySplit />
    </>
  );
}

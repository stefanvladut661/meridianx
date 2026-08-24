import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminUser,
  isAllowlistConfigured,
  isAuthConfigured,
  isWriteConfigured,
} from "@/lib/supabase/clients";
import { isEmailConfigured } from "@/lib/email/send";
import { pingDatabase } from "@/lib/supabase/leads";
import { LIMITS, clientIp, rateLimit, rateLimitedResponse } from "../_lib/api";

/**
 * GET /api/health — e backendul chiar legat?
 *
 * DE CE EXISTĂ: între „am pus variabilele în Vercel” și „un lead ajunge în
 * panou și pe email” sunt cinci lucruri care pot fi greșite, iar singurul
 * mod de a le descoperi altfel e să trimiți un formular real și să speri.
 * Ruta asta le spune pe toate cinci în două secunde, după fiecare deploy.
 *
 * CE NU SPUNE NIMĂNUI: valori, chei, adrese, numărul de lead-uri. Partea
 * publică e strict „configurat / neconfigurat” — atât cât să poți pune un
 * uptime check pe ea, nimic din ce ar ajuta pe cineva să atace.
 * Diagnosticul viu (interogare reală în bază, starea migrărilor) cere
 * sesiune de admin.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Ruta e publică; fără plafon ar fi o cale ieftină de a ține funcțiile
  // treze și de a arde execuții.
  const verdict = rateLimit(`health:${clientIp(request)}`, LIMITS.health);
  if (!verdict.allowed) return rateLimitedResponse(verdict);

  const production = process.env.NODE_ENV === "production";

  const checks = {
    /** Fără ea, canonical, sitemap și robots arată spre alt domeniu. */
    siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    /** Insert-ul public de lead. Fără ea: 503 în producție. */
    supabaseWrite: isWriteConfigured(),
    /** Autentificarea pe /admin. */
    supabaseAuth: isAuthConfigured(),
    /** ADMIN_EMAILS — obligatoriu în producție, altfel panoul e blocat. */
    adminAllowlist: isAllowlistConfigured(),
    /** Cheia Resend. Fără ea nu pleacă nicio notificare. */
    email: isEmailConfigured(),
    /** Cui ajung notificările de lead nou. */
    leadRecipients: Boolean(process.env.LEAD_NOTIFICATION_EMAIL),
  };

  // „Gata de producție” = tot ce, lipsind, ar pierde sau ar expune lead-uri.
  const ready =
    checks.siteUrl &&
    checks.supabaseWrite &&
    checks.supabaseAuth &&
    checks.adminAllowlist &&
    checks.email &&
    checks.leadRecipients;

  const body: Record<string, unknown> = {
    ok: production ? ready : true,
    ready,
    environment: production ? "production" : "development",
    checks,
  };

  // Partea vie, doar pentru admin autentificat.
  const user = await getAdminUser();
  if (user) {
    body.database = await pingDatabase();
  }

  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

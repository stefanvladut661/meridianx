import { NextResponse, type NextRequest } from "next/server";
import {
  createWritableSessionClient,
  isAuthConfigured,
  isGoogleSignInEnabled,
} from "@/lib/supabase/clients";
import { LIMITS, clientIp, rateLimit } from "@/app/api/_lib/api";
import { loginWithError } from "../../login/messages";

/**
 * GET /admin/auth/google — pornește intrarea în admin cu Google.
 *
 * E singura cale de intrare în panou. Supabase face autentificarea (OAuth
 * cu PKCE: verificatorul stă într-un cookie până la întoarcere), iar
 * `/admin/auth/callback` verifică lista `ADMIN_EMAILS`. Poarta adevărată
 * rămâne `getAdminUser()`.
 *
 * DE CE o rută GET și nu o acțiune de server: butonul e un link simplu,
 * deci merge și înainte de hidratare. O acțiune trimisă ca formular nativ
 * ar fi redirecționată spre Supabase, iar CSP-ul (`form-action 'self'`)
 * ar opri redirecționarea.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  if (!isAuthConfigured()) {
    return NextResponse.redirect(loginWithError(origin, "neconfigurat"));
  }

  if (!rateLimit(`login:${clientIp(request)}`, LIMITS.login).allowed) {
    return NextResponse.redirect(loginWithError(origin, "prea-multe"));
  }

  // Fără verificarea asta, cu Google oprit omul ar ajunge pe o pagină JSON
  // de eroare pe domeniul Supabase. Dacă setările nu se pot citi, mergem
  // mai departe: răspunsul lui Supabase rămâne cel care decide.
  if ((await isGoogleSignInEnabled()) === false) {
    return NextResponse.redirect(loginWithError(origin, "google-oprit"));
  }

  const supabase = await createWritableSessionClient();
  if (!supabase) return NextResponse.redirect(loginWithError(origin, "neconfigurat"));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/admin/auth/callback", origin).toString(),
      // Alegerea contului la fiecare intrare: cu mai multe conturi Google în
      // browser, altfel intră direct cel implicit, care poate să nu fie pe listă.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) return NextResponse.redirect(loginWithError(origin, "google"));
  return NextResponse.redirect(data.url);
}

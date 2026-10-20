import { NextResponse, type NextRequest } from "next/server";
import { checkAdminEmail, createWritableSessionClient } from "@/lib/supabase/clients";
import { loginWithError } from "../../login/messages";

/**
 * GET /admin/auth/callback — întoarcerea de la Google, prin Supabase.
 *
 * Supabase trimite aici `?code=…` după ce Google a confirmat contul, sau
 * `?error=…` dacă omul a renunțat ori contul nu se poate crea. Codul se
 * schimbă pe sesiune cu verificatorul PKCE pus în cookie la plecare, apoi
 * verificăm lista: un cont Google din afara ei pleacă fără sesiune.
 *
 * Adresa trebuie să fie în Supabase → Authentication → URL Configuration →
 * Redirect URLs. Altfel Supabase trimite codul la Site URL, adică pe prima
 * pagină a site-ului, și intrarea nu se termină.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  if (!code) {
    const reason =
      searchParams.get("error_code") === "signup_disabled"
        ? "cont-nou-oprit"
        : searchParams.get("error") === "access_denied"
          ? "anulat"
          : "google";
    return NextResponse.redirect(loginWithError(origin, reason));
  }

  const supabase = await createWritableSessionClient();
  if (!supabase) return NextResponse.redirect(loginWithError(origin, "neconfigurat"));

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(loginWithError(origin, "google"));

  const access = checkAdminEmail(data.user.email);
  if (access !== "allowed") {
    // Sesiunea tocmai a fost creată: o închidem doar pe asta (`local`), ca
    // să nu rămână un cookie valid pentru un cont care oricum nu trece de
    // gardă, fără să scoatem omul din alte locuri unde e logat.
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(
      loginWithError(origin, access === "allowlist_missing" ? "lista-lipsa" : "fara-acces")
    );
  }

  return NextResponse.redirect(new URL("/admin", origin));
}

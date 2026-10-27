import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/supabase/clients";
import { saveAccount } from "@/lib/postari/conturi";
import { keyProblem } from "@/lib/postari/cripto";
import { logEvent } from "@/lib/postari/istoric";
import { exchangeCode, tiktokConfigured, TIKTOK_SCOPES, TtError, userInfo } from "@/lib/postari/tiktok";

/**
 * GET /admin/postari/conturi/tiktok/callback — întoarcerea din TikTok. Adresa
 * asta (pe www.meridianx.ro) se înregistrează în aplicația de dezvoltator
 * TikTok, la Login Kit → Redirect URI. Verifică `state`, schimbă codul pe
 * tokenuri, cere permisiunea `video.upload` și salvează tokenurile criptate.
 */

export const dynamic = "force-dynamic";

const STATE_COOKIE = "postari_tiktok_state";

function back(request: NextRequest, result: string, motiv?: string): NextResponse {
  const url = new URL("/admin/postari/setari", request.url);
  url.searchParams.set("tiktok", result);
  if (motiv) url.searchParams.set("motiv", motiv.slice(0, 200));
  url.hash = "conturi";
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, "", { path: "/admin/postari/conturi/tiktok", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.redirect(new URL("/admin/login", request.url));
  const actor = user.email ?? user.id;
  if (!tiktokConfigured()) return back(request, "neconfigurat");
  const problem = keyProblem();
  if (problem) return back(request, "eroare", problem);

  const params = request.nextUrl.searchParams;
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (params.get("error")) {
    await logEvent({ actor, zona: "conturi", actiune: "TikTok neconectat", tinta: "tiktok", rezultat: "eroare", mesaj: `TikTok a întors: ${params.get("error")}${params.get("error_description") ? ` (${params.get("error_description")})` : ""}.` });
    return back(request, "refuzat");
  }
  if (!expected || params.get("state") !== expected) {
    await logEvent({ actor, zona: "conturi", actiune: "TikTok neconectat", tinta: "tiktok", rezultat: "eroare", mesaj: "Întoarcerea din TikTok n-a avut starea așteptată (link vechi sau deschis în alt browser)." });
    return back(request, "stare");
  }
  const code = params.get("code");
  if (!code) return back(request, "eroare", "TikTok nu a dat codul de conectare.");

  try {
    const tokens = await exchangeCode(code);
    const granted = tokens.scope.split(/[,\s]+/).filter(Boolean);
    if (!TIKTOK_SCOPES.every((scope) => granted.includes(scope))) {
      await logEvent({ actor, zona: "conturi", actiune: "TikTok neconectat", tinta: "tiktok", rezultat: "eroare", mesaj: `Permisiunile date: ${granted.join(", ") || "niciuna"}; lipsește video.upload.` });
      return back(request, "permisiune");
    }
    const info = await userInfo(tokens.accessToken).catch(() => ({ openId: tokens.openId, displayName: null }));
    const now = Date.now();
    const saved = await saveAccount({
      platforma: "tiktok",
      contId: tokens.openId || info.openId,
      nume: info.displayName,
      token: tokens.accessToken,
      tokenExpiraLa: new Date(now + tokens.expiresIn * 1000).toISOString(),
      refresh: tokens.refreshToken,
      refreshExpiraLa: new Date(now + tokens.refreshExpiresIn * 1000).toISOString(),
      scope: tokens.scope,
      actor,
    });
    if (!saved.ok) return back(request, "eroare", saved.message);
    await logEvent({ actor, zona: "conturi", actiune: "TikTok conectat", tinta: "tiktok", rezultat: "ok", mesaj: `${info.displayName ?? "Contul"} (open_id ${tokens.openId}). Tokenurile sunt salvate criptat; accesul se reînnoiește singur.` });
    return back(request, "conectat");
  } catch (error) {
    const motiv = error instanceof TtError ? `${error.code ?? error.status}: ${error.message}` : "TikTok n-a răspuns.";
    await logEvent({ actor, zona: "conturi", actiune: "TikTok neconectat", tinta: "tiktok", rezultat: "eroare", mesaj: motiv });
    return back(request, "eroare", motiv);
  }
}

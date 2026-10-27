import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/supabase/clients";
import { authorizeUrl, tiktokConfigured } from "@/lib/postari/tiktok";

/**
 * GET /admin/postari/conturi/tiktok — pornește conectarea contului TikTok
 * (Login Kit for Web). Doar un admin autentificat. `state` e aleator, ținut
 * într-un cookie httpOnly 10 minute și verificat la întoarcere.
 */

export const dynamic = "force-dynamic";

const STATE_COOKIE = "postari_tiktok_state";

export async function GET(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.redirect(new URL("/admin/login", request.url));
  if (!tiktokConfigured()) return NextResponse.redirect(new URL("/admin/postari/setari?tiktok=neconfigurat", request.url));
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(authorizeUrl(state));
  response.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/admin/postari/conturi/tiktok", maxAge: 600 });
  return response;
}

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAdminUser } from "@/lib/supabase/clients";
import { WORKSPACES } from "@/lib/ads/workspaces";
import { WORKSPACE_COOKIE } from "@/lib/ads/workspaces.server";
import { selectionFromCookie } from "@/lib/ads/model/selection.server";
import { clientsForRequest } from "@/lib/ads/model/read";

/**
 * GET /admin/ads/cautari — intrarea „Căutări” din meniu (doar Google).
 *
 * Uneltele Google (campaniile de căutare, termenii, contul, conversiile)
 * lucrează într-un spațiu de lucru. Intrarea trece singură pe spațiul Google al
 * clientului ales sus și deschide prima filă (Campanii de căutare), cu contul
 * lui Google în adresă, ca filele Termeni / Cont / Conversii să se deschidă pe
 * el. Nu scrie nimic în afară de cookie.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.redirect(new URL("/admin/login", request.url));

  const [saved, clients] = await Promise.all([selectionFromCookie(), clientsForRequest()]);
  const client = clients.ok ? (clients.data.find((item) => item.id === saved.clientId) ?? clients.data[0] ?? null) : null;
  const target = new URL("/admin/ads/cautare", request.url);

  if (client) {
    const account = client.accounts.find((item) => item.platform === "google");
    const workspace = WORKSPACES.find((item) => item.platform === "google" && item.owner === client.owner);
    if (workspace) {
      const store = await cookies();
      store.set(WORKSPACE_COOKIE, account?.workspace ?? workspace.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/admin",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    if (account) target.searchParams.set("cont", account.adAccount);
  }
  return NextResponse.redirect(target);
}

import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/supabase/clients";
import { probeDatabase } from "@/lib/supabase/leads";
import { sendKeepaliveEmail, type SendStatus } from "@/lib/email/send";
import type { KeepaliveReport } from "@/emails/keepalive";
import { ERRORS, apiError, isCronRequest } from "./api";

/**
 * Sonda care ține proiectul Supabase treaz (rulează din cron-ul Vercel).
 *
 * DE CE EXISTĂ: planul gratuit Supabase pune pe pauză un proiect care nu
 * are „suficientă activitate în bază în ultima săptămână” — pragul din
 * documentație e „de regulă câteva cereri pe zi”. Agenția primește oferte
 * rar, deci fără sondă baza adoarme, iar formularele de pe site încep să
 * răspundă cu eroare exact când vine un client.
 *
 * Două cadențe, aceeași sondă (vezi `vercel.json`):
 *   - zilnic, în liniște: patru cereri reale în bază; email DOAR dacă a picat;
 *   - lunea: aceleași cereri + raportul de test, ca omul să vadă că lanțul
 *     bază → server → email merge, fără să fie nevoie de o ofertă reală.
 *
 * O bază care nu răspunde trimite alertă atunci, nu lunea: cât timp
 * Supabase e pe pauză, niciun lead nu se salvează.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Ref-ul proiectului e subdomeniul: `https://<ref>.supabase.co`. */
function dashboardUrl(): string | null {
  if (!SUPABASE_URL) return null;
  try {
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    return ref ? `https://supabase.com/dashboard/project/${ref}` : null;
  } catch {
    return null;
  }
}

/** Raportul vine o dată pe săptămână, în aceeași zi (cron-ul e pe luni). */
function nextReportDate(from: Date): Date {
  return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export async function runKeepalive(
  request: NextRequest,
  { report }: { report: boolean }
): Promise<NextResponse> {
  // Cron-ul Vercel SAU un admin logat care deschide ruta din browser — a
  // doua cale există ca sonda să se poată declanșa de mână după o
  // repornire, fără să aștepți până mâine dimineață.
  const authorized = isCronRequest(request) || Boolean(await getAdminUser());
  if (!authorized) return apiError(ERRORS.unauthorized, 401);

  const at = new Date();
  const probe = await probeDatabase();

  if (!probe.ok) {
    console.error(`[keepalive] sonda a picat: ${probe.detail ?? "fără detaliu"}`, probe.steps);
  }

  const kind: KeepaliveReport["kind"] = probe.ok ? "report" : "alert";
  let email: SendStatus = "skipped";
  // Zilnic tace când totul merge; vorbește doar când e ceva de spus.
  if (report || !probe.ok) {
    email = await sendKeepaliveEmail({
      kind,
      probe,
      at,
      nextReportAt: probe.ok ? nextReportDate(at) : null,
      dashboardUrl: dashboardUrl(),
    });
  }

  // 503 când sonda pică, ca lista de invocări din Vercel să arate roșu —
  // e al doilea loc, după email, în care se vede o pană.
  return NextResponse.json(
    { ok: probe.ok, at: at.toISOString(), report, email, probe },
    { status: probe.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}

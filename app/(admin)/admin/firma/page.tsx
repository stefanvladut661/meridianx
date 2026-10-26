import type { Metadata } from "next";
import { computeDashboard } from "@/lib/firma/panou";
import { db } from "@/lib/firma/db";
import { currentMonth, isMonth } from "@/lib/firma/format";
import { DashboardScreen } from "@/components/firma/dashboard-screen";
import { Notice, PageHead } from "@/components/firma/ui";

export const metadata: Metadata = { title: "Panou — MERIDIAN Firmă", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/firma — panoul: cifrele lunii (facturat, încasat, de încasat,
 * întârziat, cheltuieli, banii pe reclame pe client) și alertele. Nicio cifră
 * inventată: unde nu sunt date, ecranul spune ce trebuie făcut ca să apară.
 */
export default async function PanouPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const month = typeof params.luna === "string" && isMonth(params.luna) ? params.luna : currentMonth();
  const dashboard = await computeDashboard(month);
  const admin = db();
  const lastDigest = admin ? (await admin.from("firma_rezumate").select("zi, alerte, trimis, catre, mesaj").order("zi", { ascending: false }).limit(1).maybeSingle()).data : null;
  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="Panou" subtitle="Cifrele lunii și ce cere atenție. Cifrele vin doar din ce e în admin — unde lipsesc datele, scrie ce trebuie făcut." />
      {!dashboard.ok ? (
        <Notice tone="error" className="mt-5">
          {dashboard.message}
        </Notice>
      ) : (
        <DashboardScreen data={dashboard.data} lastDigest={lastDigest ? { zi: String(lastDigest.zi), alerte: Number(lastDigest.alerte), trimis: Boolean(lastDigest.trimis), catre: (lastDigest.catre as string | null) ?? null, mesaj: (lastDigest.mesaj as string | null) ?? null } : null} />
      )}
    </main>
  );
}

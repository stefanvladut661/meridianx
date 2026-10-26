import type { Metadata } from "next";
import { listBank } from "@/lib/firma/incasari";
import { currentMonth, isMonth } from "@/lib/firma/format";
import { isOblioConfigured } from "@/lib/firma/oblio/api";
import { BankScreen } from "@/components/firma/bank-screen";
import { Notice, PageHead } from "@/components/firma/ui";
import { confirmLineAction, ignoreLineAction, importStatementAction, prepareStatementAction, previewStatementAction, rematchAction } from "./actions";

export const metadata: Metadata = { title: "Încasări — MERIDIAN Firmă", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/firma/incasari — exportul din BT Go: importat, potrivit cu facturile
 * (încasările sigure se marchează în Oblio) și cu cheltuielile (plățile),
 * plus lista de confirmat. Extrasul ajunge pe Drive.
 */
export default async function IncasariPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const month = typeof params.luna === "string" && isMonth(params.luna) ? params.luna : currentMonth();
  const bank = await listBank(month);
  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead
        title="Încasări"
        subtitle="Urcă exportul CSV din BT Go, săptămânal sau lunar. Adminul potrivește plățile primite cu facturile — cele sigure le marchează încasate în Oblio, cele nesigure le confirmi tu — și plățile făcute cu cheltuielile."
      />
      {!bank.ok ? (
        <Notice tone="error" className="mt-5">
          {bank.message}
        </Notice>
      ) : (
        <BankScreen
          data={bank.data}
          month={month}
          oblio={isOblioConfigured()}
          actions={{ prepare: prepareStatementAction, preview: previewStatementAction, importStatement: importStatementAction, confirm: confirmLineAction, ignore: ignoreLineAction, rematch: rematchAction }}
        />
      )}
    </main>
  );
}

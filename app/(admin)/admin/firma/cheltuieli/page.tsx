import type { Metadata } from "next";
import { listExpenses } from "@/lib/firma/cheltuieli";
import { currentMonth, isMonth } from "@/lib/firma/format";
import { isOcrConfigured } from "@/lib/firma/ocr";
import { driveMode } from "@/lib/firma/drive/google";
import { ExpensesScreen } from "@/components/firma/expenses-screen";
import { Notice, PageHead } from "@/components/firma/ui";
import { finishUploadAction, hideAction, prepareUploadAction, previewAction, rereadAction, saveExpenseAction } from "./actions";
import { requireAdmin } from "../../_components/require-admin";

export const metadata: Metadata = { title: "Cheltuieli — MERIDIAN Firmă", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/firma/cheltuieli — bonurile și facturile de la furnizori: urcate din
 * telefon, citite automat (furnizor, dată, sumă, categorie), corectate de tine
 * și puse în folderul lunii de pe Drive.
 */
export default async function CheltuieliPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const month = typeof params.luna === "string" && isMonth(params.luna) ? params.luna : currentMonth();
  const expenses = await listExpenses(month);
  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="Cheltuieli" />
      {!expenses.ok ? (
        <Notice tone="error" className="mt-5">
          {expenses.message}
        </Notice>
      ) : (
        <ExpensesScreen
          expenses={expenses.data}
          month={month}
          ocr={isOcrConfigured()}
          drive={Boolean(driveMode())}
          initialOpen={typeof params.rand === "string" ? params.rand : null}
          actions={{ prepareUpload: prepareUploadAction, finishUpload: finishUploadAction, save: saveExpenseAction, reread: rereadAction, hide: hideAction, preview: previewAction }}
        />
      )}
    </main>
  );
}

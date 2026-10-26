import type { Metadata } from "next";
import { listInvoices } from "@/lib/firma/facturi";
import { listClients } from "@/lib/firma/clienti";
import { readSettings } from "@/lib/firma/setari";
import { currentMonth, isMonth, todayIso } from "@/lib/firma/format";
import { isOblioConfigured } from "@/lib/firma/oblio/api";
import { isEmailReady } from "@/lib/firma/email";
import { InvoicesScreen } from "@/components/firma/invoices-screen";
import { Notice, PageHead } from "@/components/firma/ui";
import { approveAction, createManualAction, discardDraftAction, prepareMonthAction, refreshOblioAction, saveDraftAction, sendEmailAction } from "./actions";

export const metadata: Metadata = { title: "Facturi — MERIDIAN Firmă", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/firma/facturi — ciornele lunii (din contracte sau manuale), aprobarea
 * care le emite în Oblio și în e-Factura, emailul care pleacă la „Trimite” și
 * starea fiecăreia: ciornă, emisă, trimisă în e-Factura, încasată, întârziată.
 */
export default async function FacturiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const month = typeof params.luna === "string" && isMonth(params.luna) ? params.luna : currentMonth();
  const clientId = typeof params.client === "string" && params.client ? params.client : null;
  const [invoices, clients, settings] = await Promise.all([listInvoices({ month, clientId }), listClients(), readSettings()]);

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead
        title="Facturi"
        subtitle="Adminul pregătește ciornele din contracte; tu le corectezi și le aprobi. Abia aprobarea le emite în Oblio și le trimite în e-Factura. Anularea și stornarea se fac în Oblio, de tine."
      />
      {!invoices.ok ? (
        <Notice tone="error" className="mt-5">
          {invoices.message}
        </Notice>
      ) : (
        <InvoicesScreen
          invoices={invoices.data}
          clients={clients.ok ? clients.data.map((client) => ({ id: client.id, nume: client.nume, ready: Boolean(client.cui && client.adresa && client.oras && client.judet), email: client.emailFacturare })) : []}
          month={month}
          today={todayIso()}
          series={settings.ok ? settings.data.serieFactura : null}
          oblio={isOblioConfigured()}
          email={isEmailReady()}
          initialOpen={typeof params.rand === "string" ? params.rand : null}
          actions={{
            prepareMonth: prepareMonthAction,
            saveDraft: saveDraftAction,
            createManual: createManualAction,
            discardDraft: discardDraftAction,
            approve: approveAction,
            sendEmail: sendEmailAction,
            refresh: refreshOblioAction,
          }}
        />
      )}
    </main>
  );
}

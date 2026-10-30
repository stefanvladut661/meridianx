"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { displayState, EMAIL_LABEL, invoiceName, STARE_AFISATA, type Factura } from "@/lib/firma/facturi-shared";
import { addDays, dayLabel, money, monthLabel } from "@/lib/firma/format";
import { cn } from "@/lib/utils";
import { InvoicePanel, ManualInvoicePanel, type InvoiceActions, type InvoiceClient } from "./invoice-panel";
import { IconPlus } from "./icons";
import { Empty, Notice, Tag, tdClass, thClass } from "./ui";

export type { InvoiceActions, InvoiceClient } from "./invoice-panel";

/**
 * Lista facturilor lunii. Sus: ce e de făcut (ciorne de aprobat, emailuri de
 * trimis, întârzieri) și cele trei acțiuni — ciornele lunii, factura manuală,
 * starea din Oblio. Un rând deschide panoul facturii.
 */
export function InvoicesScreen({
  invoices,
  clients,
  month,
  today,
  series,
  oblio,
  email,
  drive,
  initialOpen,
  actions,
}: {
  invoices: Factura[];
  clients: InvoiceClient[];
  month: string;
  today: string;
  series: string | null;
  oblio: boolean;
  email: boolean;
  drive: boolean;
  initialOpen: string | null;
  actions: InvoiceActions;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<{ kind: "new" } | { kind: "invoice"; id: string } | null>(initialOpen ? { kind: "invoice", id: initialOpen } : null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const openInvoice = open?.kind === "invoice" ? (invoices.find((invoice) => invoice.id === open.id) ?? null) : null;

  const drafts = invoices.filter((invoice) => invoice.starea === "ciorna");
  const toEmail = invoices.filter((invoice) => invoice.emailStare === "pregatit" || invoice.emailStare === "esuat");
  const late = invoices.filter((invoice) => displayState(invoice, today) === "intarziata");
  const outstanding = invoices.filter((invoice) => invoice.numar && invoice.incasat < invoice.total - 0.005).reduce((sum, invoice) => sum + (invoice.total - invoice.incasat), 0);

  const prepare = () =>
    start(async () => {
      setNotice(null);
      const result = await actions.prepareMonth(month);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.message });
        return;
      }
      const { created, existing, skipped } = result.outcome;
      setNotice({
        tone: skipped.length ? "warn" : "ok",
        text:
          created === 0 && existing === 0 && skipped.length === 0
            ? `Niciun contract activ în ${monthLabel(month)}. Adaugă contractele în Clienți.`
            : `${created === 0 ? "Nicio ciornă nouă" : created === 1 ? "O ciornă nouă" : `${created} ciorne noi`}${existing ? ` · ${existing} existau deja` : ""}${skipped.length ? ` · sărite: ${skipped.map((item) => `${item.client} (${item.reason})`).join(", ")}` : ""}.`,
      });
      router.refresh();
    });

  const refresh = () =>
    start(async () => {
      setNotice(null);
      const result = await actions.refresh();
      setNotice(result.ok ? { tone: "ok", text: result.message ?? "Gata." } : { tone: "error", text: result.message });
      router.refresh();
    });

  const missingOnDrive = invoices.filter((invoice) => invoice.numar && invoice.pasi.drive?.stare !== "ok").length;
  const uploadMissing = () =>
    start(async () => {
      setNotice(null);
      const result = await actions.uploadMissingDrive(month);
      setNotice(result.ok ? { tone: "ok", text: result.message ?? "Gata." } : { tone: "error", text: result.message });
      router.refresh();
    });

  return (
    <>
      {!oblio ? (
        <Notice tone="warn" className="mt-5">
          Oblio nu e legat: poți pregăti și corecta ciorne, dar aprobarea (emiterea) cere OBLIO_EMAIL, OBLIO_API_SECRET și OBLIO_CIF în Vercel.
        </Notice>
      ) : !series ? (
        <Notice tone="warn" className="mt-5">
          Alege seria facturilor în Firmă → Setări, ca aprobarea să știe pe ce serie emite.
        </Notice>
      ) : null}

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ciorne de aprobat" value={String(drafts.length)} tone={drafts.length ? "warn" : "muted"} />
        <Stat label="Emailuri de trimis" value={String(toEmail.length)} tone={toEmail.length ? "warn" : "muted"} />
        <Stat label="Întârziate" value={String(late.length)} tone={late.length ? "error" : "muted"} />
        <Stat label="De încasat (emise în lună)" value={money(outstanding, "RON")} tone="muted" />
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={prepare} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[14px]">
          Pregătește ciornele pentru {monthLabel(month)}
        </button>
        <button type="button" disabled={pending} onClick={() => setOpen({ kind: "new" })} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[14px]">
          <IconPlus size={16} />
          Factură manuală
        </button>
        <button type="button" disabled={pending || !oblio} onClick={refresh} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[14px]">
          Actualizează din Oblio
        </button>
        {drive && missingOnDrive > 0 ? (
          <button type="button" disabled={pending} onClick={uploadMissing} className="btn btn-ghost !min-h-10 !px-4 !py-2 !text-[14px]">
            Urcă pe Drive {missingOnDrive === 1 ? "PDF-ul lipsă" : `cele ${missingOnDrive} PDF-uri lipsă`}
          </button>
        ) : null}
        {pending ? <span className="text-[13px] text-dim">Se lucrează…</span> : null}
      </div>
      {notice ? (
        <Notice tone={notice.tone} className="mt-3">
          <span role="status">{notice.text}</span>
        </Notice>
      ) : null}

      {invoices.length === 0 ? (
        <Empty className="mt-5">Nicio factură în {monthLabel(month)}. Apasă „Pregătește ciornele”, ca adminul să le facă din contractele active, sau fă una manuală.</Empty>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-hair bg-char">
          <table className="ads-table min-w-full border-collapse">
            <thead>
              <tr className="border-b border-hair">
                <th className={cn(thClass, "ads-sticky-col")}>Client</th>
                <th className={thClass}>Factura</th>
                <th className={cn(thClass, "text-right")}>Total</th>
                <th className={thClass}>Emisă</th>
                <th className={thClass}>Scadentă</th>
                <th className={thClass}>Stare</th>
                <th className={thClass}>Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {invoices.map((invoice) => {
                const state = STARE_AFISATA[displayState(invoice, today)];
                const selected = open?.kind === "invoice" && open.id === invoice.id;
                const due = invoice.scadenta ?? addDays(invoice.dataPlanificata, invoice.zileScadenta);
                return (
                  <tr key={invoice.id} onClick={() => setOpen({ kind: "invoice", id: invoice.id })} className={cn("cursor-pointer bg-char hover:bg-[var(--ap-hover)]", selected && "bg-[var(--ap-accent-soft)]")}>
                    <td className={cn(tdClass, "ads-sticky-col min-w-[12rem]")}>
                      <button type="button" onClick={() => setOpen({ kind: "invoice", id: invoice.id })} className="text-left font-semibold text-bone hover:text-[var(--md-a1)] hover:underline">
                        {invoice.clientNume}
                      </button>
                      <p className="mt-0.5 max-w-[18rem] truncate text-[12.5px] text-dim">{invoice.randuri[0]?.denumire ?? "fără rânduri"}</p>
                    </td>
                    <td className={cn(tdClass, "whitespace-nowrap")}>
                      {invoiceName(invoice)}
                      {invoice.felul === "manuala" ? <span className="ml-1.5 text-[12px] text-dim">manuală</span> : null}
                    </td>
                    <td className={cn(tdClass, "whitespace-nowrap text-right tabular-nums")}>{money(invoice.total, invoice.moneda)}</td>
                    <td className={cn(tdClass, "whitespace-nowrap text-[13px]")}>{invoice.dataEmiterii ? dayLabel(invoice.dataEmiterii) : <span className="text-dim">planificată {dayLabel(invoice.dataPlanificata)}</span>}</td>
                    <td className={cn(tdClass, "whitespace-nowrap text-[13px]")}>{dayLabel(due)}</td>
                    <td className={tdClass}>
                      <Tag tone={state.tone}>{state.label}</Tag>
                    </td>
                    <td className={tdClass}>{invoice.emailStare === "nepregatit" ? <span className="text-[13px] text-dim">—</span> : <Tag tone={EMAIL_LABEL[invoice.emailStare].tone}>{EMAIL_LABEL[invoice.emailStare].label}</Tag>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open?.kind === "new" ? (
        <ManualInvoicePanel
          clients={clients}
          today={today}
          createManual={actions.createManual}
          onCreated={(id) => {
            setOpen({ kind: "invoice", id });
            router.refresh();
          }}
          onClose={() => setOpen(null)}
        />
      ) : open?.kind === "invoice" ? (
        <InvoicePanel
          key={open.id}
          invoice={openInvoice}
          clients={clients}
          today={today}
          oblio={oblio}
          email={email}
          actions={actions}
          onChanged={() => router.refresh()}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "warn" | "error" | "muted" }) {
  return (
    <li className="rounded-xl border border-hair bg-char px-4 py-3">
      <p className="text-[12.5px] font-medium text-dim">{label}</p>
      <p className={cn("mt-1 text-[1.375rem] font-semibold tabular-nums", tone === "warn" ? "text-[var(--ap-warn)]" : tone === "error" ? "text-[var(--ap-error)]" : "text-bone")}>{value}</p>
    </li>
  );
}

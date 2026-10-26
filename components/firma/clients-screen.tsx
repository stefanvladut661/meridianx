"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { contractInMonth, priceForMonth, STARE_CONTRACT_LABEL, type Client } from "@/lib/firma/contracte-shared";
import { dayLabel, money, monthLabel } from "@/lib/firma/format";
import { cn } from "@/lib/utils";
import { ClientPanel, type ClientActions } from "./client-panel";
import { IconPlus } from "./icons";
import { Empty, Tag, tdClass, thClass } from "./ui";

export type { ClientActions } from "./client-panel";

/**
 * Tabelul clienților și panoul din dreapta. Un rând = un client: contractul
 * din luna aleasă, abonamentul de pe luna aceea, termenii facturării,
 * legătura cu reclamele, emailul de facturare.
 */
export function ClientsScreen({
  clients,
  adsClients,
  month,
  showArchived,
  oblio,
  initialOpen,
  actions,
}: {
  clients: Client[];
  adsClients: { id: string; name: string }[];
  month: string;
  showArchived: boolean;
  oblio: boolean;
  initialOpen: string | null;
  actions: ClientActions;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<{ kind: "new" } | { kind: "client"; id: string } | null>(initialOpen ? { kind: "client", id: initialOpen } : null);
  const adsName = new Map(adsClients.map((client) => [client.id, client.name]));
  const openClient = open?.kind === "client" ? (clients.find((client) => client.id === open.id) ?? null) : null;

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-dim">
          {clients.length === 0 ? "Niciun client încă." : `${clients.length} ${clients.length === 1 ? "client" : "clienți"}`} · abonamentele din {monthLabel(month)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={showArchived ? "?" : "?arhiva=1"} className="text-[13.5px] font-medium text-[var(--md-a1)] underline underline-offset-4">
            {showArchived ? "Ascunde arhiva" : "Arată și arhiva"}
          </Link>
          <button type="button" onClick={() => setOpen({ kind: "new" })} className="btn btn-light !min-h-10 !px-4 !py-2 !text-[14px]">
            <IconPlus size={16} />
            Client nou
          </button>
        </div>
      </div>

      {clients.length === 0 ? (
        <Empty className="mt-4">
          Adaugă primul client cu „Client nou”. {oblio ? "Datele firmei le poți lua din Oblio, după CUI." : "Când legi Oblio, datele firmei vin de acolo, după CUI."}
        </Empty>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-hair bg-white">
          <table className="ads-table min-w-full border-collapse">
            <thead>
              <tr className="border-b border-hair">
                <th className={cn(thClass, "ads-sticky-col")}>Client</th>
                <th className={thClass}>Contract</th>
                <th className={cn(thClass, "text-right")}>Abonament</th>
                <th className={thClass}>Facturare</th>
                <th className={thClass}>Reclame</th>
                <th className={thClass}>Email facturare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {clients.map((client) => {
                const contract = client.contracte.find((item) => contractInMonth(item, month)) ?? null;
                const price = contract ? priceForMonth(contract.preturi, month) : null;
                const selected = open?.kind === "client" && open.id === client.id;
                return (
                  <tr
                    key={client.id}
                    onClick={() => setOpen({ kind: "client", id: client.id })}
                    className={cn("cursor-pointer bg-white hover:bg-[var(--ap-hover)]", selected && "bg-[var(--ap-accent-soft)]")}
                  >
                    <td className={cn(tdClass, "ads-sticky-col min-w-[14rem]")}>
                      <button type="button" onClick={() => setOpen({ kind: "client", id: client.id })} className="text-left font-semibold text-bone hover:text-[var(--md-a1)] hover:underline">
                        {client.nume}
                      </button>
                      <p className="mt-0.5 text-[12.5px] text-dim">
                        {client.cui ? `CUI ${client.cui}` : "fără CUI"}
                        {client.arhivatLa ? " · arhivat" : ""}
                      </p>
                    </td>
                    <td className={cn(tdClass, "min-w-[12rem]")}>
                      {contract ? (
                        <>
                          <Tag tone="ok">{STARE_CONTRACT_LABEL[contract.starea]}</Tag>
                          <p className="mt-1 text-[12.5px] text-dim">
                            din {dayLabel(contract.incepe)}
                            {contract.seTermina ? ` până la ${dayLabel(contract.seTermina)}` : ", fără sfârșit"}
                          </p>
                        </>
                      ) : client.contracte.length > 0 ? (
                        <Tag tone="muted">Fără contract activ în {monthLabel(month)}</Tag>
                      ) : (
                        <span className="text-[13px] text-dim">—</span>
                      )}
                    </td>
                    <td className={cn(tdClass, "whitespace-nowrap text-right tabular-nums")}>
                      {contract ? (price ? money(price.suma, contract.moneda) : <span className="text-[13px] text-[var(--ap-warn)]">fără preț pe luna asta</span>) : "—"}
                    </td>
                    <td className={cn(tdClass, "whitespace-nowrap text-[13px]")}>{contract ? `ziua ${contract.ziEmitere} · scadent în ${contract.zileScadenta} ${contract.zileScadenta === 1 ? "zi" : "zile"}` : "—"}</td>
                    <td className={cn(tdClass, "text-[13px]")}>{client.adsClientId ? (adsName.get(client.adsClientId) ?? "legat (client negăsit)") : <span className="text-dim">—</span>}</td>
                    <td className={cn(tdClass, "text-[13px]")}>{client.emailFacturare ?? <span className="text-dim">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <ClientPanel
          key={open.kind === "new" ? "nou" : open.id}
          client={open.kind === "new" ? null : openClient}
          loading={open.kind === "client" && !openClient}
          adsClients={adsClients}
          month={month}
          oblio={oblio}
          actions={actions}
          onSaved={(id) => {
            setOpen({ kind: "client", id });
            router.refresh();
          }}
          onChanged={() => router.refresh()}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

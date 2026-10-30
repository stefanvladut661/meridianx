"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { addMonths, currentMonth, isMonth, monthLabel } from "@/lib/firma/format";
import { IconChevronLeft, IconChevronRight } from "./icons";
import { navItemFor } from "./nav";

export interface TopBarClient {
  id: string;
  nume: string;
}

/**
 * Bara de sus: luna și clientul, în adresă (`?luna=AAAA-LL&client=…`), ca un
 * link trimis cuiva să deschidă exact aceeași vedere. Apar doar pe ecranele
 * care le folosesc.
 */
export function FirmaTopBar({ clients }: { clients: TopBarClient[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [pending, start] = useTransition();
  const item = navItemFor(pathname);
  const month = isMonth(params.get("luna")) ? (params.get("luna") as string) : addMonths(currentMonth(), item?.defaultMonthOffset ?? 0);
  const clientId = params.get("client") ?? "";
  const months = Array.from({ length: 24 }, (_, i) => addMonths(currentMonth(), 2 - i));
  if (!months.includes(month)) months.push(month);

  const go = (change: { luna?: string; client?: string }) => {
    const next = new URLSearchParams(params);
    if (change.luna !== undefined) next.set("luna", change.luna);
    if (change.client !== undefined) {
      if (change.client) next.set("client", change.client);
      else next.delete("client");
    }
    next.delete("rand");
    start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return (
    <div className="sticky top-0 z-30 border-b border-hair bg-char/95 backdrop-blur">
      <div className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <p className="text-[14px] font-semibold text-bone">{item?.label ?? "Firmă"}</p>
        {item?.month ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => go({ luna: addMonths(month, -1) })}
              className="grid h-9 w-9 place-items-center rounded-lg border border-hair-strong bg-char text-dim hover:bg-[var(--ap-hover)]"
            >
              <IconChevronLeft />
              <span className="sr-only">Luna dinainte</span>
            </button>
            <label>
              <span className="sr-only">Luna</span>
              <select
                value={month}
                disabled={pending}
                onChange={(event) => go({ luna: event.currentTarget.value })}
                className="h-9 rounded-lg border border-hair-strong bg-char px-2.5 text-[14px] font-semibold text-bone"
              >
                {months.sort().reverse().map((value) => (
                  <option key={value} value={value}>
                    {monthLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={() => go({ luna: addMonths(month, 1) })}
              className="grid h-9 w-9 place-items-center rounded-lg border border-hair-strong bg-char text-dim hover:bg-[var(--ap-hover)]"
            >
              <IconChevronRight />
              <span className="sr-only">Luna următoare</span>
            </button>
          </div>
        ) : null}
        {item?.client && clients.length > 0 ? (
          <label className="min-w-0">
            <span className="sr-only">Clientul</span>
            <select
              value={clientId}
              disabled={pending}
              onChange={(event) => go({ client: event.currentTarget.value })}
              className="h-9 max-w-[14rem] min-w-0 truncate rounded-lg border border-hair-strong bg-char px-2.5 text-[14px] text-bone"
            >
              <option value="">Toți clienții</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nume}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {pending ? <span className="text-[12.5px] text-dim">Se încarcă…</span> : null}
      </div>
    </div>
  );
}

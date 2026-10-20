"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { Platform } from "@/lib/ads/constants";
import {
  CHANNELS,
  CHANNEL_LABEL,
  PERIODS,
  PERIOD_LABEL,
  parseChannel,
  parseClientId,
  parsePeriod,
  selectionQuery,
  type Selection,
} from "@/lib/ads/model/selection";
import { formatLeadDateTime } from "@/app/(admin)/admin/_components/format-date";
import { cn } from "@/lib/utils";
import { ChannelIcon } from "./channel-icon";
import { IconRefresh } from "./icons";
import { SELECTION_PAGES } from "./nav-items";

type Failure = { ok: false; message: string };

export interface TopBarClient {
  id: string;
  name: string;
  owner: "agentie" | "clienti";
  platforms: Platform[];
  lastSyncedAt: string | null;
  failedAccounts: number;
}

/**
 * Bara de sus: clientul, perioada și canalul (Toate / Meta / Google / TikTok).
 * Tot ce e dedesubt se schimbă după ele. Alegerea stă în adresă și în cookie;
 * pe ecranele vechi (Plan nou, Lot, Căutare) schimbă spațiul de lucru.
 */
export function TopBar({
  clients,
  saved,
  remember,
  sync,
}: {
  clients: TopBarClient[];
  saved: Selection;
  remember: (input: { clientId: string | null; channel: string; period: string }) => Promise<{ ok: true } | Failure>;
  sync: (input: { clientId: string }) => Promise<{ ok: true; summary: string; problems: string[] } | Failure>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [syncing, startSync] = useTransition();
  const [note, setNote] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);

  const selection: Selection = {
    clientId: parseClientId(params.get("client")) ?? saved.clientId ?? clients[0]?.id ?? null,
    channel: parseChannel(params.get("canal")) ?? saved.channel,
    period: parsePeriod(params.get("perioada")) ?? saved.period,
  };
  const client = clients.find((item) => item.id === selection.clientId) ?? clients[0] ?? null;

  const choose = (change: Partial<Selection>) => {
    const next = { ...selection, ...change };
    setNote(null);
    start(async () => {
      await remember({ clientId: next.clientId, channel: next.channel, period: next.period });
      if (SELECTION_PAGES.test(pathname)) {
        // Ce ține de un rând anume (bifele, panoul) nu mai are sens la alt client sau canal.
        const keep = new URLSearchParams(params);
        if (change.clientId !== undefined || change.channel !== undefined) for (const key of ["campanii", "grupuri", "rand"]) keep.delete(key);
        router.push(`${pathname}?${selectionQuery(next, keep)}`, { scroll: false });
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="sticky top-0 z-30 border-b border-hair bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        {clients.length > 0 ? (
          <label className="flex min-w-0 items-center gap-2">
            <span className="sr-only">Clientul</span>
            <select
              value={client?.id ?? ""}
              disabled={pending}
              onChange={(event) => choose({ clientId: event.currentTarget.value })}
              className="h-9 max-w-[14rem] min-w-0 truncate rounded-lg border border-hair-strong bg-white px-2.5 text-[14px] font-semibold text-bone"
            >
              {(["clienti", "agentie"] as const).map((owner) => {
                const group = clients.filter((item) => item.owner === owner);
                if (group.length === 0) return null;
                return (
                  <optgroup key={owner} label={owner === "clienti" ? "Clienți" : "Agenția"}>
                    {group.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>
        ) : (
          <Link href="/admin/ads/clienti" className="text-[14px] font-semibold text-[var(--md-a1)] underline underline-offset-4">
            Adaugă primul client
          </Link>
        )}

        <label className="flex items-center">
          <span className="sr-only">Perioada</span>
          <select
            value={selection.period}
            disabled={pending}
            onChange={(event) => choose({ period: parsePeriod(event.currentTarget.value) ?? selection.period })}
            className="h-9 rounded-lg border border-hair-strong bg-white px-2.5 text-[14px] text-bone"
          >
            {PERIODS.map((period) => (
              <option key={period} value={period}>
                {PERIOD_LABEL[period]}
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-label="Canalul" className="-mx-1 flex max-w-full overflow-x-auto px-1 [scrollbar-width:none]">
          <div className="flex rounded-lg border border-hair-strong bg-white p-0.5">
            {CHANNELS.map((channel) => {
              const active = selection.channel === channel;
              const missing = channel !== "toate" && client !== null && !client.platforms.includes(channel);
              return (
                <button
                  key={channel}
                  type="button"
                  aria-pressed={active}
                  disabled={pending}
                  onClick={() => choose({ channel })}
                  title={missing ? `${client?.name} n-are încă un cont ${CHANNEL_LABEL[channel]}` : undefined}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13.5px] font-medium transition-colors duration-150",
                    active ? "bg-[var(--ap-accent-soft)] text-[var(--ap-accent-ink)]" : "text-bone/80 hover:bg-[var(--ap-hover)]",
                    missing && !active && "text-dim"
                  )}
                >
                  {channel !== "toate" ? <ChannelIcon platform={channel} size={14} /> : null}
                  {CHANNEL_LABEL[channel]}
                </button>
              );
            })}
          </div>
        </div>

        {client ? (
          <div className="ml-auto flex items-center gap-2.5">
            <p className="hidden text-[12.5px] text-dim xl:block">
              {client.lastSyncedAt ? `Cifre actualizate ${formatLeadDateTime(client.lastSyncedAt)}` : "Încă neactualizat"}
              {client.failedAccounts > 0 ? (
                <span className="text-[var(--ap-error)]">
                  {" "}
                  · {client.failedAccounts === 1 ? "un cont n-a mers" : `${client.failedAccounts} conturi n-au mers`}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              disabled={syncing || client.platforms.length === 0}
              onClick={() =>
                startSync(async () => {
                  setNote({ tone: "ok", text: "Se citesc conturile…" });
                  const result = await sync({ clientId: client.id });
                  if (!result.ok) setNote({ tone: "error", text: result.message });
                  else setNote({ tone: result.problems.length ? "warn" : "ok", text: result.problems.length ? `${result.summary} ${result.problems.join(" ")}` : result.summary });
                  router.refresh();
                })
              }
              className="btn btn-ghost !min-h-9 !gap-2 !px-3 !py-1.5 !text-[13px]"
            >
              <IconRefresh className={syncing ? "animate-spin motion-reduce:animate-none" : undefined} size={16} />
              {syncing ? "Se actualizează…" : "Actualizează"}
            </button>
          </div>
        ) : null}
      </div>
      {note ? (
        <p
          role={note.tone === "error" ? "alert" : "status"}
          className={cn(
            "border-t border-hair px-4 py-2 text-[13px] sm:px-6",
            note.tone === "error" ? "bg-[var(--ap-error-soft)] text-[var(--ap-error)]" : note.tone === "warn" ? "bg-[var(--ap-warn-soft)] text-[var(--ap-warn)]" : "bg-[var(--ap-ok-soft)] text-[var(--ap-ok)]"
          )}
        >
          {note.text}
        </p>
      ) : null}
    </div>
  );
}

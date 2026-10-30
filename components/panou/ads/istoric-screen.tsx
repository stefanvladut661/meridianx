"use client";

import Link from "next/link";
import { Download, History as HistoryIcon, PauseCircle, PenLine, Plus, Zap, type LucideIcon } from "lucide-react";
import type { HistoryEvent, HistoryKind } from "@/lib/ads/model/history";
import { Btn, Card, Pill, SegmentedControl, type PillTone } from "@/components/panou/ui/primitives";
import { EmptyState, ErrorState } from "@/components/panou/ui/states";
import { InlineNote } from "@/components/panou/ui/actions";
import { useQueryParams } from "@/components/panou/ui/use-query-params";
import { dateTimeRo } from "@/components/panou/ui/format";
import { cn } from "@/lib/utils";
import { CanalMark } from "./canal-mark";

/**
 * Istoric (HistoryPage din redesign): jurnalul portalului, un rând pe eveniment.
 * Filtrul stă în adresă (`?tip=`), ca până acum; paginile de server își recitesc
 * datele la schimbare. Evenimentele vin gata citite din `readHistory()`.
 */

export type IstoricFilter = HistoryKind | "toate";

const FILTERS: Array<{ value: IstoricFilter; label: string }> = [
  { value: "toate", label: "Toate" },
  { value: "create", label: "Create" },
  { value: "change", label: "Pauze și modificări" },
  { value: "sync", label: "Actualizări" },
];

const ICONS: Record<HistoryKind, LucideIcon> = { create: Plus, change: PauseCircle, sync: Zap };
const ICON_TONE: Record<HistoryKind, string> = {
  create: "border-mint/25 bg-mint/10 text-mint",
  change: "border-apricot/25 bg-apricot/10 text-apricot",
  sync: "border-lav/25 bg-lav/10 text-lav",
};

/** Ce rezultat a avut evenimentul, spus în cuvinte; culoarea o dă tonul citit din bază. */
function resultOf(event: HistoryEvent): { label: string; tone: PillTone } {
  if (event.kind === "create") return event.tone === "warn" ? { label: "Parțială", tone: "apricot" } : { label: "Creată pe pauză", tone: "mint" };
  if (event.kind === "change") return { label: "Aplicată", tone: "neutral" };
  if (event.tone === "ok") return { label: "Reușit", tone: "mint" };
  if (event.tone === "warn") return { label: "Parțial", tone: "apricot" };
  if (event.tone === "error") return { label: "Eșuat", tone: "rose" };
  return { label: "În curs", tone: "neutral" };
}

/** Un câmp care începe cu =, +, - sau @ ar fi o formulă în Excel: îl prefixăm. */
const csvCell = (value: string) => {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function IstoricScreen({
  filter,
  events,
  owners,
  missing,
  failure,
}: {
  filter: IstoricFilter;
  events: HistoryEvent[];
  /** Contul de reclame → „Client · Nume cont”. */
  owners: Record<string, string>;
  /** Tabelele care n-au putut fi citite (o migrare neaplicată); restul istoricului rămâne. */
  missing: string[];
  /** Citirea întregului jurnal a eșuat. */
  failure: string | null;
}) {
  const { setMany } = useQueryParams();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-none sm:text-[26px]">Istoric</h1>
          <p className="mt-2 max-w-2xl text-[12.5px] text-muted-foreground">
            Jurnalul portalului: ce s-a făcut, pe ce campanie, când (ora României) și cu ce rezultat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl options={FILTERS} value={filter} onChange={(value) => setMany({ tip: value === "toate" ? "" : value })} ariaLabel="Filtru istoric" size="sm" />
          <Btn
            size="sm"
            variant="outline"
            icon={Download}
            disabled={events.length === 0}
            onClick={() =>
              downloadCsv("istoric-portal.csv", [
                ["Când", "Cine", "Ce", "Pe ce", "Rezultat"],
                ...events.map((event) => [
                  dateTimeRo(event.at),
                  event.by ?? "",
                  event.detail ? `${event.title} — ${event.detail}` : event.title,
                  event.account ? (owners[event.account] ?? event.account) : "",
                  resultOf(event).label,
                ]),
              ])
            }
          >
            Exportă
          </Btn>
        </div>
      </div>

      {missing.length > 0 ? (
        <InlineNote tone="apricot">
          <p className="font-medium">O parte din jurnal nu se poate citi acum.</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </InlineNote>
      ) : null}

      <Card className="overflow-hidden p-0">
        {failure ? (
          <ErrorState title="Jurnalul nu poate fi citit" text={`${failure} Acțiunile din platformă nu sunt afectate.`} onRetry={() => window.location.reload()} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title={filter === "toate" ? "Nimic în jurnal încă" : "Nicio intrare pe filtrul ăsta"}
            text={
              filter === "toate"
                ? "Prima campanie creată, prima pauză sau prima actualizare a cifrelor apar aici, cu cine și când."
                : "Schimbă filtrul pe „Toate” ca să vezi tot ce s-a întâmplat în portal."
            }
            action={
              filter === "toate" ? undefined : (
                <Btn size="sm" variant="outline" onClick={() => setMany({ tip: "" })}>
                  Vezi tot jurnalul
                </Btn>
              )
            }
          />
        ) : (
          <ol className="divide-y divide-white/[0.05]">
            {events.map((event) => {
              const Icon = ICONS[event.kind];
              const result = resultOf(event);
              const target = event.account ? (owners[event.account] ?? event.account) : null;
              return (
                <li key={event.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border", ICON_TONE[event.kind])}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-snug">
                      {event.href ? (
                        <Link href={event.href} className="underline-offset-2 hover:text-lav hover:underline">
                          {event.title}
                        </Link>
                      ) : (
                        event.title
                      )}
                    </p>
                    {event.detail ? (
                      <p className={cn("mt-0.5 whitespace-pre-line text-[11.5px] leading-relaxed", event.tone === "error" ? "text-rose" : event.tone === "warn" ? "text-apricot" : "text-muted-foreground")}>{event.detail}</p>
                    ) : null}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      {event.platform ? <CanalMark platform={event.platform} size="sm" label={false} /> : null}
                      <span>{[target, event.by].filter(Boolean).join(" · ") || "portal"}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="pu-num text-[11px] text-muted-foreground">{dateTimeRo(event.at)}</p>
                    <Pill tone={result.tone} className="mt-1">
                      {result.label}
                    </Pill>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground/60">
        <PenLine className="h-3 w-3" aria-hidden="true" /> Orele sunt afișate în ora României (Europe/Bucharest). Jurnalul arată ultimele 300 de evenimente.
      </p>
    </div>
  );
}

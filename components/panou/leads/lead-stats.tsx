import type { LeadStats } from "@/lib/supabase/types";
import { Card, Pill, Stat } from "../ui/primitives";
import { delta, num, pct } from "../ui/format";
import { STATUS_COLORS, STATUS_ORDER, statusLabel } from "./labels";
import { leadCount, type LeadSourcesSummary } from "./urls";

/** „Surse”: cât din filtrul curent vine de la fiecare sursă UTM. Fără cost pe lead: cifrele de reclame sunt în modulul Reclame. */
function Sources({ sources, hasFilters }: { sources: LeadSourcesSummary; hasFilters: boolean }) {
  const percent = (count: number) => {
    const value = (count / (sources.total || 1)) * 100;
    return value > 0 && value < 1 ? "<1%" : pct(value, 0);
  };

  return (
    <div className="border-t border-white/[0.06] px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Surse</h3>
        <p className="text-[11.5px] text-muted-foreground/70">
          {hasFilters ? `în filtrul curent: ${leadCount(sources.total)}` : `toate cele ${leadCount(sources.total)}`} · după utm_source și utm_campaign
          {sources.truncated ? " · primele 5.000" : ""}
        </p>
      </div>

      <ul className="mt-3 grid gap-x-5 gap-y-3.5 sm:grid-cols-2 xl:grid-cols-5">
        {sources.top.map((group) => {
          const share = (group.count / (sources.total || 1)) * 100;
          const direct = group.source === null && group.campaign === null;
          return (
            <li key={`${group.source ?? ""}|${group.campaign ?? ""}`} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[12.5px] font-medium" title={group.source ?? "Fără UTM"}>
                  {group.source ?? "Fără UTM"}
                </p>
                <p className="pu-num shrink-0 text-[12.5px]">
                  {num(group.count)} <span className="text-muted-foreground">· {percent(group.count)}</span>
                </p>
              </div>
              <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground" title={group.campaign ?? undefined}>
                {direct ? "intrare directă sau formular fără parametri" : (group.campaign ?? "fără campanie")}
              </p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
                <div className={direct ? "h-full rounded-full bg-white/30" : "h-full rounded-full bg-lav"} style={{ width: `${Math.max(share, 2)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      {sources.othersGroups > 0 ? (
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          + {sources.othersGroups} {sources.othersGroups === 1 ? "altă sursă" : "alte surse"} · {leadCount(sources.othersCount)} ({percent(sources.othersCount)})
        </p>
      ) : null}
    </div>
  );
}

/**
 * Banda de indicatori din prototip. Cifrele vin din `getLeadStats` (toată baza);
 * „Surse” e singura bucată care urmărește filtrul curent.
 */
export function LeadStatsCard({ stats, sources, hasFilters }: { stats: LeadStats; sources: LeadSourcesSummary | null; hasFilters: boolean }) {
  const total = stats.total;
  const rate = (stats.qualificationRate ?? 0) * 100;

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-2 divide-x divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-y-0 xl:grid-cols-5">
        <div className="p-4 sm:p-5">
          <Stat label="Săptămâna asta" value={num(stats.thisWeek)} unit="lead-uri" delta={delta(stats.thisWeek, stats.previousWeek)} hint={`${num(stats.previousWeek)} săptămâna trecută`} />
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-baseline gap-2">
            <span className="pu-num text-[30px] font-medium leading-none">{num(total)}</span>
          </div>
          <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Total</p>
          <p className="mt-1.5 text-[12px] text-muted-foreground">toate lead-urile din bază</p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Video / Software</p>
          <p className="pu-num mt-2 text-[22px] font-medium leading-none">
            {num(stats.video)} <span className="text-muted-foreground/40">/</span> {num(stats.software)}
          </p>
          <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
            <div className="h-full bg-lav" style={{ width: `${(stats.video / (total || 1)) * 100}%` }} />
            <div className="h-full bg-apricot" style={{ width: `${(stats.software / (total || 1)) * 100}%` }} />
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <Stat label="Cer fonduri" value={num(stats.funded)} unit={`${Math.round((stats.funded / (total || 1)) * 100)}%`} hint="clienți care vor finanțare" />
        </div>
        <div className="p-4 sm:p-5">
          {/* Definiția reală din getLeadStats: au trecut de „Nou” și nu sunt „Pierdut”. */}
          <Stat
            label="Rată de calificare"
            value={stats.qualificationRate === null ? "—" : pct(rate, 0)}
            hint={stats.qualificationRate === null ? "încă niciun lead" : `${num(stats.qualified)} din ${num(total)} au trecut de „${statusLabel("new")}” și nu sunt „${statusLabel("lost")}”`}
          />
        </div>
      </div>

      <div className="border-t border-white/[0.06] px-4 py-3.5 sm:px-5">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.05]" aria-hidden="true">
          {STATUS_ORDER.map((status) => (
            <div
              key={status}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(stats.byStatus[status] / (total || 1)) * 100}%`, background: STATUS_COLORS[status] }}
              title={`${statusLabel(status)}: ${stats.byStatus[status]}`}
            />
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {STATUS_ORDER.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[status] }} aria-hidden="true" />
              {statusLabel(status)} <span className="pu-num text-foreground/60">{stats.byStatus[status]}</span>
            </span>
          ))}
          <Pill tone="lav" className="ml-auto hidden sm:inline-flex">
            Câștigat ×{stats.byStatus.won}
          </Pill>
        </div>
      </div>

      {sources && sources.total > 0 ? <Sources sources={sources} hasFilters={hasFilters} /> : null}
    </Card>
  );
}

import Link from "next/link";
import { BellRing, ChevronLeft, ChevronRight, Clock, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { btnClass, Card, LiveDot, SectionTitle } from "../ui/primitives";
import { zoneLabel } from "./shared";

/**
 * Bucățile Cozii care nu cer JavaScript: starea programării, statisticile
 * mici, alertele zilei și calendarul pe 7 zile (linkuri, ca să meargă și cu
 * tastatura, și fără script). Starea ecranului — ziua, săptămâna, platforma —
 * stă în adresă.
 */

export interface StripDay {
  key: string;
  weekday: string;
  date: number;
  count: number;
  failed: number;
  href: string;
  /** „lun. 2 noiembrie” pentru cititoarele de ecran. */
  label: string;
}

export function QueueStrip({
  title,
  fus,
  days,
  selected,
  prevHref,
  nextHref,
  todayHref,
  allHref,
}: {
  title: string;
  fus: string;
  days: StripDay[];
  /** Ziua aleasă, sau `null` când lista arată toate zilele. */
  selected: string | null;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  allHref: string;
}) {
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[12.5px] font-medium">{title}</h2>
          <span className="text-[11px] text-muted-foreground">{zoneLabel(fus)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href={prevHref} className={btnClass({ variant: "ghost", size: "xs", className: "px-1.5" })} aria-label="Cele 7 zile dinainte">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href={todayHref} className={btnClass({ variant: "ghost", size: "xs" })}>
            Azi
          </Link>
          <Link href={nextHref} className={btnClass({ variant: "ghost", size: "xs", className: "px-1.5" })} aria-label="Cele 7 zile următoare">
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href={allHref} aria-current={selected === null ? "true" : undefined} className={btnClass({ variant: selected === null ? "outline" : "ghost", size: "xs", className: "ml-1" })}>
            Toate zilele
          </Link>
        </div>
      </div>
      <div className="pu-no-scrollbar flex gap-1.5 overflow-x-auto p-3">
        {days.map((day) => {
          const active = day.key === selected;
          return (
            <Link
              key={day.key}
              href={day.href}
              aria-current={active ? "true" : undefined}
              aria-label={`${day.label}: ${day.count === 0 ? "nicio postare" : `${day.count} ${day.count === 1 ? "postare" : "postări"}`}${day.failed ? `, ${day.failed} eșuate` : ""}`}
              className={cn("min-w-[74px] flex-1 rounded-xl border px-2 py-2 text-left transition-colors", active ? "border-lav/40 bg-lav/[0.1]" : "border-white/[0.07] hover:border-white/20")}
            >
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{day.weekday}</p>
              <p className={cn("pu-num mt-0.5 text-[15px]", active ? "text-[#D8CCFF]" : "")}>{day.date}</p>
              <div className="mt-1 flex items-center gap-1">
                {Array.from({ length: Math.min(day.count, 4) }).map((_, index) => (
                  <span key={index} className="h-1 w-1 rounded-full bg-lav" aria-hidden="true" />
                ))}
                {day.failed ? <span className="h-1 w-1 rounded-full bg-rose" aria-hidden="true" /> : null}
                <span className="ml-auto text-[10px] text-muted-foreground">{day.count || "—"}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/** Starea programării, rândul de sub antet din prototip: Supabase Cron, ultima rulare, câte postări așteaptă. */
export function QueueStatus({
  running,
  cronOk,
  lastRun,
  waiting,
}: {
  running: boolean;
  /** `true` = Supabase Cron a pornit coada în ultimele 15 minute; `null` = nu se știe. */
  cronOk: boolean | null;
  lastRun: { ago: string; source: "cron" | "manual"; error: string | null } | null;
  waiting: number;
}) {
  return (
    <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3">
      <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Database className="h-3.5 w-3.5" aria-hidden="true" /> Supabase Cron: <span className={cronOk ? "text-mint" : "text-rose"}>{cronOk ? "da" : "nu"}</span>
      </span>
      <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" /> ultima rulare:{" "}
        {lastRun ? (
          <span className="text-foreground/80">
            {lastRun.ago} ({lastRun.source === "cron" ? "Supabase Cron" : "manual"})
            {lastRun.error ? <span className="text-[#FFC2CE]"> · {lastRun.error}</span> : null}
          </span>
        ) : (
          <span className="text-foreground/80">n-a rulat încă</span>
        )}
      </span>
      <LiveDot active={running} label={running ? "verifică la 5 minute" : "oprit din portal"} />
      <span className="ml-auto flex items-center gap-3 text-[11.5px] text-muted-foreground">
        {waiting} {waiting === 1 ? "postare în așteptare" : "postări în așteptare"}
        <Link href="/admin/postari/istoric?zona=coada" className="hover:text-foreground">
          Istoricul cozii →
        </Link>
      </span>
    </Card>
  );
}

export interface PlatformStats {
  /** Instagram: publicate. TikTok: ajunse în ciorne (și publicate din ele). */
  sent: number;
  failed: number;
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "rose" }) {
  return (
    <div className="rounded-xl border border-white/[0.07] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={cn("pu-num mt-1 text-[20px] font-medium leading-none", tone === "rose" && value > 0 ? "text-rose" : value === 0 ? "text-foreground/45" : "")}>{value}</p>
    </div>
  );
}

/** Statistici mici, din postările reale: ce a plecat și ce a eșuat în ultimele 7 zile, pe platformă. */
export function QueueStats({ instagram, tiktok }: { instagram: PlatformStats | null; tiktok: PlatformStats | null }) {
  return (
    <Card className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[12.5px] font-medium">Ultimele 7 zile</h2>
        <span className="text-[11px] text-muted-foreground">după ora din plan</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {instagram ? (
          <>
            <MiniStat label="Instagram · publicate" value={instagram.sent} />
            <MiniStat label="Instagram · eșuate" value={instagram.failed} tone="rose" />
          </>
        ) : null}
        {tiktok ? (
          <>
            <MiniStat label="TikTok · în ciorne" value={tiktok.sent} />
            <MiniStat label="TikTok · eșuate" value={tiktok.failed} tone="rose" />
          </>
        ) : null}
      </dl>
    </Card>
  );
}

export interface QueueAlert {
  mesaj: string;
  when: string;
  meta: string;
  tone: "rose" | "apricot";
}

/** Alertele din ultimele două zile (cele care au plecat și pe email), cu cât de grave sunt. */
export function QueueAlerts({ alerts }: { alerts: QueueAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <SectionTitle
          title={
            <span className="inline-flex items-center gap-2">
              <BellRing className="h-4 w-4 text-apricot" aria-hidden="true" /> Alertele din ultimele 2 zile
            </span>
          }
          hint="Ce a ridicat coada singură: eșecuri, tokenuri, conturi care expiră."
        />
      </div>
      <ul className="divide-y divide-white/[0.05]">
        {alerts.map((alert, index) => (
          <li key={`${alert.when}-${index}`} className="flex items-start gap-3 px-4 py-3">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", alert.tone === "rose" ? "bg-rose" : "bg-apricot")} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-line text-[12.5px]">{alert.mesaj}</p>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                {alert.when} · {alert.meta}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

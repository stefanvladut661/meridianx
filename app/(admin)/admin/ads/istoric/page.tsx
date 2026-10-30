import type { Metadata } from "next";
import Link from "next/link";
import { readHistory, type HistoryKind } from "@/lib/ads/model/history";
import { clientsForRequest } from "@/lib/ads/model/read";
import { formatLeadDateTime } from "@/app/(admin)/admin/_components/format-date";
import { ChannelIcon } from "@/components/ads/channel-icon";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Istoric — MERIDIAN Reclame",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: HistoryKind | "toate"; label: string }> = [
  { key: "toate", label: "Toate" },
  { key: "create", label: "Create" },
  { key: "change", label: "Pauze și modificări" },
  { key: "sync", label: "Actualizări" },
];

const TONE = {
  ok: "bg-[var(--ap-ok)]",
  warn: "bg-[#f0b429]",
  error: "bg-[var(--ap-error)]",
  neutral: "bg-[var(--md-a1)]",
} as const;

const dayFormat = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Bucharest" });

/**
 * /admin/ads/istoric — ce a făcut portalul: campaniile create pe pauză, pauzele
 * și modificările pe conturi, actualizările cifrelor (cu problemele lor).
 */
export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filter = FILTERS.find((item) => item.key === params.tip)?.key ?? "toate";
  const [history, clients] = await Promise.all([readHistory(), clientsForRequest()]);
  const owners = new Map<string, string>();
  if (clients.ok) for (const client of clients.data) for (const account of client.accounts) owners.set(account.adAccount, `${client.name} · ${account.name ?? account.adAccount}`);

  const events = history.ok ? history.data.events.filter((event) => filter === "toate" || event.kind === filter) : [];
  const byDay = new Map<string, typeof events>();
  for (const event of events) {
    const day = dayFormat.format(new Date(event.at));
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-[1.5rem] font-semibold tracking-tight text-bone">Istoric</h1>
      <p className="mt-0.5 text-[13.5px] text-dim">Ce a făcut portalul: campaniile create, pauzele și modificările pe conturi, actualizările cifrelor.</p>

      <nav aria-label="Ce arată istoricul" className="mt-5 flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "toate" ? "/admin/ads/istoric" : `/admin/ads/istoric?tip=${item.key}`}
            aria-current={filter === item.key ? "page" : undefined}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[13.5px] font-medium",
              filter === item.key ? "border-[var(--md-a1)] bg-[var(--ap-accent-soft)] text-[var(--ap-accent-ink)]" : "border-hair-strong text-bone/80 hover:bg-[var(--ap-hover)]"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {!history.ok ? <p className="mt-6 text-[14px] text-[var(--ap-error)]">{history.message}</p> : null}
      {history.ok && history.data.missing.length > 0 ? (
        <ul className="mt-4 max-w-2xl list-disc rounded-xl border border-hair bg-[var(--ap-side)] py-3 pl-9 pr-4 text-[13.5px] text-bone/80">
          {history.data.missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {history.ok && events.length === 0 ? (
        <p className="mt-6 max-w-xl text-[14.5px] text-dim">
          {filter === "toate" ? "Nimic încă. Prima campanie creată, prima pauză sau prima actualizare apar aici." : "Nimic de felul ăsta încă."}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6">
        {[...byDay.entries()].map(([day, list]) => (
          <section key={day} aria-label={day}>
            <h2 className="text-[13px] font-semibold first-letter:uppercase text-dim">{day}</h2>
            <ol className="mt-2 divide-y divide-hair rounded-xl border border-hair bg-char">
              {list.map((event) => (
                <li key={event.id} className="flex gap-3 px-4 py-3">
                  <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE[event.tone])} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-[14px] font-medium text-bone">
                      {event.platform ? <ChannelIcon platform={event.platform} labelled /> : null}
                      {event.href ? (
                        <Link href={event.href} className="hover:text-[var(--md-a1)] hover:underline">
                          {event.title}
                        </Link>
                      ) : (
                        event.title
                      )}
                    </p>
                    {event.detail ? <p className={cn("mt-0.5 whitespace-pre-line text-[13px] leading-relaxed", event.tone === "error" ? "text-[var(--ap-error)]" : "text-dim")}>{event.detail}</p> : null}
                    <p className="mt-0.5 text-[12px] text-dim">
                      {formatLeadDateTime(event.at)}
                      {event.account ? ` · ${owners.get(event.account) ?? event.account}` : ""}
                      {event.by ? ` · ${event.by}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}

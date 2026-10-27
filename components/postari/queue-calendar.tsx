import Link from "next/link";
import type { PostView } from "@/lib/postari/coada-shared";
import { addDays, dayLabel, LUNI, zonedParts } from "@/lib/postari/timp";
import { cn } from "@/lib/utils";
import { IconChevronLeft, IconChevronRight } from "./icons";

interface DayCount {
  instagram: number;
  tiktok: number;
  esuate: number;
  plecate: number;
}

const WEEKDAYS = ["L", "Ma", "Mi", "J", "V", "S", "D"];

/** „2026-11” ± n luni. */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Zilele afișate pentru o lună: de luni până duminică, cu zilele din lunile vecine. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // luni = 0
  const start = addDays(first, -weekday);
  const days: string[] = [];
  for (let i = 0; i < 42; i += 1) {
    const day = addDays(start, i);
    if (i >= 35 && !day.startsWith(month)) break;
    days.push(day);
  }
  return days;
}

/**
 * Calendarul cozii: o lună, cu postările fiecărei zile pe platforme. Roșu =
 * o postare eșuată în ziua aceea. O zi aleasă filtrează lista de dedesubt.
 * Doar linkuri: merge fără JavaScript și cu tastatura.
 */
export function QueueCalendar({ month, posts, fus, today, selected }: { month: string; posts: PostView[]; fus: string; today: string; selected: string | null }) {
  const counts = new Map<string, DayCount>();
  for (const post of posts) {
    if (post.stare === "scoasa") continue;
    const day = zonedParts(new Date(post.programataLa), fus).day;
    const count = counts.get(day) ?? { instagram: 0, tiktok: 0, esuate: 0, plecate: 0 };
    count[post.platforma] += 1;
    if (post.stare === "esuata") count.esuate += 1;
    if (post.stare === "publicata" || post.stare === "in_ciorne") count.plecate += 1;
    counts.set(day, count);
  }
  const days = monthGrid(month);
  const [year, m] = month.split("-").map(Number);
  const href = (params: { luna?: string; zi?: string | null }) => {
    const search = new URLSearchParams();
    search.set("luna", params.luna ?? month);
    if (params.zi) search.set("zi", params.zi);
    return `/admin/postari?${search.toString()}`;
  };

  return (
    <section aria-labelledby="calendar" className="rounded-xl border border-hair bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="calendar" className="text-[15px] font-semibold capitalize text-bone">
          {LUNI[m - 1]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <Link href={href({ luna: shiftMonth(month, -1) })} className="inline-flex size-9 items-center justify-center rounded-lg text-bone hover:bg-[var(--ap-hover)]" aria-label="Luna dinainte">
            <IconChevronLeft />
          </Link>
          <Link href={href({ luna: today.slice(0, 7) })} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-[13px] text-bone hover:bg-[var(--ap-hover)]">
            Azi
          </Link>
          <Link href={href({ luna: shiftMonth(month, 1) })} className="inline-flex size-9 items-center justify-center rounded-lg text-bone hover:bg-[var(--ap-hover)]" aria-label="Luna următoare">
            <IconChevronRight />
          </Link>
        </div>
      </div>
      <table className="mt-2 w-full table-fixed border-separate border-spacing-1">
        <caption className="sr-only">Postările pe zile, în {LUNI[m - 1]} {year}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((day) => (
              <th key={day} scope="col" className="pb-1 text-center text-[11.5px] font-semibold uppercase tracking-[0.06em] text-dim">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: days.length / 7 }, (_, week) => (
            <tr key={week}>
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const count = counts.get(day);
                const total = count ? count.instagram + count.tiktok : 0;
                const inMonth = day.startsWith(month);
                const isToday = day === today;
                const isSelected = day === selected;
                const label = `${dayLabel(day, true)}: ${total === 0 ? "nicio postare" : `${count?.instagram ?? 0} pe Instagram, ${count?.tiktok ?? 0} pe TikTok${count?.esuate ? `, ${count.esuate} eșuate` : ""}${count?.plecate ? `, ${count.plecate} plecate` : ""}`}${isSelected ? " (aleasă)" : ""}`;
                return (
                  <td key={day} className="p-0 align-top">
                    <Link
                      href={href({ zi: isSelected ? null : day })}
                      aria-label={label}
                      aria-current={isToday ? "date" : undefined}
                      className={cn(
                        "flex min-h-12 flex-col items-center justify-start gap-1 rounded-lg border px-0.5 py-1",
                        isSelected ? "border-[var(--md-a1)] bg-[var(--ap-accent-soft)]" : count?.esuate ? "border-[var(--ap-error)]/40" : "border-transparent hover:bg-[var(--ap-hover)]",
                        !inMonth && "opacity-45"
                      )}
                    >
                      <span className={cn("text-[13px] tabular-nums leading-none", isToday ? "rounded-full bg-[var(--md-a1)] px-1.5 py-0.5 font-semibold text-white" : "text-bone")}>{Number(day.slice(8))}</span>
                      {total > 0 ? (
                        <span aria-hidden className="flex flex-wrap items-center justify-center gap-0.5">
                          {count?.instagram ? <span className="rounded bg-[var(--ap-accent-soft)] px-1 text-[10.5px] font-semibold leading-4 text-[var(--ap-accent-ink)]">{count.instagram}</span> : null}
                          {count?.tiktok ? <span className="rounded bg-[var(--ap-neutral-soft)] px-1 text-[10.5px] font-semibold leading-4 text-bone/80">{count.tiktok}</span> : null}
                          {count?.esuate ? <span className="size-1.5 rounded-full bg-[var(--ap-error)]" /> : null}
                        </span>
                      ) : null}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-dim">
        <span className="rounded bg-[var(--ap-accent-soft)] px-1 font-semibold text-[var(--ap-accent-ink)]">2</span> postări Instagram · <span className="rounded bg-[var(--ap-neutral-soft)] px-1 font-semibold text-bone/80">1</span> postare TikTok · <span className="inline-block size-1.5 rounded-full bg-[var(--ap-error)] align-middle" /> eșuată · alege o zi ca să vezi doar postările ei
      </p>
    </section>
  );
}

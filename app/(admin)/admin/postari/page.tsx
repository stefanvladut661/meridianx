import type { Metadata } from "next";
import { recentAlerts } from "@/lib/postari/alerte";
import type { PostView } from "@/lib/postari/coada-shared";
import { PLATFORMA_LABEL, type Platforma } from "@/lib/postari/limite";
import { lastCronRun, lastRuns, listPosts } from "@/lib/postari/postari";
import { readSettings } from "@/lib/postari/setari";
import { addDays, agoLabel, dayLabel, isDay, todayIn, zonedParts, zonedToUtc, ZILE_SCURT } from "@/lib/postari/timp";
import { InlineNote } from "@/components/panou/ui/actions";
import { Card, Pill } from "@/components/panou/ui/primitives";
import { ErrorState } from "@/components/panou/ui/states";
import { QueueActions } from "@/components/panou/postari/queue-actions";
import { QueueList, type QueueGroup } from "@/components/panou/postari/queue-list";
import { QueueAlerts, QueueStats, QueueStatus, QueueStrip, type PlatformStats, type QueueAlert, type StripDay } from "@/components/panou/postari/queue-panels";
import { ScreenHead } from "@/components/panou/postari/shared";
import { postHistoryAction, removePostAction, retryPostAction, runNowAction, setQueueAction } from "./actions";

export const metadata: Metadata = { title: "Coada — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
/** „Rulează acum” face o rulare întreagă a cozii (bugetul ei e de 45 de secunde). */
export const maxDuration = 60;

/** Coada nu a rulat de atâta timp: jobul din Supabase Cron probabil nu merge. */
const STALE_RUN_MS = 15 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

const platformOf = (value: unknown): Platforma | null => (value === "instagram" || value === "tiktok" ? value : null);

/**
 * /admin/postari — coada: calendarul pe 7 zile, postările zilei alese cu
 * starea fiecăreia, oprirea și pornirea cozii, ultima rulare, alertele și
 * statisticile ultimelor 7 zile. Ziua, săptămâna și platforma stau în adresă
 * (`zi`, `de`, `platforma`).
 */
export default async function CoadaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const settings = await readSettings();
  const fus = settings.ok ? settings.data.sloturiFus : "Europe/Bucharest";
  const today = todayIn(fus);
  const platform = platformOf(params.platforma);
  const start = isDay(params.de) ? params.de : today;
  const selected: string | null = params.zi === "toate" ? null : isDay(params.zi) ? params.zi : today;

  // O singură citire: săptămâna din calendar, ziua aleasă, lista implicită (3 zile în urmă, 60 înainte) și ultimele 7 zile pentru statistici.
  const fromDay = [addDays(today, -8), start, selected ?? today].sort()[0];
  const toDay = [addDays(today, 61), addDays(start, 8), addDays(selected ?? today, 1)].sort().at(-1) ?? addDays(today, 61);
  const [posts, runs, alerts, cronAt] = await Promise.all([
    listPosts({ from: zonedToUtc(fromDay, "00:00", fus).toISOString(), to: zonedToUtc(toDay, "00:00", fus).toISOString() }),
    lastRuns(1),
    recentAlerts(),
    lastCronRun(),
  ]);
  const now = Date.now();
  const running = settings.ok ? settings.data.coadaPornita : true;
  const last = runs.ok ? (runs.data[0] ?? null) : null;
  const all = posts.ok ? posts.data : [];
  const upcoming = all.filter((post) => post.stare === "planificata").length;
  const dayOf = (post: PostView) => zonedParts(new Date(post.programataLa), fus).day;
  const filtered = platform ? all.filter((post) => post.platforma === platform) : all;
  const live = (post: PostView) => post.stare !== "scoasa";

  // Linkurile păstrează platforma; ziua implicită (azi) nu apare în adresă.
  const build = (de: string | null, zi: string | null): string => {
    const query = new URLSearchParams();
    if (platform) query.set("platforma", platform);
    if (de && de !== today) query.set("de", de);
    if (zi && zi !== today) query.set("zi", zi);
    const text = query.toString();
    return text ? `/admin/postari?${text}` : "/admin/postari";
  };

  const days: StripDay[] = Array.from({ length: 7 }, (_, index) => {
    const key = addDays(start, index);
    const ofDay = filtered.filter((post) => dayOf(post) === key && live(post));
    const weekday = new Date(`${key}T00:00:00Z`).getUTCDay();
    return { key, weekday: ZILE_SCURT[weekday], date: Number(key.slice(8)), count: ofDay.length, failed: ofDay.filter((post) => post.stare === "esuata").length, href: build(start, key), label: dayLabel(key) };
  });

  // „De văzut”: eșuate sau rămase în lucru dintr-o zi trecută, oricând ar fi fost ora lor, dacă nu se văd deja în lista de dedesubt.
  const needsAttention = (post: PostView) => post.stare === "esuata" || (post.stare === "in_lucru" && dayOf(post) < today);
  const listFrom = zonedToUtc(addDays(today, -3), "00:00", fus).toISOString();
  const listTo = zonedToUtc(addDays(today, 60), "00:00", fus).toISOString();
  const shown = selected
    ? filtered.filter((post) => dayOf(post) === selected)
    : filtered.filter((post) => !needsAttention(post) && ((post.programataLa >= listFrom && post.programataLa < listTo) || post.stare === "in_lucru" || post.stare === "in_ciorne"));
  const shownIds = new Set(shown.map((post) => post.id));
  const attention = filtered.filter((post) => needsAttention(post) && !shownIds.has(post.id));

  const byDay = new Map<string, PostView[]>();
  for (const post of shown) byDay.set(dayOf(post), [...(byDay.get(dayOf(post)) ?? []), post]);
  const groups: QueueGroup[] = [...byDay.entries()].map(([day, items]) => {
    if (selected) return { key: day, label: null, hint: null, posts: items };
    const ig = items.filter((post) => post.platforma === "instagram" && live(post)).length;
    const tt = items.filter((post) => post.platforma === "tiktok" && live(post)).length;
    const counts = [ig ? `${ig} Instagram` : null, tt ? `${tt} TikTok` : null].filter(Boolean).join(" · ");
    const name = day === today ? "Azi" : day === addDays(today, 1) ? "Mâine" : dayLabel(day);
    return { key: day, label: name, hint: [day === today || day === addDays(today, 1) ? dayLabel(day) : null, counts].filter(Boolean).join(" · ") || null, posts: items };
  });
  const shownCount = shown.filter(live).length;

  const since = now - 7 * DAY_MS;
  const at = (iso: string | null, fallback: string) => new Date(iso ?? fallback).getTime();
  const statsOf = (which: Platforma): PlatformStats => ({
    sent: all.filter((post) => post.platforma === which && (which === "instagram" ? post.stare === "publicata" : post.stare === "in_ciorne" || post.stare === "publicata") && at(post.trimisaLa ?? post.publicataLa, post.programataLa) >= since).length,
    failed: all.filter((post) => post.platforma === which && post.stare === "esuata" && at(null, post.programataLa) >= since).length,
  });

  const alertRows: QueueAlert[] = alerts.map((alert) => ({
    mesaj: alert.mesaj.split("\n\n")[0],
    when: agoLabel(alert.createdAt),
    meta: alert.trimisa ? "trimisă pe email" : alert.eroare ? `emailul n-a plecat: ${alert.eroare}` : "doar aici",
    tone: alert.tip === "postare_esuata" || alert.tip === "token" ? "rose" : "apricot",
  }));

  const stale = !last || now - new Date(last.inceputLa).getTime() > STALE_RUN_MS;
  const cronOk = cronAt !== null && now - new Date(cronAt).getTime() < STALE_RUN_MS;

  return (
    <div className="space-y-4">
      <ScreenHead
        title="Coada"
        badge={
          <Pill tone={running ? "mint" : "rose"} dot>
            {running ? "rulează" : "oprită"}
          </Pill>
        }
        text="Nimic nu pleacă fără „Aprobă planul”. Pe TikTok, clipul ajunge în ciorne — îl publici din telefon."
        actions={<QueueActions running={running} setQueue={setQueueAction} runNow={runNowAction} />}
      />

      {!settings.ok ? <InlineNote tone="rose">{settings.message}</InlineNote> : null}
      {!running && upcoming > 0 ? (
        <InlineNote tone="apricot">
          {upcoming} {upcoming === 1 ? "postare așteaptă" : "postări așteaptă"}. Cele care trec de ora lor cu peste 6 ore nu mai pleacă singure: le repui cu „Reîncearcă”.
        </InlineNote>
      ) : null}
      {stale && upcoming > 0 && running ? (
        <InlineNote tone="apricot">
          {last ? `Coada n-a mai rulat de ${agoLabel(last.inceputLa).replace(/^acum /, "")}.` : "Coada n-a rulat niciodată."} Supabase Cron trebuie s-o pornească la 5 minute: vezi pașii din README, la „Programarea”. Până atunci, „Rulează acum” trimite ce e la timp.
        </InlineNote>
      ) : null}

      <QueueStatus running={running} cronOk={cronAt === null ? null : cronOk} lastRun={last ? { ago: agoLabel(last.inceputLa), source: last.sursa, error: last.eroare } : null} waiting={upcoming} />
      <QueueStats instagram={platform === "tiktok" ? null : statsOf("instagram")} tiktok={platform === "instagram" ? null : statsOf("tiktok")} />
      <QueueAlerts alerts={alertRows} />

      <QueueStrip
        title={start === today ? "Următoarele 7 zile" : `7 zile din ${dayLabel(start)}`}
        fus={fus}
        days={days}
        selected={selected}
        prevHref={build(addDays(start, -7), addDays(start, -7))}
        nextHref={build(addDays(start, 7), addDays(start, 7))}
        todayHref={build(null, null)}
        allHref={build(start, "toate")}
      />

      {posts.ok ? (
        <QueueList
          title={selected ? dayLabel(selected, true) : "Toate zilele"}
          hint={`${shownCount} ${shownCount === 1 ? "postare" : "postări"}${selected ? "" : " (ultimele 3 zile și următoarele 60)"}${platform ? ` · doar ${PLATFORMA_LABEL[platform]}` : ""}`}
          attention={attention}
          groups={groups}
          fus={fus}
          now={now}
          running={running}
          remove={removePostAction}
          retry={retryPostAction}
          runNow={runNowAction}
          history={postHistoryAction}
        />
      ) : (
        <Card className="p-0">
          <ErrorState title="Nu am putut citi coada" text={posts.message} />
        </Card>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { recentAlerts } from "@/lib/postari/alerte";
import { lastRuns, listPosts } from "@/lib/postari/postari";
import { readSettings } from "@/lib/postari/setari";
import { addDays, agoLabel, momentLabel, todayIn, zonedToUtc } from "@/lib/postari/timp";
import { QueueControls } from "@/components/postari/queue-controls";
import { QueueList } from "@/components/postari/queue-list";
import { Notice, PageHead } from "@/components/postari/ui";
import { removePostAction, retryPostAction, runNowAction, setQueueAction } from "./actions";

export const metadata: Metadata = { title: "Coada — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
/** „Rulează acum” face o rulare întreagă a cozii (bugetul ei e de 45 de secunde). */
export const maxDuration = 60;

/** Coada nu a rulat de atâta timp: jobul din Supabase Cron probabil nu merge. */
const STALE_RUN_MS = 15 * 60_000;

/**
 * /admin/postari — coada: ce pleacă, când și unde, starea fiecărei postări,
 * oprirea și pornirea cozii, ultima rulare și alertele.
 */
export default async function CoadaPage() {
  const settings = await readSettings();
  const fus = settings.ok ? settings.data.sloturiFus : "Europe/Bucharest";
  const today = todayIn(fus);
  const from = zonedToUtc(addDays(today, -3), "00:00", fus).toISOString();
  const to = zonedToUtc(addDays(today, 60), "00:00", fus).toISOString();
  const [posts, runs, alerts] = await Promise.all([listPosts({ from, to }), lastRuns(1), recentAlerts()]);
  const last = runs.ok ? runs.data[0] ?? null : null;
  const queueRunning = settings.ok ? settings.data.coadaPornita : true;
  const upcoming = posts.ok ? posts.data.filter((post) => post.stare === "planificata").length : 0;
  const stale = !last || Date.now() - new Date(last.inceputLa).getTime() > STALE_RUN_MS;

  return (
    <main className="px-4 pb-16 pt-6 sm:px-6">
      <PageHead
        title="Coada"
        subtitle={queueRunning ? "Postările din planurile aprobate pleacă singure la ora lor. Pe cele plecate le gestionezi din aplicații." : "Coada e oprită: nimic nu pleacă până o pornești."}
        actions={<QueueControls running={queueRunning} setQueue={setQueueAction} runNow={runNowAction} />}
      />

      {!settings.ok ? (
        <Notice tone="error" className="mt-5 max-w-3xl">
          {settings.message}
        </Notice>
      ) : !queueRunning ? (
        <Notice tone="warn" className="mt-5 max-w-3xl">
          <strong className="font-semibold">Coada e oprită</strong>
          {settings.data.coadaSchimbataLa ? ` din ${momentLabel(settings.data.coadaSchimbataLa, fus)}` : ""}
          {settings.data.coadaSchimbataDe ? `, de ${settings.data.coadaSchimbataDe}` : ""}.{settings.data.coadaMotiv ? ` Motivul: ${settings.data.coadaMotiv}` : ""}
          {upcoming > 0 ? ` ${upcoming} ${upcoming === 1 ? "postare așteaptă" : "postări așteaptă"}. Cele care trec de ora lor cu peste 6 ore nu mai pleacă singure: le repui cu „Reîncearcă”.` : ""}
        </Notice>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-dim">
        {last ? (
          <span>
            Ultima rulare: {agoLabel(last.inceputLa)} ({last.sursa === "cron" ? "Supabase Cron" : "manual"}){last.eroare ? <span className="text-[var(--ap-error)]"> · {last.eroare}</span> : null}
          </span>
        ) : (
          <span>Coada n-a rulat încă.</span>
        )}
        <Link href="/admin/postari/istoric?zona=coada" className="underline underline-offset-2 hover:text-bone">
          Istoricul cozii
        </Link>
      </div>
      {stale && upcoming > 0 && queueRunning ? (
        <Notice tone="warn" className="mt-3 max-w-3xl">
          {last ? `Coada n-a mai rulat de ${agoLabel(last.inceputLa).replace(/^acum /, "")}.` : "Coada n-a rulat niciodată."} Supabase Cron trebuie s-o pornească la 5 minute: vezi pașii din README, la „Programarea”. Până atunci, „Rulează acum” trimite ce e la timp.
        </Notice>
      ) : null}

      {alerts.length > 0 ? (
        <section aria-labelledby="alerte" className="mt-5 max-w-3xl">
          <h2 id="alerte" className="text-[15px] font-semibold text-bone">
            Alertele din ultimele 2 zile
          </h2>
          <ul className="mt-2 grid gap-2">
            {alerts.map((alert, index) => (
              <li key={`${alert.createdAt}-${index}`} className="rounded-xl border border-[var(--ap-warn)]/25 bg-[var(--ap-warn-soft)] px-4 py-2.5 text-[13.5px] text-bone">
                <p className="whitespace-pre-line">{alert.mesaj.split("\n\n")[0]}</p>
                <p className="mt-0.5 text-[12px] text-dim">
                  {agoLabel(alert.createdAt)} · {alert.trimisa ? "trimisă pe email" : alert.eroare ? `emailul n-a plecat: ${alert.eroare}` : "doar aici"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6">
        {posts.ok ? (
          <QueueList posts={posts.data} fus={fus} remove={removePostAction} retry={retryPostAction} />
        ) : (
          <Notice tone="error" className="max-w-3xl">
            {posts.message}
          </Notice>
        )}
      </div>
    </main>
  );
}

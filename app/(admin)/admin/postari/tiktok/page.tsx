import type { Metadata } from "next";
import Link from "next/link";
import { listAccounts } from "@/lib/postari/conturi";
import { listPosts } from "@/lib/postari/postari";
import { readSettings } from "@/lib/postari/setari";
import { addDays, agoLabel, momentLabel, todayIn, zonedToUtc } from "@/lib/postari/timp";
import { TiktokDrafts } from "@/components/postari/tiktok-drafts";
import { Empty, Notice, PageHead, Tag } from "@/components/postari/ui";
import { markTiktokPublishedAction } from "../actions";

export const metadata: Metadata = { title: "De publicat pe TikTok — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/postari/tiktok — clipurile ajunse în ciornele TikTok, cu descrierea
 * de copiat. Gândită pentru telefon: deschizi pagina din notificarea TikTok,
 * copiezi, lipești, postezi, apoi „Publicat”.
 */
export default async function TiktokPage() {
  const settings = await readSettings();
  const fus = settings.ok ? settings.data.sloturiFus : "Europe/Bucharest";
  const today = todayIn(fus);
  const [posts, accounts] = await Promise.all([
    listPosts({ from: zonedToUtc(addDays(today, -7), "00:00", fus).toISOString(), to: zonedToUtc(addDays(today, 30), "00:00", fus).toISOString() }),
    listAccounts(),
  ]);
  const tiktok = posts.ok ? posts.data.filter((post) => post.platforma === "tiktok") : [];
  const drafts = tiktok.filter((post) => post.stare === "in_ciorne").sort((a, b) => (b.trimisaLa ?? "").localeCompare(a.trimisaLa ?? ""));
  const upcoming = tiktok.filter((post) => post.stare === "planificata" || post.stare === "in_lucru").slice(0, 5);
  const failed = tiktok.filter((post) => post.stare === "esuata");
  const done = tiktok.filter((post) => post.stare === "publicata").sort((a, b) => (b.publicataLa ?? "").localeCompare(a.publicataLa ?? "")).slice(0, 10);
  const account = accounts.ok ? accounts.data.find((item) => item.platforma === "tiktok") ?? null : null;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <PageHead title="De publicat pe TikTok" subtitle="Clipurile de aici sunt deja în ciornele din aplicația TikTok. TikTok nu primește descrierea prin API, așa că o copiezi de aici." />

      <ol className="mt-4 grid gap-1.5 rounded-2xl border border-hair bg-white px-4 py-3 text-[14.5px] text-bone">
        <li><span className="font-semibold">1.</span> „Copiază descrierea” la clipul de mai jos.</li>
        <li><span className="font-semibold">2.</span> Deschide notificarea TikTok (sau ciornele din profil).</li>
        <li><span className="font-semibold">3.</span> Lipește descrierea și apasă „Postează”.</li>
        <li><span className="font-semibold">4.</span> Înapoi aici, „Publicat”.</li>
      </ol>

      {!account ? (
        <Notice tone="warn" className="mt-4">
          Contul TikTok nu e conectat, deci nimic nu ajunge în ciorne.{" "}
          <Link href="/admin/postari/setari#conturi" className="font-semibold underline underline-offset-2">
            Conectează-l în Setări
          </Link>
        </Notice>
      ) : account.stare !== "activ" ? (
        <Notice tone="error" className="mt-4">
          {account.eroare ?? "Conectarea TikTok nu mai e bună."}{" "}
          <Link href="/admin/postari/setari#conturi" className="font-semibold underline underline-offset-2">
            Conectează din nou
          </Link>
        </Notice>
      ) : null}
      {!posts.ok ? (
        <Notice tone="error" className="mt-4">
          {posts.message}
        </Notice>
      ) : null}

      <section aria-labelledby="ciorne" className="mt-6">
        <h2 id="ciorne" className="flex items-center gap-2 text-[16px] font-semibold text-bone">
          În ciorne, de publicat
          <Tag tone={drafts.length ? "accent" : "muted"}>{drafts.length}</Tag>
        </h2>
        <div className="mt-3">
          {drafts.length > 0 ? (
            <TiktokDrafts drafts={drafts} fus={fus} markPublished={markTiktokPublishedAction} />
          ) : (
            <Empty>{upcoming[0] ? `Nimic de publicat acum. Următorul clip ajunge în ciorne ${momentLabel(upcoming[0].programataLa, fus)}.` : "Nimic de publicat acum. Clipurile TikTok dintr-un plan aprobat apar aici când ajung în ciorne."}</Empty>
          )}
        </div>
      </section>

      {failed.length > 0 ? (
        <Notice tone="error" className="mt-6">
          {failed.length === 1 ? "Un clip TikTok n-a ajuns în ciorne" : `${failed.length} clipuri TikTok n-au ajuns în ciorne`}: {failed.map((post) => `„${post.fisier}”`).join(", ")}.{" "}
          <Link href="/admin/postari" className="font-semibold underline underline-offset-2">
            Vezi motivul în Coada
          </Link>
        </Notice>
      ) : null}

      {upcoming.length > 0 ? (
        <section aria-labelledby="urmeaza" className="mt-6">
          <h2 id="urmeaza" className="text-[15px] font-semibold text-bone">
            Urmează
          </h2>
          <ul className="mt-2 divide-y divide-hair rounded-2xl border border-hair bg-white">
            {upcoming.map((post) => (
              <li key={post.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5">
                <span className="break-all font-[family-name:var(--font-jbmono),ui-monospace,monospace] text-[13px] text-bone">{post.fisier}</span>
                <span className="text-[13px] text-dim">{post.stare === "in_lucru" ? "se trimite acum" : momentLabel(post.programataLa, fus)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {done.length > 0 ? (
        <details className="mt-6 rounded-2xl border border-hair bg-white px-4 py-3">
          <summary className="cursor-pointer text-[14px] font-semibold text-bone">Publicate în ultimele 7 zile ({done.length})</summary>
          <ul className="mt-2 grid gap-1.5">
            {done.map((post) => (
              <li key={post.id} className="text-[13px] text-dim">
                <span className="font-[family-name:var(--font-jbmono),ui-monospace,monospace] text-bone">{post.fisier}</span> · {post.publicataLa ? agoLabel(post.publicataLa) : ""}
                {post.publicataDe ? ` · ${post.publicataDe}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </main>
  );
}

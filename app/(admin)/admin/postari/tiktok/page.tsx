import type { Metadata } from "next";
import Link from "next/link";
import { Music2 } from "lucide-react";
import { listAccounts } from "@/lib/postari/conturi";
import { listPosts } from "@/lib/postari/postari";
import { readSettings } from "@/lib/postari/setari";
import { addDays, agoLabel, momentLabel, todayIn, zonedToUtc } from "@/lib/postari/timp";
import { InlineNote } from "@/components/panou/ui/actions";
import { btnClass, Card, Pill, SectionTitle } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { ScreenHead } from "@/components/panou/postari/shared";
import { TiktokDrafts } from "@/components/panou/postari/tiktok-drafts";
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
  const now = Date.now();
  const tiktok = posts.ok ? posts.data.filter((post) => post.platforma === "tiktok") : [];
  const drafts = tiktok.filter((post) => post.stare === "in_ciorne").sort((a, b) => (b.trimisaLa ?? "").localeCompare(a.trimisaLa ?? ""));
  const upcoming = tiktok.filter((post) => post.stare === "planificata" || post.stare === "in_lucru").slice(0, 5);
  const next = tiktok.find((post) => post.stare === "planificata") ?? null;
  const failed = tiktok.filter((post) => post.stare === "esuata");
  const done = tiktok
    .filter((post) => post.stare === "publicata")
    .sort((a, b) => (b.publicataLa ?? "").localeCompare(a.publicataLa ?? ""))
    .slice(0, 10);
  const account = accounts.ok ? (accounts.data.find((item) => item.platforma === "tiktok") ?? null) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ScreenHead
        title="De publicat pe TikTok"
        info={
          <>
            TikTok nu primește descrierea prin API.
            <br />1. „Copiază descrierea”
            <br />2. Deschide ciorna în TikTok
            <br />3. Lipește și postează
            <br />4. „Publicat”, aici
            <br />Dacă uiți, se marchează singur când TikTok confirmă.
          </>
        }
      />

      {!account ? (
        <InlineNote tone="apricot">
          TikTok nu e conectat: nimic nu ajunge în ciorne.{" "}
          <Link href="/admin/postari/setari#conturi" className="font-medium underline underline-offset-2">
            Conectează-l
          </Link>
        </InlineNote>
      ) : account.stare !== "activ" ? (
        <InlineNote tone="rose">
          {account.eroare ?? "Conectarea TikTok a căzut."}{" "}
          <Link href="/admin/postari/setari#conturi" className="font-medium underline underline-offset-2">
            Conectează din nou
          </Link>
        </InlineNote>
      ) : null}
      {!posts.ok ? <InlineNote tone="rose">{posts.message}</InlineNote> : null}

      {drafts.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={Music2}
            title="Nimic de publicat acum"
            text={next ? `Următorul pleacă ${momentLabel(next.programataLa, fus)}.` : undefined}
            action={
              <Link href="/admin/postari" className={btnClass({ variant: "outline", size: "sm" })}>
                Vezi coada
              </Link>
            }
          />
        </Card>
      ) : (
        <section aria-label="Ciorne de publicat" className="space-y-3">
          <p className="flex items-center gap-2 text-[14px] font-medium">
            În ciorne <Pill tone="apricot">{drafts.length}</Pill>
          </p>
          <TiktokDrafts drafts={drafts} fus={fus} now={now} markPublished={markTiktokPublishedAction} />
        </section>
      )}

      {failed.length > 0 ? (
        <InlineNote tone="rose">
          {failed.length === 1 ? "Un clip TikTok n-a ajuns în ciorne" : `${failed.length} clipuri TikTok n-au ajuns în ciorne`}: {failed.map((post) => `„${post.fisier}”`).join(", ")}.{" "}
          <Link href="/admin/postari" className="font-medium underline underline-offset-2">
            Vezi motivul
          </Link>
        </InlineNote>
      ) : null}

      {upcoming.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <SectionTitle title="Urmează" hint={upcoming.length} />
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {upcoming.map((post) => (
              <li key={post.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5">
                <span className="break-all font-mono text-[13px]">{post.fisier}</span>
                <span className="text-[12.5px] text-muted-foreground">{post.stare === "in_lucru" ? "se trimite acum" : momentLabel(post.programataLa, fus)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {done.length > 0 ? (
        <Card className="py-3">
          <details>
            <summary className="cursor-pointer text-[14px] font-medium">Publicate, ultimele 7 zile ({done.length})</summary>
            <ul className="mt-3 space-y-1.5">
              {done.map((post) => (
                <li key={post.id} className="text-[13px] text-muted-foreground">
                  <span className="font-mono text-foreground/85">{post.fisier}</span> · {post.publicataLa ? agoLabel(post.publicataLa) : ""}
                  {post.publicataDe ? ` · ${post.publicataDe}` : ""}
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ) : null}
    </div>
  );
}

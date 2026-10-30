import type { Metadata } from "next";
import Link from "next/link";
import { Music2 } from "lucide-react";
import { listAccounts } from "@/lib/postari/conturi";
import { listPosts } from "@/lib/postari/postari";
import { readSettings } from "@/lib/postari/setari";
import { addDays, agoLabel, momentLabel, todayIn, zonedToUtc } from "@/lib/postari/timp";
import { InlineNote } from "@/components/panou/ui/actions";
import { untilRo } from "@/components/panou/ui/format";
import { btnClass, Card, Pill, SectionTitle } from "@/components/panou/ui/primitives";
import { EmptyState } from "@/components/panou/ui/states";
import { ScreenHead } from "@/components/panou/postari/shared";
import { TiktokDrafts } from "@/components/panou/postari/tiktok-drafts";
import { markTiktokPublishedAction } from "../actions";

export const metadata: Metadata = { title: "De publicat pe TikTok — MERIDIAN Postări", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STEPS = [
  "„Copiază descrierea” la clipul de mai jos.",
  "Deschide notificarea TikTok (sau ciornele din profil).",
  "Lipește descrierea și apasă „Postează”.",
  "Înapoi aici, „Publicat”.",
];

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
        text="Gândit pentru telefon: copiază descrierea, deschide TikTok, publică. Dacă uiți, clipul se marchează singur când TikTok confirmă."
      />

      <Card className="py-4">
        <SectionTitle title="Cum publici" hint="TikTok nu primește descrierea prin API, așa că o copiezi de aici." />
        <ol className="mt-3 space-y-2">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-[12.5px]">
              <span className="pu-num mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-lav/25 bg-lav/10 text-[11px] text-[#D8CCFF]">{index + 1}</span>
              <span className="text-foreground/85">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      {!account ? (
        <InlineNote tone="apricot">
          Contul TikTok nu e conectat, deci nimic nu ajunge în ciorne.{" "}
          <Link href="/admin/postari/setari#conturi" className="font-medium underline underline-offset-2">
            Conectează-l în Setări
          </Link>
        </InlineNote>
      ) : account.stare !== "activ" ? (
        <InlineNote tone="rose">
          {account.eroare ?? "Conectarea TikTok nu mai e bună."}{" "}
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
            text={
              next
                ? `Când un clip TikTok e trimis în ciorne, apare aici, cu descrierea gata de copiat. Următorul pleacă ${momentLabel(next.programataLa, fus)}.`
                : "Când un clip TikTok e trimis în ciorne, apare aici, cu descrierea gata de copiat."
            }
            action={
              <Link href="/admin/postari" className={btnClass({ variant: "outline", size: "sm" })}>
                Vezi coada
              </Link>
            }
          />
        </Card>
      ) : (
        <section aria-label="Ciorne de publicat" className="space-y-3">
          <p className="flex items-center gap-2 text-[12.5px] font-medium">
            În ciorne, de publicat <Pill tone="apricot">{drafts.length}</Pill>
          </p>
          <TiktokDrafts drafts={drafts} fus={fus} now={now} markPublished={markTiktokPublishedAction} />
        </section>
      )}

      {failed.length > 0 ? (
        <InlineNote tone="rose">
          {failed.length === 1 ? "Un clip TikTok n-a ajuns în ciorne" : `${failed.length} clipuri TikTok n-au ajuns în ciorne`}: {failed.map((post) => `„${post.fisier}”`).join(", ")}.{" "}
          <Link href="/admin/postari" className="font-medium underline underline-offset-2">
            Vezi motivul în Coadă
          </Link>
        </InlineNote>
      ) : null}

      {upcoming.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <SectionTitle title="Urmează" hint="Clipurile TikTok încă neajunse în ciorne." />
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {upcoming.map((post) => (
              <li key={post.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5">
                <span className="break-all font-mono text-[11.5px]">{post.fisier}</span>
                <span className="text-[11px] text-muted-foreground">{post.stare === "in_lucru" ? "se trimite acum" : momentLabel(post.programataLa, fus)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {done.length > 0 ? (
        <Card className="py-3">
          <details>
            <summary className="cursor-pointer text-[12.5px] font-medium">Publicate în ultimele 7 zile ({done.length})</summary>
            <ul className="mt-3 space-y-1.5">
              {done.map((post) => (
                <li key={post.id} className="text-[11.5px] text-muted-foreground">
                  <span className="font-mono text-foreground/85">{post.fisier}</span> · {post.publicataLa ? agoLabel(post.publicataLa) : ""}
                  {post.publicataDe ? ` · ${post.publicataDe}` : ""}
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="De ce nu publică automat pe TikTok" />
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          TikTok nu permite publicarea directă din portal. Clipul ajunge în ciornele contului, iar omul îl publică din aplicație — de aceea un clip în ciorne nu e o postare ratată, ci un drum cu om la capăt.
        </p>
        <p className="mt-2 text-[10.5px] text-muted-foreground/70">Următoarea postare TikTok din coadă: {next ? untilRo(next.programataLa, now) : "niciuna programată"}</p>
      </Card>
    </div>
  );
}

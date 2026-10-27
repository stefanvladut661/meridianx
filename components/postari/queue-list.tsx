"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STARE_LABEL, STARE_TONE, stateDetail, type PostView } from "@/lib/postari/coada-shared";
import { PLATFORMA_LABEL } from "@/lib/postari/limite";
import { dayLabel, momentLabel, todayIn, zonedParts } from "@/lib/postari/timp";
import { cn } from "@/lib/utils";
import { IconExternal } from "./icons";
import { btnSmall, Empty, Notice, Tag } from "./ui";

type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function igKind(post: PostView): string | null {
  if (post.platforma !== "instagram") return "în ciorne";
  if (post.optiuni.tip === "trial_reel") return post.optiuni.absolvire === "automat" ? "Trial Reel, trece singur" : "Trial Reel";
  return post.optiuni.in_feed === false ? "Reel, fără feed" : "Reel";
}

function PostRowItem({ post, fus, busy, onRemove, onRetry }: { post: PostView; fus: string; busy: boolean; onRemove: (post: PostView) => void; onRetry: (post: PostView) => void }) {
  const time = zonedParts(new Date(post.programataLa), fus).time;
  const detail = stateDetail(post, (iso) => zonedParts(new Date(iso), fus).time);
  return (
    <li className={cn("grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-start", post.stare === "scoasa" && "opacity-60")}>
      <p className="font-[family-name:var(--font-jbmono),ui-monospace,monospace] text-[15px] font-semibold tabular-nums text-bone">
        {time}
        <span className="ml-2 font-sans text-[12px] font-normal text-dim sm:ml-0 sm:block">{post.sursaOra === "slot" ? "slot" : "oră fixă"}</span>
      </p>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag tone={post.platforma === "instagram" ? "accent" : "neutral"}>
            {PLATFORMA_LABEL[post.platforma]} · {igKind(post)}
          </Tag>
          <Tag tone={STARE_TONE[post.stare]}>{STARE_LABEL[post.stare]}</Tag>
        </div>
        <p className="mt-1 break-all font-[family-name:var(--font-jbmono),ui-monospace,monospace] text-[13px] text-bone">{post.fisier}</p>
        {post.descriere ? <p className="mt-0.5 line-clamp-2 text-[13px] text-dim">{post.descriere}</p> : null}
        {detail ? <p className="mt-1 text-[13px] text-bone/80">{detail}</p> : null}
        {post.stare === "esuata" && post.eroare ? (
          <p className="mt-1 text-[13px] text-[var(--ap-error)]">
            {post.eroare}
            {post.incercari > 1 ? <span className="text-dim"> ({post.incercari} încercări)</span> : null}
          </p>
        ) : null}
        {post.stare === "publicata" ? (
          <p className="mt-1 text-[13px] text-dim">
            {post.publicataLa ? `Publicată ${momentLabel(post.publicataLa, fus)}` : "Publicată"}
            {post.publicataDe ? ` · ${post.publicataDe}` : ""}
          </p>
        ) : null}
        {post.stare === "in_ciorne" && post.trimisaLa ? <p className="mt-1 text-[13px] text-dim">În ciornele TikTok din {momentLabel(post.trimisaLa, fus)}. O publici din aplicație, cu descrierea din „De publicat pe TikTok”.</p> : null}
        {post.avertisment ? <p className="mt-1 text-[13px] text-[var(--ap-warn)]">{post.avertisment}</p> : null}
        {post.stare === "scoasa" && post.scoasaLa ? <p className="mt-1 text-[13px] text-dim">Scoasă {momentLabel(post.scoasaLa, fus)}.</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {post.link ? (
          <a href={post.link} target="_blank" rel="noreferrer" className={cn(btnSmall, "inline-flex items-center gap-1.5")}>
            Vezi postarea
            <IconExternal size={14} />
            <span className="sr-only">(filă nouă)</span>
          </a>
        ) : null}
        {post.stare === "esuata" ? (
          <button type="button" disabled={busy} onClick={() => onRetry(post)} className={btnSmall} aria-label={`Reîncearcă ${post.fisier} pe ${PLATFORMA_LABEL[post.platforma]}`}>
            Reîncearcă
          </button>
        ) : null}
        {post.sePoateScoate ? (
          <button type="button" disabled={busy} onClick={() => onRemove(post)} className={cn(btnSmall, "text-dim")} aria-label={`Scoate din coadă ${post.fisier} pe ${PLATFORMA_LABEL[post.platforma]}`}>
            Scoate din coadă
          </button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Coada pe zile: fiecare postare cu ora, platforma, starea și ce se poate face
 * cu ea. Eșuatele și cele în lucru stau sus, oricând ar fi fost ora lor.
 */
export function QueueList({ posts, fus, remove, retry }: { posts: PostView[]; fus: string; remove: (id: string) => Promise<ActionResult>; retry: (id: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showDone, setShowDone] = useState(false);

  function run(post: PostView, action: (id: string) => Promise<ActionResult>) {
    setBusyId(post.id);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action(post.id);
        setMessage({ ok: result.ok, text: result.message });
        router.refresh();
      } catch {
        setMessage({ ok: false, text: "Serverul n-a răspuns (rețea sau sesiune). Reîncarcă pagina și încearcă din nou." });
      } finally {
        setBusyId(null);
      }
    });
  }

  const today = todayIn(fus);
  const attention = posts.filter((post) => post.stare === "esuata" || (post.stare === "in_lucru" && zonedParts(new Date(post.programataLa), fus).day < today));
  const rest = posts.filter((post) => !attention.includes(post) && (showDone || !["scoasa"].includes(post.stare)));
  const groups = new Map<string, PostView[]>();
  for (const post of rest) {
    const day = zonedParts(new Date(post.programataLa), fus).day;
    groups.set(day, [...(groups.get(day) ?? []), post]);
  }
  const hidden = posts.filter((post) => post.stare === "scoasa").length;

  const row = (post: PostView) => <PostRowItem key={post.id} post={post} fus={fus} busy={pending && busyId === post.id} onRemove={(item) => run(item, remove)} onRetry={(item) => run(item, retry)} />;

  return (
    <div className="grid gap-5">
      <p role="status" aria-live="polite" className="sr-only">
        {message?.text}
      </p>
      {message ? (
        <Notice tone={message.ok ? "ok" : "error"} className="max-w-3xl">
          {message.text}
        </Notice>
      ) : null}

      {attention.length > 0 ? (
        <section aria-labelledby="coada-atentie">
          <h2 id="coada-atentie" className="text-[15px] font-semibold text-[var(--ap-error)]">
            De văzut ({attention.length})
          </h2>
          <ul className="mt-2 divide-y divide-hair rounded-xl border border-[var(--ap-error)]/30 bg-white">{attention.map(row)}</ul>
        </section>
      ) : null}

      {groups.size === 0 && attention.length === 0 ? (
        <Empty>
          Coada e goală. Pune un plan la <Link href="/admin/postari/plan" className="font-semibold text-[var(--md-a1)] underline underline-offset-2">Plan nou</Link>, sau lasă-l pe Claude să-l scrie din manifest.json, la <Link href="/admin/postari/clipuri" className="font-semibold text-[var(--md-a1)] underline underline-offset-2">Clipuri</Link>.
        </Empty>
      ) : null}

      {[...groups.entries()].map(([day, items]) => {
        const ig = items.filter((post) => post.platforma === "instagram").length;
        const tt = items.length - ig;
        return (
          <section key={day} aria-labelledby={`zi-${day}`}>
            <h2 id={`zi-${day}`} className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold text-bone">
              {day === today ? "Azi" : dayLabel(day)}
              <span className="text-[13px] font-normal text-dim">
                {day === today ? `${dayLabel(day)} · ` : ""}
                {ig ? `${ig} Instagram` : ""}
                {ig && tt ? " · " : ""}
                {tt ? `${tt} TikTok` : ""}
              </span>
            </h2>
            <ul className="mt-2 divide-y divide-hair rounded-xl border border-hair bg-white">{items.map(row)}</ul>
          </section>
        );
      })}

      {hidden > 0 ? (
        <button type="button" onClick={() => setShowDone((value) => !value)} className="justify-self-start text-[13px] text-dim underline underline-offset-2 hover:text-bone">
          {showDone ? "Ascunde postările scoase din coadă" : `Arată și postările scoase din coadă (${hidden})`}
        </button>
      ) : null}
    </div>
  );
}

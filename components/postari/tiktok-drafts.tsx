"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { PostView } from "@/lib/postari/coada-shared";
import { agoLabel, momentLabel } from "@/lib/postari/timp";
import { cn } from "@/lib/utils";
import { IconCheck, IconCopy } from "./icons";
import { Notice } from "./ui";

type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/** Copiază în clipboard; pe un browser care nu lasă, selectează textul ca să-l copiezi tu. */
async function copyText(text: string, fallback: HTMLElement | null): Promise<"copiat" | "selectat"> {
  try {
    await navigator.clipboard.writeText(text);
    return "copiat";
  } catch {
    if (fallback) {
      const range = document.createRange();
      range.selectNodeContents(fallback);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    return "selectat";
  }
}

function DraftCard({ post, fus, busy, onPublished }: { post: PostView; fus: string; busy: boolean; onPublished: (post: PostView) => void }) {
  const [copied, setCopied] = useState<"copiat" | "selectat" | null>(null);
  const block = useRef<HTMLParagraphElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    const result = await copyText(post.caption, block.current);
    setCopied(result);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 4000);
  }

  return (
    <li className="rounded-2xl border border-hair bg-char p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="break-all font-[family-name:var(--font-jbmono),ui-monospace,monospace] text-[13px] text-bone">{post.fisier}</p>
        <p className="text-[13px] text-dim">{post.trimisaLa ? `în ciorne ${agoLabel(post.trimisaLa)}` : `programată ${momentLabel(post.programataLa, fus)}`}</p>
      </div>
      {post.caption ? (
        <p ref={block} className="mt-3 select-all whitespace-pre-wrap break-words rounded-xl border border-hair bg-[var(--ap-side)] px-4 py-3 text-[16px] leading-relaxed text-bone">
          {post.caption}
        </p>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-hair-strong px-4 py-3 text-[15px] text-dim">Clipul n-are descriere în plan: scrie una direct în TikTok.</p>
      )}
      {post.avertisment ? <p className="mt-2 text-[13px] text-[var(--ap-warn)]">{post.avertisment}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {post.caption ? (
          <button type="button" onClick={() => void copy()} className={cn(copied === "copiat" ? "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--ap-ok-soft)] px-4 text-[16px] font-semibold text-[var(--ap-ok)]" : "btn btn-light !min-h-12 !w-full !gap-2 !px-4 !text-[16px]")} aria-label={`Copiază descrierea pentru ${post.fisier}`}>
            {copied === "copiat" ? <IconCheck size={20} /> : <IconCopy size={20} />}
            {copied === "copiat" ? "Copiat" : copied === "selectat" ? "Selectat: apasă lung → Copiază" : "Copiază descrierea"}
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={() => onPublished(post)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-hair-strong bg-char px-4 text-[16px] font-semibold text-bone hover:bg-[var(--ap-hover)] disabled:opacity-50" aria-label={`Marchează publicat ${post.fisier}`}>
          {busy ? "Se marchează…" : "Publicat"}
        </button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {copied === "copiat" ? "Descrierea e copiată." : copied === "selectat" ? "Descrierea e selectată; copiaz-o din meniul telefonului." : ""}
      </p>
    </li>
  );
}

/**
 * Lista ciornelor TikTok de publicat, făcută pentru telefonul pe care vine
 * notificarea: descrierea mare, „Copiază descrierea” cu un deget, „Publicat”
 * după ce ai postat din aplicație.
 */
export function TiktokDrafts({ drafts, fus, markPublished }: { drafts: PostView[]; fus: string; markPublished: (id: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function published(post: PostView) {
    setBusyId(post.id);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await markPublished(post.id);
        setMessage({ ok: result.ok, text: result.message });
        if (result.ok) router.refresh();
      } catch {
        setMessage({ ok: false, text: "Serverul n-a răspuns (rețea sau sesiune). Încearcă din nou." });
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="grid gap-3">
      <p role="status" aria-live="polite" className="sr-only">
        {message?.text}
      </p>
      {message ? <Notice tone={message.ok ? "ok" : "error"}>{message.text}</Notice> : null}
      <ul className="grid gap-3">
        {drafts.map((post) => (
          <DraftCard key={post.id} post={post} fus={fus} busy={pending && busyId === post.id} onPublished={published} />
        ))}
      </ul>
    </div>
  );
}

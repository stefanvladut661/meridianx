"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Clock, Copy, ExternalLink, Smartphone } from "lucide-react";
import type { PostView } from "@/lib/postari/coada-shared";
import { momentLabel } from "@/lib/postari/timp";
import { relativeRo } from "../ui/format";
import { Btn, btnClass, Card, Pill } from "../ui/primitives";
import { useToast } from "../ui/toast";
import { UNREACHABLE, type ActionResult } from "./shared";

/** Butoanele de pe telefon sunt mai înalte (44 px); de la `sm` în sus au mărimea din prototip. */
const TOUCH = "h-11 px-4 text-[14px] sm:h-8 sm:px-3 sm:text-[12.5px]";

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

function DraftCard({ post, fus, now, busy, onPublished }: { post: PostView; fus: string; now: number; busy: boolean; onPublished: (post: PostView) => void }) {
  const { notify } = useToast();
  const block = useRef<HTMLDivElement>(null);
  const hasText = post.caption.trim().length > 0;
  // Descrierea și, separat, hashtag-urile de la coada ei (caption = descriere + rând gol + hashtag-uri).
  const body = post.descriere.trim();
  const tags = post.caption.trim().slice(body.length).trim();

  async function copy() {
    const result = await copyText(post.caption, block.current);
    if (result === "copiat") notify("Descrierea e în clipboard. Deschide TikTok și lipește-o.");
    else notify("Descrierea e selectată: apasă lung și alege „Copiază”, apoi deschide TikTok.", "warn");
  }

  return (
    <li>
      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-white/[0.06] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Pill tone="sky" dot>
              în ciorne
            </Pill>
            <span className="break-all font-mono text-[10.5px] text-muted-foreground">{post.fisier}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {momentLabel(post.programataLa, fus)}
          </span>
        </div>
        <div className="px-4 py-3">
          {hasText ? (
            <div ref={block} className="select-all">
              {body ? <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-foreground">{body}</p> : null}
              {tags ? <p className={`break-words text-[12.5px] text-lav/85 ${body ? "mt-1.5" : ""}`}>{tags}</p> : null}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/[0.14] px-3 py-2.5 text-[13px] text-muted-foreground">Clipul n-are descriere în plan: scrie una direct în TikTok.</p>
          )}
          {post.avertisment ? <p className="mt-2 rounded-lg border border-apricot/20 bg-apricot/[0.06] px-2 py-1 text-[10.5px] text-[#FFD0AC]">{post.avertisment}</p> : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasText ? (
              <Btn size="sm" variant="primary" icon={Copy} className={TOUCH} onClick={() => void copy()} aria-label={`Copiază descrierea pentru ${post.fisier}`}>
                Copiază descrierea
              </Btn>
            ) : null}
            <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer" className={btnClass({ variant: "outline", size: "sm", className: `gap-1.5 ${TOUCH}` })}>
              Deschide TikTok <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(filă nouă)</span>
            </a>
            <Btn size="sm" variant="mint" icon={CheckCircle2} className={TOUCH} disabled={busy} onClick={() => onPublished(post)} aria-label={`Marchează publicat ${post.fisier}`}>
              {busy ? "Se marchează…" : "Publicat"}
            </Btn>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <Smartphone className="h-3 w-3 shrink-0" aria-hidden="true" />
            {post.trimisaLa ? `trimis ${relativeRo(post.trimisaLa, now)}` : "trimis de curând"} · se marchează singur în cel mult 30 de minute de la confirmarea TikTok
          </p>
        </div>
      </Card>
    </li>
  );
}

/**
 * Ciornele TikTok de publicat, pe telefon: descrierea mare, „Copiază
 * descrierea” cu un deget, „Publicat” după ce ai postat din aplicație.
 * Clipul se marchează singur când TikTok confirmă publicarea.
 */
export function TiktokDrafts({ drafts, fus, now, markPublished }: { drafts: PostView[]; fus: string; now: number; markPublished: (id: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function published(post: PostView) {
    setBusyId(post.id);
    startTransition(async () => {
      try {
        const result = await markPublished(post.id);
        notify(result.ok ? "Marcat ca publicat. Mulțumim." : result.message, result.ok ? "default" : "error");
        if (result.ok) router.refresh();
      } catch {
        notify(UNREACHABLE, "error");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <ul className="space-y-3">
      {drafts.map((post) => (
        <DraftCard key={post.id} post={post} fus={fus} now={now} busy={pending && busyId === post.id} onPublished={published} />
      ))}
    </ul>
  );
}

import type { ReactNode } from "react";
import type { PreviewPost, VerifiedPlan } from "@/lib/postari/plan-verify";
import { dayLabel, momentLabel, zonedParts } from "@/lib/postari/timp";
import { cn } from "@/lib/utils";
import { ClipPreview } from "./clip-preview";
import { IconExternal } from "./icons";
import { IssueList } from "./issue-list";
import { Notice, Tag } from "./ui";

function PlatformTags({ post }: { post: PreviewPost }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {post.instagram ? (
        <Tag tone="accent" title={post.instagram.tip === "trial_reel" ? "Trial Reel: se arată întâi doar celor care nu te urmăresc." : post.instagram.inFeed ? "Reel, apare și în feed." : "Reel, doar la Reels."}>
          Instagram · {post.instagram.tip === "trial_reel" ? `Trial Reel, ${post.instagram.absolvire === "automat" ? "trece singur la urmăritori" : "îl treci tu la urmăritori"}` : post.instagram.inFeed ? "Reel" : "Reel, fără feed"}
        </Tag>
      ) : null}
      {post.tiktok ? <Tag tone="neutral" title="Ajunge în ciornele din aplicația TikTok; îl publici tu, cu descrierea copiată din admin.">TikTok · în ciorne</Tag> : null}
    </div>
  );
}

function PostCard({ post, fus }: { post: PreviewPost; fus: string }) {
  const errors = post.issues.filter((issue) => issue.nivel === "eroare").length;
  return (
    <li className={cn("rounded-xl border bg-white px-4 py-3", errors > 0 ? "border-[var(--ap-error)]/40" : "border-hair")}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <p className="text-[14.5px] font-semibold text-bone">
            <span className="text-dim">{post.index + 1}.</span> {post.ora ? zonedParts(new Date(post.ora), fus).time : "fără oră"}
            <span className="ml-2 text-[12.5px] font-normal text-dim">{post.sursaOra === "slot" ? "slot" : post.sursaOra === "fixa" ? "oră fixă" : ""}</span>
          </p>
          <p className="mt-0.5 break-all font-[family-name:var(--font-jbmono),ui-monospace,monospace] text-[13px] text-bone">{post.fisier}</p>
          <p className="text-[12.5px] text-dim">{post.clip?.summary ?? (post.fileId ? "necitit" : "nu e în folder")}</p>
        </div>
        <PlatformTags post={post} />
      </div>
      {post.caption ? (
        <div className="mt-2 rounded-lg border border-hair bg-[var(--ap-side)] px-3 py-2">
          <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-bone">{post.caption}</p>
          <p className="mt-1 text-[12px] text-dim">
            {post.stats.chars} / 2200 caractere · {post.stats.hashtags} {post.stats.hashtags === 1 ? "hashtag" : "hashtag-uri"}
          </p>
        </div>
      ) : null}
      <IssueList issues={post.issues} className="mt-2" />
      {post.fileId ? (
        <div className="mt-2">
          <ClipPreview fileId={post.fileId} name={post.fisier} />
        </div>
      ) : null}
    </li>
  );
}

/**
 * Previzualizarea unui plan verificat: rezumatul, problemele planului și
 * fiecare postare (clipul, descrierea cum pleacă, platformele, ora), pe zile.
 */
export function PlanPreview({ plan, action }: { plan: VerifiedPlan; action: ReactNode }) {
  const { summary } = plan;
  const groups = new Map<string, PreviewPost[]>();
  for (const post of [...plan.posts].sort((a, b) => (a.ora ?? "9").localeCompare(b.ora ?? "9") || a.index - b.index)) {
    const key = post.ora ? zonedParts(new Date(post.ora), plan.fus).day : "fără oră";
    groups.set(key, [...(groups.get(key) ?? []), post]);
  }

  return (
    <div className="mt-3 grid gap-4">
      <div className="rounded-xl border border-hair bg-white px-4 py-3">
        <p className="text-[14px] text-bone">
          {plan.nume ? <span className="font-semibold">„{plan.nume}”: </span> : null}
          {summary.posts} {summary.posts === 1 ? "postare" : "postări"} · {summary.instagram} pe Instagram · {summary.tiktok} pe TikTok
          {summary.first ? ` · ${momentLabel(summary.first, plan.fus)}${summary.last && summary.last !== summary.first ? ` – ${momentLabel(summary.last, plan.fus)}` : ""}` : ""}
        </p>
        <p className="mt-0.5 text-[13px] text-dim">
          {plan.folder ? (
            <a href={plan.folder.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:text-bone hover:underline">
              {plan.folder.path}
              <IconExternal size={13} />
              <span className="sr-only">(filă nouă)</span>
            </a>
          ) : (
            "folderul nu e găsit"
          )}
          {" · "}ore în {plan.fus}
          {" · "}
          <span className={summary.errors > 0 ? "font-semibold text-[var(--ap-error)]" : "text-[var(--ap-ok)]"}>{summary.errors === 0 ? "fără erori" : `${summary.errors} ${summary.errors === 1 ? "eroare" : "erori"}`}</span>
          {summary.warnings > 0 ? <span className="text-[var(--ap-warn)]">{` · ${summary.warnings} ${summary.warnings === 1 ? "atenționare" : "atenționări"}`}</span> : null}
          {plan.pending > 0 ? <span>{` · ${plan.pending} clipuri necitite`}</span> : null}
        </p>
        <div className="mt-3">{action}</div>
      </div>

      {plan.issues.length > 0 ? (
        <Notice tone={plan.issues.some((issue) => issue.nivel === "eroare") ? "error" : "warn"}>
          <IssueList issues={plan.issues} />
        </Notice>
      ) : null}

      {[...groups.entries()].map(([day, posts]) => (
        <section key={day} aria-label={day === "fără oră" ? "Fără oră" : dayLabel(day, true)}>
          <h3 className="flex items-center gap-2 text-[14px] font-semibold text-bone">
            {day === "fără oră" ? "Fără oră" : dayLabel(day, true)}
            <Tag tone="muted">{posts.length}</Tag>
          </h3>
          <ul className="mt-2 grid gap-3">
            {posts.map((post) => (
              <PostCard key={post.index} post={post} fus={plan.fus} />
            ))}
          </ul>
        </section>
      ))}

      {summary.posts > 3 ? <div className="rounded-xl border border-hair bg-white px-4 py-3">{action}</div> : null}
    </div>
  );
}

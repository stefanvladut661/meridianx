import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import type { PreviewPost, VerifiedPlan } from "@/lib/postari/plan-verify";
import { dayLabel, momentLabel, zonedParts } from "@/lib/postari/timp";
import { cn } from "@/lib/utils";
import { InlineNote } from "../ui/actions";
import { Card, Pill } from "../ui/primitives";
import { ProgressBar } from "../ui/states";
import { ClipPreview } from "./clips";
import { ClipTile, HashtagText, IssueList, zoneLabel } from "./shared";

const CAPTION_LIMIT = 2200;

function PlatformPills({ post }: { post: PreviewPost }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {post.instagram ? (
        <span title={post.instagram.tip === "trial_reel" ? "Trial Reel: se arată întâi doar celor care nu te urmăresc." : post.instagram.inFeed ? "Reel, apare și în feed." : "Reel, doar la Reels."}>
          <Pill tone="rose">
            Instagram ·{" "}
            {post.instagram.tip === "trial_reel"
              ? `Trial Reel, ${post.instagram.absolvire === "automat" ? "trece singur la urmăritori" : "îl treci tu la urmăritori"}`
              : post.instagram.inFeed
                ? "Reel"
                : "Reel, fără feed"}
          </Pill>
        </span>
      ) : null}
      {post.tiktok ? (
        <span title="Ajunge în ciornele din aplicația TikTok; îl publici tu, cu descrierea copiată din admin.">
          <Pill tone="sky">TikTok · în ciorne</Pill>
        </span>
      ) : null}
    </div>
  );
}

function PostCard({ post, fus }: { post: PreviewPost; fus: string }) {
  const errors = post.issues.filter((issue) => issue.nivel === "eroare").length;
  const platform = post.platforme[0] ?? null;
  return (
    <li className={cn("rounded-2xl border bg-white/[0.02] p-3.5", errors > 0 ? "border-rose/30" : "border-white/[0.07]")}>
      <div className="flex flex-wrap items-start gap-3">
        <ClipTile platform={platform} durationMs={post.clip?.durationMs ?? null} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="pu-num text-[15px]">{post.ora ? zonedParts(new Date(post.ora), fus).time : "fără oră"}</span>
            <span className="text-[10.5px] text-muted-foreground">
              {post.sursaOra === "slot" ? "slot" : post.sursaOra === "fixa" ? "oră fixă" : ""} · postarea {post.index + 1}
            </span>
          </div>
          <p className="mt-0.5 break-all font-mono text-[11.5px]">{post.fisier}</p>
          <p className="text-[10.5px] text-muted-foreground">{post.clip?.summary ?? (post.fileId ? "necitit încă" : "nu e în folder")}</p>
          <div className="mt-2">
            <PlatformPills post={post} />
          </div>
        </div>
      </div>

      {post.caption ? (
        <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
          <HashtagText text={post.caption} className="text-[13px] leading-relaxed" />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ProgressBar value={(post.stats.chars / CAPTION_LIMIT) * 100} tone={post.stats.chars > CAPTION_LIMIT ? "rose" : "lav"} className="max-w-[160px]" />
            <span className="text-[10.5px] text-muted-foreground">
              {post.stats.chars} / {CAPTION_LIMIT} caractere · {post.stats.hashtags} {post.stats.hashtags === 1 ? "hashtag" : "hashtag-uri"}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11.5px] text-muted-foreground">Fără descriere în plan.</p>
      )}

      <IssueList issues={post.issues} className="mt-2.5" />
      {post.fileId ? (
        <div className="mt-2.5">
          <ClipPreview fileId={post.fileId} name={post.fisier} />
        </div>
      ) : null}
    </li>
  );
}

/**
 * Previzualizarea unui plan verificat: rezumatul cu „Aprobă planul”, problemele
 * planului și fiecare postare — clipul, descrierea cum pleacă (cu hashtag-urile
 * în lavandă), platformele și ora — grupate pe zile, în ora planului.
 */
export function PlanPreview({ plan, action }: { plan: VerifiedPlan; action: ReactNode }) {
  const { summary } = plan;
  const groups = new Map<string, PreviewPost[]>();
  for (const post of [...plan.posts].sort((a, b) => (a.ora ?? "9").localeCompare(b.ora ?? "9") || a.index - b.index)) {
    const key = post.ora ? zonedParts(new Date(post.ora), plan.fus).day : "fără oră";
    groups.set(key, [...(groups.get(key) ?? []), post]);
  }

  return (
    <div className="space-y-4">
      <Card className="py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">{plan.nume ? `„${plan.nume}”` : "Plan fără nume"}</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              {summary.posts} {summary.posts === 1 ? "postare" : "postări"} · {summary.instagram} pe Instagram · {summary.tiktok} pe TikTok
              {summary.first ? ` · ${momentLabel(summary.first, plan.fus)}${summary.last && summary.last !== summary.first ? ` – ${momentLabel(summary.last, plan.fus)}` : ""}` : ""}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {plan.folder ? (
                <a href={plan.folder.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline">
                  {plan.folder.path} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  <span className="sr-only">(filă nouă)</span>
                </a>
              ) : (
                "folderul nu e găsit"
              )}
              {" · "}
              {zoneLabel(plan.fus)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={summary.errors === 0 ? "mint" : "rose"} dot>
              {summary.errors === 0 ? "fără erori" : `${summary.errors} ${summary.errors === 1 ? "eroare" : "erori"}`}
            </Pill>
            {summary.warnings > 0 ? <Pill tone="apricot">{`${summary.warnings} ${summary.warnings === 1 ? "atenționare" : "atenționări"}`}</Pill> : null}
            {plan.pending > 0 ? <Pill tone="neutral">{`${plan.pending} clipuri necitite`}</Pill> : null}
          </div>
        </div>
        <div className="mt-3 border-t border-white/[0.06] pt-3">{action}</div>
      </Card>

      {plan.issues.length > 0 ? (
        <InlineNote tone={plan.issues.some((issue) => issue.nivel === "eroare") ? "rose" : "apricot"}>
          <IssueList issues={plan.issues} />
        </InlineNote>
      ) : null}

      {[...groups.entries()].map(([day, posts]) => (
        <section key={day} aria-label={day === "fără oră" ? "Fără oră" : dayLabel(day, true)}>
          <h3 className="flex items-center gap-2 text-[12.5px] font-medium">
            {day === "fără oră" ? "Fără oră" : dayLabel(day, true)}
            <Pill tone="neutral">{posts.length}</Pill>
          </h3>
          <ul className="mt-2 space-y-3">
            {posts.map((post) => (
              <PostCard key={post.index} post={post} fus={plan.fus} />
            ))}
          </ul>
        </section>
      ))}

      {summary.posts > 3 ? <Card className="py-4">{action}</Card> : null}
    </div>
  );
}

import type { PlanSummary } from "@/lib/ads/plan-summary";
import { cn } from "@/lib/utils";

/**
 * Reclamele care ies din plan, una sub alta, cu exact textele pe care le
 * primește fiecare. Nu imită interfața Meta sau TikTok — e o fișă, nu o
 * machetă: ce text, ce titlu, ce buton, în ce reclamă. (Macheta vizuală a
 * unei reclame stă în `creative-preview.tsx`.)
 */
export function AdsPreview({
  summary,
  rotating,
  className,
}: {
  summary: PlanSummary;
  rotating: boolean;
  className?: string;
}) {
  if (summary.ads.length === 0) {
    return <p className={cn("text-[12.5px] text-muted-foreground", className)}>Nicio reclamă încă: planul nu are niciun text principal.</p>;
  }

  return (
    <ol className={cn("space-y-3", className)}>
      {summary.ads.map((ad, index) => (
        <li key={index} className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <p className="border-b border-white/[0.06] px-4 py-2.5 font-mono text-[11px] tracking-wide text-muted-foreground">
            <span className="text-foreground/85">Reclama {index + 1}</span> · {ad.name}
            {summary.videos.length > 1 ? (
              <span className="block text-muted-foreground">
                {ad.videoIndexes.length === 1
                  ? `Video ${ad.videoIndexes[0] + 1}: ${summary.videos[ad.videoIndexes[0]] ?? "—"}`
                  : `Video-uri: ${ad.videoIndexes.map((videoIndex) => videoIndex + 1).join(", ")} — platforma le alternează`}
              </span>
            ) : null}
          </p>
          <div className="space-y-3 px-4 py-4">
            {ad.primaryTexts.map((text, textIndex) => (
              <p key={textIndex} className="whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">
                {rotating && ad.primaryTexts.length > 1 ? <span className="mr-2 font-mono text-[10.5px] text-muted-foreground">T{textIndex + 1}</span> : null}
                {text}
              </p>
            ))}
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-white/[0.06] pt-3">
              <div className="min-w-0">
                {ad.headlines.map((headline, headlineIndex) => (
                  <p key={headlineIndex} className="text-[13px] font-semibold text-foreground">
                    {headline}
                  </p>
                ))}
                {ad.descriptions.map((description, descriptionIndex) => (
                  <p key={descriptionIndex} className="text-[12px] text-muted-foreground">
                    {description}
                  </p>
                ))}
                {ad.headlines.length === 0 && ad.descriptions.length === 0 ? <p className="text-[12px] text-muted-foreground">Fără titlu și descriere.</p> : null}
              </div>
              <span className="rounded-md bg-lav px-2 py-1 text-[11px] font-semibold text-[#171222]">{summary.cta ?? "buton neales"}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
